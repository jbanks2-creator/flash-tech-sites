/**
 * The contact form's one job: turn a submission into an email that reaches a human.
 *
 * Four callers share this file:
 *   app/api/contact/route.js   the handler — validation, spam control, delivery
 *   app/ContactForm.jsx        the browser form — field caps and the honeypot input
 *   instrumentation.js         the startup line that states what delivery will actually do
 *   lib/contact-mail.test.mjs  `npm test` — the rules below, as assertions
 *
 * The rules, each one a defect this site has already shipped once:
 *
 * 1. **A message is either delivered or refused.** There is no third outcome. The stub this
 *    file replaces answered `{ok:true}` to every visitor and sent the message to `docker logs`,
 *    so a lead could disappear with a success message on screen.
 * 2. **The provider is configuration, never code.** `CONTACT_PROVIDER=resend|postmark|smtp`.
 *    The credential lives in the deployment env and is only ever read, never logged, never
 *    echoed in a response, never written to disk. A provider that is selected but not
 *    complete is a *misconfiguration*: loud at startup, and it refuses submissions rather
 *    than accepting them into a void.
 * 3. **Nothing personal goes to the log.** No name, no email address, no message body, no
 *    IP, no user-agent. The rate limiter keeps a hash of the IP in memory and the logs carry
 *    only that hash — enough to prove two clients bucketed separately, useless as a visitor log.
 * 4. **The honeypot follows the intake trap's rule** (`lib/intake-fields.mjs`): an `hp_`
 *    name that collides with no real field, checked before validation, answered with the same
 *    shape a success gets, and never followed by a send.
 */

import { createHash } from 'node:crypto';

/**
 * The field contract (trap name, caps, addresses, labels) is shared with the browser form, so it
 * lives in `lib/contact-fields.mjs` — a module with no `node:` imports — and is re-exported
 * here. The route, the startup report and the tests import this file and do not need to know
 * about the split.
 *
 * `HONEYPOT` is the trap field. The `hp_` prefix is the rule the authors-intake incident
 * established on 2026-11-12: the trap was once called `website`, which was also a real section
 * of the intake record, so every genuine submission tripped it and was discarded with
 * `{ok:true}`. A trap name must be something no honest payload has a reason to send; here it is
 * also outside `FIELDS`, so a filled trap can never be mistaken for a real answer.
 */
export * from './contact-fields.mjs';

import { DEFAULT_FALLBACK, DEFAULT_TO, FIELDS, HONEYPOT, LIMITS, labels } from './contact-fields.mjs';

/* --------------------------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------------------------ */

const clean = (value) => String(value == null ? '' : value).replace(/\u0000/g, '').trim();

/** The three providers this build can send with. Anything else is a configuration error. */
export const PROVIDERS = Object.freeze(['resend', 'postmark', 'smtp']);

/**
 * One address check, deliberately not RFC 5322. It rejects what a browser's `type=email`
 * rejects (no whitespace, exactly one @ with something either side) plus the two things that
 * would otherwise end up inside a mail header: CR and LF. Postel's law is not worth a header
 * injection.
 */
const EMAIL_RE = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[A-Za-z]{2,}$/;

export function looksLikeEmail(value) {
  const address = clean(value);
  return address.length <= LIMITS.email && !/[\r\n]/.test(address) && EMAIL_RE.test(address);
}

/**
 * Read only the known fields, cap them, and check the two that must be there.
 *
 * Returns `{ ok, values, errors }` where every error names the field AS THE VISITOR SEES IT
 * (`labels`) so the route can say "check the email address" instead of "field email invalid".
 */
export function validateMessage(body) {
  const values = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, values, errors: [{ field: '', label: '', message: 'The form could not be read.' }] };
  }

  for (const field of FIELDS) {
    const value = body[field];
    // A non-string answer is not something this form sends; refuse rather than stringify it
    // into the message (an object with a `toString` is how you get `[object Object]` in an inbox).
    if (value != null && typeof value !== 'string' && typeof value !== 'number') {
      errors.push({ field, label: labels[field], message: `must be text` });
      continue;
    }
    const text = clean(value);
    if (text.length > LIMITS[field]) {
      errors.push({ field, label: labels[field], message: `is longer than ${LIMITS[field]} characters` });
    }
    values[field] = text;
  }

  if (!values.name) errors.push({ field: 'name', label: labels.name, message: 'is required' });
  if (!values.email) errors.push({ field: 'email', label: labels.email, message: 'is required' });
  else if (!looksLikeEmail(values.email)) {
    errors.push({ field: 'email', label: labels.email, message: 'does not look like an email address' });
  }

  return { ok: errors.length === 0, values, errors };
}

/* --------------------------------------------------------------------------------------------
 * The honeypot — same semantics as `isTrapped` in lib/intake-fields.mjs
 * ------------------------------------------------------------------------------------------ */

