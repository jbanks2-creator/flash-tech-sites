/**
 * P0-1 / P1-1 regression: imported JSON is untrusted input.
 *
 * Before hardening (1.0.0-beta.1) every hostile file below was ACCEPTED and case 1
 * executed script in the page. After hardening the whole file is validated before S is
 * touched, so each hostile file must be REJECTED with the state left byte-identical.
 * A valid export must still import (the control case), or the validator is too strict.
 *
 * Run: node tools/audit/confirm-link-xss.mjs http://127.0.0.1:3601/
 * Exit code 0 = every case behaved as required.
 */
import { chromium } from "playwright-core";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__xss = 0;
  window.__fired = [];
  window.alert = (m) => { window.__xss++; window.__fired.push("alert:" + String(m).slice(0, 40)); };
});
page.on("dialog", (d) => d.dismiss().catch(() => {}));
await page.goto(TARGET, { waitUntil: "load" });

const base = {
  format: "taskapp-export", version: 1,
  domains: [{ id: "business", name: "Business" }],
  tasks: [{
    id: "t1", title: "looks harmless", domain_id: "business", status: "todo", priority: "medium",
    recurrence: "none", recurrence_interval: 1, tags: [],
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  }],
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const results = {};

/* Every case: reset to a known state, try the import, report whether it was rejected,
   whether the state changed, and whether anything executed. */
async function attempt(data, after) {
  const seeded = await page.evaluate((payload) => {
    window.__xss = 0; window.__fired = [];
    localStorage.clear(); S = blankState(); save();
    const before = JSON.stringify(S);
    let threw = null, st = null;
    try { st = importData(payload); save(); } catch (e) { threw = String(e.message).split("\n")[0]; }
    return { threw, st, stateChanged: JSON.stringify(S) !== before,
             tasks: S.tasks.length, domains: S.domains.length };
  }, data);
  const extra = after ? await page.evaluate(after) : {};
  await page.waitForTimeout(600);
  const fx = await page.evaluate(() => ({ xss: window.__xss, fired: window.__fired }));
  return { ...seeded, ...extra, ...fx };
}

/* 1 — attribute injection through an unvalidated imported id (the P0) */
{
  const d = clone(base);
  d.tasks[0].id = `x"><img src="nope.png" onerror="window.__xss++;window.__fired.push('img-onerror')">`;
  const r = await attempt(d, () => {
    ui.view = "board"; render();
    return { imgsInMain: document.querySelectorAll("#main img").length };
  });
  results.id_attribute_injection = {
    ...r,
    verdict: r.threw && !r.stateChanged && r.xss === 0 && r.imgsInMain === 0 ? "PASS" : "FAIL",
  };
}

/* 2 — javascript: URL in an imported topic link, actually clicked */
{
  const d = clone(base);
  d.research = [{ id: "r1", name: "topic", domain_id: "business", status: "explore", level: 0, tags: [],
    body: "", log: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    links: [{ id: "l1", url: "javascript:window.__xss+=10;window.__fired.push('topic-link')", label: "click me" }] }];
  const r = await attempt(d, () => ({ rendered: !!document.querySelector("#drawer a") }));
  results.topic_link_javascript_url = { ...r, verdict: r.threw && !r.stateChanged && r.xss === 0 ? "PASS" : "FAIL" };
}

/* 3 — javascript: URL in an imported attachment link */
{
  const d = clone(base);
  d.attachments = [{ id: "a1", task_id: "t1", file_name: "invoice.pdf",
    url: "javascript:window.__xss+=100;window.__fired.push('attachment')",
    mime_type: "text/uri-list", size_bytes: 0, created_at: "2026-01-01T00:00:00.000Z" }];
  const r = await attempt(d, () => ({ rendered: !!document.querySelector("#drawer a") }));
  results.attachment_javascript_url = { ...r, verdict: r.threw && !r.stateChanged && r.xss === 0 ? "PASS" : "FAIL" };
}

/* 4 — markup in an imported note body and task title (the card's paste question).
       Accepted, but must render as text, never as elements. */
{
  const d = clone(base);
  d.notes = [{ id: "n1", task_id: "t1", project_id: null, body: `<img src=x onerror="window.__xss+=1000">`, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }];
  d.tasks[0].title = `<img src=x onerror="window.__xss+=1000">`;
  const r = await attempt(d, () => {
    ui.view = "board"; render(); openTask("t1");
    return { imgsInMain: document.querySelectorAll("#main img").length,
             imgsInDrawer: document.querySelectorAll("#drawer img").length,
             titleText: document.querySelector("#main .card .t")?.textContent,
             noteText: document.querySelector("#drawer .note")?.textContent?.slice(0, 60) };
  });
  results.imported_markup_in_title_and_note = {
    ...r,
    verdict: !r.threw && r.stateChanged && r.xss === 0 && r.imgsInMain === 0 && r.imgsInDrawer === 0 ? "PASS" : "FAIL",
  };
}

/* 5 — control: a well-formed export must still import */
{
  const d = clone(base);
  d.projects = [{ id: "p1", name: "Project one", domain_id: "business", description: "", criticality: 3, status: "active", due_date: null }];
  d.notes = [{ id: "n9", task_id: "t1", project_id: null, body: "a real note", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }];
  d.attachments = [{ id: "a9", task_id: "t1", file_name: "x.pdf", url: "https://example.com/x.pdf", mime_type: "text/uri-list", size_bytes: 0 }];
  const r = await attempt(d, () => ({ project: S.projects.length, note: S.notes.length, att: S.attachments.length }));
  results.valid_export_still_imports = {
    ...r,
    verdict: !r.threw && r.st?.inserted === 4 && r.project === 1 && r.note === 1 && r.att === 1 ? "PASS" : "FAIL",
  };
}

/* 6 — duplicate ids inside one file are a data-integrity error, not a silent merge */
{
  const d = clone(base);
  d.tasks.push({ ...clone(base.tasks[0]), title: "second with the same id" });
  const r = await attempt(d, () => ({}));
  results.duplicate_ids_in_file = { ...r, verdict: r.threw && !r.stateChanged ? "PASS" : "FAIL" };
}

const failed = Object.entries(results).filter(([, v]) => v.verdict !== "PASS").map(([k]) => k);
console.log(JSON.stringify({ ...results, summary: { cases: Object.keys(results).length, failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
