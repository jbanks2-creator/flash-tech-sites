# Flash Tech website — deploy notes

**Repo:** `~/apps/flash-tech` · **Stack:** Next.js 15 (standalone output), plain CSS · **Container:** `flash-tech-web`

## Run it

```bash
cd ~/apps/flash-tech
docker compose up -d --build
```

Dashboard view (dev only, bound to loopback):

```bash
ssh -N -L 3401:127.0.0.1:3401 Jerry@179.197.91.218
# then open http://localhost:3401
```

Stop / rebuild:

```bash
docker compose down
docker compose up -d --build --force-recreate
docker logs -f flash-tech-web
```

## Ports

- Host `127.0.0.1:3401` → container `3000`
- Chosen to avoid `flash-tech-ai`'s reserved block (3101/5501 senior-sitter, 3201/5502 cleaner-finder, 3301/5503 next). **Never publish on a public port** — DNS and TLS come later via Traefik (plan card F5).

## Deviations from PLATFORM.md

1. **No database yet.** A landing page does not need Postgres. When the contact form and content become dynamic, add `postgis/postgis:16` with `mem_limit: 384m` and a `flash-tech_pgdata` volume.
2. **No Tailwind.** Plain CSS in `app/globals.css` with custom properties. Fewer build dependencies for v1; Tailwind can be added without changing the markup contract.
3. **No backup script.** Nothing stateful to back up until the DB exists.

## The contact form: delivery is configuration, and an unconfigured form refuses

`/api/contact` is the site's only call to action — it appears on `/`, `/contact` and the
(unpublished) `/hermes-department` offer page.

**Until 2026-11-17 it was a stub**: it validated name + email, wrote the whole submission to the
container log and answered `{ok:true}`. No mail, no storage, no queue. Every visitor was told their
message had arrived; nothing had. Card `t_9c2fc2ff`, fixed in the commit named in `registry.yaml`.

What it does now — the only success is a real one:

| Status | When | What the visitor sees |
|---|---|---|
| `200 {ok:true, received:true}` | the provider accepted the message | "your message is on its way to Jerry" |
| `400` | malformed body, missing/invalid name, email or an over-cap field | the field named, "nothing was sent" |
| `429` | over `CONTACT_RATE_LIMIT` in `CONTACT_RATE_WINDOW_SECONDS` from one client | retry time + the email address |
| `502` | the provider refused or could not be reached | "it was not sent" + the email address |
| `503` | **delivery is not configured on this deployment** | "email support@flashtech.biz" |

`GET /api/contact` answers `{ready, email}`. The page uses it to decide whether to render the form
at all: with delivery unconfigured, every page renders an **email link** instead of a form, so
nothing on the page promises something the server would refuse. The mailto block is also what the
server-rendered HTML contains, so the pages stay statically generated (`scripts/check-store.mjs
--built` fails if `/`, `/contact` or `/apps` lose their rendered HTML) and a reader without
JavaScript always has a working path.

### Turning delivery on (Jerry's credential, one provider)

The provider is a value, not code: `CONTACT_PROVIDER=resend | postmark | smtp`. Put the names in
`.env` (chmod 600, git-ignored — `.env.example` lists every one), then `docker compose up -d web`.
No rebuild: the route reads the config per request.

| Provider | Needs | DNS |
|---|---|---|
| `resend` | `CONTACT_API_KEY` (`re_…`) | the domain must be verified in Resend: a DKIM TXT record and an SPF include on `flashtech.biz` |
| `postmark` | `CONTACT_API_KEY` (server token) | a DKIM TXT record on the domain / sender signature |
| `smtp` | `CONTACT_SMTP_HOST`, `_PORT`, `_USER`, `_PASS` | none, but an app password from a mailbox; weakest deliverability for a business inbox |

`CONTACT_FROM` must be an address on the verified domain (e.g. `Flash Tech website
<website@flashtech.biz>`), and `CONTACT_TO` defaults to `support@flashtech.biz`. The submitter's
address is carried as `Reply-To`, never as `From`.

Two addresses, two jobs:

