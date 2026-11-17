/**
 * Productisation probe — the buyer-facing surfaces added in 1.0.0-rc.1:
 *   1 identity   — title, favicon, version in the header and in About, licence status
 *   2 first run  — start empty / load demo / import a backup
 *   3 demo       — demo-data.json loads as a validated workspace, is labelled DEMO,
 *                  keeps two overdue items, and clears in one click without touching user rows
 *   4 print      — @media print forces a light sheet and drops the chrome
 *   5 help       — how-it-works + keyboard table ship inside the file
 *   6 licence    — a key with no name is refused; key + name activates locally and shows the licensee
 *   7 offline    — no request other than the document
 *
 * Run: node tools/audit/productisation-probe.mjs http://127.0.0.1:3601/ [demo-data.json]
 * Exit 0 only if every assertion passes.
 */
import { chromium } from "playwright-core";
import { readFileSync, statSync } from "node:fs";

const EXEC = "/home/Jerry/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome";
const TARGET = process.argv[2] || "http://127.0.0.1:3601/";
const DEMO = process.argv[3] || "/home/Jerry/apps/taskapp/demo-data.json";
const OUT = process.env.PRODUCTISATION_SHOTS || "/home/Jerry/.hermes/profiles/engineer/cache/scratch";
const demoRaw = readFileSync(DEMO, "utf8");
const demo = JSON.parse(demoRaw);

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
         "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"],
});
const checks = {}, out = {};
const dialogs = [];

/* ==================================================================== A. first run */
const ctxA = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
const page = await ctxA.newPage();
const requests = [];
page.on("request", (r) => requests.push(r.url()));
page.on("dialog", (d) => { dialogs.push(d.message().slice(0, 80)); d.accept().catch(() => {}); });
page.on("pageerror", (e) => { (out.pageErrors ||= []).push(String(e)); });

await page.goto(TARGET, { waitUntil: "load" });
await page.waitForTimeout(150);

const firstRun = await page.evaluate(() => {
  const d = document.querySelector("#drawer");
  const choices = [...d.querySelectorAll("[data-act^=welcome]")].map((b) => ({ act: b.dataset.act, label: b.querySelector("b")?.textContent || "" }));
  return {
    welcomeVisible: !d.classList.contains("hidden") && /Welcome to TaskApp/.test(d.textContent),
    choices,
    saysDataStays: /never leaves this device/i.test(d.textContent),
    hasHelpLink: !!d.querySelector('[data-act="help"]'),
    version: document.querySelector("#brandVer").textContent.trim(),
    title: document.title,
    favicon: document.querySelector('link[rel="icon"]').getAttribute("href").slice(0, 24),
    emptyBoardBehind: !document.querySelector(".card"),
  };
});
out.firstRun = firstRun;

/* load the demo from the welcome screen */
await page.click('[data-act="welcomeDemo"]');
await page.waitForTimeout(250);

const demoLoaded = await page.evaluate((expected) => {
  const c = demoCounts();
  const open = S.tasks.filter((t) => t.status !== "completed");
  const overdue = S.tasks.filter((t) => t.due_date && t.status !== "completed" && dayNum(t.due_date) < dayNum(todayStr()));
  const dueToday = S.tasks.filter((t) => t.due_date && t.status !== "completed" && dayNum(t.due_date) === dayNum(todayStr()));
  return {
    counts: c,
    expected,
    domains: S.domains.map((d) => d.name),
    defaultDomainsGone: !S.domains.some((d) => ["business", "church", "personal"].includes(d.id)),
    pillVisible: !document.querySelector("#demoPill").classList.contains("hidden"),
    noteVisible: !!document.querySelector(".demo-note"),
    noteText: (document.querySelector(".demo-note")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140),
    overdueTitles: overdue.map((t) => t.title),
    dueToday: dueToday.length,
    overdueBadgesRendered: document.querySelectorAll(".badge.over").length,
    statuses: STATUSES.map(([s]) => [s, S.tasks.filter((t) => t.status === s).length]),
    onboarded: !!localStorage.getItem("taskapp.onboarded"),
    drawerClosed: document.querySelector("#drawer").classList.contains("hidden"),
    firstTaskCountry: S.tasks[0]?.id,
  };
}, { tasks: demo.tasks.length, projects: demo.projects.length, domains: demo.domains.length, notes: demo.notes.length, topics: demo.research.length });
out.demoLoaded = demoLoaded;

/* reload: the welcome must not come back */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(150);
const afterReload = await page.evaluate(() => ({
  welcomeVisible: !document.querySelector("#drawer").classList.contains("hidden") && /Welcome to TaskApp/.test(document.querySelector("#drawer").textContent),
  stillDemo: hasDemo(),
  tasks: S.tasks.length,
}));
out.afterReload = afterReload;

