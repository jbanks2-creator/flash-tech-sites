import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  COVER_VO_ENABLED,
  HONEYPOT,
  LIMITS,
  MAX_BODY_BYTES,
  SCHEMA_ID,
  buildIntake,
  checkAnswers,
  describeSchemaErrors,
  isTrapped,
  makeJobId,
  schemaPropertyNames,
} from "@/lib/intake-fields.mjs";

/**
 * The Author's Candle Starter questionnaire (/startups/authors/intake).
 *
 * One submission = one JSON file, named after its job_id, in AUTHORS_INBOX/intake/. compose.yaml
 * bind-mounts that from ~/businesses/author-marketing/inquiries so the pipeline can pick the job up
 * without editing it; the directory is outside the web root and is never served.
 *
 * The record is validated against the same schema the pipeline uses
 * (~/businesses/author-marketing/intake/schema.json, mounted read-only) so a stored intake either
 * runs through scripts/validate_intake.py unchanged or is refused here with plain-English field
 * names and not written at all.
 *
 * Nothing personal beyond the answers is kept: no IP address, no user-agent, no referrer, no
 * headers. Only the answer fields named in lib/intake-fields.mjs are read off the request body.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA_PATH = process.env.INTAKE_SCHEMA || "/app/schema/intake-starter-v1.json";

/** Compiled once per process: the schema is small and static. */
let validatorPromise = null;
function getValidator() {
  if (!validatorPromise) {
    validatorPromise = (async () => {
      const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
      // A schema that has moved on is a deliberate change, not a surprise: log which version this
      // build is reading, and say loudly when it is not the one lib/intake-fields.mjs was written
      // for. A required field this form does not collect must be refused WITH ITS NAME (see
      // describeSchemaErrors) — never dropped and never guessed around.
      if (schema.$id !== SCHEMA_ID) {
        console.warn(JSON.stringify({
          at: new Date().toISOString(),
          kind: "authors-intake-schema-version-mismatch",
          outcome: "warn",
          expected: SCHEMA_ID,
          mounted: schema.$id,
          cover_vo_fields: COVER_VO_ENABLED,
        }));
      }

      // Last line of defence for the honeypot collision (see HONEYPOT in lib/intake-fields.mjs).
      // The build gate and the unit test both prove the trap name is not in the record's
      // namespace; if a schema is mounted that breaks that rule anyway, the trap would match a
      // real section and quietly discard every submission shaped like the record. Refuse instead:
      // a 500 is visible to the author and to us, a silent `{ok:true}` is not.
      const collision = schemaPropertyNames(schema).has(HONEYPOT);
      if (collision || Object.hasOwn(LIMITS, HONEYPOT)) {
        console.error(JSON.stringify({
          at: new Date().toISOString(),
          kind: "authors-intake-honeypot-collision",
          outcome: "refused",
          severity: "critical",
          trap: HONEYPOT,
          reason: collision
            ? "the honeypot name is a property name in the mounted schema"
            : "the honeypot name is one of the form's own answer fields",
          note: "Every submission is being refused on purpose. Rename the trap or the schema field before serving traffic.",
        }));
        const error = new Error(`honeypot "${HONEYPOT}" collides with the intake record`);
        error.code = "HONEYPOT_COLLISION";
        throw error;
      }

      const ajv = new Ajv2020({ allErrors: true, strict: false });
      addFormats(ajv);
      return ajv.compile(schema);
    })();
    // A failed read must not poison the process for every later submission.
    validatorPromise.catch(() => { validatorPromise = null; });
  }
  return validatorPromise;
}

const badRequest = (message, errors = []) =>
  NextResponse.json({ ok: false, error: message, errors: errors.slice(0, 40) }, { status: 400 });

const serverError = (message) =>
  NextResponse.json({ ok: false, error: message, errors: [] }, { status: 500 });

