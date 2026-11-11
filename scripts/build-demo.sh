#!/usr/bin/env bash
# Build the website demo from the exact artifact a buyer receives.
#
# Copies dist/TaskApp-<version>.html to demo/site.html (the file the demo container serves),
# writes its checksum and proves the copy matches. The demo runs in `?demo=1` mode, where the
# app loads its shipped sample workspace and keeps every change in memory — nothing is stored,
# so a visitor's demo cannot turn into a copy of the product by accident.
#
#   bash scripts/build-demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
SRC="dist/TaskApp-${VERSION}.html"
DEST="demo/site.html"

fail() { printf 'build-demo: FAIL — %s\n' "$*" >&2; exit 1; }
[[ -f "$SRC" ]] || fail "missing $SRC — run: bash scripts/build.sh"

mkdir -p demo
# in-place copy: keeps the inode, so a running bind mount sees the new bytes
cat "$SRC" > "$DEST"
(cd dist && sha256sum "TaskApp-${VERSION}.html") > demo/site.sha256
EXPECT="$(cut -d' ' -f1 demo/site.sha256)"
GOT="$(sha256sum "$DEST" | cut -d' ' -f1)"
[[ "$EXPECT" == "$GOT" ]] || fail "demo/site.html (${GOT}) does not match the release artifact (${EXPECT})"

printf 'build-demo: demo/site.html = TaskApp %s (%s bytes)\n' "$VERSION" "$(wc -c < "$DEST")"
printf 'build-demo: sha256 %s (matches dist/TaskApp-%s.html)\n' "$GOT" "$VERSION"
