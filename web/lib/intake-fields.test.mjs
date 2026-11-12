/**
 * Regression tests for the honeypot.
 *
 * The incident (kanban t_ce133486, found against production 2026-11-12): the trap input was named
 * "website", and `website` is a REQUIRED TOP-LEVEL SECTION of intake/schema.json. A POST whose body
 * was shaped like the record therefore tripped the trap, got `200 {"ok":true}` and was thrown away —
 * no `job_id`, no file in the inbox, nothing in the response to say a real submission had been
 * lost. The browser form happened to post `website_url`, so it went unnoticed.
 *
 * These tests are the reason that class of bug cannot come back quietly. `npm test` runs them, and
 * `npm run build` runs scripts/check-intake-honeypot.mjs, which enforces the same rule on the image.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HONEYPOT,
  LIMITS,
  buildIntake,
  isTrapped,
  schemaPropertyNames,
} from "./intake-fields.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDORED = join(WEB, "schema", "intake-starter-v1.json");

const readSchema = (path) => JSON.parse(readFileSync(path, "utf8"));

/** Every schema this repo can be measured against: the vendored copy always, plus a live one if set. */
function schemas() {
  const found = [];
  assert.ok(
    existsSync(VENDORED),
    `the vendored schema is missing (${VENDORED}) — run: node web/scripts/vendor-intake-schema.mjs`,
  );
  found.push({ label: "vendored web/schema/intake-starter-v1.json", path: VENDORED, schema: readSchema(VENDORED) });
  if (process.env.INTAKE_SCHEMA && existsSync(process.env.INTAKE_SCHEMA)) {
    found.push({
      label: `INTAKE_SCHEMA ${process.env.INTAKE_SCHEMA}`,
      path: process.env.INTAKE_SCHEMA,
      schema: readSchema(process.env.INTAKE_SCHEMA),
    });
  }
  return found;
}

test("the honeypot name is not a property name anywhere in the intake schema", () => {
  for (const { label, schema } of schemas()) {
    const names = schemaPropertyNames(schema);
    assert.equal(
      names.has(HONEYPOT),
      false,
      `honeypot "${HONEYPOT}" is a property name in ${label}: a submission shaped like the record ` +
        "would be trapped and silently discarded",
    );
  }
});

test("the walk that proves it is not vacuous: it sees the section that caused the incident", () => {
  // If `schemaPropertyNames` silently returned nothing, the rule above would pass for any trap name.
  // These are the exact keys the old trap collided with, so a walker that finds them is a walker
  // that would have caught the bug.
  for (const { label, schema } of schemas()) {
    const names = schemaPropertyNames(schema);
    assert.ok(names.has("website"), `${label}: the walker did not find the top-level "website" section`);
    assert.ok(names.has("has_website"), `${label}: the walker did not descend into the "website" section`);
    assert.ok(names.size > 50, `${label}: only ${names.size} property names found — the walk is too shallow`);
  }
});

test("the honeypot name is not one of the form's own answer fields", () => {
  assert.equal(Object.hasOwn(LIMITS, HONEYPOT), false, `"${HONEYPOT}" is both the trap and an answer field`);
});

test("a body shaped like the record is NOT trapped (the incident, in one line)", () => {
  // This is the exact shape Atlas posted to production: it returned 200 ok:true and stored nothing.
  const recordShaped = {
    meta: { job_id: "x", package: "starter" },
    personal: { legal_name: "A" },
    website: { has_website: false },
    social: { active_platforms: [] },
  };
  assert.equal(isTrapped(recordShaped), false);
});

test("a filled trap IS trapped", () => {
  assert.equal(isTrapped({ [HONEYPOT]: "http://spam.example" }), true);
  assert.equal(isTrapped({ [HONEYPOT]: "  spam  " }), true);
  assert.equal(isTrapped({ [HONEYPOT]: {} }), true, "an object is still a filled trap");
  assert.equal(isTrapped({ [HONEYPOT]: ["x"] }), true, "an array is still a filled trap");
});

test("an unticked trap is not a trap", () => {
  assert.equal(isTrapped({ [HONEYPOT]: "" }), false);
  assert.equal(isTrapped({ [HONEYPOT]: "   " }), false);
  assert.equal(isTrapped({ [HONEYPOT]: null }), false);
  assert.equal(isTrapped({}), false);
  assert.equal(isTrapped(null), false);
});

test("no record the pipeline builds can ever trip the trap", () => {
  const record = buildIntake({}, { jobId: "test-author-abcde", submittedDate: "2026-11-12" });
  assert.equal(isTrapped(record), false);
  assert.equal(Object.hasOwn(record, HONEYPOT), false);
});

test("schemaPropertyNames walks $defs, items, allOf and additionalProperties", () => {
  const fixture = {
    properties: {
      top: {
        type: "object",
        properties: {
          middle: { type: "array", items: { type: "object", properties: { deep: { type: "string" } } } },
        },
      },
    },
    allOf: [{ properties: { combined: { type: "string" } } }],
    $defs: { ref: { type: "object", properties: { from_def: { type: "string" } } } },
  };
  const names = schemaPropertyNames(fixture);
  for (const key of ["top", "middle", "deep", "combined", "from_def"]) {
    assert.ok(names.has(key), `walker missed "${key}"`);
  }
});
