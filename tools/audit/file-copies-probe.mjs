/**
 * Does a second copy of the app on the same machine share localStorage?
 * Relevant because a buyer who downloads an update next to the old copy (or a
 * second "workspace") needs to know whether the two files share one store.
 *
 * Run: node tools/audit/file-copies-probe.mjs
 */
import { chromium } from "playwright-core";
import { copyFileSync, mkdirSync } from "node:fs";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const SRC = "/home/Jerry/apps/taskapp/index.html";
const DIR = "/home/Jerry/.hermes/profiles/engineer/cache/scratch/filecopy";
mkdirSync(DIR, { recursive: true });
const COPY = DIR + "/taskapp-copy.html";
copyFileSync(SRC, COPY);

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext();

const a = await ctx.newPage();
await a.goto("file://" + SRC, { waitUntil: "load" });
const wrote = await a.evaluate(() => {
  localStorage.clear(); S = blankState();
  createTask({ title: "FROM-COPY-A", domain_id: "business" }); return save();
});

const b = await ctx.newPage();
await b.goto("file://" + COPY, { waitUntil: "load" });
const seen = await b.evaluate(() => ({ tasks: S.tasks.length, titles: S.tasks.map((t) => t.title), origin: location.origin }));

const c = await ctx.newPage();
await c.goto("http://127.0.0.1:3601/", { waitUntil: "load" });
const httpSeen = await c.evaluate(() => ({ tasks: S.tasks.length, titles: S.tasks.map((t) => t.title), origin: location.origin }));

console.log(JSON.stringify({ wroteOnA: wrote, secondFileCopySees: seen, httpOriginSees: httpSeen }, null, 2));
await browser.close();
