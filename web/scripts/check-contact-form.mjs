#!/usr/bin/env node
/**
 * Build gate for the contact form — `npm run prebuild`, so the image refuses to exist in a state
 * this site has already shipped once.
 *
 * Three assertions, each one a defect that reached production before:
 *
 *   1. **The route must not be a stub.** `/api/contact` answered `{ok:true}` and sent nothing for
 *      as long as the form existed (found 2026-11-17, card t_9c2fc2ff). A comment saying "STUB"
 *      or a handler that never calls the sender fails the build.
 *   2. **The honeypot must be a name no real field uses.** Same rule as the authors-intake trap
 *      (2026-11-12), where a trap named `website` matched a real section and discarded every
 *      genuine submission with a cheerful `{ok:true}`.
 *   3. **No credential in the repo.** The provider key lives in the deployment env; a `re_…` or
 *      `CONTACT_API_KEY=<value>` that made it into a tracked file fails the build, not the review.
 *
 * Runs from `web/` (the Docker build context) and needs no network, no schema and no Next.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIELDS, HONEYPOT, TRAP_IS_NOT_A_FIELD, labels } from '../lib/contact-fields.mjs';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

/* ---- 1. the route is a real sender ---------------------------------------- */

const routePath = join(WEB, 'app/api/contact/route.js');
const route = readFileSync(routePath, 'utf8');

if (!route.includes('sendContactMessage(')) {
  errors.push('app/api/contact/route.js never calls sendContactMessage — a form that accepts a message and sends nothing');
}
if (/\bSTUB\b/.test(route)) {
  errors.push('app/api/contact/route.js still says STUB — the stub is the defect this gate exists for');
}
if (!route.includes('isTrapped(')) {
  errors.push('app/api/contact/route.js has no honeypot check — a public form with no spam control');
}
// A success answer must be reachable only after a send: the response object that means "accepted"
// is `received:true`, and nothing else in the file may claim it.
const accepted = (route.match(/received:\s*true/g) || []).length;
if (accepted !== 1) {
  errors.push(`app/api/contact/route.js has ${accepted} "received:true" answers; the only honest one is the single post-send response`);
}

/* ---- 2. the trap name cannot collide with a real field --------------------- */

if (!TRAP_IS_NOT_A_FIELD) errors.push(`the honeypot "${HONEYPOT}" is one of the form's own fields (${FIELDS.join(', ')})`);
if (!/^hp_[a-z0-9_]+$/.test(HONEYPOT)) errors.push(`the honeypot "${HONEYPOT}" does not follow the hp_ rule`);
if (Object.keys(labels).some((key) => key === HONEYPOT)) errors.push(`the honeypot "${HONEYPOT}" has a visitor-facing label`);

/* ---- 3. no credential in the tree ---------------------------------------- */

// A walk of the build context rather than `git ls-files`: the image is built from `web/` alone,
// with no `.git` in it, and a gate that cannot run inside the build is not a gate.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'public']);
const walk = (dir, found = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), found);
    } else if (!entry.name.endsWith('.example') && !/\.(png|ico|jpe?g|webp|woff2?|ttf)$/i.test(entry.name)) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
};

const files = walk(WEB);

const CREDENTIALS = [
  [/\bre_[A-Za-z0-9_]{16,}/, 'a Resend-style API key'],
  [/^\s*CONTACT_API_KEY\s*=\s*\S+/m, 'a CONTACT_API_KEY value'],
  [/^\s*CONTACT_SMTP_PASS\s*=\s*\S+/m, 'a CONTACT_SMTP_PASS value'],
];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable: it cannot carry a form credential we care about
  }
  for (const [pattern, what] of CREDENTIALS) {
    if (pattern.test(text)) errors.push(`${relative(WEB, file)} looks like it contains ${what}`);
  }
}

/* ---- verdict -------------------------------------------------------------- */

if (errors.length) {
  console.error('check-contact-form: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `check-contact-form: ok (trap "${HONEYPOT}" outside ${FIELDS.length} fields, route sends, no credential in ${files.length} files)`,
);
