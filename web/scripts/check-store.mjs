#!/usr/bin/env node
/**
 * Build gate for the TaskApp store.
 *
 * Two jobs:
 *   1 Always — prove the page is built from the content that was synced, and that it contains
 *      no unfilled token, no drafting marker, no "Lemon Squeezy or Paddle" hedge and no link
 *      to a dev port. A page that ships `{{PRICE_DOWNLOAD}}` is worse than no page.
 *   2 When STORE_LIVE=1 — refuse the build unless every decided value is configured:
 *      support address, demo origin on https, checkout URL, zero drafting markers.
 *
 * `--built` adds a third job after `next build`: read the rendered site and refuse it unless
 * every public page carries an absolute og:image (and twitter:image) that resolves to a real
 * 1200x630 PNG, and unless /sitemap.xml lists exactly the public routes. Both defects are
 * invisible in a browser — a page with no share image still loads, a missing sitemap still 200s
 * — so they are caught here instead of by a customer.
 *
 * Run automatically by `npm run build` (prebuild) and by `docker compose build` through it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ROUTES, SITE_URL } from "../lib/site.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);

/**
 * Every public route, pinned here rather than trusted from `lib/site.mjs`.
 *
 * `lib/site.mjs` is the source of truth the sitemap and robots.txt are generated from, so this
 * literal is a second opinion: a page cannot be added to (or dropped from) the indexable site
 * without this gate being updated in the same commit. The `--built` section compares the two
 * lists, insists each one rendered, and insists each one carries a share image.
 */
const PUBLIC_PATHS = ["/", "/apps", "/apps/taskapp", "/contact", "/startups", "/startups/authors"];

/** Width/height from a PNG's IHDR chunk — `undefined` for anything that is not a PNG. */
const pngSize = (buf) =>
  buf.length > 24 && buf.toString("latin1", 1, 4) === "PNG" ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null;

// `--built` runs after `next build` and inspects the rendered HTML. The source-level checks
// below cannot see metadata Next generates (a relative og:image with no metadataBase ships as
// http://localhost:3000/…), so that class of leak is only visible in the output.
const built = process.argv.includes("--built");

const live = process.env.STORE_LIVE === "1";
const supportEmail = process.env.STORE_SUPPORT_EMAIL || "";
const demoOrigin = process.env.STORE_DEMO_ORIGIN || "";
const checkout = process.env.LEMONSQUEEZY_CHECKOUT_URL || "";

/* ---- 1. synced content --------------------------------------------------- */
const manifestPath = join(WEB, "content/store/manifest.json");
if (!existsSync(manifestPath)) {
  err("content/store/manifest.json missing — run: node scripts/sync-store-content.mjs");
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const versionFile = join(WEB, "content/store/version.json");
  const version = JSON.parse(readFileSync(versionFile, "utf8")).version;
  if (manifest.version !== version) err(`manifest version ${manifest.version} != version.json ${version}`);
  for (const f of manifest.files) {
    const path = join(WEB, f.rel);
    if (!existsSync(path)) { err(`missing synced file: ${f.rel}`); continue; }
    const got = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (got !== f.copy_sha256) err(`${f.rel} does not match the sync manifest (stale copy)`);
  }
  const markers = manifest.markers || { jerry: 0, attorney: 0 };
  if (live && markers.jerry + markers.attorney > 0) {
    err(`${markers.jerry + markers.attorney} drafting markers remain (${markers.jerry} Jerry, ${markers.attorney} attorney) — a live page must not carry them`);
  }
  console.log(`check-store: content synced from TaskApp ${version} · markers ${markers.jerry}/${markers.attorney}`);
}

