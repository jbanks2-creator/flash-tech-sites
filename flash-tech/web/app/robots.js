import { SITE_URL } from "@/lib/site.mjs";

/**
 * /robots.txt — Next's metadata route, prerendered at build time.
 *
 * Two things this file must say, and until now said neither:
 *   1. that crawling the public site is allowed (`User-agent: *` + `Allow: /`), and
 *   2. where the sitemap is, so a crawler that finds the domain finds every public page.
 *
 * `/api/` is disallowed because those paths are form handlers (contact, TaskApp inquiry, The
 * Author's Candle applications). A crawler on them only produces POST-less 405s and log noise;
 * none of them is content. `/apps/taskapp/buy` is a redirect to the checkout host, so there is
 * nothing there to index either.
 *
 * Written as `.js` rather than `.ts` for the same reason as `app/sitemap.js`: no TypeScript
 * toolchain in this app, and the emitted text is identical.
 *
 * NOTE (2026-11-12): the zone sits behind Cloudflare, which may serve its own content-signals
 * block at the edge and never reach this file. See docs/DEPLOY.md — origin behaviour is proven
 * with curl against 127.0.0.1:3401; the edge behaviour needs a dashboard check.
 */
export const dynamic = "force-static";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/apps/taskapp/buy"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
