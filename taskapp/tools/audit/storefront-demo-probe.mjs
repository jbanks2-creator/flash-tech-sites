/**
 * Storefront demo probe — the guarantees the store page's embedded demo relies on.
 *
 *   1 demo mode loads the shipped workspace with no welcome panel
 *   2 demo mode writes nothing: no `taskapp.v1`, no onboarding marker, no licence key
 *   3 an edit made in the demo disappears on reload (it is in memory only)
 *   4 ?demo=1 on a copy that already holds user data changes nothing
 *
 * Run: node tools/audit/storefront-demo-probe.mjs <demo-url> [plain-url]
 *   e.g. node tools/audit/storefront-demo-probe.mjs \
 *          "http://127.0.0.1:3602/TaskApp-1.0.0-rc.4.html?demo=1"
 * Exit 0 only if every assertion passes.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const DEMO_URL = process.argv[2] || "http://127.0.0.1:3602/TaskApp-1.0.0-rc.4.html?demo=1";
const PLAIN_URL = process.argv[3] || DEMO_URL.replace(/\?demo=1$/, "");

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"],
});

const out = { demoUrl: DEMO_URL, plainUrl: PLAIN_URL };
const pageErrors = [];

/* ---- 1-3: demo mode ------------------------------------------------------- */
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(DEMO_URL, { waitUntil: "load" });
await page.waitForTimeout(600);

const first = await page.evaluate(() => ({
  tasks: S.tasks.length,
  demoMarked: S.tasks.every((t) => t.demo),
  demoCount: DEMO_DATA.tasks.length,
  notice: !!document.querySelector(".demo-note"),
  welcomeOpen: document.querySelector("#drawer").getAttribute("aria-label") === "Welcome to TaskApp",
  storageKeys: Object.keys(localStorage).sort(),
  version: APP_VERSION,
}));

/* add a row in the demo, then reload: it must not survive, and must not be stored */
await page.evaluate(() => { createTask({ title: "Demo edit that must not be saved", domain_id: S.domains[0].id }); commit("added in demo"); });
await page.waitForTimeout(400);
const afterEdit = await page.evaluate(() => ({
  tasks: S.tasks.length,
  stored: localStorage.getItem("taskapp.v1") !== null,
  keys: Object.keys(localStorage).sort(),
}));

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => ({
  tasks: S.tasks.length,
  demoMarked: S.tasks.every((t) => t.demo),
  stored: localStorage.getItem("taskapp.v1") !== null,
  keys: Object.keys(localStorage).sort(),
  editedRowGone: !JSON.stringify(S).includes("Demo edit that must not be saved"),
}));

/* ---- 4: ?demo=1 must not touch a real install ----------------------------- */
const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const real = await ctx2.newPage();
real.on("pageerror", (e) => pageErrors.push(String(e)));
await real.goto(PLAIN_URL, { waitUntil: "load" });
await real.waitForTimeout(400);
await real.evaluate(() => {                       // stand in for a buyer's own data
  const s = blankState();
  s.tasks.push({ id: "mine-1", title: "REAL BUYER TASK", status: "todo", priority: "high",
    domain_id: s.domains[0].id, created_at: nowUtc(), updated_at: nowUtc(), tags: [], notes: [] });
  localStorage.setItem("taskapp.v1", JSON.stringify(s));
  localStorage.setItem("taskapp.onboarded", nowUtc());
});
await real.goto(DEMO_URL, { waitUntil: "load" });
await real.waitForTimeout(600);
const realAfter = await real.evaluate(() => ({
  tasks: S.tasks.length,
  hasRealTask: S.tasks.some((t) => t.title === "REAL BUYER TASK"),
  demoLoaded: S.tasks.some((t) => t.demo),
}));

await browser.close();

out.demoMode = first;
out.afterEdit = afterEdit;
out.afterReload = afterReload;
out.realInstall = realAfter;
out.pageErrors = pageErrors;

const checks = {
  demo_loads_shipped_workspace: first.tasks === first.demoCount && first.demoCount === 21 && first.demoMarked,
  demo_shows_its_banner: first.notice,
  demo_skips_welcome: first.welcomeOpen === false,
  demo_writes_nothing: first.storageKeys.length === 0,
  demo_edit_is_in_memory: afterEdit.tasks === first.tasks + 1 && afterEdit.stored === false && afterEdit.keys.length === 0,
  demo_resets_on_reload: afterReload.tasks === first.tasks && afterReload.editedRowGone && afterReload.stored === false,
  demo_flag_does_not_replace_real_data: realAfter.hasRealTask && !realAfter.demoLoaded,
  no_page_errors: pageErrors.length === 0,
};

console.log(JSON.stringify({ ...out, checks }, null, 2));
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (failed.length) { console.error("\nFAILED: " + failed.join(", ")); process.exit(1); }
console.log("\nstorefront-demo-probe: all assertions passed");
