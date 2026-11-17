#!/usr/bin/env bash
# Prove the two defects are gone, against the running container (origin, not the CDN edge).
#
#   bash scripts/verify-ogapps.sh                       # origin on 127.0.0.1:3401
#   BASE=https://flashtech.biz bash scripts/verify-ogapps.sh   # through Cloudflare
#
# Checks: /apps renders with the right shell, metadata and card link; /apps/ redirects straight
# to /apps; every public page carries an absolute og:image + twitter:image that returns 200
# image/*; /sitemap.xml names /apps; and the store page is still in its pre-sale state.
set -u -o pipefail
BASE=${BASE:-http://127.0.0.1:3401}
ORIGIN=${ORIGIN:-https://flashtech.biz}
H=(-H "Host: flashtech.biz" -m 20 -sS)
FAILS=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1 ($3)"; else fail "$1 — expected $3, got $2"; fi; }

status() { curl "${H[@]}" -o /dev/null -w '%{http_code}' "$BASE$1"; }

echo "== /apps =="
check "GET /apps" "$(status /apps)" 200
REDIR=$(curl "${H[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/apps/")
check "GET /apps/ redirect code" "${REDIR%% *}" 308
# The Location may be relative (/apps, Cloudflare's own 308) or absolute
# (http://127.0.0.1:3401/apps when the container is asked directly without a proxy prefix);
# what matters is that it is the /apps path and the chain is exactly one hop.
LOC_PATH=$(printf '%s' "${REDIR#* }" | sed 's|^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]*||')
check "GET /apps/ Location path" "${LOC_PATH:-<none>}" "/apps"
check "GET /apps/ hops" "$(curl "${H[@]}" -L -o /dev/null -w '%{num_redirects}' "$BASE/apps/")" 1
check "GET /apps (following /apps/)" "$(curl "${H[@]}" -L -o /dev/null -w '%{http_code}' "$BASE/apps/")" 200

APPS_HTML=$(curl "${H[@]}" "$BASE/apps")
check "/apps h1 count" "$(printf '%s' "$APPS_HTML" | grep -o '<h1' | wc -l | tr -d ' ')" 1
printf '%s' "$APPS_HTML" | grep -q '<title>Apps — Flash Tech</title>' \
  && pass "/apps title" || fail "/apps title missing"
printf '%s' "$APPS_HTML" | grep -q 'name="description"' \
  && pass "/apps has a description" || fail "/apps has no description"
printf '%s' "$APPS_HTML" | grep -q 'rel="canonical" href="https://flashtech.biz/apps"' \
  && pass "/apps canonical is absolute" || fail "/apps canonical missing or not absolute"
printf '%s' "$APPS_HTML" | grep -q 'href="/apps/taskapp"' \
  && pass "/apps links the TaskApp card" || fail "/apps does not link /apps/taskapp"
printf '%s' "$APPS_HTML" | grep -q 'class="site"' \
  && pass "/apps uses the shared site shell" || fail "/apps shell missing"

echo
echo "== og:image on every public page =="
# route -> expected image path
for pair in "/:/og/home.png" "/apps:/og/apps.png" "/apps/taskapp:/apps/taskapp/og-image.png" \
            "/contact:/og/contact.png" "/startups:/og/startups.png" \
            "/startups/authors:/og/startups-authors.png"; do
  ROUTE=${pair%%:*}; IMG=${pair#*:}
  WANT="$ORIGIN$IMG"
  HTML=$(curl "${H[@]}" "$BASE$ROUTE")
  OG=$(printf '%s' "$HTML" | grep -o '<meta property="og:image" content="[^"]*"' | head -1 | sed 's/.*content="//;s/"$//')
  TW=$(printf '%s' "$HTML" | grep -o '<meta name="twitter:image" content="[^"]*"' | head -1 | sed 's/.*content="//;s/"$//')
  check "$ROUTE og:image" "${OG:-<none>}" "$WANT"
  check "$ROUTE twitter:image" "${TW:-<none>}" "$WANT"
  printf '%s' "$HTML" | grep -q 'property="og:url"' && pass "$ROUTE og:url" || fail "$ROUTE og:url missing"
  printf '%s' "$HTML" | grep -q 'rel="canonical"' && pass "$ROUTE canonical" || fail "$ROUTE canonical missing"
  # The image itself: 200, an image content type, and the same byte count as the file on disk.
  HDRS=$(curl "${H[@]}" -o /dev/null -w '%{http_code} %{content_type} %{size_download}' "$BASE$IMG")
  check "$ROUTE image fetch" "${HDRS%% *}" 200
  case "${HDRS#* }" in
    image/*) pass "$ROUTE image content-type (${HDRS#* })" ;;
    *) fail "$ROUTE image content-type is not image/* (${HDRS#* })" ;;
  esac
  LOCAL="web/public$IMG"
  if [ -f "$LOCAL" ]; then
    check "$ROUTE image bytes served" "${HDRS##* }" "$(wc -c < "$LOCAL" | tr -d ' ')"
  fi
done

echo
echo "== sitemap + robots =="
SM=$(curl "${H[@]}" "$BASE/sitemap.xml")
printf '%s' "$SM" | grep -q '<loc>https://flashtech.biz/apps</loc>' \
  && pass "/sitemap.xml lists /apps" || fail "/sitemap.xml does not list /apps"
check "/sitemap.xml <url> count" "$(printf '%s' "$SM" | grep -c '<loc>')" 6
printf '%s' "$SM" | grep -q 'localhost\|127\.0\.0\.1' && fail "/sitemap.xml leaks a dev host" || pass "/sitemap.xml has no dev host"

echo
echo "== store page unchanged (pre-sale) =="
STORE=$(curl "${H[@]}" "$BASE/apps/taskapp")
printf '%s' "$STORE" | grep -q 'Not on sale yet' && pass "store still shows 'Not on sale yet'" || fail "store buy chip changed"
printf '%s' "$STORE" | grep -q 'href="/apps/taskapp/buy"' && fail "store links the checkout while pre-sale" || pass "store offers no checkout link"

echo
if [ "$FAILS" -eq 0 ]; then echo "ALL CHECKS PASSED ($BASE)"; else echo "$FAILS CHECK(S) FAILED ($BASE)"; exit 1; fi
