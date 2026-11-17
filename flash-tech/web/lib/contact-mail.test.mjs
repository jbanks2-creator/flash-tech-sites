/**
 * The contact form's rules, as assertions.
 *
 * The defect these exist for (kanban t_9c2fc2ff): `/api/contact` answered `{ok:true}` to every
 * visitor and sent nothing — no mail, no storage, no queue — for as long as the site had a contact
 * form. The comment in the stub said "wire this once the domain has MX + SPF/DKIM"; that condition
 * had been met for six days when the card was written, and the form still lied.
 *
 * So each rule below is one way a message can be lost or a credential can leak, tested rather than
 * remembered. `npm test` runs them; nothing here needs a provider or a network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_FALLBACK,
  DEFAULT_TO,
  FIELDS,
  HONEYPOT,
  LIMITS,
  MAX_BODY_BYTES,
  TRAP_IS_NOT_A_FIELD,
  clientIp,
  composeMessage,
  createRateLimiter,
  describeDelivery,
  hashIp,
  isReady,
  isTrapped,
  looksLikeEmail,
  resolveConfig,
  sendContactMessage,
  submissionLog,
  validateMessage,
} from "./contact-mail.mjs";

// Deliberately NOT shaped like a real provider key: `npm run build` runs
// scripts/check-contact-form.mjs, which fails the image if anything in the tree looks like a
// committed credential. The value only has to be unique and recognisable in a log line.
const SECRET = "test-key-not-a-real-one-0123456789";
const validBody = () => ({
  name: "Dana Whitfield",
  business: "Whitfield Feed & Supply",
  email: "dana@whitfieldfeed.example",
  phone: "903-555-0134",
  message: "The office PC reboots every morning around 8 and the printer disappears with it.",
});

/* ---- the field contract -------------------------------------------------- */

test("the trap name follows the hp_ rule and collides with no real field", () => {
  // The 2026-11-12 intake incident in one line: a trap named after a real field discards every
  // genuine submission as a bot. The name must be a shape no honest payload sends.
  assert.match(HONEYPOT, /^hp_[a-z0-9_]+$/);
  assert.equal(TRAP_IS_NOT_A_FIELD, true, "the honeypot name is one of the form's own fields");
  assert.ok(!FIELDS.includes(HONEYPOT), "the honeypot must not be a field validateMessage reads");
  assert.ok(!(HONEYPOT in LIMITS), "the honeypot must not have a cap — it is never stored");
});

test("a genuine submission does not trip the trap", () => {
  assert.equal(isTrapped(validBody()), false, "a real submission was treated as a bot");
  assert.equal(isTrapped({ ...validBody(), [HONEYPOT]: "" }), false);
  assert.equal(isTrapped({ ...validBody(), [HONEYPOT]: "   " }), false);
  assert.equal(isTrapped({ ...validBody(), [HONEYPOT]: "https://spam.example" }), true);
  assert.equal(isTrapped({ ...validBody(), [HONEYPOT]: { filled: true } }), true);
  assert.equal(isTrapped(null), false);
});

/* ---- validation ---------------------------------------------------------- */

test("a complete submission validates and keeps every value intact", () => {
  const body = validBody();
  const result = validateMessage(body);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.values, body);
});

test("name and email are required, and the error names the box on the page", () => {
  const noName = validateMessage({ email: "a@b.example", message: "hi" });
  assert.equal(noName.ok, false);
  assert.deepEqual(noName.errors.map((e) => e.field), ["name"]);
  assert.equal(noName.errors[0].label, "Your name");

  const noEmail = validateMessage({ name: "Dana" });
  assert.equal(noEmail.ok, false);
  assert.ok(noEmail.errors.some((e) => e.field === "email" && e.label === "Email"));
});

test("an address a browser would reject is refused here too", () => {
  for (const bad of ["dana", "dana@", "@whitfield.example", "dana whitfield@example.com", "a@b", "dana@whitfield"]) {
    assert.equal(looksLikeEmail(bad), false, `accepted ${JSON.stringify(bad)}`);
    const result = validateMessage({ name: "Dana", email: bad });
    assert.equal(result.ok, false, `accepted ${JSON.stringify(bad)}`);
    assert.ok(result.errors.some((e) => e.field === "email"));
  }
  assert.equal(looksLikeEmail("dana@whitfield.example"), true);
  assert.equal(looksLikeEmail("dana.whitfield+site@sub.whitfield-feed.co.uk"), true);
});

test("a header injection in the address is refused, not sanitised into a send", () => {
  assert.equal(looksLikeEmail("dana@whitfield.example\r\nBcc: everyone@example.com"), false);
  assert.equal(looksLikeEmail("dana@whitfield.example\nBcc: everyone@example.com"), false);
});

