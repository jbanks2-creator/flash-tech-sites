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

- Domain still points at the GoDaddy builder placeholder; this site is reachable only through the tunnel.
- No analytics, no favicon, no OG image, no sitemap.
- Brand palette is a placeholder (navy/electric blue) pending a real brand file.
- `The Wiz` section is a teaser; character art does not exist.
