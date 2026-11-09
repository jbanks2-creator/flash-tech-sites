#!/usr/bin/env bash
# Build the distribution artifact a buyer receives.
#
#   bash scripts/build.sh
#
# Produces, in dist/:
#   TaskApp-<version>.html            the whole app, one readable file (no minification:
#                                     a buyer who wants to inspect what they bought can)
#   TaskApp-<version>.html.sha256     sha256sum -c format
#   README.txt                        the first file the buyer should read
#
# The build is deliberately boring: it validates, then copies bytes. It must be
# deterministic — building twice has to produce identical checksums — so no dates,
# hostnames, git hashes or counters go into any output file.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
HTML="index.html"
DIST="dist"
NAME="TaskApp-${VERSION}.html"

fail() { printf '\nbuild: FAIL — %s\n' "$*" >&2; exit 1; }
say()  { printf '  %s\n' "$*"; }

echo "TaskApp build — version ${VERSION}"

# ---- 1. the version is one number, in one place, and the file agrees -----------
[[ -n "$VERSION" ]] || fail "VERSION is empty"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || fail "VERSION '$VERSION' is not semver"
APP_VER="$(grep -oE 'const APP_VERSION = "[^"]+"' "$HTML" | head -1 | sed -E 's/.*"([^"]+)"/\1/')"
[[ "$APP_VER" == "$VERSION" ]] || fail "index.html APP_VERSION is '${APP_VER:-missing}' but VERSION is '${VERSION}'"
say "version: ${VERSION} (VERSION + APP_VERSION agree)"

# ---- 2. the app is still a single, self-contained, offline file ----------------
node tools/audit/csp-hash.mjs "$HTML" >/dev/null || fail "CSP hash does not match the inline script — run: node tools/audit/csp-hash.mjs index.html --write"
say "csp: hash matches the inline script"

node scripts/embed-demo.mjs --check >/dev/null || fail "embedded demo data drifted from demo-data.json — run: node scripts/embed-demo.mjs --write"
node scripts/embed-demo.mjs --check | sed 's/^/  /'
say "demo: index.html matches demo-data.json"

if grep -nE '<(script|img|iframe)[^>]+src="(https?:)?//' "$HTML" \
   || grep -nE '<link[^>]+href="(https?:)?//' "$HTML" \
   || grep -nE '@import|url\((https?:)?//' "$HTML"; then
  fail "the file loads something from the network (see above)"
fi
say "network: no external script, style, image, font or @import"

grep -q 'connect-src .none.' "$HTML" || fail "connect-src 'none' is missing from the CSP"
grep -q '<html lang="en">' "$HTML" || fail "index.html has no lang attribute"
[[ "$(grep -c '<title>' "$HTML")" -eq 1 ]] || fail "expected exactly one <title>"
say "structure: lang, title and connect-src are present"

# ---- 3. generate the artifact into a directory (run twice, byte-compare) -------
build_into() {
  local out="$1"
  mkdir -p "$out"
  # Readable on purpose: minification would save ~60 KB and cost the buyer the ability
  # to see what they installed. The file is one HTTP-less open, so size is not a problem.
  cp "$HTML" "$out/$NAME"
  sed "s/@VERSION@/${VERSION}/g" scripts/README.dist.txt > "$out/README.txt"
  ( cd "$out" && sha256sum "$NAME" > "$NAME.sha256" )
}

rm -rf "$DIST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
build_into "$DIST"
build_into "$TMP/build2"

# ---- 4. prove it is reproducible ----------------------------------------------
for f in "$NAME" "$NAME.sha256" "README.txt"; do
  cmp -s "$DIST/$f" "$TMP/build2/$f" || fail "second build produced a different $f — the build is not reproducible"
done
say "reproducible: two independent builds are byte-identical"

# ---- 5. the checksum file verifies ---------------------------------------------
( cd "$DIST" && sha256sum -c "$NAME.sha256" >/dev/null ) || fail "the .sha256 file does not verify"
SUM="$(cut -d' ' -f1 "$DIST/$NAME.sha256")"

echo
printf 'Built %s (%s bytes)\n' "$DIST/$NAME" "$(wc -c < "$DIST/$NAME")"
printf 'sha256 %s\n' "$SUM"
printf 'also  %s, %s\n' "$DIST/$NAME.sha256" "$DIST/README.txt"
