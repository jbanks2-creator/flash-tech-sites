"use client";

import { useState } from "react";
import s from "./authors.module.css";

const LABELS = { name: "Your name", email: "Email", title: "Book title", status: "Where is the book now?", type: "Fiction or nonfiction?" };

export default function ApplyForm() {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.website) return; // honeypot: silently ignore bots

    const missing = Object.keys(LABELS).filter((k) => !String(data[k] || "").trim());
    if (missing.length) {
      setState("error");
      setMessage("Please fill in: " + missing.map((k) => LABELS[k]).join(", ") + ".");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email).trim())) {
      setState("error");
      setMessage("That email address looks incomplete. Check it and try again.");
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/authors-apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong on our side. Please try again in a few minutes.");
      setState("done");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  if (state === "done") {
    return (
      <p className={s.done} role="status">
        Thank you. Your application arrived, and we&rsquo;ll reply by email within two business days.
      </p>
    );
  }

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      <div className={s.field}><label htmlFor="ac-name">Your name</label><input id="ac-name" name="name" autoComplete="name" required /></div>
      <div className={s.field}><label htmlFor="ac-email">Email</label><input id="ac-email" name="email" type="email" autoComplete="email" required /></div>
      <div className={s.field}><label htmlFor="ac-title">Book title</label><input id="ac-title" name="title" required /></div>
      <div className={s.field}>
        <label htmlFor="ac-status">Where is the book now?</label>
        <select id="ac-status" name="status" required defaultValue="">
          <option value="">Choose one</option>
          <option>Published</option>
          <option>Launching in the next 3 months</option>
          <option>Launching later</option>
          <option>Still writing</option>
        </select>
      </div>
      <div className={s.field}>
        <label htmlFor="ac-type">Fiction or nonfiction?</label>
        <select id="ac-type" name="type" required defaultValue="">
          <option value="">Choose one</option>
          <option>Fiction</option>
          <option>Nonfiction</option>
        </select>
      </div>
      <div className={s.field}><label htmlFor="ac-link">Link to your book or website <span className={s.opt}>(optional)</span></label><input id="ac-link" name="link" type="url" placeholder="https://" /></div>
      <div className={s.trap} aria-hidden="true"><label htmlFor="ac-website">Leave this empty</label><input id="ac-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className={`${s.field} ${s.full}`}><label htmlFor="ac-msg">Anything else we should know? <span className={s.opt}>(optional)</span></label><textarea id="ac-msg" name="message" /></div>
      <div className={s.formfoot}>
        <button className={s.btn} type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send application"}</button>
        <p>We&rsquo;ll only use your details to reply about your kit. No mailing lists unless you ask.</p>
      </div>
      {state === "error" && <div className={s.notice} role="alert">{message}</div>}
    </form>
  );
}