| Variable | Default | What it is |
|---|---|---|
| `CONTACT_TO` | `support@flashtech.biz` | where a delivered message goes |
| `CONTACT_FALLBACK_EMAIL` | `TheWiz@FlashTech.Biz` | what the page tells a visitor to write to when the form cannot send |

The fallback is the address the site's own copy already publishes on `/`, `/contact` and the offer
page (a page that says "write to TheWiz@" and then offers a button saying "email support@" reads
like a bug). Both are live Cloudflare Email Routing routes forwarding to the same Gmail — see the
`flashtech.biz` line in `~/hermes-org/registry.yaml`. Set `CONTACT_FALLBACK_EMAIL` to unify them.

### Startup tells the truth before a visitor does

`web/scripts/report-contact-delivery.mjs` runs from the image's `CMD` before `node server.js` and
logs one line — no credential, no config dump:

```
{"kind":"contact-delivery-config","outcome":"disabled","severity":"info","provider":"none",
 "to":"support@flashtech.biz","reason":"no-provider", ...}
```

- `outcome:"ready"` — the form sends.
- `outcome:"disabled"`, `reason:"no-provider"` — **the expected pre-launch state**: the CTA is the
  email link and POST answers 503 naming it. Nothing is lost, nothing lies.
- `outcome:"misconfigured"`, `severity:"critical"` — a provider is selected but its key is missing
  (or `CONTACT_FROM`/`CONTACT_TO` is unusable). Someone meant mail to work. It still refuses
  honestly; the process does not exit, because taking the front door down is worse than serving a
  mailto link.

### Spam control

A honeypot (`hp_website`, per the rule in `lib/contact-fields.mjs`) checked before validation, and a
per-client sliding window (`CONTACT_RATE_LIMIT`, default 5 per 15 minutes) keyed on
`CF-Connecting-IP` with `X-Forwarded-For` as the fallback. A filled trap gets `200 {ok:true}` and no
mail; the log line carries `outcome:"discarded"`, `sent:false`, which no delivered message has.

### The submission log

One JSON line per submission: `outcome` (`sent` / `refused` / `discarded` / `rate-limited` /
`unconfigured` / `failed`), `provider`, the provider's message id, a 12-hex hash of the client IP and
which header supplied it. **No name, no email address, no phone, no message body.** The stub logged
all of it.

### Verifying delivery end to end

1. `docker logs flash-tech-web | head -3` → the `contact-delivery-config` line says `ready`.
2. Fill the form on `https://flashtech.biz/contact` in a browser (not curl — the honeypot and the
   readiness fetch are part of the path).
3. `docker logs flash-tech-web | grep '"kind":"contact"' | tail -1` → `outcome:"sent"` with a
   `message_id` and `ip_source:"cf-connecting-ip"`.
4. The message is in the `support@flashtech.biz` inbox with name, address and message intact, and
   **Reply** goes to the submitter.

## Known gaps

- No analytics.
- Brand palette is a placeholder (navy/electric blue) pending a real brand file.
- `The Wiz` section is a teaser; character art does not exist.

## Tab icon: /icon.svg and /favicon.ico

The site had no icon metadata at all until 2026-11-16 (card `t_91a317d7`), so every first load of
every page probed `/favicon.ico`, got a 404, and logged a console error; the tab was blank.

Both files are the header logo's own "F" mark — `.logo .mark` in `app/globals.css`: a rounded
square, `linear-gradient(140deg, #2563eb, #7c3aed)`, white 800-weight F. No new artwork.

| File | Serves | Notes |
|---|---|---|
| `web/app/icon.svg` | `/icon.svg` | Hand-written; the F is a `<path>`, so no font is needed to render it. |
| `web/app/favicon.ico` | `/favicon.ico` | 16/32/48/64 px, 32bpp BMP-in-ICO. Generated by `scripts/make-favicon.py` — stdlib only, because this host has no ImageMagick and no pip. |

Next.js emits both as `<link rel="icon">` from the file convention, so no `metadata.icons` entry is
needed. Measured 2026-11-16 with a fresh Chrome 158 profile and a net-log: the browser requests
`/icon.svg?<hash>` (200, `image/svg+xml`) and never probes `/favicon.ico`; both URLs answer 200 on
`/`, `/contact` and `/apps`. A control page with no declared icon does probe `/favicon.ico`, which
is how that defect looked before the fix. `/apps/taskapp` keeps its own `/apps/taskapp/icon.svg`
and `icon-32.png` and additionally inherits the root `/favicon.ico` link.

