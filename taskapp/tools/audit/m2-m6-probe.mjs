/**
 * m2–m6 probe — the five minors from QA rounds one and two (card t_ac713c63).
 *
 * Drives the real page in headless Chromium and asserts:
 *   m2  at 375 px every view tab is on screen, 44 px tall, and nothing scrolls sideways
 *   m3  List view keeps document.scrollWidth at the device width; the table scrolls inside
 *       its own wrapper (and does not scroll at desktop width)
 *   m4  a beforeunload prompt fires when a panel holds unsaved input and never otherwise
 *   m5  two exports of unchanged data are identical once `exported_at` is dropped, tag ids
 *       are stable across exports, and a file carrying old random tag ids still imports
 *   m6  two tabs on the SAME record: the panel announces the other tab's change, saving
 *       asks first, cancelling keeps the typed text, confirming replaces it; and edits to
 *       DIFFERENT records still merge instead of last-write-wins
 *
 * Usage: node tools/audit/m2-m6-probe.mjs http://127.0.0.1:3601/
 * Exits 0 only if every assertion passes.
 */
import { chromium } from "playwright-core";

const EXEC = process.env.CHROME || "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const URL_ = process.argv[2] || "http://127.0.0.1:3601/";

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  " + JSON.stringify(detail)}`);
}

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote"],
});

async function fresh(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.errs = [];
  page.dialogs = [];
  page.on("pageerror", e => page.errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") page.errs.push("console: " + m.text()); });
  page.on("dialog", async d => { page.dialogs.push(d.type()); await (page.dialogPolicy ? page.dialogPolicy(d) : d.accept()); });
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForFunction(() => typeof S !== "undefined" && !!document.querySelector("#main"));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => typeof S !== "undefined");
  const welcome = await page.$("[data-act=welcomeDemo]");
  if (welcome) { await page.click("[data-act=welcomeDemo]"); await page.waitForTimeout(400); }
  return { ctx, page };
}