test("oversized answers are refused by name and never truncated silently", () => {
  const result = validateMessage({ ...validBody(), message: "x".repeat(LIMITS.message + 1) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "message" && /longer than/.test(e.message)));
});

test("a non-text answer is refused rather than stringified into the message", () => {
  const result = validateMessage({ ...validBody(), message: { toString: () => "[object Object]" } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.field === "message"));
});

test("fields this endpoint does not read are ignored, never carried into the email", () => {
  const result = validateMessage({ ...validBody(), admin: "1", unsubscribe: "yes" });
  assert.equal(result.ok, true);
  assert.equal("admin" in result.values, false);
  assert.equal("unsubscribe" in result.values, false);
});

test("the body cap is small enough to be a refusal, large enough for a real enquiry", () => {
  assert.ok(MAX_BODY_BYTES <= 64 * 1024);
  assert.ok(MAX_BODY_BYTES > LIMITS.message + 500);
});

/* ---- configuration ------------------------------------------------------- */

test("no provider means 'not configured', not 'broken' — and never ready", () => {
  const config = resolveConfig({});
  assert.equal(config.reason, "no-provider");
  assert.equal(isReady(config), false);
  assert.equal(config.to, DEFAULT_TO);
  assert.equal(config.fallbackEmail, DEFAULT_FALLBACK, "the visitor-facing address is not the delivery address");
  const line = describeDelivery(config);
  assert.equal(line.outcome, "disabled");
  assert.equal(line.severity, "info", "an unconfigured pre-launch form is not an incident");
});

test("a provider with no credential is misconfigured: loud, and still not ready", () => {
  const config = resolveConfig({ CONTACT_PROVIDER: "resend", CONTACT_FROM: "site@flashtech.biz" });
  assert.equal(config.reason, "missing-api-key");
  assert.equal(isReady(config), false);
  const line = describeDelivery(config);
  assert.equal(line.outcome, "misconfigured");
  assert.equal(line.severity, "critical", "a half-finished mail setup must not be logged as info");
});

test("a complete resend / postmark configuration is ready", () => {
  for (const provider of ["resend", "postmark"]) {
    const config = resolveConfig({
      CONTACT_PROVIDER: provider,
      CONTACT_API_KEY: SECRET,
      CONTACT_FROM: "Flash Tech website <site@flashtech.biz>",
      CONTACT_TO: "support@flashtech.biz",
    });
    assert.equal(config.reason, "", `${provider}: ${config.detail}`);
    assert.equal(isReady(config), true);
    assert.equal(config.to, "support@flashtech.biz");
  }
});

test("smtp needs a host, and a user needs a password", () => {
  const base = { CONTACT_PROVIDER: "smtp", CONTACT_FROM: "site@flashtech.biz" };
  assert.equal(resolveConfig(base).reason, "missing-smtp-host");
  assert.equal(resolveConfig({ ...base, CONTACT_SMTP_HOST: "smtp.flashtech.biz" }).reason, "");
  assert.equal(
    resolveConfig({ ...base, CONTACT_SMTP_HOST: "smtp.flashtech.biz", CONTACT_SMTP_USER: "site" }).reason,
    "missing-smtp-pass",
  );
});

test("an unknown provider, or an unusable destination, is refused instead of guessed", () => {
  assert.equal(resolveConfig({ CONTACT_PROVIDER: "sendgrid" }).reason, "unknown-provider");
  assert.equal(
    resolveConfig({ CONTACT_PROVIDER: "resend", CONTACT_API_KEY: SECRET, CONTACT_FROM: "site@flashtech.biz", CONTACT_TO: "nope" }).reason,
    "invalid-to",
  );
  assert.equal(
    resolveConfig({ CONTACT_PROVIDER: "resend", CONTACT_API_KEY: SECRET, CONTACT_FROM: "nope" }).reason,
    "invalid-from",
  );
});

test("the rate limit is configuration with a sane default", () => {
  const config = resolveConfig({});
  assert.equal(config.rateLimit.limit, 5);
  assert.equal(config.rateLimit.windowMs, 15 * 60 * 1000);
  const tuned = resolveConfig({ CONTACT_RATE_LIMIT: "3", CONTACT_RATE_WINDOW_SECONDS: "60" });
  assert.equal(tuned.rateLimit.limit, 3);
  assert.equal(tuned.rateLimit.windowMs, 60_000);
  const nonsense = resolveConfig({ CONTACT_RATE_LIMIT: "lots" });
  assert.equal(nonsense.rateLimit.limit, 5, "a bad value must not disable the limiter");
});

/* ---- the credential never leaves the process ---------------------------- */