/**
 * A bot fills every input it finds; a person never sees this one. Any non-empty value means
 * the sender is not a person: a string with content, or anything that is not a string at all
 * (an object is not something this form ever sends). `null`/`undefined`/`""` are honest.
 */
export function isTrapped(body) {
  if (!body || typeof body !== 'object') return false;
  const value = body[HONEYPOT];
  if (value == null) return false;
  if (typeof value === 'object') return true;
  return clean(value) !== '';
}

/* --------------------------------------------------------------------------------------------
 * Configuration — resolved from env, described (never dumped), and never trusted to be complete
 * ------------------------------------------------------------------------------------------ */

const trim = (value) => clean(value);

/**
 * Turn the deployment env into a delivery config.
 *
 * `reason` is the whole story:
 *   ''                 ready to send
 *   'no-provider'      nothing is configured — the *expected* pre-launch state, not an error.
 *                      The site renders a mailto CTA and POST refuses with a 503 that names
 *                      the address. This is the honest version of the stub.
 *   'unknown-provider' CONTACT_PROVIDER is set to something this build cannot send with
 *   'missing-api-key'  a provider is selected but its credential is absent — someone meant
 *                      mail to work. Loud at startup, refused at submit.
 *   'invalid-to' / 'missing-from' / 'missing-smtp-*'  same idea, field by field.
 */
export function resolveConfig(env = process.env) {
  const provider = trim(env.CONTACT_PROVIDER).toLowerCase();
  const to = trim(env.CONTACT_TO) || DEFAULT_TO;
  const from = trim(env.CONTACT_FROM);
  const fallbackEmail = trim(env.CONTACT_FALLBACK_EMAIL) || DEFAULT_FALLBACK;
  const apiKey = trim(env.CONTACT_API_KEY);

  const smtp = {
    host: trim(env.CONTACT_SMTP_HOST),
    port: Number(trim(env.CONTACT_SMTP_PORT) || 587),
    user: trim(env.CONTACT_SMTP_USER),
    pass: trim(env.CONTACT_SMTP_PASS),
    secure: trim(env.CONTACT_SMTP_SECURE) === '1' || Number(trim(env.CONTACT_SMTP_PORT)) === 465,
  };

  const config = {
    provider,
    to,
    from,
    fallbackEmail,
    apiKey,
    smtp,
    postmarkStream: trim(env.CONTACT_POSTMARK_STREAM) || 'outbound',
    rateLimit: {
      limit: positiveInt(env.CONTACT_RATE_LIMIT, 5),
      windowMs: positiveInt(env.CONTACT_RATE_WINDOW_SECONDS, 900) * 1000,
    },
    reason: '',
    detail: '',
  };

  if (!provider) {
    config.reason = 'no-provider';
    config.detail = 'CONTACT_PROVIDER is not set, so no message can be sent.';
    return config;
  }
  if (!PROVIDERS.includes(provider)) {
    config.reason = 'unknown-provider';
    config.detail = `CONTACT_PROVIDER="${provider}" is not one of ${PROVIDERS.join(', ')}.`;
    return config;
  }
  if (!from) {
    config.reason = 'missing-from';
    config.detail = 'CONTACT_FROM is not set, so the message would arrive from nowhere.';
    return config;
  }
  if (!looksLikeEmail(stripDisplayName(from))) {
    config.reason = 'invalid-from';
    config.detail = 'CONTACT_FROM does not contain a usable address.';
    return config;
  }
  if (!looksLikeEmail(to)) {
    config.reason = 'invalid-to';
    config.detail = 'CONTACT_TO does not contain a usable address.';
    return config;
  }
  if (provider === 'smtp') {
    if (!smtp.host) {
      config.reason = 'missing-smtp-host';
      config.detail = 'CONTACT_PROVIDER=smtp needs CONTACT_SMTP_HOST.';
      return config;
    }
    if (smtp.user && !smtp.pass) {
      config.reason = 'missing-smtp-pass';
      config.detail = 'CONTACT_SMTP_USER is set but CONTACT_SMTP_PASS is empty.';
      return config;
    }
    return config;
  }
  if (!apiKey) {
    config.reason = 'missing-api-key';
    config.detail = `CONTACT_PROVIDER=${provider} needs CONTACT_API_KEY.`;
    return config;
  }
  return config;
}

