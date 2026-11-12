"use client";

import { useEffect, useRef, useState } from "react";
import s from "../authors.module.css";
import t from "./intake.module.css";
import {
  HONEYPOT,
  LONG,
  SHORT,
  PLATFORMS,
  SOCIAL_PLATFORMS,
  MIN_SAMPLE_WORDS,
  MIN_TOTAL_WORDS,
  wordCount,
} from "@/lib/intake-fields.mjs";

/**
 * The Starter Kit questionnaire, all nine sections on one page.
 *
 * Inputs are uncontrolled on purpose: the form is long, and the things that react to typing — word
 * counts, the progress meter, section ticks — are written straight into the DOM through refs, so a
 * keystroke never re-renders 90 inputs. Only three things use React state: the fiction/nonfiction
 * switch, the website yes/no switch, and the three confirmations (which decide whether the button
 * is enabled).
 *
 * Nothing the author typed is ever cleared on failure: on a refusal the form stays exactly as it
 * was, the named fields are marked, and the first one is focused.
 */

const PRIMARY_GOAL_LABELS = [
  ["sales", "Sales"],
  ["reviews", "Reviews"],
  ["list growth", "Growing your email list"],
  ["podcast guesting", "Podcast guesting"],
  ["speaking", "Speaking"],
  ["clients", "Clients"],
];

const BUDGET_LABELS = [
  ["$0", "$0"],
  ["under $100/mo", "under $100 a month"],
  ["$100-500/mo", "$100–500 a month"],
  ["$500-2,000/mo", "$500–2,000 a month"],
  ["over $2,000/mo", "over $2,000 a month"],
];

const STATUS_LABELS = [
  ["drafting", "Drafting"],
  ["pre-launch", "Pre-launch"],
  ["published", "Published"],
];

/** Required answers per section, for the progress meter only. checkAnswers() is the authority. */
const SECTIONS = [
  { id: "about-you", n: "1", title: "About you", fields: ["legal_name", "public_name", "email", "country_timezone", "pronouns"] },
  { id: "about-author", n: "2", title: "About you as an author", fields: ["genre_or_field", "one_sentence_identity", "cred1", "current_bio"] },
  { id: "writing-samples", n: "3", title: "Writing samples in your own voice", samples: true },
  { id: "your-book", n: "4", title: "Your book", book: true },
  { id: "your-readers", n: "5", title: "Your readers", fields: ["ideal_reader", "problem_or_desire", "where_spend_time"] },
  { id: "website", n: "6", title: "Website", website: true },
  { id: "social", n: "7", title: "Social media", social: true },
  { id: "goals", n: "8", title: "Goals and podcast topics", fields: ["primary_goal", "hours_per_week", "budget_band", "talking1", "talking2", "talking3", "cta_action", "cta_link"] },
  { id: "confirmations", n: "9", title: "Confirmations", consent: true },
];

const has = (values, name) => String(values[name] ?? "").trim().length > 0;
const sampleRows = (values) => [1, 2, 3]
  .map((i) => ({ title: String(values[`sample${i}_title`] ?? ""), text: String(values[`sample${i}_text`] ?? "") }))
  .filter((row) => row.title.trim() || row.text.trim());