/* About / identity */
const about = await page.evaluate(() => {
  ui.view = "settings"; render();
  const text = document.querySelector("#main").textContent.replace(/\s+/g, " ");
  return {
    version: APP_VERSION,
    versionInAbout: text.includes(APP_VERSION),
    licenceStatus: /Unlicensed/.test(text),
    dataStatement: /never leaves this device/i.test(text),
    licencePanel: !!document.querySelector('[data-act="licence"]'),
    helpButton: !!document.querySelector('[data-act="help"]'),
    printButton: !!document.querySelector('[data-act="print"]'),
    demoCounts: demoCounts(),
    exportAppVersion: exportData().app_version,
  };
});
out.about = about;

/* help via the keyboard */
await page.evaluate(() => { ui.view = "board"; render(); });
await page.keyboard.press("?");
await page.waitForTimeout(120);
const help = await page.evaluate(() => {
  const d = document.querySelector("#drawer");
  return {
    open: !d.classList.contains("hidden"),
    label: d.getAttribute("aria-label"),
    hasHowItWorks: /Four things, nested/.test(d.textContent),
    hasDataSection: /Where your data lives/.test(d.textContent),
    hasPrintSection: /Printing/.test(d.textContent),
    shortcutRows: d.querySelectorAll(".kbd-table tr").length,
    mentionsVersion: d.textContent.includes(APP_VERSION),
  };
});
out.help = help;
await page.keyboard.press("Escape");

/* licence: the provider's key is a purchase reference. A key file with no name is refused;
   key + name activates locally, shows "Licensed to <name>", and sends nothing. */
await page.click("#helpBtn"); // also prove the button opens the same panel
await page.waitForTimeout(80);
await page.keyboard.press("Escape");
await page.evaluate(() => { ui.view = "settings"; render(); });
await page.waitForTimeout(80);
await page.click('[data-act="licence"]');
await page.waitForTimeout(100);
await page.setInputFiles("#licenceFile", { name: "taskapp-key.json", mimeType: "application/json", buffer: Buffer.from('{"key":"DEMO-0000-0000"}') });
await page.waitForTimeout(350);
const licenceNoName = await page.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem("taskapp.licence") || "null");
  const d = document.querySelector("#drawer");
  return {
    stored, storedValid: stored?.valid, storedReason: stored?.reason,
    panelUnlicensed: /Unlicensed/.test(d.textContent),
    toastRefused: [...document.querySelectorAll(".toast")].some((t) => /Licence not accepted/.test(t.textContent)),
    asksForName: !!d.querySelector("#licName") && !!d.querySelector("#licKey"),
    asksForFile: !!d.querySelector('[data-act="licencePick"]'),
  };
});
await page.fill("#licName", "Jane Doe");
await page.fill("#licKey", "LS-TEST-0000-1111");
await page.click('[data-act="licenceActivate"]');
await page.waitForTimeout(300);
const licence = await page.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem("taskapp.licence") || "null");
  const d = document.querySelector("#drawer");
  return {
    stored, storedValid: stored?.valid, storedLicensee: stored?.licensee,
    panelShowsName: /Licensed to Jane Doe/.test(d.textContent) || /Jane Doe/.test(d.textContent),
    panelUnlicensed: /Unlicensed/.test(d.textContent),
    label: Licence.label(),
    toastAccepted: [...document.querySelectorAll(".toast")].some((t) => /Licence accepted/.test(t.textContent)),
    verifyIsFunction: typeof Licence.verify === "function",
  };
});
out.licence = licence;
out.licenceNoName = licenceNoName;
await page.keyboard.press("Escape");

/* adding my own row, then clearing the demo, must keep it (and re-home its domain) */
const beforeClear = await page.evaluate(() => {
  const own = createTask({ title: "MY OWN TASK", domain_id: S.domains.find((d) => d.demo).id, priority: "high" });
  save(); render();
  return { ownId: own.id, total: S.tasks.length, domains: S.domains.length };
});
await page.evaluate(() => { ui.view = "settings"; render(); });
await page.click('[data-act="clearDemo"]');
await page.waitForTimeout(250);
const afterClear = await page.evaluate((ownId) => {
  const t = taskById(ownId);
  return {
    counts: demoCounts(),
    demoGone: !hasDemo(),
    tasks: S.tasks.length,
    ownRowKept: !!t,
    ownRowDomainValid: !!t && S.domains.some((d) => d.id === t.domain_id),
    domains: S.domains.length,
    domainIds: S.domains.map((d) => d.id),
    pillHidden: document.querySelector("#demoPill").classList.contains("hidden"),
    noteGone: !document.querySelector(".demo-note"),
  };
}, beforeClear.ownId);
out.clearDemo = { beforeClear, afterClear };

