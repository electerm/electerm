#!/bin/sh
set -eu
dir=$(dirname "$(readlink -f "$0")")
helper="$dir/chrome-sandbox"
cached=/var/lib/electerm-sandbox/@VARIANT@

valid_helper() {
  [ -f "$1" ] && [ -x "$1" ] && [ "$(stat -Lc '%u:%a' "$1")" = 0:4755 ] &&
    [ "$(sha256sum < "$1")" = "@HELPER_SHA256@  -" ]
}

# A normal extraction cannot give the SUID helper root ownership. Chromium
# prefers user namespaces where the kernel and the desktop policy allow them.
if ! valid_helper "$helper" && ! unshare --user --map-root-user --net --pid --fork true 2>/dev/null; then
  if ! valid_helper "$cached"; then
    echo 'Electerm needs administrator permission to install its Chromium sandbox helper. For a manual download, verify the archive against the official release SHA-256 before approving.' >&2
    if [ -t 0 ] && command -v sudo >/dev/null; then elevate=sudo; else elevate=pkexec; fi
    "$elevate" /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin /bin/sh -eu -c "$(cat <<'ELECTERM_SETUP'
@INSTALL_SCRIPT@
ELECTERM_SETUP
)" sh < "$helper"
  fi
  valid_helper "$cached" || { echo 'Electerm sandbox setup did not complete.' >&2; exit 1; }
  ln -sfnT "$cached" "$helper"
fi
exec "$dir/electerm-bin" "$@"