/** How many required answers are still missing in one section, and how many it has in total. */
function sectionProgress(section, values) {
  if (section.samples) {
    const rows = sampleRows(values);
    const words = rows.reduce((sum, row) => sum + wordCount(row.text), 0);
    const checks = [
      rows.length >= 2,
      rows.every((row) => row.title.trim() && wordCount(row.text) >= MIN_SAMPLE_WORDS),
      words >= MIN_TOTAL_WORDS,
    ];
    return { total: 3, missing: checks.filter((ok) => !ok).length };
  }
  if (section.book) {
    const checks = [
      has(values, "book_title"),
      has(values, "book_subtitle"),
      has(values, "book_type"),
      has(values, "genre_category"),
      has(values, "book_status"),
      has(values, "publication_date"),
      has(values, "premise"),
      ["theme1", "theme2", "theme3"].every((k) => has(values, k)),
      has(values, "platform_kdp") || has(values, "platform_ingram") || has(values, "platform_d2d") || has(values, "platform_other"),
      has(values, "distribution"),
      values.book_type === "fiction" ? has(values, "plot_summary") : has(values, "nonfiction_summary"),
    ];
    return { total: checks.length, missing: checks.filter((ok) => !ok).length };
  }
  if (section.website) return { total: 1, missing: has(values, "has_website") ? 0 : 1 };
  if (section.social) {
    const anyHandle = [1, 2, 3].some((i) => has(values, `social${i}_handle`));
    return { total: 1, missing: anyHandle ? 0 : 1 };
  }
  if (section.consent) {
    return { total: 3, missing: ["consent_facts", "consent_ai", "consent_images"].filter((k) => !has(values, k)).length };
  }
  return { total: section.fields.length, missing: section.fields.filter((f) => !has(values, f)).length };
}

/* --- field components ------------------------------------------------------------------------ */

function Mark({ required }) {
  return required ? <span className={t.req}>Required</span> : <span className={t.opt}>Optional</span>;
}

function Field({ id, label, hint, required = false, wide = false, children }) {
  return (
    <div className={`${t.field}${wide ? ` ${t.wide}` : ""}`}>
      <label htmlFor={id}>
        {label} <Mark required={required} />
      </label>
      {hint ? <p className={t.hint} id={`${id}-hint`}>{hint}</p> : null}
      {children}
    </div>
  );
}

