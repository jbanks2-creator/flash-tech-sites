#!/usr/bin/env bash
# Rebuild and restart the flash-tech `web` service only, for the author intake form.
# Tagged rollback image: flash-tech-web:pre-intake-verify-20261112T214433Z
# Rollback source:      ~/backups/flash-tech/flash-tech-src-20261112T212644Z.tar.gz
set -u -o pipefail
cd /home/Jerry/apps/flash-tech || exit 1

# --- intake gates, before anything is built ---------------------------------
# 1. The unit tests. 2. The build gate that proves the honeypot input name is not a property name
# anywhere in the intake record (kanban t_ce133486: a trap called "website" collided with the
# record's required `website` section and silently discarded submissions).
#
# `npm run build` inside the image runs the same gate against the copy vendored into web/schema/,
# because this host has no buildx and a Dockerfile cannot see ~/businesses. That is why the gate is
# run here too, against the authoritative schema, with --require-vendored-match: it fails if the
# vendored copy and the real schema differ by a byte, so the in-image check can never be checking
# a stale file. Both checks must pass before an image is built or a container restarted.
SCHEMA=/home/Jerry/businesses/author-marketing/intake/schema.json
echo "=== tests $(date -u +%H:%M:%SZ) ==="
if ! INTAKE_SCHEMA="$SCHEMA" node --test web/lib/ 2>&1 | tail -12; then
  echo "=== ABORT: the unit tests failed; nothing was built or restarted ==="
  exit 1
fi
echo "=== honeypot gate $(date -u +%H:%M:%SZ) ==="
if ! node web/scripts/check-intake-honeypot.mjs --schema "$SCHEMA" --require-vendored-match; then
  echo "=== ABORT: the honeypot gate failed; nothing was built or restarted ==="
  exit 1
fi

echo "=== build $(date -u +%H:%M:%SZ) ==="
if ! docker compose build web 2>&1 | tail -25; then
  echo "=== ABORT: docker compose build failed; the running container was left alone ==="
  exit 1
fi
echo "=== up $(date -u +%H:%M:%SZ) ==="
docker compose up -d web 2>&1 | tail -10
echo "=== up exit: $? ==="
sleep 4
docker compose ps web
echo "=== done $(date -u +%H:%M:%SZ) ==="
