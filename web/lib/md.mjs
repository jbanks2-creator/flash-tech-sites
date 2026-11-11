/**
 * A deliberately small Markdown renderer for the store's legal pages and changelog.
 *
 * The site has no Markdown dependency (and the container build runs `npm ci` against a
 * lockfile with three packages), so this handles exactly the subset our documents use:
 * headings, paragraphs, hard-wrapped lines, bullet and numbered lists, tables, blockquotes,
 * fenced code, horizontal rules, links, inline code, bold and italic.
 *
 * Everything is HTML-escaped before any Markdown is applied, so a document can never inject
 * markup. Links are limited to http(s), mailto and site-relative paths.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

function safeHref(raw) {
  const href = String(raw || "").trim();
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (/^\/(?!\/)/.test(href)) return href;
  if (/^#/.test(href)) return href;
  return null;
}

function inline(text) {
  let s = esc(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const safe = safeHref(href);
    return safe ? `<a href="${esc(safe)}">${label}</a>` : label;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

const isTableSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
const cells = (line) =>
  line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const closeList = (tag) => { if (tag) out.push(`</${tag}>`); };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    if (/^\s*```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    // horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // heading
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length, 6);
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // table
    if (/\|/.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        `<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      );
      continue;
    }

    // blockquote (consecutive lines)
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(body.join("\n"))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*+]\s+/, "");
        i++;
        // continuation lines indented under the item
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+[.)]\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // paragraph: gather until blank or another block starts
    const para = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+])\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !(/\|/.test(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/** Highlight unresolved drafting markers so a draft is unmistakable. */
export function markDraftMarkers(html) {
  return html.replace(/\[(JERRY|ATTORNEY):\s*([^\]]*)\]/g, (_, who, text) =>
    `<mark class="draft-marker">${who}: ${text}</mark>`);
}