function Text({ id, label, hint, required = false, wide = false, maxLength = SHORT, ...rest }) {
  return (
    <Field id={id} label={label} hint={hint} required={required} wide={wide}>
      <input
        id={id}
        name={id}
        maxLength={maxLength}
        required={required}
        aria-required={required || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

function Area({ id, label, hint, required = false, wide = true, rows = 4, maxLength = LONG, ...rest }) {
  return (
    <Field id={id} label={label} hint={hint} required={required} wide={wide}>
      <textarea
        id={id}
        name={id}
        rows={rows}
        maxLength={maxLength}
        required={required}
        aria-required={required || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

function Select({ id, label, hint, required = false, wide = false, options, ...rest }) {
  return (
    <Field id={id} label={label} hint={hint} required={required} wide={wide}>
      <select
        id={id}
        name={id}
        required={required}
        aria-required={required || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        defaultValue=""
        {...rest}
      >
        <option value="">Choose one</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </Field>
  );
}

/** Independent tick boxes (one input name each), e.g. where the book is published. */
function TickList({ legend, hint, required = false, options, wide = true }) {
  return (
    <fieldset className={`${t.field} ${t.optionSet}${wide ? ` ${t.wide}` : ""}`}>
      <legend>{legend} <Mark required={required} /></legend>
      {hint ? <p className={t.hint}>{hint}</p> : null}
      <div className={t.optionList}>
        {options.map(([name, label], i) => (
          <label key={name} className={t.option}>
            <input type="checkbox" name={name} value="on" required={required && i === 0} aria-required={(required && i === 0) || undefined} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** One name, many values: radio buttons or a checkbox group. */
function ChoiceGroup({ name, legend, hint, required = false, type = "radio", options, wide = true, onChange }) {
  return (
    <fieldset className={`${t.field} ${t.optionSet}${wide ? ` ${t.wide}` : ""}`}>
      <legend>{legend} <Mark required={required} /></legend>
      {hint ? <p className={t.hint}>{hint}</p> : null}
      <div className={t.optionList}>
        {options.map(([value, label], i) => (
          <label key={value} className={t.option}>
            <input
              type={type}
              name={name}
              value={value}
              onChange={onChange}
              required={required && i === 0}
              aria-required={(required && i === 0) || undefined}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ section, register, children }) {
  return (
    <section className={t.section} id={section.id} data-section={section.id} ref={register}>
      <div className={t.sectionInner}>
        <div className={t.sectionHead}>
          <span className={t.num}>{section.n}</span>
          <h2>{section.title}</h2>
          <span className={t.badge} data-badge />
        </div>
        <div className={t.grid}>{children}</div>
      </div>
    </section>
  );
}

/* --- the form -------------------------------------------------------------------------------- */

export default function IntakeForm() {
  const formRef = useRef(null);
  const meterRef = useRef(null);
  const barRef = useRef(null);
  const errorRef = useRef(null);
  const sectionRefs = useRef({});
  const sampleCountRefs = useRef({});
  const totalCountRef = useRef(null);

  const [bookType, setBookType] = useState("");
  const [hasSite, setHasSite] = useState("");
  const [consent, setConsent] = useState([false, false, false]);
  const [status, setStatus] = useState("idle");
  const [errors, setErrors] = useState([]);
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState(null);
  const [copy, setCopy] = useState("");
  const [copied, setCopied] = useState("");

  const consentOk = consent.every(Boolean);

  const readValues = () => {
    const values = {};
    if (!formRef.current) return values;
    for (const [key, value] of new FormData(formRef.current).entries()) {
      if (typeof value === "string") values[key] = value;
    }
    return values;
  };

  /** Word counts, section ticks and the meter — all written to the DOM, no React re-render. */
  const refresh = () => {
    const values = readValues();

    for (const i of [1, 2, 3]) {
      const count = wordCount(values[`sample${i}_text`] || "");
      const node = sampleCountRefs.current[i];
      if (node) {
        node.textContent = `${count} word${count === 1 ? "" : "s"}`;
        node.dataset.short = count > 0 && count < MIN_SAMPLE_WORDS ? "yes" : "no";
      }
    }
    const total = [1, 2, 3].reduce((sum, i) => sum + wordCount(values[`sample${i}_text`] || ""), 0);
    if (totalCountRef.current) {
      totalCountRef.current.textContent = `${total} of ${MIN_TOTAL_WORDS} words`;
      totalCountRef.current.dataset.short = total > 0 && total < MIN_TOTAL_WORDS ? "yes" : "no";
    }

    let missing = 0;
    let all = 0;
    for (const section of SECTIONS) {
      const { total: count, missing: left } = sectionProgress(section, values);
      all += count;
      missing += left;
      const node = sectionRefs.current[section.id];
      if (node) {
        node.dataset.state = left === 0 ? "done" : "todo";
        const badge = node.querySelector("[data-badge]");
        if (badge) badge.textContent = left === 0 ? "Complete" : `${left} left`;
      }
    }
    const done = all - missing;
    if (meterRef.current) meterRef.current.textContent = `${done} of ${all} required answers in`;
    if (barRef.current) barRef.current.style.width = `${Math.round((done / all) * 100)}%`;
  };

  useEffect(() => {
    refresh();
  }, []);

  /** A plain-text copy of everything the author typed, for the clipboard on the confirmation. */
  const collectSummary = () => {
    const form = formRef.current;
    if (!form) return "";
    const out = [];
    for (const section of SECTIONS) {
      const node = sectionRefs.current[section.id];
      if (!node) continue;
      const rows = [];
      for (const el of node.querySelectorAll("input, select, textarea")) {
        if (!el.name || el.name === HONEYPOT || el.type === "submit") continue;
        if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
        const value = el.value.trim();
        if (!value) continue;
        let label = "";
        const own = el.closest("label");
        const explicit = el.id ? node.querySelector(`label[for="${el.id}"]`) : null;
        if (explicit) label = explicit.textContent.replace(/\s*(Required|Optional)\s*$/, "").trim();
        else if (own) label = own.textContent.trim();
        rows.push(`${label || el.name}: ${el.type === "checkbox" ? "yes" : value}`);
      }
      if (rows.length) out.push(`== ${section.n}. ${section.title} ==`, ...rows, "");
    }
    return out.join("\n").trim();
  };

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("sending");
    setErrors([]);
    setFailure("");
    const values = readValues();
    setCopy(collectSummary());

    try {
      const response = await fetch("/api/authors-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setErrors(Array.isArray(body.errors) ? body.errors : []);
        setFailure(body.error || "Something went wrong on our side. Your answers are still here; please try again.");
        setStatus("error");
        return;
      }
      setSuccess(body);
      setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFailure("We couldn't reach the server. Your answers are still here — check your connection and try again, or email support@flashtech.biz.");
      setStatus("error");
    }
  }

  // Mark and focus the first field the server named.
  useEffect(() => {
    if (status !== "error" || !errors.length || !formRef.current) return;
    for (const el of formRef.current.querySelectorAll("[name]")) el.removeAttribute("aria-invalid");
    const names = new Set(errors.map((e) => e.field));
    let first = null;
    for (const el of formRef.current.querySelectorAll("[name]")) {
      if (names.has(el.name)) {
        el.setAttribute("aria-invalid", "true");
        if (!first) first = el;
      }
    }
    if (errorRef.current) errorRef.current.focus({ preventScroll: true });
    if (first) {
      first.focus({ preventScroll: true });
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [status, errors]);

  const register = (id) => (node) => { sectionRefs.current[id] = node; };

  if (status === "done" && success) {
    return (
      <section className={t.done} id="done" aria-live="polite">
        <div className={s.wrap}>
          <p className={s.label}>Received {success.submitted_date}</p>
          <h2 className={t.doneHead}>Your questionnaire is in.</h2>
          <p className={t.doneLede}>
            Nothing has been sent to anyone else, and nothing will be posted or pitched automatically.
            Jerry reads every answer first, drafts your kit from them, and emails you the finished files.
          </p>
          <dl className={t.doneMeta}>
            <div><dt>Your reference</dt><dd>{success.job_id}</dd></div>
            <div><dt>What we do with it</dt><dd>Read it, draft the kit, review it, email you the files</dd></div>
          </dl>
          <div className={t.copyBlock}>
            <div className={t.copyHead}>
              <h3>Keep your own copy</h3>
              <p>Your answers, as you sent them. Copy them into an email or a document.</p>
            </div>
            <textarea className={t.copyText} readOnly rows={10} value={copy} onFocus={(e) => e.currentTarget.select()} />
            <div className={t.copyActions}>
              <button
                type="button"
                className={s.btn}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copy);
                    setCopied("Copied to your clipboard.");
                  } catch {
                    setCopied("Select all in the box above and copy it.");
                  }
                }}
              >
                Copy my answers
              </button>
              <span className={t.copyNote} role="status">{copied}</span>
            </div>
          </div>
          <p className={t.doneFoot}>
            If you&rsquo;d rather send a file than paste, email it to{" "}
            <a href="mailto:support@flashtech.biz">support@flashtech.biz</a> and mention your reference.
            Back to <a href="/startups/authors">The Author&rsquo;s Candle</a>.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className={t.meter} role="group" aria-label="Progress through the questionnaire">
        <div className={s.wrap}>
          <div className={t.meterTop}>
            <span className={t.meterText} ref={meterRef}>0 of 0 required answers in</span>
            <span className={t.meterHint}>Takes about 30 minutes</span>
          </div>
          <div className={t.bar} aria-hidden="true"><span className={t.barFill} ref={barRef} /></div>
          <nav className={t.jump} aria-label="Jump to a section">
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`}><span>{section.n}</span>{section.title}</a>
            ))}
          </nav>
        </div>
      </div>

      <form
        className={t.form}
        ref={formRef}
        onSubmit={onSubmit}
        onInput={refresh}
        onChange={refresh}
        noValidate
      >
        {/* `required` stays on the controls for assistive tech, but `noValidate` stops the browser
            interrupting with one bubble at a time: the server answers with every missing answer
            named at once, and nothing the author typed is ever cleared. */}
        <div className={t.trap} aria-hidden="true">
          <label htmlFor={HONEYPOT}>Leave this field empty</label>
          <input id={HONEYPOT} name={HONEYPOT} tabIndex={-1} autoComplete="off" />
        </div>

        {status === "error" && (
          <div className={t.errors} role="alert" tabIndex={-1} ref={errorRef}>
            <h2>Not sent yet — {errors.length ? `${errors.length} ${errors.length === 1 ? "answer needs" : "answers need"} a look` : "something went wrong"}</h2>
            <p>{failure}</p>
            {errors.length ? (
              <ul>
                {errors.map((error, i) => (
                  <li key={`${error.label}-${i}`}><strong>{error.label}</strong> {error.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <Section section={SECTIONS[0]} register={register("about-you")}>
          <Text id="legal_name" label="Legal name" required autoComplete="name" />
          <Text
            id="public_name"
            label="Name exactly as it should appear on your book and marketing"
            hint="Pen name if you use one. We'll copy this letter for letter."
            required
          />
          <Text id="email" label="Email" hint="Where we send your finished kit." type="email" inputMode="email" autoComplete="email" required />
          <Text id="country_timezone" label="Country and time zone" placeholder="United States, Central (CST)" required />
          <Text id="pronouns" label="Pronouns for bios written about you" hint="he / she / they / other." required />
          <Text id="location_publishable" label="City or region you're happy for us to mention" hint="Leave blank and we won't mention where you live." />
          <Text id="phone" label="Phone" type="tel" autoComplete="tel" />
          <Text id="assistant_contact" label="Assistant or publicist contact" />
        </Section>

        <Section section={SECTIONS[1]} register={register("about-author")}>
          <Text id="genre_or_field" label="Your genre or field" required />
          <Area
            id="one_sentence_identity"
            label="Who you are, in one sentence"
            hint="Example: “A father of three and former youth counselor who writes family dramas about second chances.”"
            rows={3}
            required
          />
          <Text
            id="cred1"
            label="Credential or life experience 1"
            hint="Jobs, training, ministry, military service, lived experience: anything true that makes you the right person to write this book."
            required
          />
          <Text id="cred2" label="Credential or life experience 2" />
          <Text id="cred3" label="Credential or life experience 3" />
          <Area
            id="current_bio"
            label="Your current author bio, if you have one"
            hint="Paste it in, any length. Write “none” if you don't have one."
            rows={4}
            required
          />
          <Area
            id="origin_story"
            label="How you got here: your story as a writer"
            hint="Why you started writing, what pushed you to finish this book. This feeds your 500-word bio."
            rows={4}
          />
          <Area
            id="awards_media"
            label="Awards, media features, interviews"
            hint="One per line. Include the year and a link for each if you have one."
            rows={3}
          />
          <Text id="education" label="Education" />
          <Area
            id="personal_details_publishable"
            label="Personal details you're happy to publish"
            hint="Family, faith, hobbies, hometown, anything readers might connect with."
            rows={3}
          />
          <Area
            id="do_not_mention"
            label="Anything we must NOT mention"
            hint="One per line: topics, people, past jobs, anything off-limits."
            rows={3}
          />
          <Area id="other_titles" label="Your other published books" hint="One per line." rows={3} />
          <Area
            id="protected_spellings"
            label="Words we must spell exactly as you do"
            hint="One per line: character names, made-up words, deliberate spellings (for example “Blac” or “Gangsta”). We'll never “correct” these."
            rows={3}
          />
        </Section>

        <Section section={SECTIONS[2]} register={register("writing-samples")}>
          <div className={t.note}>
            <p>
              <strong>Required: two or three samples, about 600 words in total.</strong> This is how we
              make your social posts, first-person bio and podcast pitch sound like you. Good choices:
              blog posts, newsletters, long social posts, an “about me” you wrote, a letter to readers. A
              passage from your book is fine for one of them, but try to include at least one piece where
              you're speaking as yourself, not as a narrator.
            </p>
            <p className={t.hint}>
              We use these only to learn your voice. We won't quote them or take facts from them. Each
              sample needs at least {MIN_SAMPLE_WORDS} words. If you&rsquo;d rather send a file, email it to{" "}
              <a href="mailto:support@flashtech.biz">support@flashtech.biz</a> and paste a note here.
            </p>
            <p className={t.totalCount} ref={totalCountRef}>0 of {MIN_TOTAL_WORDS} words</p>
          </div>
          {[1, 2, 3].map((i) => (
            <div className={t.sample} key={i}>
              <div className={t.sampleHead}>
                <h3>Sample {i}{i === 3 ? " (optional)" : ""}</h3>
                <span className={t.counter} ref={(node) => { sampleCountRefs.current[i] = node; }}>0 words</span>
              </div>
              <Text
                id={`sample${i}_title`}
                label="Title and what it is (blog, newsletter, etc.)"
                required={i < 3}
                wide
              />
              <Area
                id={`sample${i}_text`}
                label="Paste the text here"
                hint={`At least ${MIN_SAMPLE_WORDS} words. Up to about 650 words fits the box.`}
                rows={8}
                required={i < 3}
                maxLength={LONG}
              />
            </div>
          ))}
        </Section>

        <Section section={SECTIONS[3]} register={register("your-book")}>
          {/* TODO(t_7487852d): the cover-video card adds two answers to this section —
              a cover image (retailer URL + permission to use it, "at least 1500 px on the long
              edge, the file the retailer uses for the paperback or Kindle cover") and the
              voice-over line with who approved it. They are NOT rendered yet on purpose: the
              record refuses a field the schema does not know, so a box here would drop the
              author's answer. Add them under lib/intake-fields.mjs's COVER_VO_ENABLED flag once
              ops lands the names in intake/schema.json, and state that a small cover is a
              heads-up for us, not a reason to stop. */}
          <div className={t.note}>
            <p>
              This kit focuses on one book. If you&rsquo;d like a kit for another title, say so under
              &ldquo;your other published books&rdquo; below and we&rsquo;ll talk about the rest.
            </p>
          </div>
          <Text id="book_title" label="Book title" required />
          <Text id="book_subtitle" label="Subtitle" hint="Write “none” if there isn't one." required />
          <Text id="series_name" label="Is it part of a series? Series name" />
          <Text id="series_number" label="Book number in the series" type="number" inputMode="numeric" min="1" />
          <Area id="sequels_confirmed" label="What may we say about future books?" hint="Leave blank and we won't mention sequels." rows={2} maxLength={LONG} />
          <Select
            id="book_type"
            label="Fiction or nonfiction?"
            required
            options={[["fiction", "Fiction"], ["nonfiction", "Nonfiction"]]}
            onChange={(e) => setBookType(e.currentTarget.value)}
          />
          <Text id="genre_category" label="Genre and category" hint="For example: domestic suspense, urban fiction, Christian fiction, family drama." required />
          <Select id="book_status" label="Status: drafting, pre-launch, or published" required options={STATUS_LABELS} />
          <Text id="publication_date" label="Publication or launch date" type="date" required />
          <Area
            id="premise"
            label="The book in one paragraph"
            hint="Fiction: who it's about, what they want, what stands in the way. Nonfiction: what the reader gets."
            rows={4}
            required
          />
          <Text id="theme1" label="Key theme 1" required />
          <Text id="theme2" label="Key theme 2" required />
          <Text id="theme3" label="Key theme 3" required />
          <Text id="theme4" label="Key theme 4" />
          <Text id="theme5" label="Key theme 5" />
          <div className={t.note}>
            <p className={t.hint}>3–5 key themes. The first three are required.</p>
          </div>
          <div className={t.panel} hidden={bookType !== "fiction"}>
            <Area
              id="plot_summary"
              label="Fiction: full plot summary"
              hint="Tell us the whole story, ending included. It stays private. Type [MIDPOINT] where the middle of the story falls — your book descriptions will never reveal anything after that point."
              rows={8}
              required={bookType === "fiction"}
            />
            <Text id="reveal_limit" label="Fiction: anything that must never be revealed, even early in the story" />
          </div>
          <div className={t.panel} hidden={bookType !== "nonfiction"}>
            <Area
              id="nonfiction_summary"
              label="Nonfiction: chapter list or detailed summary"
              hint="Everything your marketing is allowed to promise has to come from here."
              rows={8}
              required={bookType === "nonfiction"}
            />
          </div>
          <Text id="book_tone" label="The tone or feel of the book" hint="For example: gritty, heartbreaking, hopeful, fast-paced." />
          <TickList
            legend="Where it's published"
            required
            options={[["platform_kdp", PLATFORMS[0]], ["platform_ingram", PLATFORMS[1]], ["platform_d2d", PLATFORMS[2]], ["platform_other", "Other"]]}
          />
          <ChoiceGroup
            name="distribution"
            legend="Amazon-exclusive (KDP Select) or sold wide?"
            required
            options={[["exclusive", "Amazon-exclusive (KDP Select)"], ["wide", "Sold wide"]]}
          />
          <Text id="isbn" label="ISBN" />
          <Text id="page_count" label="Page count" type="number" inputMode="numeric" min="1" />
          <Text id="formats" label="Formats (ebook, paperback, hardcover, audio)" />
          <Text id="price" label="Price" />
          <Area id="retailer_links" label="Links to the book on retailers" hint="One link per line." rows={3} />
          <Text id="comparable_titles" label="2–3 books or authors yours is similar to" hint="Separate with commas." />
          <div className={t.reviews}>
            <p className={t.hint}>
              Reviews or endorsements we may quote — copy each one word for word with who said it, and tick
              that you have permission to use it.
            </p>
            {[1, 2].map((i) => (
              <div className={t.reviewRow} key={i}>
                <Area id={`review${i}_quote`} label={`Review ${i}: the quote`} rows={2} maxLength={LONG} />
                <Text id={`review${i}_source`} label={`Review ${i}: who said it`} hint="Name, outlet and year." />
                <label className={t.option}>
                  <input type="checkbox" name={`review${i}_permission`} value="on" />
                  <span>I have permission to quote review {i}.</span>
                </label>
              </div>
            ))}
          </div>
          <Text id="content_warnings" label="Content warnings (violence, abuse, language, etc.)" wide />
        </Section>

        <Section section={SECTIONS[4]} register={register("your-readers")}>
          <Area id="ideal_reader" label="Your ideal reader in one sentence" rows={2} required />
          <Area
            id="problem_or_desire"
            label="What draws them to a book like yours?"
            hint="The feeling, need or question that makes them pick it up."
            rows={3}
            required
          />
          <Text
            id="where_spend_time"
            label="Where do they spend time?"
            hint="Facebook, Instagram, TikTok, church, book clubs, podcasts, Goodreads — separate with commas."
            required
          />
          <Text id="demographics" label="Age range or other details about them" />
          <Area id="authors_shows_followed" label="Authors, shows or podcasts they follow" hint="One per line." rows={3} />
          <Text id="email_list_size" label="Email list size, if you have one" type="number" inputMode="numeric" min="0" />
        </Section>

        <Section section={SECTIONS[5]} register={register("website")}>
          <ChoiceGroup
            name="has_website"
            legend="Do you have an author website?"
            required
            options={[["yes", "Yes"], ["no", "No"]]}
            onChange={(e) => setHasSite(e.currentTarget.value)}
          />
          <Text
            id="website_url"
            label="Website address"
            hint="Full address, starting with https://"
            type="url"
            inputMode="url"
            placeholder="https://"
            required={hasSite === "yes"}
          />
          <Area id="lead_magnet" label="Free offer for readers (sample chapter, newsletter gift)" rows={2} maxLength={LONG} />
        </Section>

        <Section section={SECTIONS[6]} register={register("social")}>
          {[1, 2, 3].map((i) => (
            <div className={t.socialRow} key={i}>
              <Select
                id={`social${i}_platform`}
                label={i === 1 ? "Platform 1 (required)" : `Platform ${i}`}
                required={i === 1}
                options={SOCIAL_PLATFORMS.map((p) => [p, p])}
              />
              <Text id={`social${i}_handle`} label={`Your handle on platform ${i}`} placeholder="@" />
            </div>
          ))}
          <div className={t.note}>
            <p className={t.hint}>At least one platform and handle is required. Add the ones you actually use.</p>
          </div>
          <Text id="post_platforms" label="Which platforms should your 10 posts be written for?" hint="Separate with commas. Leave blank to use the platforms above." />
          <Text id="posting_frequency" label="Follower counts and how often you post" wide />
          <Area id="top_posts" label="Paste 1–3 of your posts that did well" hint="Separate one post from the next with a blank line." rows={6} />
          <Text id="refused_platforms" label="Platforms you won't use" hint="Separate with commas." />
          <Area id="tone_preferences" label="Tone preferences: humor, formality, anything to avoid" rows={3} />
        </Section>

        <Section section={SECTIONS[7]} register={register("goals")}>
          <Select id="primary_goal" label="Your number-one goal right now" required options={PRIMARY_GOAL_LABELS} />
          <Text id="secondary_goals" label="Other goals" hint="Separate with commas." />
          <Text id="hours_per_week" label="Hours per week you can spend on marketing" hint="A number, like 3 or 2.5." type="number" inputMode="decimal" min="0" step="0.5" required />
          <Select id="budget_band" label="Monthly marketing budget" hint="Only used to size suggestions. Never appears in your kit." required options={BUDGET_LABELS} />
          <Text id="talking1" label="Podcast topic 1" hint="The real-life issues in your book, your writing journey, your expertise. Your podcast pitch is built from these." required />
          <Text id="talking2" label="Podcast topic 2" required />
          <Text id="talking3" label="Podcast topic 3" required />
          <Text id="talking4" label="Podcast topic 4" />
          <Text id="talking5" label="Podcast topic 5" />
          <div className={t.note}><p className={t.hint}>3–5 topics. The first three are required.</p></div>
          <Text id="cta_action" label="The one thing readers should do after reading your marketing" hint="Usually “buy the book” or “join my newsletter”." required />
          <Text id="cta_link" label="…and the link for it" type="url" inputMode="url" placeholder="https://" required />
          <Area id="tried_before" label="Marketing you've tried and how it went" rows={3} />
          <Area id="podcasts_wanted" label="Podcasts or outlets you'd love to be on" hint="One per line." rows={3} />
          <Text id="peers_admired" label="Authors whose marketing you admire" />
        </Section>

        <Section section={SECTIONS[8]} register={register("confirmations")}>
          <div className={t.consent}>
            <p className={t.consentIntro}>
              <strong>Required.</strong> Tick all three. The send button stays disabled until you do.
            </p>
            {[
              ["consent_facts", "The facts, credentials, reviews and endorsements I've provided are accurate, and I have permission to use them."],
              ["consent_ai", "I understand my kit is AI-drafted and human-reviewed."],
              ["consent_images", "I own or have the rights to any images I send (headshot, cover)."],
            ].map(([name, label], i) => (
              <label className={t.consentItem} key={name}>
                <input
                  type="checkbox"
                  name={name}
                  value="on"
                  checked={consent[i]}
                  onChange={(e) => {
                    const checkedNow = e.currentTarget.checked;
                    setConsent((prev) => {
                      const next = [...prev];
                      next[i] = checkedNow;
                      return next;
                    });
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
            <p className={t.hint}>We date the submission for you, so there is no date to fill in.</p>
          </div>
        </Section>

        <div className={t.send}>
          <button type="submit" className={s.btn} disabled={!consentOk || status === "sending"}>
            {status === "sending" ? "Sending…" : "Send my questionnaire"}
          </button>
          <p className={t.sendNote}>
            {consentOk
              ? "Your answers go to Jerry's inbox. Nothing is posted, pitched or emailed to anyone else."
              : "Tick all three confirmations in section 9 to enable the send button."}
          </p>
        </div>
        <p className={t.strayNote}>
          Your answers stay in this browser tab until you send. If you close it, they&rsquo;re gone, so
          send when you&rsquo;re done — or email <a href="mailto:support@flashtech.biz">support@flashtech.biz</a>.
        </p>
      </form>
    </>
  );
}
