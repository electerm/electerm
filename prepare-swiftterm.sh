#!/bin/sh
set -eu
cd "$(dirname "$0")"
dep=.build/vendor/SwiftTerm
revision=282c3c3a932b55c129628876b70f37d993af1615
if [ ! -d "$dep/.git" ]; then
  mkdir -p .build/vendor
  git clone --quiet --depth 1 --branch v1.99.3 https://github.com/migueldeicaza/SwiftTerm.git "$dep"
fi
[ "$(git -C "$dep" rev-parse HEAD)" = "$revision" ] || { echo "Unexpected SwiftTerm revision" >&2; exit 1; }
for patch in "$PWD"/Integration/*.patch; do
  if ! git -C "$dep" apply --reverse --check "$patch" 2>/dev/null; then
    git -C "$dep" apply "$patch"
  fi
done
cmp -s Integration/ElectermRendering.swift "$dep/Sources/SwiftTerm/Apple/ElectermRendering.swift" ||
  cp Integration/ElectermRendering.swift "$dep/Sources/SwiftTerm/Apple/"
