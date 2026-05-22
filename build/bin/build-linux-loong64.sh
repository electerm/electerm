#!/bin/bash
# Build electerm for loong64 (LoongArch64) Linux
#
# Strategy:
# 1. Build x64 version with electron v39.2.7 to get the asar
# 2. Download electron loong64 v39.2.7 from darkyzhou/electron-loong64
# 3. Cross-compile native modules for loong64
# 4. Merge x64 asar with loong64 electron and native modules
# 5. Upload tar.gz to GitHub release draft
# 6. Build deb packages (loong64 and loongarch64, patched asar) and upload to GitHub release draft
#
# Prerequisites:
# - loongarch64-linux-gnu-g++ (for native module cross-compilation)
# - curl, tar, unzip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="$PROJECT_ROOT/work-loong64"
ELECTRON_VERSION="39.2.7"
ELECTRON_LOONG64_URL="https://github.com/darkyzhou/electron-loong64/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-loong64.zip"
OUTPUT_DIR="$PROJECT_ROOT/dist-loong64"
SKIP_NATIVE="${SKIP_NATIVE:-0}"  # Set to 1 to skip native module rebuild
WORKFLOW_NAME="${WORKFLOW_NAME:-linux-loong64}"  # For electron-builder publish channel

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

# ============================================================================
# Step 0: Install prerequisites
# ============================================================================
install_prerequisites() {
    log_info "Checking prerequisites..."

    local SUDO="sudo"
    if [ "$(id -u)" -eq 0 ]; then
        SUDO=""
    fi

    for cmd in curl tar unzip; do
        if ! command -v "$cmd" &>/dev/null; then
            $SUDO apt-get install -y "$cmd"
        fi
    done

    log_info "Prerequisites ready."
}

# ============================================================================
# Step 1: Build x64 version with electron v39.2.7
# ============================================================================
build_x64() {
    log_info "Step 1: Building x64 version with electron v${ELECTRON_VERSION}..."

    cd "$PROJECT_ROOT"

    # Save original electron version
    local original_electron_version
    original_electron_version=$(node -e "console.log(require('./package.json').devDependencies.electron)")

    # Temporarily set electron version
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${ELECTRON_VERSION}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    log_info "Running npm run b..."
    npm run b
    npm run pb

    # Build x64 tar.gz
    rm -rf dist
    local builder="./node_modules/.bin/electron-builder"
    write_install_src "linux-loong64.tar.gz"

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
    fi

    # Restore original electron version
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${original_electron_version}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    rm -rf "$WORK_DIR/x64-extract"
}

# ============================================================================
# Step 2: Download electron loong64
# ============================================================================
download_electron_loong64() {
    log_info "Step 2: Downloading electron v${ELECTRON_VERSION} for loong64..."

    mkdir -p "$WORK_DIR/electron-loong64"
    local zip_file="$WORK_DIR/electron-loong64.zip"

    if [ ! -f "$zip_file" ]; then
        curl -L -o "$zip_file" "$ELECTRON_LOONG64_URL"
    fi

    unzip -q -o "$zip_file" -d "$WORK_DIR/electron-loong64"

    if [ ! -f "$WORK_DIR/electron-loong64/electron" ]; then
        log_error "Could not find electron binary in extracted zip"
        exit 1
    fi

    log_info "Electron loong64 downloaded and extracted."
}

# ============================================================================
# Step 3: Rebuild native modules for loong64 using cross-compilation
# ============================================================================
rebuild_native_modules() {
    if [ "$SKIP_NATIVE" = "1" ]; then
        log_warn "Step 3: Skipping native module rebuild (SKIP_NATIVE=1)"
        return 0
    fi

    if ! command -v loongarch64-linux-gnu-g++ &>/dev/null; then
        log_warn "Step 3: loongarch64-linux-gnu-g++ not found, skipping native module rebuild"
        log_warn "Install with: sudo apt-get install g++-loongarch64-linux-gnu"
        return 0
    fi

    log_info "Step 3: Cross-compiling native modules for loong64..."

    local native_modules_dir="$WORK_DIR/native-modules-loong64"
    mkdir -p "$native_modules_dir"

    local cross_build_dir="$WORK_DIR/cross-build"
    rm -rf "$cross_build_dir"
    mkdir -p "$cross_build_dir"
    cd "$cross_build_dir"

    # Build node-pty
    log_info "Building node-pty for loong64..."
    mkdir -p build-node-pty && cd build-node-pty
    npm init -y 2>/dev/null
    npm_config_arch=loong64 npm_config_target_arch=loong64 CC=loongarch64-linux-gnu-gcc CXX=loongarch64-linux-gnu-g++ npm install node-pty@1.1.0-beta34 --build-from-source 2>&1 | tail -5
    find . -name "pty.node" -type f | while read f; do
        cp "$f" "$native_modules_dir/node-pty.node"
    done
    cd "$cross_build_dir"

    # Build @serialport/bindings-cpp
    log_info "Building @serialport/bindings-cpp for loong64..."
    mkdir -p build-serialport && cd build-serialport
    npm init -y 2>/dev/null
    npm_config_arch=loong64 npm_config_target_arch=loong64 CC=loongarch64-linux-gnu-gcc CXX=loongarch64-linux-gnu-g++ npm install @serialport/bindings-cpp --build-from-source 2>&1 | tail -5
    find . -path "*/build/Release/bindings.node" -type f | while read f; do
        cp "$f" "$native_modules_dir/serialport-bindings.node"
    done
    cd "$cross_build_dir"

    unset CC CXX AR RANLIB LINK GYP_DEFINES npm_config_arch npm_config_target_arch

    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Native modules built successfully:"
        ls -la "$native_modules_dir/"
    else
        log_warn "No native modules were built."
    fi
}

