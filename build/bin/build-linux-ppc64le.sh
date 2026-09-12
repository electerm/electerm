#!/bin/bash
# Build electerm for ppc64le (PowerPC 64-bit little endian) Linux
#
# Electron runtime comes from the prebuilt ppc64le binaries published by IBM:
#   https://github.com/lex-ibm/electron-ppc64le-build-scripts
#   v41.0.3 is built on Ubuntu 22.04 (glibc 2.35), so this build targets
#   Ubuntu 22.04+ / Debian 12+ / RHEL 9+ ppc64le.
#   v41.x ships Node 24 (so node:sqlite is available without a flag).
#
# Strategy (adapted from build-linux-loong64.sh):
#   1. Build the x64 app to obtain the arch-independent app.asar
#   2. Download the ppc64le electron runtime (.zip)
#   3. Cross-compile the native modules (node-pty, @serialport/bindings-cpp)
#      with powerpc64le-linux-gnu-* on an ubuntu-22.04 runner so that the
#      glibc baseline of the native modules matches electron (2.35).
#      Both modules are N-API based, so they are ABI-stable across electron
#      versions and need no electron headers.
#   4. Merge asar + ppc64le electron + ppc64le native modules
#   5. Package as tar.gz + .deb
#   6. Upload to the GitHub release draft
#   7. Upload to R2 via the shared uploadToR2 helper (build-common.js), the same
#      way the other (non-loong64) builds do. It self-skips unless running in CI
#      with "[r2]" in the commit message and the CF_R2_* env vars set.
#
# Env:
#   ELECTRON_VERSION=<ver>        (default: 41.0.3)
#   ELECTRON_PPC64LE_URL=<url>    (default: derived from ELECTRON_VERSION)
#   SKIP_NATIVE=1                 skip native module build
#   WORKFLOW_NAME=<name>          electron-builder publish channel
#   GH_TOKEN=<token>              upload artifacts to the GitHub release draft
#   CF_R2_ACCOUNT_ID / CF_R2_BUCKET / CF_R2_ACCESS_KEY_ID / CF_R2_SECRET_ACCESS_KEY
#                                 required for the R2 upload (with [r2])

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ELECTRON_VERSION="${ELECTRON_VERSION:-41.0.3}"
ELECTRON_PPC64LE_URL="${ELECTRON_PPC64LE_URL:-https://github.com/lex-ibm/electron-ppc64le-build-scripts/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-ppc64le.zip}"

WORK_DIR="$PROJECT_ROOT/work-ppc64le"
OUTPUT_DIR="$PROJECT_ROOT/dist-ppc64le"
SKIP_NATIVE="${SKIP_NATIVE:-0}"
WORKFLOW_NAME="${WORKFLOW_NAME:-linux-ppc64le}"

# Native modules version, taken from the repo's package.json
NODE_PTY_VERSION="$(node -e "console.log(require('$PROJECT_ROOT/package.json').dependencies['node-pty'])")"

# @serialport/bindings-cpp is only a transitive dep (via serialport), so read the
# version that is actually installed rather than letting npm pick "latest" --
# the two can drift and a native module bump can silently break the build.
SERIALPORT_BINDINGS_VERSION="$(node -e "
    try {
        console.log(require('$PROJECT_ROOT/node_modules/@serialport/bindings-cpp/package.json').version)
    } catch (e) {
        console.log('')
    }
")"
SERIALPORT_SPEC="@serialport/bindings-cpp"
if [ -n "$SERIALPORT_BINDINGS_VERSION" ]; then
    SERIALPORT_SPEC="@serialport/bindings-cpp@${SERIALPORT_BINDINGS_VERSION}"
fi

CROSS_PREFIX="powerpc64le-linux-gnu-"
DEB_ARCH="ppc64el"                 # Debian's canonical name for ppc64le
TARBALL_ARCH="ppc64le"             # naming used by the electron/Node ecosystem

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ============================================================================
# Helpers
# ============================================================================
get_version() {
    node -e "console.log(require('$PROJECT_ROOT/package.json').version)"
}

