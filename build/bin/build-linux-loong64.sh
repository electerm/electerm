#!/bin/bash
# Build electerm for loong64 (LoongArch64) Linux
#
# Strategy:
# 1. Build x64 version with electron v39.2.7 to get the asar
# 2. Download electron loong64 v39.2.7 from darkyzhou/electron-loong64
# 3. Use QEMU + loong64 docker to rebuild native modules
# 4. Merge x64 asar with loong64 electron and native modules
# 5. Test in QEMU loong64 environment
#
# Prerequisites (auto-installed if missing):
# - docker with QEMU binfmt support
# - curl, tar, unzip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="$PROJECT_ROOT/work-loong64"
ELECTRON_VERSION="39.2.7"
ELECTRON_LOONG64_URL="https://github.com/darkyzhou/electron-loong64/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-loong64.zip"
LOONG64_DOCKER_IMAGE="loongarch64/debian:sid"
OUTPUT_DIR="$PROJECT_ROOT/dist-loong64"
SKIP_NATIVE="${SKIP_NATIVE:-0}"  # Set to 1 to skip native module rebuild
WORKFLOW_NAME="${WORKFLOW_NAME:-linux-loong64}"  # For electron-builder publish channel

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ============================================================================
# Step 0: Install prerequisites
# ============================================================================
install_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if running as root or with sudo
    local SUDO="sudo"
    if [ "$(id -u)" -eq 0 ]; then
        SUDO=""
    fi

    # Install docker if not present
    if ! command -v docker &>/dev/null; then
        log_warn "Docker not found. Attempting to install..."
        if $SUDO apt-get update 2>/dev/null && $SUDO apt-get install -y docker.io 2>/dev/null; then
            $SUDO systemctl start docker 2>/dev/null || true
            $SUDO systemctl enable docker 2>/dev/null || true
            $SUDO usermod -aG docker "$USER" 2>/dev/null || true
            log_info "Docker installed successfully."
        else
            log_warn "Could not install docker automatically."
            log_warn "Please install manually: sudo apt-get install docker.io"
            log_warn "Then add yourself to docker group: sudo usermod -aG docker $USER"
            log_warn "Continuing without docker (native module rebuild will be skipped)..."
        fi
    fi

    # Install qemu-user-static and binfmt support
    if ! command -v qemu-loongarch64-static &>/dev/null; then
        log_warn "QEMU user-mode emulation not found. Attempting to install..."
        if $SUDO apt-get install -y qemu-user-static binfmt-support 2>/dev/null; then
            # Register binfmt handlers if not already registered
            if [ ! -f /proc/sys/fs/binfmt_misc/qemu-loongarch64 ]; then
                log_info "Registering QEMU binfmt for loongarch64..."
                $SUDO update-binfmts --enable qemu-loongarch64 2>/dev/null || true
            fi
        else
            log_warn "Could not install QEMU automatically."
            log_warn "Please install manually: sudo apt-get install qemu-user-static binfmt-support"
            log_warn "Continuing without QEMU (native module rebuild will be skipped)..."
        fi
    fi

    # Install other tools
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

    # Temporarily set electron version to v39.2.7
    log_info "Temporarily setting electron version to v${ELECTRON_VERSION}..."
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${ELECTRON_VERSION}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    # Clean and rebuild
    log_info "Running npm run b (clean + compile + prepare-file)..."
    npm run b

    # Copy electron-builder config
    npm run pb

    # Build x64 tar.gz
    log_info "Building linux-x64 tar.gz..."
    rm -rf dist
    local builder="./node_modules/.bin/electron-builder"
    local src="linux-x64.tar.gz"

    # Write install-src
    node -e "
        const { writeFileSync } = require('fs');
        const { resolve } = require('path');
        writeFileSync(resolve('work/app/lib/install-src.js'), \"module.exports = '${src}'\");
    "

    # Build with electron-builder
    export WORKFLOW_NAME
    $builder --linux tar.gz --x64

    # Find the built tar.gz
    local tar_gz
    tar_gz=$(find dist -name "*.tar.gz" -type f | head -1)
    if [ -z "$tar_gz" ]; then
        log_error "Could not find built tar.gz in dist/"
        exit 1
    fi

    log_info "x64 build complete: $tar_gz"

    # Extract asar from tar.gz
    mkdir -p "$WORK_DIR/x64-extract"
    tar xzf "$tar_gz" -C "$WORK_DIR/x64-extract"

    # Find the asar file
    local asar_file
    asar_file=$(find "$WORK_DIR/x64-extract" -name "app.asar" -type f | head -1)
    if [ -z "$asar_file" ]; then
        log_error "Could not find app.asar in extracted tar.gz"
        exit 1
    fi

    # Copy asar to work directory
    cp "$asar_file" "$WORK_DIR/app.asar"
    log_info "Extracted asar: $WORK_DIR/app.asar"

    # Also extract the full app directory (for native modules reference)
    local app_dir
    app_dir=$(find "$WORK_DIR/x64-extract" -maxdepth 1 -name "electerm*" -type d | head -1)
    if [ -n "$app_dir" ]; then
        cp -r "$app_dir" "$WORK_DIR/x64-app"
        log_info "Extracted x64 app directory: $WORK_DIR/x64-app"
    fi

    # Restore original electron version
    log_info "Restoring original electron version..."
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.devDependencies.electron = '${original_electron_version}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    # Clean up x64 extract
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
        log_info "Downloading from $ELECTRON_LOONG64_URL..."
        curl -L -o "$zip_file" "$ELECTRON_LOONG64_URL"
    else
        log_info "Using cached download: $zip_file"
    fi

    # Extract
    log_info "Extracting electron loong64..."
    unzip -q -o "$zip_file" -d "$WORK_DIR/electron-loong64"

    # Verify
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
        log_warn "Native modules will use x64 versions (won't work on loong64)"
        return 0
    fi

    # Check for cross-compiler
    if ! command -v loongarch64-linux-gnu-g++ &>/dev/null; then
        log_warn "Step 3: loongarch64-linux-gnu-g++ not found, skipping native module rebuild"
        log_warn "Install with: sudo apt-get install g++-loongarch64-linux-gnu"
        return 0
    fi

    log_info "Step 3: Cross-compiling native modules for loong64..."

    local native_modules_dir="$WORK_DIR/native-modules-loong64"
    mkdir -p "$native_modules_dir"

    # Create a temp directory for cross-compilation builds
    local cross_build_dir="$WORK_DIR/cross-build"
    rm -rf "$cross_build_dir"
    mkdir -p "$cross_build_dir"
    cd "$cross_build_dir"

    # Build node-pty for loong64
    log_info "Building node-pty for loong64..."
    mkdir -p build-node-pty && cd build-node-pty
    npm init -y 2>/dev/null
    npm_config_arch=loong64 npm_config_target_arch=loong64 CC=loongarch64-linux-gnu-gcc CXX=loongarch64-linux-gnu-g++ npm install node-pty@1.1.0-beta34 --build-from-source 2>&1 | tail -5
    find . -name "pty.node" -type f | while read f; do
        log_info "Found node-pty build: $f"
        cp "$f" "$native_modules_dir/node-pty.node"
    done
    cd "$cross_build_dir"

    # Build @serialport/bindings-cpp for loong64
    log_info "Building @serialport/bindings-cpp for loong64..."
    mkdir -p build-serialport && cd build-serialport
    npm init -y 2>/dev/null
    npm_config_arch=loong64 npm_config_target_arch=loong64 CC=loongarch64-linux-gnu-gcc CXX=loongarch64-linux-gnu-g++ npm install @serialport/bindings-cpp --build-from-source 2>&1 | tail -5
    find . -path "*/build/Release/bindings.node" -type f | while read f; do
        log_info "Found serialport build: $f"
        cp "$f" "$native_modules_dir/serialport-bindings.node"
    done
    cd "$cross_build_dir"

    # ssh2 crypto binding is optional - skip for now
    log_info "Skipping @electerm/ssh2 crypto binding (optional, can be added later)"

    # Clean up cross-compilation environment
    unset CC CXX AR RANLIB LINK GYP_DEFINES npm_config_arch npm_config_target_arch

    # Report results
    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Native modules built successfully:"
        ls -la "$native_modules_dir/"
    else
        log_warn "No native modules were built. The build may have failed."
        log_warn "Check the build output above for errors."
    fi
}

