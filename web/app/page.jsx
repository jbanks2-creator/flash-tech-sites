import './globals.css';
import ContactForm from './ContactForm';

const SERVICES = [
  { n: '01', t: 'Tech support', d: 'Remote and on-site help for staff and devices — Windows, Microsoft 365, printers, new-PC setup, user on and offboarding.' },
  { n: '02', t: 'Cloud & Azure', d: 'Tenants, subscriptions and identity set up properly: Entra ID, Azure VMs, backups, cost reviews and migrations.' },
  { n: '03', t: 'Servers & virtualization', d: 'Hyper-V, VMware and Proxmox hosts kept current. Migrations, file servers, and backup that is tested, not assumed.' },
  { n: '04', t: 'Network & security', d: 'Firewalls, switches, Wi-Fi, VPN and VLANs. MFA rollouts, hardening and the boring work that stops a bad week.' },
  { n: '05', t: 'Business phones', d: 'A phone system the business owns: hosted PBX, IVR menus, voicemail-to-email, call queues, desk phones and softphones.' },
  { n: '06', t: 'AI receptionist & agents', d: 'An assistant that answers when you cannot, books the appointment, and hands the caller to a human the moment they ask.' },
];

const AI_LINES = [
  'Workflow audit — what to automate and, more often, what to leave alone',
  'AI assistants set up and staff actually trained on them',
  'Marketing content and review replies, drafted and approved by you',
  'Small internal apps — quote tools, portals, dashboards',
  'Voice and chat agents plugged into your phone system',
];

const IT_LINES = [
  'Monthly support agreements with a real response time',
  'Project work: network refresh, server replacement, Azure migration',
  'Backup and disaster recovery that gets restored on a schedule',
  'Microsoft 365 and identity administration',
  'Vendor management so you stop being the middleman',
];

export default function Page() {
  return (
    <>
      <header className="site">
        <div className="wrap">
          <a className="logo" href="#top"><span className="mark">F</span> Flash Tech</a>
          <nav className="top">
            <a href="#services">Services</a>
            <a href="#ai">AI</a>
            <a href="#wiz">The Wiz</a>
            <a className="btn primary" href="#contact">Free IT check-up</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <div>
              <div className="eyebrow">Sherman · Denison · Grayson County</div>
              <h1>One call for your IT, your phones, and your AI.</h1>
              <p className="lead">
                Flash Tech keeps small businesses running — and shows them what the new tools can
                actually do. The same person who fixes the server also sets up the phone system and
                the AI receptionist that answers it.
              </p>
              <div className="cta-row">
                <a className="btn primary" href="#contact">Book a free IT check-up</a>
                <a className="btn ghost" href="#services">See what we do</a>
              </div>
              <div className="trust">
                <div><b>1–25 staff</b>Where we do our best work</div>
                <div><b>Local</b>On site in Grayson County</div>
                <div><b>One number</b>Not a ticket queue</div>
              </div>
            </div>

            <aside className="card-hero">
              <h3>What usually prompts the call</h3>
              <div className="row"><span className="dot">1</span><div><strong>The server is eight years old</strong><p>And nobody knows what happens the day it stops.</p></div></div>
              <div className="row"><span className="dot">2</span><div><strong>Calls go to voicemail after five</strong><p>Every missed call is a job that went to whoever picked up.</p></div></div>
              <div className="row"><span className="dot">3</span><div><strong>Everyone says &ldquo;AI&rdquo; and nobody knows where to start</strong><p>We start with the workflow, not the product.</p></div></div>
            </aside>
          </div>
        </section>

        <section id="services" className="alt">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Services</div>
              <h2>Six things, done properly.</h2>
              <p>No reseller catalogue and no jargon. If it is not on this list, we will tell you who to call.</p>
            </div>
            <div className="grid c3">
              {SERVICES.map(s => (
                <article className="tile" key={s.n}>
                  <span className="num">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="ai">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Two sides of the same business</div>
              <h2>Keep it running. Then make it work harder.</h2>
            </div>
            <div className="split">
              <div className="panel">
                <span className="tag">Core IT</span>
                <h3>The part that has to be right</h3>
                <ul>{IT_LINES.map(x => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="panel">
                <span className="tag">Flash Tech AI</span>
                <h3>The part that wins you the next customer</h3>
                <ul>{AI_LINES.map(x => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <p className="note" style={{ marginTop: 18 }}>
              The combination is the point: one provider holds the network, the phone line and the AI that answers it — so nobody can blame the other vendor.
            </p>
          </div>
        </section>

        <section className="alt" id="wiz">
          <div className="wrap">
            <div className="wiz">
              <div className="avatar" aria-hidden="true">🧙</div>
              <div>
                <h3>Meet The Wiz</h3>
                <p>
                  Our mascot and, eventually, the face of Flash Tech — the character who explains
                  the technical bits without making anyone feel stupid. He is being drawn now.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact">
          <div className="wrap split">
            <div>
              <div className="eyebrow">Start here</div>
              <h2>Book a free IT check-up.</h2>
              <p>
                Twenty minutes, no obligation. We look at what you have, tell you what is
                actually at risk, and what it would cost to fix — in writing, in plain English.
              </p>
              <p className="note">
                Prefer to talk? Call or email and you will get Jerry, not a call centre.
              </p>
            </div>
            <div>
              <ContactForm />
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
            © {new Date().getFullYear()} Flash Tech. Prices and scope quoted per client. Site under construction — content and brand are placeholders.
          </div>
        </div>
      </footer>
    </>
  );
}
