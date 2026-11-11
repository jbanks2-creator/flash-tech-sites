import { NextResponse } from "next/server";

/**
 * Configured-tier inquiries. Same shape as the site's contact stub: validate, then log to the
 * container because there is no mail transport on this box yet. Nothing is stored in a
 * database and no third party is called. When mail exists this is the one place to wire.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const business = String(body.business || "").trim().slice(0, 160);
  const phone = String(body.phone || "").trim().slice(0, 60);
  const want = String(body.want || "").trim().slice(0, 4000);
  const when = String(body.when || "").trim().slice(0, 300);

  if (body.website) return NextResponse.json({ ok: true });         // honeypot
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    kind: "taskapp-configured-inquiry",
    name, email, business, phone, when, want,
    note: "logged only — no mail transport configured",
  }));

  return NextResponse.json({ ok: true });
}
