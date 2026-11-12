#!/usr/bin/env bash
# Rebuild and restart the flash-tech `web` service only, for the author intake form.
# Tagged rollback image: flash-tech-web:pre-intake-verify-20261112T214433Z
# Rollback source:      ~/backups/flash-tech/flash-tech-src-20261112T212644Z.tar.gz
set -u -o pipefail
cd /home/Jerry/apps/flash-tech || exit 1
echo "=== build $(date -u +%H:%M:%SZ) ==="
docker compose build web 2>&1 | tail -25
echo "=== build exit: $? ==="
echo "=== up $(date -u +%H:%M:%SZ) ==="
docker compose up -d web 2>&1 | tail -10
echo "=== up exit: $? ==="
sleep 4
docker compose ps web
echo "=== done $(date -u +%H:%M:%SZ) ==="
