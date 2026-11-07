import { NextResponse } from 'next/server';

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* ignore malformed */ }

  if (!body?.name || !body?.email) {
    return NextResponse.json({ ok: false, error: 'name and email are required' }, { status: 400 });
  }

  // STUB: no mail is sent yet. Wire to Postmark/Resend or a CRM once the domain has MX + SPF/DKIM.
  console.log('[contact]', JSON.stringify({ ...body, at: new Date().toISOString() }));

  return NextResponse.json({ ok: true });
}
