#!/usr/bin/env bash
# Rebuild and restart ONLY the flash-tech `web` service for the 2026-11-15 audit fixes:
#   1. the header nav no longer disappears below 900px (globals.css)
#   2. the "Site under construction - content and brand are placeholders" footer line is gone
#      from /, /contact and /apps
# Fix 3 (a public phone number) is held for Jerry's number and is NOT part of this deploy.
#
# Rollback: docker tag flash-tech-web:pre-mobilenav-<TS> flash-tech-web:latest
#           docker compose up -d --no-build web
#           and, if the code should go back too, the source tarball printed below.
set -u -o pipefail
cd /home/Jerry/apps/flash-tech || exit 1

TS=${TS:-$(date -u +%Y%m%dT%H%M%SZ)}
IMG=flash-tech-web
TAG="$IMG:pre-mobilenav-$TS"

# --- 1. tag what is running now, before anything is built --------------------
# The image is the rollback. Tagging first means a failed build leaves a known-good tag to point
# at; tagging afterwards could name an image that never served traffic.
echo "=== tag $(date -u +%H:%M:%SZ) ==="
if ! docker tag "$IMG:latest" "$TAG"; then
  echo "=== ABORT: could not tag the running image; nothing was built or restarted ==="
  exit 1
fi
echo "rollback image: $TAG"

mkdir -p "$HOME/backups/flash-tech"
SRC_BACKUP="$HOME/backups/flash-tech/flash-tech-src-$TS.tar.gz"
tar czf "$SRC_BACKUP" --exclude=node_modules --exclude=.next -C "$HOME/apps" flash-tech 2>/dev/null &&
  echo "rollback source: $SRC_BACKUP"

# --- 2. unit tests before a build -------------------------------------------
echo "=== unit tests $(date -u +%H:%M:%SZ) ==="
if ! node --test web/lib/ 2>&1 | tail -8; then
  echo "=== ABORT: the unit tests failed; nothing was built or restarted ==="
  exit 1
fi

# --- 3. the disclaimer must not be in the source any more --------------------
# Cheap grep gate: the sentence is served HTML, so a copy left behind on any page is a defect.
echo "=== disclaimer grep $(date -u +%H:%M:%SZ) ==="
if grep -rn "under construction" web/app/ ; then
  echo "=== ABORT: 'under construction' still in web/app; nothing was built or restarted ==="
  exit 1
fi

# --- 4. build + restart web only --------------------------------------------
# `npm run build` inside the image runs the prebuild gates (intake honeypot, store/sitemap/og),
# so a broken gate stops the build here and the running container is left alone.
echo "=== build $(date -u +%H:%M:%SZ) ==="
if ! docker compose build web 2>&1 | tail -30; then
  echo "=== ABORT: docker compose build failed; the running container was left alone ==="
  exit 1
fi

echo "=== up $(date -u +%H:%M:%SZ) ==="
docker compose up -d web 2>&1 | tail -10
echo "=== up exit: $? ==="

# --- 5. the origin answers and serves the new CSS ---------------------------
# Loopback only: this proves the container, not the edge. The edge is verified separately with a
# browser against https://flashtech.biz.
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3401/ || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "origin / -> $code"
CSSPATH=$(curl -s http://127.0.0.1:3401/ | grep -o '/_next/static/css/[a-z0-9]*\.css' | head -1)
echo "stylesheet: $CSSPATH"
curl -s "http://127.0.0.1:3401$CSSPATH" | grep -c "nav.top" || true
echo "=== done $(date -u +%H:%M:%SZ) ==="
