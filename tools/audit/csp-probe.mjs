/**
 * P2-1 + the no-network promise.
 *
 *  1. a normal page load makes exactly one request: the document itself;
 *  2. the inline script still runs (the CSP hash matches);
 *  3. an injected inline event handler is BLOCKED by CSP - this is the defence that
 *     survives the next escaping mistake, proven independently of the escaping fix;
 *  4. connect-src 'none' refuses fetch() outright.
 *
 * Run: node tools/audit/csp-probe.mjs http://127.0.0.1:3601/
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
await page.addInitScript(() => {
  window.__xss = 0;
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI });
  });
});
const requests = [];
page.on("request", (r) => requests.push(r.url()));
await page.goto(TARGET, { waitUntil: "load" });
await page.waitForTimeout(300);
// snapshot BEFORE the injection test, which legitimately requests a broken image
const initialRequests = requests.slice();

const loaded = await page.evaluate(() => ({
  requestsSoFar: null,
  tabsRendered: document.querySelectorAll("#tabs button").length,
  mainHasContent: (document.querySelector("#main")?.textContent || "").length > 0,
  stateReady: typeof S !== "undefined" && !!S.domains,
  cspMeta: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content?.slice(0, 60),
}));

/* 3 - the defence, independent of input validation */
const injection = await page.evaluate(async () => {
  window.__xss = 0; window.__csp = [];
  document.querySelector("#main").innerHTML = '<img src="nope.png" onerror="window.__xss=1">';
  await new Promise((r) => setTimeout(r, 400));
  return { xss: window.__xss, violations: window.__csp.slice(0, 4) };
});

/* 4 - connect-src 'none' */
const net = await page.evaluate(async () => {
  window.__csp = [];
  let rejected = false, error = "";
  try { await fetch("https://example.com/outbound"); } catch (e) { rejected = true; error = String(e.message).slice(0, 80); }
  await new Promise((r) => setTimeout(r, 200));
  return { rejected, error, violations: window.__csp.map((v) => v.directive) };
});

const checks = {
  zero_external_requests: initialRequests.every((u) => u === TARGET),
  single_document_request: initialRequests.length === 1,
  app_booted_under_csp: loaded.tabsRendered === 7 && loaded.mainHasContent && loaded.stateReady,
  csp_meta_present: /script-src 'sha256-/.test(loaded.cspMeta || ""),
  injected_handler_blocked: injection.xss === 0 && injection.violations.some((v) => /script-src/i.test(v.directive)),
  fetch_refused_by_connect_src: net.rejected === true && net.violations.some((d) => /connect-src/i.test(d)),
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### load\n" + JSON.stringify({ ...loaded, requests: initialRequests }, null, 2));
console.log("### injection\n" + JSON.stringify(injection, null, 2));
console.log("### network\n" + JSON.stringify(net, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