Regenerate the `.ico` only if the mark changes: `python3 scripts/make-favicon.py` (the SVG must
be edited by hand to match — the geometry constants are the same numbers in both).

## Social share images: /og/*.png

Every public page carries an `og:image` and a `twitter:image` (added 2026-11-12, card
`t_dc397fef`; until then only the store page had one, so every other link unfurled as bare text).

| Page | Image | Source |
|---|---|---|
| `/` | `/og/home.png` | composed |
| `/contact` | `/og/contact.png` | composed |
| `/apps` | `/og/apps.png` | composed |
| `/startups` | `/og/startups.png` | composed |
| `/startups/authors` | `/og/startups-authors.png` | composed |
| `/apps/taskapp` | `/apps/taskapp/og-image.png` | the store's own card, synced from flash-apps assets |

The composed five are generated, not hand-drawn: `bash scripts/make-og-images.sh` builds each
1200×630 card from the site's palette (`web/app/globals.css`) plus the TaskApp board screenshot
already in `~/.hermes/hermes-org/businesses/flash-apps/assets/store/hero-board-dark.png`, scaled
to the canvas width and bled off the bottom edge. Text is the page name and "Flash Tech" only.
ffmpeg does the compositing because this host has neither ImageMagick nor pip. Re-run the script
after a palette or screenshot change; the PNGs under `web/public/og/` are committed so a build
never depends on ffmpeg being present.

Each page names its image via `openGraph.images` + `twitter:images`, and `metadataBase` in
`app/layout.jsx` is what makes the URL absolute. `check-store.mjs --built` fails the build if any
public route has no `og:image`, if the URL is not absolute on `https://flashtech.biz`, if the file
it names is missing from `web/public`, or if it is not 1200×630.

## Crawler files: /robots.txt and /sitemap.xml

Both are Next.js metadata routes, so they are generated and cannot drift from the route list:

| File | What it says |
|---|---|
| `web/lib/site.mjs` | The public origin plus the one `PUBLIC_ROUTES` list both routes read. |
| `web/app/sitemap.js` | The six public routes (`/`, `/apps`, `/apps/taskapp`, `/startups`, `/startups/authors`, `/contact`) with `lastmod` from each page's last source change. |
| `web/app/robots.js` | `User-agent: *`, `Allow: /`, `Disallow: /api/` (form handlers), `Disallow: /apps/taskapp/buy` (checkout redirect), `Sitemap: https://flashtech.biz/sitemap.xml`. |

`web/scripts/check-store.mjs --built` (run by `docker compose build`) asserts the generated bodies:
both files exist, the robots directives are present, the sitemap contains exactly those six
`<loc>` values, and neither file carries a dev host/port or an unfilled `{{TOKEN}}`. Deleting a
metadata route therefore fails the build instead of silently shipping a 404 sitemap. The gate
pins its own copy of the route list (`PUBLIC_PATHS`) and compares it to `PUBLIC_ROUTES`, so a page
cannot be added to one and forgotten in the other.

## The apps index: /apps

`web/app/apps/page.jsx` — one heading, one paragraph and one card linking `/apps/taskapp`, on the
site's shared shell (unlike `/apps/taskapp`, which has its own store stylesheet). It exists
because `/apps` was a 404 while `/apps/taskapp` was live and indexable, so anyone who trimmed the
URL hit a dead end. `/apps/` is a single 308 to `/apps` (Next's `trailingSlash: false`; at the
edge Cloudflare answers the same redirect and it now lands on a real page).

**What Cloudflare does to them (measured 2026-11-12):** the zone used to answer `/robots.txt`
with 200 and Cloudflare's content-signals comment block even though the container 404'd it. Once
the origin serves a real file, the edge serves **our file byte-for-byte** (111 B, identical for a
Googlebot User-Agent, `cf-cache-status: EXPIRED`) — Cloudflare does not merge its block into an
origin `robots.txt`, it only substitutes one when the origin has none. Two consequences:

