#!/bin/sh
# The Debian build reuses the original tree. Only wrap the copy for tar.gz.
set -eu
output=$1
name=$2
stage=$(mktemp -d "$output/.tar-XXXXXXXX")
trap 'rm -rf "$stage"' EXIT
cp -al "$output/$name" "$stage/$name"
node "$(dirname "$0")/prepare-linux-tar.js" "$stage/$name" "$name.tar.gz"
tar -czf "$output/$name.tar.gz" -C "$stage" "$name"
