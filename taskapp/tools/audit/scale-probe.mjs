/**
 * Scale measurement: 5,000 tasks / 500 projects.
 * Times a full render per view, the save() cost, the search path, and records
 * the DOM node count (no virtualisation anywhere in the app).
 *
 * Run: node tools/audit/scale-probe.mjs http://127.0.0.1:3601/
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=1024"],
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto(TARGET, { waitUntil: "load" });
await page.evaluate(() => { const b = document.querySelector('[data-act="welcomeEmpty"]'); if (b) b.click(); });

const out = await page.evaluate(() => {
  localStorage.clear();
  S = blankState();
  const t0 = performance.now();
  for (let i = 0; i < 500; i++) {
    S.projects.push({ id: "p" + i, name: "Project " + i, domain_id: ["business", "technical", "church", "nonprofit", "personal"][i % 5], description: "desc", criticality: 1 + (i % 5), status: "active", due_date: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null });
  }
  for (let i = 0; i < 5000; i++) {
    S.tasks.push({ id: "t" + i, title: "Task number " + i + " for the scale test", description: i % 10 === 0 ? "Description text" : "", domain_id: ["business", "technical", "church", "nonprofit", "personal"][i % 5], project_id: "p" + (i % 500), status: ["todo", "in_progress", "blocked", "completed"][i % 4], position: i, priority: ["high", "medium", "low"][i % 3], due_date: i % 3 === 0 ? "2026-12-0" + (1 + (i % 9)) : null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: i % 7 === 0 ? ["tag" + (i % 20)] : [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
  }
  for (let i = 0; i < 5000; i++) {
    S.notes.push({ id: "n" + i, task_id: "t" + (i % 5000), project_id: null, body: "note " + i, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" });
  }
  const buildMs = +(performance.now() - t0).toFixed(1);
  const stateChars = JSON.stringify(S).length;

  const tSave = performance.now(); const saveOk = save(); const saveMs = +(performance.now() - tSave).toFixed(1);

  const timings = {};
  for (const v of ["home", "board", "list", "focus", "projects", "research", "settings"]) {
    ui.view = v;
    const a = performance.now(); render(); const b = performance.now();
    timings[v] = { ms: +(b - a).toFixed(1), domNodes: document.querySelectorAll("*").length, mainNodes: document.querySelectorAll("#main *").length };
  }

  // search hot path (re-render of list with a filter)
  ui.q = "Task number 49";
  let a = performance.now(); ui.view = "list"; render(); const searchMs = +(performance.now() - a).toFixed(1);
  ui.q = "";

  // per-item mutation cost: createTask calls endPosition() which scans the column
  ui.view = "board"; render();
  a = performance.now();
  for (let i = 0; i < 20; i++) createTask({ title: "incremental " + i, domain_id: "business" });
  const create20Ms = +(performance.now() - a).toFixed(1);

  // drag/drop path: moveTask + full re-render
  a = performance.now();
  moveTask("t0", "completed", 0); commit();
  const moveMs = +(performance.now() - a).toFixed(1);

  return {
    tasks: S.tasks.length, projects: S.projects.length, notes: S.notes.length,
    buildMs, stateChars, stateMB: +(stateChars / 1048576).toFixed(2), saveOk, saveMs,
    render: timings, searchRenderMs: searchMs, create20TasksMs: create20Ms, moveAndCommitMs: moveMs,
    viewport: { w: innerWidth, h: innerHeight },
  };
});
console.log("### scale_5000\n" + JSON.stringify(out, null, 2));

// Empty-database baseline for comparison
const empty = await page.evaluate(() => {
  localStorage.clear(); S = blankState(); save();
  const t = {};
  for (const v of ["home", "board", "list", "focus"]) { ui.view = v; const a = performance.now(); render(); t[v] = +(performance.now() - a).toFixed(2); }
  return t;
});
console.log("### scale_empty_baseline\n" + JSON.stringify(empty, null, 2));

await browser.close();
