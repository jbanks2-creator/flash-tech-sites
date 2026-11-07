'use client';
import { useState } from 'react';

export default function ContactForm() {
  const [state, setState] = useState('idle');

  async function onSubmit(e) {
    e.preventDefault();
    setState('sending');
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return <p className="note" style={{ fontSize: '.95rem', color: '#0b1220' }}>Thanks — that came through. Jerry will get back to you within one business day.</p>;
  }

  return (
    <form className="contact" onSubmit={onSubmit}>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" required autoComplete="name" />

      <label htmlFor="business">Business</label>
      <input id="business" name="business" autoComplete="organization" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />

      <label htmlFor="phone">Phone</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" />

      <label htmlFor="message">What&rsquo;s giving you trouble?</label>
      <textarea id="message" name="message" placeholder="Slow PCs, an aging server, phones nobody can hear on, or the AI thing everyone keeps mentioning." />

      <button className="btn primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Book a free IT check-up'}
      </button>
      {state === 'error' && <p className="note" style={{ color: '#b91c1c' }}>That didn&rsquo;t go through. Call or email instead and we&rsquo;ll sort it.</p>}
      <p className="note">No obligation, no sales script. Usually 20 minutes, on the phone or on site.</p>
    </form>
  );
}
