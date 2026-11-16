#!/usr/bin/env bash
# Rebuild and restart ONLY the flash-tech `web` service for the 2026-11-16 housekeeping card
# (t_91a317d7), two unrelated-looking fixes that ship together:
#   1. web/app/icon.svg + web/app/favicon.ico — the site had NO icon metadata, so every first
#      load of every page requested /favicon.ico and logged a 404, and the tab was blank.
#   2. web/app/page.jsx — "Prefer to talk? Call or email…" invited a call while no phone number
#      is published. The sentence now invites email only; the commented tel: slot stays put for
#      the day Jerry names a number.
#
# Rollback: docker tag flash-tech-web:pre-housekeeping-<TS> flash-tech-web:latest
#           docker compose up -d --no-build web
#           and, if the code should go back too, the source tarball printed below.
set -u -o pipefail
cd /home/Jerry/apps/flash-tech || exit 1

TS=${TS:-$(date -u +%Y%m%dT%H%M%SZ)}
IMG=flash-tech-web
TAG="$IMG:pre-housekeeping-$TS"

# --- 1. tag what is running now, before anything is built --------------------
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

# --- 3. source gates --------------------------------------------------------
echo "=== gates $(date -u +%H:%M:%SZ) ==="
fail=0
# (a) the icon files are real and the .ico carries more than one size
for f in web/app/icon.svg web/app/favicon.ico; do
  if [ -s "$f" ]; then echo "ok: $f ($(stat -c%s "$f") B)"; else echo "MISSING: $f"; fail=1; fi
done
if file web/app/favicon.ico | grep -q '4 icons'; then
  echo "ok: favicon.ico holds 4 sizes"
else
  echo "FAIL: favicon.ico is not a 4-size ICO"; file web/app/favicon.ico; fail=1
fi
grep -q 'rel="icon"\|rel=icon' web/app/icon.svg && { echo "FAIL: icon.svg must not declare itself"; fail=1; }
# (b) the call invitation is gone from the served copy (the commented slot keeps the word
#     "Call" on purpose, so match the whole old sentence, not the word)
if grep -rn -F 'Prefer to talk? Call or email and you will get Jerry' web/app/; then
  echo "FAIL: the call invitation is still in the served copy"; fail=1
else
  echo "ok: 'Prefer to talk? Call or email…' is no longer served"
fi
# (c) no phone number was quietly invented: the only `href="tel:` in the source is the comment
#     slot kept for the day a number exists, never a rendered link
if grep -rn 'href="tel:' web/app/ | grep -v 'Prefer to talk?' ; then
  echo "FAIL: a tel: link appeared in the rendered source"; fail=1
else
  echo "ok: no rendered tel: link (the slot stays commented)"
fi
[ "$fail" = 0 ] || { echo "=== ABORT: a source gate failed; nothing was built or restarted ==="; exit 1; }

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

# --- 5. the origin answers, and now serves both icons -----------------------
# Loopback only: this proves the container, not the edge. The edge is verified separately with a
# browser against https://flashtech.biz.
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3401/ || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "origin / -> $code"
for p in /favicon.ico /icon.svg; do
  printf 'origin %-14s ' "$p"
  curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' "http://127.0.0.1:3401$p"
done
echo "--- head icon links on / ---"
curl -s http://127.0.0.1:3401/ | grep -o '<link[^>]*icon[^>]*>' || echo "(none)"
echo "=== done $(date -u +%H:%M:%SZ) ==="
