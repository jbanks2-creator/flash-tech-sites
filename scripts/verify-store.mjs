/**
 * Store-front verification against a running host.
 *
 *   STORE_HOST=http://127.0.0.1:3401 OUT=/tmp/store-shots node scripts/verify-store.mjs
 *
 * Needs playwright-core and a Chromium build (the taskapp repo's tools/audit has both on this
 * box: `NODE_PATH` does not work for ESM, so symlink it next to this script or run from a
 * directory whose node_modules holds playwright-core).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const EXEC = process.env.CHROME || "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const HOST = process.env.STORE_HOST || "http://127.0.0.1:3401";
const OUT = process.env.OUT || "/tmp/store-evidence";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const results = {};
const failures = [];
const check = (name, ok, detail) => {
  results[name] = { ok, detail };
  if (!ok) failures.push(`${name}: ${JSON.stringify(detail)}`);
};

/* ---------------- desktop ---------------- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [], failed = [], requests = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("requestfailed", (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
page.on("request", (r) => requests.push(r.url()));

await page.goto(`${HOST}/apps/taskapp`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const dom = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth }));
  const h1 = document.querySelector("h1")?.textContent?.trim();
  const h2 = [...document.querySelectorAll("h2")].map((h) => h.textContent.trim());
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
  const text = document.body.innerText;
  return {
    h1, h2, imgs, links,
    faqCount: document.querySelectorAll("details").length,
    iframe: document.querySelector("iframe")?.getAttribute("src") || null,
    has49: /\$49/.test(text), has99: /\$99/.test(text),
    hasToken: /\{\{|\[PENDING|\[JERRY:|\[ATTORNEY:/.test(text),
    hasDevPort: /:3601|:3602|:3401|127\.0\.0\.1|localhost/.test(text),
    hasProviderHedge: /Lemon Squeezy or Paddle/i.test(text),
    legalLinks: links.filter((l) => l.includes("/legal/")),
    changelog: links.some((l) => l.includes("/changelog")),
    pageHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  };
});

check("h1", dom.h1 === "Know what's outstanding for every client, in one place.", dom.h1);
check("section order", JSON.stringify(dom.h2) === JSON.stringify([
  "The problem: five places and one memory",
  "What TaskApp does about it",
  "Why buy it instead of building it",
  "What's in the app",
  "Pricing",
  "Questions people ask before buying",
  "Can an AI build this for free?",
]), dom.h2);
check("eight FAQ entries", dom.faqCount === 8, dom.faqCount);
check("prices", dom.has49 && dom.has99, { has49: dom.has49, has99: dom.has99 });
check("no tokens or drafting markers", dom.hasToken === false);
check("no dev ports in visible copy", dom.hasDevPort === false);
check("no provider hedge", dom.hasProviderHedge === false);
check("four legal links", (dom.legalLinks || []).length >= 4, dom.legalLinks);
check("changelog link", dom.changelog);
check("images decoded", dom.imgs.length >= 5 && dom.imgs.every((i) => i.w > 0), dom.imgs);

/* ---------------- live demo inside the iframe ---------------- */
const demoUrl = dom.iframe;
check("demo iframe present", Boolean(demoUrl), demoUrl);
const frameEl = page.locator("iframe").first();
await frameEl.scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
const demoFrame = page.frames().find((f) => f.url().includes(":3602"));
check("demo frame loaded from its own origin", Boolean(demoFrame), demoFrame ? demoFrame.url() : null);

let demoState = null;
if (demoFrame) {
  demoState = await demoFrame.evaluate(() => ({
    tasks: typeof S !== "undefined" ? S.tasks.length : null,
    demoMarked: typeof S !== "undefined" ? S.tasks.every((t) => t.demo) : null,
    demoNotice: Boolean(document.querySelector(".demo-note")),
    storageKeys: Object.keys(localStorage),
    version: typeof APP_VERSION !== "undefined" ? APP_VERSION : null,
  }));
  check("demo has shipped workspace", demoState.tasks === 21 && demoState.demoMarked === true, demoState);
  check("demo shows its own notice", demoState.demoNotice === true, demoState.demoNotice);
  check("demo origin storage empty", demoState.storageKeys.length === 0, demoState.storageKeys);

  // edit inside the demo: must be in-memory only, and must not touch the store origin
  await demoFrame.evaluate(() => { createTask({ title: "PROBE EDIT", domain_id: S.domains[0].id }); commit("probe"); });
  await page.waitForTimeout(400);
  const afterEdit = await demoFrame.evaluate(() => ({
    tasks: S.tasks.length, keys: Object.keys(localStorage),
    stored: localStorage.getItem("taskapp.v1") !== null,
  }));
  const storeOriginKeys = await page.evaluate(() => Object.keys(localStorage));
  check("demo edit is in memory only", afterEdit.tasks === 22 && afterEdit.stored === false && afterEdit.keys.length === 0, afterEdit);
  check("store origin untouched by demo", storeOriginKeys.length === 0, storeOriginKeys);

  await demoFrame.evaluate(() => location.reload());
  await page.waitForTimeout(1200);
  const afterReload = await demoFrame.evaluate(() => ({ tasks: S.tasks.length, keys: Object.keys(localStorage) }));
  check("demo resets on reload", afterReload.tasks === 21 && afterReload.keys.length === 0, afterReload);
}

