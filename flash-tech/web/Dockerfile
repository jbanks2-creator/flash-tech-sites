FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1024
# The store's decided values are baked into the rendered page, so they must be present at
# build time. Defaults keep a test-mode build possible; STORE_LIVE=1 makes check-store
# (run by `npm run build`) refuse to continue unless every one of them is real.
ARG STORE_LIVE=0
ARG STORE_DEMO_ORIGIN=
ARG STORE_SUPPORT_EMAIL=
ARG LEMONSQUEEZY_CHECKOUT_URL=
ENV STORE_LIVE=$STORE_LIVE
ENV STORE_DEMO_ORIGIN=$STORE_DEMO_ORIGIN
ENV STORE_SUPPORT_EMAIL=$STORE_SUPPORT_EMAIL
ENV LEMONSQUEEZY_CHECKOUT_URL=$LEMONSQUEEZY_CHECKOUT_URL
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The contact form's delivery status, printed once at start (before the server accepts a single
# request) by web/scripts/report-contact-delivery.mjs. Next bundles the route's own copy of
# lib/contact-*.mjs into the server chunks, so these two files are copied explicitly for the
# startup script — same source, same build, same answers as the route.
COPY --from=builder /app/scripts/report-contact-delivery.mjs ./scripts/report-contact-delivery.mjs
COPY --from=builder /app/lib/contact-mail.mjs ./lib/contact-mail.mjs
COPY --from=builder /app/lib/contact-fields.mjs ./lib/contact-fields.mjs
EXPOSE 3000
# `exec` keeps PID 1 as the server, so `docker stop` and the tunnel's health checks behave as
# before. The report always exits 0: an unfinished mail configuration must not take the front
# door down, it must make the site refuse honestly (see docs/DEPLOY.md).
CMD ["sh", "-c", "node scripts/report-contact-delivery.mjs; exec node server.js"]
