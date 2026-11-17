/**
 * Store settings that are decided by a person, not by code.
 *
 * Everything here has a safe default so the site always renders; `scripts/check-store.mjs`
 * refuses a production build (STORE_LIVE=1) when any decided value is missing. That way the
 * page cannot quietly ship with a blank support address or a demo URL pointing at a laptop.
 */
const env = process.env;

function httpsOrLocal(url, name) {
  if (!url) return "";
  if (/^https:\/\//.test(url)) return url.replace(/\/$/, "");
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) return url.replace(/\/$/, "");
  throw new Error(`${name} must be https://… or a local http://127.0.0.1 address, got '${url}'`);
}

export const store = {
  brand: "Flash Tech",
  product: "TaskApp",
  live: env.STORE_LIVE === "1",
  testMode: env.STORE_LIVE !== "1",
  // Prices come from decision card t_e17d84e6 (2026-11-11).
  priceDownload: 49,
  priceConfigured: 99,
  supportRate: 145,
  refundDays: 14,
  supportMonths: 12,
  supportEmail: env.STORE_SUPPORT_EMAIL || "",
  demoOrigin: httpsOrLocal(env.STORE_DEMO_ORIGIN || "", "STORE_DEMO_ORIGIN"),
  checkoutConfigured: Boolean(env.LEMONSQUEEZY_CHECKOUT_URL),
  contactHref: "/apps/taskapp/inquiry",
  buyHref: "/apps/taskapp/buy",
};

export const money = (n) => `$${n}`;
