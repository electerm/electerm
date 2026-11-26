# The launcher opens the extracted helper as the user. Verify the root-owned
# copy against the digest embedded at packaging time before granting it setuid permissions.
umask 077
cd /
base=/var/lib/electerm-sandbox
for parent in /var /var/lib; do
  [ ! -L "$parent" ] && [ "$(stat -c %u "$parent")" = 0 ] && [ -z "$(find "$parent" -maxdepth 0 -perm /022 -print)" ] || exit 1
done
if [ ! -d "$base" ]; then mkdir -m 755 "$base" || [ -d "$base" ]; fi
[ ! -L "$base" ] && [ "$(stat -c '%u:%a' "$base")" = 0:755 ] || exit 1
tmp=$(mktemp -d "$base/.setup-XXXXXXXX")
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
head -c 16777216 > helper
printf '%s  helper\n' '@HELPER_SHA256@' | sha256sum -c -
chown 0:0 helper
chmod 4755 helper
mv -fT helper "$base/@VARIANT@"
