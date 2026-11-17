#!/usr/bin/env bash
# Put a past release into dist/archive/<version>/ as its own coherent drop.
#
#   bash scripts/build-archive.sh 1.0.0-rc.2 7b7bfef
#
# Why this exists: dist/ is the *current* release drop (one version, its README.txt and
# its .sha256). Older versions are kept under dist/archive/<version>/ with their own
# README.txt and .sha256, so a buyer never receives rc.N's documentation or checksum
# filename beside rc.M's file. scripts/check-dist.sh enforces that.
#
# The archived artifact is not hand-copied: it is extracted from the git revision whose
# index.html produced it, together with that revision's scripts/README.dist.txt, so the
# archive can be rebuilt from history and the html is verifiable against its checksum.
#
#   $1  version, e.g. 1.0.0-rc.2   (must equal VERSION at that revision and the html's
#                                  APP_VERSION)
#   $2  git revision, e.g. 7b7bfef
#
# Deterministic apart from ARCHIVE-NOTES.txt naming the source revision: no dates,
# hostnames or counters are written, and the .sha256 covers the html only.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
REV="${2:-}"
[[ -n "$VERSION" && -n "$REV" ]] || { echo "usage: bash scripts/build-archive.sh <version> <git-rev>" >&2; exit 2; }

fail() { printf '\nbuild-archive: FAIL — %s\n' "$*" >&2; exit 1; }
say()  { printf '  %s\n' "$*"; }

NAME="TaskApp-${VERSION}.html"
OUT="dist/archive/${VERSION}"

echo "TaskApp archive — version ${VERSION} from ${REV}"

# ---- 1. the revision really is that release -------------------------------------------
REV_VERSION="$(git show "${REV}:VERSION" | tr -d '[:space:]')"
[[ "$REV_VERSION" == "$VERSION" ]] || fail "VERSION at ${REV} is '${REV_VERSION}', not '${VERSION}'"
git cat-file -e "${REV}:scripts/README.dist.txt" || fail "${REV} has no scripts/README.dist.txt"
say "revision: ${REV} is ${VERSION}"

mkdir -p "$OUT"
git show "${REV}:index.html" > "$OUT/$NAME"
APP_VER="$(grep -oE 'const APP_VERSION = "[^"]+"' "$OUT/$NAME" | head -1 | sed -E 's/.*"([^"]+)"/\1/')"
[[ "$APP_VER" == "$VERSION" ]] || fail "the archived html says APP_VERSION '${APP_VER:-missing}'"
say "html: $OUT/$NAME ($(wc -c < "$OUT/$NAME") bytes, APP_VERSION ${APP_VER})"

# ---- 2. that revision's buyer README, rendered for that version ----------------------
git show "${REV}:scripts/README.dist.txt" > "$OUT/.README.dist.txt.tmp"
trap 'rm -f "$OUT/.README.dist.txt.tmp"' EXIT
VERSION="$VERSION" node - "$OUT/.README.dist.txt.tmp" "$OUT/README.txt" <<'NODE'
const fs = require("fs");
const [templatePath, outPath] = process.argv.slice(2);
const version = process.env.VERSION;

let text = fs.readFileSync(templatePath, "utf8").replace(/@VERSION@/g, version);
if (text.includes("@VERSION@")) {
  console.error("build-archive: template still contains @VERSION@");
  process.exit(1);
}

// One deliberate deviation from the template as it stood at that revision. rc.2's README
// said this build "opens in Chrome, Edge, Firefox or Safari"; rc.3 only wrote down what
// was already true, namely that the product is built and tested in Chromium and that
// Firefox and Safari are untested. An archived package should not carry a claim we know
// to be wrong, so it gets the honest sentence. Nothing else is changed: in particular the
// rc.2 package does NOT gain rc.3's reproducible-export or two-tab paragraphs.
const stale = "2. Double-click it. It opens in Chrome, Edge, Firefox or Safari.";
const honest =
  "2. Double-click it. It opens in a Chromium-based browser — Chrome, Microsoft Edge, Brave,\n" +
  "   Opera or Vivaldi. Firefox and Safari are untested in this release, so use one of those.";
if (!text.includes(stale)) {
  console.error("build-archive: expected browser sentence not found in the template");
  process.exit(1);
}
fs.writeFileSync(outPath, text.replace(stale, honest));
NODE
rm -f "$OUT/.README.dist.txt.tmp"
trap - EXIT
say "readme: $OUT/README.txt (rendered from ${REV}:scripts/README.dist.txt)"

# ---- 3. checksum, in sha256sum -c format ---------------------------------------------
( cd "$OUT" && sha256sum "$NAME" > "$NAME.sha256" && sha256sum -c "$NAME.sha256" >/dev/null ) \
  || fail "the archived .sha256 does not verify"
SUM="$(cut -d' ' -f1 "$OUT/$NAME.sha256")"
say "sha256: ${SUM}"

# ---- 4. say out loud that this copy is not for sale ----------------------------------
cat > "$OUT/ARCHIVE-NOTES.txt" <<EOF
TaskApp ${VERSION} — archived, not for distribution
==================================================

This directory keeps the ${VERSION} release as it was built, for reference and for
supporting a customer who still has it. It is NOT the build on sale: dist/ (one level
up) holds the current release drop, and that is the only set of files a buyer receives.

Contents
  ${NAME}          the app at ${VERSION}, extracted from git ${REV}:index.html
  ${NAME}.sha256   its checksum (sha256sum -c format)
  README.txt                       the buyer README as it was written for this release
  ARCHIVE-NOTES.txt                this file

Provenance
  source revision:  ${REV}
  sha256:           ${SUM}

Two things a reader should know
  * README.txt is this release's own text, rendered from scripts/README.dist.txt at
    ${REV}; it does not describe anything added later. One sentence was corrected: it
    used to say the file opens in Firefox and Safari, which was never tested. This
    build, like every build so far, is built and tested in Chromium only.
  * Newer releases keep the same storage key and export format, so a ${VERSION} backup
    restores into the current build. The reverse is also true: the current build can
    open this release's data, which is why keeping the file is useful.
EOF
say "notes: $OUT/ARCHIVE-NOTES.txt"

echo
printf 'Archived %s/%s\n' "$OUT" "$NAME"
