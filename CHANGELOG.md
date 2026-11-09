# Changelog

All notable changes to TaskApp. Versioning is semver for the single-file product.

## [1.0.0-rc.2] — 2026-11-09

Backup restore, fixed. The two blockers and one minor from the independent hostile-buyer QA
(card `t_d017dbe3`) were all in the domain loop of `importData()`; every other verdict in
that report held. **`taskapp.v1`, the storage schema and export format v1 are unchanged** —
a backup written by rc.1 restores here.

### Fixed

- **B1 — a client's new name, colour and place in the list now survive a restore.** An
  imported client whose id already exists is updated in place (name, colour, weight, order)
  and reported as *updated*, instead of being silently skipped while the toast claimed
  "0 updated". Rows without an `updated_at` — every export written before rc.2 — are
  authoritative; when both sides carry a timestamp the newer one wins, so an old file
  cannot rewind a rename made since.
- **B2 — a client-name collision no longer rejects the whole backup.** When a file's client
  carries a name the target already uses under a different id, the local row keeps its id
  and the imported tasks, projects and research rows that pointed at the file's id are
  re-filed onto it; the summary says `1 client matched by name`. The exact QA repro
  (rename the default, then add a new client with the old name) now restores normally,
  because the rename is applied before the name is tested.
- **m1 — restoring onto a fresh install no longer leaves nine clients.** When the target is
  a pristine install (the five stock clients, no rows) and the file carries clients, stock
  clients the file does not mention — and that nothing points at — are replaced; the
  summary reports `5 empty default clients replaced`. A stock client an imported row still
  references is kept, so no row is left pointing at an id that was not added.
- **Demo clients are cleared with the rest of the demo.** Client rows are now carried over
  whole on insert, so the `demo` flag survives an import; "Clear demo data" no longer
  leaves the demo clients behind after restoring a demo backup.

### Changed

- The import summary names the extra work it did: `clients matched by name`, `empty default
  clients replaced`.
- In-app help states the restore behaviour plainly: rows with the same id update (clients
  included), a fresh install's five empty starter clients are replaced by the file's, and a
  client whose name you already use is filed under the existing one.

### Verified

- `tools/audit/restore-domains-probe.mjs` — 34 assertions covering B1 (rename, colour,
  order), B2 (the exact QA repro through the UI, plus a real merge collision across tasks,
  projects and research), m1, demo flags surviving a restore, self-import as a no-op,
  six hostile domain fixtures and the stale-timestamp guard.
- Whole existing audit suite green: productisation, XSS through the UI and through imported
  JSON, silent write, corrupt store, quota, import/pre-import backup, a11y, undo, CSP and
  no-network, scale, `file://` protocol, CSP hash, demo drift.
- Buyer QA harness re-run against the built artifact: `qa-rt` (round trip 21/21 tasks,
  4/4 projects, 4/4 clients, 0 field diffs), `qa-data` (round trip diff 0, self-import
  unchanged, 10/10 hostile imports refused with state byte-identical), `qa-data2`
  (`T1 round-trips`, `T2` restored), `qa-data3` (collision restores: 1 task, 6 clients).

## [1.0.0-rc.1] — 2026-11-09

Productisation pass: the hardened app becomes something a stranger can buy, open and
trust. Still one self-contained HTML file, still no build step to *run* it, still no
dependencies, no network and no account. **`taskapp.v1` and the storage schema are
unchanged, so existing data loads as-is.**

### Added

- **Identity.** Product title, meta description and an inlined SVG favicon/app icon.
  `APP_VERSION` is visible in the header (`v1.0.0-rc.1`) and in Settings → About, which
  now states licence status and "your data never leaves this device" in one place.
- **First run.** With no stored state the app asks once: *start empty* / *load the demo
  workspace* / *import a backup*. The answer is remembered (`taskapp.onboarded`);
  dismissing with Escape counts as "not now", and the demo stays reachable in Settings.
  The empty board now offers the demo too.
- **Demo workspace.** `demo-data.json` — a real `taskapp-export` v1 file for a fictional IT
  services company: 4 clients, 4 projects, 21 tasks, 2 notes, 3 research topics, two
  overdue items and one due today. Embedded as `DEMO_DATA` (the app cannot fetch) and kept
  as a separate file for the website demo; `scripts/embed-demo.mjs --check` fails the build
  if they drift. Dates carry a `demo_anchor` and are shifted by `today − anchor` on load,
  so the demo never ages into a wall of overdue. Loaded rows are flagged `demo`, shown
  with a DEMO pill and notice, and cleared in one click — user rows are kept and re-homed.
