/**
 * TaskApp readiness probe — drives the real app in headless Chromium and prints
 * machine-readable evidence for docs/taskapp-readiness-audit.md.
 *
 * Run:  NODE_PATH=<dir with playwright-core> node tools/audit/probe.mjs <target-url>
 *       target-url e.g. http://127.0.0.1:3601/ or file:///home/Jerry/apps/taskapp/index.html
 *
 * This harness observes only. It does not modify index.html.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const ONLY = process.argv[3] || "all";

const XSS = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const out = {};

function log(name, data) {
  out[name] = data;
  console.log(`\n### ${name}\n` + JSON.stringify(data, null, 2));
}

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function newPage(url = TARGET) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__xss = 0;
    window.__alerts = [];
    const realAlert = window.alert.bind(window);
    window.alert = (m) => { window.__alerts.push(String(m)); window.__xss = (window.__xss || 0) + 1; };
    window.__consoleErrors = [];
    window.addEventListener("error", (e) => window.__consoleErrors.push(String(e.message)));
  });
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  page.on("dialog", async (d) => { await d.dismiss().catch(() => {}); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(150);
  return { ctx, page, requested };
}

/* ---------------------------------------------------------------- 1. boot */
{
  const { ctx, page, requested } = await newPage();
  const boot = await page.evaluate(() => ({
    title: document.title,
    hasS: typeof S === "object",
    tasks: S.tasks.length,
    domains: S.domains.map((d) => d.name),
    views: [...document.querySelectorAll("#tabs button")].map((b) => b.textContent),
    localStorageWorks: (() => { try { localStorage.setItem("__t", "1"); const v = localStorage.getItem("__t") === "1"; localStorage.removeItem("__t"); return v; } catch (e) { return "THROWS: " + e.name; } })(),
    jsErrors: window.__consoleErrors,
    mainLength: document.querySelector("#main").innerHTML.length,
  }));
  const external = requested.filter((u) => !u.startsWith("http://127.0.0.1:3601") && !u.startsWith(TARGET.split("?")[0]));
  log("boot", { ...boot, requests: requested, externalRequests: external });
  await ctx.close();
}

