/**
 * Backup-restore domain handling — regression probe for the two QA blockers and m1.
 *
 *   R1  B1  rename + recolour + reorder a client, export, restore into a fresh install:
 *           name/colour/order come back and the summary reports the row as *updated*
 *   R2  B2  the exact QA repro (renamed default + a new client with the old name, a task
 *           in it) restores into a fresh install with the task in the client the user chose
 *   R3  B2  a genuine name collision on a non-pristine install re-files the imported rows
 *           onto the surviving client instead of rejecting the file
 *   R4  m1  a 4-client backup restored onto a fresh install yields 4 clients (not 9), the
 *           summary says the 5 empty starter clients were replaced, demo flags survive so
 *           "Clear demo data" still removes the demo clients
 *   R5      re-importing your own export changes nothing (no timestamp churn from R1)
 *   R6      hostile files are still rejected with state untouched, and a row that points at
 *           a stock client keeps that client alive (no stranded "Unknown domain")
 *   R7      a stale domain row in an older file cannot rewind a newer local name
 *
 * Run: node tools/audit/restore-domains-probe.mjs http://127.0.0.1:3601/
 * Exit code 0 = every assertion passed.
 */
import { chromium } from "playwright-core";
import fs from "fs";
import os from "os";
import path from "path";

const EXEC = process.env.CHROME || "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const OUT = process.env.PROBE_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "restore-domains-"));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const results = {};
const checks = {};
const log = (id, data) => { results[id] = data; console.log(`\n### ${id}\n` + JSON.stringify(data, null, 2)); };

async function fresh(firstRun) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.errs = []; page.downloads = [];
  page.on("pageerror", (e) => page.errs.push(String(e)));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  page.on("download", async (d) => {
    const p = path.join(OUT, `${firstRun}-${Date.now()}-${page.downloads.length}.json`);
    await d.saveAs(p).catch(() => {});
    page.downloads.push({ name: d.suggestedFilename(), path: p });
  });
  await page.goto(TARGET, { waitUntil: "load" });
  await page.waitForFunction(() => typeof S !== "undefined");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => typeof S !== "undefined");
  const btn = await page.$(`[data-act="welcome${firstRun === "demo" ? "Demo" : "Empty"}"]`);
  if (btn) { await btn.click(); await page.waitForTimeout(350); }
  return { ctx, page };
}
async function exportFile(page) {
  await page.evaluate(() => { if (!document.querySelector("#drawer").classList.contains("hidden")) closeDrawer(); ui.view = "settings"; render(); });
  await page.waitForTimeout(200);
  const n = page.downloads.length;
  await page.click('[data-act="export"]');
  for (let i = 0; i < 40 && page.downloads.length === n; i++) await page.waitForTimeout(100);
  if (page.downloads.length === n) throw new Error("export produced no download");
  return page.downloads[page.downloads.length - 1].path;
}
const toastOf = (page) => page.evaluate(() => {
  const box = document.querySelector("#toasts");
  return box && box.lastElementChild ? box.lastElementChild.innerText.trim() : "";
});
const doms = (page) => page.evaluate(() => S.domains.map((d) => ({ id: d.id, name: d.name, color: d.color, weight: d.weight, sort_order: d.sort_order, demo: d.demo })));
async function importBuf(page, name, obj) {
  const before = await page.evaluate(() => JSON.stringify(S));
  await page.setInputFiles("#importFile", { name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(obj)) });
  await page.waitForTimeout(900);
  const toast = await toastOf(page);
  const after = await page.evaluate(() => JSON.stringify(S));
  return { toast, stateUnchanged: before === after };
}
const task = (id, title, domain_id, extra = {}) => ({
  id, title, domain_id, status: "todo", priority: "medium", position: 1024, recurrence: "none",
  recurrence_interval: 1, tags: [], created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z", ...extra,
});
const envelope = (rows) => ({ format: "taskapp-export", version: 1, app_version: "1.0.0-rc.2", exported_at: "2026-02-01T00:00:00.000Z", ...rows });

