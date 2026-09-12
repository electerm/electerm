#!/bin/bash
# Build electerm for riscv64 Linux
#
# Strategy:
# 1. Build x64 version with electron v42.8.1 to get the asar (arch independent)
# 2. Download electron riscv64 v42.8.1 from riscv-forks/electron-riscv-releases
# 3. Cross-compile native modules for riscv64
# 4. Merge x64 asar with riscv64 electron and native modules
# 5. Upload tar.gz to GitHub release draft
# 6. Build deb package and upload to GitHub release draft
#
# Prerequisites:
# - riscv64-linux-gnu-g++ (for native module cross-compilation)
# - curl, tar, unzip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="$PROJECT_ROOT/work-riscv64"
ARCH="riscv64"
DEB_ARCH="riscv64"
CROSS_PREFIX="riscv64-linux-gnu"
ELECTRON_VERSION="42.8.1"
ELECTRON_RISCV64_URL="https://github.com/riscv-forks/electron-riscv-releases/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-${ARCH}.zip"
OUTPUT_DIR="$PROJECT_ROOT/dist-riscv64"
SKIP_NATIVE="${SKIP_NATIVE:-0}"  # Set to 1 to skip native module rebuild
WORKFLOW_NAME="${WORKFLOW_NAME:-linux-riscv64}"  # For electron-builder publish channel

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

# Read installed version of a native module from node_modules
installed_version() {
    local pkg="$1"
    node -e "console.log(require('$PROJECT_ROOT/node_modules/$pkg/package.json').version)" 2>/dev/null || echo ""
}

