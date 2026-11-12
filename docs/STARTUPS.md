# Startups section: how it is built

**Routes:** `/startups` (index of ventures) · `/startups/authors` (The Author's Candle)
**Added:** 2026-11-12 by a Claude Code session, with the owner's approval. Backup taken first (see Rollback).
**Search engines:** indexable since 2026-11-12, after the owner checked the name in USPTO search and found it clear.

## What each piece is

| Path | What it is |
|---|---|
| `web/app/startups/page.jsx` | Index of Flash Tech ventures. Uses the site's global styles. |
| `web/app/startups/authors/page.jsx` | The Author's Candle landing page. Has its own brand: `authors.module.css`, scoped under `.page`, with system fonts only. |
| `web/app/startups/authors/ApplyForm.jsx` | Founding-spot application form. Posts to `/api/authors-apply`. |
| `web/app/startups/authors/layout.jsx` | Metadata (indexable). |
| `web/app/api/authors-apply/route.js` | Validates each application and writes one JSON file to `AUTHORS_INBOX`. Includes a honeypot. Stores no IP addresses. |
| `compose.yaml` | Sets `AUTHORS_INBOX=/data/author-inquiries` and bind-mounts it from `~/businesses/author-marketing/inquiries`. |
| `web/app/page.jsx` | A "Startups" link was added to the footer. |

The page copy comes from `~/businesses/author-marketing/site/landing.html`, which is also that business's rules and decisions workspace. Its rules apply to the copy: say "AI-drafted, human-reviewed", and make no outcome promises or invented claims.

## Not built yet
- `/startups/authors/buy`, a Lemon Squeezy checkout redirect like `/apps/taskapp/buy`. It waits for a product to be created in Lemon Squeezy.
- Notifications for new applications. Files only appear in `inquiries/`.

## Rollback
- Source backup: `~/backups/flash-tech/flash-tech-src-20261112T065421Z.tar.gz` (excludes `node_modules` and `.next`)
- Previous image: `flash-tech-web:pre-authors-20261112T065421Z`

To roll back, run `docker tag flash-tech-web:pre-authors-20261112T065421Z flash-tech-web:latest`, then `docker compose up -d --no-build web`. Restore the source from the tarball if the code should go back too.
