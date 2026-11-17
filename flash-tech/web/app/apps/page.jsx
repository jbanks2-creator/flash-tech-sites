import Link from "next/link";
import "../globals.css";

/* The apps index: the one page a visitor lands on when they trim /apps/taskapp down to /apps,
   or search for "Flash Tech apps". One heading, one paragraph, one card — no catalogue.
   The card is the only way through: /apps/taskapp stays the page that sells. */

const OG = "/og/apps.png";

export const metadata = {
  title: "Apps — Flash Tech",
  description:
    "The apps Flash Tech publishes: TaskApp, a one-file task manager for small business, and more niche tools as they are finished.",
  alternates: { canonical: "/apps" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Apps — Flash Tech",
    description:
      "The apps Flash Tech publishes: TaskApp, a one-file task manager for small business, and more niche tools as they are finished.",
    url: "/apps",
    siteName: "Flash Tech",
    locale: "en_US",
    type: "website",
    images: [{ url: OG, width: 1200, height: 630, alt: "Flash Tech — Apps" }],
  },
  twitter: { card: "summary_large_image", images: [OG] },
};

export default function AppsPage() {
  return (
    <>
      <header className="site">
        <div className="wrap">
          <a className="logo" href="/"><span className="mark">F</span> Flash Tech</a>
          <nav className="top">
            <a href="/#services">Services</a>
            <a href="/startups">Startups</a>
            <a className="btn primary" href="/contact">Contact</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">What we publish</div>
              <h1>Apps from Flash Tech</h1>
              <p className="lead">
                We publish small, single-purpose tools for small businesses. TaskApp — a one-file
                task manager that runs on your own computer — is the first; more niche apps follow
                as they are finished. This page is the whole list.
              </p>
            </div>

            <article className="tile" style={{ maxWidth: 620 }}>
              <span className="num">01</span>
              <h2 style={{ fontSize: "1.35rem", marginBottom: 6 }}>
                <Link href="/apps/taskapp">TaskApp</Link>
              </h2>
              <p>
                Every client, every job, one file. A task manager for a 1–25 person business that
                runs on your own computer — no subscription and no account.
              </p>
              <p style={{ margin: 0 }}>
                <Link href="/apps/taskapp">See TaskApp →</Link>
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap">
          <div className="cols">
            <div>
              <h4>Flash Tech</h4>
              <p>IT support, cloud, phone systems and AI for small business.</p>
              <p>Sherman · Denison · Grayson County, Texas</p>
              <p><a href="/startups">Startups</a></p>
            </div>
            <div>
              <h4>Services</h4>
              <ul>
                <li>Managed IT</li>
                <li>Cloud &amp; Azure</li>
                <li>Business phones</li>
                <li>AI receptionist</li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:TheWiz@FlashTech.Biz">TheWiz@FlashTech.Biz</a></li>
                <li>Mon–Fri, 8am–6pm CT</li>
              </ul>
            </div>
          </div>
          <div className="fineprint">
            © {new Date().getFullYear()} Flash Tech. Prices and scope quoted per client.
          </div>
        </div>
      </footer>
    </>
  );
}