/* ---- 2. every page source ------------------------------------------------- */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(jsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = walk(join(WEB, "app"));
const pageSources = sources.filter((f) => /apps[\\/]taskapp/.test(f));
const forbidden = [
  [/\{\{[A-Z_]+\}\}/, "unfilled {{TOKEN}}"],
  [/\[PENDING\b/, "[PENDING …] marker"],
  [/\[JERRY:/, "[JERRY: …] marker in code/copy"],
  [/\[ATTORNEY:/, "[ATTORNEY: …] marker in code/copy"],
  [/Lemon Squeezy or Paddle/i, "undecided provider hedge"],
  [/127\.0\.0\.1|localhost/i, "dev host/port literal"],
  [/:34\d\d\b/, "dev port literal"],
];
for (const file of pageSources) {
  const text = readFileSync(file, "utf8");
  for (const [re, label] of forbidden) {
    if (re.test(text)) err(`${relative(WEB, file)} contains ${label}`);
  }
}

/* ---- 3. required links and assets ---------------------------------------- */
const page = readFileSync(join(WEB, "app/apps/taskapp/page.jsx"), "utf8");
for (const slug of ["eula", "refund-policy", "support-policy", "privacy-statement"]) {
  if (!page.includes(`/apps/taskapp/legal/${slug}`)) err(`store page does not link the ${slug} page`);
}
if (!page.includes("/apps/taskapp/changelog")) err("store page does not link the changelog");
if (!page.includes("demoOrigin")) err("store page has no demo embed");

for (const asset of ["hero-board-dark.png", "focus-light.png", "list-filters.png", "task-drawer.png",
  "mobile-board.png", "og-image.png", "demo.webm", "demo.mp4", "icon.svg"]) {
  if (!existsSync(join(WEB, "public/apps/taskapp", asset))) err(`missing public asset: ${asset}`);
}

/* ---- 4. launch values ---------------------------------------------------- */
if (live) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(supportEmail)) err("STORE_LIVE=1 needs STORE_SUPPORT_EMAIL (a real mailbox)");
  if (!/^https:\/\/[a-z0-9.-]+/i.test(demoOrigin) || /localhost|127\.0\.0\.1/.test(demoOrigin)) {
    err("STORE_LIVE=1 needs STORE_DEMO_ORIGIN on https (the demo's own origin, not this site)");
  }
  let ok = false;
  try {
    const u = new URL(checkout);
    ok = u.protocol === "https:" && /(^|\.)lemonsqueezy\.com$/i.test(u.hostname);
  } catch { ok = false; }
  if (!ok) err("STORE_LIVE=1 needs LEMONSQUEEZY_CHECKOUT_URL (https, lemonsqueezy.com)");
} else {
  if (!demoOrigin) warnings.push("STORE_DEMO_ORIGIN is unset — the demo block renders a placeholder");
  if (!supportEmail) warnings.push("STORE_SUPPORT_EMAIL is unset — the page points at the contact form instead of an address");
  if (!checkout) warnings.push("LEMONSQUEEZY_CHECKOUT_URL is unset — /apps/taskapp/buy returns its 'not configured' page");
}

/* ---- 5. rendered HTML (`--built`) ---------------------------------------- */
if (built) {
  const appHtml = join(WEB, ".next/server/app");
  if (!existsSync(appHtml)) {
    err(".next/server/app is missing — run `next build` before `check-store --built`");
  } else {
    const htmls = [];
    const collect = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full);
        else if (entry.endsWith(".html")) htmls.push(full);
      }
    };
    collect(appHtml);
    if (!htmls.length) err("no rendered HTML under .next/server/app — cannot verify the output");
    for (const file of htmls) {
      const text = readFileSync(file, "utf8");
      // Metadata lives in <head>: that is where a generated URL can leak a loopback host.
      // Prose is excluded on purpose — the TaskApp changelog legitimately quotes the dev
      // ports its QA runs used, and rewriting release history to satisfy a linter is worse
      // than the (harmless) mention.
      const end = text.search(/<\/head>/i);
      const head = end === -1 ? text : text.slice(0, end + 7);
      if (/127\.0\.0\.1|localhost/i.test(head)) err(`rendered ${relative(WEB, file)} <head> contains a dev host literal`);
      if (/:34\d\d\b/.test(head)) err(`rendered ${relative(WEB, file)} <head> contains a dev port literal`);
      // Next's own fallback origin, the exact string that broke the social preview.
      if (text.includes("localhost:3000")) err(`rendered ${relative(WEB, file)} contains Next's dev fallback host (metadataBase unset?)`);
    }

    const storeHtml = join(appHtml, "apps/taskapp.html");
    if (!existsSync(storeHtml)) {
      err("rendered store page apps/taskapp.html is missing");
    } else {
      const text = readFileSync(storeHtml, "utf8");
      if (!text.includes("https://flashtech.biz/apps/taskapp/og-image.png")) {
        err("store page og:image is not https://flashtech.biz/apps/taskapp/og-image.png (metadataBase unset?)");
      }
      if (!/property="og:url"/.test(text)) err("store page has no og:url");
      if (!/rel="canonical"/.test(text)) err("store page has no canonical link");
      // The defect this gate exists for: a page that offers a checkout which does not exist.
      if (!live && /href="\/apps\/taskapp\/buy"/.test(text)) {
        err("non-live store page links to /apps/taskapp/buy — a pre-sale page must not offer a checkout");
      }
    }

    /* ---- 5b. a share image on every public page --------------------------- */
    // Measured 2026-11-12: /, /contact, /startups and /startups/authors carried no og:image
    // at all, so every share of those pages unfurled as a bare link while only the store had a
    // picture. A missing tag is invisible in a browser, so it gets the same treatment as the
    // sitemap: assert the route list, the tag in the rendered head, that the URL is absolute on
    // our own host, and that the file it names is a real 1200x630 PNG we ship.
    const listedPaths = PUBLIC_ROUTES.map((r) => r.path);
    // Order in lib/site.mjs is editorial (most important first), so compare as sets.
    if ([...listedPaths].sort().join("|") !== [...PUBLIC_PATHS].sort().join("|")) {
      err(`lib/site.mjs PUBLIC_ROUTES (${JSON.stringify(listedPaths)}) is not the list this gate pins (${JSON.stringify(PUBLIC_PATHS)})`);
    }
    const htmlFor = (p) => (p === "/" ? join(appHtml, "index.html") : join(appHtml, `${p.slice(1)}.html`));
    for (const route of PUBLIC_PATHS) {
      const file = htmlFor(route);
      if (!existsSync(file)) {
        err(`public page ${route} has no rendered HTML at ${relative(WEB, file)}`);
        continue;
      }
      const text = readFileSync(file, "utf8");
      const og = text.match(/<meta property="og:image" content="([^"]+)"/);
      const tw = text.match(/<meta name="twitter:image" content="([^"]+)"/);
      if (!og) {
        err(`${route} has no og:image — the page will share as a bare link`);
        continue;
      }
      const url = og[1];
      if (!url.startsWith(`${SITE_URL}/`)) {
        err(`${route} og:image is not an absolute ${SITE_URL} URL (${url})`);
      } else {
        const asset = join(WEB, "public", new URL(url).pathname);
        if (!existsSync(asset)) {
          err(`${route} og:image ${url} is not a file in web/public (${relative(WEB, asset)})`);
        } else {
          const size = pngSize(readFileSync(asset));
          if (!size || size[0] !== 1200 || size[1] !== 630) {
            err(`${relative(WEB, asset)} is ${size ? `${size[0]}x${size[1]}` : "not a PNG"}, not the 1200x630 a share card needs`);
          }
        }
      }
      if (!tw) err(`${route} has no twitter:image`);
      else if (tw[1] !== url) err(`${route} twitter:image (${tw[1]}) does not match og:image (${url})`);
      if (!/property="og:url"/.test(text)) err(`${route} has no og:url`);
      if (!/rel="canonical"/.test(text)) err(`${route} has no canonical link`);
    }
    console.log(`check-store: og:image asserted on ${PUBLIC_PATHS.length} public page${PUBLIC_PATHS.length === 1 ? "" : "s"}`);

    // The crawler-facing files. Their absence is silent — a 404 sitemap reads as "nothing to
    // report" rather than as a defect, which is exactly how the site shipped without one. So
    // assert the generated bodies: present, well-formed enough, and naming only public routes.
    const findOutput = (prefix) => {
      const hits = [];
      const walkDir = (dir) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) walkDir(full);
          else if (entry.startsWith(prefix)) hits.push(full);
        }
      };
      walkDir(appHtml);
      return hits.sort()[0] || null;
    };

    const robotsFile = findOutput("robots.txt");
    if (!robotsFile) err("/robots.txt was not generated — app/robots.js did not build");
    else {
      // Field names in robots.txt are case-insensitive; Next writes `User-Agent:`, the spec
      // examples write `User-agent:`. Compare lowercased rather than pin a capitalisation.
      const text = readFileSync(robotsFile, "utf8").toLowerCase();
      for (const needle of ["user-agent: *", "sitemap: https://flashtech.biz/sitemap.xml"]) {
        if (!text.includes(needle)) err(`/robots.txt is missing ${JSON.stringify(needle)}`);
      }
      if (!/^allow: \/$/m.test(text)) err("/robots.txt does not allow the site root");
      if (!/^disallow: \/api\/$/m.test(text)) err("/robots.txt does not disallow /api/");
      if (!/^disallow: \/apps\/taskapp\/buy$/m.test(text)) err("/robots.txt does not exclude the checkout redirect");
    }

    const sitemapFile = findOutput("sitemap.xml");
    if (!sitemapFile) err("/sitemap.xml was not generated — app/sitemap.js did not build");
    else {
      const text = readFileSync(sitemapFile, "utf8");
      if (!/<urlset[^>]+sitemaps\.org\/schemas\/sitemap\/0\.9/.test(text)) err("/sitemap.xml is not a sitemap 0.9 urlset");
      const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
      const expected = PUBLIC_PATHS.map((p) => (p === "/" ? `${SITE_URL}/` : `${SITE_URL}${p}`)).sort();
      if (locs.join("\n") !== expected.join("\n")) {
        err(`/sitemap.xml lists the wrong URLs (got ${JSON.stringify(locs)})`);
      }
    }
    for (const file of [robotsFile, sitemapFile].filter(Boolean)) {
      const text = readFileSync(file, "utf8");
      if (/127\.0\.0\.1|localhost|:34\d\d\b|\{\{[A-Z_]+\}\}/.test(text)) {
        err(`${relative(WEB, file)} contains a dev host/port or an unfilled token`);
      }
    }

    console.log(`check-store: rendered HTML scanned (${htmls.length} page${htmls.length === 1 ? "" : "s"}), crawler files asserted`);
  }
}

for (const w of warnings) console.warn(`check-store: warning — ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`check-store: FAIL — ${e}`);
  process.exit(1);
}
console.log(`check-store: ok (${live ? "LIVE" : "test-mode"} build)`);
