/**
 * P1-3 / P1-4 regression: keyboard operability and touch target size.
 *
 * Run: node tools/audit/a11y-probe.mjs http://127.0.0.1:3601/
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("dialog", (d) => d.dismiss().catch(() => {}));
await page.goto(TARGET, { waitUntil: "load" });

/* ---- semantics ---- */
const aria = await page.evaluate(() => {
  localStorage.clear(); S = blankState();
  const t = createTask({ title: "a11y task", domain_id: "business" }); save();
  ui.view = "board"; render(); openTask(t.id);
  const d = document.querySelector("#drawer"), tabs = [...document.querySelectorAll("#tabs button")];
  return {
    drawerRole: d.getAttribute("role"),
    drawerAriaModal: d.getAttribute("aria-modal"),
    drawerAriaLabel: d.getAttribute("aria-label"),
    tablistRole: document.querySelector("#tabs").getAttribute("role"),
    tabsRole: [...new Set(tabs.map((b) => b.getAttribute("role")))],
    tabsAriaSelected: tabs.map((b) => b.getAttribute("aria-selected")),
    cards: [...document.querySelectorAll(".card")].map((c) => ({ tabindex: c.getAttribute("tabindex"), role: c.getAttribute("role"), label: c.getAttribute("aria-label") })),
    columnRegion: document.querySelector(".col")?.getAttribute("role"),
    columnLabel: document.querySelector(".col")?.getAttribute("aria-label"),
    toastLive: document.querySelector("#toasts")?.getAttribute("aria-live") ?? "created-on-first-toast",
    listRows: (() => { ui.view = "list"; render(); return [...document.querySelectorAll("tr.row")].map((r) => r.getAttribute("tabindex")); })(),
    chipPressed: (() => { ui.view = "board"; render(); return [...document.querySelectorAll("#filters .chip[data-domain]")].map((c) => c.getAttribute("aria-pressed")); })(),
  };
});

/* ---- focus trap: 45 Tabs must stay in the drawer, Escape closes, focus returns ---- */
const trap = await page.evaluate(() => {
  ui.view = "board"; render();
  const card = document.querySelector(".card");
  card.focus(); card.click();
  return { open: !document.querySelector("#drawer").classList.contains("hidden"), focusedOnOpen: document.activeElement.id || document.activeElement.tagName };
});
let escapedAt = null;
for (let i = 0; i < 45; i++) {
  await page.keyboard.press("Tab");
  const inDrawer = await page.evaluate(() => !!document.activeElement.closest("#drawer"));
  if (!inDrawer && escapedAt === null) escapedAt = i;
}
await page.keyboard.press("Escape");
await page.waitForTimeout(80);
const escape = await page.evaluate(() => ({
  hidden: document.querySelector("#drawer").classList.contains("hidden"),
  focusIsCard: !!document.activeElement.closest(".card"),
  focusTag: document.activeElement.tagName,
}));

/* ---- board keyboard operation ---- */
const before = await page.evaluate(() => {
  ui.view = "board"; render();
  const t = S.tasks[0], card = document.querySelector(`.card[data-id="${CSS.escape(t.id)}"]`);
  card.focus();
  return { id: t.id, status: t.status, focus: document.activeElement === card };
});
await page.keyboard.press("Enter");
const openedByKeyboard = await page.evaluate(() => !document.querySelector("#drawer").classList.contains("hidden"));
await page.keyboard.press("Escape");
await page.waitForTimeout(50);
await page.evaluate((id) => { document.querySelector(`.card[data-id="${CSS.escape(id)}"]`).focus(); }, before.id);
await page.keyboard.down("Control"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("Control");
await page.waitForTimeout(50);
const afterMove = await page.evaluate((id) => ({ status: taskById(id).status, focusIsCard: !!document.activeElement.closest(".card") }), before.id);

/* ---- tabs: arrow keys move and select (board -> next tab is list) ---- */
await page.evaluate(() => { document.querySelector('#tabs button[data-view="board"]').focus(); });
await page.keyboard.press("ArrowRight");
const tabNav = await page.evaluate(() => ({ view: ui.view, selected: document.querySelector("#tabs button.on").dataset.view,
  ariaSelected: document.querySelector("#tabs button.on").getAttribute("aria-selected") }));

/* ---- tap targets at 390x844 ---- */
const tap = await page.evaluate(() => {
  ui.view = "board"; render();
  const rect = (e) => { const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const small = [...document.querySelectorAll("button, a, .chk, input[type=color], select, input.inp")]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ tag: e.tagName, id: e.id || null, cls: e.className.toString().slice(0, 30), txt: (e.textContent || "").trim().slice(0, 20), ...rect(e) }))
    .filter((b) => b.w < 44 || b.h < 44);
  const header = document.querySelector("header").getBoundingClientRect();
  return { total: document.querySelectorAll("button, a, .chk, input[type=color], select, input.inp").length,
           below44: small, headerHeight: +header.height.toFixed(0),
           overflow: document.documentElement.scrollWidth > innerWidth + 1 };
});

const checks = {
  drawer_is_dialog: aria.drawerRole === "dialog" && aria.drawerAriaModal === "true" && !!aria.drawerAriaLabel,
  tablist_semantics: aria.tablistRole === "tablist" && aria.tabsRole.join() === "tab" &&
    aria.tabsAriaSelected.filter((v) => v === "true").length === 1,
  cards_focusable_buttons: aria.cards.length > 0 && aria.cards.every((c) => c.tabindex === "0" && c.role === "button" && c.label),
  columns_grouped_with_counts: aria.columnRegion === "region" && /\d+ tasks?/.test(aria.columnLabel || ""),
  list_rows_focusable: aria.listRows.length > 0 && aria.listRows.every((v) => v === "0"),
  chips_announce_pressed: aria.chipPressed.length > 0 && aria.chipPressed.every((v) => v === "true" || v === "false"),
  focus_trap_holds: escapedAt === null,
  escape_closes_and_restores_focus: escape.hidden === true && escape.focusIsCard === true,
  enter_opens_task_from_keyboard: trap.open === true && openedByKeyboard === true,
  ctrl_arrow_moves_task: afterMove.status !== before.status,
  tab_arrow_keys_work: tabNav.view === "list" && tabNav.selected === "list" && tabNav.ariaSelected === "true",
  tap_targets_all_44: tap.below44.length === 0,
  no_horizontal_overflow: tap.overflow === false,
};
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log("### aria\n" + JSON.stringify(aria, null, 2));
console.log("### trap\n" + JSON.stringify({ ...trap, escapedAtTab: escapedAt, ...escape }, null, 2));
console.log("### keyboard_move\n" + JSON.stringify({ before, openedByKeyboard, afterMove, tabNav }, null, 2));
console.log("### tap\n" + JSON.stringify(tap, null, 2));
console.log("### checks\n" + JSON.stringify({ ...checks, summary: { failed } }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