/* ======================================================================= m2 */
{
  const { ctx, page } = await fresh({ width: 375, height: 667 });
  const tabs = await page.evaluate(() => {
    const nav = document.querySelector("#tabs");
    return {
      wrap: getComputedStyle(nav).flexWrap,
      scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth,
      buttons: [...nav.querySelectorAll("button")].map(b => {
        const r = b.getBoundingClientRect();
        return { t: b.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height),
                 onScreen: r.left >= 0 && r.right <= window.innerWidth };
      }),
    };
  });
  const offscreen = tabs.buttons.filter(b => !b.onScreen).map(b => b.t);
  check("m2 every tab is on screen at 375", offscreen.length === 0, { offscreen, tabs: tabs.buttons.map(b => [b.t, b.left, b.right]) });
  check("m2 tab strip does not scroll sideways", tabs.scrollWidth <= tabs.clientWidth, { scrollWidth: tabs.scrollWidth, clientWidth: tabs.clientWidth });
  check("m2 all seven tabs present", tabs.buttons.length === 7, tabs.buttons.map(b => b.t));
  check("m2 tabs keep a 44px touch height", tabs.buttons.every(b => b.h >= 44), tabs.buttons.map(b => b.h));

  // Walk every view by clicking its tab, as a finger would.
  const views = ["home", "focus", "board", "list", "projects", "research", "settings"];
  const widths = {};
  for (const v of views) {
    await page.click(`#tabs button[data-view="${v}"]`);
    await page.waitForTimeout(160);
    widths[v] = await page.evaluate(() => ({
      view: ui.view,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
  }
  const wide = Object.entries(widths).filter(([, w]) => w.docScrollWidth > w.innerWidth || w.view === undefined);
  check("m2 Settings is reachable by tapping it at 375", widths.settings.view === "settings", widths.settings);
  check("m3 no view widens the 375px layout viewport", wide.length === 0, widths);

  // Settings is where Export lives — prove the button is on screen too.
  const exportBtn = await page.evaluate(() => {
    const b = document.querySelector('main [data-act="export"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { onScreen: r.left >= 0 && r.right <= window.innerWidth && r.width > 0, box: [Math.round(r.left), Math.round(r.right)] };
  });
  check("m2 Export is reachable at 375 (Settings view)", exportBtn && exportBtn.onScreen, exportBtn);
  await ctx.close();
}

/* ======================================================================= m3 */
{
  const { ctx, page } = await fresh({ width: 375, height: 667 });
  await page.click('#tabs button[data-view="list"]');
  await page.waitForTimeout(200);
  const mob = await page.evaluate(() => {
    const t = document.querySelector("main .tablewrap table"), w = document.querySelector("main .tablewrap");
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      wrapper: !!w,
      wrapperOvx: w ? getComputedStyle(w).overflowX : null,
      wrapperWidth: w ? Math.round(w.getBoundingClientRect().width) : null,
      tableWidth: t ? Math.round(t.getBoundingClientRect().width) : null,
      rows: t ? t.querySelectorAll("tbody tr").length : 0,
    };
  });
  check("m3 list page is exactly the device width at 375", mob.docScrollWidth === mob.innerWidth, mob);
  check("m3 the table scrolls inside its own wrapper", mob.wrapper && mob.wrapperOvx === "auto" && mob.tableWidth > mob.wrapperWidth, mob);
  check("m3 the list still renders its rows", mob.rows >= 10, { rows: mob.rows });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  const desk = await page.evaluate(() => {
    const t = document.querySelector("main .tablewrap table"), w = document.querySelector("main .tablewrap");
    return {
      wrapperOvx: getComputedStyle(w).overflowX,
      wrapperScrolls: w.scrollWidth > w.clientWidth + 1,
      tableWidth: Math.round(t.getBoundingClientRect().width),
      wrapperWidth: Math.round(w.getBoundingClientRect().width),
      docScrollWidth: document.documentElement.scrollWidth,
    };
  });
  check("m3 desktop list is unchanged (no inner scroll, full-width table)", !desk.wrapperScrolls && desk.tableWidth === desk.wrapperWidth && desk.docScrollWidth === 1280, desk);
  await ctx.close();
}

/* ======================================================================= m4 */
{
  const { ctx, page } = await fresh();
  const idle = await page.evaluate(() => ({
    typeofHandler: typeof window.onbeforeunload,
    returns: typeof window.onbeforeunload === "function" ? String(window.onbeforeunload({ preventDefault(){}, returnValue: undefined })) : null,
  }));
  check("m4 an unload guard is registered", idle.typeofHandler === "function", idle);
  check("m4 an idle tab does not prompt", idle.returns === "undefined", idle);

  await page.evaluate(() => openTask(null));
  await page.waitForTimeout(300);
  await page.fill("#f_title", "DRAFT — refresh me");
  const dirty = await page.evaluate(() => ({
    dirty: drawerHasUnsavedChanges(),
    guard: typeof window.onbeforeunload === "function" ? window.onbeforeunload({ preventDefault(){}, returnValue: undefined }) : null,
  }));
  check("m4 typed-but-unsaved panel is dirty", dirty.dirty === true, dirty);
  check("m4 the guard returns a value (prompts) when dirty", dirty.guard === "", dirty);

  // Prove the browser really shows the prompt on reload.
  page.dialogs = [];
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(400);
  check("m4 reloading mid-edit raises a beforeunload prompt", page.dialogs.includes("beforeunload"), page.dialogs);
  const after = await page.evaluate(() => ({ titleField: !!document.querySelector("#f_title"), draftSaved: S.tasks.some(t => t.title.includes("DRAFT")) }));
  check("m4 the unsaved draft is not written to storage", after.draftSaved === false, after);

  // And after saving normally, a reload does not prompt.
  await page.evaluate(() => openTask(null));
  await page.waitForTimeout(300);
  await page.fill("#f_title", "Saved properly");
  page.dialogs = [];
  await page.click('[data-act="saveTask"]');
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(400);
  check("m4 a saved panel does not prompt on reload", !page.dialogs.includes("beforeunload"), page.dialogs);
  await ctx.close();
}

/* ======================================================================= m5 */
{
  const { ctx, page } = await fresh();
  const exp = await page.evaluate(() => {
    const a = JSON.stringify(exportData(), null, 2);
    const b = JSON.stringify(exportData(), null, 2);
    const strip = s => JSON.stringify({ ...JSON.parse(s), exported_at: null });
    const A = JSON.parse(a), B = JSON.parse(b);
    const idsA = A.tags.map(t => t.id).sort(), idsB = B.tags.map(t => t.id).sort();
    return {
      byteIdenticalWithTimestamp: a === b,
      identicalAfterDroppingTimestamp: strip(a) === strip(b),
      tagIdsStable: JSON.stringify(idsA) === JSON.stringify(idsB),
      tagIds: idsA.slice(0, 12),
      tagIdShapeOk: A.tags.every(t => /^tag-[a-z0-9-]+$/.test(t.id)),
      tagCount: A.tags.length,
      timestampDiffers: A.exported_at !== null,
    };
  });
  check("m5 exports are identical once exported_at is dropped", exp.identicalAfterDroppingTimestamp, { byteIdenticalWithTimestamp: exp.byteIdenticalWithTimestamp });
  check("m5 tag ids are stable across exports", exp.tagIdsStable && exp.tagIdShapeOk, { tagIds: exp.tagIds, count: exp.tagCount });

  // Old files (random tag ids, as rc.2 wrote them) must still import by name.
  const legacy = await page.evaluate(() => {
    const data = JSON.parse(JSON.stringify(exportData()));
    const map = {};
    data.tags = data.tags.map(t => { const id = "3f2b1c4e-" + Math.random().toString(16).slice(2, 10); map[t.id] = id; return { id, name: t.name }; });
    data.task_tags = data.task_tags.map(tt => ({ ...tt, tag_id: map[tt.tag_id] }));
    data.format = "taskapp-export"; data.version = 1;
    const before = S.tasks.filter(t => t.tags.length).length;
    const taggedBefore = S.tasks.flatMap(t => t.tags.map(g => t.id + ":" + g)).sort();
    importData(data);
    const taggedAfter = S.tasks.flatMap(t => t.tags.map(g => t.id + ":" + g)).sort();
    return { before, tasksWithTags: before, tagMapIdentical: JSON.stringify(taggedBefore) === JSON.stringify(taggedAfter), tagged: taggedAfter.length };
  });
  check("m5 a file with rc.2-era random tag ids still imports by tag name", legacy.tagMapIdentical, legacy);
  check("m5 no page errors during export/import", page.errs.length === 0, page.errs.slice(0, 3));
  await ctx.close();
}

/* ======================================================================= m6 */
{
  const { ctx, page: a } = await fresh();
  const b = await ctx.newPage();
  b.on("dialog", d => d.accept());
  b.errs = [];
  b.on("pageerror", e => b.errs.push(String(e)));
  await b.goto(URL_, { waitUntil: "load" });
  await b.waitForFunction(() => typeof S !== "undefined");
  await b.waitForTimeout(300);

  const taskId = await a.evaluate(() => S.tasks[0].id);
  const originalTitle = await a.evaluate(id => taskById(id).title, taskId);

  /* --- 6a: nothing typed in tab A → A's panel quietly shows B's version ---------- */
  await a.evaluate(id => openTask(id), taskId);
  await a.waitForTimeout(250);
  await b.evaluate(id => { openTask(id); }, taskId);
  await b.waitForTimeout(250);
  await b.fill("#f_title", originalTitle + " [saved in B]");
  await b.click('[data-act="saveTask"]');
  await b.waitForTimeout(600);
  const refreshed = await a.evaluate(() => ({
    drawerOpen: !document.querySelector("#drawer").classList.contains("hidden"),
    title: document.querySelector("#f_title")?.value ?? null,
    staleNotice: !!document.querySelector("#drawer .stalenote"),
  }));
  check("m6 an untouched panel picks up the other tab's version", refreshed.drawerOpen && (refreshed.title || "").includes("[saved in B]"), refreshed);

  /* --- 6b: typed in tab A → A is told, saving asks, cancel keeps the text -------- */
  await a.fill("#f_title", originalTitle + " [typed in A, unsaved]");
  await b.evaluate(id => { openTask(id); }, taskId);
  await b.waitForTimeout(200);
  await b.fill("#f_title", originalTitle + " [second change in B]");
  await b.click('[data-act="saveTask"]');
  await b.waitForTimeout(600);
  const warned = await a.evaluate(() => ({
    staleNotice: !!document.querySelector("#drawer .stalenote"),
    noticeText: document.querySelector("#drawer .stalenote")?.innerText.replace(/\s+/g, " ").trim().slice(0, 120) || null,
    typedKept: (document.querySelector("#f_title")?.value || "").includes("typed in A"),
    drawerStale: ui.drawerStale,
  }));
  check("m6 a panel with unsaved text says the record changed in another tab", warned.staleNotice && warned.drawerStale, warned);
  check("m6 the notice does not eat the typed text", warned.typedKept, warned);

  // Cancel the save: storage must still hold B's version and A must still hold its text.
  a.dialogPolicy = d => d.dismiss();
  a.dialogs = [];
  await a.click('[data-act="saveTask"]');
  await a.waitForTimeout(500);
  const afterCancel = await a.evaluate(id => ({
    dialogs: null,
    stored: JSON.parse(localStorage.getItem("taskapp.v1")).tasks.find(t => t.id === id).title,
    typed: document.querySelector("#f_title")?.value || "",
    drawerOpen: !document.querySelector("#drawer").classList.contains("hidden"),
  }), taskId);
  check("m6 saving over the other tab's change asks first", a.dialogs.includes("confirm"), a.dialogs);
  check("m6 cancelling leaves the other tab's saved version in storage", afterCancel.stored.includes("[second change in B]"), afterCancel);
  check("m6 cancelling keeps every character typed here", afterCancel.typed.includes("typed in A") && afterCancel.drawerOpen, afterCancel);

  // Confirm the save: A's version wins, deliberately and on the record.
  a.dialogPolicy = d => d.accept();
  await a.click('[data-act="saveTask"]');
  await a.waitForTimeout(600);
  const afterConfirm = await b.evaluate(id => JSON.parse(localStorage.getItem("taskapp.v1")).tasks.find(t => t.id === id).title, taskId);
  check("m6 confirming replaces the other tab's version", afterConfirm.includes("typed in A"), { afterConfirm });

  /* --- 6c: different records still merge (no last-write-wins) ------------------- */
  await a.reload({ waitUntil: "load" });
  await a.waitForFunction(() => typeof S !== "undefined");
  await a.waitForTimeout(300);
  const idA = await a.evaluate(() => S.tasks[1].id);
  await a.evaluate(id => openTask(id), idA);
  await a.waitForTimeout(250);
  await a.fill("#f_title", "edited in A while B adds a task");
  await b.fill("#e_task", "Added in B");
  await b.keyboard.press("Enter");
  await b.waitForTimeout(700);
  await a.click('[data-act="saveTask"]');
  await a.waitForTimeout(700);
  const merge = await a.evaluate(() => ({
    aEdit: S.tasks.some(t => t.title === "edited in A while B adds a task"),
    bTask: S.tasks.some(t => t.title.includes("Added in B")),
    staleNotice: !!document.querySelector("#drawer .stalenote"),
  }));
  check("m6 edits to different records still merge", merge.aEdit && merge.bTask, merge);
  check("m6 no page errors in either tab", a.errs.length === 0 && b.errs.length === 0, [...a.errs, ...b.errs].slice(0, 3));
  await ctx.close();
}

await browser.close();
console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