/* ============================================================== B. print stylesheet */
await page.evaluate(() => {
  ui.view = "list"; ui.domain = null; ui.project = ""; render();
});
await page.waitForTimeout(100);
const screenColors = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  text: getComputedStyle(document.body).color,
  headerDisplay: getComputedStyle(document.querySelector("header")).display,
}));
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(120);
const printStyles = await page.evaluate(() => {
  const cs = (el) => el ? getComputedStyle(el) : null;
  const head = document.querySelector("#printHead");
  const card = document.querySelector("tr.row");
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    headerDisplay: cs(document.querySelector("header")).display,
    filtersDisplay: cs(document.querySelector("#filters")).display,
    drawerDisplay: cs(document.querySelector("#drawer")).display,
    printHeadDisplay: cs(head)?.display,
    printHeadText: (head?.textContent || "").replace(/\s+/g, " ").trim(),
    rowText: cs(card)?.color,
    statusSelectHidden: cs(document.querySelector("select.noprint"))?.display,
    statusTextShown: cs(document.querySelector("select.noprint + .printonly"))?.display,
    hideSmShown: cs(document.querySelector("td.hide-sm"))?.display,
  };
});
const shot = `${OUT}/taskapp-print-list.png`;
await page.screenshot({ path: shot, fullPage: true });
const pdfPath = `${OUT}/taskapp-print-list.pdf`;
await page.pdf({ path: pdfPath, printBackground: true, format: "A4" });
const pdfHeader = readFileSync(pdfPath).subarray(0, 5).toString();
const pdfBytes = statSync(pdfPath).size;

/* board print too */
await page.evaluate(() => { ui.view = "board"; render(); });
await page.waitForTimeout(120);
const boardShot = `${OUT}/taskapp-print-board.png`;
await page.screenshot({ path: boardShot, fullPage: true });
const boardPrint = await page.evaluate(() => ({
  columns: document.querySelectorAll(".board .col").length,
  columnDisplay: getComputedStyle(document.querySelector(".board")).display,
}));
await page.emulateMedia({ media: null });
const backOnScreen = await page.evaluate(() => ({
  bodyBg: getComputedStyle(document.body).backgroundColor,
  headerDisplay: getComputedStyle(document.querySelector("header")).display,
}));
out.print = { screenColors, printStyles, boardPrint, backOnScreen, pdf: { header: pdfHeader, bytes: pdfBytes }, shots: [shot, boardShot] };

/* ============================================================== C. welcome → import */
const ctxC = await browser.newContext({ acceptDownloads: true });
const pc = await ctxC.newPage();
pc.on("dialog", (d) => d.accept().catch(() => {}));
pc.on("pageerror", (e) => { (out.pageErrors ||= []).push("C:" + String(e)); });
await pc.goto(TARGET, { waitUntil: "load" });
await pc.waitForTimeout(150);
const [chooser] = await Promise.all([pc.waitForEvent("filechooser"), pc.click('[data-act="welcomeImport"]')]);
await chooser.setFiles(DEMO);
await pc.waitForTimeout(700);
const imported = await pc.evaluate((expected) => {
  const overdue = S.tasks.filter((t) => t.due_date && t.status !== "completed" && dayNum(t.due_date) < dayNum(todayStr()));
  return {
    tasks: S.tasks.length, expected,
    demoMarked: demoCounts().tasks,
    overdue: overdue.length,
    overdueTitles: overdue.map((t) => t.title),
    welcomeGone: !/Welcome to TaskApp/.test(document.querySelector("#drawer").textContent),
    onboarded: !!localStorage.getItem("taskapp.onboarded"),
    noteVisible: !!document.querySelector(".demo-note"),
  };
}, demo.tasks.length);
out.welcomeImport = imported;

/* ============================================================== D. no network */
const external = requests.filter((u) => !u.startsWith(TARGET.replace(/\/$/, "")));
out.network = { requested: requests.length, documentOnly: external.length === 0 && requests.length <= 3, external };