/* ------------------------------------------------------- 2. XSS by field */
if (ONLY === "all" || ONLY === "xss") {
  const { ctx, page } = await newPage();

  // Each case seeds exactly one user-controlled string, renders every view +
  // the relevant drawer, then reports whether script executed or raw markup
  // landed in the DOM.
  const cases = [
    {
      id: "task.title",
      seed: (p) => { S = blankState(); createTask({ title: p, domain_id: "business" }); },
      open: () => {},
    },
    {
      id: "task.description",
      seed: (p) => { S = blankState(); createTask({ title: "ok", description: p, domain_id: "business" }); },
      open: () => {},
    },
    {
      id: "note.body",
      seed: (p) => { S = blankState(); const t = createTask({ title: "ok", domain_id: "business" }); addNote(p, { task_id: t.id }); },
      open: () => openTask(S.tasks[0].id),
    },
    {
      id: "project.name",
      seed: (p) => { S = blankState(); createProject({ name: p, domain_id: "business", criticality: 3 }); },
      open: () => openProject(S.projects[0].id),
    },
    {
      id: "project.description",
      seed: (p) => { S = blankState(); createProject({ name: "ok", description: p, domain_id: "business", criticality: 3 }); },
      open: () => openProject(S.projects[0].id),
    },
    {
      id: "domain.name",
      seed: (p) => { S = blankState(); createDomain(p.slice(0, 40)); },
      open: () => openDomains(),
    },
    {
      id: "topic.name",
      seed: (p) => { S = blankState(); createTopic({ name: p, domain_id: "technical" }); },
      open: () => openTopic(S.research[0].id, "preview"),
    },
    {
      id: "topic.body (markdown preview)",
      seed: (p) => { S = blankState(); const r = createTopic({ name: "ok", domain_id: "technical" }); updateTopic(r.id, { body: p }); },
      open: () => openTopic(S.research[0].id, "preview"),
    },
    {
      id: "topic.log (markdown)",
      seed: (p) => { S = blankState(); const r = createTopic({ name: "ok", domain_id: "technical" }); r.log.push({ id: "l1", body: p, created_at: new Date().toISOString() }); },
      open: () => openTopic(S.research[0].id, "preview"),
    },
    {
      id: "topic.link.url (javascript: scheme)",
      seed: (p) => { S = blankState(); createTopic({ name: "ok", domain_id: "technical", links: [{ id: "l1", url: p, label: "click me" }] }); },
      open: () => openTopic(S.research[0].id, "preview"),
    },
    {
      id: "tag",
      seed: (p) => { S = blankState(); createTask({ title: "ok", domain_id: "business", tags: [p] }); },
      open: () => {},
    },
    {
      id: "quick-add bar",
      seed: (p) => { S = blankState(); const q = parseQuick(p); createTask({ ...q, domain_id: q.domain_id || "business" }); },
      open: () => {},
    },
  ];

  const results = [];
  for (const c of cases) {
    for (const payload of [XSS, `"><svg onload="window.__xss=9">`, "`" + XSS + "`", "# " + XSS]) {
      // Seed the case and render; the app's functions live in the page's
      // global lexical scope, so they are callable from evaluate().
      const res = await page.evaluate(({ id, payload }) => {
        window.__xss = 0;
        const seeders = {
          "task.title": (p) => { S = blankState(); createTask({ title: p, domain_id: "business" }); },
          "task.description": (p) => { S = blankState(); createTask({ title: "ok", description: p, domain_id: "business" }); },
          "note.body": (p) => { S = blankState(); const t = createTask({ title: "ok", domain_id: "business" }); addNote(p, { task_id: t.id }); },
          "project.name": (p) => { S = blankState(); createProject({ name: p, domain_id: "business", criticality: 3 }); },
          "project.description": (p) => { S = blankState(); createProject({ name: "ok", description: p, domain_id: "business", criticality: 3 }); },
          "domain.name": (p) => { S = blankState(); createDomain(p.slice(0, 40)); },
          "topic.name": (p) => { S = blankState(); createTopic({ name: p, domain_id: "technical" }); },
          "topic.body (markdown preview)": (p) => { S = blankState(); const r = createTopic({ name: "ok", domain_id: "technical" }); updateTopic(r.id, { body: p }); },
          "topic.log (markdown)": (p) => { S = blankState(); const r = createTopic({ name: "ok", domain_id: "technical" }); r.log.push({ id: "l1", body: p, created_at: new Date().toISOString() }); },
          "topic.link.url (javascript: scheme)": (p) => { S = blankState(); createTopic({ name: "ok", domain_id: "technical", links: [{ id: "l1", url: p, label: "click me" }] }); },
          "tag": (p) => { S = blankState(); createTask({ title: "ok", domain_id: "business", tags: [p] }); },
          "quick-add bar": (p) => { S = blankState(); const q = parseQuick(p); createTask({ ...q, domain_id: q.domain_id || "business" }); },
        };
        const openers = {
          "note.body": () => openTask(S.tasks[0].id),
          "project.name": () => openProject(S.projects[0].id),
          "project.description": () => openProject(S.projects[0].id),
          "domain.name": () => openDomains(),
          "topic.name": () => openTopic(S.research[0].id, "preview"),
          "topic.body (markdown preview)": () => openTopic(S.research[0].id, "preview"),
          "topic.log (markdown)": () => openTopic(S.research[0].id, "preview"),
          "topic.link.url (javascript: scheme)": () => openTopic(S.research[0].id, "preview"),
        };
        try {
          seeders[id](payload);
          const injected = [];
          for (const v of ["home", "board", "list", "focus", "projects", "research", "settings"]) {
            ui.view = v; try { render(); } catch (e) { injected.push(v + " RENDER-THREW"); }
            for (const el of document.querySelectorAll("#main img, #main svg, #main iframe")) injected.push(v + ":" + el.tagName);
          }
          if (openers[id]) {
            openers[id]();
            for (const el of document.querySelectorAll("#drawer img, #drawer svg, #drawer iframe")) injected.push("drawer:" + el.tagName + ":" + (el.getAttribute("onerror") || el.getAttribute("onload") || ""));
            document.querySelector("#drawer [data-act=close]")?.click();
          }
          return { case: id, payload, xss: window.__xss, injected: [...new Set(injected)].slice(0, 6) };
        } catch (e) {
          return { case: id, payload, error: String(e.message) };
        }
      }, { id: c.id, payload });
      results.push(res);
    }
  }
  const hits = results.filter((r) => r.xss > 0 || (r.injected && r.injected.length));
  log("xss_direct", { total: results.length, hits, clean: results.filter((r) => !r.xss && !(r.injected || []).length).map((r) => r.case + " | " + r.payload.slice(0, 28)) });

  // Does clicking the rendered link/markup execute? Click a javascript: link.
  const clickTest = await page.evaluate(() => {
    window.__xss = 0;
    S = blankState();
    createTopic({ name: "ok", domain_id: "technical", links: [{ id: "l1", url: "javascript:window.__xss=42", label: "click me" }] });
    ui.view = "research"; render();
    openTopic(S.research[0].id, "preview");
    const a = [...document.querySelectorAll("#drawer a")].find((x) => x.textContent.includes("click me"));
    if (!a) return { rendered: false };
    a.click();
    return { rendered: true, href: a.getAttribute("href"), xssAfterClick: window.__xss };
  });
  log("xss_link_click", clickTest);
  await ctx.close();
}

