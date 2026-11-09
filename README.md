# TaskApp

A task / project / research manager that ships as **one self-contained HTML file**.
No build step, no installer, no server process, no database.

```
index.html    ← the entire product (~155 KB, vanilla JS + CSS, zero dependencies)
```

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
  that file to restore or to move to another machine. The app now nudges you when the
  last export is over 7 days old, downloads a pre-import backup automatically, and keeps
  a copy of any blob it cannot read.
- **A container does not add a database.** The nginx container below exists only to
  serve `index.html` over HTTP. It has no volume, no DB, no server-side code.

## Running it

### As a downloaded product (the intended experience)

Double-click `index.html`. It opens in the browser from `file://` and everything works,
including `localStorage` persistence. Nothing is installed.

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
tags, notes, attachments and links), board / list / focus / home views, a quick-add
parser (`!high #church @Fall due:fri every:week`), JSON export/import, sample data and
three themes (Dark, Light, Midnight).

## Versioning

| Here | Jay's label |
|---|---|
| `1.0.0-beta.2` (`VERSION`) | "TaskApp V4" + hardening |

`V4` was Jay's own iteration label on the original upload; this repo starts a proper
semver line at `1.0.0-beta.1` and the first commit kept the V4 file byte-identical
(`sha256 3ab67d901affef12f9b4f71bac770c698100cf999b246aaced440b94f1aa8367`).

Three numbers are deliberately separate and are shown in Settings → About:

| Number | Meaning | Current |
|---|---|---|
| `APP_VERSION` | what a buyer has | `1.0.0-beta.2` |
| export `version` | shape of the JSON file | `1` |
| `STORE_KEY` / `version` | shape of the stored blob | `taskapp.v1` / `1` |

## Security posture (1.0.0-beta.2)

- **No network.** A page load makes exactly one request: the document. There is no CDN,
  no font, no telemetry, and `connect-src 'none'` makes it structural.
- **CSP.** A hash-based `script-src` for the two inline scripts; injected inline event
  handlers are blocked even if markup ever reaches an attribute unescaped.
- **Import is validated before it touches state.** Whole-file schema check (ids, enums,
  dates, parent references, URL schemes), staged in a clone, and applied only if every
  row passes. A bad file changes nothing and says which row failed.
- **Writes are transactional.** A quota failure rolls the in-memory change back and says
  which attachment is largest, instead of leaving a phantom row that vanishes on reload.
- **Unreadable data is kept.** A blob that cannot be parsed is copied to
  `taskapp.v1.recover-<ts>`, offered as a download, and never overwritten until the user
  acknowledges.

> **After editing either inline `<script>`, run `node tools/audit/csp-hash.mjs index.html --write`.**
> The CSP hash covers the script bytes; a stale hash makes the browser refuse to run the
> app (it will look like a blank page). `node tools/audit/csp-hash.mjs index.html`
> (no flag) exits 1 on drift.

## Tests

Development-only harnesses in `tools/audit/` drive the real page in headless Chromium
(`playwright-core`, Chromium 1254). Each exits 0 only if every assertion passed.

```bash
P="systemd-run --user --scope -p MemoryMax=2048M -p MemorySwapMax=0 --quiet"
$P node tools/audit/confirm-link-xss.mjs      http://127.0.0.1:3601/   # P0-1, P1-1
$P node tools/audit/silent-write-probe.mjs    http://127.0.0.1:3601/   # P0-2
$P node tools/audit/corrupt-store-probe.mjs   http://127.0.0.1:3601/   # P0-3
$P node tools/audit/import-backup-probe.mjs   http://127.0.0.1:3601/   # backup + nudge
$P node tools/audit/product-surface-probe.mjs http://127.0.0.1:3601/   # P1-5..P1-8
$P node tools/audit/a11y-probe.mjs            http://127.0.0.1:3601/   # P1-3, P1-4
$P node tools/audit/undo-probe.mjs            http://127.0.0.1:3601/   # P1-9
$P node tools/audit/csp-probe.mjs             http://127.0.0.1:3601/   # P2-1 + no-network
$P node tools/audit/scale-probe.mjs           http://127.0.0.1:3601/   # P1-2 timings
$P node tools/audit/file-protocol-probe.mjs   index.html              # file:// + migration
node tools/audit/csp-hash.mjs index.html                              # CSP drift check
```

## Known issues

Read `businesses/flash-apps/docs/taskapp-readiness-audit.md` in the org repo before
selling or deploying this to anyone who will put real data in it. It carries the status
of every P0/P1/P2 item after this hardening pass, including the ones deliberately
deferred and why.

## Repo layout

```
index.html                  the product (single file)
compose.yaml                nginx static serve, no ports
compose.dev.yaml            dev override: 127.0.0.1:3601
nginx/default.conf          static config
VERSION                     1.0.0-beta.2
tools/audit/                headless probes and the CSP hash checker (not shipped)
tools/dev/serve-refresh.sh  recreate the container after editing index.html
```

`tools/` is development-only. It is excluded from the product: the product is
`index.html` and nothing else.
