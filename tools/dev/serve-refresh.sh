#!/usr/bin/env bash
# Re-serve index.html after an edit.
#
# index.html is bind-mounted as a SINGLE FILE. An editor (or any tool) that writes a new
# inode leaves the container serving the old bytes — the mount pins the inode, not the path.
# A plain `docker compose restart` does not fix it; the container has to be recreated.
# Neither compose file publishes a port on its own: the loopback port lives in the dev
# override, so both files are always passed together.
set -euo pipefail
cd "$(dirname "$0")/../.."
docker compose -f compose.yaml -f compose.dev.yaml up -d --force-recreate web >/dev/null
for _ in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3601/ || true)" = "200" ]; then
    echo "serving $(sha256sum index.html | cut -c1-12) on http://127.0.0.1:3601/"
    exit 0
  fi
  sleep 0.25
done
echo "server did not come up" >&2
docker compose -f compose.yaml -f compose.dev.yaml logs --tail 20 web >&2
exit 1