1. The Cloudflare content-signals comment block is **no longer served**. It was comment-only (no
   effect on crawling), but it is a rights statement; restoring it means either pasting it into
   `app/robots.js` or flipping the zone's content-signals setting — Jerry's call.
2. The edge caches `robots.txt` for 4 hours (`cache-control: public, max-age=14400`), so an edit
   to the file can take up to that long to appear at `https://flashtech.biz/robots.txt`. Purge the
   URL in the dashboard when that matters.

Cloudflare's bot protection answers the literal `python-urllib` User-Agent with **403 and a
`text/plain` body reading `error code: 1010`** — that is Cloudflare, not this app, and it is not
JSON, so a script that only parses JSON will look like it "got nothing". `curl`'s own default UA is
allowed today, but pin a browser-like one in anything you keep:

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
curl -sS -A "$UA" https://flashtech.biz/startups/authors/intake -o /dev/null -w '%{http_code}\n'
```

Measured 2026-11-12: `-A 'Python-urllib/3.11'` → `403 error code: 1010`; empty UA → reaches the
app; `curl/8.x` → reaches the app.

## The author intake form: /startups/authors/intake

The Starter Kit questionnaire for The Author's Candle. One author at a time, sent as a link by the
owner — **not** a marketing page:

- `web/app/startups/authors/intake/page.jsx` + `IntakeForm.jsx` — nine sections, all questions from
  `~/businesses/author-marketing/intake/questionnaire.html`. `robots: noindex, nofollow`, and the
  route is deliberately absent from `PUBLIC_ROUTES`, so `/sitemap.xml` cannot advertise it.
- `web/app/api/authors-intake/route.js` — `POST` handler. Reads only the answer fields listed in
  `web/lib/intake-fields.mjs` (`LIMITS`); **no IP, user-agent, referrer or headers are stored or
  logged**. The honeypot input is named `hp_website` (visually hidden, off the tab order, labelled
  "Leave this empty"); a bot that fills it gets `200 {"ok":true}` and nothing is written, and the
  server log records `kind:"authors-intake-honeypot", outcome:"discarded", stored:false` — never
  confusable with a stored submission (`outcome:"stored", stored:true, job_id:…`).
  Per-field caps: 200 chars on short answers, 4,000 on prose, 512 KB per request. There is no rate
  limit (by design) — the caps are what stop the disk filling.
- Each accepted submission is validated with AJV against
  `~/businesses/author-marketing/intake/schema.json`, **mounted read-only** at
  `/app/schema/intake-starter-v1.json` (`INTAKE_SCHEMA`), then written as one JSON file named
  `<job_id>.json` into `~/businesses/author-marketing/inquiries/intake/`
  (`AUTHORS_INBOX=/data/author-inquiries`). A refused submission names the exact fields and writes
  nothing. Records set `meta.is_sample=false`, `meta.package="starter"`,
  `meta.intake_version="starter-v2"` (`SCHEMA_ID`/`INTAKE_VERSION` in `web/lib/intake-fields.mjs`).
- `job_id` is the author's public name as a slug plus a 5-character random suffix
  (`erick-williams-4k2p9`), so a file cannot land on top of another.

**The cover image and voice-over line are collected (schema v2, cards `t_7487852d` + `t_87bb5c11`).**
Section 4 ends with an explicitly optional block: `cover_file`, `cover_url`, `cover_permission`,
`vo_line`, `vo_approved_by`, `vo_approved_date` — all six inside `book`, none of them required. The
form posts them exactly as the schema names them (`LIMITS` in `web/lib/intake-fields.mjs` is the one
list the browser form and the route share). A weak cover, a URL with no file, a line nobody approved
or a line over 25 words are `needs_human` entries in `qa/validation.json` — never a refusal, because
refusing would cost the author's other thirty answers over an attachment.

`INTAKE_COVER_VO=on` (compose.yaml → `COVER_VO_ENABLED`) decides whether `buildIntake()` writes those
six answers at all. The page reads the same flag per request and passes it to the form as `coverVo`,
which is why `app/startups/authors/intake/page.jsx` is `force-dynamic`: a `process.env` read inside a
client component is resolved at **build** time, so a prerendered page would show the block while the
route dropped the answers. Turning the flag off hides the block and omits the fields together.

**Schema changes are deliberate.** The schema is read from the host file at container start, so an
edit to `intake/schema.json` takes effect on `docker compose up -d web` — no rebuild. The route logs
`authors-intake-schema-version-mismatch` when the mounted `$id` is not the `SCHEMA_ID` in
`web/lib/intake-fields.mjs` (currently `intake-starter-v2` / `starter-v2`). Never add an input for a
field the schema does not declare — `additionalProperties: false` means the submission would be
refused and the author's answers lost; and never leave a rendered input out of `buildIntake()`, which
would drop the answer just as quietly.

**The honeypot name is a build gate, not a review note.** It used to be `website`, and `website` is
the record's own required top-level section — so any body shaped like the record (a migration, an
admin re-post, a client generated from the schema) tripped the trap and was answered
`200 {"ok":true}` and discarded silently (found in production 2026-11-12, card `t_ce133486`). Three
things now prevent it, and none of them is a person remembering:

1. `web/lib/intake-fields.test.mjs` — `npm test`. Fails when the trap name is a property name
   anywhere in the schema, and re-tests the incident body (`{website:{has_website:false}}`) as a
   named regression.
2. `web/scripts/check-intake-honeypot.mjs` — runs from `npm run build` (`prebuild`), so a colliding
   image cannot be built. It reads the copy vendored at `web/schema/intake-starter-v1.json`, because
   `web/` is the Docker build context and this host has no buildx (a Dockerfile cannot mount
   `~/businesses`). Refresh it with `node web/scripts/vendor-intake-schema.mjs` whenever the schema
   changes; `scripts/deploy-intake.sh` re-runs the gate against the authoritative schema with
   `--require-vendored-match` and aborts if the two files differ, so the in-image check can never be
   checking a stale copy.
3. `route.js` `getValidator()` — refuses every submission with a 500 and a
   `authors-intake-honeypot-collision` error line if a mounted schema ever collides again. Loud and
   broken beats silent and empty.

Deploy with `bash scripts/deploy-intake.sh`: it runs the tests, the gate, the build and `up -d web`
in that order, and stops before building if either check fails.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://flashtech.biz/startups/authors/intake   # 200
curl -s https://flashtech.biz/sitemap.xml | grep -c intake                               # 0
```

