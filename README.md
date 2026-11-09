# TaskApp

A task, project and client manager that ships as **one self-contained HTML file**.
No build step, no installer, no server process, no database, no account, no network.

```
index.html    ← the whole product (~205 KB, vanilla JS + CSS, zero dependencies)
```

**Deliberately dependency-free.** No framework, no bundler, no `npm install` before it
runs, no CDN, no web font. `package.json` exists only under `tools/audit/` for the
headless test harness, which is never shipped. A buyer opens the file; nothing else has
to keep working.

## There is no database

This is deliberate, not a missing piece of the deployment.

All state — tasks, projects, domains, research topics, notes, attachments — lives in the
visitor's browser under a single `localStorage` key (`taskapp.v1`). `attachments` are
base64 data URLs stored inside that same JSON blob.

Consequences a buyer must understand before relying on it:

- **Data is per browser, per origin.** Another browser, another device, or a private
  window starts empty. There is no sync and no server-side copy.
- **Clearing site data erases everything.** So does "Clear cookies and site data", most
  "cleaner" utilities, and closing a private window.
- **The only backup is a manual export.** Settings → *Export backup (.json)*. Import
  that file to restore or to move to another machine. The app nudges you when the last
  export is over 7 days old, downloads a pre-import backup automatically, and keeps a copy
  of any blob it cannot read.
- **A container does not add a database.** The nginx container below exists only to
  serve `index.html` over HTTP. It has no volume, no DB, no server-side code.

## What a buyer gets

`bash scripts/build.sh` produces, in `dist/`:

| File | Purpose |
|---|---|
| `TaskApp-<version>.html` | the entire app, readable (deliberately not minified — a buyer can see what they installed) |
| `TaskApp-<version>.html.sha256` | `sha256sum -c` format |
| `README.txt` | the first file to read: how to open it, where data lives, backup, support, licence |

Building twice produces byte-identical files and therefore the same checksum; the build
script proves it every run (it builds into two directories and compares every output).

## Screenshots

**PENDING** — captured from the real app, against the demo workspace, by `media-producer`
(card `t_6f3a2956`). Placeholders until those files land; do not publish older captures,
because the header shows the version.

| File (in `businesses/flash-apps/assets/store/`) | Shows |
|---|---|
| `hero-board-dark.png` (1600×1000 @2×) | Board view, dark theme, demo data, the two overdue cards |
| `focus-light.png` | Focus view, light theme, Start / Done / Blocked |
| `list-filters.png` | List view with a client filter applied |
| `task-drawer.png` | Task drawer with notes and a due date |
| `mobile-board.png` (390×844) | Board on a phone |
| `demo.gif` / `demo.webm` (≤15 s) | Quick-add a task → it lands on the board → drag to done |

## Running it

### As the buyer does (the intended experience)

Double-click `index.html` (or a built `dist/TaskApp-*.html`). It opens from `file://` and
everything works, including `localStorage` persistence. Nothing is installed.

### As a dev server (this repo's container)

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3601/   # → 200
```

- container `taskapp-web`, network `taskapp_net`, `mem_limit: 128m`
- bound to **`127.0.0.1:3601`** only (see `PLATFORM.md` §5). Never published publicly.
- both compose files are required: the loopback port lives only in `compose.dev.yaml`.
- the container serves the same single file; the HTTP origin keeps its own separate
  `localStorage`, so `file://` and `http://127.0.0.1:3601` do **not** share data.

> **Editing `index.html` needs a container recreate, not a restart.** It is bind-mounted
> as a *single file*, so an editor that writes a new inode leaves the container serving
> the old bytes. Run `tools/dev/serve-refresh.sh` after every edit.

## Features

Domains (with colour + order), projects (criticality 1–5, progress), research topics
(status + comfort level + study log), tasks (status, priority, due date/time, recurrence,
tags, notes, attachments and links), Home / Focus / Board / List / Projects / Research
views, a quick-add parser (`!high #church @Fall due:fri every:week`), JSON export/import,
three themes (Dark, Light, Midnight), print, and an About panel with version and licence
status.