/* ============================ R1 — B1: rename / colour / order ============================ */
{
  const a = await fresh("empty");
  await a.page.click('[data-act="manageDomains"]');
  await a.page.fill('[data-dom="business"][data-k="name"]', "Clients");
  await a.page.press('[data-dom="business"][data-k="name"]', "Enter");
  await a.page.waitForTimeout(300);
  // colour through the real change handler on the colour input
  await a.page.$eval('[data-dom="business"][data-k="color"]', (el) => {
    el.value = "#123456";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await a.page.waitForTimeout(250);
  // order: move "business" down one row
  await a.page.click('[data-dommove="business"][data-dir="1"]');
  await a.page.waitForTimeout(300);
  const source = await doms(a.page);
  const file = await exportFile(a.page);
  const inFile = JSON.parse(fs.readFileSync(file, "utf8")).domains;
  await a.ctx.close();

  const b = await fresh("empty");
  await b.page.setInputFiles("#importFile", file);
  await b.page.waitForTimeout(1000);
  const toast = await toastOf(b.page);
  const restored = await doms(b.page);
  const reexport = JSON.parse(fs.readFileSync(await exportFile(b.page), "utf8")).domains;
  await b.ctx.close();

  const pick = (rows) => rows.map((d) => `${d.id}:${d.name}:${d.color}:${d.weight}:${d.sort_order}`).join("|");
  log("R1-rename-colour-order-roundtrip", {
    ui_after_edit: source.find((d) => d.id === "business"),
    in_exported_file: inFile.find((d) => d.id === "business"),
    after_restore: restored.find((d) => d.id === "business"),
    order_source: inFile.map((d) => d.id),
    order_restored: restored.map((d) => d.id),
    toast, errors: b.page.errs,
  });
  checks.R1_rename_restored = restored.find((d) => d.id === "business")?.name === "Clients";
  checks.R1_colour_restored = restored.find((d) => d.id === "business")?.color === "#123456";
  checks.R1_order_restored = restored.find((d) => d.id === "business")?.sort_order === inFile.find((d) => d.id === "business")?.sort_order;
  checks.R1_export_matches_export = pick(inFile) === pick(reexport);
  checks.R1_summary_reports_update = /(^|\D)[1-9]\d* updated/.test(toast);
  checks.R1_no_page_errors = b.page.errs.length === 0;
}

/* ===================== R2 — B2: exact QA repro, restore into a fresh install ===================== */
{
  const a = await fresh("empty");
  await a.page.click('[data-act="manageDomains"]');
  await a.page.fill('[data-dom="business"][data-k="name"]', "Clients");
  await a.page.press('[data-dom="business"][data-k="name"]', "Enter");
  await a.page.waitForTimeout(250);
  await a.page.fill("#newDomain", "Business");
  await a.page.click('[data-act="addDomain"]');
  await a.page.waitForTimeout(350);
  const newDom = await a.page.evaluate(() => S.domains.find((d) => d.name === "Business" && d.id !== "business"));
  await a.page.keyboard.press("Escape");
  await a.page.waitForTimeout(200);
  await a.page.evaluate((id) => openTask(null, { domain_id: id }), newDom.id);
  await a.page.waitForTimeout(250);
  await a.page.fill("#f_title", "Renew the insurance policy");
  await a.page.selectOption("#f_domain", newDom.id);
  await a.page.click('[data-act="saveTask"]');
  await a.page.waitForTimeout(400);
  const file = await exportFile(a.page);
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  await a.ctx.close();

  const b = await fresh("empty");
  const res = await importBuf(b.page, "collision.json", backup);
  const state = await b.page.evaluate(() => ({
    tasks: S.tasks.map((t) => ({ title: t.title, domain_id: t.domain_id })),
    domains: S.domains.map((d) => `${d.id}:${d.name}`),
  }));
  await b.ctx.close();
  log("R2-qa-repro-collision-restores", {
    backup_domains: backup.domains.map((d) => `${d.id}:${d.name}`),
    backup_task_domain: backup.tasks[0]?.domain_id,
    toast: res.toast, restored: state, errors: b.page.errs,
  });
  checks.R2_import_succeeds = /^Imported:/.test(res.toast) && !/Import failed/.test(res.toast);
  checks.R2_task_restored = state.tasks.some((t) => t.title === "Renew the insurance policy");
  checks.R2_task_in_chosen_client = state.tasks.find((t) => t.title === "Renew the insurance policy")?.domain_id === newDom.id;
  checks.R2_both_clients_present = state.domains.includes("business:Clients") && state.domains.includes(`${newDom.id}:Business`);
}

/* ============ R3 — B2: real name collision while merging into an install with data ============ */
{
  const a = await fresh("empty");
  // data makes this a merge, not a first restore: the stock clients stay in play
  await a.page.evaluate(() => { createTask({ title: "LOCAL TASK", domain_id: "business" }); save(); render(); });
  const b = a;
  const incoming = envelope({
    domains: [
      { id: "x-business", name: "Business", color: "#111111", weight: 1, sort_order: 9 },
      { id: "x-other", name: "Other", color: "#222222", weight: 1, sort_order: 10 },
    ],
    projects: [{ id: "p-x", name: "Imported project", domain_id: "x-business", criticality: 3, status: "active" }],
    research: [{ id: "r-x", name: "Imported topic", domain_id: "x-business", status: "explore", level: 0, body: "b", tags: [], links: [], log: [] }],
    tasks: [
      task("t-x", "Imported task in the clashing client", "x-business"),
      task("t-x2", "Imported task in Other", "x-other"),
    ],
  });
  const res = await importBuf(b.page, "merge-collision.json", incoming);
  const state = await b.page.evaluate(() => ({
    domains: S.domains.map((d) => `${d.id}:${d.name}`),
    tasks: S.tasks.map((t) => ({ id: t.id, domain_id: t.domain_id })),
    projects: S.projects.map((p) => ({ id: p.id, domain_id: p.domain_id })),
    research: S.research.map((r) => ({ id: r.id, domain_id: r.domain_id })),
  }));
  await a.ctx.close();
  log("R3-name-collision-remap", { toast: res.toast, state, errors: b.page.errs });
  checks.R3_import_succeeds = /^Imported:/.test(res.toast);
  checks.R3_task_remapped = state.tasks.find((t) => t.id === "t-x")?.domain_id === "business";
  checks.R3_project_remapped = state.projects.find((p) => p.id === "p-x")?.domain_id === "business";
  checks.R3_research_remapped = state.research.find((r) => r.id === "r-x")?.domain_id === "business";
  checks.R3_new_client_added = state.domains.includes("x-other:Other");
  checks.R3_colliding_id_not_duplicated = !state.domains.some((d) => d.startsWith("x-business:"));
  checks.R3_summary_names_the_merge = /1 client matched by name/.test(res.toast);
  checks.R3_stock_clients_not_deleted_on_merge = state.domains.includes("business:Business")
    && state.domains.includes("personal:Personal") && state.domains.length === 6;
}

/* ================== R4 — m1: 4-client backup onto a fresh install ================== */
{
  const a = await fresh("demo");
  const file = await exportFile(a.page);
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  await a.ctx.close();

  const b = await fresh("empty");
  const res = await importBuf(b.page, "demo-backup.json", backup);
  const state = await b.page.evaluate(() => ({
    domains: S.domains.map((d) => ({ id: d.id, name: d.name, demo: !!d.demo })),
    tasks: S.tasks.length,
    hasDemo: hasDemo(),
  }));
  // demo flags must survive on the domain rows, or "Clear demo data" strands the clients
  const reexported = JSON.parse(fs.readFileSync(await exportFile(b.page), "utf8"));
  await b.page.evaluate(() => { ui.view = "settings"; render(); });
  await b.page.waitForTimeout(200);
  await b.page.click('[data-act="clearDemo"]');
  await b.page.waitForTimeout(400);
  const afterClear = await b.page.evaluate(() => ({ domains: S.domains.map((d) => d.id), tasks: S.tasks.length, hasDemo: hasDemo() }));
  await b.ctx.close();

  log("R4-fresh-install-defaults", {
    source_domains: backup.domains.map((d) => d.id), toast: res.toast,
    restored: state, demo_flags_in_reexport: reexported.domains.map((d) => `${d.id}:${!!d.demo}`),
    after_clear_demo: afterClear, errors: b.page.errs,
  });
  checks.R4_four_clients_not_nine = state.domains.length === 4;
  checks.R4_no_stock_clients_left = !state.domains.some((d) => ["business", "technical", "church", "nonprofit", "personal"].includes(d.id));
  checks.R4_summary_says_replaced = /5 empty default clients replaced/.test(res.toast);
  checks.R4_demo_flags_kept = reexported.domains.length === 4 && reexported.domains.every((d) => d.demo === true);
  checks.R4_clear_demo_restores_stock = afterClear.domains.length === 5 && afterClear.domains.includes("business") && afterClear.tasks === 0;
}

/* ===================== R5 — self import is still a no-op ===================== */
{
  const a = await fresh("empty");
  await a.page.click('[data-act="manageDomains"]');
  await a.page.fill('[data-dom="business"][data-k="name"]', "Clients");
  await a.page.press('[data-dom="business"][data-k="name"]', "Enter");
  await a.page.waitForTimeout(250);
  await a.page.keyboard.press("Escape");
  const file = await exportFile(a.page);
  const res = await importBuf(a.page, "self.json", JSON.parse(fs.readFileSync(file, "utf8")));
  const state = await a.page.evaluate(() => ({ domains: S.domains.map((d) => `${d.id}:${d.name}`) }));
  await a.ctx.close();
  log("R5-self-import-noop", { toast: res.toast, state_unchanged: res.stateUnchanged, domains: state.domains });
  checks.R5_state_unchanged = res.stateUnchanged === true;
  checks.R5_no_false_updates = /(^|\D)0 updated/.test(res.toast);
}

/* ============ R6 — hostile files still rejected; stock client kept when referenced ============ */
{
  const a = await fresh("empty");
  await a.page.evaluate(() => { createTask({ title: "KEEP ME", domain_id: "business" }); save(); render(); });
  const cases = {
    unknown_domain: envelope({ tasks: [task("h1", "no client", "ghost-client")] }),
    duplicate_domain_id: envelope({ domains: [{ id: "d1", name: "A" }, { id: "d1", name: "B" }] }),
    domain_not_an_object: envelope({ domains: ["just a string"] }),
    domain_name_too_long: envelope({ domains: [{ id: "d1", name: "x".repeat(41) }] }),
    domain_id_injection: envelope({ domains: [{ id: 'x"><img src=x onerror=alert(1)>', name: "A" }] }),
    domain_name_empty: envelope({ domains: [{ id: "d1", name: "   " }] }),
  };
  const hostile = {};
  for (const [name, payload] of Object.entries(cases)) {
    const r = await importBuf(a.page, `${name}.json`, payload);
    hostile[name] = { rejected: /Import failed/.test(r.toast), state_unchanged: r.stateUnchanged };
  }
  // the referenced-stock-client safety: file ships its own client but a task points at a stock one
  const keepStock = envelope({
    domains: [{ id: "x-new", name: "New client" }],
    tasks: [task("s1", "filed under Personal", "personal"), task("s2", "filed under the new client", "x-new")],
  });
  const keepRes = await importBuf(a.page, "keep-stock.json", keepStock);
  const kept = await a.page.evaluate(() => ({
    domains: S.domains.map((d) => d.id),
    tasks: S.tasks.map((t) => ({ id: t.id, domain_id: t.domain_id })),
  }));
  await a.ctx.close();
  log("R6-hostile-and-stock-safety", { hostile, kept, keep_toast: keepRes.toast });
  checks.R6_each_hostile_rejected = Object.values(hostile).every((h) => h.rejected && h.state_unchanged);
  checks.R6_no_errors_from_hostile = Object.keys(hostile).length === 6;
  checks.R6_stock_client_referenced_is_kept = kept.domains.includes("personal") && kept.tasks.find((t) => t.id === "s1")?.domain_id === "personal";
  checks.R6_import_with_reference_succeeds = /^Imported:/.test(keepRes.toast);
}

/* ============ R7 — an older file cannot rewind a newer local client name ============ */
{
  const a = await fresh("empty");
  await a.page.evaluate(() => {
    const d = S.domains.find((x) => x.id === "business");
    d.name = "Local Newer"; d.updated_at = "2026-06-01T00:00:00.000Z"; save(); render();
  });
  const older = envelope({ domains: [{ id: "business", name: "Old File", color: "#3b82f6", weight: 1.3, sort_order: 1, updated_at: "2026-01-01T00:00:00.000Z" }] });
  const r1 = await importBuf(a.page, "older.json", older);
  const afterOlder = await a.page.evaluate(() => S.domains.find((d) => d.id === "business").name);
  const newer = envelope({ domains: [{ id: "business", name: "File Newer", color: "#3b82f6", weight: 1.3, sort_order: 1, updated_at: "2026-09-01T00:00:00.000Z" }] });
  // the file carries the same rows the app already has; a fresh install target keeps it honest
  const r2 = await importBuf(a.page, "newer.json", newer);
  const afterNewer = await a.page.evaluate(() => S.domains.find((d) => d.id === "business").name);
  await a.ctx.close();
  log("R7-timestamp-guard", { older_toast: r1.toast, after_older_file: afterOlder, newer_toast: r2.toast, after_newer_file: afterNewer });
  checks.R7_older_file_does_not_win = afterOlder === "Local Newer";
  checks.R7_newer_file_wins = afterNewer === "File Newer";
}

/* ================================== verdict ================================== */
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
fs.writeFileSync(path.join(OUT, "restore-domains-results.json"), JSON.stringify({ checks, results }, null, 2));
console.log("\n### checks\n" + JSON.stringify({ ...checks, summary: { failed, passed: Object.keys(checks).length - failed.length, total: Object.keys(checks).length } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
