import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The Author's Candle founding-spot applications (/startups/authors).
 *
 * Same validation shape as /api/taskapp-inquiry, plus persistence: each application is written as
 * one JSON file to AUTHORS_INBOX, which compose bind-mounts from
 * ~/businesses/author-marketing/inquiries so the business workspace (and Hermes) can read it.
 * If AUTHORS_INBOX is unset (dev), it is logged to the container only.
 * No database, no third party, no visitor IP stored.
 */
const FIELDS = { name: 120, email: 200, title: 200, status: 60, type: 20, link: 500, message: 4000 };
const REQUIRED = ["name", "email", "title", "status", "type"];
const STATUS = ["Published", "Launching in the next 3 months", "Launching later", "Still writing"];
const TYPE = ["Fiction", "Nonfiction"];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The application could not be read." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "The application could not be read." }, { status: 400 });
  }
  if (body.website) return NextResponse.json({ ok: true }); // honeypot

  const record = {};
  for (const [key, limit] of Object.entries(FIELDS)) record[key] = String(body[key] || "").trim().slice(0, limit);

  const missing = REQUIRED.filter((k) => !record[k]);
  if (missing.length) {
    return NextResponse.json({ error: "Please fill in: " + missing.join(", ") + "." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(record.email)) {
    return NextResponse.json({ error: "That email address looks incomplete." }, { status: 400 });
  }
  if (!STATUS.includes(record.status) || !TYPE.includes(record.type)) {
    return NextResponse.json({ error: "Please choose from the lists provided." }, { status: 400 });
  }

  record.received_utc = new Date().toISOString();
  record.source = "flashtech.biz/startups/authors";

  const inbox = process.env.AUTHORS_INBOX;
  if (inbox) {
    try {
      await mkdir(inbox, { recursive: true });
      const stamp = record.received_utc.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
      const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "applicant";
      await writeFile(join(inbox, `${stamp}-${slug}.json`), JSON.stringify(record, null, 2), { flag: "wx" });
    } catch (error) {
      console.error(JSON.stringify({ at: record.received_utc, kind: "authors-apply-store-failed", error: String(error) }));
      return NextResponse.json({ error: "Something went wrong on our side. Please try again in a few minutes." }, { status: 500 });
    }
  }

  console.log(JSON.stringify({ at: record.received_utc, kind: "authors-application", title: record.title, stored: Boolean(inbox) }));
  return NextResponse.json({ ok: true });
}
