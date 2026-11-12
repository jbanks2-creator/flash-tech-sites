import s from "./authors.module.css";
import ApplyForm from "./ApplyForm";

/* Copy source: ~/businesses/author-marketing/site/landing.html. Keep the two in step.
   Rules for this page: say "AI-drafted, human-reviewed"; no outcome promises; no invented claims. */

const KIT = [
  ["Short author bio", "50 words", "For social profiles, bylines and the line a host reads before your interview."],
  ["Standard author bio", "150 words", "For your Amazon author page, guest posts and event programs."],
  ["Long author bio", "up to 500 words · ×2", "Your website's About page, in first person and third person."],
  ["Book description", "2 lengths", "A retailer listing and a back-cover version. For fiction, nothing past the midpoint of your story is revealed."],
  ["Social media posts", "10 posts", "Written for the platforms you actually use, each within that platform's limits, with no two opening the same way."],
  ["Podcast pitch and one-sheet", "<150-word pitch", "A pitch email you personalize for each show, plus the text for a one-page author sheet."],
];

const STEPS = [
  ["Tell us about you and your book", "One questionnaire, about 30 minutes, plus two short pieces of your own writing so we can learn your voice."],
  ["We draft", "AI drafts each piece from your answers only. Your bio comes first; everything else stays consistent with it."],
  ["We check", "Every fact is matched against your answers, every length and limit is checked, and a person reviews the whole kit."],
  ["You get your kit", "Ready-to-use files, plus a short list of anything we need you to confirm."],
];

const RULES = [
  ["No invented facts", "No made-up credentials, awards, reviews or numbers. If it isn't in your answers, it isn't in your kit."],
  ["No promises we can't keep", "We write strong marketing. We don't promise sales, rankings, reviews or bookings, and you should be wary of anyone who does."],
  ["Your spelling, exactly", "Character names, titles and deliberate spellings are copied letter for letter, never “corrected.”"],
  ["You stay in control", "We don't post, email or pitch on your behalf. You decide what goes out and where."],
];

const FAQ = [
  ["Is this written by AI?", "Drafts are written by AI from your questionnaire. Each draft is then checked against your answers and reviewed by a person before it reaches you. We say this plainly because you deserve to know."],
  ["Will it sound like me?", "Your social posts, first-person bio and podcast pitch are written to match the writing samples you send us. Third-person bios and book descriptions follow the professional conventions readers expect."],
  ["What if I don't have awards or reviews yet?", "That's normal. We build your kit from what's true about you and your book. We'd rather write a strong, honest bio than a padded one."],
  ["Do you guarantee sales or reviews?", "No. Nobody honest can. We give you professional marketing material. How and where you use it is up to you."],
  ["I've written more than one book.", "The Starter Kit focuses on one book. Mention your other titles in the form and we'll talk about the rest."],
];

export default function AuthorsPage() {
  return (
    <div className={s.page}>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <div className={s.wrap}>
          <a href="/">Flash Tech</a> / <a href="/startups">Startups</a> / The Author&rsquo;s Candle
        </div>
      </nav>

      <header className={s.top}>
        <div className={s.wrap}>
          <div className={s.mark}>The Author&rsquo;s Candle<small>Author marketing kits</small></div>
          <a className={`${s.btn} ${s.ghost}`} href="#apply">Apply</a>
        </div>
      </header>

      <main>
        <div className={s.hero}>
          <div className={s.wrap}>
            <div>
              <p className={s.label}>For self-published authors</p>
              <h1>Your book&rsquo;s marketing kit, written from <em>your</em> answers.</h1>
              <p className={s.lede}>Bios, book descriptions, social posts and a podcast pitch, built from one questionnaire and checked line by line before you see them. AI-drafted, human-reviewed.</p>
              <div className={s.actions}>
                <a className={s.btn} href="#apply">Apply for a founding spot</a>
                <a className={`${s.btn} ${s.ghost}`} href="#kit">See what&rsquo;s in the kit</a>
              </div>
            </div>
            <aside className={s.titlepage} aria-label="The Starter Kit at a glance">
              <span className={s.label}>The Starter Kit</span>
              <strong>Six finished pieces, one questionnaire</strong>
              <div className={s.rule} />
              <p>For authors on Amazon KDP, IngramSpark, Draft2Digital and similar platforms, writing fiction or nonfiction.</p>
              <div className={s.rule} />
              <p>Every name, date and credential comes from you. If we don&rsquo;t have a fact, we ask. We don&rsquo;t fill gaps.</p>
            </aside>
          </div>
        </div>

        <section className={s.section} id="kit">
          <div className={s.wrap}>
            <div className={s.sechead}>
              <span className={s.label}>Contents</span>
              <h2>What&rsquo;s in the Starter Kit</h2>
              <p>Each piece is written to a fixed length and purpose, so you can paste it where it belongs.</p>
            </div>
            <ol className={s.toc}>
              {KIT.map(([t, spec, d], i) => (
                <li key={t}>
                  <span className={s.n}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={s.line}><span className={s.t}>{t}</span><span className={s.dots} /><span className={s.spec}>{spec}</span></div>
                  <p className={s.d}>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.sechead}><span className={s.label}>Process</span><h2>How it works</h2></div>
            <div className={s.steps}>
              {STEPS.map(([h, p], i) => (
                <div className={s.step} key={h}><span className={s.label}>Step {i + 1}</span><h3>{h}</h3><p>{p}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.sechead}><span className={s.label}>House rules</span><h2>What we will and won&rsquo;t do</h2></div>
            <div className={s.rules}>
              {RULES.map(([h, p]) => (<div key={h}><h3>{h}</h3><p>{p}</p></div>))}
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.sechead}>
              <span className={s.label}>Founding authors</span>
              <h2>Be one of our first authors</h2>
              <p>We&rsquo;re opening a small number of spots at a founding rate while we refine the service with real authors.</p>
            </div>
            <div className={s.offer}>
              <div className={s.price}>
                <span className={s.label}>Starter Kit</span>
                <span className={s.big}>$97</span>
                <span className={s.was}>regular price <s>$297</s></span>
              </div>
              <div>
                <p style={{ marginBottom: 10 }}>In return, founding authors agree to:</p>
                <ul>
                  <li>a short written testimonial, if you&rsquo;re happy with the kit</li>
                  <li>a 15-minute feedback call</li>
                  <li>let us show before-and-after examples (we&rsquo;ll ask first)</li>
                </ul>
              </div>
              <p className={s.fine}>Limited spots. The founding rate ends after our first 50 authors. Delivery in about a week from a complete questionnaire.</p>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.sechead}><span className={s.label}>Questions</span><h2>Common questions</h2></div>
            <div className={s.faq}>
              {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
            </div>
          </div>
        </section>

        <section className={s.section} id="apply">
          <div className={s.wrap}>
            <div className={s.sechead}>
              <span className={s.label}>Apply</span>
              <h2>Apply for a founding spot</h2>
              <p>Tell us a little about your book. We&rsquo;ll reply by email with the questionnaire and next steps.</p>
            </div>
            <ApplyForm />
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.wrap}>
          <span>The Author&rsquo;s Candle · Author marketing kits · AI-drafted, human-reviewed</span>
          <span>A <a href="/startups">Flash Tech startup</a></span>
        </div>
      </footer>
    </div>
  );
}
