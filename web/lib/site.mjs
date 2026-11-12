/**
 * The public origin, and the one list of pages search engines are allowed to index.
 *
 * `app/sitemap.js` and `app/robots.js` both read this file, so a route cannot be advertised in
 * one and forgotten in the other, and the origin is written once instead of three times.
 *
 * The same origin appears as `metadataBase` in `app/layout.jsx` (it turns relative metadata URLs
 * into absolute ones). If the domain ever changes, both places must change together: a sitemap
 * naming a host the pages do not live on is worse than no sitemap at all.
 */
export const SITE_URL = "https://flashtech.biz";

/**
 * The five public routes, in the order they matter.
 *
 * `lastModified` is the date the page's own source last changed (git), not the build date —
 * a sitemap that claims every page changed on every deploy teaches crawlers to ignore it.
 *
 * Deliberately NOT listed, and why:
 *   /apps/taskapp/buy        a redirect to the checkout host, never a page to index
 *   /apps/taskapp/legal/*    DRAFT legal documents: noindex meta until the store goes live
 *   /apps/taskapp/changelog  release history, noindex in test mode
 *   /apps/taskapp/inquiry    a form endpoint page, noindex in test mode
 *   /api/*                   form handlers, disallowed in robots.txt as well
 */
export const PUBLIC_ROUTES = [
  { path: "/", lastModified: "2026-11-12", changeFrequency: "weekly", priority: 1.0 },
  { path: "/apps/taskapp", lastModified: "2026-11-11", changeFrequency: "weekly", priority: 0.9 },
  { path: "/startups", lastModified: "2026-11-12", changeFrequency: "weekly", priority: 0.7 },
  { path: "/startups/authors", lastModified: "2026-11-12", changeFrequency: "weekly", priority: 0.9 },
  { path: "/contact", lastModified: "2026-11-07", changeFrequency: "monthly", priority: 0.8 },
];
