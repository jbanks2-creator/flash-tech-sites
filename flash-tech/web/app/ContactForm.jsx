'use client';
import { useEffect, useState } from 'react';

import { DEFAULT_FALLBACK, HONEYPOT, LIMITS } from '../lib/contact-fields.mjs';

/**
 * The site's only call to action, on /, /contact and /hermes-department.
 *
 * It used to render a form that always "worked": POST /api/contact answered `{ok:true}` and sent
 * nothing (until 2026-11-17). So the rule this component now follows is that **what it renders
 * must match what actually happens**:
 *
 *   - The server-rendered HTML — and the state a reader with no JavaScript stays in forever — is
 *     a `mailto:` link. That path works whether or not any mail provider is configured.
 *   - Only after `/api/contact` says `{ready:true}` does the form appear, because only then will a
 *     submission actually be handed to a mail provider.
 *
 * This keeps every page that embeds it statically generated (the build gate in
 * scripts/check-store.mjs --built fails if /, /contact or /startups lose their rendered HTML), so
 * the readiness check is a runtime fetch rather than a server-side env read.
 *
 * The honeypot input is `HONEYPOT` from lib/contact-fields.mjs and is checked by the route before
 * validation — see the note there about the 2026-11-12 intake trap that discarded real
 * submissions because its field name collided with a real one.
 */
export default function ContactForm({ submitLabel = 'Book a free IT check-up' }) {
  // 'checking' is also the server-render state: it renders the mailto block, which is true in
  // every configuration, so there is never a frame that promises a form that cannot send.
  const [mode, setMode] = useState('checking');
  const [email, setEmail] = useState(DEFAULT_FALLBACK);
  const [phase, setPhase] = useState('idle');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let live = true;
    fetch('/api/contact', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!live) return;
        if (typeof data?.email === 'string' && data.email) setEmail(data.email);
        setMode(data?.ready === true ? 'form' : 'fallback');
      })
      .catch(() => {
        if (live) setMode('fallback');
      });
    return () => {
      live = false;
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    if (phase === 'sending') return;
    setPhase('sending');
    setProblem('');

    const form = new FormData(event.currentTarget);
    // Only the fields this endpoint reads, so a stray input can never inflate the body.
    const payload = {};
    for (const field of Object.keys(LIMITS)) payload[field] = String(form.get(field) ?? '');
    payload[HONEYPOT] = String(form.get(HONEYPOT) ?? '');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true) {
        setPhase('sent');
        return;
      }
      // The server's sentence, not a generic one: when delivery is down it names the address to
      // write to, and that sentence is the whole point of this rewrite.
      setProblem(
        data?.error ||
          `That did not go through. Please email ${email} instead — the address is checked by a person.`,
      );
      setPhase('error');
    } catch {
      setProblem(`That did not go through. Please email ${email} instead — the address is checked by a person.`);
      setPhase('error');
    }
  }

  if (phase === 'sent') {
    return (
      <p className="note" style={{ fontSize: '.95rem', color: '#0b1220' }}>
        Thanks — your message is on its way to Jerry, and he will get back to you within one business
        day.
      </p>
    );
  }

  if (mode !== 'form') {
    return (
      <div className="contact">
        <p style={{ margin: '0 0 10px' }}>
          <a className="btn primary" href={mailtoHref(email, 'Free IT check-up')}>
            Email {email}
          </a>
        </p>
        <p className="note">
          Opens your email app with the address filled in. Tell us what is giving you trouble and the
          best number to reach you — Jerry replies within one business day.
        </p>
      </div>
    );
  }

  return (
    <form className="contact" onSubmit={onSubmit}>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" required maxLength={LIMITS.name} autoComplete="name" />

      <label htmlFor="business">Business</label>
      <input id="business" name="business" maxLength={LIMITS.business} autoComplete="organization" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required maxLength={LIMITS.email} autoComplete="email" />

      <label htmlFor="phone">Phone</label>
      <input id="phone" name="phone" type="tel" maxLength={LIMITS.phone} autoComplete="tel" />

      <label htmlFor="message">What&rsquo;s giving you trouble?</label>
      <textarea
        id="message"
        name="message"
        maxLength={LIMITS.message}
        placeholder="Slow PCs, an aging server, phones nobody can hear on, or the AI thing everyone keeps mentioning."
      />

      {/* The trap. Off-screen rather than display:none — a bot that skips hidden inputs is rarer
          than a screen reader that announces one, so it is also aria-hidden and not focusable. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor={HONEYPOT}>Leave this empty</label>
        <input id={HONEYPOT} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn primary" type="submit" disabled={phase === 'sending'}>
        {phase === 'sending' ? 'Sending…' : submitLabel}
      </button>

      {phase === 'error' && (
        <p className="note" style={{ color: '#b91c1c' }}>
          {problem}{' '}
          <a href={mailtoHref(email, 'Free IT check-up')}>Email {email}</a>
        </p>
      )}

      <p className="note">No obligation, no sales script. Usually 20 minutes, on the phone or on site.</p>
    </form>
  );
}

/** `mailto:` with a subject, so the visitor's draft starts with something useful. */
function mailtoHref(address, subject) {
  return `mailto:${address}?subject=${encodeURIComponent(`Flash Tech — ${subject}`)}`;
}
