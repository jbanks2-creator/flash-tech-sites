import "../globals.css";

/* Flash Tech → Startups: index of ventures that run on the Flash Tech platform but carry their own brand. */
export const metadata = {
  title: "Startups | Flash Tech",
  description: "New ventures built and run by Flash Tech.",
  alternates: { canonical: "/startups" },
};

const VENTURES = [
  {
    href: "/startups/authors",
    name: "The Author’s Candle",
    line: "AI-drafted, human-reviewed marketing kits for self-published authors.",
    status: "Taking founding authors",
  },
];

export default function StartupsPage() {
  return (
    <>
      <header className="site">
        <div className="wrap">
          <a className="logo" href="/"><span className="mark">F</span> Flash Tech</a>
          <nav className="top">
            <a href="/">Home</a>
          </nav>
        </div>
      </header>
      <main>
        <section style={{ padding: "72px 0 96px" }}>
          <div className="wrap">
            <div className="eyebrow">Startups</div>
            <h1>New ventures from Flash Tech</h1>
            <p style={{ maxWidth: "36em", fontSize: "1.1rem" }}>
              Each one runs on our infrastructure and carries its own brand.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "40px 0 0", display: "grid", gap: 16, maxWidth: 720 }}>
              {VENTURES.map((v) => (
                <li key={v.href} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "22px 24px" }}>
                  <a href={v.href} style={{ fontSize: "1.25rem", fontWeight: 700 }}>{v.name}</a>
                  <p style={{ margin: "6px 0 0" }}>{v.line}</p>
                  <p style={{ margin: "6px 0 0", fontSize: ".85rem", color: "var(--muted)" }}>{v.status}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
