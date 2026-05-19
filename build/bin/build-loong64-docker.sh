#!/bin/bash
# Runs inside aosc/aosc-os:latest (linux/loong64) via QEMU on the CI runner.
# Compiles native modules natively for loong64, downloads the community
# Electron binary, and repackages the x64 deb as loong64 deb + tar.gz.
set -euo pipefail

WORKSPACE=/workspace

# ── 1. Install build tools ────────────────────────────────────────────────────
echo "==> Installing build tools..."
oma install --yes gcc g++ make python3 nodejs curl unzip

echo "==> Node.js version: $(node --version)"
echo "==> npm version:     $(npm --version)"

# ── 2. Find the x64 deb and extract it ───────────────────────────────────────
echo "==> Workspace contents:"
ls -al "$WORKSPACE/"
echo "==> dist/ contents:"
ls -al "$WORKSPACE/dist/" 2>/dev/null || echo "(dist/ missing)"
echo "==> work/ contents:"
ls -al "$WORKSPACE/work/" 2>/dev/null || echo "(work/ missing)"
echo "==> work/app/ contents:"
ls -al "$WORKSPACE/work/app/" 2>/dev/null || echo "(work/app/ missing)"

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
echo "==> App dir contents:"
ls -al "$APP_DIR/"
echo "==> resources/ contents:"
ls -al "$APP_DIR/resources/" 2>/dev/null || echo "(resources/ missing)"

UNPACKED_DIR="$APP_DIR/resources/app.asar.unpacked"
echo "==> UNPACKED_DIR: $UNPACKED_DIR"
echo "==> app.asar.unpacked/ contents:"
ls -al "$UNPACKED_DIR/" 2>/dev/null || echo "(app.asar.unpacked/ missing or empty)"

# ── 4. Install app deps natively for loong64 (compiles .node files) ──────────
# work/app/node_modules is not in the artifact, so we install fresh here.
# Running inside the loong64 container means npm compiles native modules for
# loong64 automatically — no cross-compilation or node-gyp flags needed.

echo "==> Installing app dependencies for loong64..."
cd "$WORKSPACE/work/app"
npm install --omit=dev --legacy-peer-deps
echo "==> Loong64 native .node files:"
find node_modules -name "*.node" 2>/dev/null || echo "(no .node files found)"
cd "$WORKSPACE"

APP_MODS="$WORKSPACE/work/app/node_modules"

# ── 5. Rebuild app.asar.unpacked entirely from loong64 native modules ─────────
# We keep only the app.asar (pure JS) from the x64 build.
# The entire app.asar.unpacked is wiped and rebuilt from the loong64 npm
# install so that no x64 .node files remain.
echo "==> Rebuilding app.asar.unpacked with loong64 native modules..."
rm -rf "$UNPACKED_DIR"
mkdir -p "$UNPACKED_DIR/node_modules"

find "$APP_MODS" -name "*.node" | while read -r node_file; do
  rel="${node_file#$APP_MODS/}"
  dest="$UNPACKED_DIR/node_modules/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$node_file" "$dest"
  echo "  ✓ $rel"
done

echo "==> app.asar.unpacked contents after rebuild:"
find "$UNPACKED_DIR" -name "*.node" 2>/dev/null || echo "(no .node files)"

# ── 6. Replace ALL x64 Electron files with loong64 Electron ──────────────────
# This covers: the main binary, chrome-sandbox, chrome_crashpad_handler,
# all .so libs, snapshot_blob.bin, v8_context_snapshot.bin, .pak files,
# locales/, and any other arch-specific file shipped with Electron.
# The resources/ directory is deliberately preserved — it already contains
# the original app.asar + freshly rebuilt loong64 app.asar.unpacked.
echo "==> Downloading loong64 Electron from $LOONG64_ELECTRON_URL..."
curl -fL "$LOONG64_ELECTRON_URL" -o /tmp/electron-loong64.zip
unzip -o /tmp/electron-loong64.zip -d /tmp/electron-loong64
echo "==> Extracted Electron contents:"
ls -al /tmp/electron-loong64/

echo "==> Removing all x64 Electron files from app dir (keeping resources/)..."
find "$APP_DIR" -maxdepth 1 ! -name "." ! -name "resources" -exec rm -rf {} +

echo "==> Copying all loong64 Electron files into app dir..."
find /tmp/electron-loong64 -maxdepth 1 ! -name "." ! -name "resources" | while read -r f; do
  cp -rf "$f" "$APP_DIR/"
done

# electron-builder names the binary after the app; rename electron → electerm
if [ -f "$APP_DIR/electron" ]; then
  mv "$APP_DIR/electron" "$APP_DIR/electerm"
fi
chmod 755 "$APP_DIR/electerm"
echo "==> App dir after Electron replacement:"
ls -al "$APP_DIR/"

# ── 7. Update DEBIAN/control ─────────────────────────────────────────────────
echo "==> Updating package architecture metadata..."
sed -i 's/^Architecture: .*/Architecture: loong64/' "$PKG_DIR/DEBIAN/control"
INSTALLED_SIZE=$(du -sk --exclude="$PKG_DIR/DEBIAN" "$PKG_DIR" | cut -f1)
sed -i "s/^Installed-Size: .*/Installed-Size: $INSTALLED_SIZE/" "$PKG_DIR/DEBIAN/control"

# ── 8. Build loong64 deb ─────────────────────────────────────────────────────
echo "==> Building loong64 deb..."
dpkg-deb --root-owner-group -b "$PKG_DIR" \
  "$WORKSPACE/dist/electerm-${VERSION}-linux-loong64.deb"

# ── 9. Build loong64 tar.gz ──────────────────────────────────────────────────
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