function positiveInt(value, fallback) {
  const n = Number(clean(value));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** `Flash Tech <website@flashtech.biz>` -> `website@flashtech.biz`, for validation only. */
export function stripDisplayName(from) {
  const match = String(from || '').match(/<([^>]+)>/);
  return clean(match ? match[1] : from);
}

export const isReady = (config) => !config.reason;

/**
 * The startup line. Emitted once per process from instrumentation.js, so the answer to "does
 * the contact form actually send?" is in `docker logs flash-tech-web` before any visitor
 * submits anything, instead of being discovered by the first lead.
 *
 * Contains no credential: provider name, the two published addresses, and the reason.
 */
export function describeDelivery(config) {
  return {
    at: new Date().toISOString(),
    kind: 'contact-delivery-config',
    outcome: isReady(config) ? 'ready' : config.reason === 'no-provider' ? 'disabled' : 'misconfigured',
    severity: isReady(config) || config.reason === 'no-provider' ? 'info' : 'critical',
    provider: config.provider || 'none',
    to: config.to,
    from: config.from || null,
    fallback_email: config.fallbackEmail,
    reason: config.reason || null,
    detail: config.detail || null,
    note: isReady(config)
      ? 'the contact form sends mail; the CTA is the form'
      : 'the contact form sends NOTHING: the CTA is a mailto link and POST /api/contact refuses with 503 naming the fallback address',
  };
}

/* --------------------------------------------------------------------------------------------
 * Rate limiting — per client, in memory, no IP stored
 * ------------------------------------------------------------------------------------------ */

/**
 * A sliding window per key. Small and bounded on purpose: this container holds one process,
 * the volume is a small business's contact form, and a restart forgetting the counters is a
 * cost worth paying for not adding Redis to a landing page.
 *
 * The map is capped so a spoofed-IP flood cannot grow it without limit; the oldest key is
 * dropped when the cap is hit. Evicting a live key under a flood is the right failure: it
 * costs one extra allowed submission, never a refused real one.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 5000 } = {}) {
  const hits = new Map();

  return {
    check(key) {
      const t = now();
      const k = String(key || 'unknown');
      const cutoff = t - windowMs;
      const stamps = (hits.get(k) || []).filter((stamp) => stamp > cutoff);
      if (stamps.length >= limit) {
        hits.set(k, stamps);
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((stamps[0] + windowMs - t) / 1000)), remaining: 0 };
      }
      stamps.push(t);
      hits.set(k, stamps);
      if (hits.size > maxKeys) {
        for (const oldKey of hits.keys()) {
          hits.delete(oldKey);
          if (hits.size <= maxKeys) break;
        }
      }
      return { allowed: true, retryAfterSec: 0, remaining: limit - stamps.length };
    },
    /** Exposed for the tests; the route never needs it. */
    size: () => hits.size,
  };
}

/** First 12 hex of sha256 — a stable bucket id that cannot be turned back into an IP. */
export function hashIp(ip) {
  return createHash('sha256').update(String(ip || '')).digest('hex').slice(0, 12);
}

/**
 * Which header carries the visitor's address. Cloudflare sets `CF-Connecting-IP` and
 * cloudflared forwards it unchanged; `X-Forwarded-For` (which cloudflared appends to) is the
 * fallback for a request that reached the origin some other way. `source` is logged so the
 * first real submission proves which one this deployment actually gets — a rate limiter
 * bucketing every visitor as 'unknown' would rate-limit the whole town as one client.
 */
export function clientIp(headers) {
  const get = (name) => (headers && typeof headers.get === 'function' ? headers.get(name) : null);
  const cf = clean(get('cf-connecting-ip'));
  if (cf) return { ip: cf, source: 'cf-connecting-ip' };
  const xff = clean(get('x-forwarded-for')).split(',')[0];
  if (xff && xff.trim()) return { ip: xff.trim(), source: 'x-forwarded-for' };
  return { ip: '', source: 'none' };
}

/* --------------------------------------------------------------------------------------------
 * The message
 * ------------------------------------------------------------------------------------------ */

/**
 * Subject and body. Every value that can reach a header is stripped of CR/LF first — the
 * name is visitor-controlled text and a header is not a place to learn that the hard way.
 */
export function composeMessage(values) {
  const author = headerSafe(values.name).slice(0, 120);
  const organisation = headerSafe(values.business).slice(0, 120);
  const subject = `Contact form: ${author}${organisation ? ` (${organisation})` : ''}`.slice(0, 180);

  const lines = [
    `Name:     ${values.name}`,
    values.business ? `Business: ${values.business}` : null,
    `Email:    ${values.email}`,
    values.phone ? `Phone:    ${values.phone}` : null,
    '',
    'Message:',
    values.message || '(no message — the visitor left this blank)',
    '',
    '--',
    'Sent from the contact form at https://flashtech.biz/contact',
    'Reply goes straight to the sender: this message carries Reply-To.',
  ].filter((line) => line !== null);

  return { subject, text: lines.join('\n') };
}

