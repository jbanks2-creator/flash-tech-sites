import { NextResponse } from "next/server";
import { store, money } from "@/lib/store-config.mjs";

export const dynamic = "force-dynamic";

/**
 * The single buy link. The checkout URL lives in the environment, never in the page, so the
 * page cannot ship a wrong or dead payment link and a live URL can be rotated without a
 * rebuild. Lemon Squeezy is the merchant of record (decision card t_e17d84e6): it hosts the
 * cart, collects the tax, delivers the file, the checksum and the licence key.
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
<title>Checkout — TaskApp</title>
<meta name="robots" content="noindex">
<style>
  :root{--ink:#0b1220;--body:#42506b;--muted:#6b7a94;--line:#e3e8f0;--accent:#2563eb}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--body);line-height:1.6}
  .wrap{max-width:680px;margin:0 auto;padding:64px 24px}
  h1{color:var(--ink);font-size:2rem;line-height:1.15;margin:0 0 .4em}
  .chip{display:inline-block;background:#fff7e6;color:#7a4b00;border:1px solid #f2d18b;border-radius:999px;
    padding:4px 10px;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:16px}
  a.btn{display:inline-block;background:var(--accent);color:#fff;padding:12px 20px;border-radius:10px;
    font-weight:650;text-decoration:none;margin-top:10px}
  code{background:#f3f5f9;border-radius:5px;padding:1px 5px}
  p{font-size:.98rem}
  ul{font-size:.95rem}
</style></head><body><div class="wrap">${body}</div></body></html>`;

export async function GET() {
  const url = checkoutUrl();
  if (url) {
    return NextResponse.redirect(url, 303);
  }
  return new NextResponse(
    page(`
      <span class="chip">Test mode</span>
      <h1>Checkout is not connected on this host yet.</h1>
      <p>This build is running in test mode: the page is real, but the Lemon Squeezy checkout URL
      has not been set, so there is nothing to charge and nothing to promise.</p>
      <p>To finish the test-mode purchase, the store needs its Lemon Squeezy test product and its
      checkout URL in <code>LEMONSQUEEZY_CHECKOUT_URL</code>. That is one environment variable and
      no code change — see <code>docs/STORE-DEPLOY.md</code>.</p>
      <p><b>Nothing was charged.</b> No payment details are collected on this site at any point:
      the merchant of record hosts the cart, the tax and the card form.</p>
      <p><a class="btn" href="/apps/taskapp">Back to TaskApp — ${money(store.priceDownload)}</a></p>
      <p style="color:var(--muted);font-size:.85rem">If you are a buyer seeing this, email the address on
      your receipt or use the contact form and we will send a working link.</p>
    `),
    { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
