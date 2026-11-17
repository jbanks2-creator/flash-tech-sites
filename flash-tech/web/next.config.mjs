/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Cloudflare terminates TLS at the edge; a browser that has seen this over https only talks
  // https. 180 days, no includeSubDomains and no preload, so a future move to another host or a
  // subdomain that still speaks http cannot be bricked by a stale HSTS entry.
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

export default {
  output: 'standalone',
  reactStrictMode: true,
  // Stop advertising the framework version on every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
