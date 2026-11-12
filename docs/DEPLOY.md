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

## The contact form is a stub

`/api/contact` validates name + email and **logs the payload to the container stdout**. It sends no mail.

To make it live (after MX/SPF/DKIM exist on flashtech.biz):
- Postmark or Resend server token in `.env` (chmod 600, git-ignored)
- Send to `TheWiz@FlashTech.Biz` with the submitter as reply-to
- Add rate limiting and a honeypot before it is public

## Known gaps

- No analytics, no favicon, no OG image (no `og:image` on any page, home included — a copy and
  asset decision, still open).
- Brand palette is a placeholder (navy/electric blue) pending a real brand file.
- `The Wiz` section is a teaser; character art does not exist.
- `/` and `/contact` carry no `rel="canonical"` (the store and startups pages do). Pre-existing,
  not yet fixed.

## Crawler files: /robots.txt and /sitemap.xml

Both are Next.js metadata routes, so they are generated and cannot drift from the route list:

| File | What it says |
|---|---|
| `web/lib/site.mjs` | The public origin plus the one `PUBLIC_ROUTES` list both routes read. |
| `web/app/sitemap.js` | The five public routes (`/`, `/apps/taskapp`, `/startups`, `/startups/authors`, `/contact`) with `lastmod` from each page's last source change. |
| `web/app/robots.js` | `User-agent: *`, `Allow: /`, `Disallow: /api/` (form handlers), `Disallow: /apps/taskapp/buy` (checkout redirect), `Sitemap: https://flashtech.biz/sitemap.xml`. |

`web/scripts/check-store.mjs --built` (run by `docker compose build`) asserts the generated bodies:
both files exist, the robots directives are present, the sitemap contains exactly those five
`<loc>` values, and neither file carries a dev host/port or an unfilled `{{TOKEN}}`. Deleting a
metadata route therefore fails the build instead of silently shipping a 404 sitemap.

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
  nothing. Records set `meta.is_sample=false`, `meta.package="starter"`, `meta.intake_version="starter-v1"`.
- `job_id` is the author's public name as a slug plus a 5-character random suffix
  (`erick-williams-4k2p9`), so a file cannot land on top of another.

**Schema changes are deliberate.** The schema is read from the host file at container start, so an
edit to `intake/schema.json` takes effect on `docker compose up -d web` — no rebuild. The route logs
`authors-intake-schema-version-mismatch` when the mounted `$id` is not the `SCHEMA_ID` in
`web/lib/intake-fields.mjs`. The cover-image and voice-over fields (card `t_7487852d`) are **not**
collected yet: `COVER_VO_ENABLED` is off, with the exact attach points marked `TODO(t_7487852d)` in
`lib/intake-fields.mjs`, `route.js` and `IntakeForm.jsx`. Do not add an input for a field the
schema does not declare — `additionalProperties: false` means the submission would be refused and
the author's answers lost.

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
