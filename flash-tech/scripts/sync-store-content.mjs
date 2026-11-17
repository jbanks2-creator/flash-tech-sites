#!/usr/bin/env node
/**
 * Sync the store's source material into the website before a build.
 *
 * Sources (the single copies, owned by other cards):
 *   ~/.hermes/hermes-org/businesses/flash-apps/docs/store/{eula,refund-policy,support-policy,privacy-statement}.md
 *   ~/.hermes/hermes-org/businesses/flash-apps/assets/store/*
 *   ~/apps/taskapp/CHANGELOG.md  and  ~/apps/taskapp/VERSION
 *
 * Everything is copied, never edited, into web/content/store/ and web/public/apps/taskapp/.
 * A manifest records the sha256 of every source so `--check` can prove the site is built
 * from what the other cards actually delivered.
 *
 * The documents' drafting front-matter and the internal "delete before publishing" note are
 * dropped here so the rendered page never repeats internal instructions; unresolved
 * [JERRY:] / [ATTORNEY:] markers are kept deliberately — the site refuses to go live while
 * any remain (see scripts/check-store.mjs).
 *
 *   node scripts/sync-store-content.mjs           # copy
 *   node scripts/sync-store-content.mjs --check   # verify copies match sources
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = homedir();
const STORE_SRC = process.env.STORE_SRC || join(HOME, ".hermes/hermes-org/businesses/flash-apps/docs/store");
const ASSETS_SRC = process.env.STORE_ASSETS || join(HOME, ".hermes/hermes-org/businesses/flash-apps/assets/store");
const APP_DIR = process.env.TASKAPP_DIR || join(HOME, "apps/taskapp");
const CONTENT = join(ROOT, "web/content/store");
const PUBLIC = join(ROOT, "web/public/apps/taskapp");
const CHECK = process.argv.includes("--check");

const LEGAL = [
  ["eula", "eula.md", "End User Licence Agreement"],
  ["refund-policy", "refund-policy.md", "Refund policy"],
  ["support-policy", "support-policy.md", "Support policy"],
  ["privacy-statement", "privacy-statement.md", "Privacy statement"],
];
const IMAGES = [
  "hero-board-dark.png", "focus-light.png", "list-filters.png", "task-drawer.png",
  "mobile-board.png", "og-image.png", "demo.webm", "demo.mp4",
  "icon-512.png", "icon-192.png", "icon-32.png", "favicon.ico", "icon.svg",
];

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const fail = (msg) => { console.error(`sync-store-content: ${msg}`); process.exit(1); };

function cleanLegal(markdown) {
  let lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const firstRule = lines.findIndex((l) => /^---\s*$/.test(l));
  const head = lines.slice(0, firstRule < 0 ? 12 : firstRule).join("\n");
  if (/^\*\*Status:\*\*/m.test(head)) lines = lines.slice(firstRule + 1);   // drop drafting front-matter
  lines = lines.filter((l) =>
    !/Boundary check \(internal/i.test(l) &&
    !/Draft, not legal advice/i.test(l) &&
    !/^\s*>\s*\*\*Boundary check/i.test(l));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function readSource(path, label) {
  if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  return readFileSync(path);
}

const files = [];
const WEBROOT = join(ROOT, "web");
function put(dest, buf, source, label, transform) {
  const data = transform ? Buffer.from(transform(buf.toString("utf8"))) : buf;
  if (!dest.startsWith(WEBROOT + "/")) fail(`synced file must live under web/: ${dest}`);
  files.push({
    rel: dest.slice(WEBROOT.length + 1),
    source,
    label,
    source_sha256: sha(buf),
    copy_sha256: sha(data),
    bytes: data.length,
  });
  if (CHECK) {
    if (!existsSync(dest)) fail(`${label}: not synced (${dest} missing) — run without --check`);
    if (sha(readFileSync(dest)) !== sha(data)) fail(`${label}: copy is stale (${dest}) — run without --check`);
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
  }
}

for (const [slug, file] of LEGAL) {
  put(join(CONTENT, `${slug}.md`), readSource(join(STORE_SRC, file), file), join(STORE_SRC, file), file, cleanLegal);
}

put(join(CONTENT, "changelog.md"),
  readSource(join(APP_DIR, "CHANGELOG.md"), "CHANGELOG.md"),
  join(APP_DIR, "CHANGELOG.md"), "CHANGELOG.md");

const versionRaw = readSource(join(APP_DIR, "VERSION"), "VERSION").toString("utf8").trim();
if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(versionRaw)) fail(`VERSION is not semver: '${versionRaw}'`);
put(join(CONTENT, "version.json"), Buffer.from(versionRaw), join(APP_DIR, "VERSION"), "VERSION",
  (s) => JSON.stringify({ version: s.trim() }, null, 2) + "\n");

for (const name of IMAGES) {
  put(join(PUBLIC, name), readSource(join(ASSETS_SRC, name), name), join(ASSETS_SRC, name), name);
}

/* The demo artifact is *not* copied into Next's public/ on purpose: the demo must be a
   separate origin from the site, so it is served by its own container (see
   docs/STORE-DEPLOY.md and the taskapp repo's demo/ directory). Copying it here would put a
   same-origin copy one guess away, which the storefront card explicitly rules out. */

const manifest = {
  version: versionRaw,
  synced_from: { docs: STORE_SRC, assets: ASSETS_SRC, app: APP_DIR },
  files,
  markers: { jerry: 0, attorney: 0 },
};
for (const [slug] of LEGAL) {
  const text = readFileSync(join(CONTENT, `${slug}.md`), "utf8");
  manifest.markers.jerry += (text.match(/\[JERRY:/g) || []).length;
  manifest.markers.attorney += (text.match(/\[ATTORNEY:/g) || []).length;
}
const manifestPath = join(CONTENT, "manifest.json");
if (CHECK) {
  if (!existsSync(manifestPath)) fail("manifest missing — run without --check");
  const current = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (current.version !== manifest.version) fail(`manifest version ${current.version} != app ${manifest.version}`);
} else {
  mkdirSync(CONTENT, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

console.log(`sync-store-content: ${CHECK ? "verified" : "synced"} ${files.length} files · TaskApp ${versionRaw} · ` +
  `draft markers: ${manifest.markers.jerry} Jerry / ${manifest.markers.attorney} attorney`);
