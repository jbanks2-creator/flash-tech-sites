import { PUBLIC_ROUTES, SITE_URL } from "@/lib/site.mjs";

/**
 * /sitemap.xml — Next's metadata route: prerendered to a static `.body` file at build time, so
 * serving it costs no request work.
 *
 * Written as `.js` rather than `.ts` on purpose: this app has no TypeScript toolchain (no
 * tsconfig, no `typescript` dependency or lockfile in `web/`), and Next's metadata routes are
 * file-format agnostic — the emitted XML is identical either way.
 *
 * The route list lives in `lib/site.mjs` so `robots.js` advertises the same inventory.
 */
export const dynamic = "force-static";

export default function sitemap() {
  return PUBLIC_ROUTES.map(({ path, lastModified, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
