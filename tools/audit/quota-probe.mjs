/**
 * Bounded quota + silent-write measurement for TaskApp.
 *
 * The original probe grew state one 1 KB task at a time and called save() on
 * every iteration, which stringifies the whole state each time (O(n^2)) and
 * crashed the renderer. This version binary-searches the ceiling and saves once
 * per probe, so memory stays flat.
 *
 * Run: node tools/audit/quota-probe.mjs http://127.0.0.1:3601/
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=1024"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(TARGET, { waitUntil: "load" });

const emit = (k, v) => console.log(`### ${k}\n${JSON.stringify(v, null, 2)}\n`);

const mkTaskJs = `(i, size) => ({
  id: "t" + i, title: ("Task number " + i + " ").padEnd(size, "x"), description: "",
  domain_id: "business", project_id: null, status: "todo", position: i, priority: "medium",
  due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null,
  research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null,
})`;

/* -------------------------------------------------- 1. storage ceiling */
const quota = await page.evaluate((mkSrc) => {
  const mk = eval(mkSrc);
  localStorage.clear();
  const attempt = (n, size) => {
    const arr = []; for (let i = 0; i < n; i++) arr.push(mk(i, size));
    const payload = JSON.stringify({ version: 1, domains: [], projects: [], tasks: arr, notes: [], attachments: [], research: [], settings: {} });
    try { localStorage.setItem("taskapp.v1", payload); return { ok: true, chars: payload.length }; }
    catch (e) { return { ok: false, chars: payload.length, err: e.name }; }
  };
  const search = (size) => {
    let lo = 0, hi = 12000, best = 0, bestChars = 0, failErr = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = attempt(mid, size);
      if (r.ok) { best = mid; bestChars = r.chars; lo = mid + 1; }
      else { failErr = r.err || "unknown"; hi = mid - 1; }
    }
    return { maxTasks: best, storedChars: bestChars, storedMB: +(bestChars / 1048576).toFixed(2), failure: failErr };
  };
  const realistic = search(120);
  localStorage.clear();
  const longTitles = search(1000);
  localStorage.clear();
  return { realistic, longTitles };
}, mkTaskJs);
emit("quota_ceiling", quota);

/* ------------------------------------- 2. cost of the attachment path */
const att = await page.evaluate(() => {
  localStorage.clear(); S = blankState(); save();
  const t = createTask({ title: "attach me", domain_id: "business" }); save();
  const res = [];
  for (const mb of [0.5, 1, 1.5]) {
    const bytes = Math.round(mb * 1024 * 1024);
    const dataUrl = "data:application/octet-stream;base64," + "A".repeat(Math.ceil(bytes / 3) * 4);
    S.attachments.push({ id: "a" + mb, task_id: t.id, file_name: "big.bin", mime_type: "application/octet-stream", size_bytes: bytes, data_url: dataUrl, created_at: "2026-01-01T00:00:00Z" });
    const stateChars = JSON.stringify(S).length;
    const ok = save();
    res.push({ fileMB: mb, dataUrlChars: dataUrl.length, stateChars, stateMB: +(stateChars / 1048576).toFixed(2), saveOk: ok });
    if (!ok) S.attachments.pop();
  }
  localStorage.clear(); S = blankState(); save();
  return res;
});
emit("attachment_cost", att);

/* ------------------------- 3. silent write: UI says OK, reload loses it */
const maxRealistic = quota.realistic.maxTasks;
const silent = await page.evaluate(({ n }) => {
  localStorage.clear(); S = blankState(); save();
  const t = createTask({ title: "victim", domain_id: "business" }); save();
  const mk = (i) => ({ id: "f" + i, title: ("filler " + i + " ").padEnd(120, "y"), description: "", domain_id: "business", project_id: null, status: "todo", position: i, priority: "medium", due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
  // ONE bulk save at the measured ceiling — no per-item stringify.
  for (let i = 0; i < n - 2; i++) S.tasks.push(mk(i));
  const filled = save();
  const before = (localStorage.getItem("taskapp.v1") || "").length;
  // Exactly what act("addNote") does: addNote(), then save() with the result ignored.
  addNote("THIS NOTE WAS NEVER PERSISTED", { task_id: t.id });
  const saveOk = save();
  render();
  const persisted = JSON.parse(localStorage.getItem("taskapp.v1"));
  openTask(t.id);
  return {
    fillerTasks: S.tasks.length, fillSaveOk: filled, storedCharsBeforeNote: before,
    saveReturnedFalse: saveOk === false,
    notesInMemory: S.notes.length, notesOnDisk: persisted.notes.length,
    noteVisibleInDrawer: document.querySelectorAll("#drawer .note").length,
    toastsOnScreen: [...document.querySelectorAll(".toast")].map((e) => e.textContent.slice(0, 90)),
  };
}, { n: maxRealistic });
emit("silent_write", silent);

await page.reload({ waitUntil: "load" });
const afterReload = await page.evaluate(() => ({ notesAfterReload: S.notes.length, tasksAfterReload: S.tasks.length }));
emit("silent_write_after_reload", afterReload);

/* ---------------------------- 4. corrupted blob: silent total data loss */
const corrupt1 = await page.evaluate(() => {
  localStorage.clear();
  S = blankState();
  S.tasks.push({ id: "keep", title: "PRECIOUS", domain_id: "business", status: "todo", priority: "medium", tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", recurrence: "none", recurrence_interval: 1 });
  save();
  const full = localStorage.getItem("taskapp.v1");
  localStorage.setItem("taskapp.v1", full.slice(0, 40));   // simulate a torn/failed write
  return { fullChars: full.length, truncatedTo: localStorage.getItem("taskapp.v1") };
});
emit("corrupt_blob_seeded", corrupt1);

await page.reload({ waitUntil: "load" });
emit("corrupt_blob_after_reload", await page.evaluate(() => ({ tasks: S.tasks.length, domains: S.domains.length, anyWarningInUI: /corrupt|damaged|recover/i.test(document.body.innerText) })));

emit("corrupt_blob_after_next_write", await page.evaluate(() => {
  createTask({ title: "new task", domain_id: "business" });
  save();
  const raw = localStorage.getItem("taskapp.v1");
  return { tasksInBlob: JSON.parse(raw).tasks.length, preciousStillInBlob: raw.includes("PRECIOUS") };
}));

await browser.close();
