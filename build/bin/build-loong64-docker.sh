#!/bin/bash
# Runs inside aosc/aosc-os:latest (linux/loong64) via QEMU on the CI runner.
# Compiles native modules natively for loong64, downloads the community
# Electron binary, and repackages the x64 deb as loong64 deb + tar.gz.
set -euo pipefail

WORKSPACE=/workspace

# ── 1. Install build tools ────────────────────────────────────────────────────
echo "==> Installing build tools..."
oma install --yes gcc g++ make python3 nodejs npm curl unzip

echo "==> Node.js version: $(node --version)"
echo "==> npm version:     $(npm --version)"

# ── 2. Find the x64 deb and extract it ───────────────────────────────────────
DEB=$(ls "$WORKSPACE"/dist/electerm-*-linux-amd64.deb 2>/dev/null | head -1)
if [ -z "$DEB" ]; then
  echo "ERROR: No x64 deb found in dist/" >&2
  exit 1
fi

VERSION=$(dpkg-deb -f "$DEB" Version)
echo "==> Packaging electerm $VERSION for loong64"

PKG_DIR=/tmp/electerm-loong64-pkg
rm -rf "$PKG_DIR"
dpkg-deb -R "$DEB" "$PKG_DIR"

# ── 3. Locate the app directory inside the extracted deb ─────────────────────
APP_DIR="$PKG_DIR/opt/electerm"
if [ ! -d "$APP_DIR" ]; then
  # Fallback: search for the electerm executable
  APP_DIR=$(find "$PKG_DIR" -maxdepth 5 -name "electerm" -type f \
    ! -name "*.desktop" | head -1 | xargs dirname 2>/dev/null || true)
  if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
    echo "ERROR: Cannot find app directory in extracted deb" >&2
    exit 1
  fi
fi
echo "==> App dir: $APP_DIR"

UNPACKED_DIR="$APP_DIR/resources/app.asar.unpacked"

# ── 4. Compile native modules natively for loong64 ───────────────────────────
# No cross-compilation flags needed — the container IS loong64.

echo "==> Compiling node-pty..."
pushd "$WORKSPACE/work/app/node_modules/node-pty"
npx node-gyp rebuild
cp build/Release/pty.node "$UNPACKED_DIR/node_modules/node-pty/build/Release/pty.node"
popd

echo "==> Compiling sshcrypto..."
pushd "$WORKSPACE/work/app/node_modules/@electerm/ssh2/lib/protocol/crypto"
npx node-gyp rebuild
cp build/Release/sshcrypto.node \
  "$UNPACKED_DIR/node_modules/@electerm/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node"
popd

echo "==> Compiling serialport bindings..."
pushd "$WORKSPACE/work/app/node_modules/@serialport/bindings-cpp"
npx node-gyp rebuild
BUILT_NODE=$(find prebuilds -name "*.node" 2>/dev/null | head -1 || true)
if [ -n "$BUILT_NODE" ]; then
  DEST="$UNPACKED_DIR/node_modules/@serialport/bindings-cpp/prebuilds/linux-loong64"
  mkdir -p "$DEST"
  cp "$BUILT_NODE" "$DEST/"
fi
popd

# ── 5. Download and replace the Electron binary ──────────────────────────────
echo "==> Downloading loong64 Electron from $LOONG64_ELECTRON_URL..."
curl -fL "$LOONG64_ELECTRON_URL" -o /tmp/electron-loong64.zip
unzip -o /tmp/electron-loong64.zip -d /tmp/electron-loong64

echo "==> Installing loong64 Electron binary..."
cp /tmp/electron-loong64/electron "$APP_DIR/electerm"
chmod 755 "$APP_DIR/electerm"
# Copy shared libraries and sandbox binary if present
find /tmp/electron-loong64 -maxdepth 1 -name "lib*.so*" -exec cp {} "$APP_DIR/" \; 2>/dev/null || true
[ -f /tmp/electron-loong64/chrome-sandbox ] && cp /tmp/electron-loong64/chrome-sandbox "$APP_DIR/" || true

# ── 6. Update DEBIAN/control ─────────────────────────────────────────────────
echo "==> Updating package architecture metadata..."
sed -i 's/^Architecture: .*/Architecture: loong64/' "$PKG_DIR/DEBIAN/control"
INSTALLED_SIZE=$(du -sk --exclude="$PKG_DIR/DEBIAN" "$PKG_DIR" | cut -f1)
sed -i "s/^Installed-Size: .*/Installed-Size: $INSTALLED_SIZE/" "$PKG_DIR/DEBIAN/control"

# ── 7. Build loong64 deb ─────────────────────────────────────────────────────
echo "==> Building loong64 deb..."
dpkg-deb --root-owner-group -b "$PKG_DIR" \
  "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.deb"

# ── 8. Build loong64 tar.gz ──────────────────────────────────────────────────
echo "==> Building loong64 tar.gz..."
STAGING=/tmp/electerm-loong64-staging
rm -rf "$STAGING"
mkdir -p "$STAGING/electerm"
cp -r "$APP_DIR/." "$STAGING/electerm/"
tar -czf "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.tar.gz" \
  -C "$STAGING" electerm

echo "==> Done! Artifacts:"
ls -lh "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64".*