write_install_src() {
    local src="$1"
    node -e "
        const { writeFileSync } = require('fs');
        writeFileSync('$PROJECT_ROOT/work/app/lib/install-src.js', \"module.exports = '${src}'\");
    "
}

# Assert file exists and is a riscv64 ELF
assert_riscv_elf() {
    local f="$1"
    if [ ! -f "$f" ]; then
        log_error "Missing expected file: $f"
        return 1
    fi
    if ! readelf -h "$f" 2>/dev/null | grep -qi "risc-v"; then
        log_error "Not a riscv64 ELF: $f"
        readelf -h "$f" 2>/dev/null | head -5 || true
        return 1
    fi
    return 0
}

# ============================================================================
# Step 0: Install prerequisites
# ============================================================================
install_prerequisites() {
    log_info "Checking prerequisites..."

    local SUDO="sudo"
    if [ "$(id -u)" -eq 0 ]; then
        SUDO=""
    fi

    for cmd in curl tar unzip readelf; do
        if ! command -v "$cmd" &>/dev/null; then
            $SUDO apt-get install -y "$cmd" || true
        fi
    done

    log_info "Prerequisites ready."
}

check_electron_version() {
    local installed
    installed=$(installed_version "electron")
    log_info "Installed electron: ${installed}, riscv64 electron: ${ELECTRON_VERSION}"
    if [ "$installed" != "$ELECTRON_VERSION" ]; then
        log_error "Installed electron (${installed}) != riscv64 electron (${ELECTRON_VERSION})."
        log_error "The asar must be built with the same electron version as the riscv64 runtime."
        exit 1
    fi
}

# ============================================================================
# Step 1: Build x64 version to get the asar
# ============================================================================
build_x64() {
    log_info "Step 1: Building x64 version with electron v${ELECTRON_VERSION}..."

    cd "$PROJECT_ROOT"

    check_electron_version

    log_info "Running npm run b..."
    npm run b
    npm run pb

    # Build x64 tar.gz
    rm -rf dist
    local builder="./node_modules/.bin/electron-builder"
    write_install_src "linux-${ARCH}.tar.gz"

    export WORKFLOW_NAME
    $builder --linux tar.gz --x64 --publish=never

    # Find the built tar.gz
    local tar_gz
    tar_gz=$(find dist -name "*.tar.gz" -type f | head -1)
    if [ -z "$tar_gz" ]; then
        log_error "Could not find built tar.gz in dist/"
        exit 1
    fi
    log_info "x64 build complete: $tar_gz"

    # Extract asar and full app directory from tar.gz
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
    else
        log_error "Could not find electerm app dir in extracted tar.gz"
        exit 1
    fi

    rm -rf "$WORK_DIR/x64-extract"
}

# ============================================================================
# Step 2: Download electron riscv64
# ============================================================================
download_electron_riscv64() {
    log_info "Step 2: Downloading electron v${ELECTRON_VERSION} for ${ARCH}..."

    mkdir -p "$WORK_DIR/electron-${ARCH}"
    local zip_file="$WORK_DIR/electron-${ARCH}.zip"

    if [ ! -f "$zip_file" ]; then
        curl -fL -o "$zip_file" "$ELECTRON_RISCV64_URL"
    fi

    unzip -q -o "$zip_file" -d "$WORK_DIR/electron-${ARCH}"

    if [ ! -f "$WORK_DIR/electron-${ARCH}/electron" ]; then
        log_error "Could not find electron binary in extracted zip"
        exit 1
    fi

    assert_riscv_elf "$WORK_DIR/electron-${ARCH}/electron"
    log_info "Electron ${ARCH} downloaded and extracted."
}

# ============================================================================
# Step 3: Rebuild native modules for riscv64 using cross-compilation
# ============================================================================
build_node_pty() {
    local out_dir="$1"
    local version
    version=$(installed_version "node-pty")

    log_info "Building node-pty ${version} for ${ARCH}..."

    local build_dir="$WORK_DIR/cross-build/node-pty"
    rm -rf "$build_dir"
    mkdir -p "$build_dir"
    cd "$build_dir"
    npm init -y 2>/dev/null

    npm_config_arch=${ARCH} npm_config_target_arch=${ARCH} \
        CC=${CROSS_PREFIX}-gcc CXX=${CROSS_PREFIX}-g++ \
        npm install "node-pty@${version}" --build-from-source 2>&1 | tee "$build_dir/build.log"

    local pty_node spawn_helper
    pty_node=$(find . -path "*/build/Release/pty.node" -type f -print -quit)
    spawn_helper=$(find . -path "*/build/Release/spawn-helper" -type f -print -quit)

    if [ -z "$pty_node" ]; then
        log_warn "node-pty build produced no pty.node, see $build_dir/build.log"
        return 1
    fi
    if [ -z "$spawn_helper" ]; then
        log_warn "node-pty build produced no spawn-helper, see $build_dir/build.log"
        return 1
    fi

    assert_riscv_elf "$pty_node" || return 1
    assert_riscv_elf "$spawn_helper" || return 1

    cp "$pty_node" "$out_dir/node-pty.node"
    cp "$spawn_helper" "$out_dir/spawn-helper"
    chmod +x "$out_dir/spawn-helper"
    return 0
}

build_serialport() {
    local out_dir="$1"
    local version
    version=$(installed_version "@serialport/bindings-cpp")

    if [ -z "$version" ]; then
        log_warn "@serialport/bindings-cpp not installed, skip"
        return 1
    fi

    log_info "Building @serialport/bindings-cpp ${version} for ${ARCH}..."

    local build_dir="$WORK_DIR/cross-build/serialport"
    rm -rf "$build_dir"
    mkdir -p "$build_dir"
    cd "$build_dir"
    npm init -y 2>/dev/null

    npm_config_arch=${ARCH} npm_config_target_arch=${ARCH} \
        CC=${CROSS_PREFIX}-gcc CXX=${CROSS_PREFIX}-g++ \
        npm install "@serialport/bindings-cpp@${version}" --build-from-source 2>&1 | tee "$build_dir/build.log"

    local bindings
    bindings=$(find . -path "*/build/Release/bindings.node" -type f -print -quit)
    if [ -z "$bindings" ]; then
        log_warn "@serialport/bindings-cpp build produced no bindings.node, see $build_dir/build.log"
        return 1
    fi

    assert_riscv_elf "$bindings" || return 1
    cp "$bindings" "$out_dir/serialport-bindings.node"
    return 0
}

rebuild_native_modules() {
    if [ "$SKIP_NATIVE" = "1" ]; then
        log_warn "Step 3: Skipping native module rebuild (SKIP_NATIVE=1)"
        return 0
    fi

    if ! command -v "${CROSS_PREFIX}-g++" &>/dev/null; then
        log_warn "Step 3: ${CROSS_PREFIX}-g++ not found, skipping native module rebuild"
        log_warn "Install with: sudo apt-get install g++-${CROSS_PREFIX}"
        return 0
    fi

    log_info "Step 3: Cross-compiling native modules for ${ARCH}..."

    local native_modules_dir="$WORK_DIR/native-modules-${ARCH}"
    rm -rf "$native_modules_dir"
    mkdir -p "$native_modules_dir"
    mkdir -p "$WORK_DIR/cross-build"

    local pty_ok=0
    build_node_pty "$native_modules_dir" || pty_ok=$?

    # serialport is optional: if it fails to cross-compile, drop the x64 binary
    # instead of shipping a broken one (app side tolerates missing serialport)
    local serialport_ok=0
    build_serialport "$native_modules_dir" || serialport_ok=$?

    unset CC CXX AR RANLIB LINK GYP_DEFINES npm_config_arch npm_config_target_arch

    if [ "$pty_ok" -ne 0 ]; then
        log_error "node-pty is required, cross-compilation failed for ${ARCH}"
        return 1
    fi
    if [ "$serialport_ok" -ne 0 ]; then
        SERIALPORT_OK=0
    else
        SERIALPORT_OK=1
    fi

    log_info "Native modules built:"
    ls -la "$native_modules_dir/"
    return 0
}

# ============================================================================
# Step 4: Merge x64 asar with riscv64 electron and native modules
# ============================================================================
merge_riscv64() {
    log_info "Step 4: Merging x64 asar with ${ARCH} electron..."

    local electerm_version
    electerm_version=$(get_version)

    mkdir -p "$OUTPUT_DIR"
    local output_name="electerm-${electerm_version}-linux-${ARCH}"
    local output_dir="$OUTPUT_DIR/$output_name"
    rm -rf "$output_dir"
    mkdir -p "$output_dir"

    # Start with x64 app directory
    cp -r "$WORK_DIR/x64-app"/* "$output_dir/"

    # Replace x64 binary with riscv64 electron
    rm -f "$output_dir/electerm"
    cp "$WORK_DIR/electron-${ARCH}/electron" "$output_dir/electerm"
    chmod +x "$output_dir/electerm"

    # Copy riscv64 electron runtime files (libraries, locales, etc.)
    for f in "$WORK_DIR/electron-${ARCH}"/*; do
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

    # Replace native modules with riscv64 versions
    local native_modules_dir="$WORK_DIR/native-modules-${ARCH}"
    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Replacing native modules with ${ARCH} versions..."
        if [ -f "$native_modules_dir/node-pty.node" ]; then
            find "$output_dir" -path "*/node-pty/build/Release/pty.node" \
                -exec cp "$native_modules_dir/node-pty.node" {} \; 2>/dev/null || true
            # spawn-helper is an executable used by every pty.fork(), must match arch
            find "$output_dir" -path "*/node-pty/build/Release/spawn-helper" \
                -exec cp "$native_modules_dir/spawn-helper" {} \; 2>/dev/null || true
        fi
        if [ -f "$native_modules_dir/serialport-bindings.node" ]; then
            find "$output_dir" -path "*@serialport/bindings-cpp*" -name "*.node" \
                -not -path "*/prebuilds/*" \
                -exec cp "$native_modules_dir/serialport-bindings.node" {} \; 2>/dev/null || true
        fi
    fi

    if [ "${SERIALPORT_OK:-0}" != "1" ]; then
        log_warn "serialport not available for ${ARCH}, removing x64 serialport binaries from package..."
        find "$output_dir" \( -path "*@serialport*" -o -path "*serialport*" \) -name "*.node" \
            -not -path "*/prebuilds/*" -print -delete 2>/dev/null || true
    fi

    # Ensure asar is in place
    if [ -f "$WORK_DIR/app.asar" ] && [ ! -f "$output_dir/resources/app.asar" ]; then
        mkdir -p "$output_dir/resources"
        cp "$WORK_DIR/app.asar" "$output_dir/resources/"
    fi

    # Remove x64 leftovers that would fail at runtime
    log_info "Checking for non-${ARCH} ELF files in package..."
    local bad=0
    while IFS= read -r f; do
        if ! assert_riscv_elf "$f"; then
            bad=1
        fi
    done < <(find "$output_dir" -type f \
        \( -name "*.node" -o -name "*.so" -o -perm -u+x \) \
        -not -path "*/prebuilds/*" -not -path "*/locales/*" 2>/dev/null || true)
    if [ "$bad" -ne 0 ]; then
        log_warn "Some binaries in the package are not ${ARCH} (see above)"
    fi

    # Create tar.gz
    log_info "Creating ${ARCH} tar.gz..."
    cd "$OUTPUT_DIR"
    tar czf "${output_name}.tar.gz" "$output_name"

    log_info "Tar.gz complete: $OUTPUT_DIR/${output_name}.tar.gz"
}

# ============================================================================
# Step 5: Build deb package
# ============================================================================
patch_asar_install_src() {
    local asar_file="$1"
    local new_src="$2"

    log_info "Patching asar install-src to '${new_src}'..."

    local asar_bin="$PROJECT_ROOT/node_modules/@electron/asar/bin/asar.js"
    local tmp_dir
    tmp_dir=$(mktemp -d)

    # Extract, patch, repack using CLI
    node "$asar_bin" extract "$asar_file" "$tmp_dir"
    echo "module.exports = '${new_src}'" > "$tmp_dir/lib/install-src.js"
    node "$asar_bin" pack "$tmp_dir" "$asar_file"

    rm -rf "$tmp_dir"
    log_info "Asar patched successfully."
}

build_deb() {
    local install_src="${1:-linux-riscv64.deb}"
    local deb_arch="${2:-riscv64}"
    local suffix="$deb_arch"
    log_info "Step 5: Building ${suffix} deb package..."

    local electerm_version
    electerm_version=$(get_version)

    local output_dir="$OUTPUT_DIR/electerm-${electerm_version}-linux-${ARCH}"
    local deb_build="$OUTPUT_DIR/deb-build-${suffix}"
    local deb_name="electerm_${electerm_version}_${deb_arch}"
    local deb_dir="$deb_build/$deb_name"

    if [ ! -d "$output_dir" ]; then
        log_error "Output directory not found: $output_dir"
        return 1
    fi

    # Patch asar to use deb install-src
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

    # Install icon
    local icon_src="$PROJECT_ROOT/node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png"
    if [ -f "$icon_src" ]; then
        cp "$icon_src" "$deb_dir/usr/share/icons/hicolor/128x128/apps/electerm.png"
    fi

    # Install desktop file
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
Architecture: ${deb_arch}
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

    local deb_file="$OUTPUT_DIR/electerm-${electerm_version}-linux-${suffix}.deb"
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
# Step 6: Upload to GitHub release draft
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
# Main
# ============================================================================
main() {
    log_info "Starting electerm ${ARCH} build..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Work directory: $WORK_DIR"
    log_info "Output directory: $OUTPUT_DIR"

    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"

    install_prerequisites
    build_x64
    download_electron_riscv64
    rebuild_native_modules
    merge_riscv64

    local electerm_version
    electerm_version=$(get_version)

    # Upload tar.gz
    upload_to_github "$OUTPUT_DIR/electerm-${electerm_version}-linux-${ARCH}.tar.gz"

    # Build and upload deb
    build_deb "linux-${ARCH}.deb" "$DEB_ARCH"
    upload_to_github "$OUTPUT_DIR/electerm-${electerm_version}-linux-${ARCH}.deb"

    log_info "=========================================="
    log_info "Build complete!"
    log_info "  $OUTPUT_DIR/electerm-${electerm_version}-linux-${ARCH}.tar.gz"
    log_info "  $OUTPUT_DIR/electerm-${electerm_version}-linux-${ARCH}.deb"
    log_info "=========================================="
}

# Allow sourcing for unit tests
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