## First run, demo workspace, help

- **First run** (no stored state) opens one panel with three choices: *start empty*,
  *load the demo workspace*, *import a backup*. The choice is remembered
  (`taskapp.onboarded`); the demo stays available in Settings.
- **Demo workspace** — `demo-data.json` is a real `taskapp-export` v1 file for a fictional
  IT services company: 4 clients as domains, 4 projects as workstreams, 21 tasks, 2 notes
  and 3 research topics, with two overdue items and one due today so the urgency states
  are visible. The same artifact feeds the website demo.
  - It is **embedded** in `index.html` as `DEMO_DATA` (the app makes no requests, so it
    cannot fetch the file) and kept as a **separate file** for the website and the repo.
    `scripts/embed-demo.mjs --check`, run by the build, fails if the two drift.
  - Dates in the file are absolute against a top-level `demo_anchor`; loading shifts the
    whole workspace by `today − anchor`, so the demo never rots into a wall of overdue.
  - Everything loaded this way is flagged `demo`, shown with a **DEMO** pill and a notice
    bar, and removed by one click (**Clear demo data**). Rows the user created are kept,
    and anything pointing at a demo client is re-homed to a real one.
- **Help** ships inside the file: `?` (or the header button) opens a one-page *how it
  works* plus the keyboard-shortcut table. There are no external docs a buyer must find.

## Print / PDF

Printing any view (`🖨` button, **Settings → Print**, or Ctrl/⌘+P) produces a light sheet:
a print-only heading names the view, the client/project filter and the date; header,
filters and buttons are dropped; overdue badges keep their colour; the board prints two
columns per page. The list's status column prints as text, not a dropdown. Verified by
screenshot and PDF in `tools/audit/productisation-probe.mjs`.

## Licence

The licence screen exists and is **inert in this build**: it accepts a key file, stores it,
and reports **"Unlicensed (beta)"**. No key format, no signature and no network are
invented here — the checkout card decides those. Commerce fills in exactly one function:

```js
Licence.verify = async (keyText, meta) => ({ valid: true, licensee: "Name", seats: 1 });
// or { valid: false, reason: "expired" }
```

Everything else (file picker, status in Settings → About, persistence under
`taskapp.licence`) already works and needs no change.

## Versioning

`APP_VERSION` is what a buyer sees: shown in the header (`v1.0.0-rc.2`), in Settings →
About, and written into every export. It must equal `VERSION` — the build fails otherwise.

| Here | Jay's label |
|---|---|
| `1.0.0-rc.2` (`VERSION`) | "TaskApp V4" + hardening + productisation + backup-restore fix (QA B1/B2/m1) |

`V4` was Jay's own iteration label on the original upload; this repo starts a proper
semver line at `1.0.0-beta.1` and the first commit kept the V4 file byte-identical
(`sha256 3ab67d901affef12f9b4f71bac770c698100cf999b246aaced440b94f1aa8367`).

Three numbers are deliberately separate:

| Number | Meaning | Current |
|---|---|---|
| `APP_VERSION` | what a buyer has | `1.0.0-rc.2` |
| export `version` | shape of the JSON file | `1` |
| `STORE_KEY` / `version` | shape of the stored blob | `taskapp.v1` / `1` |

**The storage key and schema have not changed in this release**, so data written by any
earlier build loads as-is.

## Security posture

- **No network.** A page load makes exactly one request: the document. No CDN, no font, no
  telemetry, and `connect-src 'none'` makes it structural.
- **CSP.** A hash-based `script-src` for the two inline scripts; injected inline event
  handlers are blocked even if markup ever reaches an attribute unescaped.
- **Import is validated before it touches state.** Whole-file schema check (ids, enums,
  dates, parent references, URL schemes), staged in a clone, applied only if every row
  passes. A bad file changes nothing and says which row failed.
- **Writes are transactional.** A quota failure rolls the in-memory change back and says
  which attachment is largest, instead of leaving a phantom row.
- **Unreadable data is kept.** A blob that cannot be parsed is copied to
  `taskapp.v1.recover-<ts>`, offered as a download, and never overwritten until the user
  acknowledges.

