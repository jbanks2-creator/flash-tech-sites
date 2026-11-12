/**
 * The Author's Candle: a Flash Tech startup with its own brand.
 * Business workspace (copy source, decisions, pipeline): ~/businesses/author-marketing/
 *
 * Indexable since 2026-11-12: the owner ran USPTO searches for the name and found it clear.
 */
export const metadata = {
  title: "The Author's Candle: marketing kits for self-published authors",
  description:
    "AI-drafted, human-reviewed marketing kits for self-published authors: bios, book descriptions, social posts and a podcast pitch, built from one questionnaire.",
  alternates: { canonical: "/startups/authors" },
  openGraph: {
    siteName: "The Author's Candle",
    title: "The Author's Candle: marketing kits for self-published authors",
    description: "AI-drafted, human-reviewed marketing kits for self-published authors.",
    url: "/startups/authors",
    type: "website",
  },
};

export default function AuthorsLayout({ children }) {
  return children;
}
