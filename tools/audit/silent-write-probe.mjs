/**
 * Exact silent-write probe: fill localStorage to the measured ceiling, then
 * perform the app's addNote() path (which ignores save()'s return value) and
 * check whether the UI shows the note while storage never received it.
 *
 * Run: node tools/audit/silent-write-probe.mjs http://127.0.0.1:3601/
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

const out = await page.evaluate(() => {
  const mk = (i) => ({ id: "f" + i, title: ("filler " + i + " ").padEnd(120, "y"), description: "", domain_id: "business", project_id: null, status: "todo", position: i, priority: "medium", due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
  const note = { id: "n1", task_id: "victim", body: "THIS NOTE WAS NEVER PERSISTED", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
  const victim = { id: "victim", title: "victim", description: "", domain_id: "business", project_id: null, status: "todo", position: 0, priority: "medium", due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null };

  const payload = (tasks, notes) => JSON.stringify({ version: 1, domains: [], projects: [], tasks, notes, attachments: [], research: [], settings: {} });
  const fits = (tasks, notes) => { try { localStorage.setItem("taskapp.v1", payload(tasks, notes)); return true; } catch (e) { return false; } };

  // Largest n where n filler tasks + victim + the note all fit.
  let lo = 0, hi = 12000, n = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const tasks = [victim]; for (let i = 0; i < mid; i++) tasks.push(mk(i));
    if (fits(tasks, [note])) { n = mid; lo = mid + 1; } else hi = mid - 1;
  }

  // Load exactly that state MINUS the note: save() must still succeed, and the
  // note is the next thing the user adds.
  localStorage.clear();
  const tasks = [victim]; for (let i = 0; i < n; i++) tasks.push(mk(i));
  localStorage.setItem("taskapp.v1", payload(tasks, []));
  const withoutNote = localStorage.getItem("taskapp.v1").length;
  const noteWouldNeed = payload(tasks, [note]).length - withoutNote;

  return { maxTasksWithNote: n, withoutNoteChars: withoutNote, roomLeftChars: 5242632 - withoutNote, noteWouldNeed, noteText: note.body };
});

// Reload so the app reads exactly that state from disk.
await page.reload({ waitUntil: "load" });

const result = await page.evaluate(() => {
  const S_before = { tasks: S.tasks.length, notes: S.notes.length };
  // This is act("addNote") verbatim: addNote(...), then save() with the result
  // ignored, then render + reopenTask, plus a success toast.
  const t = S.tasks.find((x) => x.title === "victim");
  addNote("THIS NOTE WAS NEVER PERSISTED", { task_id: t.id });
  const saveOk = save();          // app ignores this return value on this path
  render();
  openTask(t.id);
  const disk = JSON.parse(localStorage.getItem("taskapp.v1"));
  return {
    before: S_before,
    saveReturnedFalse: saveOk === false,
    notesInMemory: S.notes.length,
    notesOnDisk: disk.notes.length,
    noteRenderedInDrawer: document.querySelectorAll("#drawer .note").length,
    toastTexts: [...document.querySelectorAll(".toast")].map((e) => e.textContent.slice(0, 100)),
  };
});
console.log("### silent_note_write\n" + JSON.stringify({ ...out, ...result }, null, 2));

await page.reload({ waitUntil: "load" });
console.log("### after_reload\n" + JSON.stringify(await page.evaluate(() => ({ notes: S.notes.length, taskCount: S.tasks.length })), null, 2));

await browser.close();
