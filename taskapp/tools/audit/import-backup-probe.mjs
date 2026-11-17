/**
 * Pre-import backup + "export backup now" nudge (card item 2, audit §1.5/§3.3).
 *
 * Asserts:
 *  1. with no export for 30 days a non-blocking banner offers "Export a backup now";
 *  2. clicking it downloads a backup, clears the banner and records the export time;
 *  3. importing a file downloads the CURRENT state first (taskapp-pre-import-*.json)
 *     and that file contains the pre-import rows;
 *  4. a rejected import downloads nothing and changes nothing.
 *
 * Run: node tools/audit/import-backup-probe.mjs http://127.0.0.1:3601/
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
page.on("dialog", (d) => d.dismiss().catch(() => {}));

async function readDownload(dl) {
  const stream = await dl.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  return { name: dl.suggestedFilename(), text };
}

await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { const b = document.querySelector('[data-act="welcomeEmpty"]'); if (b) b.click(); });
await page.evaluate(() => {
  localStorage.clear();
  S = blankState(); save();
  createTask({ title: "EXISTING TASK", domain_id: "business" });
  save();
  localStorage.setItem("taskapp.lastExport", new Date(Date.now() - 30 * 864e5).toISOString());
});
await page.reload({ waitUntil: "load" });
const nudge = await page.evaluate(() => ({
  visible: !document.querySelector("#banner").classList.contains("hidden"),
  id: document.querySelector("#banner").dataset.bannerId,
  text: document.querySelector("#banner .banner-txt")?.textContent,
  hasButton: !!document.querySelector('#banner [data-act="export"]'),
}));

const [backupDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 5000 }),
  page.click('#banner [data-act="export"]'),
]);
const backup = await readDownload(backupDl);
const afterExport = await page.evaluate(() => ({
  bannerHidden: document.querySelector("#banner").classList.contains("hidden"),
  lastExportSet: !!localStorage.getItem("taskapp.lastExport"),
  exportHadTask: false,
}));
afterExport.exportHadTask = backup.text.includes("EXISTING TASK");

/* ---- import: the current state must be downloaded before the merge is persisted ---- */
const incoming = {
  format: "taskapp-export", version: 1,
  domains: [{ id: "business", name: "Business" }],
  tasks: [{ id: "incoming1", title: "INCOMING TASK", domain_id: "business", status: "todo", priority: "medium",
    recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z" }],
};
const [preDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 5000 }),
  page.setInputFiles("#importFile", { name: "incoming.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) }),
]);
const pre = await readDownload(preDl);
await page.waitForTimeout(400);
const afterImport = await page.evaluate(() => ({
  titles: S.tasks.map((t) => t.title).sort(),
  lastImportSet: !!localStorage.getItem("taskapp.lastImport"),
  lastPreImportSet: !!localStorage.getItem("taskapp.lastPreImport"),
}));

/* ---- a rejected import must not download a backup or change anything ---- */
const bad = { ...incoming, tasks: [{ ...incoming.tasks[0], id: 'x"><img src=x onerror=alert(1)>' }] };
const [badDl, badResult] = await Promise.all([
  page.waitForEvent("download", { timeout: 1500 }).catch(() => null),
  page.setInputFiles("#importFile", { name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bad)) }),
]);
await page.waitForTimeout(500);
const afterBad = await page.evaluate(() => ({
  titles: S.tasks.map((t) => t.title).sort(),
  toast: [...document.querySelectorAll(".toast")].map((e) => e.textContent).join(" | ").slice(0, 200),
}));

const checks = {
  nudge_shown_after_30_days: nudge.visible === true && nudge.id === "backup" && /No backup for 30 days/.test(nudge.text || "") && nudge.hasButton,
  export_downloads_backup: /taskapp-backup-\d{4}-\d{2}-\d{2}\.json/.test(backup.name) && afterExport.exportHadTask,
  nudge_cleared_after_export: afterExport.bannerHidden === true && afterExport.lastExportSet === true,
  pre_import_backup_downloaded: /taskapp-pre-import-/.test(pre.name),
  pre_import_backup_is_pre_import_state: pre.text.includes("EXISTING TASK") && !pre.text.includes("INCOMING TASK"),
  import_applied: afterImport.titles.join(",") === "EXISTING TASK,INCOMING TASK",
  import_timestamps_recorded: afterImport.lastImportSet && afterImport.lastPreImportSet,
  rejected_import_downloads_nothing: badDl === null,
  rejected_import_changes_nothing: afterBad.titles.join(",") === "EXISTING TASK,INCOMING TASK" && /Import failed/.test(afterBad.toast || ""),
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### nudge\n" + JSON.stringify(nudge, null, 2));
console.log("### backup_before_import\n" + JSON.stringify({ name: pre.name, containsExisting: pre.text.includes("EXISTING TASK"), containsIncoming: pre.text.includes("INCOMING TASK") }, null, 2));
console.log("### after_import\n" + JSON.stringify(afterImport, null, 2));
console.log("### rejected_import\n" + JSON.stringify({ downloaded: badDl ? badDl.suggestedFilename() : null, ...afterBad }, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
