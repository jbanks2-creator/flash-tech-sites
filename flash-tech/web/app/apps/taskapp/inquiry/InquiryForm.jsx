"use client";

import { useState } from "react";

export default function InquiryForm() {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.website) return;                       // honeypot: silently ignore bots
    setState("sending");
    try {
      const res = await fetch("/api/taskapp-inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      setState("done");
      setMessage("Thanks — your request is in. We reply by the next business day.");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  if (state === "done") {
    return <p role="status" style={{ padding: "18px 0", fontWeight: 600 }}>{message}</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" required autoComplete="name" />
      <label htmlFor="business">Business</label>
      <input id="business" name="business" autoComplete="organization" />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" />
      <label htmlFor="want">What should be loaded before the call?</label>
      <textarea id="want" name="want" placeholder="Your clients, the projects you track, the jobs you keep losing track of." />
      <label htmlFor="when">Best time for a 30-minute call</label>
      <input id="when" name="when" placeholder="e.g. Tuesday morning, or any weekday after 3pm" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", height: 0 }} />
      <button className="btn primary" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request the configured version"}
      </button>
      {state === "error" && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{message}</p>}
      <p style={{ fontSize: ".82rem", color: "var(--muted)", margin: 0 }}>
        This form asks for what we need to quote and prepare the call. We do not add you to a list.
      </p>
    </form>
  );
}
