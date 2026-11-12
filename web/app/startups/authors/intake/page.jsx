import "../../../globals.css";
import s from "../authors.module.css";
import t from "./intake.module.css";
import IntakeForm from "./IntakeForm";
import { COVER_VO_ENABLED, INTAKE_VERSION } from "@/lib/intake-fields.mjs";

/**
 * The Starter Kit questionnaire: one author at a time, sent as a link by the owner.
 *
 * Copy source: ~/businesses/author-marketing/intake/questionnaire.html (the client-facing form) and
 * intake/questionnaire-spec.md (what each answer becomes). Keep them in step: the questions here
 * are that document's, not a rewrite.
 *
 * NOT a marketing page, deliberately:
 *   - `robots: noindex` here, and /startups/authors/intake is absent from lib/site.mjs's
 *     PUBLIC_ROUTES, so /sitemap.xml cannot advertise it (scripts/check-store.mjs pins that list).
 *   - nothing on the site links to it; the owner sends the URL to one author.
 *
 * Rendered per request, not at build time, because the form's optional cover/voice-over block is
 * switched by INTAKE_COVER_VO — a runtime env var the route reads per request too. A statically
 * prerendered page would freeze the build machine's value into the HTML and the two could disagree.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Starter Kit questionnaire — The Author's Candle",
  description:
    "The questionnaire for The Author's Candle Starter Kit: your answers are the only source for every bio, book description, social post and podcast pitch we write.",
  alternates: { canonical: "/startups/authors/intake" },
  robots: { index: false, follow: false, nocache: true },
};

const FACTS = [
  ["about 30 minutes", "You can stop and come back — the page keeps your answers until you close it."],
  ["2–3 writing samples", "About 600 words in total, so your kit can sound like you. Paste them; no upload."],
  ["Nothing is sent automatically", "Your answers come to Jerry. Nothing is posted, pitched or emailed to anyone else."],
  ["We never add facts", "If it isn't in your answers, it isn't in your kit. We ask rather than guess."],
];

const NEXT = [
  ["Jerry reads it", "A person reads every answer before anything is drafted."],
  ["Your kit is drafted", "AI drafts each piece from your answers only, then a person reviews the whole kit."],
  ["You get the files by email", "We email the finished pieces to the address you give us. Nothing is sent anywhere else, automatically or otherwise."],
];

export default function IntakePage() {
  return (
    <div className={s.page}>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <div className={s.wrap}>
          <a href="/">Flash Tech</a> / <a href="/startups">Startups</a> /{" "}
          <a href="/startups/authors">The Author&rsquo;s Candle</a> / Questionnaire
        </div>
      </nav>

      <header className={s.top}>
        <div className={s.wrap}>
          <div className={s.mark}>
            The Author&rsquo;s Candle<small>Starter Kit questionnaire</small>
          </div>
          <a className={t.back} href="/startups/authors">Back to the kit</a>
        </div>
      </header>

      <main>
        <section className={t.intro}>
          <div className={s.wrap}>
            <div className={t.introGrid}>
              <div>
                <p className={s.label}>Starter Kit · {INTAKE_VERSION}</p>
                <h1 className={t.h1}>The questionnaire behind your marketing kit.</h1>
                <p className={t.lede}>
                  Everything in your kit — bios, book descriptions, social posts, the podcast pitch and the
                  one-sheet — is built from your answers here. <strong>It takes about 30 minutes</strong>,
                  plus the time to gather your writing samples.
                </p>
                <p className={t.lede}>
                  Required questions are marked. Optional ones make your kit stronger. If something
                  doesn&rsquo;t apply, write &ldquo;n/a&rdquo;.
                </p>
              </div>
              <aside className={t.facts} aria-label="What to expect">
                {FACTS.map(([head, body]) => (
                  <div key={head} className={t.fact}>
                    <strong>{head}</strong>
                    <p>{body}</p>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </section>

        <IntakeForm coverVo={COVER_VO_ENABLED} />

        <section className={t.after}>
          <div className={s.wrap}>
            <h2 className={t.afterHead}>What happens after you send it</h2>
            <ol className={t.afterList}>
              {NEXT.map(([head, body], i) => (
                <li key={head}>
                  <span className={t.afterNum}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{head}</strong>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className={t.afterNote}>
              Missing or unclear answers are never guessed at. If something is needed, we email you and ask.
            </p>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.wrap}>
          <span>The Author&rsquo;s Candle · AI-drafted, human-reviewed</span>
          <span>A <a href="/startups">Flash Tech startup</a></span>
        </div>
      </footer>
    </div>
  );
}
