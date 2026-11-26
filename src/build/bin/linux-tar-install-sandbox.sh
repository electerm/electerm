# Executed with administrator approval. Only bytes from an authenticated
# Electerm release can become setuid; never promote the caller's local copy.
umask 077
cd /
asset=$1
digest=$2
case "$asset$digest" in *[!a-zA-Z0-9._-]*) exit 1 ;; esac
printf '%s\n' "$asset" | grep -Eq '^electerm-[0-9]+\.[0-9]+\.[0-9]+-linux-[a-z0-9_]+(-legacy)?\.tar\.gz$'
printf '%s\n' "$digest" | grep -Eq '^[a-f0-9]{64}$'
base=/var/lib/electerm-sandbox
for parent in /var /var/lib; do
  [ ! -L "$parent" ] && [ "$(stat -c %u "$parent")" = 0 ] && [ -z "$(find "$parent" -maxdepth 0 -perm /022 -print)" ] || exit 1
done
if [ ! -d "$base" ]; then mkdir -m 755 "$base" || [ -d "$base" ]; fi
[ ! -L "$base" ] && [ "$(stat -c '%u:%a' "$base")" = 0:755 ] || exit 1
tmp=$(mktemp -d "$base/.setup-XXXXXXXX")
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
fetch() {
  curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 300 "$1" -o "$2"
}
fetch "https://electerm.org/sha256/$asset.checksum" checksum
read -r hash filename < checksum
[ "$filename" = "$asset" ]
printf '%s\n' "$hash" | grep -Eq '^[a-f0-9]{64}$'
version=${asset#electerm-}
tag=v${version%%-linux-*}
fetch "https://r2.electerm.org/r/$asset" archive || fetch "https://github.com/electerm/electerm/releases/download/$tag/$asset" archive
printf '%s  archive\n' "$hash" | sha256sum -c -
tar -xOzf archive --no-anchored chrome-sandbox > helper
printf '%s  helper\n' "$digest" | sha256sum -c -
chown 0:0 helper
chmod 4755 helper
variant=${asset#*-linux-}
mv -fT helper "$base/${variant%.tar.gz}"