export async function POST(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "That submission is too large to accept. Email a file to support@flashtech.biz instead.", errors: [] },
      { status: 413 },
    );
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "That submission is too large to accept. Email a file to support@flashtech.biz instead.", errors: [] },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return badRequest("The questionnaire could not be read. Please try again, or email support@flashtech.biz.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("The questionnaire could not be read. Please try again, or email support@flashtech.biz.");
  }

  // Honeypot: a bot fills every input it finds, a person never sees this one. The client always
  // gets a plain `200 {ok:true}` — telling a bot it was caught only helps it adapt — but the server
  // log must never be able to confuse this with a stored submission. Hence `console.warn` (not
  // `log`), `outcome:"discarded"` and `stored:false` on the line, which no other outcome carries.
  //
  // Deliberately no IP, user-agent or header in this line: the trap exists to keep bot traffic out
  // of the inbox, not to build a visitor log.
  if (isTrapped(body)) {
    console.warn(JSON.stringify({
      at: new Date().toISOString(),
      kind: "authors-intake-honeypot",
      outcome: "discarded",
      severity: "warn",
      stored: false,
      job_id: null,
      trap: HONEYPOT,
      note: "trap field was filled: nothing written to the inbox; the client was told ok:true on purpose",
    }));
    return NextResponse.json({ ok: true });
  }

  // Only the known questions are read; anything else in the body is ignored, never stored.
  //
  // TODO(t_7487852d): the cover-video card adds a cover image (retailer URL + permission) and the
  // approved voice-over line to intake/schema.json. The attach point for both is here — they are
  // read off the body by adding their names to LIMITS in lib/intake-fields.mjs, which is the one
  // list this loop and the browser form both use — and they are written into the record in
  // buildIntake() (marked TODO there). Names must be copied from the landed schema verbatim.
  const raw = {};
  for (const key of Object.keys(LIMITS)) {
    const value = body[key];
    raw[key] = typeof value === "string" ? value : value == null ? "" : String(value);
  }

  const errors = checkAnswers(raw);
  if (errors.length) {
    console.log(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake-refused", outcome: "refused", stored: false, errors: errors.length }));
    return badRequest(`Please check ${errors.length === 1 ? "one answer" : `${errors.length} answers`} below. Nothing has been lost.`, errors);
  }

  const submittedDate = new Date().toISOString().slice(0, 10);
  const inbox = process.env.AUTHORS_INBOX;
  if (!inbox) {
    // Dev builds have no inbox mounted. Refuse rather than pretend: a half-hour of an author's
    // answers must never disappear into a log line.
    console.error(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake-unconfigured", outcome: "refused", stored: false }));
    return serverError("The questionnaire is not connected to the office inbox yet. Please email support@flashtech.biz and we'll take it from there.");
  }

  let validate;
  try {
    validate = await getValidator();
  } catch (error) {
    // A collision is not a generic failure: it is the exact bug this endpoint must never have
    // again, so it gets its own kind and the loudest level. getValidator already logged the detail.
    const collision = error && error.code === "HONEYPOT_COLLISION";
    console.error(JSON.stringify({
      at: new Date().toISOString(),
      kind: collision ? "authors-intake-honeypot-collision" : "authors-intake-schema-unreadable",
      outcome: "refused",
      stored: false,
      error: String(error),
    }));
    return serverError("Something went wrong on our side. Please try again in a few minutes, or email support@flashtech.biz.");
  }

  const directory = join(inbox, "intake");
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    console.error(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake-mkdir-failed", outcome: "failed", stored: false, error: String(error) }));
    return serverError("Something went wrong on our side. Please try again in a few minutes, or email support@flashtech.biz.");
  }

  // Validate, then write: a refused record never leaves a file behind.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jobId = makeJobId(raw.public_name);
    const intake = buildIntake(raw, { jobId, submittedDate });

    if (!validate(intake)) {
      const problems = describeSchemaErrors(validate.errors || []);
      console.error(JSON.stringify({ at: submittedDate, kind: "authors-intake-schema-refused", outcome: "refused", stored: false, errors: problems.map((p) => `${p.label}: ${p.message}`) }));
      return badRequest("Some answers don't fit the record we have to keep. Nothing has been lost; please check the fields below.", problems);
    }

    try {
      await writeFile(join(directory, `${jobId}.json`), `${JSON.stringify(intake, null, 2)}\n`, { flag: "wx" });
    } catch (error) {
      if (error && error.code === "EEXIST") continue; // a suffix collision: try another job_id
      console.error(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake-store-failed", outcome: "failed", stored: false, error: String(error) }));
      return serverError("We couldn't save your answers. Please try again in a few minutes, or email support@flashtech.biz.");
    }

    console.log(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake", outcome: "stored", job_id: jobId, stored: true }));
    return NextResponse.json({ ok: true, job_id: jobId, submitted_date: submittedDate });
  }

  console.error(JSON.stringify({ at: new Date().toISOString(), kind: "authors-intake-id-collision", outcome: "failed", stored: false }));
  return serverError("Something went wrong on our side. Please try again in a few minutes, or email support@flashtech.biz.");
}
