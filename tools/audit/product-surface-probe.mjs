/**
 * Product-surface regressions for the cheap credibility fixes:
 *   P1-6 single version number + About/licence panel + version in the export
 *   P1-7 sample data is idempotent, tagged, and removable in one action
 *   P1-8 closing the drawer with unsaved edits asks first
 *   P1-5 dark-theme primary button contrast >= 4.5 (and its hover shade)
 *
 * Run: node tools/audit/product-surface-probe.mjs http://127.0.0.1:3601/
 * Exit code 0 = every assertion passed.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"],
});
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
let dialogMode = "dismiss", dialogs = [];
page.on("dialog", (d) => { dialogs.push(d.message().slice(0, 120)); (dialogMode === "accept" ? d.accept() : d.dismiss()).catch(() => {}); });

await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); S = blankState(); save(); render(); });

/* ---- P1-6: version + About ---- */
const about = await page.evaluate(() => {
  ui.view = "settings"; render();
  const text = document.querySelector("#main").textContent;
  const payload = exportData();
  return {
    showsVersion: text.includes("1.0.0-beta.2"),
    hasAbout: /About/.test(text),
    hasLicence: /Licensed, not sold/.test(text),
    hasSupport: /purchase receipt/.test(text),
    hasNoNetworkClaim: /no network/i.test(text),
    exportVersion: payload.app_version,
    exportFormat: payload.version,
  };
});

/* ---- P1-5: contrast ---- */
const contrast = await page.evaluate(() => {
  const lum = (hex) => {
    const h = hex.trim().replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const out = {};
  for (const theme of ["dark", "light", "midnight"]) {
    document.documentElement.dataset.theme = theme;
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    out[theme] = {
      "on-accent/accent": ratio(v("--on-accent"), v("--accent")),
      "on-accent/accent2 (hover)": ratio(v("--on-accent"), v("--accent2")),
      "accent/bg (links)": ratio(v("--accent"), v("--bg")),
      "text/bg": ratio(v("--text"), v("--bg")),
    };
  }
  document.documentElement.dataset.theme = "dark";
  return out;
});
const contrastFails = Object.entries(contrast).flatMap(([theme, pairs]) =>
  Object.entries(pairs).filter(([, v]) => v < 4.5).map(([k, v]) => `${theme} ${k}=${v}`));

/* ---- P1-7: sample data ---- */
const sample = await page.evaluate(() => {
  localStorage.clear(); S = blankState(); save(); render();
  act("sample");                       // empty DB: no confirm
  const first = { tasks: S.tasks.length, projects: S.projects.length, topics: S.research.length,
                  tagged: S.tasks.filter((t) => t.sample).length };
  act("sample");                       // second click must be a no-op
  const second = { tasks: S.tasks.length, projects: S.projects.length, topics: S.research.length };
  // a row the user owns, which removeSample must not touch
  createTask({ title: "MY OWN TASK", domain_id: "business" }); save(); render();
  const settings = renderSettings && (() => { ui.view = "settings"; render(); return document.querySelector("#main").textContent; })();
  return { first, second, removeButton: /Remove sample data \(\d+ tasks/.test(settings || "") };
});
dialogMode = "accept";
await page.evaluate(() => act("removeSample"));
const afterRemove = await page.evaluate(() => ({
  titles: S.tasks.map((t) => t.title),
  projects: S.projects.length, topics: S.research.length,
}));

/* ---- P1-8: unsaved edits are not discarded silently ---- */
const dirty = await page.evaluate(() => {
  ui.view = "board"; render();
  const t = createTask({ title: "dirty test", domain_id: "business" }); save(); render();
  openTask(t.id);
  document.querySelector("#f_title").value = "edited but not saved";
  return { open: !document.querySelector("#drawer").classList.contains("hidden") };
});
dialogs = [];
dialogMode = "dismiss";                 // "No, keep my edits"
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
const keptOpen = await page.evaluate(() => ({
  open: !document.querySelector("#drawer").classList.contains("hidden"),
  value: document.querySelector("#f_title")?.value,
}));
dialogMode = "accept";                  // "Yes, discard"
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
const closed = await page.evaluate(() => ({
  open: !document.querySelector("#drawer").classList.contains("hidden"),
  focusReturned: document.activeElement === document.body || !!document.activeElement.closest("#main,header"),
}));

const checks = {
  version_shown_in_settings: about.showsVersion && about.hasAbout,
  licence_and_support_present: about.hasLicence && about.hasSupport,
  network_claim_present: about.hasNoNetworkClaim,
  export_records_app_version: about.exportVersion === "1.0.0-beta.2" && about.exportFormat === 1,
  contrast_all_pairs_pass: contrastFails.length === 0,
  sample_loads_27_tasks: sample.first.tasks === 27 && sample.first.projects === 5 && sample.first.topics === 3,
  sample_rows_are_tagged: sample.first.tagged === 27,
  sample_is_idempotent: sample.second.tasks === sample.first.tasks && sample.second.projects === sample.first.projects,
  sample_remove_button_offered: sample.removeButton === true,
  sample_remove_keeps_user_rows: afterRemove.titles.length === 1 && afterRemove.titles[0] === "MY OWN TASK" && afterRemove.projects === 0 && afterRemove.topics === 0,
  dirty_close_asks: dialogs.length >= 1 && /Discard your unsaved changes/.test(dialogs[0]),
  dirty_close_can_be_cancelled: keptOpen.open === true && keptOpen.value === "edited but not saved",
  dirty_close_confirms_when_accepted: closed.open === false,
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### about\n" + JSON.stringify(about, null, 2));
console.log("### contrast\n" + JSON.stringify({ ...contrast, fails: contrastFails }, null, 2));
console.log("### sample\n" + JSON.stringify({ ...sample, afterRemove }, null, 2));
console.log("### dirty\n" + JSON.stringify({ dialogs, keptOpen, closed }, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
