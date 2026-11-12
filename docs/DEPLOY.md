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

Cloudflare's bot protection answers `python-urllib`'s default User-Agent with 403 on this zone;
use `curl` (or a browser UA) when verifying from a script.

## TaskApp storefront

`/apps/taskapp` is documented separately in [`STORE-DEPLOY.md`](STORE-DEPLOY.md): routes, the
content sync and build gate, environment variables, the separate-origin demo container, and the
**no analytics** rule that applies to that page.
