import Link from "next/link";
import { notFound } from "next/navigation";
import "../../../../globals.css";
import { store } from "@/lib/store-config.mjs";
import { LEGAL_DOCS, LEGAL_SLUGS, getLegalDoc, markerCounts } from "@/lib/store-content.mjs";
import styles from "../../store.module.css";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }) {
  const { doc } = await params;
  const meta = LEGAL_DOCS[doc];
  if (!meta) return {};
  return {
    title: `${meta.title} — TaskApp`,
    description: `${meta.title} for TaskApp, sold by ${store.brand}.`,
    robots: store.live ? undefined : { index: false, follow: false },
  };
}

export default async function LegalPage({ params }) {
  const { doc } = await params;
  if (!LEGAL_DOCS[doc]) notFound();
  const page = getLegalDoc(doc);
  if (!page) notFound();
  const markers = markerCounts();

  return (
    <div>
      <header className={styles.topbar}>
        <div className={`wrap ${styles.topbarInner}`}>
          <div className={styles.crumb}>
            <Link href="/" style={{ color: "var(--ink)", fontWeight: 700 }}>{store.brand}</Link>
            <span className={styles.sep}>/</span>
            <Link href="/apps/taskapp">TaskApp</Link>
            <span className={styles.sep}>/</span>
            <span style={{ color: "var(--ink)", fontWeight: 650 }}>{page.short}</span>
          </div>
          <nav className={styles.topnav}>
            <Link className="btn ghost" href="/apps/taskapp">Back to the product</Link>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <article className={styles.legalPage}>
          {!store.live && (
            <div className={styles.draftBanner}>
              <b>DRAFT — NOT FOR PUBLICATION.</b> This is the current source document for the
              agreement, shown here so the store page&apos;s links can be checked. It still contains{" "}
              {markers.jerry + markers.attorney} unresolved drafting markers ({markers.jerry} for the
              business, {markers.attorney} for a lawyer), shown highlighted below. The build refuses
              to produce a live store with any marker left.
            </div>
          )}
          <h1>{page.title}</h1>
          <p className={styles.legalMeta}>
            {store.brand} · TaskApp · {page.words.toLocaleString("en-US")} words ·{" "}
            <Link href="/apps/taskapp/changelog">version history</Link>
          </p>
          <div dangerouslySetInnerHTML={{ __html: page.html }} />
        </article>
      </main>

      <footer className={styles.footer}>
        <div className="wrap">
          <div className={styles.fine}>
            <span>{store.brand} · TaskApp · this page is part of the product documentation.</span>
            <Link href="/apps/taskapp">Back to TaskApp</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
