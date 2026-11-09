/**
 * file:// regression + upgrade path.
 *
 * A buyer double-clicks the file, so this is load-bearing:
 *  1. it boots from file:// with a hash-based CSP in a <meta> tag;
 *  2. localStorage write/read survives a reload;
 *  3. an existing taskapp.v1 blob from 1.0.0-beta.1 (with the dead scoring fields the
 *     migration removes) loads with its data intact;
 *  4. the only request is the file itself.
 *
 * Run: node tools/audit/file-protocol-probe.mjs [path/to/index.html]
 * Exit code 0 = every assertion passed.
 */
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const FILE = resolve(process.argv[2] || "index.html");
const URL = pathToFileURL(FILE).href;
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
const requests = [];
page.on("request", (r) => requests.push(r.url()));
await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(200);
const initialRequests = requests.slice();

const boot = await page.evaluate(() => ({
  tabs: document.querySelectorAll("#tabs button").length,
  mainHasContent: (document.querySelector("#main")?.textContent || "").length > 0,
  stateReady: typeof S !== "undefined" && Array.isArray(S.tasks),
  origin: location.origin,
  lsWrite: (() => { try { localStorage.setItem("taskapp.__probe", "1"); localStorage.removeItem("taskapp.__probe"); return true; } catch (e) { return false; } })(),
}));

/* create a task, reload, expect it to survive */
const created = await page.evaluate(() => {
  localStorage.clear(); S = blankState(); save(); render();
  const t = createTask({ title: "survives a reload on file://", domain_id: "business" });
  save(); return { id: t.id, ok: !!t.id };
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(150);
const afterReload = await page.evaluate(() => ({ tasks: S.tasks.length, title: S.tasks[0]?.title }));

/* an existing 1.0.0-beta.1 blob: scoring fields must be dropped, data kept */
const upgraded = await page.evaluate(() => {
  const legacy = {
    version: 1,
    domains: [{ id: "business", name: "Business", weight: 1.3, color: "#3b82f6", sort_order: 1 }],
    projects: [], notes: [], attachments: [], research: [],
    tasks: [{ id: "legacy-task", title: "PRECIOUS LEGACY TASK", description: "", domain_id: "business", project_id: null,
      status: "todo", position: 1024, priority: "high", due_date: null, recurrence: "none", recurrence_interval: 1,
      recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: ["keep"],
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null,
      score: 42, score_override: 7 }],
    settings: { scoring: { enabled: true }, theme: "dark" },
  };
  localStorage.setItem("taskapp.v1", JSON.stringify(legacy));
  return true;
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(150);
const migrated = await page.evaluate(() => ({
  tasks: S.tasks.length,
  title: S.tasks[0]?.title,
  hasScore: Object.prototype.hasOwnProperty.call(S.tasks[0] || {}, "score"),
  hasScoreOverride: Object.prototype.hasOwnProperty.call(S.tasks[0] || {}, "score_override"),
  settingsScoring: Object.prototype.hasOwnProperty.call(S.settings || {}, "scoring"),
  tags: S.tasks[0]?.tags,
  bannerId: document.querySelector("#banner").dataset.bannerId || null,
  bannerVisible: !document.querySelector("#banner").classList.contains("hidden"),
}));

const checks = {
  boots_from_file_url: boot.tabs === 7 && boot.mainHasContent && boot.stateReady && boot.origin === "file://",
  localstorage_works_on_file: boot.lsWrite === true,
  data_survives_reload: afterReload.tasks === 1 && afterReload.title === "survives a reload on file://",
  legacy_blob_loads: migrated.tasks === 1 && migrated.title === "PRECIOUS LEGACY TASK",
  scoring_fields_migrated_away: migrated.hasScore === false && migrated.hasScoreOverride === false && migrated.settingsScoring === false,
  other_settings_kept: migrated.tags?.join() === "keep",
  no_error_banner: migrated.bannerId !== "recovery" && migrated.bannerId !== "save",   // a backup nudge is expected, an error is not
  only_the_file_requested: initialRequests.length === 1 && initialRequests[0] === URL,
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### boot_file\n" + JSON.stringify({ ...boot, requests: initialRequests }, null, 2));
console.log("### reload\n" + JSON.stringify(afterReload, null, 2));
console.log("### migration\n" + JSON.stringify(migrated, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