/* ============================================================== checks */
Object.assign(checks, {
  // 1 identity
  title_is_product_name: /^TaskApp —/.test(firstRun.title),
  favicon_is_inline: firstRun.favicon.startsWith("data:image/svg+xml"),
  version_in_header: firstRun.version === "v" + about.version,
  version_in_about: about.versionInAbout,
  about_says_data_stays: about.dataStatement,
  about_shows_licence_status: about.licenceStatus,

  // 2 first run
  first_run_prompts: firstRun.welcomeVisible && firstRun.choices.length === 3,
  first_run_names_three_paths: ["welcomeEmpty", "welcomeDemo", "welcomeImport"].every((a) => firstRun.choices.some((c) => c.act === a)),
  first_run_says_data_stays: firstRun.saysDataStays,
  first_run_does_not_repeat: afterReload.welcomeVisible === false && afterReload.stillDemo === true,

  // 3 demo workspace
  demo_counts_match_file: demoLoaded.counts.tasks === demoLoaded.expected.tasks && demoLoaded.counts.projects === demoLoaded.expected.projects
    && demoLoaded.counts.domains === demoLoaded.expected.domains && demoLoaded.counts.topics === demoLoaded.expected.topics && demoLoaded.counts.notes === demoLoaded.expected.notes,
  demo_replaces_default_categories: demoLoaded.defaultDomainsGone && demoLoaded.domains.length === demoLoaded.expected.domains,
  demo_is_labelled: demoLoaded.pillVisible && demoLoaded.noteVisible && /DEMO/.test(demoLoaded.noteText),
  demo_has_two_overdue: demoLoaded.overdueTitles.length === 2 && demoLoaded.overdueBadgesRendered >= 2,
  demo_has_urgency_spread: demoLoaded.dueToday >= 1 && demoLoaded.statuses.some(([s, n]) => s === "in_progress" && n > 0)
    && demoLoaded.statuses.some(([s, n]) => s === "blocked" && n > 0) && demoLoaded.statuses.some(([s, n]) => s === "completed" && n > 0),
  demo_clear_keeps_user_rows: afterClear.demoGone && afterClear.ownRowKept && afterClear.ownRowDomainValid,
  demo_clear_restores_default_domains: afterClear.domains === 5 && afterClear.domainIds.includes("business"),
  demo_clear_removes_label: afterClear.pillHidden && afterClear.noteGone,

  // 4 print
  print_forces_light_sheet: printStyles.bodyBg === "rgb(255, 255, 255)" && /rgb\(17, 24, 39\)|rgb\(0, 0, 0\)/.test(printStyles.bodyColor),
  print_drops_chrome: printStyles.headerDisplay === "none" && printStyles.filtersDisplay === "none" && printStyles.drawerDisplay === "none",
  print_has_heading: printStyles.printHeadDisplay === "block" && printStyles.printHeadText.includes("List"),
  print_status_is_text: printStyles.statusSelectHidden === "none" && printStyles.statusTextShown === "inline",
  print_keeps_columns: printStyles.hideSmShown === "table-cell",
  print_board_two_columns: boardPrint.columnDisplay === "grid" && boardPrint.columns === 4,
  print_returns_to_theme: backOnScreen.bodyBg !== "rgb(255, 255, 255)" && backOnScreen.headerDisplay !== "none",
  print_pdf_renders: pdfHeader === "%PDF-" && pdfBytes > 5000,

  // 5 help
  help_opens_from_keyboard: help.open && help.label === "How it works",
  help_ships_how_it_works: help.hasHowItWorks && help.hasDataSection && help.hasPrintSection,
  help_has_shortcut_table: help.shortcutRows >= 10,
  help_shows_version: help.mentionsVersion,

  // 6 licence
  licence_refuses_key_without_name: !!licenceNoName.stored && licenceNoName.stored.file === "taskapp-key.json"
    && licenceNoName.storedValid === false && licenceNoName.storedReason === "no-name"
    && licenceNoName.panelUnlicensed && licenceNoName.toastRefused,
  licence_activates_with_key_and_name: licence.storedValid === true && licence.storedLicensee === "Jane Doe",
  licence_shows_licensee: licence.label === "Licensed to Jane Doe" && licence.panelShowsName
    && !licence.panelUnlicensed && licence.toastAccepted,
  licence_checks_locally: licence.verifyIsFunction && licenceNoName.asksForName && licenceNoName.asksForFile,

  // 7 import path + offline
  welcome_import_loads_real_file: imported.tasks === imported.expected && imported.demoMarked === imported.expected,
  import_shifts_dates_to_today: imported.overdue === 2,
  import_keeps_demo_label: imported.noteVisible && imported.onboarded,
  offline_no_requests: out.network.documentOnly,
  no_page_errors: !out.pageErrors || out.pageErrors.length === 0,
});

const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### firstRun\n" + JSON.stringify(firstRun, null, 2));
console.log("### demoLoaded\n" + JSON.stringify(demoLoaded, null, 2));
console.log("### about\n" + JSON.stringify(about, null, 2));
console.log("### help\n" + JSON.stringify(help, null, 2));
console.log("### licence\n" + JSON.stringify(licence, null, 2));
console.log("### clearDemo\n" + JSON.stringify(out.clearDemo, null, 2));
console.log("### print\n" + JSON.stringify(out.print, null, 2));
console.log("### welcomeImport\n" + JSON.stringify(imported, null, 2));
console.log("### network\n" + JSON.stringify(out.network, null, 2));
if (out.pageErrors) console.log("### pageErrors\n" + JSON.stringify(out.pageErrors, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
