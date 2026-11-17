import '../globals.css';
import ContactForm from '../ContactForm';

const OG = "/og/contact.png";

export const metadata = {
  title: 'Contact — Flash Tech',
  description: 'Contact Flash Tech — IT support, business phones and AI for small businesses in Sherman, Denison and Grayson County, Texas.',
  alternates: { canonical: "/contact" },
  openGraph: {
    title: 'Contact — Flash Tech',
    description: 'Contact Flash Tech — IT support, business phones and AI for small businesses in Sherman, Denison and Grayson County, Texas.',
    url: "/contact",
    siteName: 'Flash Tech',
    locale: 'en_US',
    type: 'website',
    images: [{ url: OG, width: 1200, height: 630, alt: "Flash Tech — Contact" }],
  },
  twitter: { card: 'summary_large_image', images: [OG] },
};

export default function ContactPage() {
  return (
    <>
      <header className="site">
        <div className="wrap">
          <a className="logo" href="/"><span className="mark">F</span> Flash Tech</a>
          <nav className="top">
            <a href="/#services">Services</a>
            <a href="/#ai">AI</a>
            <a href="/#wiz">The Wiz</a>
            <a className="btn primary" href="#contact-form">Free IT check-up</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Contact · Sherman · Denison · Grayson County</div>
              <h1>Tell us what keeps breaking.</h1>
              <p className="lead">
                Flash Tech handles the IT, the phones and the AI for small businesses in Grayson
                County — one local person who replies to you, not a call centre.
              </p>
            </div>

            <div className="split">
              <div id="contact-form">
                <h2>Book a free IT check-up.</h2>
                <p>
                  Twenty minutes, no obligation. We look at what you have, name what is actually at
                  risk, and put the fix in writing — in plain English.
                </p>
                <p>
                  Would rather just write? Email <a href="mailto:TheWiz@FlashTech.Biz">TheWiz@FlashTech.Biz</a>.
                </p>
                <ContactForm />
              </div>

              <div>
                <h2>What happens next</h2>
                <div className="panel">
                  <ul>
                    <li>A reply within one business day — from Jerry, not a form robot.</li>
                    <li>A free IT check-up, about twenty minutes, on the phone or on site.</li>
                    <li>No sales script. If we are not the right fit, we say so and point you to someone who is.</li>
                  </ul>
                </div>
              </div>
            </div>

            <h2 style={{ marginTop: 44 }}>Contact details</h2>
            <div className="panel" style={{ maxWidth: 620 }}>
              <ul>
                {/* phone: add when Flash Tech PBX line is live */}
                <li><strong>Email</strong> — <a href="mailto:TheWiz@FlashTech.Biz">TheWiz@FlashTech.Biz</a></li>
                <li><strong>Hours</strong> — Mon–Fri, 8am–6pm CT</li>
                <li><strong>Service area</strong> — Sherman · Denison · Grayson County, Texas</li>
              </ul>
            </div>

            <div className="cta-row" style={{ marginTop: 34 }}>
              <a className="btn ghost" href="/">Back to the home page</a>
              <a className="btn ghost" href="/#services">See all services</a>
            </div>
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
