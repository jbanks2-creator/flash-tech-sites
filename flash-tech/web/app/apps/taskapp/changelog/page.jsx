import Link from "next/link";
import "../../../globals.css";
import { store } from "@/lib/store-config.mjs";
import { getChangelog, getVersion } from "@/lib/store-content.mjs";
import styles from "../store.module.css";

export const metadata = {
  title: "TaskApp changelog — every version, in plain English",
  description: "Release notes for TaskApp: what changed in each version, and what was tested.",
  robots: store.live ? undefined : { index: false, follow: false },
};

export default function ChangelogPage() {
  const { html, releases } = getChangelog();
  const version = getVersion();
  return (
    <div>
      <header className={styles.topbar}>
        <div className={`wrap ${styles.topbarInner}`}>
          <div className={styles.crumb}>
            <Link href="/" style={{ color: "var(--ink)", fontWeight: 700 }}>{store.brand}</Link>
            <span className={styles.sep}>/</span>
            <Link href="/apps/taskapp">TaskApp</Link>
            <span className={styles.sep}>/</span>
            <span style={{ color: "var(--ink)", fontWeight: 650 }}>Changelog</span>
          </div>
          <nav className={styles.topnav}>
            <Link className="btn ghost" href="/apps/taskapp">Back to the product</Link>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <article className={styles.changelog}>
          <h1>What changed</h1>
          <p className={styles.legalMeta}>
            The version you are buying is <b>{version}</b>. {releases} releases are listed. Dates are
            release dates; versions are semver for a single-file product.
          </p>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>

      <footer className={styles.footer}>
        <div className="wrap">
          <div className={styles.fine}>
            <span>{store.brand} · TaskApp {version}</span>
            <Link href="/apps/taskapp">Back to TaskApp</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