test("neither the startup line nor a submission line can carry the key or the message", () => {
  const config = resolveConfig({
    CONTACT_PROVIDER: "resend",
    CONTACT_API_KEY: SECRET,
    CONTACT_FROM: "site@flashtech.biz",
    CONTACT_TO: "support@flashtech.biz",
  });
  const startup = JSON.stringify(describeDelivery(config));
  const submission = JSON.stringify(
    submissionLog({ outcome: "sent", provider: "resend", id: "abc123", ipHash: hashIp("203.0.113.9"), ipSource: "cf-connecting-ip", durationMs: 42 }),
  );
  const failure = JSON.stringify({
    ...submissionLog({ outcome: "failed", provider: "resend", status: 422, code: "validation_error" }),
    error: "Resend refused the message (HTTP 422): The domain is not verified",
  });

  for (const [label, line] of [["startup", startup], ["submission", submission], ["failure", failure]]) {
    assert.equal(line.includes(SECRET), false, `${label} line contains the API key`);
    assert.equal(/Dana|dana@whitfieldfeed|903-555-0134|reboots every morning/.test(line), false, `${label} line contains visitor data`);
  }
  assert.ok(!("apiKey" in JSON.parse(startup)), "the startup line must not carry the config object");
});

/* ---- the message --------------------------------------------------------- */

test("the email carries name, address and message intact, with Reply-To set by the caller", () => {
  const body = validBody();
  const { values } = validateMessage(body);
  const { subject, text } = composeMessage(values);
  assert.match(subject, /Dana Whitfield/);
  assert.match(subject, /Whitfield Feed & Supply/);
  assert.ok(text.includes(body.message), "the message body was altered");
  assert.ok(text.includes(body.email));
  assert.ok(text.includes(body.phone));
  assert.ok(!/[\r\n]/.test(subject), "a subject may not contain a line break");
});

test("a name that tries to inject a header is flattened in the subject, and kept intact in the body", () => {
  const typed = "Dana\r\nBcc: victim@example.com";
  const { values } = validateMessage({ ...validBody(), name: typed });
  const { subject, text } = composeMessage(values);
  assert.equal(/[\r\n]/.test(subject), false, "a subject may not contain a line break");
  assert.ok(subject.includes("Dana Bcc: victim@example.com"));
  // The body keeps what the visitor typed: the message is what Jerry has to read.
  assert.ok(text.includes(typed), "the body must not silently rewrite the visitor's text");
});

/* ---- delivery ------------------------------------------------------------ */

test("resend gets the message, the key in a header only, and the sender as reply_to", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ id: "resend-msg-1" }) };
  };
  const config = resolveConfig({
    CONTACT_PROVIDER: "resend",
    CONTACT_API_KEY: SECRET,
    CONTACT_FROM: "Flash Tech website <site@flashtech.biz>",
  });
  const { values } = validateMessage(validBody());
  const sent = await sendContactMessage(values, config, { fetchImpl });

  assert.equal(sent.provider, "resend");
  assert.equal(sent.id, "resend-msg-1");
  const [{ url, init }] = calls;
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.headers.authorization, `Bearer ${SECRET}`);
  const payload = JSON.parse(init.body);
  assert.deepEqual(payload.to, ["support@flashtech.biz"]);
  assert.equal(payload.reply_to, validBody().email);
  assert.ok(payload.text.includes(validBody().message));
  assert.equal(init.body.includes(SECRET), false, "the key must not appear in the request body");
});

test("postmark gets the message with its own header, stream and ReplyTo", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => ({ MessageID: "pm-1", ErrorCode: 0 }) };
  };
  const config = resolveConfig({
    CONTACT_PROVIDER: "postmark",
    CONTACT_API_KEY: SECRET,
    CONTACT_FROM: "site@flashtech.biz",
  });
  const { values } = validateMessage(validBody());
  const sent = await sendContactMessage(values, config, { fetchImpl });

  assert.equal(sent.id, "pm-1");
  assert.equal(captured.url, "https://api.postmarkapp.com/email");
  assert.equal(captured.init.headers["x-postmark-server-token"], SECRET);
  const payload = JSON.parse(captured.init.body);
  assert.equal(payload.To, "support@flashtech.biz");
  assert.equal(payload.ReplyTo, validBody().email);
  assert.equal(payload.MessageStream, "outbound");
  assert.equal(payload.From, "site@flashtech.biz");
});