/* ------------------------------------------------------ 3. import trust */
if (ONLY === "all" || ONLY === "import") {
  const { ctx, page } = await newPage();
  const cases = [
    { id: "malformed JSON text", raw: "{not json" },
    { id: "wrong format string", obj: { format: "something-else", version: 1 } },
    { id: "no version field", obj: { format: "taskapp-export", domains: [{ id: "x", name: "Injected" }] } },
    { id: "future version", obj: { format: "taskapp-export", version: 99, domains: [] } },
    { id: "tasks is a string", obj: { format: "taskapp-export", version: 1, tasks: "abc" } },
    { id: "domains is a string", obj: { format: "taskapp-export", version: 1, domains: "abc" } },
    { id: "domain name null (throws mid-way)", obj: { format: "taskapp-export", version: 1, domains: [{ id: "d1", name: null }] } },
    { id: "task with bogus status + no validation", obj: { format: "taskapp-export", version: 1, domains: [{ id: "business", name: "Business" }], tasks: [{ id: "t1", title: "ghost", domain_id: "business", status: "not-a-status", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] } },
    { id: "task id with attribute-breaking quote", obj: { format: "taskapp-export", version: 1, domains: [{ id: "business", name: "Business" }], tasks: [{ id: `a"><img src=x onerror="window.__xss=77">`, title: "attr", domain_id: "business", status: "todo", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] } },
    { id: "attachment with javascript: url", obj: { format: "taskapp-export", version: 1, domains: [{ id: "business", name: "Business" }], tasks: [{ id: "t9", title: "att", domain_id: "business", status: "todo", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }], attachments: [{ id: "a1", task_id: "t9", file_name: "invoice.pdf", url: "javascript:window.__xss=55", mime_type: "text/uri-list", size_bytes: 0, created_at: "2026-01-01T00:00:00Z" }] } },
    { id: "null task id (upsert key collision)", obj: { format: "taskapp-export", version: 1, domains: [{ id: "business", name: "Business" }], tasks: [{ id: null, title: "n1", domain_id: "business", status: "todo", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }, { id: null, title: "n2", domain_id: "business", status: "todo", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] } },
  ];

  // Mirror the app's own import handler (line ~1585): snapshot, import, save, rollback on throw.
  const results = [];
  for (const c of cases) {
    const r = await page.evaluate(({ c }) => {
      window.__xss = 0;
      S = blankState();
      const before = JSON.stringify(S);
      const t0 = performance.now();
      try {
        const data = c.raw !== undefined ? JSON.parse(c.raw) : c.obj;
        const st = importData(data);
        const saved = save();
        const after = { tasks: S.tasks.length, domains: S.domains.map((d) => String(d.name)), notes: S.notes.length, attachments: S.attachments.length };
        return { id: c.id, outcome: "accepted", savedOk: saved, stats: st, after, rollback: false, ms: +(performance.now() - t0).toFixed(1) };
      } catch (e) {
        S = JSON.parse(before);
        return { id: c.id, outcome: "threw -> rollback", error: String(e.message).slice(0, 120), after: { tasks: S.tasks.length, domains: S.domains.map((d) => d.name) }, rollback: true };
      }
    }, { c });
    results.push(r);
  }
  log("import_validation", { results });

  // Does an imported attribute-breaking id actually execute script on render?
  const attrXss = await page.evaluate(() => {
    window.__xss = 0;
    S = blankState();
    importData({
      format: "taskapp-export", version: 1,
      domains: [{ id: "business", name: "Business" }],
      tasks: [{ id: `a"><img src=x onerror="window.__xss=77">`, title: "attr", domain_id: "business", status: "todo", priority: "medium", recurrence: "none", recurrence_interval: 1, tags: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
    });
    ui.view = "board"; render();
    const injected = [...document.querySelectorAll("#main img")].map((i) => i.getAttribute("onerror"));
    return { xss: window.__xss, injectedImgs: injected };
  });
  log("import_attribute_xss", attrXss);
  await ctx.close();
}

/* ---------------------------------------------- 4. quota / silent failure */
if (ONLY === "all" || ONLY === "quota") {
  const { ctx, page } = await newPage();
  const quota = await page.evaluate(() => {
    localStorage.clear();
    S = blankState();
    const rec = [];
    // Grow with realistic 1 KB titles until the write fails.
    const big = "x".repeat(1000);
    let n = 0;
    for (; n < 20000; n++) {
      S.tasks.push({ id: "t" + n, title: big, description: "", domain_id: "business", project_id: null, status: "todo", position: n, priority: "medium", due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
      if (!save()) { rec.push({ failedAtTask: n, approxChars: JSON.stringify(S).length, storedChars: (localStorage.getItem("taskapp.v1") || "").length }); break; }
    }
    return rec[0] || { failedAtTask: null };
  });
  log("quota_growth", quota);

  // 1.5 MB attachment: does save succeed, and what does the user see?
  const att = await page.evaluate(() => {
    localStorage.clear(); S = blankState(); save();
    const t = createTask({ title: "attach me", domain_id: "business" }); save();
    const dataUrl = "data:application/octet-stream;base64," + "A".repeat(1.5 * 1024 * 1024);
    const before = JSON.stringify(S).length;
    S.attachments.push({ id: "a1", task_id: t.id, file_name: "big.bin", mime_type: "application/octet-stream", size_bytes: 1572864, data_url: dataUrl, created_at: "2026-01-01T00:00:00Z" });
    const ok = save();
    return { attachmentBytes: dataUrl.length, stateChars: JSON.stringify(S).length, saveOk: ok, note: ok ? "saved" : "save() returned false" };
  });
  log("quota_single_attachment", att);

  // Silent-loss path: a write that ignores save()'s return value (note delete/add).
  const silent = await page.evaluate(() => {
    localStorage.clear(); S = blankState(); save();
    const t = createTask({ title: "victim", domain_id: "business" }); save();
    // fill the remaining space
    let filled = false;
    for (let i = 0; i < 20000 && !filled; i++) {
      S.tasks.push({ id: "f" + i, title: "y".repeat(900), description: "", domain_id: "business", project_id: null, status: "todo", position: i, priority: "medium", due_date: null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
      if (!save()) { S.tasks.pop(); filled = true; }
    }
    // addNote path in act("addNote") calls save() and ignores the result
    const before = localStorage.getItem("taskapp.v1").length;
    addNote("THIS NOTE WAS NEVER PERSISTED", { task_id: t.id });
    const saveOk = save();              // <- same call the app makes, result ignored
    const inMemory = S.notes.length;
    return { localStorageChars: before, saveOk, notesInMemory: inMemory, persistedLen: JSON.parse(localStorage.getItem("taskapp.v1")).notes.length };
  });
  log("quota_silent_write", silent);

  // Does the unpersisted change survive a reload?
  await page.reload({ waitUntil: "load" });
  const afterReload = await page.evaluate(() => ({ notesAfterReload: S.notes.length, tasksAfterReload: S.tasks.length }));
  log("quota_after_reload", afterReload);
  await ctx.close();
}

/* ----------------------------------------------------------- 5. scale */
if (ONLY === "all" || ONLY === "scale") {
  const { ctx, page } = await newPage();
  const scale = await page.evaluate(() => {
    localStorage.clear();
    S = blankState();
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      S.projects.push({ id: "p" + i, name: "Project " + i, domain_id: ["business", "technical", "church", "nonprofit", "personal"][i % 5], description: "desc", criticality: 1 + (i % 5), status: "active", due_date: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null });
    }
    for (let i = 0; i < 5000; i++) {
      S.tasks.push({ id: "t" + i, title: "Task number " + i + " for the scale test", description: i % 10 === 0 ? "Description text" : "", domain_id: ["business", "technical", "church", "nonprofit", "personal"][i % 5], project_id: "p" + (i % 500), status: ["todo", "in_progress", "blocked", "completed"][i % 4], position: i, priority: ["high", "medium", "low"][i % 3], due_date: i % 3 === 0 ? "2026-12-0" + (1 + (i % 9)) : null, recurrence: "none", recurrence_interval: 1, recurrence_parent_id: null, research_id: null, source: "web", external_id: null, tags: i % 7 === 0 ? ["tag" + (i % 20)] : [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", completed_at: null, archived_at: null });
    }
    const buildMs = performance.now() - t0;
    const bytes = JSON.stringify(S).length;
    const tSave = performance.now(); const saveOk = save(); const saveMs = performance.now() - tSave;
    const timings = {};
    for (const v of ["home", "board", "list", "focus", "projects", "research"]) {
      ui.view = v;
      const a = performance.now(); render(); const b = performance.now();
      timings[v] = +(b - a).toFixed(1);
    }
    // filter/search hot path
    ui.q = "Task number 49";
    const a1 = performance.now(); ui.view = "list"; render(); const searchMs = +(performance.now() - a1).toFixed(1);
    ui.q = "";
    return { tasks: S.tasks.length, projects: S.projects.length, stateChars: bytes, stateMB: +(bytes / 1048576).toFixed(2), saveOk, saveMs: +saveMs.toFixed(1), buildMs: +buildMs.toFixed(1), renderMs: timings, searchRenderMs: searchMs, domNodes: document.querySelectorAll("*").length };
  });
  log("scale_5000", scale);

  // Empty-state baseline for comparison
  const empty = await page.evaluate(() => {
    localStorage.clear(); S = blankState(); save();
    const t = {};
    for (const v of ["home", "board", "list", "focus"]) { ui.view = v; const a = performance.now(); render(); t[v] = +(performance.now() - a).toFixed(2); }
    return t;
  });
  log("scale_empty_baseline", empty);
  await ctx.close();
}

/* --------------------------------------------------- 6. a11y / mobile */
if (ONLY === "all" || ONLY === "a11y") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__xss = 0; window.alert = () => {}; });
  await page.goto(TARGET, { waitUntil: "load" });
  await page.waitForTimeout(150);

  const aria = await page.evaluate(() => {
    S = blankState();
    const t = createTask({ title: "a11y task", domain_id: "business" });
    addNote("a note", { task_id: t.id });
    ui.view = "board"; render();
    openTask(t.id);
    const d = document.querySelector("#drawer");
    const tabs = [...document.querySelectorAll("#tabs button")];
    return {
      drawerRole: d.getAttribute("role"),
      drawerAriaModal: d.getAttribute("aria-modal"),
      drawerAriaLabel: d.getAttribute("aria-label"),
      drawerHiddenAttr: d.getAttribute("aria-hidden"),
      tabsRoles: [...new Set(tabs.map((b) => b.getAttribute("role")))],
      tabsAriaSelected: tabs.map((b) => b.getAttribute("aria-selected")),
      tablistRole: document.querySelector("#tabs").getAttribute("role"),
      cardsHaveTabindex: [...document.querySelectorAll(".card")].map((c) => c.getAttribute("tabindex")),
      listRowsFocusable: [...document.querySelectorAll("tr.row")].map((r) => r.getAttribute("tabindex")),
      cardTagName: document.querySelector(".card")?.tagName,
      cardRole: document.querySelector(".card")?.getAttribute("role"),
      chkTag: document.querySelector(".chk")?.tagName,
      chkTabbable: document.querySelector(".chk")?.tabIndex,
      scrimPresent: !!document.querySelector("#scrim"),
      drawerFocusableCount: [...d.querySelectorAll("button,input,select,textarea,a[href]")].filter((e) => e.tabIndex >= 0).length,
    };
  });
  log("aria", aria);

  // focus trap: Tab repeatedly with the drawer open, see if focus escapes
  const trap = await page.evaluate(() => { ui.view = "board"; render(); openTask(S.tasks[0].id); return true; });
  void trap;
  await page.waitForTimeout(80);
  let escapedAt = null;
  const trail = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      return { inDrawer: !!a.closest("#drawer"), tag: a.tagName, id: a.id || null, txt: (a.textContent || "").trim().slice(0, 18) };
    });
    trail.push(info);
    if (!info.inDrawer && escapedAt === null) escapedAt = i;
  }
  log("focus_trap", { escapedAtTab: escapedAt, firstEscape: escapedAt !== null ? trail[escapedAt] : null, sample: trail.slice(0, 12) });

  const esc = await page.evaluate(() => { const open1 = !document.querySelector("#drawer").classList.contains("hidden"); return { drawerOpenBefore: open1 }; });
  await page.keyboard.press("Escape");
  const escAfter = await page.evaluate(() => ({ drawerHiddenAfterEsc: document.querySelector("#drawer").classList.contains("hidden") }));
  log("escape_key", { ...esc, ...escAfter });

  // tap targets
  await page.evaluate(() => { ui.view = "board"; render(); });
  const tap = await page.evaluate(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    const all = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; });
    const tooSmall = all("button, a, .chk, input[type=color]").filter((b) => b.w < 44 || b.h < 44).length;
    return {
      viewport: { w: innerWidth, h: innerHeight },
      headerTabs: all("#tabs button").slice(0, 3),
      newTaskBtn: box("#newTask"),
      closeBtn: (() => { openTask(S.tasks[0].id); const b = box("#drawer .x"); document.querySelector("#drawer [data-act=close]")?.click(); return b; })(),
      chk: box(".chk"),
      totalInteractive: all("button, a, .chk, input[type=color]").length,
      below44: tooSmall,
      bodyHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  log("tap_targets", tap);

  // contrast per theme (WCAG 2.1)
  const contrast = await page.evaluate(() => {
    const lum = (hex) => {
      const h = hex.trim().replace("#", "");
      const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
    const res = {};
    for (const theme of ["dark", "light", "midnight"]) {
      document.documentElement.dataset.theme = theme;
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      const pairs = {
        "text/bg": [v("--text"), v("--bg")],
        "text/panel": [v("--text"), v("--panel")],
        "muted/bg": [v("--muted"), v("--bg")],
        "muted/panel": [v("--muted"), v("--panel")],
        "on-accent/accent": [v("--on-accent"), v("--accent")],
        "danger-fg/danger-bg": [v("--danger-fg"), v("--danger-bg")],
        "ok-fg/bg": [v("--ok-fg"), v("--bg")],
        "medium-fg/bg": [v("--medium-fg"), v("--bg")],
        "tag-fg/panel": [v("--tag-fg"), v("--panel")],
        "over-fg/over-bg": [v("--over-fg"), v("--over-bg")],
        "soon-fg/soon-bg": [v("--soon-fg"), v("--soon-bg")],
        "info-fg/bg": [v("--info-fg"), v("--bg")],
      };
      res[theme] = Object.fromEntries(Object.entries(pairs).map(([k, [a, b]]) => [k, ratio(a, b)]));
    }
    document.documentElement.dataset.theme = "dark";
    return res;
  });
  log("contrast", contrast);

  const mobile = await page.evaluate(() => ({
    viewportMeta: document.querySelector('meta[name=viewport]')?.content,
    boardColumns: [...document.querySelectorAll(".board .col")].map((c) => Math.round(c.getBoundingClientRect().width)),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    headerHeight: Math.round(document.querySelector("header").getBoundingClientRect().height),
  }));
  log("mobile", mobile);
  await ctx.close();
}

/* ---------------------------------------- 7. file:// + private + network */
if (ONLY === "all" || ONLY === "file") {
  const fileUrl = "file:///home/Jerry/apps/taskapp/index.html";
  const { ctx, page, requested } = await newPage(fileUrl);
  const f = await page.evaluate(() => ({
    lsWrite: (() => { try { localStorage.setItem("__probe", "1"); return localStorage.getItem("__probe") === "1"; } catch (e) { return "THROWS " + e.name; } })(),
    lsReadAfterWrite: (() => { try { return localStorage.getItem("__probe"); } catch (e) { return "THROWS " + e.name; } })(),
    stateLoaded: typeof S === "object",
    tasks: S.tasks.length,
    origin: location.origin,
    // does a fresh task persist across a reload on file:// ?
  }));
  await page.evaluate(() => { S = blankState(); createTask({ title: "file-protocol task", domain_id: "business" }); save(); });
  await page.reload({ waitUntil: "load" });
  const afterReload = await page.evaluate(() => ({ tasksAfterReload: S.tasks.length, title: S.tasks[0]?.title || null, inbox: (localStorage.getItem("taskapp.v1") || "").length }));
  log("file_protocol", { ...f, ...afterReload, requests: requested });
  await ctx.close();

  // private / incognito window: is there any warning that data is ephemeral?
  const privCtx = await browser.newContext();
  const p2 = await privCtx.newPage();
  await p2.goto(TARGET, { waitUntil: "load" });
  const priv = await p2.evaluate(() => ({
    tasksAtStart: S.tasks.length,
    warningShown: /private|incognito/i.test(document.body.innerText),
    storageEstimate: navigator.storage && navigator.storage.estimate ? "available" : "n/a",
  }));
  await p2.evaluate(() => { createTask({ title: "ephemeral", domain_id: "business" }); save(); });
  await privCtx.close();
  const privCtx2 = await browser.newContext();
  const p3 = await privCtx2.newPage();
  await p3.goto(TARGET, { waitUntil: "load" });
  const priv2 = await p3.evaluate(() => ({ tasksInFreshPrivateWindow: S.tasks.length }));
  await privCtx2.close();
  log("private_window", { ...priv, ...priv2 });
}

await browser.close();
console.log("\n=== done ===");
