#!/usr/bin/env node
/**
 * Build gate: the honeypot input name must not be a property name anywhere in intake/schema.json.
 *
 * WHY THIS EXISTS
 * The trap used to be called "website", and `website` is a REQUIRED TOP-LEVEL section of the intake
 * record. Any body shaped like the record itself — a migration, a re-post, a client built from the
 * schema — therefore looked like a filled trap: the route answered `{ok:true}` and wrote nothing.
 * Nothing in the response said so, so the form could discard real submissions and nobody would
 * know. That class of bug must break the build, not a review.
 *
 * It runs from `npm run build` (via `prebuild`), which is what `docker compose build` runs, so an
 * image whose trap collides with the record cannot be built at all.
 *
 * THE SCHEMA IT READS
 * The image build can only see `web/` (no buildx on this host, so no additional build contexts),
 * so the schema is vendored into the build context at `web/schema/intake-starter-v1.json` by
 * `scripts/vendor-intake-schema.mjs`. A stale copy would make this gate a lie, so the deploy path
 * (`scripts/deploy-intake.sh`) re-runs this script against the authoritative schema with
 * `--require-vendored-match`, which fails if the two files differ by a single byte.
 *
 * Usage:
 *   node scripts/check-intake-honeypot.mjs                        # gate the vendored copy (build)
 *   node scripts/check-intake-honeypot.mjs --schema <path>        # gate an explicit schema
 *   node scripts/check-intake-honeypot.mjs --schema <path> --require-vendored-match
 *   node scripts/check-intake-honeypot.mjs --json                 # machine-readable result
 *
 * Exit 0 = the trap name is outside the record's namespace. Exit 1 = it is not, or the schema could
 * not be read (a gate that cannot see the schema must not pass).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HONEYPOT, LIMITS, SCHEMA_ID, schemaPropertyNames } from "../lib/intake-fields.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDORED = join(WEB, "schema", "intake-starter-v1.json");
const VENDOR_CMD = "node web/scripts/vendor-intake-schema.mjs";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const requireVendoredMatch = argv.includes("--require-vendored-match");
const schemaArgIndex = argv.indexOf("--schema");
const explicitSchema = schemaArgIndex === -1 ? null : argv[schemaArgIndex + 1];

const fail = (message, detail = []) => {
  if (asJson) {
    console.log(JSON.stringify({ ok: false, error: message, detail, honeypot: HONEYPOT }, null, 2));
  } else {
    console.error(`check-intake-honeypot: FAIL — ${message}`);
    for (const line of detail) console.error(`  · ${line}`);
  }
  process.exit(1);
};

/* ---- which schema ------------------------------------------------------- */

let schemaPath;
let source;
if (explicitSchema) {
  schemaPath = resolve(explicitSchema);
  source = "--schema";
} else if (process.env.INTAKE_SCHEMA) {
  schemaPath = resolve(process.env.INTAKE_SCHEMA);
  source = "INTAKE_SCHEMA";
} else {
  schemaPath = VENDORED;
  source = "vendored";
}

if (!existsSync(schemaPath)) {
  fail(`no schema at ${schemaPath} (from ${source}).`, [
    source === "vendored"
      ? `the vendored copy is missing — run: ${VENDOR_CMD}`
      : "pass --schema <path to intake/schema.json>",
    "This gate refuses to pass without the schema: an unread check is not a check.",
  ]);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (error) {
  fail(`could not parse ${schemaPath}: ${String(error)}`);
}

/* ---- is the trap name inside the record's namespace? --------------------- */

/** JSON-pointer-ish paths where `name` is declared as a property, for an actionable error. */
function locationsOf(node, name, path = "#", out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => locationsOf(item, name, `${path}/${i}`, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const properties = node.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    for (const [key, subschema] of Object.entries(properties)) {
      if (key === name) out.push(`${path}/properties/${key}`);
      locationsOf(subschema, name, `${path}/properties/${key}`, out);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== "properties") locationsOf(value, name, `${path}/${key}`, out);
  }
  return out;
}

const names = schemaPropertyNames(schema);
const problems = [];

if (!String(HONEYPOT || "").trim()) {
  problems.push("HONEYPOT is empty: an unnamed trap cannot be checked, and a blank name matches every field.");
}

for (const where of locationsOf(schema, HONEYPOT)) {
  problems.push(
    `HONEYPOT "${HONEYPOT}" is a property name in the record at ${where} — a submission shaped like ` +
      "the record would be trapped and silently discarded. Rename the trap (see HONEYPOT in lib/intake-fields.mjs).",
  );
}

if (Object.hasOwn(LIMITS, HONEYPOT)) {
  problems.push(`HONEYPOT "${HONEYPOT}" is also one of the form's answer fields (LIMITS) — the trap would eat a real answer.`);
}

/* ---- is the copy this gate trusts the copy production will use? ---------- */

let vendoredHash = null;
let schemaHash = null;
if (requireVendoredMatch) {
  if (!existsSync(VENDORED)) {
    problems.push(`the vendored schema is missing (${VENDORED}) — run: ${VENDOR_CMD}`);
  } else {
    const bytes = readFileSync(schemaPath);
    const vendoredBytes = readFileSync(VENDORED);
    schemaHash = createHash("sha256").update(bytes).digest("hex");
    vendoredHash = createHash("sha256").update(vendoredBytes).digest("hex");
    if (schemaHash !== vendoredHash) {
      problems.push(
        `the vendored schema is stale: ${VENDORED} (${vendoredHash.slice(0, 12)}) does not match ` +
          `${schemaPath} (${schemaHash.slice(0, 12)}). The build gate checks the vendored copy, so it ` +
          `would be checking the wrong file. Run: ${VENDOR_CMD}`,
      );
    }
  }
}

if (problems.length) fail("the honeypot name collides with the intake record", problems);

/* ---- pass --------------------------------------------------------------- */

if (asJson) {
  console.log(JSON.stringify({
    ok: true,
    honeypot: HONEYPOT,
    schema: schemaPath,
    source,
    schema_id: schema.$id ?? null,
    expected_schema_id: SCHEMA_ID,
    property_names: names.size,
    vendored_match: requireVendoredMatch ? true : null,
  }, null, 2));
} else {
  console.log(
    `check-intake-honeypot: ok — "${HONEYPOT}" is not a property name anywhere in ${schemaPath} ` +
      `(${names.size} property names, $id ${schema.$id ?? "none"}, source ${source})`,
  );
  if (requireVendoredMatch) console.log("check-intake-honeypot: vendored copy matches the authoritative schema byte for byte");
}