test("smtp hands the message to the transport with the same shape", async () => {
  let message;
  const transport = { sendMail: async (mail) => { message = mail; return { messageId: "<smtp-1@flashtech.biz>" }; } };
  const config = resolveConfig({
    CONTACT_PROVIDER: "smtp",
    CONTACT_FROM: "site@flashtech.biz",
    CONTACT_SMTP_HOST: "127.0.0.1",
    CONTACT_SMTP_PORT: "1025",
  });
  const { values } = validateMessage(validBody());
  const sent = await sendContactMessage(values, config, { transport });

  assert.equal(sent.provider, "smtp");
  assert.equal(sent.id, "<smtp-1@flashtech.biz>");
  assert.equal(message.to, "support@flashtech.biz");
  assert.equal(message.replyTo, validBody().email);
  assert.ok(message.text.includes(validBody().message));
});

test("a provider refusal throws — it can never be mistaken for a delivery", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ name: "validation_error", message: "The flashtech.biz domain is not verified" }),
  });
  const config = resolveConfig({
    CONTACT_PROVIDER: "resend",
    CONTACT_API_KEY: SECRET,
    CONTACT_FROM: "site@flashtech.biz",
  });
  const { values } = validateMessage(validBody());

  await assert.rejects(
    () => sendContactMessage(values, config, { fetchImpl }),
    (error) => {
      assert.equal(error.name, "ContactSendError");
      assert.equal(error.status, 422);
      assert.match(error.message, /not verified/);
      assert.equal(error.message.includes(SECRET), false);
      assert.equal(error.message.includes(validBody().message), false);
      return true;
    },
  );
});

test("a network failure throws too, rather than returning an empty success", async () => {
  const fetchImpl = async () => { throw new Error("getaddrinfo ENOTFOUND api.resend.com"); };
  const config = resolveConfig({
    CONTACT_PROVIDER: "resend",
    CONTACT_API_KEY: SECRET,
    CONTACT_FROM: "site@flashtech.biz",
  });
  const { values } = validateMessage(validBody());
  await assert.rejects(() => sendContactMessage(values, config, { fetchImpl }), /could not be reached/);
});

test("an unconfigured build refuses to send at all", async () => {
  const config = resolveConfig({});
  const { values } = validateMessage(validBody());
  await assert.rejects(
    () => sendContactMessage(values, config, { fetchImpl: async () => { throw new Error("must not be called"); } }),
    /not configured/,
  );
});

/* ---- rate limiting ------------------------------------------------------- */

test("per-client limit allows the window's worth and then refuses with a retry", () => {
  let now = 1_000_000;
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });

  for (let i = 0; i < 3; i += 1) assert.equal(limiter.check("203.0.113.9").allowed, true);
  const refused = limiter.check("203.0.113.9");
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSec > 0 && refused.retryAfterSec <= 60);

  // A different client is unaffected: five people in town are not one person.
  assert.equal(limiter.check("198.51.100.4").allowed, true);

  // One window later the same client is welcome again.
  now += 60_001;
  assert.equal(limiter.check("203.0.113.9").allowed, true);
});

test("the limiter cannot be grown without limit by a flood of distinct clients", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 10 });
  for (let i = 0; i < 100; i += 1) limiter.check(`client-${i}`);
  assert.ok(limiter.size() <= 10, `map grew to ${limiter.size()}`);
});

/* ---- the client's address ------------------------------------------------ */

test("Cloudflare's header wins, X-Forwarded-For is the fallback, and 'none' is visible", () => {
  const headers = (map) => ({
    get: (name) => {
      const key = Object.keys(map).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
      return key ? map[key] : null;
    },
  });
  assert.deepEqual(clientIp(headers({ "CF-Connecting-IP": "203.0.113.9", "X-Forwarded-For": "10.0.0.1" })), {
    ip: "203.0.113.9",
    source: "cf-connecting-ip",
  });
  assert.deepEqual(clientIp(headers({ "X-Forwarded-For": "198.51.100.4, 10.0.0.1" })), {
    ip: "198.51.100.4",
    source: "x-forwarded-for",
  });
  // Logged, because a bucket of "unknown" would rate-limit every visitor as one client.
  assert.deepEqual(clientIp(headers({})), { ip: "", source: "none" });
});

test("the IP is only ever logged as a hash", () => {
  const hash = hashIp("203.0.113.9");
  assert.match(hash, /^[0-9a-f]{12}$/);
  assert.equal(hash.includes("203.0.113.9"), false);
  assert.notEqual(hash, hashIp("198.51.100.4"));
  assert.equal(hashIp("203.0.113.9"), hash, "the same client must bucket the same way");
  assert.equal(hashIp(""), hashIp(""));
});

test("the phone number and message never appear in a submission log line", () => {
  const line = JSON.stringify(submissionLog({ outcome: "sent", provider: "postmark", id: "pm-1", ipHash: hashIp("203.0.113.9") }));
  assert.equal(/903|whitfield|reboots/i.test(line), false);
  assert.equal(JSON.parse(line).outcome, "sent");
});