- **Print / PDF.** `@media print` forces a light palette in all three themes, drops the
  header, filters, quick-add and buttons, adds a print-only heading (view · filter · date ·
  version), prints the board two columns per page and the status column as text. Verified
  by emulated-print screenshots and a generated A4 PDF.
- **Help.** `?` or the header button opens *How it works* — a one-page guide plus the
  keyboard-shortcut table — inside the file. No external docs.
- **Licence hook.** A licence screen that accepts a key file, persists it under
  `taskapp.licence`, and reports **"Unlicensed (beta)"**. Inert by design: commerce only
  has to set `Licence.verify(keyText, meta)`.
- **Distribution build.** `scripts/build.sh` → `dist/TaskApp-<version>.html` (readable, not
  minified), `.sha256`, and a buyer-facing `README.txt`. The build validates version/CSP/
  demo/no-network, builds twice and compares every output, and verifies the checksum.
- **Repo hygiene.** README with labelled screenshot placeholders, CHANGELOG, VERSION,
  LICENSE pointing at the EULA, and an explicit "deliberately dependency-free" note.

### Changed

- `product-surface-probe` reads the version from the page instead of hardcoding it, and
  asserts the header chip, About, licence status and export all agree.
- Every audit probe dismisses the first-run welcome, so the suite runs from a clean origin.
- `quota-probe`'s last section now asserts the P0-3 refusal (it still expected the old
  silent-overwrite behaviour, which made it crash rather than report).
- `+ Project` is hidden in the header between 900 px and 1439 px: brand + version + 7 tabs +
  search + five buttons do not fit on one row, and the version has to stay visible. It
  remains on the Projects view and in Home's entry switcher.

### Verification

