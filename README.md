# TaskApp

A task / project / research manager that ships as **one self-contained HTML file**.
No build step, no installer, no server process, no database.

```
index.html    ← the entire product (~120 KB, vanilla JS + CSS, zero dependencies)
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
  that file to restore or to move to another machine.
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
- the container serves the same single file; the HTTP origin keeps its own separate
  `localStorage`, so `file://` and `http://127.0.0.1:3601` do **not** share data.

## Features

Domains (with colour + order), projects (criticality 1–5, progress), research topics
(status + comfort level + study log), tasks (status, priority, due date/time, recurrence,
tags, notes, attachments and links), board / list / focus / home views, a quick-add
parser (`!high #church @Fall due:fri every:week`), JSON export/import, sample data and
three themes (Dark, Light, Midnight).

## Versioning

| Here | Jay's label |
|---|---|
| `1.0.0-beta.1` (`VERSION`) | "TaskApp V4" |

`V4` was Jay's own iteration label on the original upload; this repo starts a proper
semver line at `1.0.0-beta.1` while the first commit keeps the V4 file byte-identical
(`sha256 3ab67d901affef12f9b4f71bac770c698100cf999b246aaced440b94f1aa8367`).

Internal markers that do **not** track the public version: the `localStorage` key is
`taskapp.v1`, the exported file says `"format": "taskapp-export", "version": 1`, and
`exportData()` writes `"app_version": "html-1.5"`. Reconciling those is on the fix list
in the readiness audit, not in this beta.

## Known issues

Read `businesses/flash-apps/docs/taskapp-readiness-audit.md` in the org repo before
selling or deploying this to anyone who will put real data in it. It contains the
P0/P1/P2 list (data-loss and code-execution findings included).

## Repo layout

```
index.html                  the product (single file, no second copy of the V4 original — it is in git history)
compose.yaml                nginx static serve, no ports
compose.dev.yaml            dev override: 127.0.0.1:3601
nginx/default.conf          static config
VERSION                     1.0.0-beta.1
tools/audit/                headless probes used for the readiness audit (not shipped)
```

`tools/audit/` is development-only. It is excluded from the product: the product is
`index.html` and nothing else.
