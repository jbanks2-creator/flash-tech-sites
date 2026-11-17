#!/usr/bin/env bash
# Deploy the contact-form honesty fix (card t_9c2fc2ff) to the live site, in one commit's worth of
# change, with a rollback that has been rehearsed before the fact.
#
# What ships: /api/contact no longer answers {ok:true} for a message nothing received. With no mail
# provider configured (the state today, because the credential is Jerry's) the CTA renders as a
# mailto link to the address the site already publishes, POST refuses with a 503 that names it,
# and the container logs one contact-delivery-config line at startup saying exactly that.
#
# Rollback (image + source, both printed below):
#   docker tag flash-tech-web:pre-contact-<TS> flash-tech-web:latest
#   docker compose up -d --no-build web
#   tar xzf ~/backups/flash-tech/flash-tech-src-<TS>.tar.gz -C ~/apps
set -u -o pipefail
cd /home/Jerry/apps/flash-tech || exit 1

TS=${TS:-$(date -u +%Y%m%dT%H%M%SZ)}
IMG=flash-tech-web
TAG="$IMG:pre-contact-$TS"

# --- 1. capture what is running now ---------------------------------------
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

# --- 2. unit tests ---------------------------------------------------------
echo "=== unit tests $(date -u +%H:%M:%SZ) ==="
if ! node --test web/lib/ 2>&1 | tail -6; then
  echo "=== ABORT: the unit tests failed; nothing was built or restarted ==="
  exit 1
fi

# --- 3. source gates ------------------------------------------------------
echo "=== gates $(date -u +%H:%M:%SZ) ==="
if ! node web/scripts/check-contact-form.mjs; then
  echo "=== ABORT: the contact-form gate failed ==="
  exit 1
fi
# The served copy must not promise a call (no number is published) — same rule as t_91a317d7.
if grep -rn -F 'Prefer to talk? Call or email' web/app/; then
  echo "=== ABORT: the call invitation is back in the served copy ==="
  exit 1
fi

# --- 4. build + restart only the web service ------------------------------
echo "=== build $(date -u +%H:%M:%SZ) ==="
if ! docker compose build web 2>&1 | tail -6; then
  echo "=== ABORT: the build failed; the running container was not touched ==="
  exit 1
fi

echo "=== up -d web $(date -u +%H:%M:%SZ) ==="
if ! docker compose up -d --no-build web 2>&1 | tail -3; then
  echo "=== ABORT: the container did not come up; roll back with the tag above ==="
  exit 1
fi

# --- 5. prove the new behaviour on the origin ----------------------------
echo "=== verify $(date -u +%H:%M:%SZ) ==="
for _ in $(seq 1 30); do
  curl -s -o /dev/null -w '' http://127.0.0.1:3401/api/contact && break
  sleep 1
done

fail=0
status=$(curl -s http://127.0.0.1:3401/api/contact)
echo "GET /api/contact -> $status"
grep -q '"ready":false' <<<"$status" || { echo "FAIL: the route claims delivery is ready with no provider"; fail=1; }

code=$(curl -s -o /tmp/contact-deploy.json -w '%{http_code}' -X POST http://127.0.0.1:3401/api/contact \
  -H 'content-type: application/json' -d '{"name":"Deploy probe","email":"probe@flashtech.biz","message":"verifying the 503 path"}')
echo "POST /api/contact -> HTTP $code $(cat /tmp/contact-deploy.json)"
[ "$code" = "503" ] || { echo "FAIL: a submission without delivery did not refuse (HTTP $code)"; fail=1; }
grep -q 'ok":false' /tmp/contact-deploy.json || { echo "FAIL: the refusal does not say ok:false"; fail=1; }

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3401/api/contact \
  -H 'content-type: application/json' -d '{"name":"Deploy probe"}')
echo "POST malformed -> HTTP $code"
[ "$code" = "400" ] || { echo "FAIL: a malformed submission is not a 400"; fail=1; }

# The rendered page must carry the mailto CTA, not a form that cannot send.
page=$(curl -s http://127.0.0.1:3401/contact)
grep -q 'mailto:' <<<"$page" || { echo "FAIL: /contact has no mailto CTA"; fail=1; }
grep -q 'Email ' <<<"$page" || { echo "FAIL: /contact does not name the address in the CTA"; fail=1; }

# The startup line, and no credential anywhere in the logs.
docker logs flash-tech-web 2>&1 | grep -m1 'contact-delivery-config' || { echo "FAIL: no startup delivery line"; fail=1; }

if [ "$fail" != "0" ]; then
  echo "=== DEPLOY VERIFY FAILED — roll back: docker tag $TAG flash-tech-web:latest && docker compose up -d --no-build web ==="
  exit 1
fi
echo "=== OK $(date -u +%H:%M:%SZ) — live behaviour verified on 127.0.0.1:3401 ==="
