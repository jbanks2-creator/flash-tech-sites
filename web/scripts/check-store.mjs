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
 * Run automatically by `npm run build` (prebuild) and by `docker compose build` through it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);

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
    console.log(`check-store: rendered HTML scanned (${htmls.length} page${htmls.length === 1 ? "" : "s"})`);
  }
}

for (const w of warnings) console.warn(`check-store: warning — ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`check-store: FAIL — ${e}`);
  process.exit(1);
}
console.log(`check-store: ok (${live ? "LIVE" : "test-mode"} build)`);
