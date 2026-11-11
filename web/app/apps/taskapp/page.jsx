import Link from "next/link";
import "../../globals.css";
import { store, money } from "@/lib/store-config.mjs";
import { getVersion } from "@/lib/store-content.mjs";
import styles from "./store.module.css";

const VERSION = getVersion();
const OG = "/apps/taskapp/og-image.png";

// A public page must never frame a non-https origin: an http:// frame is blocked as mixed content
// on an https:// page, and a loopback origin would point at the visitor's own machine instead of
// ours. `next dev` keeps the developer's local demo URL; a production build frames only https.
const DEMO_ORIGIN =
  store.demoOrigin && (process.env.NODE_ENV !== "production" || store.demoOrigin.startsWith("https://"))
    ? store.demoOrigin
    : "";

export const metadata = {
  title: "TaskApp — one-file task manager for small business",
  description:
    `A task app for small businesses that runs from one file on your own computer. No subscription, no account, no cloud. ${money(store.priceDownload)} once. Try the demo.`,
  openGraph: {
    title: "TaskApp: every client, every job, one file",
    description: "Runs on your computer, works offline, no subscription. A Grayson County IT company answers the email.",
    images: [{ url: OG, width: 1200, height: 630, alt: "TaskApp: every client, every job, one file, shown with a dark board view." }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: [OG] },
  ...(store.live ? { alternates: { canonical: "https://flashtech.biz/apps/taskapp" } } : {}),
};

function SupportLink() {
  if (store.supportEmail) {
    return <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>;
  }
  return <Link href={store.contactHref}>our contact form</Link>;
}

function Demo() {
  const origin = DEMO_ORIGIN;
  if (!origin) {
    return (
      <div className={styles.demoShell}>
        <div className={styles.demoBanner}>
          <span><b>DEMO</b> — the interactive demo is being finished.</span>
        </div>
        <p className={styles.demoFallback}>
          The demo opens at its own address so it can never touch your browser storage on this site.
          It is not connected here yet — watch the 10-second animation below, or ask us for a
          walkthrough through the contact form.
        </p>
      </div>
    );
  }
  const src = `${origin}/?demo=1&v=${encodeURIComponent(VERSION)}`;
  return (
    <div className={styles.demoShell}>
      <div className={styles.demoBar}>
        <span className={styles.dotRow} aria-hidden="true"><i /><i /><i /></span>
        <span><strong>Try it here</strong> — the real app, sample data, nothing to install</span>
        <span>TaskApp {VERSION}</span>
      </div>
      <div className={styles.demoBanner} role="note">
        <span>
          <b>THIS IS A DEMO.</b> Nothing is saved — not to this site and not to your copy of the app.
          Reload the page and it starts again from the same sample workspace. Clear the demo inside the
          app with <b>Settings → Clear demo data</b> if you want to try adding your own job.
        </span>
      </div>
      <iframe
        className={styles.demoFrame}
        src={src}
        title="TaskApp live demo — sample workspace, nothing is saved"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className={styles.demoFoot}>
        <span>The demo is the same file you buy. Its own address keeps it away from your data.</span>
        <a href={src} target="_blank" rel="noreferrer">Open the demo in its own tab →</a>
      </div>
    </div>
  );
}

const FAQ = [
  {
    q: "Why not just use Notion, Excel or a free app?",
    a: (
      <>
        <p>They are good tools, and if one of them is already holding your jobs, keep it. What they do not do is sit on your computer as one file you own. Notion needs an account and a connection. Excel is fine until you want a board, a due-date reminder or a printed job sheet. Free apps usually want an account, show ads, or stop being supported.</p>
        <p>TaskApp is one file. No account, no cloud, no monthly bill, and it works with the internet off. It also does less than Notion: no sharing, no sync, no phone app. If you need those, Notion is the better buy and we would rather say so now.</p>
      </>
    ),
  },
  {
    q: "Do I need to install anything or create an account?",
    a: (
      <>
        <p>No. You get one HTML file. Put it anywhere you like, double-click it, and it opens in your browser. There is no installer, no admin password, no sign-up and no email verification. You may need to enter the licence key from your receipt once; that is the whole setup.</p>
        <p>If a new version arrives, export a backup first, then replace the file. Your data stays where it is.</p>
      </>
    ),
  },
  {
    q: "What happens if I lose my computer?",
    a: (
      <>
        <p>We cannot recover it. Your data is on your machine, not ours, and that is the trade you are making for privacy. So the honest answer is: back it up, and the backup is one click.</p>
        <p>Settings → Export backup writes a single JSON file with every client, project, task, note and attachment in it. Put that file in your Google Drive or OneDrive folder, or on a USB stick in the drawer, and do it weekly. The app puts a banner on screen when the last export is more than seven days old.</p>
        <p>On a new computer: copy TaskApp across, import the backup, and you are back where you were. Import merges rather than replaces, so importing twice does no harm. Only the work since your last export is lost. If the browser&apos;s stored copy is ever damaged, the app keeps a copy of the damaged data, refuses to overwrite it, and offers you the copy to download.</p>
      </>
    ),
  },
  {
    q: "What does support include?",
    a: (
      <>
        <p>Email <SupportLink /> and you get a reply by the next business day. {store.supportMonths} months of email support is included with your licence for questions, setup help and import or export problems. After that it is {money(store.supportRate)} an hour, quoted before any work starts, and you can always say no. Bugs in the app are fixed free — in the version you bought, for the life of that version.</p>
        <p>What it does not cover: your computer, your browser extensions, your network, or recovering data you have erased or never exported. We do not remote into your computer.</p>
        <p>Support is email only. There is no phone line; if something needs a conversation, ask in the email and we will book a call. A booked call is paid work, not included support.</p>
      </>
    ),
  },
  {
    q: `What does the ${store.refundDays}-day refund mean?`,
    a: (
      <>
        <p>Buy it, use it for thirteen days, and if it is not for you, ask for your money back. You do not have to give a reason, and using it does not disqualify you. Email <SupportLink /> with the order number and the email you used at checkout. We authorize the refund within two business days and the merchant of record puts it back on your card, usually within five to ten business days.</p>
        <p>Your data is not affected. It is in your browser, not ours, so export it first if you want to keep it. A refund cancels the licence, so delete your copies afterwards.</p>
        <p>The Configured tier works on milestones instead: full refund before the setup call, none once your configuration has been delivered. Defects are still fixed free.</p>
      </>
    ),
  },
  {
    q: "Which browsers does it work in?",
    a: (
      <>
        <p>Chrome, Edge and other Chromium-based browsers. We tested it at desktop size and at phone size in Chromium, from a local file and over the web.</p>
        <p>We have not tested Firefox, Safari, iPhone or iPad in this release. If one of those is what you use, email us before you buy and we will tell you what we know. The {store.refundDays}-day refund covers it either way.</p>
      </>
    ),
  },
  {
    q: "Can two people use it? Will it sync to my phone?",
    a: (
      <>
        <p>No. It is one file, one browser, one computer. There is no sync and no shared server, so two people need two copies and two licences, and neither will see the other&apos;s changes.</p>
        <p>If you need the same list on three devices at once, TaskApp is the wrong tool and we would rather tell you now. If you need it on a second computer occasionally, export a backup and import it there; that is a manual move, not sync.</p>
      </>
    ),
  },
  {
    q: "Is my data really private? Does it send anything?",
    a: (
      <>
        <p>It sends nothing. On a page load the only request is for the file itself: no analytics, no tracking pixel, no third-party script, no CDN font. Run it with the Wi-Fi off and it behaves exactly the same. You can check: the file is not minified, so open it in a text editor and search for <code>fetch(</code> and <code>XMLHttpRequest</code>. Both are absent.</p>
        <p>We never see your tasks, and we cannot back them up for you. Those two facts are the same fact.</p>
      </>
    ),
  },
];

export default function TaskAppStorePage() {
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "TaskApp",
    description:
      "A single-file task manager for small businesses. Runs on your computer, works offline, no account and no subscription.",
    image: `https://flashtech.biz${OG}`,
    brand: { "@type": "Brand", name: store.brand },
    offers: {
      "@type": "Offer",
      price: String(store.priceDownload),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://flashtech.biz/apps/taskapp",
    },
  };

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <header className={styles.topbar}>
        <div className={`wrap ${styles.topbarInner}`}>
          <div className={styles.crumb}>
            <Link href="/" className="logo" style={{ gap: 8 }}><span className="mark">F</span> {store.brand}</Link>
            <span className={styles.sep}>/</span>
            <span className={styles.crumbApps}>Apps</span>
            <span className={styles.sep}>/</span>
            <span style={{ color: "var(--ink)", fontWeight: 650 }}>TaskApp</span>
          </div>
          <nav className={styles.topnav}>
            {store.testMode && <span className={styles.testChip}>Test mode</span>}
            <a className="btn ghost" href="#demo">Try the demo</a>
            <a className="btn primary" href="#pricing">Buy — {money(store.priceDownload)}</a>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`wrap ${styles.heroInner}`}>
            <div>
              <div className="eyebrow">TaskApp · one file, no account</div>
              <h1>Know what&apos;s outstanding for every client, in one place.</h1>
              <p className="lead">
                TaskApp keeps your clients, jobs and deadlines in a single file on your own
                computer. No subscription, no account, no cloud.
              </p>
              <div className={styles.ctaRow}>
                <a className="btn primary" href="#demo">Try the demo — no email needed</a>
                <a className="btn ghost" href="#pricing">Buy the download — {money(store.priceDownload)}</a>
              </div>
              <div className={styles.heroMeta}>
                <span><b>{money(store.priceDownload)}</b> once</span>
                <span><b>{store.refundDays} days</b> no-questions refund</span>
                <span><b>Works offline</b></span>
                <span><b>One HTML file</b></span>
              </div>
            </div>
            <div>
              <div className={styles.shotCard}>
                <img
                  className={styles.shot}
                  src="/apps/taskapp/hero-board-dark.png"
                  width={1600}
                  height={1000}
                  alt="TaskApp board view, dark theme, with four status columns (To Do, In Progress, Blocked, Completed), the client filter row above them, and two overdue jobs marked in red."
                />
                <p className={styles.shotCap}>
                  Every job in one place. Overdue ones stay red until they&apos;re done. Shown with the
                  demo workspace that ships with the app.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className={styles.demoBlock}>
          <div className="wrap">
            <Demo />
            <p className={styles.ctaNote}>
              {DEMO_ORIGIN
                ? "Prefer to watch? The animation below shows quick-add and drag-to-done. The demo above is the actual app — click anything."
                : "The animation below shows quick-add and drag-to-done in the real app, at 10 seconds. The interactive demo opens here once its own address is live."}
            </p>
            <div style={{ marginTop: 18 }}>
              <video
                className={styles.shot}
                style={{ border: "1px solid #1e2a42", borderRadius: 14, background: "#0b1220" }}
                width={1600}
                height={1000}
                poster="/apps/taskapp/hero-board-dark.png"
                autoPlay
                muted
                loop
                playsInline
                controls
                aria-label="Short animation: a task is typed into the quick-add bar, appears on the board, and is dragged to the completed column."
              >
                <source src="/apps/taskapp/demo.webm" type="video/webm" />
                <source src="/apps/taskapp/demo.mp4" type="video/mp4" />
              </video>
              <p className={styles.ctaNote}>Quick-add a job, then drag it to done.</p>
            </div>
          </div>
        </section>

        <section className="alt">
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>The problem: five places and one memory</h2>
            </div>
            <div className={styles.prose}>
              <p>
                Tuesday morning at a three-truck HVAC company. A customer texts about the tune-up that
                was supposed to happen last week. The quote is in your email. The work order is on the
                printer. The install date is in your phone calendar. There is a sticky note on the dash
                of truck two. The invoice is in QuickBooks.
              </p>
              <p>Nothing there is broken. Each tool does its own job.</p>
              <p>
                The problem is that no single place can answer the question you get asked every day:
                what is still open for the Hendersons? The answer is in five places, and one of them is
                your memory. That works until it doesn&apos;t, and when it doesn&apos;t, it costs a
                repeat visit, a late invoice, or a customer who quietly stops calling.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>What TaskApp does about it</h2>
            </div>
            <div className={styles.prose}>
              <p>
                TaskApp puts the client at the top. Each client is a folder in the app; it calls them
                domains, because they can be departments or job types too. Under each client sit the
                projects: the install, the service agreement, the fall maintenance round. Under those
                sit the tasks.
              </p>
              <p>
                A task carries the things you would otherwise keep in your head: due date and optional
                time, priority, status, tags and notes. Adding one is a single line. Type{" "}
                <code>Call Hendersons about tune-up !high due:fri</code> and press Enter; the app sets
                the priority and the date for you.
              </p>
              <p>
                Then look at the same work three ways. <b>Board</b> shows everything open in four status
                columns you can drag. <b>List</b> shows everything with filters, for when you need to
                find one thing. <b>Focus</b> shows the three tasks that actually matter today. Print
                any view and you get a clean sheet with the client name and the date at the top.
              </p>
              <p>
                It is one HTML file. Double-click it and it opens in your browser. No installer, no
                account, no server, and nothing to configure before you start.
              </p>
            </div>
          </div>
        </section>

        <section className="alt">
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>Why buy it instead of building it</h2>
            </div>
            <div className={styles.prose}>
              <p>
                You could ask an AI for a task app this afternoon and get something that looks right.
                Then it is yours to maintain, and you find out what that means over the next few
                months: an import that duplicates half your client list, a note that vanishes when the
                browser runs out of room, a file that stops opening.
              </p>
              <p>
                The screens are the easy part. We spent the time on the failure paths. Every import is
                checked in full before it touches your data, and the app downloads a safety copy of
                what you had first. If the stored data is ever unreadable, it keeps a copy and refuses
                to overwrite it. If a save fails because storage is full, it puts the screen back the
                way it was and tells you which attachment to remove. Deletes can be undone. This build
                went through a written audit and an automated test suite covering hostile imports,
                corrupted storage, 5,000 tasks and keyboard-only use. Email us and we will tell you
                exactly what we tested, in plain English.
              </p>
              <p>
                If it does something this page says it does not do, that is our bug, and fixing it
                costs you nothing.
              </p>
              <p>
                You also get a version number in the header, a <Link href="/apps/taskapp/changelog">changelog</Link>{" "}
                on this page, and a person to email when something is wrong. That is the difference
                between a file and a product. There is no setup: open it, pick &quot;start empty&quot;,
                add your first client, and you are working.
              </p>
            </div>
          </div>
        </section>

        <section id="features">
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>What&apos;s in the app</h2>
              <p>Every line below was checked against the build.</p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureText}>
                <h3>Clients at the top</h3>
                <p>Each client is a domain. Give it a color and an order, and see how much work is attached to it at a glance. Deleting a client asks where its work should go, so nothing disappears with it.</p>
                <h3 style={{ marginTop: 22 }}>Projects under each client</h3>
                <p>The install, the service agreement, the maintenance round. Each project has a due date, a status (active, on hold, done), a 1–5 criticality and a progress bar.</p>
              </div>
              <div className={styles.featureShot}>
                <div className={styles.shotStack}>
                  <img className={styles.shot} src="/apps/taskapp/list-filters.png" width={1600} height={1000} alt="TaskApp list view filtered to one client, with due dates, priorities and tags in a table." />
                  <p className={styles.ctaNote}>Filter to one client, then print the list for the truck.</p>
                </div>
              </div>
            </div>

            <div className={`${styles.feature} ${styles.flip}`}>
              <div className={styles.featureText}>
                <h3>Tasks that carry the detail</h3>
                <p>Due date with an optional time. Priority: low, medium, high. Status: To Do, In Progress, Blocked, Completed. Tags. Notes. Recurring tasks (daily, weekly, monthly, with an interval). A file attachment or a link where you need one.</p>
                <h3 style={{ marginTop: 22 }}>Quick add</h3>
                <p>One line at the top of the screen: <code>Call Hendersons about tune-up !high due:fri</code>. Press Enter and it becomes a task with the priority and date already set. <code>#client</code>, <code>@project</code>, <code>every:week</code> and <code>due:+3</code> work too.</p>
              </div>
              <div className={styles.featureShot}>
                <div className={styles.shotStack}>
                  <img className={styles.shot} src="/apps/taskapp/task-drawer.png" width={1600} height={1000} alt="TaskApp task panel open beside the board, showing a due date, high priority and a timestamped note." />
                  <p className={styles.ctaNote}>The whole job in one panel: dates, priority, notes and what happened last.</p>
                </div>
              </div>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureText}>
                <h3>One list, several views</h3>
                <p>Board for the status of every job, with drag and drop. List with filters for finding one thing. Focus for today&apos;s three. Home for a summary across clients. Projects for the workstream view.</p>
                <h3 style={{ marginTop: 22 }}>Print</h3>
                <p>Any view prints as a light sheet, not a screenshot of a dark screen. The client or project filter and the date are printed at the top. Board prints two columns per page. Useful for the truck, the office wall, or a PDF for a customer.</p>
                <h3 style={{ marginTop: 22 }}>Three themes</h3>
                <p>Dark, light and midnight. The light theme is easier to read in a bright office; midnight is for a dim one.</p>
              </div>
              <div className={styles.featureShot}>
                <div className={styles.shotStack}>
                  <img className={styles.shot} src="/apps/taskapp/focus-light.png" width={1600} height={1000} alt="TaskApp focus view in the light theme showing three prioritized tasks with start, done and blocked buttons." />
                  <p className={styles.ctaNote}>Pick the three things that matter today. The rest can wait.</p>
                </div>
              </div>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureText}>
                <h3>Backups you can read</h3>
                <p>Settings → Export backup writes one JSON file with everything in it, attached files included. Import merges it back: new rows are added, matching rows are updated (clients and their colours and order included), and nothing of yours is deleted. On a fresh install the five empty starter clients are replaced by your own, and a client whose name you already use is filed under the one you have. The app downloads a safety copy before every import, and shows a banner when the last export is more than seven days old.</p>
                <h3 style={{ marginTop: 22 }}>And in the smaller print</h3>
                <p>Search across tasks. Keyboard shortcuts for the common actions. A one-page help screen inside the file. Storage use shown in Settings, with an early warning at 84% and the name of the largest attachment when space runs short.</p>
                <p>There is no account, no sync, no sharing and no mobile app. The FAQ says why, plainly.</p>
              </div>
              <div className={styles.featureShot}>
                <img className={styles.shot} src="/apps/taskapp/mobile-board.png" width={390} height={844} alt="TaskApp board view on a phone-sized screen, showing one column of job cards and the client filter." />
                <p className={styles.ctaNote}>The board at phone width. Same file, same data, in the browser you opened it in.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="alt">
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>Pricing</h2>
              <p>Two ways to buy. Both are one-time payments — there is no subscription.</p>
            </div>
            <div className={styles.pricingGrid}>
              <div className={`${styles.tier} ${styles.lead}`}>
                <span className={styles.tierTag}>Download</span>
                <div className={styles.price}><strong>{money(store.priceDownload)}</strong><span>once</span></div>
                <p className={styles.what}>The app file, its SHA-256 checksum, a one-page README, and a receipt with your licence key.</p>
                <dl>
                  <dt>Setup</dt><dd>None. Double-click the file.</dd>
                  <dt>Suits</dt><dd>An owner who will spend fifteen minutes adding clients and is happy to do it.</dd>
                  <dt>Support</dt><dd>{store.supportMonths} months of email support, then {money(store.supportRate)}/hour.</dd>
                  <dt>Refund</dt><dd>{store.refundDays} days, no questions asked.</dd>
                  <dt>Licence</dt><dd>One named user, one computer. Moving computers is fine if the old copy is removed.</dd>
                </dl>
                <Link className="btn primary" href={store.buyHref}>Download TaskApp — {money(store.priceDownload)}</Link>
                <p className={styles.tierNote}>
                  Checkout is {store.testMode ? "in test mode: no card is charged" : "handled by Lemon Squeezy, the merchant of record"}.
                  {" "}Tax is calculated at checkout.
                </p>
              </div>

              <div className={styles.tier}>
                <span className={styles.tierTag}>Configured</span>
                <div className={styles.price}><strong>{money(store.priceConfigured)}</strong><span>once</span></div>
                <p className={styles.what}>Everything in Download, plus a 30-minute setup call and your clients and projects loaded before it.</p>
                <dl>
                  <dt>Setup</dt><dd>A 30-minute setup call, booked at a time you choose. We load your clients and projects before the call, and spend the call walking you through it.</dd>
                  <dt>Suits</dt><dd>An owner who wants to open it on Monday with the jobs already in it.</dd>
                  <dt>Support</dt><dd>Same as Download.</dd>
                  <dt>Refund</dt><dd>Full refund before the setup call; none once your configuration has been delivered.</dd>
                  <dt>Licence</dt><dd>Same.</dd>
                </dl>
                <Link className="btn ghost" href={store.contactHref}>Get it configured — {money(store.priceConfigured)}</Link>
                <p className={styles.tierNote}>This one starts with a short conversation, not a second checkout.</p>
              </div>
            </div>
            <p className={styles.taxNote}>
              Prices are shown before tax. Sales tax is calculated and collected at checkout by the
              merchant of record, who is the legal seller. No &quot;was/now&quot;, no bundle discount,
              no countdown.
            </p>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className={styles.sectionLead}>
              <h2>Questions people ask before buying</h2>
            </div>
            <div className={styles.faq}>
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <div className={styles.answer}>{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="alt">
          <div className="wrap">
            <div className={styles.objection}>
              <h2>Can an AI build this for free?</h2>
              <p>Yes, it can, and if you enjoy that kind of afternoon you should try it. Here is what the {money(store.priceDownload)} actually buys.</p>
              <p><strong>The parts you would not think to build.</strong> Validating an import before it touches your data. Keeping a copy when the stored data is unreadable instead of silently starting empty. Rolling a failed save back so the screen never shows work that was not saved. Testing all of it at 5,000 tasks. That work is invisible when it is done and expensive when it is missing.</p>
              <p><strong>Someone to call.</strong> When the thing breaks in eight months, the chat window that wrote it is a stranger. We answer email by the next business day and fix our own bugs free, because they are our bugs.</p>
              <p><strong>Backup discipline.</strong> The app nags after seven days, saves a copy before every import and writes a file you can read in a text editor. A generated app usually leaves that to you.</p>
              <p><strong>A version number.</strong> You know what you are running, and what changed.</p>
              <p>If none of that is worth {money(store.priceDownload)} to you, build it yourself. That is a reasonable answer, and we would rather you decide it before you buy than after.</p>
              <p style={{ marginBottom: 0 }}><a className="btn primary" href="#pricing" style={{ marginTop: 8 }}>Buy the download — {money(store.priceDownload)}</a></p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className="wrap">
          <div className={styles.footerCols}>
            <div>
              <div className="logo" style={{ color: "#fff", marginBottom: 10 }}><span className="mark">F</span> {store.brand}</div>
              <p style={{ fontSize: ".88rem", maxWidth: "26em" }}>
                IT, phones and AI for Grayson County businesses. TaskApp is built and supported by the
                same people.
              </p>
              <p style={{ fontSize: ".88rem" }}>
                Support: <SupportLink />
              </p>
            </div>
            <div>
              <h4>TaskApp</h4>
              <ul>
                <li><a href="#demo">Live demo</a></li>
                <li><a href="#features">What&apos;s in the app</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><Link href="/apps/taskapp/changelog">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4>The small print</h4>
              <ul>
                <li><Link href="/apps/taskapp/legal/eula">EULA</Link></li>
                <li><Link href="/apps/taskapp/legal/refund-policy">Refund policy</Link></li>
                <li><Link href="/apps/taskapp/legal/support-policy">Support policy</Link></li>
                <li><Link href="/apps/taskapp/legal/privacy-statement">Privacy statement</Link></li>
              </ul>
            </div>
            <div>
              <h4>Buying</h4>
              <ul>
                <li><Link href={store.buyHref}>Download — {money(store.priceDownload)}</Link></li>
                <li><Link href={store.contactHref}>Configured — {money(store.priceConfigured)}</Link></li>
                <li><Link href="/contact">Contact Flash Tech</Link></li>
              </ul>
            </div>
          </div>
          <div className={styles.fine}>
            <span>TaskApp {VERSION} · {store.brand} · Checkout by Lemon Squeezy (merchant of record)</span>
            <span>{store.testMode ? "Test-mode build — not a public launch." : `© ${new Date().getFullYear()} Flash Tech`}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
