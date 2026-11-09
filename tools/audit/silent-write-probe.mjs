/**
 * P0-2 regression: a write that the browser refuses must not survive on screen.
 *
 * Before hardening: the note stayed in the drawer, `save()` returned false, 0 notes on
 * disk, and the note was gone after reload (9 call sites ignored the return value).
 * After hardening: save() rolls the in-memory state back to the last blob that actually
 * reached storage, shows a persistent banner naming the biggest attachment, and the UI
 * keeps showing only what is really saved.
 *
 * Run: node tools/audit/silent-write-probe.mjs http://127.0.0.1:3601/
 * Exit code 0 = every assertion passed.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=1024"],
});
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { const b = document.querySelector('[data-act="welcomeEmpty"]'); if (b) b.click(); });

const fill = await page.evaluate(() => {
  const mk = (i) => ({ id: "f" + i, title: ("filler " + i + " ").padEnd(120, "y"), description: "", domain_id: "business",
    project_id: null, status: "todo", position: i, priority: "medium", due_date: null, recurrence: "none",
    recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null,
    tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    completed_at: null, archived_at: null });
  const victim = { ...mk(0), id: "victim", title: "victim task", position: 0 };
  // A realistic 1.2 MB attachment (base64 costs 4/3), stored inside the same blob.
  const big = { id: "at1", task_id: "victim", file_name: "holiday-photo.jpg", mime_type: "image/jpeg",
    size_bytes: 1200000, data_url: "data:image/jpeg;base64," + "A".repeat(1600000),
    created_at: "2026-01-01T00:00:00.000Z" };

  // Find the real capacity using the app's own save(), so the ceiling is whatever this
  // browser actually enforces rather than a number copied from the audit.
  const build = (n) => { S = blankState(); S.tasks = [victim]; for (let i = 0; i < n; i++) S.tasks.push(mk(i)); S.attachments = [big]; };
  let lo = 0, hi = 20000, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    build(mid);
    if (save()) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  build(best); save();
  const bannerAtCapacity = { id: document.querySelector("#banner")?.dataset.bannerId, text: document.querySelector("#banner .banner-txt")?.textContent?.slice(0, 160) };
  return { capacityTasks: best, tasks: S.tasks.length, notes: S.notes.length,
           storedChars: (localStorage.getItem("taskapp.v1") || "").length, bannerAtCapacity };
});

// Now the exact user action: add a note the store cannot take.
const attempt = await page.evaluate(() => {
  const t = S.tasks.find((x) => x.id === "victim");
  const body = "THIS NOTE CANNOT BE PERSISTED ".padEnd(400, "!");
  const notesBefore = S.notes.length;
  addNote(body, { task_id: t.id });
  const saveOk = save();
  render(); openTask(t.id);
  const disk = JSON.parse(localStorage.getItem("taskapp.v1"));
  const banner = document.querySelector("#banner");
  return {
    notesBefore,
    saveReturnedFalse: saveOk === false,
    notesInMemory: S.notes.length,
    notesOnDisk: disk.notes.length,
    noteRenderedInDrawer: document.querySelectorAll("#drawer .note").length,
    memoryMatchesDisk: JSON.stringify(S) === JSON.stringify(disk),
    bannerId: banner?.dataset.bannerId,
    bannerClass: banner?.className,
    bannerText: banner?.querySelector(".banner-txt")?.textContent?.slice(0, 300),
    toastTexts: [...document.querySelectorAll(".toast")].map((e) => e.textContent.slice(0, 120)),
  };
});

await page.reload({ waitUntil: "load" });
const after = await page.evaluate(() => ({
  notes: S.notes.length,
  tasks: S.tasks.length,
  attachments: S.attachments.length,
  bannerId: document.querySelector("#banner").dataset.bannerId || null,
  bannerVisible: !document.querySelector("#banner").classList.contains("hidden"),
}));

const checks = {
  store_reached_capacity: fill.capacityTasks > 1000,
  near_limit_banner_warned: fill.bannerAtCapacity.id === "quota" && /% full/.test(fill.bannerAtCapacity.text || ""),
  save_refused: attempt.saveReturnedFalse === true,
  no_phantom_in_memory: attempt.notesInMemory === attempt.notesBefore,
  note_not_rendered: attempt.noteRenderedInDrawer === 0,
  memory_equals_disk: attempt.memoryMatchesDisk === true,
  banner_is_error: attempt.bannerId === "save" && /error/.test(attempt.bannerClass || ""),
  banner_names_attachment: /holiday-photo\.jpg/.test(attempt.bannerText || ""),
  nothing_lost_after_reload: after.notes === 0 && after.tasks === fill.capacityTasks + 1 && after.attachments === 1,
  no_stale_save_banner_after_reload: after.bannerId !== "save",   // the failure banner is per-session; the data is what persists
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### capacity\n" + JSON.stringify(fill, null, 2));
console.log("### refused_write\n" + JSON.stringify(attempt, null, 2));
console.log("### after_reload\n" + JSON.stringify(after, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
