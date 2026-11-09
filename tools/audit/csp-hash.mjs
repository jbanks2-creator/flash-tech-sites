#!/usr/bin/env node
/**
 * Keep the <meta http-equiv="Content-Security-Policy"> hash in sync with the inline script.
 *
 * TaskApp ships as one file with two inline <script> blocks. A hash-based script-src is the
 * only defence that survives the *next* escaping mistake: even if a value reaches an
 * attribute unescaped again, the injected inline handler has no hash and cannot run.
 *
 * The hash covers the exact bytes between <script> and </script>, so ANY edit to either
 * script invalidates it and the browser silently refuses to run the app. That is why this
 * checker exists and why it is part of the regression suite.
 *
 *   node tools/audit/csp-hash.mjs index.html           # verify, exit 1 on drift
 *   node tools/audit/csp-hash.mjs index.html --write   # rewrite the meta tag
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FILE = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "index.html";
const WRITE = process.argv.includes("--write");
const html = readFileSync(FILE, "utf8");

const hashes = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) {
  if (/\bsrc\s*=/.test(m[1])) continue;                       // external scripts are not allowed anyway
  hashes.push("'sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64") + "'");
}
if (!hashes.length) { console.error("csp-hash: no inline <script> found"); process.exit(1); }

const policy = [
  "default-src 'none'",
  `script-src ${hashes.join(" ")}`,
  "style-src 'unsafe-inline'",          // the app ships its own <style> block and style="" attributes
  "img-src 'self' data: blob:",
  "connect-src 'none'",                 // the product promise: it talks to nothing
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
].join("; ");

const metaRe = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
const current = html.match(metaRe)?.[0] || "";
const scriptDirective = policy.split("; ").find((p) => p.startsWith("script-src"));

if (WRITE) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const next = metaRe.test(html)
    ? html.replace(metaRe, tag)
    : html.replace(/<meta charset="utf-8">/, `<meta charset="utf-8">\n${tag}`);
  writeFileSync(FILE, next);
  console.log(`csp-hash: wrote ${hashes.length} hash(es) into ${FILE}`);
  console.log(policy);
  process.exit(0);
}

const ok = !!current && current.includes(scriptDirective);
console.log(JSON.stringify({ file: FILE, hashes, metaPresent: !!current, matches: ok }, null, 2));
if (!ok) {
  console.error("\ncsp-hash: the CSP hash does not match the inline script. The browser will refuse\n" +
                "to run TaskApp until it is refreshed:\n\n  node tools/audit/csp-hash.mjs index.html --write\n");
  process.exit(1);
}