`productisation-probe.mjs` — 39 assertions across first run, demo load/clear, identity,
print, help, licence and offline; all pass. The full hardening suite (XSS, silent writes,
corrupt store, import/backup, product surface, a11y, undo, CSP, scale, file://) still
passes, unchanged. `dist/TaskApp-1.0.0-rc.1.html` boots over `file://` with the demo and
persists across reload; its sha256 (`de268211…`) matches the bytes served on
`127.0.0.1:3601` and by an independent HTTP server.

### Still out of scope

IndexedDB attachments (1.5 MB cap stays), custom dialogs to replace `confirm()`/`prompt()`,
multi-tab merge, `prefers-color-scheme`/reduced motion, search inside notes. `SUPPORT_CONTACT`
remains blank until `ops` supplies the address.

## [1.0.0-beta.2] — 2026-11-09

Hardening pass driven by the readiness audit
(`businesses/flash-apps/docs/taskapp-readiness-audit.md`): every P0 and P1 closed, plus
the CSP that was P2-1. The product is still one self-contained HTML file with no build
step, no dependencies, no network and no account. **The storage key and schema are
unchanged, so existing data loads as-is.**

### Security

- **P0-1 — imported ids could execute script.** Imported `id` values were interpolated
  into HTML attributes unescaped (`data-id="${t.id}"` and 8 other sites), so an export
  file could run arbitrary JavaScript on the origin holding the buyer's data. Fixed on
  both sides: all 29 id interpolations now go through `esc()`, and import accepts ids
  only from `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`.
- **P2-1 — Content-Security-Policy.** Hash-based `script-src` for the two inline scripts,
  `connect-src 'none'`, `base-uri 'none'`, `object-src 'none'`, `form-action 'none'`.
  An injected inline handler is now blocked even if escaping is ever bypassed.
  `tools/audit/csp-hash.mjs` keeps the hashes honest.
- **P1-1 — import is validated, not trusted.** The whole file is checked before state is
  touched: required `version`, arrays are arrays, rows are plain objects with no
  functions, ids valid and unique per collection, enums, dates, parent references, and
  URL schemes (http/https/file only, so `javascript:` links are rejected outright).
  Everything is staged in a clone; a failure leaves the app byte-identical and reports the
  row and field. Duplicate ids inside one file are a hard error.

### Data safety

- **P0-2 — a refused write no longer leaves a phantom row.** `save()` is transactional:
  on `QuotaExceededError` the in-memory change is rolled back to the last blob that
  actually reached storage, a persistent banner names the largest attachment, and a
  warning appears at 84% before the wall. Fixes all nine call sites that ignored the
  return value.
- **P0-3 — an unreadable store is never replaced by an empty app.** On a parse or shape
  failure the raw string is copied to `taskapp.v1.recover-<ts>`, offered as a download,
  and writes are refused until the user acknowledges "Start fresh" (which keeps the copy).
- **Automatic pre-import backup**, plus a dismissable "no backup for N days" nudge after
  7 days with a one-click export.
- **P1-9 — undo.** Task, project, topic and domain deletion now name what they destroy
  (counts of notes, attachments, tasks kept). Note, link, study-log and attachment
  deletion are reversible for 15 seconds via an Undo button. The undo snapshot is dropped
  as soon as anything else is saved.

### Accessibility and usability

- **P1-3 — keyboard operability.** The drawer is a real dialog (`role`, `aria-modal`,
  `aria-label`), traps Tab and restores focus to whatever opened it. Board cards are
  focusable buttons: Enter/Space opens, Ctrl+←/→ moves between columns, Ctrl+↑/↓ reorders.
  List and Home rows are focusable. Columns announce their task count, tabs are a roving
  `tablist` with `aria-selected`, chips expose `aria-pressed`, toasts are an `aria-live`
  region, and every control has a visible focus ring.
- **P1-4 — touch targets.** Every interactive control is at least 44×44 at 390 px or on a
  coarse pointer. Header height at 390×844 is 256 px (was 265 px with 28 px targets).
- **P1-5 — contrast.** Dark-theme primary buttons were 3.22:1; the label is now a dark
  navy at 5.82:1 (4.97:1 on hover). All theme pairs pass 4.5:1.
- **P1-6 — one version, and an About panel.** `1.0.0-beta.2` is shown in Settings, written
  into every export as `app_version` (replacing the unexplained `html-1.5`), and the About
  section explains the three version numbers and points at the EULA and the purchase
  receipt for support.
- **P1-7 — sample data** is idempotent (27 tasks, not 54 on a second click), tags every
  row it creates, and Settings offers a one-click "Remove sample data" that deletes
  exactly those rows.
- **P1-8 — unsaved edits are not discarded silently.** ×, scrim and Escape ask before
  throwing away typed changes.

### Performance

- **P1-2 — 5,000 tasks stay usable.** Measured with `tools/audit/scale-probe.mjs`:

  | | before | after |
  |---|---|---|
  | Board render | 760.6 ms (32,958 DOM nodes) | 22.7 ms (2,144) |
  | List render | 450.0 ms (60,565) | 45.6 ms (3,768) |
  | Home render | 630.2 ms (47,622) | 190.3 ms (5,763) |
  | Drag + commit | 719.6 ms | 62.9 ms |

  Board renders 60 cards per column and the list 200 rows, both with "Show more"; the
  per-card notes filter (O(tasks×notes)) and the per-project scans are now single passes;
  search is debounced.

### Deferred (deliberately, not forgotten)

`P2-3` search inside notes/attachments, `P2-4` replacing native `confirm()`/`prompt()`,
`P2-6` print stylesheet, `P2-7` attachments out of `localStorage` into IndexedDB (the root
cause of the 1.5 MB cap — a bigger change, not launch-blocking), `P2-8` multi-tab merge,
`P2-9` `prefers-color-scheme`/`prefers-reduced-motion`. The support email address in the
About panel is blank until the address is decided, so the app points at the purchase
receipt rather than inventing one.

## [1.0.0-beta.1] — 2026-11-08

First version in a real repo. Content is Jay's original single-file app, renamed to
`index.html` and committed unchanged as the repo's first commit.

- **Mapping:** this is Jay's "TaskApp V4" upload (`1,696` lines, `120,833` bytes,
  `sha256 3ab67d901affef12f9b4f71bac770c698100cf999b246aaced440b94f1aa8367`).
- **No functional changes** — no redesign, no bug fixes, no data migration. The
  readiness audit decides what changes next.
- Added: repo scaffold (nginx static serve on `127.0.0.1:3601`, `compose.yaml` +
  `compose.dev.yaml`, `VERSION`), README, this changelog.
- Added: `tools/audit/` headless probes that produced the readiness audit evidence.
- Noted: comments in the source reference a "SQLite/Python TaskApp" ancestor and a
  scoring feature "removed in v1.2". No ancestor artefact exists in this repo or on the
  box; the export format (`taskapp-export` v1) is the only shared surface. Nothing was
  resurrected or merged.
- Known issues: see `businesses/flash-apps/docs/taskapp-readiness-audit.md` (P0/P1/P2).
  Nothing in that list is fixed in this release.

