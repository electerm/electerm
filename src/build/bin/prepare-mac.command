#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
APP="$PWD/Electron.app"
if [ "$(uname -m)" != "arm64" ]; then
  echo "This package requires an Apple Silicon Mac."
  exit 1
fi
chmod +x "$APP/Contents/MacOS/Electron"
find "$APP/Contents/Resources/app.asar.unpacked" -name spawn-helper -exec chmod +x {} +
/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"
echo "Local signing completed. Opening Electerm Terminal."
open "$APP"
