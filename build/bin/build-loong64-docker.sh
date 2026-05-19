#!/bin/bash
# Runs inside aosc/aosc-os:latest (linux/loong64) via QEMU on the CI runner.
# Strategy:
#   1. Extract app.asar (pure JS) and app.asar.unpacked (structure) from x64 deb.
#   2. Compile native modules natively for loong64; replace every x64 .node file
#      in app.asar.unpacked with its loong64 counterpart (JS support files kept).
#   3. Download the community loong64 Electron zip -- use it as the runtime base.
#   4. Inject app.asar + loong64 app.asar.unpacked into the Electron resources/.
#   5. Repackage as loong64 deb + tar.gz.
set -euo pipefail

WORKSPACE=/workspace

# -- 1. Install build tools ---------------------------------------------------
echo "==> Installing build tools..."
oma install --yes gcc g++ make python3 nodejs curl unzip

echo "==> Node.js version: $(node --version)"
echo "==> npm version:     $(npm --version)"

# -- 2. Extract app resources from the x64 deb --------------------------------
echo "==> Workspace contents:"
ls -al "$WORKSPACE/"
echo "==> dist/ contents:"
ls -al "$WORKSPACE/dist/" 2>/dev/null || echo "(dist/ missing)"

DEB=$(ls "$WORKSPACE"/dist/electerm-*-linux-amd64.deb 2>/dev/null | head -1)
if [ -z "$DEB" ]; then
  echo "ERROR: No x64 deb found in dist/" >&2
  exit 1
fi
VERSION=$(dpkg-deb -f "$DEB" Version)
echo "==> Building electerm $VERSION for loong64"

PKG_X64=/tmp/electerm-x64-pkg
rm -rf "$PKG_X64"
dpkg-deb -R "$DEB" "$PKG_X64"

X64_APP_DIR=$(find "$PKG_X64" \
  \( -path "*/opt/electerm" -o -path "*/usr/lib/electerm" \) -type d | head -1)
if [ -z "$X64_APP_DIR" ]; then
  echo "ERROR: Cannot locate app dir inside x64 deb" >&2; exit 1
fi
X64_RESOURCES="$X64_APP_DIR/resources"
echo "==> x64 app dir  : $X64_APP_DIR"
echo "==> x64 resources: $(ls "$X64_RESOURCES/")"

# -- 3. Install app deps natively for loong64 ---------------------------------
echo "==> Installing app dependencies for loong64..."
cd "$WORKSPACE/work/app"
npm install --omit=dev --legacy-peer-deps
echo "==> Loong64 native .node files:"
find node_modules -name "*.node" 2>/dev/null || echo "(none found)"
cd "$WORKSPACE"

APP_MODS="$WORKSPACE/work/app/node_modules"

# -- 4. Build loong64 app.asar.unpacked ---------------------------------------
# The unpacked dir contains entire module trees (JS + .node files).
# Start from the x64 unpacked dir (JS support files are arch-neutral),
# then replace every .node file with the loong64-compiled version.
echo "==> Building loong64 app.asar.unpacked..."
UNPACKED_BUILD=/tmp/app.asar.unpacked
rm -rf "$UNPACKED_BUILD"
cp -r "$X64_RESOURCES/app.asar.unpacked" "$UNPACKED_BUILD"

find "$UNPACKED_BUILD" -name "*.node" | while read -r x64_node; do
  rel="${x64_node#$UNPACKED_BUILD/node_modules/}"
  loong64_src="$APP_MODS/$rel"
  if [ -f "$loong64_src" ]; then
    cp "$loong64_src" "$x64_node"
    echo "  ok $rel"
  else
    echo "  WARN: no loong64 .node for: $rel" >&2
  fi
done

echo "==> app.asar.unpacked .node files after rebuild:"
find "$UNPACKED_BUILD" -name "*.node" | sort

# -- 5. Download loong64 Electron and use it as the runtime base --------------
echo "==> Downloading loong64 Electron from $LOONG64_ELECTRON_URL..."
curl -fL "$LOONG64_ELECTRON_URL" -o /tmp/electron-loong64.zip
unzip -o /tmp/electron-loong64.zip -d /tmp/electron-loong64-raw

# Handle potential subdirectory inside the zip
ELECTRON_SRC=$(find /tmp/electron-loong64-raw -maxdepth 2 -name "electron" -type f \
  | head -1 | xargs dirname 2>/dev/null || echo /tmp/electron-loong64-raw)
echo "==> Electron source dir: $ELECTRON_SRC"
ls -al "$ELECTRON_SRC/"

# -- 6. Assemble the loong64 app directory ------------------------------------
APP_DIR=/tmp/electerm-loong64-app
rm -rf "$APP_DIR"
cp -r "$ELECTRON_SRC/." "$APP_DIR/"

# The Electron zip ships the binary as "electron"; rename to match the app name
if [ -f "$APP_DIR/electron" ]; then
  mv "$APP_DIR/electron" "$APP_DIR/electerm"
fi
chmod 755 "$APP_DIR/electerm"

# Replace the Electron default resources/ with our app resources
rm -rf "$APP_DIR/resources"
mkdir -p "$APP_DIR/resources"
cp "$X64_RESOURCES/app.asar"           "$APP_DIR/resources/"
[ -f "$X64_RESOURCES/app-update.yml" ] && \
  cp "$X64_RESOURCES/app-update.yml"   "$APP_DIR/resources/" || true
cp -r "$UNPACKED_BUILD"                "$APP_DIR/resources/app.asar.unpacked"

echo "==> Final app dir:"
ls -al "$APP_DIR/"
echo "==> resources/:"
ls -al "$APP_DIR/resources/"
echo "==> app.asar.unpacked .node count: $(find "$APP_DIR/resources/app.asar.unpacked" -name "*.node" | wc -l)"

# -- 7. Build loong64 deb -----------------------------------------------------
# Reuse the full x64 deb structure (DEBIAN metadata, desktop file, icons,
# /usr/bin wrapper script), but swap the app dir for our loong64 one.
PKG_DIR=/tmp/electerm-loong64-pkg
rm -rf "$PKG_DIR"
cp -r "$PKG_X64/." "$PKG_DIR/"

# Determine the app-dir path inside the package tree and replace it
PKG_APP_DIR="$PKG_DIR${X64_APP_DIR#$PKG_X64}"
rm -rf "$PKG_APP_DIR"
mkdir -p "$PKG_APP_DIR"
cp -r "$APP_DIR/." "$PKG_APP_DIR/"

sed -i 's/^Architecture: .*/Architecture: loong64/' "$PKG_DIR/DEBIAN/control"
INSTALLED_SIZE=$(du -sk --exclude="$PKG_DIR/DEBIAN" "$PKG_DIR" | cut -f1)
sed -i "s/^Installed-Size: .*/Installed-Size: $INSTALLED_SIZE/" "$PKG_DIR/DEBIAN/control"

echo "==> Building loong64 deb..."
dpkg-deb --root-owner-group -b "$PKG_DIR" \
  "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.deb"

# -- 8. Build loong64 tar.gz --------------------------------------------------
echo "==> Building loong64 tar.gz..."
STAGING=/tmp/electerm-loong64-staging
rm -rf "$STAGING"
mkdir -p "$STAGING/electerm"
cp -r "$APP_DIR/." "$STAGING/electerm/"
tar -czf "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.tar.gz" \
  -C "$STAGING" electerm

echo "==> Done! Artifacts:"
ls -lh "$WORKSPACE/dist/"
echo "==> loong64 deb info:"
dpkg-deb -f "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.deb" 2>/dev/null || true
