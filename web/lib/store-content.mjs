import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderMarkdown, markDraftMarkers } from "./md.mjs";

const CONTENT = join(process.cwd(), "content/store");

export const LEGAL_DOCS = {
  eula: { file: "eula.md", title: "End User Licence Agreement", short: "EULA" },
  "refund-policy": { file: "refund-policy.md", title: "Refund policy", short: "Refunds" },
  "support-policy": { file: "support-policy.md", title: "Support policy", short: "Support" },
  "privacy-statement": { file: "privacy-statement.md", title: "Privacy statement", short: "Privacy" },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);

function readContent(file) {
  const path = join(CONTENT, file);
  if (!existsSync(path)) {
    throw new Error(`store content missing: ${path} — run "node scripts/sync-store-content.mjs" before building`);
  }
  return readFileSync(path, "utf8");
}

export function getVersion() {
  try {
    return JSON.parse(readContent("version.json")).version;
  } catch {
    return "unknown";
  }
}

export function markerCounts() {
  const all = LEGAL_SLUGS.map((slug) => readContent(LEGAL_DOCS[slug].file)).join("\n");
  return {
    jerry: (all.match(/\[JERRY:/g) || []).length,
    attorney: (all.match(/\[ATTORNEY:/g) || []).length,
  };
}

export function getLegalDoc(slug) {
  const doc = LEGAL_DOCS[slug];
  if (!doc) return null;
  const raw = readContent(doc.file);
  const html = markDraftMarkers(renderMarkdown(raw));
  return {
    slug,
    title: doc.title,
    short: doc.short,
    html,
    unresolved: /\[(JERRY|ATTORNEY):/.test(raw),
    words: raw.split(/\s+/).filter(Boolean).length,
  };
}

export function getChangelog() {
  const raw = readContent("changelog.md");
  return { html: renderMarkdown(raw), releases: (raw.match(/^## /gm) || []).length };
}
