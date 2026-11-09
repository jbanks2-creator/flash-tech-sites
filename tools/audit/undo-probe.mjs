/**
 * P1-9 regression: destructive actions are counted and/or reversible.
 *
 * Run: node tools/audit/undo-probe.mjs http://127.0.0.1:3601/
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
const ctx = await browser.newContext();
const page = await ctx.newPage();
let dialogMessages = [];
page.on("dialog", (d) => { dialogMessages.push(d.message()); d.accept().catch(() => {}); });
await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { const b = document.querySelector('[data-act="welcomeEmpty"]'); if (b) b.click(); });

/* seed: one task with 2 notes and 1 attachment */
const seeded = await page.evaluate(() => {
  localStorage.clear(); S = blankState(); save();
  const t = createTask({ title: "undo victim", domain_id: "business" });
  addNote("first note", { task_id: t.id });
  addNote("second note", { task_id: t.id });
  S.attachments.push({ id: "att1", task_id: t.id, file_name: "a.pdf", url: "https://example.com/a.pdf", mime_type: "text/uri-list", size_bytes: 0, created_at: new Date().toISOString() });
  save(); ui.view = "board"; render();
  return { id: t.id, notes: S.notes.length, attachments: S.attachments.length };
});

/* 1. note deletion is reversible (and no confirm — undo is the safety net) */
const noteFlow = await page.evaluate((id) => {
  openTask(id);
  const before = document.querySelectorAll("#drawer .note").length;
  document.querySelector("[data-delnote]").click();
  const afterDelete = { notes: S.notes.length, notesInDrawer: document.querySelectorAll("#drawer .note").length,
                        undoButton: !!document.querySelector(".toast.act .undo") };
  document.querySelector(".toast.act .undo").click();
  return { before, afterDelete, afterUndo: S.notes.length, notesInDrawer: document.querySelectorAll("#drawer .note").length };
}, seeded.id);

/* 2. task deletion names what it destroys, then Undo restores everything */
const taskFlow = await page.evaluate((id) => {
  openTask(id);
  document.querySelector('[data-act="deleteTask"]').click();
  return { tasksAfterDelete: S.tasks.length, notesAfterDelete: S.notes.length, attachmentsAfterDelete: S.attachments.length,
           drawerOpen: !document.querySelector("#drawer").classList.contains("hidden"),
           undoButton: !!document.querySelector(".toast.act .undo") };
}, seeded.id);
await page.evaluate(() => document.querySelector(".toast.act .undo").click());
const taskRestored = await page.evaluate(() => ({ tasks: S.tasks.length, notes: S.notes.length, attachments: S.attachments.length,
  title: S.tasks[0]?.title, persisted: JSON.parse(localStorage.getItem("taskapp.v1")).tasks.length }));

/* 3. Undo cannot rewind an unrelated later change */
const stale = await page.evaluate(() => {
  openTask(S.tasks[0].id);
  document.querySelector("[data-delnote]").click();          // start an undo window
  const undoBtn = document.querySelector(".toast.act .undo");
  createTask({ title: "unrelated later change", domain_id: "business" }); save(); render();   // moves SAVED_JSON
  undoBtn.click();                                            // must refuse
  return { notes: S.notes.length, tasks: S.tasks.length,
           toast: [...document.querySelectorAll(".toast")].map((e) => e.textContent).join(" | ").slice(0, 160) };
});

/* 4. project deletion names the number of tasks kept */
const projectFlow = await page.evaluate(() => {
  const p = createProject({ name: "doomed project", domain_id: "business" });
  createTask({ title: "child task", project_id: p.id, domain_id: "business" });
  createTask({ title: "child task 2", project_id: p.id, domain_id: "business" });
  save(); openProject(p.id);
  document.querySelector('[data-act="deleteProject"]').click();
  return { projects: S.projects.length, tasksKept: S.tasks.filter((t) => t.title.startsWith("child task")).length };
});
await page.evaluate(() => document.querySelector(".toast.act .undo")?.click());
const projectRestored = await page.evaluate(() => ({ projects: S.projects.length }));

const deleteConfirm = dialogMessages.find((m) => /^Delete “undo victim”/.test(m)) || "";
const projectConfirm = dialogMessages.find((m) => /^Delete project “doomed project”/.test(m)) || "";

const checks = {
  note_delete_has_no_blocking_confirm: noteFlow.afterDelete.notes === seeded.notes - 1,
  note_delete_offers_undo: noteFlow.afterDelete.undoButton === true,
  note_undo_restores_it: noteFlow.afterUndo === seeded.notes && noteFlow.notesInDrawer === noteFlow.before,
  task_confirm_counts_notes_and_attachments: /2 notes/.test(deleteConfirm) && /1 attachment/.test(deleteConfirm),
  task_delete_removes_children: taskFlow.tasksAfterDelete === 0 && taskFlow.notesAfterDelete === 0 && taskFlow.attachmentsAfterDelete === 0,
  task_delete_offers_undo: taskFlow.undoButton === true && taskFlow.drawerOpen === false,
  task_undo_restores_children: taskRestored.tasks === 1 && taskRestored.notes === 2 && taskRestored.attachments === 1 && taskRestored.persisted === 1,
  undo_refuses_after_an_unrelated_save: stale.tasks === 2 && /Too late to undo/.test(stale.toast),
  project_confirm_counts_kept_tasks: /2 tasks will be kept/.test(projectConfirm),
  project_undo_restores_it: projectRestored.projects === 1 && projectFlow.tasksKept === 2,
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### note_flow\n" + JSON.stringify(noteFlow, null, 2));
console.log("### task_flow\n" + JSON.stringify({ ...taskFlow, taskRestored }, null, 2));
console.log("### stale_undo\n" + JSON.stringify(stale, null, 2));
console.log("### dialogs\n" + JSON.stringify({ deleteConfirm, projectConfirm }, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