export function headerSafe(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

/* --------------------------------------------------------------------------------------------
 * Delivery — the only place a message leaves this server
 * ------------------------------------------------------------------------------------------ */

export class ContactSendError extends Error {
  constructor(message, { provider, status = 0, code = '' } = {}) {
    super(message);
    this.name = 'ContactSendError';
    this.provider = provider;
    this.status = status;
    this.code = code;
  }
}

/**
 * Hand the message to the configured provider and return the provider's own id for it.
 *
 * Throws ContactSendError on anything that is not an accepted message. The caller must treat
 * every throw as "not delivered" and say so to the visitor — there is no partial success.
 *
 * `deps` exists so the tests can prove the request shape without a network: fetch for the two
 * HTTP providers, `transport` (a nodemailer transport) for smtp.
 */
export async function sendContactMessage(values, config, deps = {}) {
  if (!isReady(config)) {
    throw new ContactSendError('contact delivery is not configured', { provider: config.provider || 'none', code: config.reason });
  }
  const { subject, text } = composeMessage(values);

  // `deps.fetchImpl` / `deps.transport` exist so the tests can prove the request shape without a
  // network: a test that silently fell through to the real provider would be a test that emails
  // Resend on every `npm test`.
  const fetchImpl = deps.fetchImpl || fetch;

  if (config.provider === 'resend') return sendViaResend({ config, values, subject, text, fetchImpl });
  if (config.provider === 'postmark') return sendViaPostmark({ config, values, subject, text, fetchImpl });
  if (config.provider === 'smtp') return sendViaSmtp({ config, values, subject, text, transport: deps.transport });
  throw new ContactSendError('unknown provider', { provider: config.provider, code: 'unknown-provider' });
}

async function sendViaResend({ config, values, subject, text, fetchImpl }) {
  const response = await callProvider(fetchImpl, 'resend', 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject,
      text,
      reply_to: values.email,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ContactSendError(providerMessage(response, payload, 'Resend refused the message'), {
      provider: 'resend',
      status: response.status,
      code: payload?.name || payload?.error?.name || '',
    });
  }
  return { provider: 'resend', id: payload?.id || '' };
}

async function sendViaPostmark({ config, values, subject, text, fetchImpl }) {
  const response = await callProvider(fetchImpl, 'postmark', 'https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'x-postmark-server-token': config.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      From: config.from,
      To: config.to,
      Subject: subject,
      TextBody: text,
      ReplyTo: values.email,
      MessageStream: config.postmarkStream,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ContactSendError(providerMessage(response, payload, 'Postmark refused the message'), {
      provider: 'postmark',
      status: response.status,
      code: payload?.ErrorCode != null ? String(payload.ErrorCode) : '',
    });
  }
  return { provider: 'postmark', id: payload?.MessageID || '' };
}

async function sendViaSmtp({ config, values, subject, text, transport }) {
  let tx = transport;
  if (!tx) {
    // Imported lazily so an image that only ever configures resend/postmark does not pay for it,
    // and so a build without the dependency still boots the two HTTP providers.
    const nodemailer = await import('nodemailer');
    tx = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      // A contact form is not a mailing list: one connection per message, short timeouts, and
      // no pooling to leak between submissions in a single-process container.
      pool: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  try {
    const info = await tx.sendMail({
      from: config.from,
      to: config.to,
      subject,
      text,
      replyTo: values.email,
    });
    return { provider: 'smtp', id: info?.messageId || '' };
  } catch (error) {
    throw new ContactSendError(error?.message || 'SMTP refused the message', {
      provider: 'smtp',
      status: Number(error?.responseCode) || 0,
      code: String(error?.code || ''),
    });
  }
}

async function callProvider(fetchImpl, provider, url, init) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    // No network, DNS failure, timeout: the provider never saw the message.
    throw new ContactSendError(`${provider} could not be reached`, { provider, code: String(error?.name || 'network') });
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * The provider's own words, truncated and stripped of anything long enough to be a payload.
 * Never includes the request body (which carries the visitor's name and message) and never
 * includes the credential.
 */
function providerMessage(response, payload, fallback) {
  const raw = payload?.message || payload?.Message || payload?.error?.message || '';
  const text = String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
  return `${fallback} (HTTP ${response.status})${text ? `: ${text}` : ''}`;
}

/**
 * The one log line per submission, and the reason it is safe to keep forever: it carries no
 * name, no address, no message, no credential. `outcome` is what a human greps for.
 */
export function submissionLog({ outcome, provider = 'none', id = '', ipHash = '', ipSource = '', status = 0, code = '', durationMs = 0 }) {
  return {
    at: new Date().toISOString(),
    kind: 'contact',
    outcome,
    provider,
    message_id: id || null,
    provider_status: status || null,
    provider_code: code || null,
    ip_hash: ipHash || null,
    ip_source: ipSource || null,
    duration_ms: durationMs || null,
  };
}
