/**
 * The contact form's field contract — the part both the browser and the server need.
 *
 * Kept free of `node:` imports so `app/ContactForm.jsx` (a client component) can import it and
 * read the exact caps the route enforces, instead of restating them and drifting. The rest of
 * the delivery logic lives in `lib/contact-mail.mjs`, which is server-only.
 *
 * The honeypot name follows the rule the authors-intake trap established on 2026-11-12: an `hp_`
 * name that is not, and cannot be confused with, a real field of what is being submitted. The
 * trap there was once called `website` — also a real section of the intake record — so every
 * genuine submission tripped it and was silently discarded with `{ok:true}`. Here the check is
 * the exported assertion below plus the unit tests in `lib/contact-mail.test.mjs`.
 */

/** The trap field. A bot fills every input it finds; a person never sees this one. */
export const HONEYPOT = 'hp_website';

/** The fields a submission may carry, with their caps. Anything else in the body is ignored. */
export const LIMITS = Object.freeze({
  name: 200,
  business: 200,
  email: 320,
  phone: 40,
  message: 5000,
});

export const FIELDS = Object.freeze(Object.keys(LIMITS));

/** A single submission cannot exceed this. Bigger than any real enquiry, small enough to refuse. */
export const MAX_BODY_BYTES = 16 * 1024;

/**
 * Where a delivered message goes: the role inbox in `registry.yaml`, which forwards to Jerry's
 * Gmail (live since 2026-11-11). This is the card's acceptance target.
 */
export const DEFAULT_TO = 'support@flashtech.biz';

/**
 * What a visitor is told to email when the form cannot send.
 *
 * Deliberately the address the site already publishes in its own copy — `TheWiz@FlashTech.Biz`,
 * on `/`, `/contact` and the offer page — because a page that says "write to TheWiz@" and then
 * offers a button saying "email support@" reads like a bug. Both addresses are live Cloudflare
 * Email Routing routes forwarding to the same Gmail (registry line for flashtech.biz), so either
 * reaches Jerry. Override with CONTACT_FALLBACK_EMAIL to unify them.
 */
export const DEFAULT_FALLBACK = 'TheWiz@FlashTech.Biz';

/** Field names as the visitor sees them, so a refusal can name the box on the page. */
export const labels = Object.freeze({
  name: 'Your name',
  business: 'Business',
  email: 'Email',
  phone: 'Phone',
  message: "What's giving you trouble",
});

/** The class of bug this file exists to prevent, stated as a value the tests can read. */
export const TRAP_IS_NOT_A_FIELD = !FIELDS.includes(HONEYPOT);
