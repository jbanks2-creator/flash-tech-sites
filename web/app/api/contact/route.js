import { NextResponse } from 'next/server';

import {
  HONEYPOT,
  MAX_BODY_BYTES,
  clientIp,
  createRateLimiter,
  hashIp,
  isReady,
  isTrapped,
  resolveConfig,
  sendContactMessage,
  submissionLog,
  validateMessage,
} from '@/lib/contact-mail.mjs';

/**
 * POST /api/contact — the contact form's only endpoint.
 *
 * Until 2026-11-17 this route was a stub: it validated name + email, wrote the whole submission
 * to the container log, and answered `{ok:true}`. Nothing was emailed, stored or queued, so the
 * site told every visitor their message had arrived when it had not. This handler replaces that
 * with honest outcomes, and only one of them looks like success:
 *
 *   200  the provider accepted the message — and only then
 *   400  the submission cannot be a message (malformed JSON, missing or invalid fields)
 *   503  delivery is not configured on this deployment — nothing was accepted, and the visitor
 *        is told to email the fallback address instead (the CTA already renders as that link)
 *   429  too many submissions from this client, with Retry-After
 *   502  the provider refused or could not be reached — the visitor is told so, plainly
 *
 * The honeypot is the exception that proves the rule: a filled trap gets the same `{ok:true}`
 * shape a bot expects, and no mail is sent. See lib/contact-mail.mjs rule 4.
 *
 * Deliberately NOT here: no name, email, phone or message in any log line; no credential in any
 * response; no silent storage of an undelivered message (the visitor is told to use email
 * instead, which is the only path that cannot lose the text).
 */

export const runtime = 'nodejs';
// Read the delivery config per request: `docker compose up -d web` with a new key must not need
// a rebuild, and GET must never be answered from a build-time snapshot.
export const dynamic = 'force-dynamic';

const config = resolveConfig();
const limiter = createRateLimiter({ ...config.rateLimit });

const json = (body, status = 200, headers = {}) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

/**
 * GET /api/contact — what the form asks before it offers a text box.
 *
 * `{ready:false, email}` is what makes the page render "Email support@…" instead of a form that
 * would fail on submit. It carries no provider name, no key and no config detail: the visitor
 * needs to know which path works, not how the sausage is made.
 */
export async function GET() {
  return json({ ready: isReady(config), email: config.fallbackEmail });
}

export async function POST(request) {
  const startedAt = Date.now();
  const { ip, source: ipSource } = clientIp(request.headers);
  const ipHash = hashIp(ip || `unknown:${ipSource}`);

  // 1. Size, before reading the body.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    return json(
      { ok: false, error: `That message is too long. Email ${config.fallbackEmail} and send it that way.` },
      413,
    );
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json(
        { ok: false, error: `That message is too long. Email ${config.fallbackEmail} and send it that way.` },
        413,
      );
    }
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'That submission could not be read. Please try again.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'That submission could not be read. Please try again.' }, 400);
  }

  // 2. Honeypot. A bot fills every input; a person never sees this one. The client gets the shape
  //    it wants and learns nothing; the log line is a `warn` with outcome "discarded" and an
  //    explicit `sent:false`, which no delivered message carries — so this can never be mistaken
  //    in `docker logs` for a submission that reached the inbox.
  if (isTrapped(body)) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'contact',
        outcome: 'discarded',
        severity: 'warn',
        sent: false,
        trap: HONEYPOT,
        reason: 'honeypot field was filled',
        ip_hash: ipHash,
        note: 'nothing was sent; the client was told ok:true on purpose',
      }),
    );
    return json({ ok: true });
  }

  // 3. Per-client rate limit. 5 in 15 minutes by default — a small business's whole day's worth.
  const verdict = limiter.check(ip || `unknown:${ipSource}`);
  if (!verdict.allowed) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'contact',
        outcome: 'rate-limited',
        severity: 'warn',
        sent: false,
        retry_after_sec: verdict.retryAfterSec,
        ip_hash: ipHash,
        ip_source: ipSource,
      }),
    );
    return json(
      {
        ok: false,
        error: `That is a few messages in a short time. Please try again in ${Math.ceil(verdict.retryAfterSec / 60)} minutes, or email ${config.fallbackEmail}.`,
      },
      429,
      { 'retry-after': String(verdict.retryAfterSec) },
    );
  }

  // 4. Validation: malformed input is a 400 that names the box on the page.
  const { ok, values, errors } = validateMessage(body);
  if (!ok) {
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'contact',
        outcome: 'refused',
        sent: false,
        errors: errors.map((error) => error.field || 'body'),
        ip_hash: ipHash,
      }),
    );
    return json(
      {
        ok: false,
        error: `Please check ${errors.length === 1 ? 'one field' : `${errors.length} fields`} below. Nothing was sent.`,
        errors: errors.slice(0, 10),
      },
      400,
    );
  }

  // 5. No provider: refuse. This is the branch that replaces the stub's `{ok:true}`. It names
  //    the real path, so the visitor leaves with a way to reach Jerry, not a dead end.
  if (!isReady(config)) {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: 'contact',
        outcome: 'unconfigured',
        severity: 'critical',
        sent: false,
        reason: config.reason,
        detail: config.detail,
        ip_hash: ipHash,
        note: 'delivery is not configured on this deployment; the visitor was told to email the fallback address',
      }),
    );
    return json(
      {
        ok: false,
        error: `The form is not connected to our inbox yet, so your message was not sent. Please email ${config.fallbackEmail} — it reaches Jerry directly.`,
        email: config.fallbackEmail,
      },
      503,
    );
  }

  // 6. Send. Success is the provider's acceptance; nothing else is allowed to look like it.
  let sent;
  try {
    sent = await sendContactMessage(values, config);
  } catch (error) {
    console.error(
      JSON.stringify({
        ...submissionLog({
          outcome: 'failed',
          provider: config.provider,
          status: error?.status || 0,
          code: error?.code || '',
          ipHash,
          ipSource,
          durationMs: Date.now() - startedAt,
        }),
        error: String(error?.message || error).slice(0, 300),
        note: 'the message was NOT delivered; the visitor was told to email the fallback address',
      }),
    );
    return json(
      {
        ok: false,
        error: `We could not hand your message to our mail service, so it was not sent. Please email ${config.fallbackEmail} instead — sorry about that.`,
        email: config.fallbackEmail,
      },
      502,
    );
  }

  console.log(
    JSON.stringify(
      submissionLog({
        outcome: 'sent',
        provider: sent.provider,
        id: sent.id,
        ipHash,
        ipSource,
        durationMs: Date.now() - startedAt,
      }),
    ),
  );

  // The response carries no address, no name, no provider detail — only that it was accepted.
  return json({ ok: true, received: true });
}
