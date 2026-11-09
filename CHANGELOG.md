# Changelog

All notable changes to TaskApp. Versioning is semver for the single-file product.

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
