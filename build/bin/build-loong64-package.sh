#!/bin/bash
# Repackage an x64 electerm deb into a loong64 deb + tar.gz.
#
# Pre-conditions (set up by the GitHub Actions workflow before calling this):
#   - dist/electerm-*-linux-amd64.deb exists (built by electron-builder --x64)
#   - loongarch64-linux-gnu-gcc / g++ are on PATH
#   - LOONG64_ELECTRON_URL env var points to a community loong64 Electron zip
#     (if not set, the Electron binary is left as-is and a warning is printed)
#
# Outputs written to dist/:
#   electerm-<version>-linux-loong64.deb
#   electerm-<version>-linux-loong64.tar.gz

set -e

# ── 1. Locate the x64 deb and derive version ───────────────────────────────
X64_DEB=$(ls dist/electerm-*-linux-amd64.deb 2>/dev/null | head -1)
if [ -z "$X64_DEB" ]; then
  echo "❌ No x64 deb found in dist/. Run electron-builder --linux deb --x64 first."
  exit 1
fi
VERSION=$(dpkg-deb -f "$X64_DEB" Version)
echo "Source deb : $X64_DEB"
echo "Version    : $VERSION"

# ── 2. Extract the x64 deb ─────────────────────────────────────────────────
PKG_DIR=/tmp/electerm-loong64-pkg
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"
dpkg-deb -R "$X64_DEB" "$PKG_DIR"

# Detect install prefix: electron-builder uses /opt/<name> or /usr/lib/<name>
APP_DIR=$(find "$PKG_DIR" \( -path "*/opt/electerm" -o -path "*/usr/lib/electerm" \) -type d | head -1)
if [ -z "$APP_DIR" ]; then
  echo "❌ Cannot locate electerm install dir inside the deb."
  exit 1
fi
RESOURCES_DIR="$APP_DIR/resources"
UNPACKED_DIR="$RESOURCES_DIR/app.asar.unpacked"
echo "App dir    : $APP_DIR"

# ── 3. Cross-compile native modules for loong64 ────────────────────────────
export CC=loongarch64-linux-gnu-gcc
export CXX=loongarch64-linux-gnu-g++
export AR=loongarch64-linux-gnu-ar
export LINK=loongarch64-linux-gnu-g++
CROSS_ARGS="--arch loong64"

echo "── Rebuilding node-pty for loong64 ──"
NODE_PTY_DIR="work/app/node_modules/node-pty"
if [ -d "$NODE_PTY_DIR" ]; then
  (cd "$NODE_PTY_DIR" && npx node-gyp rebuild $CROSS_ARGS)
  DEST="$UNPACKED_DIR/node_modules/node-pty/build/Release"
  mkdir -p "$DEST"
  cp "$NODE_PTY_DIR/build/Release/pty.node" "$DEST/pty.node"
  echo "  ✓ pty.node installed"
else
  echo "  ⚠ node-pty not found in work/app, skipping"
fi

echo "── Rebuilding sshcrypto for loong64 ──"
SSH2_DIR="work/app/node_modules/@electerm/ssh2/lib/protocol/crypto"
if [ -d "$SSH2_DIR" ]; then
  (cd "$SSH2_DIR" && npx node-gyp rebuild $CROSS_ARGS)
  DEST="$UNPACKED_DIR/node_modules/@electerm/ssh2/lib/protocol/crypto/build/Release"
  mkdir -p "$DEST"
  cp "$SSH2_DIR/build/Release/sshcrypto.node" "$DEST/sshcrypto.node"
  echo "  ✓ sshcrypto.node installed"
else
  echo "  ⚠ @electerm/ssh2 not found in work/app, skipping"
fi

