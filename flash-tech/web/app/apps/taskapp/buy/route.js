import { NextResponse } from "next/server";
import { store, money } from "@/lib/store-config.mjs";

export const dynamic = "force-dynamic";

/**
 * The single buy link. The checkout URL lives in the environment, never in the page, so the
 * page cannot ship a wrong or dead payment link and a live URL can be rotated without a
 * rebuild. Lemon Squeezy is the merchant of record (decision card t_e17d84e6): it hosts the
 * cart, collects the tax, delivers the file, the checksum and the licence key.
 *
 * With no checkout URL configured this route is a plain, customer-facing 404: there is nothing
 * to buy, and a visitor must never be shown an internal diagnostics page naming environment
 * variables or repo docs. The store page does not link here unless the store is sellable.
 */
function checkoutUrl() {
  const raw = process.env.LEMONSQUEEZY_CHECKOUT_URL || "";
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (!/(^|\.)lemonsqueezy\.com$/i.test(url.hostname)) return null;
  return url.toString();
}

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not on sale yet — TaskApp</title>
<meta name="robots" content="noindex">
<style>
  :root{--ink:#0b1220;--body:#42506b;--muted:#6b7a94;--line:#e3e8f0;--accent:#2563eb}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--body);line-height:1.6}
  .wrap{max-width:640px;margin:0 auto;padding:64px 24px}
  h1{color:var(--ink);font-size:2rem;line-height:1.15;margin:0 0 .4em}
  .chip{display:inline-block;background:#fff7e6;color:#7a4b00;border:1px solid #f2d18b;border-radius:999px;
    padding:4px 10px;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:16px}
  a.btn{display:inline-block;background:var(--accent);color:#fff;padding:12px 20px;border-radius:10px;
    font-weight:650;text-decoration:none;margin:10px 8px 0 0}
  a.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
  p{font-size:.98rem}
</style></head><body><div class="wrap">${body}</div></body></html>`;

export async function GET() {
  const url = checkoutUrl();
  if (url) {
    return NextResponse.redirect(url, 303);
  }
  return new NextResponse(
    page(`
      <span class="chip">Not on sale yet</span>
      <h1>TaskApp isn&rsquo;t on sale yet.</h1>
      <p>The store is not open, so there is no checkout here — nothing was ordered and nothing was
      charged. There is no place to enter payment details on this site at any time.</p>
      <p>You can still see what the app does, watch it work and read the questions people ask
      before buying. If you want an email the day it goes on sale, ask us.</p>
      <p>
        <a class="btn" href="/apps/taskapp">See TaskApp</a>
        <a class="btn ghost" href="${store.contactHref}">Ask to be told when it opens</a>
      </p>
      <p style="color:var(--muted);font-size:.85rem">Planned price: ${money(store.priceDownload)}
      for the download. Nothing is charged today.</p>
    `),
    { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
