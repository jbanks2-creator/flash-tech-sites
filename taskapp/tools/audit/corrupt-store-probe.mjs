/**
 * P0-3 regression: an unreadable store must never be replaced by an empty app.
 *
 * Before hardening: a truncated blob rendered 0 tasks with no warning, and the next write
 * overwrote it — the buyer's data was unrecoverable.
 * After hardening: the raw string is copied to taskapp.v1.recover-<ts>, a persistent banner
 * offers "download damaged data", and writes are refused until the user acknowledges.
 *
 * Run: node tools/audit/corrupt-store-probe.mjs http://127.0.0.1:3601/
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
let dialogAnswer = false;
page.on("dialog", (d) => (dialogAnswer ? d.accept() : d.dismiss()).catch(() => {}));

// A plausible torn write: valid prefix, cut off mid-object, with a recoverable title in it.
const CORRUPT = '{"version":1,"domains":[{"id":"business","name":"Business"}],"tasks":[{"id":"keep","title":"PRECIOUS PAYROLL RUN"';
await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { const b = document.querySelector('[data-act="welcomeEmpty"]'); if (b) b.click(); });
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("taskapp.v1", raw); }, CORRUPT);
await page.reload({ waitUntil: "load" });

const boot = await page.evaluate(() => ({
  tasks: S.tasks.length,
  domains: S.domains.length,
  bannerVisible: !document.querySelector("#banner").classList.contains("hidden"),
  bannerId: document.querySelector("#banner").dataset.bannerId,
  bannerRole: document.querySelector("#banner").getAttribute("role"),
  bannerText: document.querySelector("#banner .banner-txt")?.textContent?.slice(0, 300),
  recoverKeys: Object.keys(localStorage).filter((k) => k.startsWith("taskapp.v1.recover-")),
  mainBlobUnchanged: localStorage.getItem("taskapp.v1"),
  saveRefused: save() === false,
}));

// Try to write over it the way the app would after any normal edit.
const writeAttempt = await page.evaluate(() => {
  let threw = null;
  try { createTask({ title: "a new task after corruption", domain_id: "business" }); } catch (e) { threw = e.message; }
  const saved = save();
  return { threw, saved, mainBlobStillCorrupt: localStorage.getItem("taskapp.v1").startsWith('{"version":1,"domains"') && localStorage.getItem("taskapp.v1").endsWith('"PRECIOUS PAYROLL RUN"'),
           tasksInMemory: S.tasks.length };
});

// The escape hatch: download the damaged bytes.
let download = null;
try {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 5000 }),
    page.click('[data-act="recoverDownload"]'),
  ]);
  const stream = await dl.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  download = { suggested: dl.suggestedFilename(), hasPrecious: text.includes("PRECIOUS PAYROLL RUN"), bytes: text.length };
} catch (e) { download = { error: String(e.message).slice(0, 120) }; }

// Acknowledge: start fresh (the kept copy must survive).
dialogAnswer = true;
await page.evaluate(() => document.querySelector('[data-act="recoverFresh"]')?.click());
await page.waitForTimeout(200);
const afterAck = await page.evaluate(() => ({
  tasks: S.tasks.length,
  mainBlobParses: (() => { try { JSON.parse(localStorage.getItem("taskapp.v1")); return true; } catch (e) { return false; } })(),
  recoverKeys: Object.keys(localStorage).filter((k) => k.startsWith("taskapp.v1.recover-")),
  bannerHidden: document.querySelector("#banner").classList.contains("hidden"),
}));

const checks = {
  no_blank_app_without_warning: boot.tasks === 0 && boot.bannerVisible === true && boot.bannerId === "recovery" && boot.bannerRole === "alert",
  raw_copy_quarantined: boot.recoverKeys.length === 1 &&
    (await page.evaluate((k) => (localStorage.getItem(k) || "").includes("PRECIOUS PAYROLL RUN"), boot.recoverKeys[0])),
  original_blob_untouched: boot.mainBlobUnchanged === CORRUPT,
  writes_refused_before_ack: boot.saveRefused === true && writeAttempt.saved === false && writeAttempt.mainBlobStillCorrupt === true,
  damaged_data_downloadable: download && download.hasPrecious === true && /damaged/.test(download.suggested || ""),
  start_fresh_only_after_ack: afterAck.tasks === 0 && afterAck.mainBlobParses === true,
  copy_survives_starting_fresh: afterAck.recoverKeys.length === 1,
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### boot_on_corrupt_store\n" + JSON.stringify(boot, null, 2));
console.log("### write_attempt\n" + JSON.stringify(writeAttempt, null, 2));
console.log("### download\n" + JSON.stringify(download, null, 2));
console.log("### after_ack\n" + JSON.stringify(afterAck, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
