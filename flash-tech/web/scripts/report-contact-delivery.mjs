#!/usr/bin/env node
/**
 * The contact form's delivery status, stated once at container start.
 *
 * Runs from the image's CMD before `node server.js`, so the answer to "if someone fills that form
 * in, where does it go?" is in `docker logs flash-tech-web` from the first second, instead of
 * being discovered by the first lead. The stub this replaces could only be caught by reading the
 * source or by noticing that no mail ever arrived.
 *
 * Exit code is always 0. A half-finished mail configuration must not take the company's front
 * door down — the site keeps serving, the CTA renders as the fallback address, and POST
 * /api/contact refuses with a 503 that names it. The line below is the loud part.
 */

import { describeDelivery, resolveConfig } from '../lib/contact-mail.mjs';

const config = resolveConfig();
const line = describeDelivery(config);

if (line.severity === 'critical') console.error(JSON.stringify(line));
else console.log(JSON.stringify(line));

// Never print the config object itself: it holds CONTACT_API_KEY and the SMTP password.
process.exit(0);