echo "── Rebuilding @serialport/bindings-cpp for loong64 ──"
SERIALPORT_DIR="work/app/node_modules/@serialport/bindings-cpp"
if [ -d "$SERIALPORT_DIR" ]; then
  (cd "$SERIALPORT_DIR" && npx node-gyp rebuild $CROSS_ARGS)
  # serialport uses platform-specific prebuild paths; put result in linux-loong64
  DEST="$UNPACKED_DIR/node_modules/@serialport/bindings-cpp/prebuilds/linux-loong64"
  mkdir -p "$DEST"
  cp "$SERIALPORT_DIR/build/Release/bindings.node" \
     "$DEST/@serialport+bindings-cpp.loong64.glibc.node"
  echo "  ✓ serialport bindings installed"
else
  echo "  ⚠ @serialport/bindings-cpp not found in work/app, skipping"
fi

# ── 4. Replace Electron binary with loong64 build ─────────────────────────
if [ -n "$LOONG64_ELECTRON_URL" ]; then
  echo "── Downloading loong64 Electron from $LOONG64_ELECTRON_URL ──"
  ELECTRON_ARCHIVE=/tmp/electron-loong64-bin.zip
  curl -fsSL "$LOONG64_ELECTRON_URL" -o "$ELECTRON_ARCHIVE"

  ELECTRON_TMP=/tmp/electron-loong64-extracted
  rm -rf "$ELECTRON_TMP" && mkdir -p "$ELECTRON_TMP"

  # Support both .zip and .tar.gz
  case "$LOONG64_ELECTRON_URL" in
    *.tar.gz|*.tgz)
      tar -xzf "$ELECTRON_ARCHIVE" -C "$ELECTRON_TMP"
      ;;
    *)
      unzip -q "$ELECTRON_ARCHIVE" -d "$ELECTRON_TMP"
      ;;
  esac

  # Copy Electron binary and shared libraries into the package
  # The extracted dir may have a single subdirectory; resolve it
  ELECTRON_BIN_DIR=$(find "$ELECTRON_TMP" -maxdepth 2 -name "electron" -type f | head -1 | xargs dirname)
  if [ -n "$ELECTRON_BIN_DIR" ]; then
    cp -f "$ELECTRON_BIN_DIR/electron"        "$APP_DIR/electerm"   2>/dev/null || true
    cp -f "$ELECTRON_BIN_DIR"/lib*.so*        "$APP_DIR/"           2>/dev/null || true
    cp -f "$ELECTRON_BIN_DIR/chrome-sandbox"  "$APP_DIR/"           2>/dev/null || true
    cp -f "$ELECTRON_BIN_DIR"/*.so*           "$APP_DIR/"           2>/dev/null || true
    echo "  ✓ loong64 Electron binary installed"
  else
    echo "  ⚠ Could not locate 'electron' binary inside the archive"
  fi
else
  echo "⚠ LOONG64_ELECTRON_URL not set — Electron binary will remain x64."
  echo "  Set it to a community loong64 Electron release URL."
fi

# ── 5. Fix deb metadata ───────────────────────────────────────────────────
sed -i 's/^Architecture: .*/Architecture: loong64/' "$PKG_DIR/DEBIAN/control"
# Recalculate installed size
INSTALLED_KB=$(du -sk "$PKG_DIR" | awk '{print $1}')
sed -i "s/^Installed-Size: .*/Installed-Size: $INSTALLED_KB/" "$PKG_DIR/DEBIAN/control"

# ── 6. Build loong64 deb ──────────────────────────────────────────────────
OUTPUT_DEB="dist/electerm-${VERSION}-linux-loong64.deb"
dpkg-deb --root-owner-group -b "$PKG_DIR" "$OUTPUT_DEB"
echo "✓ Created $OUTPUT_DEB"

# ── 7. Build loong64 tar.gz from the raw app directory ───────────────────
OUTPUT_TAR="dist/electerm-${VERSION}-linux-loong64.tar.gz"
TAR_STAGING=/tmp/electerm-loong64-tar
rm -rf "$TAR_STAGING"
mkdir -p "$TAR_STAGING/electerm"
cp -r "$APP_DIR/." "$TAR_STAGING/electerm/"
tar -czf "$OUTPUT_TAR" -C "$TAR_STAGING" electerm
echo "✓ Created $OUTPUT_TAR"

echo "=== loong64 packaging done ==="