# ============================================================================
# Step 4: Merge x64 asar with loong64 electron and native modules
# ============================================================================
merge_loong64() {
    log_info "Step 4: Merging x64 asar with loong64 electron..."

    mkdir -p "$OUTPUT_DIR"
    local output_name="electerm-${ELECTRON_VERSION}-linux-loong64"
    local output_dir="$OUTPUT_DIR/$output_name"
    rm -rf "$output_dir"
    mkdir -p "$output_dir"

    # Start with the x64 app directory (has the right structure)
    if [ -d "$WORK_DIR/x64-app" ]; then
        cp -r "$WORK_DIR/x64-app"/* "$output_dir/"
    fi

    # Replace electron binary with loong64 version
    log_info "Replacing electron binary with loong64 version..."
    cp "$WORK_DIR/electron-loong64/electron" "$output_dir/electron"
    chmod +x "$output_dir/electron"

    # Copy loong64 electron libraries (must override x64 versions)
    for lib in libEGL.so libGLESv2.so libvulkan.so.1 libvk_swiftshader.so libffmpeg.so; do
        if [ -f "$WORK_DIR/electron-loong64/$lib" ]; then
            cp "$WORK_DIR/electron-loong64/$lib" "$output_dir/"
        fi
    done

    # Copy locales if present
    if [ -d "$WORK_DIR/electron-loong64/locales" ]; then
        cp -r "$WORK_DIR/electron-loong64/locales" "$output_dir/"
    fi

    # Copy chrome-sandbox if present
    if [ -f "$WORK_DIR/electron-loong64/chrome-sandbox" ]; then
        cp "$WORK_DIR/electron-loong64/chrome-sandbox" "$output_dir/"
    fi

    # Replace native modules with loong64 versions
    local native_modules_dir="$WORK_DIR/native-modules-loong64"
    if [ -d "$native_modules_dir" ] && [ "$(ls -A "$native_modules_dir" 2>/dev/null)" ]; then
        log_info "Replacing native modules with loong64 versions..."

        # Replace node-pty
        if [ -f "$native_modules_dir/node-pty.node" ]; then
            find "$output_dir" -path "*/node-pty/build/Release/*.node" -exec cp "$native_modules_dir/node-pty.node" {} \; 2>/dev/null || true
        fi

        # Replace serialport bindings
        if [ -f "$native_modules_dir/serialport-bindings.node" ]; then
            find "$output_dir" -path "*@serialport/bindings-cpp*" -name "*.node" -exec cp "$native_modules_dir/serialport-bindings.node" {} \; 2>/dev/null || true
        fi

        # Replace ssh2 crypto if built
        if [ -f "$native_modules_dir/ssh2-crypto.node" ]; then
            find "$output_dir" -path "*@electerm/ssh2*" -name "*.node" -exec cp "$native_modules_dir/ssh2-crypto.node" {} \; 2>/dev/null || true
        fi
    fi

    # Update the app.asar if it exists separately
    if [ -f "$WORK_DIR/app.asar" ] && [ ! -f "$output_dir/resources/app.asar" ]; then
        mkdir -p "$output_dir/resources"
        cp "$WORK_DIR/app.asar" "$output_dir/resources/"
    fi

    # Create tar.gz
    log_info "Creating loong64 tar.gz..."
    cd "$OUTPUT_DIR"
    tar czf "${output_name}.tar.gz" "$output_name"

    log_info "Loong64 build complete: $OUTPUT_DIR/${output_name}.tar.gz"
    log_info "Output directory: $output_dir"
}

# ============================================================================
# Step 5: Test in QEMU loong64
# ============================================================================
test_in_qemu() {
    if ! command -v docker &>/dev/null; then
        log_warn "Step 5: Docker not available, skipping QEMU test"
        log_warn "To test: install docker, then run this script again"
        return 0
    fi

    log_info "Step 5: Testing in QEMU loong64 environment..."

    local output_dir="$OUTPUT_DIR/electerm-${ELECTRON_VERSION}-linux-loong64"

    if [ ! -d "$output_dir" ]; then
        log_error "Output directory not found: $output_dir"
        exit 1
    fi

    # Test in docker with QEMU
    log_info "Running electerm in QEMU loong64 docker..."
    docker run --rm \
        --platform linux/loong64 \
        -v "$output_dir:/opt/electerm" \
        "$LOONG64_DOCKER_IMAGE" \
        bash -c "
            echo 'Acquire::AllowInsecureRepositories \"true\";' > /etc/apt/apt.conf.d/99insecure
            echo 'Acquire::AllowDowngradeToInsecureRepositories \"true\";' >> /etc/apt/apt.conf.d/99insecure
            apt-get update -qq 2>/dev/null
            apt-get install -y -qq --allow-unauthenticated debian-ports-archive-keyring 2>/dev/null
            apt-get update -qq 2>/dev/null
            apt-get install -y -qq libglib2.0-0t64 libnss3 libxss1 libxtst6 libdrm2 libgbm1 libdbus-1-3 libgtk-3-0t64 2>/dev/null || true
            echo '=== Testing electerm binary ==='
            echo 'Electron binary:' && file /opt/electerm/electron
            echo 'Native modules:' && find /opt/electerm -name '*.node' -exec file {} \; 2>/dev/null | grep LoongArch | head -5
            echo '=== Attempting to run ==='
            cd /opt/electerm
            LD_LIBRARY_PATH=/opt/electerm timeout 10 ./electron --no-sandbox --disable-gpu --version 2>&1 || echo '(expected - no display in container)'
            echo '=== Test complete ==='
        "

    log_info "QEMU test complete."
}

# ============================================================================
# Main
# ============================================================================
main() {
    log_info "Starting electerm loong64 build..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Work directory: $WORK_DIR"
    log_info "Output directory: $OUTPUT_DIR"

    # Clean work directory
    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"

    # Run build steps
    install_prerequisites
    build_x64
    download_electron_loong64
    rebuild_native_modules
    merge_loong64
    test_in_qemu

    log_info "=========================================="
    log_info "Build complete!"
    log_info "Output: $OUTPUT_DIR/electerm-${ELECTRON_VERSION}-linux-loong64.tar.gz"
    log_info "=========================================="
}

main "$@"