Prove both POST paths (a browser-like UA is required — see the Cloudflare note above; the second
command must answer `4xx` naming the missing field and write no file):

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
INBOX=~/businesses/author-marketing/inquiries/intake

# valid: expect 200 with a job_id, and exactly one new file in $INBOX
curl -sS -X POST https://flashtech.biz/api/authors-intake -H 'content-type: application/json' \
     -A "$UA" --data-binary @payload.json

# invalid: drop one required answer; expect 400 naming it, and no new file
# (checkAnswers refuses before anything is written)

# the trap: expect 200 {"ok":true}, NO job_id, no file, and a `outcome:"discarded"` line in
#            `docker logs flash-tech-web`
curl -sS -X POST https://flashtech.biz/api/authors-intake -H 'content-type: application/json' \
     -A "$UA" -d '{"hp_website":"http://spam.example"}'

# the incident body: a record-shaped submission must no longer be swallowed — expect 400 naming
# the missing flat answers, never a bare 200
curl -sS -X POST https://flashtech.biz/api/authors-intake -H 'content-type: application/json' \
     -A "$UA" -d '{"website":{"has_website":false}}'
```

**Measured at the edge (2026-11-12):** the zone's email obfuscation rewrites the `mailto:` links in
this page's HTML to `/cdn-cgi/l/email-protection` with a `[email protected]` placeholder, and the
edge's own script decodes them in the browser (a visitor sees `support@flashtech.biz` and a working
link; a no-JS reader sees `[email protected]`). That is a zone setting, not something this repo
controls — don't "fix" it by changing the copy, and don't read the placeholder in `curl` output as a
broken link.

## TaskApp storefront

`/apps/taskapp` is documented separately in [`STORE-DEPLOY.md`](STORE-DEPLOY.md): routes, the
content sync and build gate, environment variables, the separate-origin demo container, and the
**no analytics** rule that applies to that page.