check("no page errors", errors.length === 0, errors);
check("no failed requests", failed.length === 0, failed);

/* screenshots */
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/store-desktop.png`, fullPage: true });
await page.locator("iframe").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/store-demo.png` });

/* ---------------- mobile ---------------- */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const mp = await mobile.newPage();
const mErrors = [];
mp.on("pageerror", (e) => mErrors.push(String(e)));
await mp.goto(`${HOST}/apps/taskapp`, { waitUntil: "networkidle" });
await mp.waitForTimeout(1000);
const m = await mp.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  iframeBox: (() => { const r = document.querySelector("iframe")?.getBoundingClientRect(); return r && { w: Math.round(r.width), h: Math.round(r.height) }; })(),
  buyVisible: !!document.querySelector('a[href="#pricing"]'),
  faqCount: document.querySelectorAll("details").length,
}));
check("mobile: no horizontal scroll", m.scrollWidth === m.innerWidth, m);
check("mobile: demo iframe sized to screen", m.iframeBox && m.iframeBox.w > 300 && m.iframeBox.w <= 390, m.iframeBox);
await mp.screenshot({ path: `${OUT}/store-mobile.png`, fullPage: true });
await mp.locator("iframe").first().scrollIntoViewIfNeeded();
await mp.waitForTimeout(1500);
const mFrame = mp.frames().find((f) => f.url().includes(":3602"));
check("mobile: demo frame loaded", Boolean(mFrame), mFrame ? mFrame.url() : null);
if (mFrame) {
  const ms = await mFrame.evaluate(() => ({ tasks: typeof S !== "undefined" ? S.tasks.length : null, keys: Object.keys(localStorage) }));
  check("mobile: demo workspace loaded", ms.tasks === 21 && ms.keys.length === 0, ms);
}
await mp.screenshot({ path: `${OUT}/store-mobile-demo.png` });
check("mobile: no page errors", mErrors.length === 0, mErrors);

/* ---------------- other pages ---------------- */
const other = await ctx.newPage();
const pages = {
  changelog: "/apps/taskapp/changelog",
  eula: "/apps/taskapp/legal/eula",
  refunds: "/apps/taskapp/legal/refund-policy",
  support: "/apps/taskapp/legal/support-policy",
  privacy: "/apps/taskapp/legal/privacy-statement",
  inquiry: "/apps/taskapp/inquiry",
  buy: "/apps/taskapp/buy",
};
const pageChecks = {};
for (const [name, path] of Object.entries(pages)) {
  const res = await other.goto(`${HOST}${path}`, { waitUntil: "load" });
  const t = await other.evaluate(() => document.body.innerText);
  pageChecks[name] = {
    status: res.status(),
    h1: (await other.locator("h1").first().textContent().catch(() => ""))?.trim(),
    draftBanner: /DRAFT — NOT FOR PUBLICATION/.test(t),
    markerHighlighted: Boolean(await other.locator("mark.draft-marker").count()),
    words: t.split(/\s+/).filter(Boolean).length,
  };
  if (name !== "buy") check(`${name} renders`, res.status() === 200 && pageChecks[name].words > 80, pageChecks[name]);
  else check("buy: honest when unconfigured", res.status() === 503, pageChecks[name]);
  if (name.startsWith("legal") || ["eula", "refunds", "support", "privacy"].includes(name)) {
    check(`${name}: draft banner while not live`, pageChecks[name].draftBanner === true, pageChecks[name].draftBanner);
  }
}
check("changelog lists rc.4", (await (async () => { await other.goto(`${HOST}/apps/taskapp/changelog`); return other.evaluate(() => document.body.innerText.includes("1.0.0-rc.4")); })()), null);

await other.goto(`${HOST}/apps/taskapp/legal/eula`);
await other.screenshot({ path: `${OUT}/legal-eula.png`, fullPage: false });
await other.goto(`${HOST}/apps/taskapp/changelog`);
await other.screenshot({ path: `${OUT}/changelog.png`, fullPage: false });

/* ---------------- inquiry form posts ---------------- */
await other.goto(`${HOST}/apps/taskapp/inquiry`);
const apiRes = await other.evaluate(async () => {
  const r = await fetch("/api/taskapp-inquiry", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Probe Buyer", email: "probe@example.com", want: "probe", when: "anytime" }),
  });
  return { status: r.status, body: await r.json() };
});
check("inquiry API accepts a valid request", apiRes.status === 200 && apiRes.body.ok === true, apiRes);

await browser.close();

const report = { host: HOST, demoUrl, demoState, pageChecks, checks: results, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