write_install_src() {
    local src="$1"
    node -e "
        const { writeFileSync } = require('fs');
        writeFileSync('$PROJECT_ROOT/work/app/lib/install-src.js', \"module.exports = '${src}'\");
    "
}

# @serialport/bindings-cpp uses the termios2 interface (struct termios2 /
# TCGETS2 / TCSETS2). Those live in <asm-generic/termbits.h> +
# <asm-generic/ioctls.h>, but on powerpc the arch-specific <asm/termbits.h>
# only pulls in <asm-generic/termbits-common.h> and defines neither, so the file
# fails to compile ("aggregate has incomplete type", "TCGETS2 was not declared").
# The kernel ABI on ppc64le does use the generic termios2, so switching this one
# translation unit to the asm-generic headers is correct. The file includes no
# <termios.h>, so no struct termios redefinition is involved.
patch_serialport_source() {
    local file="$1"

    if [ ! -f "$file" ]; then
        log_error "Cannot patch, file not found: ${file}"
        return 1
    fi

    node -e "
        const fs = require('fs');
        const f = '${file}';
        const before = fs.readFileSync(f, 'utf8');
        const after = before
            .replace('#include <asm/ioctls.h>', '#include <asm-generic/ioctls.h>')
            .replace('#include <asm/termbits.h>', '#include <asm-generic/termbits.h>');
        if (after === before) {
            console.error('ERROR: no asm/ include found in ' + f +
                ' -- upstream changed, review the ppc64le patch');
            process.exit(1);
        }
        fs.writeFileSync(f, after);
        console.log('patched asm headers in ' + f);
    "
}


# Cross-compile a package from source: stream the output (npm hides install
# script output by default, hence --foreground-scripts) and keep a full log so a
# failure is actually diagnosable instead of being swallowed by `tail`.
cross_build_module() {
    local log_file="$1"
    shift

    local rc=0
    set +e
    npm_config_arch=ppc64 npm_config_target_arch=ppc64 \
        CC="${CROSS_PREFIX}gcc" CXX="${CROSS_PREFIX}g++" \
        npm install "$@" --build-from-source --foreground-scripts 2>&1 | tee "$log_file"
    rc=${PIPESTATUS[0]}
    set -e

    if [ "$rc" -ne 0 ]; then
        log_error "Cross build failed (exit ${rc}). Full log: ${log_file}"
        return 1
    fi
    return 0
}

# Copy a cross-built .node into the staging dir, asserting that it exists and is
# really ppc64le. Without this check a silently failed cross build lets the x64
# .node survive into the ppc64le package.
stage_native_module() {
    local src="$1"
    local dest="$2"

    if [ -z "$src" ] || [ ! -f "$src" ]; then
        log_error "Cross build produced no native module (looked for: ${3:-?})"
        return 1
    fi

    if ! readelf -h "$src" 2>/dev/null | grep -q "PowerPC64"; then
        log_error "Native module is NOT ppc64le: ${src}"
        file "$src" 2>/dev/null || true
        readelf -h "$src" 2>/dev/null | grep -E "Class|Machine" || true
        return 1
    fi

    cp "$src" "$dest"
    log_info "  staged $(basename "$dest") ($(readelf -h "$src" | grep Machine | xargs))"
}

# ============================================================================
# Step 0: prerequisites
# ============================================================================
install_prerequisites() {
    log_info "Checking prerequisites..."

    local SUDO="sudo"
    if [ "$(id -u)" -eq 0 ]; then
        SUDO=""
    fi

    for cmd in curl tar unzip; do
        if ! command -v "$cmd" &>/dev/null; then
            $SUDO apt-get update
            $SUDO apt-get install -y "$cmd"
        fi
    done

    if ! command -v "${CROSS_PREFIX}g++" &>/dev/null; then
        log_warn "${CROSS_PREFIX}g++ not found; install with:"
        log_warn "  sudo apt-get install -y gcc-powerpc64le-linux-gnu g++-powerpc64le-linux-gnu binutils-powerpc64le-linux-gnu"
    fi

    log_info "Prerequisites ready."
}

# ============================================================================
# Step 1: build the x64 app to get the arch-independent asar
# ============================================================================
build_x64() {
    log_info "Step 1: Building x64 app with electron v${ELECTRON_VERSION}..."

    cd "$PROJECT_ROOT"

    local original_electron_version
    original_electron_version=$(node -e "console.log(require('./package.json').devDependencies.electron)")

    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${ELECTRON_VERSION}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    log_info "Running npm run b..."
    npm run b
    npm run pb

    rm -rf dist
    local builder="./node_modules/.bin/electron-builder"
    write_install_src "linux-ppc64le.tar.gz"

    export WORKFLOW_NAME
    $builder --linux tar.gz --x64 --publish=never

    local tar_gz
    tar_gz=$(find dist -name "*.tar.gz" -type f | head -1)
    if [ -z "$tar_gz" ]; then
        log_error "Could not find built tar.gz in dist/"
        exit 1
    fi
    log_info "x64 build complete: $tar_gz"

    mkdir -p "$WORK_DIR/x64-extract"
    tar xzf "$tar_gz" -C "$WORK_DIR/x64-extract"

    local asar_file
    asar_file=$(find "$WORK_DIR/x64-extract" -name "app.asar" -type f | head -1)
    if [ -z "$asar_file" ]; then
        log_error "Could not find app.asar in extracted tar.gz"
        exit 1
    fi
    cp "$asar_file" "$WORK_DIR/app.asar"

    local app_dir
    app_dir=$(find "$WORK_DIR/x64-extract" -maxdepth 1 -name "electerm*" -type d | head -1)
    if [ -n "$app_dir" ]; then
        cp -r "$app_dir" "$WORK_DIR/x64-app"
    fi

    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${original_electron_version}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    rm -rf "$WORK_DIR/x64-extract"
}

# ============================================================================
# Step 2: download the ppc64le electron runtime
# ============================================================================
download_electron_ppc64le() {
    log_info "Step 2: Downloading electron v${ELECTRON_VERSION} for ppc64le..."
    log_info "  $ELECTRON_PPC64LE_URL"

    mkdir -p "$WORK_DIR/electron-ppc64le"
    local zip_file="$WORK_DIR/electron-ppc64le.zip"

    if [ ! -f "$zip_file" ]; then
        curl -fL -o "$zip_file" "$ELECTRON_PPC64LE_URL"
    fi

    unzip -q -o "$zip_file" -d "$WORK_DIR/electron-ppc64le"

    if [ ! -f "$WORK_DIR/electron-ppc64le/electron" ]; then
        log_error "Could not find electron binary in extracted zip"
        exit 1
    fi

    log_info "Electron ppc64le downloaded and extracted."
}

# ============================================================================
# Step 3: cross-compile the native modules for ppc64le
# ============================================================================
rebuild_native_modules() {
    if [ "$SKIP_NATIVE" = "1" ]; then
        log_warn "Step 3: Skipping native module build (SKIP_NATIVE=1)"
        return 0
    fi

    if ! command -v "${CROSS_PREFIX}g++" &>/dev/null; then
        log_error "Step 3: ${CROSS_PREFIX}g++ not found; refusing to continue, the"
        log_error "package would silently keep the x64 native modules. Install with:"
        log_error "  sudo apt-get install -y gcc-powerpc64le-linux-gnu g++-powerpc64le-linux-gnu binutils-powerpc64le-linux-gnu"
        return 1
    fi

    log_info "Step 3: Cross-compiling native modules for ppc64le..."

    local native_modules_dir="$WORK_DIR/native-modules-ppc64le"
    mkdir -p "$native_modules_dir"

    local cross_build_dir="$WORK_DIR/cross-build"
    rm -rf "$cross_build_dir"
    mkdir -p "$cross_build_dir"

    log_info "Building node-pty@${NODE_PTY_VERSION}..."
    mkdir -p "$cross_build_dir/build-node-pty" && cd "$cross_build_dir/build-node-pty"
    npm init -y >/dev/null 2>&1 || true
    cross_build_module "$cross_build_dir/node-pty.log" "node-pty@${NODE_PTY_VERSION}"
    stage_native_module \
        "$(find . -name 'pty.node' -type f | head -1)" \
        "$native_modules_dir/node-pty.node" \
        "pty.node"

    log_info "Building ${SERIALPORT_SPEC} (patched for ppc64le)..."
    cd "$cross_build_dir"
    mkdir -p build-serialport && cd build-serialport
    npm init -y >/dev/null 2>&1 || true

    # Install without running the install script first: it has no ppc64le
    # prebuild, and the source needs the header patch below before it compiles.
    local rc=0
    set +e
    npm install "$SERIALPORT_SPEC" --ignore-scripts --foreground-scripts \
        > "$cross_build_dir/serialport-install.log" 2>&1
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
        log_error "npm install failed (exit ${rc})"
        tail -n 30 "$cross_build_dir/serialport-install.log"
        return 1
    fi

    patch_serialport_source \
        "node_modules/@serialport/bindings-cpp/src/serialport_linux.cpp"

    # Now run the module's own install script (node-gyp-build). npm_config_arch
    # makes it look for a linux-ppc64 prebuild, find none, and fall back to
    # node-gyp; npm rebuild reuses the node-gyp bundled with npm.
    set +e
    npm_config_arch=ppc64 CC="${CROSS_PREFIX}gcc" CXX="${CROSS_PREFIX}g++" \
        npm rebuild @serialport/bindings-cpp --foreground-scripts 2>&1 \
        | tee "$cross_build_dir/serialport.log"
    rc=${PIPESTATUS[0]}
    set -e
    if [ "$rc" -ne 0 ]; then
        log_error "Cross build failed (exit ${rc}). Full log: $cross_build_dir/serialport.log"
        return 1
    fi

    stage_native_module \
        "$(find . -path '*/build/Release/bindings.node' -type f | head -1)" \
        "$native_modules_dir/serialport-bindings.node" \
        "*/build/Release/bindings.node"

    cd "$PROJECT_ROOT"

    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Native modules:"
        ls -la "$native_modules_dir/"
    else
        log_error "No native modules were built."
        return 1
    fi
}

# ============================================================================
# Step 4: merge x64 asar with ppc64le electron and native modules
# ============================================================================
merge_ppc64le() {
    log_info "Step 4: Merging x64 asar with ppc64le electron..."

    local electerm_version
    electerm_version=$(get_version)

    mkdir -p "$OUTPUT_DIR"
    local output_name="electerm-${electerm_version}-linux-${TARBALL_ARCH}"
    local output_dir="$OUTPUT_DIR/$output_name"
    rm -rf "$output_dir"
    mkdir -p "$output_dir"

    if [ -d "$WORK_DIR/x64-app" ]; then
        cp -r "$WORK_DIR/x64-app"/* "$output_dir/"
    fi

    rm -f "$output_dir/electerm"
    cp "$WORK_DIR/electron-ppc64le/electron" "$output_dir/electerm"
    chmod +x "$output_dir/electerm"

    # Copy the electron runtime files (locales + top-level files), keep resources
    for f in "$WORK_DIR/electron-ppc64le"/*; do
        local base
        base=$(basename "$f")
        if [ "$base" = "electron" ]; then
            continue
        fi
        if [ -d "$f" ] && [ "$base" != "locales" ]; then
            continue
        fi
        if [ -d "$f" ]; then
            cp -r "$f" "$output_dir/"
        else
            cp "$f" "$output_dir/"
        fi
    done

    # Replace native modules with the ppc64le versions
    local native_modules_dir="$WORK_DIR/native-modules-ppc64le"
    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Replacing native modules with ppc64le versions..."
        if [ -f "$native_modules_dir/node-pty.node" ]; then
            find "$output_dir" -path "*/node-pty/build/Release/*.node" -exec cp "$native_modules_dir/node-pty.node" {} \; 2>/dev/null || true
        fi
        if [ -f "$native_modules_dir/serialport-bindings.node" ]; then
            find "$output_dir" -path "*@serialport/bindings-cpp*" -name "*.node" -exec cp "$native_modules_dir/serialport-bindings.node" {} \; 2>/dev/null || true
        fi
    fi

    if [ -f "$WORK_DIR/app.asar" ] && [ ! -f "$output_dir/resources/app.asar" ]; then
        mkdir -p "$output_dir/resources"
        cp "$WORK_DIR/app.asar" "$output_dir/resources/"
    fi

    log_info "Creating ppc64le tar.gz..."
    cd "$OUTPUT_DIR"
    tar czf "${output_name}.tar.gz" "$output_name"
    log_info "Tar.gz complete: $OUTPUT_DIR/${output_name}.tar.gz"
}

# ============================================================================
# Step 5: build the deb package
# ============================================================================
patch_asar_install_src() {
    local asar_file="$1"
    local new_src="$2"

    log_info "Patching asar install-src to '${new_src}'..."

    local asar_bin="$PROJECT_ROOT/node_modules/@electron/asar/bin/asar.js"
    local tmp_dir
    tmp_dir=$(mktemp -d)

    node "$asar_bin" extract "$asar_file" "$tmp_dir"
    echo "module.exports = '${new_src}'" > "$tmp_dir/lib/install-src.js"
    node "$asar_bin" pack "$tmp_dir" "$asar_file"

    rm -rf "$tmp_dir"
    log_info "Asar patched successfully."
}

build_deb() {
    local install_src="$1"
    local electerm_version
    electerm_version=$(get_version)

    local output_name="electerm-${electerm_version}-linux-${TARBALL_ARCH}"
    local output_dir="$OUTPUT_DIR/$output_name"
    local deb_build="$OUTPUT_DIR/deb-build"
    local deb_name="electerm_${electerm_version}_${DEB_ARCH}"
    local deb_dir="$deb_build/$deb_name"

    if [ ! -d "$output_dir" ]; then
        log_error "Output directory not found: $output_dir"
        return 1
    fi

    local asar_file="$output_dir/resources/app.asar"
    if [ -f "$asar_file" ]; then
        patch_asar_install_src "$asar_file" "$install_src"
    else
        log_warn "app.asar not found at $asar_file, skipping install-src patch"
    fi

    rm -rf "$deb_build"
    mkdir -p "$deb_dir/DEBIAN"
    mkdir -p "$deb_dir/opt/electerm"
    mkdir -p "$deb_dir/usr/share/applications"
    mkdir -p "$deb_dir/usr/share/icons/hicolor/128x128/apps"

    cp -r "$output_dir"/* "$deb_dir/opt/electerm/"

    local icon_src="$PROJECT_ROOT/node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png"
    if [ -f "$icon_src" ]; then
        cp "$icon_src" "$deb_dir/usr/share/icons/hicolor/128x128/apps/electerm.png"
    fi

    cat > "$deb_dir/usr/share/applications/electerm.desktop" <<'DESKTOP'
[Desktop Entry]
Name=electerm
Comment=Terminal/SSH/SFTP client
Exec=/opt/electerm/electerm %U
Icon=electerm
Terminal=false
Type=Application
Categories=Development;System;TerminalEmulator;
StartupWMClass=electerm
MimeType=x-scheme-handler/ssh;x-scheme-handler/telnet;x-scheme-handler/rdp;x-scheme-handler/vnc;x-scheme-handler/serial;x-scheme-handler/spice;x-scheme-handler/electerm;
DESKTOP

    cat > "$deb_dir/DEBIAN/control" <<CTRL
Package: electerm
Version: ${electerm_version}
Section: utils
Priority: optional
Architecture: ${DEB_ARCH}
Depends: libglib2.0-0, libnss3, libnspr4, libdbus-1-3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libcairo2, libpango-1.0-0, libx11-6, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxrandr2, libxkbcommon0, libdrm2, libgbm1, libatspi2.0-0, libpulse0, libgtk-3-0
Maintainer: ZHAO Xudong <zxdong@gmail.com>
Description: Open-sourced terminal/ssh/sftp/telnet/serialport/RDP/VNC/Spice/ftp client
CTRL

    cat > "$deb_dir/DEBIAN/postinst" <<'POSTINST'
#!/bin/bash
chown root:root /opt/electerm/chrome-sandbox
chmod 4755 /opt/electerm/chrome-sandbox
update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true
POSTINST
    chmod 755 "$deb_dir/DEBIAN/postinst"

    local deb_file="$OUTPUT_DIR/electerm-${electerm_version}-linux-${DEB_ARCH}.deb"
    if command -v fakeroot &>/dev/null; then
        fakeroot dpkg-deb --build "$deb_dir" "$deb_file"
    else
        dpkg-deb --build "$deb_dir" "$deb_file"
    fi

    if [ ! -f "$deb_file" ]; then
        log_error "Deb build failed: $deb_file not created"
        return 1
    fi

    log_info "Deb complete: $deb_file"

    rm -rf "$deb_build"
}

# ============================================================================
# Step 6: upload to the GitHub release draft
# ============================================================================
upload_to_github() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    if [ ! -f "$file" ]; then
        log_warn "Upload skipped: file not found: $file"
        return 0
    fi

    if [ -z "${GH_TOKEN:-}" ]; then
        log_warn "Upload skipped: GH_TOKEN not set"
        return 0
    fi

    local electerm_version
    electerm_version=$(get_version)
    local release_name="v${electerm_version}"

    log_info "Uploading $filename to GitHub release draft '${release_name}'..."

    if ! gh release view "$release_name" >/dev/null 2>&1; then
        gh release create "$release_name" \
            --draft \
            --title "$release_name" \
            --generate-notes \
            "$file"
    else
        gh release upload "$release_name" "$file" --clobber
    fi

    log_info "Uploaded $filename."
}

# ============================================================================
# Step 7: upload artifacts to R2 (shared helper, same as the other builds)
# ============================================================================
upload_artifacts_to_r2() {
    local tar_file="$1"
    local deb_file="$2"

    # uploadToR2() from build-common.js only looks for files inside <root>/dist,
    # so stage the ppc64le artifacts there first. The helper self-skips unless
    # we are in CI, the commit message contains "[r2]" and CF_R2_* are set.
    mkdir -p "$PROJECT_ROOT/dist"
    cp "$tar_file" "$PROJECT_ROOT/dist/"
    cp "$deb_file" "$PROJECT_ROOT/dist/"

    log_info "Step 7: Uploading artifacts to R2 (skipped unless [r2] + CF_R2_*)..."

    node -e "
        const { uploadToR2 } = require('$PROJECT_ROOT/build/bin/build-common')
        ;(async () => {
            await uploadToR2('linux-${TARBALL_ARCH}.tar.gz')
            await uploadToR2('${DEB_ARCH}.deb')
        })().catch(err => {
            console.error(err)
            process.exit(1)
        })
    "

    # dist/ is discarded anyway, but keep it tidy
    rm -f "$PROJECT_ROOT/dist/$(basename "$tar_file")" \
          "$PROJECT_ROOT/dist/$(basename "$deb_file")"
}

# ============================================================================
# Main
# ============================================================================
main() {
    log_info "Starting electerm ppc64le build..."
    log_info "  ELECTRON_VERSION : ${ELECTRON_VERSION}"
    log_info "  Project root     : ${PROJECT_ROOT}"
    log_info "  Work dir         : ${WORK_DIR}"
    log_info "  Output dir       : ${OUTPUT_DIR}"

    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"

    install_prerequisites
    build_x64
    download_electron_ppc64le
    rebuild_native_modules
    merge_ppc64le
    build_deb "linux-${TARBALL_ARCH}.tar.gz"

    local electerm_version
    electerm_version=$(get_version)
    local tar_file="$OUTPUT_DIR/electerm-${electerm_version}-linux-${TARBALL_ARCH}.tar.gz"
    local deb_file="$OUTPUT_DIR/electerm-${electerm_version}-linux-${DEB_ARCH}.deb"

    upload_to_github "$tar_file"
    upload_to_github "$deb_file"
    upload_artifacts_to_r2 "$tar_file" "$deb_file"

    log_info "=========================================="
    log_info "Build complete!"
    log_info "  $tar_file"
    log_info "  $deb_file"
    log_info "=========================================="
}

main "$@"
