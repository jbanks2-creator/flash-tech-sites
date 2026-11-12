#!/usr/bin/env node
/**
 * Vendor the pipeline's intake schema into the web build context.
 *
 * `web/` is the Docker build context and this host has no buildx, so a Dockerfile cannot reach
 * ~/businesses/author-marketing/intake/schema.json. The honeypot build gate still has to check the
 * real record, so a byte-identical copy lives at web/schema/intake-starter-v1.json.
 *
 * The copy is never trusted blindly: `node scripts/check-intake-honeypot.mjs --schema <the real
 * schema> --require-vendored-match` (run by scripts/deploy-intake.sh) fails when the two differ,
 * naming this command.
 *
 * Usage: node scripts/vendor-intake-schema.mjs [path-to-schema.json]
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = "/home/Jerry/businesses/author-marketing/intake/schema.json";
const target = join(WEB, "schema", "intake-starter-v1.json");

const source = resolve(process.argv[2] || process.env.INTAKE_SCHEMA || DEFAULT_SOURCE);

let text;
try {
  text = readFileSync(source, "utf8");
} catch (error) {
  console.error(`vendor-intake-schema: cannot read ${source}: ${String(error)}`);
  process.exit(1);
}

// Refuse to vendor something that is not the record: a typo in the path must not quietly replace
// the copy the build gate reads.
const schema = JSON.parse(text);
if (!schema.$id || !schema.properties) {
  console.error(`vendor-intake-schema: ${source} does not look like the intake record (needs $id and properties)`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

const hash = createHash("sha256").update(readFileSync(target)).digest("hex");
console.log(`vendor-intake-schema: ${source} -> ${target}`);
console.log(`vendor-intake-schema: sha256 ${hash} · $id ${schema.$id}`);
