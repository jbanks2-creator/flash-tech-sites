import { NextResponse } from "next/server";

/**
 * Canonical host: `www.flashtech.biz` is a 301 to the apex.
 *
 * Two hostnames serving the same page is duplicate content on a domain the business markets,
 * so the redirect lives in the app rather than depending on a Cloudflare Redirect Rule that
 * needs dashboard access nobody has from this box. The tunnel forwards the original Host
 * header, so this works for real public traffic as well as for a direct origin check.
 *
 * `nextUrl.clone()` keeps the path and the query string, so deep links survive:
 * https://www.flashtech.biz/apps/taskapp?x=1 -> https://flashtech.biz/apps/taskapp?x=1
 */
const APEX = "flashtech.biz";

export function middleware(request) {
  const raw = request.headers.get("host") || request.headers.get("x-forwarded-host") || "";
  const hostname = raw.split(":")[0].trim().toLowerCase();

  if (hostname === `www.${APEX}`) {
    // Build the absolute URL explicitly: NextURL's `host` setter only replaces the hostname and
    // leaves the origin's internal port (:3000) on the URL, which would produce a redirect to
    // https://flashtech.biz:3000/… — a broken link for every visitor.
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(new URL(`https://${APEX}${pathname}${search}`), 301);
  }

  return NextResponse.next();
}

export const config = {
  // Every path except Next's content-hashed static assets. Those are byte-identical on both
  // hosts and are only ever requested by a page that has already been redirected, so running
  // middleware for them would add latency and buy nothing.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