# ============================================================================
# Step 4: Merge x64 asar with loong64 electron and native modules
# ============================================================================
merge_loong64() {
    log_info "Step 4: Merging x64 asar with loong64 electron..."

    local electerm_version
    electerm_version=$(get_version)

    mkdir -p "$OUTPUT_DIR"
    local output_name="electerm-${electerm_version}-linux-loong64"
    local output_dir="$OUTPUT_DIR/$output_name"
    rm -rf "$output_dir"
    mkdir -p "$output_dir"

    # Start with x64 app directory
    if [ -d "$WORK_DIR/x64-app" ]; then
        cp -r "$WORK_DIR/x64-app"/* "$output_dir/"
    fi

    # Replace x64 binary with loong64 electron
    rm -f "$output_dir/electerm"
    cp "$WORK_DIR/electron-loong64/electron" "$output_dir/electerm"
    chmod +x "$output_dir/electerm"

    # Copy loong64 electron runtime files (libraries, locales, etc.)
    for f in "$WORK_DIR/electron-loong64"/*; do
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

    # Replace native modules with loong64 versions
    local native_modules_dir="$WORK_DIR/native-modules-loong64"
    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Replacing native modules with loong64 versions..."
        if [ -f "$native_modules_dir/node-pty.node" ]; then
            find "$output_dir" -path "*/node-pty/build/Release/*.node" -exec cp "$native_modules_dir/node-pty.node" {} \; 2>/dev/null || true
        fi
        if [ -f "$native_modules_dir/serialport-bindings.node" ]; then
            find "$output_dir" -path "*@serialport/bindings-cpp*" -name "*.node" -exec cp "$native_modules_dir/serialport-bindings.node" {} \; 2>/dev/null || true
        fi
        if [ -f "$native_modules_dir/ssh2-crypto.node" ]; then
            find "$output_dir" -path "*@electerm/ssh2*" -name "*.node" -exec cp "$native_modules_dir/ssh2-crypto.node" {} \; 2>/dev/null || true
        fi
    fi

    # Ensure asar is in place
    if [ -f "$WORK_DIR/app.asar" ] && [ ! -f "$output_dir/resources/app.asar" ]; then
        mkdir -p "$output_dir/resources"
        cp "$WORK_DIR/app.asar" "$output_dir/resources/"
    fi

    # Create tar.gz
    log_info "Creating loong64 tar.gz..."
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
    local install_src="${1:-linux-loong64.deb}"
    local deb_arch="${2:-loong64}"
    local suffix="$deb_arch"
    log_info "Step 5: Building ${suffix} deb package..."

    local electerm_version
    electerm_version=$(get_version)

    local output_dir="$OUTPUT_DIR/electerm-${electerm_version}-linux-loong64"
    local deb_build="$OUTPUT_DIR/deb-build-${suffix}"
    local deb_name="electerm_${electerm_version}_loongarch64"
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
    log_info "Starting electerm loong64 build..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Work directory: $WORK_DIR"
    log_info "Output directory: $OUTPUT_DIR"

    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"

    install_prerequisites
    build_x64
    download_electron_loong64
    rebuild_native_modules
    merge_loong64

    local electerm_version
    electerm_version=$(get_version)

    # Upload tar.gz
    upload_to_github "$OUTPUT_DIR/electerm-${electerm_version}-linux-loong64.tar.gz"

    # Build and upload debs
    build_deb "linux-loong64.deb" "loong64"
    upload_to_github "$OUTPUT_DIR/electerm-${electerm_version}-linux-loong64.deb"

    build_deb "linux-loongarch64.deb" "loongarch64"
    upload_to_github "$OUTPUT_DIR/electerm-${electerm_version}-linux-loongarch64.deb"

    log_info "=========================================="
    log_info "Build complete!"
    log_info "  $OUTPUT_DIR/electerm-${electerm_version}-linux-loong64.tar.gz"
    log_info "  $OUTPUT_DIR/electerm-${electerm_version}-linux-loong64.deb"
    log_info "  $OUTPUT_DIR/electerm-${electerm_version}-linux-loongarch64.deb"
    log_info "=========================================="
}

main "$@"