> **After editing either inline `<script>`, run `node tools/audit/csp-hash.mjs index.html --write`.**
> The CSP hash covers the script bytes; a stale hash makes the browser refuse to run the
> app (it will look like a blank page). `node tools/audit/csp-hash.mjs index.html`
> (no flag) exits 1 on drift.

## Build

```bash
bash scripts/build.sh
```

The build validates before it copies: `VERSION` is semver and matches `APP_VERSION`; the
CSP hash matches the inline script; embedded demo data matches `demo-data.json`; no
external script/style/image/font/`@import`. It then writes the three dist files, builds a
second copy and `cmp`s every output, and verifies the `.sha256`. No date, hostname, git
hash or counter enters any output — that is what keeps the checksum stable.

## Tests

Development-only harnesses in `tools/audit/` drive the real page in headless Chromium
(`playwright-core`, Chromium 1254). Each exits 0 only if every assertion passed.

```bash
P="systemd-run --user --scope -p MemoryMax=2048M -p MemorySwapMax=0 --quiet"
# productisation (first run, demo, print, help, licence, offline)
$P node tools/audit/productisation-probe.mjs  http://127.0.0.1:3601/
# hardening regressions
$P node tools/audit/confirm-link-xss.mjs      http://127.0.0.1:3601/   # P0-1, P1-1
$P node tools/audit/silent-write-probe.mjs    http://127.0.0.1:3601/   # P0-2
$P node tools/audit/corrupt-store-probe.mjs   http://127.0.0.1:3601/   # P0-3
$P node tools/audit/import-backup-probe.mjs   http://127.0.0.1:3601/   # backup + nudge
$P node tools/audit/product-surface-probe.mjs http://127.0.0.1:3601/   # P1-5..P1-8
$P node tools/audit/a11y-probe.mjs            http://127.0.0.1:3601/   # P1-3, P1-4
$P node tools/audit/undo-probe.mjs            http://127.0.0.1:3601/   # P1-9
$P node tools/audit/csp-probe.mjs             http://127.0.0.1:3601/   # P2-1 + no-network
$P node tools/audit/scale-probe.mjs           http://127.0.0.1:3601/   # P1-2 timings
$P node tools/audit/restore-domains-probe.mjs http://127.0.0.1:3601/   # restore B1/B2/m1
$P node tools/audit/file-protocol-probe.mjs   index.html              # file:// + migration
node tools/audit/csp-hash.mjs index.html                              # CSP drift check
node scripts/embed-demo.mjs --check                                   # demo drift check
```

## Known issues

Read `businesses/flash-apps/docs/taskapp-readiness-audit.md` in the org repo before
selling or deploying this to anyone who will put real data in it. Still open and
deliberately out of scope for this pass: IndexedDB attachments (the 1.5 MB limit stays),
custom dialogs replacing `confirm()`/`prompt()`, multi-tab merge,
`prefers-color-scheme`/reduced motion, and search inside notes. `SUPPORT_CONTACT` in
`index.html` is blank until `ops` decides the address; the app points at the purchase
receipt.

## Repo layout

```
index.html                  the product (single file)
demo-data.json              the demo workspace (taskapp-export v1); embedded into index.html
VERSION                     1.0.0-rc.2
LICENSE                     licence-not-sale statement, points at the EULA
CHANGELOG.md                what changed, per version
scripts/build.sh            dist artifact + checksum + README.txt (deterministic)
scripts/embed-demo.mjs      keeps embedded DEMO_DATA identical to demo-data.json
scripts/README.dist.txt     template for the buyer-facing README.txt
compose.yaml                nginx static serve, no ports
compose.dev.yaml            dev override: 127.0.0.1:3601
nginx/default.conf          static config
tools/audit/                headless probes and the CSP hash checker (not shipped)
tools/dev/serve-refresh.sh  recreate the container after editing index.html
dist/                       build output (gitignored)
```

`tools/`, `scripts/` and `dist/` are development and distribution machinery. The product
a buyer runs is the single HTML file; everything else exists to produce and check it.
