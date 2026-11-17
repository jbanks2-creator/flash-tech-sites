#!/usr/bin/env node
/**
 * Keep the DEMO_DATA block in index.html identical to demo-data.json.
 *
 * The app must work from file:// with no network, so it cannot fetch demo-data.json at
 * runtime — the dataset is embedded. demo-data.json stays the canonical artifact (the
 * website demo and the repo both use it), and this script is what stops the two drifting:
 *
 *   node scripts/embed-demo.mjs --write   # copy demo-data.json into index.html
 *   node scripts/embed-demo.mjs --check   # exit 1 if they differ (run by build.sh)
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const FILE = `${ROOT}index.html`;
const DATA = `${ROOT}demo-data.json`;
const WRITE = process.argv.includes("--write");
const BEGIN = "/* DEMO_DATA:BEGIN */";
const END = "/* DEMO_DATA:END */";

const html = readFileSync(FILE, "utf8");
const i = html.indexOf(BEGIN), j = html.indexOf(END);
if (i < 0 || j < 0 || j < i) {
  console.error("embed-demo: DEMO_DATA markers are missing from index.html");
  process.exit(1);
}
const data = JSON.parse(readFileSync(DATA, "utf8"));

// Key-order-insensitive comparison: content matters, formatting does not.
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

if (WRITE) {
  const block = `${BEGIN}\nconst DEMO_DATA = ${JSON.stringify(data, null, 2)};\n${END}`;
  writeFileSync(FILE, html.slice(0, i) + block + html.slice(j + END.length));
  console.log(`embed-demo: wrote ${data.tasks.length} tasks, ${data.projects.length} projects, ${data.domains.length} domains into index.html`);
  process.exit(0);
}

const region = html.slice(i + BEGIN.length, j);
const m = region.match(/const\s+DEMO_DATA\s*=\s*([\s\S]*?);\s*$/);
if (!m) { console.error("embed-demo: could not parse the DEMO_DATA block"); process.exit(1); }
let embedded;
try { embedded = JSON.parse(m[1]); }
catch (e) { console.error("embed-demo: embedded DEMO_DATA is not valid JSON —", e.message); process.exit(1); }

if (!same(embedded, data)) {
  console.error("embed-demo: index.html DEMO_DATA does not match demo-data.json.\n  fix: node scripts/embed-demo.mjs --write");
  process.exit(1);
}
console.log(JSON.stringify({ file: "index.html", matchesDemoData: true, tasks: data.tasks.length, projects: data.projects.length, domains: data.domains.length }, null, 2));
