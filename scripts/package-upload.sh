#!/usr/bin/env bash
# Package the release for the Lemon Squeezy product upload.
#
#   bash scripts/package-upload.sh
#
# Produces dist/TaskApp-<version>.zip containing exactly the three files a buyer receives:
#   TaskApp-<version>.html, TaskApp-<version>.html.sha256, README.txt
# and prints the checksum of the zip itself, so the file uploaded to the checkout can be
# identified later. Upload this zip as the product file (see
# businesses/flash-apps/docs/store/lemon-squeezy-setup.md).
#
# Uses Python's stdlib zipfile rather than the `zip` binary (not installed on this host) and
# fixes the entry timestamps, so two runs over the same release produce the same bytes.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
NAME="TaskApp-${VERSION}"
DIST="dist"

fail() { printf 'package-upload: FAIL — %s\n' "$*" >&2; exit 1; }

for f in "${NAME}.html" "${NAME}.html.sha256" README.txt; do
  [[ -f "${DIST}/${f}" ]] || fail "missing ${DIST}/${f} — run: bash scripts/build.sh"
done
( cd "$DIST" && sha256sum -c "${NAME}.html.sha256" >/dev/null ) || fail "the release .sha256 does not verify"

python3 - "$DIST" "$NAME" <<'PY'
import sys, zipfile
from pathlib import Path
dist, name = Path(sys.argv[1]), sys.argv[2]
out = dist / f"{name}.zip"
files = [f"{name}.html", f"{name}.html.sha256", "README.txt"]
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for f in files:
        info = zipfile.ZipInfo(f, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, (dist / f).read_bytes())
with zipfile.ZipFile(out) as z:
    bad = z.testzip()
    assert bad is None, f"corrupt entry: {bad}"
    assert z.namelist() == files, z.namelist()
PY

printf 'package-upload: %s (%s bytes)\n' "${DIST}/${NAME}.zip" "$(wc -c < "${DIST}/${NAME}.zip")"
printf 'package-upload: sha256 %s\n' "$(sha256sum "${DIST}/${NAME}.zip" | cut -d' ' -f1)"
printf 'package-upload: contains %s\n' "$(python3 -c 'import sys,zipfile;print(" ".join(zipfile.ZipFile(sys.argv[1]).namelist()))' "${DIST}/${NAME}.zip")"
