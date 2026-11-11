# TaskApp storefront — how it is built and deployed

**Page:** `/apps/taskapp` · **Repo:** `~/apps/flash-tech` · **Container:** `flash-tech-web` (port
`127.0.0.1:3401`) · **Demo:** container `taskapp-demo` in `~/apps/taskapp` (`127.0.0.1:3602`)

## Routes

| Route | What it is |
|---|---|
| `/apps/taskapp` | the store page (copy from `docs/store/product-page.md`) |
| `/apps/taskapp/changelog` | `~/apps/taskapp/CHANGELOG.md`, rendered at build |
| `/apps/taskapp/legal/eula` | EULA draft, rendered from `docs/store/eula.md` |
| `/apps/taskapp/legal/refund-policy` | refund policy |
| `/apps/taskapp/legal/support-policy` | support policy |
| `/apps/taskapp/legal/privacy-statement` | privacy statement |
| `/apps/taskapp/buy` | redirects to the provider checkout, or an honest “not connected” page |
| `/apps/taskapp/inquiry` | configured-tier inquiry form → `/api/taskapp-inquiry` |
| `/apps/taskapp/icon-*`, `*.png`, `demo.webm` | store assets, copied by the sync script |

## Content pipeline (never edit the copies)

```bash
node scripts/sync-store-content.mjs          # copy docs/assets/app version into web/
node scripts/sync-store-content.mjs --check  # prove the copies match the sources
```

Sources: `~/.hermes/hermes-org/businesses/flash-apps/docs/store/*.md`,
`…/assets/store/*`, `~/apps/taskapp/{CHANGELOG.md,VERSION}`, and `~/apps/taskapp/dist`. The
synced copies under `web/content/store/` and `web/public/apps/taskapp/` are **generated**; a
manifest records both the source and the copy checksum.

The sync script drops the drafting front-matter and the internal “delete before publishing” note,
but **keeps** `[JERRY:]` / `[ATTORNEY:]` markers: a draft must look like a draft.

## Build gate

`npm run build` runs `web/scripts/check-store.mjs` first (Dockerfile runs the same). It fails on:

* a synced file whose bytes do not match the manifest,
* `{{TOKEN}}`, `[PENDING …]`, `[JERRY:]`, `[ATTORNEY:]` anywhere in page code,
* “Lemon Squeezy or Paddle”, a `127.0.0.1` / `localhost` / `:34xx` literal in page code,
* a missing screenshot/video asset, a missing legal or changelog link,
* and, when `STORE_LIVE=1`: a support address that is not an email, a demo origin that is not
  https, a checkout URL that is not https on `lemonsqueezy.com`, or any surviving marker.

## Environment

| Variable | Test/dev now | Live |
|---|---|---|
| `STORE_LIVE` | `0` | `1` |
| `STORE_DEMO_ORIGIN` | `http://127.0.0.1:3602` | `https://demo.flashtech.biz` |
| `STORE_SUPPORT_EMAIL` | unset (page links the contact form) | Jerry's support mailbox |
| `LEMONSQUEEZY_CHECKOUT_URL` | unset (buy page says “not connected”) | **live** checkout URL |

Build-time values are baked into the page, so a change means a rebuild. `LEMONSQUEEZY_CHECKOUT_URL`
is also read per request by `/apps/taskapp/buy`, so it can be swapped at runtime as well.

## Run it

```bash
cd ~/apps/flash-tech
node scripts/sync-store-content.mjs
docker compose build web
docker compose up -d web
docker logs -f flash-tech-web
```

The dev host is loopback-only. Tunnel both ports to use the page with its live demo:

```bash
ssh -N -L 3401:127.0.0.1:3401 -L 3602:127.0.0.1:3602 Jerry@<host>
# http://localhost:3401/apps/taskapp
```

Without the 3602 tunnel the page still renders; only the demo iframe cannot reach its origin.

## The demo is a separate origin — on purpose

The demo is the shipped product file served by `taskapp-demo` (built from `dist/` by
`~/apps/taskapp/scripts/build-demo.sh`) and embedded as an iframe in `?demo=1` mode. A different
origin keeps its `localStorage` separate from `flashtech.biz`, so nothing a visitor does in the
demo can ever be read by a real install of the app later. `?demo=1` additionally keeps **all**
writes in memory, so the demo resets on reload and stores nothing at all.

The demo container deliberately sends no `X-Frame-Options` and no `frame-ancestors` (it is a
public demo); the product container keeps `X-Frame-Options: SAMEORIGIN`.

## DNS / TLS (not done — needs Jerry)

| Host | Serves | Notes |
|---|---|---|
| `flashtech.biz` | this site | DNS still points at the GoDaddy builder placeholder |
| `demo.flashtech.biz` | `taskapp-demo` | must be its own origin; CORS is irrelevant, only framing |

Both need TLS. Until then the page is test-mode and `noindex`.

## Instrumentation — none, deliberately

No third-party analytics, no tag manager, no pixels, no session recording, no external fonts or
scripts. The only cookies are the ones the merchant of record sets on **their** checkout domain.
Conversion is counted in the Lemon Squeezy dashboard.

**Do not add a tracker to this page.** It would contradict the privacy statement and the FAQ
sentence that says the app sends nothing; both are part of what the page sells.

## Verifying a change

```bash
node scripts/sync-store-content.mjs --check
cd web && node scripts/check-store.mjs
# then in a browser (or the Playwright script used on t_a8751e2f):
#   - every route 200, /buy 503 while unconfigured
#   - screenshots decode, demo frame loads, demo storage stays empty
#   - 390x844 shows no horizontal scroll
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3401/apps/taskapp
```

## Rollback

The page is additive: the only change to existing behaviour is `compose.yaml` build args and the
Dockerfile ARGs. Reverting the store commit returns the site to the two original routes. The
demo container is independent and can be stopped without touching the site.

## Known gaps

* Screenshots and the animation were captured from `1.0.0-rc.2` (media card `t_6f3a2956`); the
  shipped file is `1.0.0-rc.4`. The UI in the images is real and unchanged in the areas shown,
  but the version badge in the stills reads rc.2. Re-capture before a public launch if the badge
  matters (it is visible in the hero).
* The contact form (`/contact`, `/api/contact`) and the inquiry endpoint only log to the container;
  no mail transport exists on this box yet. That is pre-existing for `/contact`.
