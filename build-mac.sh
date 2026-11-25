#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo "Run on Apple Silicon macOS 14+ with Xcode Command Line Tools." >&2
  exit 1
fi
sh prepare-swiftterm.sh
spm() {
  subcommand="$1"
  shift
  swift "$subcommand" --cache-path "$PWD/.build/cache" --config-path "$PWD/.build/config" \
    --security-path "$PWD/.build/security" --disable-automatic-resolution "$@"
}
export CLANG_MODULE_CACHE_PATH="$PWD/.build/modules"
# Standalone CLT does not always discover the Swift Testing macros during incremental builds.
testing_macros="$(xcode-select -p)/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib"
if [ -f "$testing_macros" ]; then
  spm test --disable-xctest --arch arm64 -Xswiftc -load-plugin-library -Xswiftc "$testing_macros"
else
  spm test --disable-xctest --arch arm64
fi
spm build -c release --arch arm64 --product ElectermMac
bin="$(spm build -c release --arch arm64 --show-bin-path)"
mkdir -p dist
stage="$(mktemp -d "$PWD/dist/.package-XXXXXX")"
trap 'rm -rf "$stage"' EXIT
portable="$stage/Electerm Terminal"
app="$portable/Electerm Terminal.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
install -m 755 "$bin/ElectermMac" "$app/Contents/MacOS/ElectermMac"
strip -x "$app/Contents/MacOS/ElectermMac"
cp Info.plist "$app/Contents/"
install -m 644 Assets/AppIcon.icns "$app/Contents/Resources/AppIcon.icns"
cp LICENSE "$app/Contents/Resources/"
cp .build/vendor/SwiftTerm/LICENSE "$app/Contents/Resources/LICENSE-SwiftTerm"
plutil -lint "$app/Contents/Info.plist"
lipo "$app/Contents/MacOS/ElectermMac" -verify_arch arm64
if otool -L "$app/Contents/MacOS/ElectermMac" | grep -Eq 'JavaScriptCore|WebKit|Electron'; then
  echo "Unexpected web engine in the executable" >&2; exit 1
fi
codesign --force --sign - "$app"
codesign --verify --strict "$app"
"$app/Contents/MacOS/ElectermMac" --verify-terminal
awk '/^## 安装$/ { emit=1 } /^## 功能$/ { exit } emit' README.md > "$portable/使用与清理.md"
test -s "$portable/使用与清理.md"
ditto --norsrc --noextattr -c -k --keepParent "$portable" "$stage/Electerm-Terminal-mac-arm64.zip"
mv -f "$stage/Electerm-Terminal-mac-arm64.zip" dist/
echo "dist/Electerm-Terminal-mac-arm64.zip"
