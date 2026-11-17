import Link from "next/link";
import "../../../globals.css";
import { store, money } from "@/lib/store-config.mjs";
import InquiryForm from "./InquiryForm";
import styles from "../store.module.css";

export const metadata = {
  title: `Get TaskApp configured — ${money(99)} · Flash Tech`,
  description:
    "The configured version of TaskApp: a 30-minute call with your clients and projects loaded before it. One-time payment, no subscription.",
  robots: store.live ? undefined : { index: false, follow: false },
};

export default function InquiryPage() {
  return (
    <div>
      <header className={styles.topbar}>
        <div className={`wrap ${styles.topbarInner}`}>
          <div className={styles.crumb}>
            <Link href="/" style={{ color: "var(--ink)", fontWeight: 700 }}>{store.brand}</Link>
            <span className={styles.sep}>/</span>
            <Link href="/apps/taskapp">TaskApp</Link>
            <span className={styles.sep}>/</span>
            <span style={{ color: "var(--ink)", fontWeight: 650 }}>Configured</span>
          </div>
          <nav className={styles.topnav}>
            <Link className="btn ghost" href="/apps/taskapp">Back to the product</Link>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <div className={styles.inquiry}>
          <div className="eyebrow">Configured · {money(store.priceConfigured)} once</div>
          <h1>Open it on Monday with the jobs already in it.</h1>
          <p>
            The configured version is the same app with your world loaded: your clients, your
            projects, and the jobs you currently keep in three places. We do that before the call,
            then spend 30 minutes walking you through it. One-time payment, no subscription, and
            the {store.refundDays}-day refund applies until the configuration is delivered.
          </p>
          <p>
            This is not a second checkout. Tell us what you need and we will reply by the next
            business day to confirm the price, the call time and what we will load.
          </p>
          <InquiryForm />
          <p style={{ marginTop: 22, fontSize: ".9rem" }}>
            Just want the file? <Link href="/apps/taskapp#pricing">Buy the download — {money(store.priceDownload)}</Link>.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className="wrap">
          <div className={styles.fine}>
            <span>{store.brand} · TaskApp · configured builds</span>
            <Link href="/apps/taskapp/legal/support-policy">Support policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
