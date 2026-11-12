/**
 * The Author's Candle Starter questionnaire — fields, caps, and the flat-answer → intake.json
 * mapping.
 *
 * One source of truth for three callers:
 *   app/startups/authors/intake/IntakeForm.jsx   the browser form (caps + word counts)
 *   app/api/authors-intake/route.js              the handler (validation + storage)
 *   ~/businesses/author-marketing/intake/schema.json   the record it must satisfy
 *
 * The record this module builds must validate against that schema with zero errors, because
 * scripts/validate_intake.py runs on it unchanged. Everything the schema cannot express — 80 words
 * per writing sample, 600 in total, 2 or 3 samples, exactly one [MIDPOINT] — is checked in
 * checkAnswers() and re-derived by the pipeline validator, which is the authority.
 *
 * Question copy is NOT here: it lives in IntakeForm.jsx, worded from
 * ~/businesses/author-marketing/intake/questionnaire.html. This file only knows names and limits.
 */

/** Longest short answer (names, titles, handles, one-line selections). */
export const SHORT = 200;
/** Longest free-text answer (prose boxes, one per answer). */
export const LONG = 4000;
/** Honeypot input name. Bots fill a field called "website"; the real site field is website_url. */
export const HONEYPOT = "website";
/** A single submission cannot exceed this, so nobody can fill the disk with one request. */
export const MAX_BODY_BYTES = 512 * 1024;

export const PACKAGE = "starter";
export const INTAKE_VERSION = "starter-v1";

/**
 * The `$id` of the schema this build collects answers for (see intake/schema.json).
 *
 * The form and the record are written against ONE version of that file. When the mounted schema
 * declares a different `$id`, route.js logs it — a schema change must be a deliberate code change
 * here, never something a submission quietly falls out of step with.
 */
export const SCHEMA_ID = "intake-starter-v1";

/**
 * Cover image + approved voice-over line — the two fields the cover-video product needs
 * (kanban card t_7487852d, owner: ops). OFF until that card lands the fields in
 * intake/schema.json, because the record refuses fields it does not know
 * (`additionalProperties: false`) and the form must never show a box whose answer is dropped.
 *
 * To switch on, in this order:
 *   1. copy the exact field names from the landed schema — do NOT guess them,
 *   2. set them here (buildIntake, marked TODO) and on the page (IntakeForm, marked TODO),
 *   3. bump INTAKE_VERSION / SCHEMA_ID to the schema's new `$id`,
 *   4. set INTAKE_COVER_VO=on in compose.yaml and rebuild web.
 */
export const COVER_VO_ENABLED = clean(process.env.INTAKE_COVER_VO) === "on";

export const BOOK_TYPES = ["fiction", "nonfiction"];
export const BOOK_STATUS = ["drafting", "pre-launch", "published"];
export const PLATFORMS = ["Amazon KDP", "IngramSpark", "Draft2Digital", "Other"];
export const DISTRIBUTIONS = ["exclusive", "wide"];
export const SOCIAL_PLATFORMS = ["Facebook", "Instagram", "LinkedIn", "X", "TikTok", "Threads", "Bluesky", "YouTube", "Other"];
export const PRIMARY_GOALS = ["sales", "reviews", "list growth", "podcast guesting", "speaking", "clients"];
export const BUDGET_BANDS = ["$0", "under $100/mo", "$100-500/mo", "$500-2,000/mo", "over $2,000/mo"];

export const MIN_SAMPLE_WORDS = 80;
export const MIN_TOTAL_WORDS = 600;
export const MIN_SAMPLES = 2;
export const MAX_SAMPLES = 3;
export const MIN_THEMES = 3;
export const MAX_THEMES = 5;
export const MIN_CREDENTIALS = 1;
export const MAX_CREDENTIALS = 3;
export const MIN_TALKING_POINTS = 3;
export const MAX_TALKING_POINTS = 5;

/**
 * Every answer the form posts, with its cap in characters. Two caps only, on purpose: 200 for
 * anything a person types into a one-line box, 4,000 for prose. The handler refuses a field over
 * its cap instead of quietly cutting the end off somebody's writing.
 */
export const LIMITS = Object.freeze({
  // 1. About you
  legal_name: SHORT, public_name: SHORT, email: SHORT, country_timezone: SHORT, pronouns: SHORT,
  location_publishable: SHORT, phone: SHORT, assistant_contact: SHORT,
  // 2. About you as an author
  genre_or_field: SHORT, one_sentence_identity: LONG, cred1: SHORT, cred2: SHORT, cred3: SHORT,
  current_bio: LONG, origin_story: LONG, awards_media: LONG, education: SHORT,
  personal_details_publishable: LONG, do_not_mention: LONG, other_titles: LONG, protected_spellings: LONG,
  // 3. Writing samples
  sample1_title: SHORT, sample1_text: LONG, sample2_title: SHORT, sample2_text: LONG,
  sample3_title: SHORT, sample3_text: LONG,
  // 4. Your book
  book_title: SHORT, book_subtitle: SHORT, series_name: SHORT, series_number: SHORT, sequels_confirmed: LONG,
  book_type: SHORT, genre_category: SHORT, book_status: SHORT, publication_date: SHORT, premise: LONG,
  theme1: SHORT, theme2: SHORT, theme3: SHORT, theme4: SHORT, theme5: SHORT,
  plot_summary: LONG, reveal_limit: LONG, nonfiction_summary: LONG, book_tone: SHORT,
  platform_kdp: SHORT, platform_ingram: SHORT, platform_d2d: SHORT, platform_other: SHORT,
  distribution: SHORT, isbn: SHORT, page_count: SHORT, formats: SHORT, price: SHORT,
  retailer_links: LONG, comparable_titles: SHORT,
  review1_quote: LONG, review1_source: SHORT, review1_permission: SHORT,
  review2_quote: LONG, review2_source: SHORT, review2_permission: SHORT,
  content_warnings: SHORT,
  // 5. Your readers
  ideal_reader: LONG, problem_or_desire: LONG, where_spend_time: LONG, demographics: SHORT,
  authors_shows_followed: LONG, email_list_size: SHORT,
  // 6. Website
  has_website: SHORT, website_url: SHORT, lead_magnet: LONG,
  // 7. Social media
  social1_platform: SHORT, social1_handle: SHORT, social2_platform: SHORT, social2_handle: SHORT,
  social3_platform: SHORT, social3_handle: SHORT,
  post_platforms: SHORT, posting_frequency: SHORT, top_posts: LONG, refused_platforms: SHORT,
  tone_preferences: LONG,
  // 8. Goals and podcast topics
  primary_goal: SHORT, secondary_goals: SHORT, hours_per_week: SHORT, budget_band: SHORT,
  talking1: SHORT, talking2: SHORT, talking3: SHORT, talking4: SHORT, talking5: SHORT,
  cta_action: SHORT, cta_link: SHORT, tried_before: LONG, podcasts_wanted: LONG, peers_admired: LONG,
  // 9. Confirmations
  consent_facts: SHORT, consent_ai: SHORT, consent_images: SHORT,
});

/** Human names for error messages that are about a flat form answer. */
const NAMES = {
  legal_name: "Legal name", public_name: "Name as it should appear on your book", email: "Email",
  country_timezone: "Country and time zone", pronouns: "Pronouns", location_publishable: "City or region",
  phone: "Phone", assistant_contact: "Assistant or publicist contact",
  genre_or_field: "Genre or field", one_sentence_identity: "Who you are in one sentence",
  cred1: "Credential 1", cred2: "Credential 2", cred3: "Credential 3", current_bio: "Current author bio",
  origin_story: "Your story as a writer", awards_media: "Awards, media features and interviews",
  education: "Education", personal_details_publishable: "Personal details to publish",
  do_not_mention: "Off-limits topics", other_titles: "Other published books",
  protected_spellings: "Words to spell exactly as you do",
  sample1_title: "Writing sample 1 title", sample1_text: "Writing sample 1",
  sample2_title: "Writing sample 2 title", sample2_text: "Writing sample 2",
  sample3_title: "Writing sample 3 title", sample3_text: "Writing sample 3",
  book_title: "Book title", book_subtitle: "Subtitle", series_name: "Series name",
  series_number: "Book number in the series", sequels_confirmed: "What we may say about future books",
  book_type: "Fiction or nonfiction", genre_category: "Genre and category", book_status: "Book status",
  publication_date: "Publication or launch date", premise: "The book in one paragraph",
  theme1: "Theme 1", theme2: "Theme 2", theme3: "Theme 3", theme4: "Theme 4", theme5: "Theme 5",
  plot_summary: "Full plot summary", reveal_limit: "Never to be revealed", nonfiction_summary: "Chapter list or summary",
  book_tone: "Tone of the book", distribution: "Exclusive or wide", isbn: "ISBN",
  platform_kdp: "Where it's published", platform_ingram: "Where it's published",
  platform_d2d: "Where it's published", platform_other: "Where it's published",
  page_count: "Page count", formats: "Formats", price: "Price", retailer_links: "Retailer links",
  comparable_titles: "Comparable books or authors",
  review1_quote: "Review 1 quote", review1_source: "Review 1 source", review1_permission: "Review 1 permission",
  review2_quote: "Review 2 quote", review2_source: "Review 2 source", review2_permission: "Review 2 permission",
  content_warnings: "Content warnings",
  ideal_reader: "Ideal reader", problem_or_desire: "What draws readers to the book",
  where_spend_time: "Where readers spend time", demographics: "Reader details",
  authors_shows_followed: "Authors, shows and podcasts readers follow", email_list_size: "Email list size",
  has_website: "Do you have a website", website_url: "Website address", lead_magnet: "Free offer for readers",
  social1_platform: "Platform 1", social1_handle: "Handle 1", social2_platform: "Platform 2",
  social2_handle: "Handle 2", social3_platform: "Platform 3", social3_handle: "Handle 3",
  post_platforms: "Platforms for the posts", posting_frequency: "Follower counts and posting frequency",
  top_posts: "Posts that did well", refused_platforms: "Platforms you won't use",
  tone_preferences: "Tone preferences",
  primary_goal: "Number-one goal", secondary_goals: "Other goals", hours_per_week: "Hours per week",
  budget_band: "Monthly marketing budget", talking1: "Podcast topic 1", talking2: "Podcast topic 2",
  talking3: "Podcast topic 3", talking4: "Podcast topic 4", talking5: "Podcast topic 5",
  cta_action: "Call to action", cta_link: "Call-to-action link", tried_before: "Marketing you've tried",
  podcasts_wanted: "Podcasts you'd love to be on", peers_admired: "Authors whose marketing you admire",
  consent_facts: "Facts are accurate", consent_ai: "AI drafting understood", consent_images: "Image rights",
};

/** Human names for the record's own paths, used to translate schema errors. */
const PATH_NAMES = {
  meta: "Submission details", "meta.job_id": "Job id", "meta.package": "Package",
  "meta.intake_version": "Intake version", "meta.submitted_date": "Submission date",
  personal: "About you", author: "About you as an author", "author.writing_samples": "Writing samples",
  "author.credentials": "Credentials", "author.protected_spellings": "Protected spellings",
  "author.other_titles": "Other published books", "author.awards_media": "Awards and media",
  book: "Your book", "book.plot_summary": "Full plot summary", "book.nonfiction_summary": "Chapter list or summary",
  "book.themes": "Themes", "book.platform": "Where it's published", "book.publication_date": "Publication date",
  "book.reviews_endorsements": "Reviews and endorsements", "book.retailer_links": "Retailer links",
  audience: "Your readers", "audience.where_they_spend_time": "Where readers spend time",
  website: "Website", "website.url": "Website address", social: "Social media",
  "social.active_platforms": "Social platforms and handles", marketing: "Goals and podcast topics",
  "marketing.talking_points": "Podcast topics", "marketing.call_to_action": "Call to action",
  "marketing.call_to_action.link": "Call-to-action link", "marketing.budget_band": "Monthly budget",
  "marketing.primary_goal": "Number-one goal", consent: "Confirmations",
  "consent.facts_accurate": "Facts are accurate", "consent.ai_disclosure_understood": "AI drafting understood",
  "consent.image_rights": "Image rights",
};

/** The label the browser shows for a flat answer, or a readable fallback made from the key. */
export function nameOf(field) {
  return NAMES[field] || field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/* ---------------------------------------------------------------------------------------------
 * Values
 * ------------------------------------------------------------------------------------------- */

/** Trim, normalise newlines, drop control characters. Never truncates — see route.js. */
export function clean(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

const checked = (value) => ["on", "true", "yes", "1"].includes(clean(value).toLowerCase());
const blank = (value) => !clean(value);
const numberOr = (value, fallback = Number.NaN) => {
  const text = clean(value).replace(/[\s,]/g, "");
  return text ? Number(text) : fallback;
};
const asInt = (value) => {
  const n = numberOr(value);
  return Number.isInteger(n) ? n : Number.NaN;
};
const listBy = (text, separator) => clean(text).split(separator).map((s) => s.trim()).filter(Boolean);
const lines = (value) => listBy(value, "\n");
const commas = (value) => listBy(value, /[,\n]/);
/** Posts are prose: a blank line separates one from the next, so a single pasted post stays whole. */
const paragraphs = (value) => clean(value).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

const URL_RE = /https?:\/\/[^\s)\]>"']+/g;
const WORD_RE = /[A-Za-z0-9\u00C0-\u024F]+(?:['\u2019-][A-Za-z0-9\u00C0-\u024F]+)*/g;

/** Word count that matches scripts/common.py: a URL counts as one word. */
export function wordCount(value) {
  const text = String(value ?? "");
  const urls = text.match(URL_RE) || [];
  return (text.replace(URL_RE, " ").match(WORD_RE) || []).length + urls.length;
}

const isHttpUrl = (value) => /^https?:\/\/\S+$/.test(clean(value));
const isEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(clean(value));
const isDate = (value) => {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === text;
};

/** job_id: the author's public name as a slug, plus a short random suffix. */
export function makeJobId(publicName, random = Math.random) {
  const slug = clean(publicName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "") || "author";
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 5; i += 1) suffix += alphabet[Math.floor(random() * alphabet.length)];
  return `${slug}-${suffix}`;
}

export function samplesFrom(raw) {
  return [1, 2, 3]
    .map((i) => ({ title: clean(raw[`sample${i}_title`]), text: clean(raw[`sample${i}_text`]) }))
    .filter((sample) => sample.title || sample.text);
}

export function platformsFrom(raw) {
  return [
    ["platform_kdp", "Amazon KDP"],
    ["platform_ingram", "IngramSpark"],
    ["platform_d2d", "Draft2Digital"],
    ["platform_other", "Other"],
  ].filter(([key]) => checked(raw[key])).map(([, name]) => name);
}

export function socialFrom(raw) {
  return [1, 2, 3]
    .map((i) => ({ platform: clean(raw[`social${i}_platform`]), handle: clean(raw[`social${i}_handle`]) }))
    .filter((row) => row.platform || row.handle);
}

export function reviewsFrom(raw) {
  return [1, 2]
    .map((i) => ({
      quote: clean(raw[`review${i}_quote`]),
      source: clean(raw[`review${i}_source`]),
      permission_confirmed: checked(raw[`review${i}_permission`]),
    }))
    .filter((review) => review.quote || review.source);
}

/** "none" is how the questionnaire invites an author to say there is nothing to say. */
const noneToEmpty = (value) => (["none", "n/a", "na", "-"].includes(clean(value).toLowerCase()) ? "" : clean(value));

/**
 * Flat answers → the Starter intake record.
 *
 * `jobId` and `submittedDate` come from the handler (YYYY-MM-DD, UTC). Blank optional answers are
 * omitted rather than written as empty strings; the two fields the schema wants as "" when there is
 * nothing to say (book.subtitle, author.current_bio) always appear.
 */
export function buildIntake(raw, { jobId, submittedDate }) {
  const t = (key) => clean(raw[key]);
  const samples = samplesFrom(raw).map(({ title, text }) => ({ title, text }));
  const credentials = ["cred1", "cred2", "cred3"].map(t).filter(Boolean);
  const themes = ["theme1", "theme2", "theme3", "theme4", "theme5"].map(t).filter(Boolean);
  const talking = ["talking1", "talking2", "talking3", "talking4", "talking5"].map(t).filter(Boolean);
  const fiction = t("book_type") === "fiction";

  const book = {
    title: t("book_title"),
    subtitle: noneToEmpty(raw.book_subtitle),
    ...(t("series_name") ? { series_name: t("series_name") } : {}),
    ...(Number.isInteger(asInt(raw.series_number)) ? { series_number: asInt(raw.series_number) } : {}),
    ...(t("sequels_confirmed") ? { sequels_confirmed: t("sequels_confirmed") } : {}),
    book_type: t("book_type"),
    genre_category: t("genre_category"),
    status: t("book_status"),
    publication_date: t("publication_date"),
    premise: t("premise"),
    themes,
    ...(fiction && t("plot_summary") ? { plot_summary: t("plot_summary") } : {}),
    ...(fiction && t("reveal_limit") ? { reveal_limit: t("reveal_limit") } : {}),
    ...(!fiction && t("nonfiction_summary") ? { nonfiction_summary: t("nonfiction_summary") } : {}),
    ...(t("book_tone") ? { book_tone: t("book_tone") } : {}),
    platform: platformsFrom(raw),
    distribution: t("distribution"),
    ...(t("isbn") ? { isbn: t("isbn") } : {}),
    ...(Number.isInteger(asInt(raw.page_count)) ? { page_count: asInt(raw.page_count) } : {}),
    ...(commas(t("formats")).length ? { formats: commas(t("formats")) } : {}),
    ...(t("price") ? { price: t("price") } : {}),
    ...(lines(t("retailer_links")).length ? { retailer_links: lines(t("retailer_links")) } : {}),
    ...(commas(t("comparable_titles")).length ? { comparable_titles: commas(t("comparable_titles")) } : {}),
    ...(reviewsFrom(raw).length ? { reviews_endorsements: reviewsFrom(raw) } : {}),
    ...(t("content_warnings") ? { content_warnings: t("content_warnings") } : {}),
  };

  // TODO(t_7487852d): the cover image (retailer URL + permission to use it) and the approved
  // voice-over line attach HERE, inside `book` — beside cover_file, the field the schema already
  // has reserved for a cover. They are deliberately not written yet: the mounted schema declares
  // `additionalProperties: false`, so writing a name it does not know turns every submission into
  // a refusal. When ops lands the fields in intake/schema.json:
  //   - copy the names verbatim from that file (do not guess them),
  //   - add them to LIMITS above (short-cap the URL/permission, 4,000-cap the voice-over line),
  //   - write them here under `COVER_VO_ENABLED`, and read them in the route's `raw` map,
  //   - add the inputs to IntakeForm.jsx (section 4, marked TODO there).
  // A low-resolution cover is a needs-human flag for the renderer, never a hard stop: do not add a
  // check that refuses a submission over it.
  if (COVER_VO_ENABLED) {
    // Intentionally empty until the schema lands. Anything written here without the schema's
    // own field names would be refused by the validator and lose the author's answers.
  }

  const marketing = {
    primary_goal: t("primary_goal"),
    ...(commas(t("secondary_goals")).length ? { secondary_goals: commas(t("secondary_goals")) } : {}),
    hours_per_week: numberOr(raw.hours_per_week, 0),
    budget_band: t("budget_band"),
    talking_points: talking,
    call_to_action: { action: t("cta_action"), link: t("cta_link") },
    ...(t("tried_before") ? { tried_before: t("tried_before") } : {}),
    ...(lines(t("podcasts_wanted")).length ? { podcasts_wanted: lines(t("podcasts_wanted")) } : {}),
    ...(lines(t("peers_admired")).length ? { peers_admired: lines(t("peers_admired")) } : {}),
  };

  const website = checked(t("has_website"))
    ? {
        has_website: true,
        ...(t("website_url") ? { url: t("website_url") } : {}),
        ...(t("lead_magnet") ? { lead_magnet: t("lead_magnet") } : {}),
      }
    : { has_website: false, ...(t("lead_magnet") ? { lead_magnet: t("lead_magnet") } : {}) };

  const activePlatforms = socialFrom(raw)
    .filter((row) => row.handle)
    .map((row) => ({ platform: row.platform || "Other", handle: row.handle }));

  return {
    meta: {
      job_id: jobId,
      package: PACKAGE,
      intake_version: INTAKE_VERSION,
      submitted_date: submittedDate,
      is_sample: false,
    },
    personal: {
      legal_name: t("legal_name"),
      public_name: t("public_name"),
      email: t("email"),
      country_timezone: t("country_timezone"),
      pronouns: t("pronouns"),
      ...(t("location_publishable") ? { location_publishable: t("location_publishable") } : {}),
      ...(t("phone") ? { phone: t("phone") } : {}),
      ...(t("assistant_contact") ? { assistant_contact: t("assistant_contact") } : {}),
    },
    author: {
      genre_or_field: t("genre_or_field"),
      one_sentence_identity: t("one_sentence_identity"),
      credentials,
      current_bio: noneToEmpty(raw.current_bio),
      writing_samples: samples,
      ...(t("origin_story") ? { origin_story: t("origin_story") } : {}),
      ...(lines(t("awards_media")).length ? { awards_media: lines(t("awards_media")).map((text) => ({ text })) } : {}),
      ...(t("education") ? { education: t("education") } : {}),
      ...(t("personal_details_publishable") ? { personal_details_publishable: t("personal_details_publishable") } : {}),
      ...(lines(t("do_not_mention")).length ? { do_not_mention: lines(t("do_not_mention")) } : {}),
      ...(lines(t("other_titles")).length ? { other_titles: lines(t("other_titles")) } : {}),
      ...(lines(t("protected_spellings")).length ? { protected_spellings: lines(t("protected_spellings")) } : {}),
    },
    book,
    audience: {
      ideal_reader: t("ideal_reader"),
      problem_or_desire: t("problem_or_desire"),
      where_they_spend_time: commas(t("where_spend_time")),
      ...(t("demographics") ? { demographics: t("demographics") } : {}),
      ...(lines(t("authors_shows_followed")).length ? { authors_shows_followed: lines(t("authors_shows_followed")) } : {}),
      ...(Number.isInteger(asInt(raw.email_list_size)) ? { email_list_size: asInt(raw.email_list_size) } : {}),
    },
    website,
    social: {
      active_platforms: activePlatforms,
      ...(commas(t("post_platforms")).length ? { post_platforms: commas(t("post_platforms")) } : {}),
      ...(t("posting_frequency") ? { posting_frequency: t("posting_frequency") } : {}),
      ...(paragraphs(t("top_posts")).length ? { top_posts: paragraphs(t("top_posts")) } : {}),
      ...(commas(t("refused_platforms")).length ? { refused_platforms: commas(t("refused_platforms")) } : {}),
      ...(t("tone_preferences") ? { tone_preferences: t("tone_preferences") } : {}),
    },
    marketing,
    consent: {
      facts_accurate: checked(raw.consent_facts),
      ai_disclosure_understood: checked(raw.consent_ai),
      image_rights: checked(raw.consent_images),
      consent_date: submittedDate,
    },
  };
}

/* ---------------------------------------------------------------------------------------------
 * Checks
 * ------------------------------------------------------------------------------------------- */

/**
 * Everything that must be true before a submission is worth writing down. Returns plain-English
 * problems, each naming the field it is about; an empty array means the answers are complete.
 * Ordered as the form is, so the first problem is the one nearest the top of the page.
 */
export function checkAnswers(raw) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, label: nameOf(field), message });
  const failAs = (label, message, field = "") => errors.push({ field, label, message });
  const req = (field) => { if (blank(raw[field])) fail(field, "is required."); };
  const tooLong = (field) => {
    const limit = LIMITS[field];
    const length = clean(raw[field]).length;
    if (length > limit) fail(field, `is ${length.toLocaleString("en-US")} characters; the limit is ${limit.toLocaleString("en-US")}. Please shorten it.`);
  };

  for (const [field, limit] of Object.entries(LIMITS)) {
    if (clean(raw[field]).length > limit) tooLong(field);
  }

  // 1. About you
  req("legal_name"); req("public_name"); req("email"); req("country_timezone"); req("pronouns");
  if (!blank(raw.email) && !isEmail(raw.email)) fail("email", "should look like name@example.com.");

  // 2. About you as an author
  req("genre_or_field"); req("one_sentence_identity");
  if (["cred1", "cred2", "cred3"].every((k) => blank(raw[k]))) fail("cred1", "is required: add at least one credential or life experience.");
  if (blank(raw.current_bio)) fail("current_bio", "is required; write \"none\" if you don't have one yet.");

  // 3. Writing samples
  const samples = samplesFrom(raw);
  if (samples.length < MIN_SAMPLES) {
    fail("sample1_text", `needs ${MIN_SAMPLES} samples; you have ${samples.length}. Every sample needs a title and its text.`);
  }
  if (samples.length > MAX_SAMPLES) fail("sample3_text", `allows ${MAX_SAMPLES} samples at most.`);
  samples.forEach((sample, i) => {
    const n = i + 1;
    if (!sample.title) fail(`sample${n}_title`, "is required for each sample you paste.");
    if (!sample.text) fail(`sample${n}_text`, "is required for each sample you start.");
    const count = wordCount(sample.text);
    if (sample.text && count < MIN_SAMPLE_WORDS) {
      fail(`sample${n}_text`, `has ${count} word${count === 1 ? "" : "s"}; each sample needs at least ${MIN_SAMPLE_WORDS}.`);
    }
  });
  const total = samples.reduce((sum, sample) => sum + wordCount(sample.text), 0);
  if (samples.length && total < MIN_TOTAL_WORDS) {
    failAs("Writing samples", `need ${MIN_TOTAL_WORDS} words in total across ${MIN_SAMPLES} or ${MAX_SAMPLES} samples; they currently hold ${total}.`, "sample1_text");
  }

  // 4. Your book
  req("book_title");
  if (blank(raw.book_subtitle)) fail("book_subtitle", "is required; write \"none\" if the book has no subtitle.");
  if (!BOOK_TYPES.includes(clean(raw.book_type))) fail("book_type", "is required: choose fiction or nonfiction.");
  req("genre_category");
  if (!BOOK_STATUS.includes(clean(raw.book_status))) fail("book_status", "is required: choose drafting, pre-launch or published.");
  if (blank(raw.publication_date)) fail("publication_date", "is required.");
  else if (!isDate(raw.publication_date)) fail("publication_date", "should be a real date, in the form YYYY-MM-DD.");
  req("premise");
  const themes = ["theme1", "theme2", "theme3", "theme4", "theme5"].map((k) => clean(raw[k])).filter(Boolean);
  if (themes.length < MIN_THEMES) fail("theme1", `needs at least ${MIN_THEMES} themes; you have ${themes.length}.`);
  if (themes.length > MAX_THEMES) fail("theme5", `allows ${MAX_THEMES} themes at most.`);
  if (clean(raw.book_type) === "fiction") {
    if (blank(raw.plot_summary)) fail("plot_summary", "is required for fiction: tell us the whole story, ending included.");
    else {
      const marks = (clean(raw.plot_summary).match(/\[MIDPOINT\]/g) || []).length;
      if (marks === 0) fail("plot_summary", "needs the marker [MIDPOINT] where the middle of the story falls.");
      if (marks > 1) fail("plot_summary", "has more than one [MIDPOINT] marker; there should be exactly one.");
    }
  }
  if (clean(raw.book_type) === "nonfiction" && blank(raw.nonfiction_summary)) {
    fail("nonfiction_summary", "is required for nonfiction: paste your chapter list or a detailed summary.");
  }
  if (!platformsFrom(raw).length) fail("platform_kdp", "is required: tick at least one.");
  if (!DISTRIBUTIONS.includes(clean(raw.distribution))) fail("distribution", "is required: choose Amazon-exclusive or sold wide.");
  if (!blank(raw.page_count) && !(Number.isInteger(asInt(raw.page_count)) && asInt(raw.page_count) > 0)) {
    fail("page_count", "should be a whole number of pages.");
  }
  for (const link of lines(raw.retailer_links)) {
    if (!isHttpUrl(link)) fail("retailer_links", `has a line that is not a link: "${link.slice(0, 60)}". Each line should start with http:// or https://.`);
  }
  [1, 2].forEach((n) => {
    const quote = clean(raw[`review${n}_quote`]);
    const source = clean(raw[`review${n}_source`]);
    if (quote && !source) fail(`review${n}_source`, "is required when you paste a quote: say who said it.");
    if (source && !quote) fail(`review${n}_quote`, "is required when you give a source: paste what they said.");
  });

  // 5. Your readers
  req("ideal_reader"); req("problem_or_desire"); req("where_spend_time");
  if (!blank(raw.email_list_size) && !(Number.isInteger(asInt(raw.email_list_size)) && asInt(raw.email_list_size) >= 0)) {
    fail("email_list_size", "should be a whole number (0 if you don't have a list).");
  }

  // 6. Website
  const hasWebsite = checked(raw.has_website);
  if (blank(raw.has_website)) fail("has_website", "is required: yes or no.");
  else if (!["yes", "no"].includes(clean(raw.has_website))) fail("has_website", "should be yes or no.");
  if (hasWebsite && blank(raw.website_url)) fail("website_url", "is required because you said you have a website.");
  if (!blank(raw.website_url) && !isHttpUrl(raw.website_url)) fail("website_url", "should start with http:// or https://.");

  // 7. Social media
  const social = socialFrom(raw);
  if (!social.some((row) => row.handle)) failAs("Social platforms", "need at least one platform and the handle you use there.");
  [1, 2, 3].forEach((n) => {
    const platform = clean(raw[`social${n}_platform`]);
    const handle = clean(raw[`social${n}_handle`]);
    if (handle && !platform) fail(`social${n}_platform`, "is required when you give a handle.");
    else if (handle && !SOCIAL_PLATFORMS.includes(platform)) fail(`social${n}_platform`, "must be one of the platforms in the list.");
    else if (platform && !handle) fail(`social${n}_handle`, "is required when you choose a platform.");
  });

  // 8. Goals and podcast topics
  if (!PRIMARY_GOALS.includes(clean(raw.primary_goal))) fail("primary_goal", "is required: choose your number-one goal.");
  if (blank(raw.hours_per_week)) fail("hours_per_week", "is required.");
  else {
    const hours = numberOr(raw.hours_per_week);
    if (!Number.isFinite(hours) || hours < 0) fail("hours_per_week", "should be a number of hours, like 3 or 2.5.");
    else if (hours > 168) fail("hours_per_week", "cannot be more than the 168 hours in a week.");
  }
  if (!BUDGET_BANDS.includes(clean(raw.budget_band))) fail("budget_band", "is required: choose a monthly budget band.");
  const talking = ["talking1", "talking2", "talking3", "talking4", "talking5"].map((k) => clean(raw[k])).filter(Boolean);
  if (talking.length < MIN_TALKING_POINTS) fail("talking1", `needs at least ${MIN_TALKING_POINTS} topics; you have ${talking.length}.`);
  if (talking.length > MAX_TALKING_POINTS) fail("talking5", `allows ${MAX_TALKING_POINTS} topics at most.`);
  req("cta_action");
  if (blank(raw.cta_link)) fail("cta_link", "is required: the link readers should follow.");
  else if (!isHttpUrl(raw.cta_link)) fail("cta_link", "should start with http:// or https://.");

  // 9. Confirmations
  if (!checked(raw.consent_facts)) fail("consent_facts", "must be ticked before you send.");
  if (!checked(raw.consent_ai)) fail("consent_ai", "must be ticked before you send.");
  if (!checked(raw.consent_images)) fail("consent_images", "must be ticked before you send.");

  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.field}|${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Translate a JSON Schema error into the same {field, label, message} shape. */
export function describeSchemaErrors(schemaErrors) {
  const friendly = {
    enum: (e) => `must be one of: ${(e.params.allowedValues || []).join(", ")}.`,
    const: () => "has an unexpected value.",
    pattern: (e) => (String(e.schemaPath).includes("url") ? "should start with http:// or https://." : "is not in the expected format."),
    format: (e) => (e.params.format === "date" ? "should be a date like 2027-03-01." : `should be a valid ${e.params.format}.`),
    type: (e) => `should be ${e.params.type === "array" ? "a list" : `a ${e.params.type}`}.`,
    minItems: (e) => `needs at least ${e.params.limit} entr${e.params.limit === 1 ? "y" : "ies"}.`,
    maxItems: (e) => `allows at most ${e.params.limit} entries.`,
    minLength: (e) => "is too short.",
    minimum: (e) => `should be at least ${e.params.limit}.`,
    maximum: (e) => `should be at most ${e.params.limit}.`,
    additionalProperties: (e) => `contains an unexpected field "${e.params.additionalProperty}".`,
  };
  return schemaErrors.map((error) => {
    const path = String(error.instancePath || "").replace(/^\//, "").split("/").filter(Boolean).join(".");
    if (error.keyword === "required") {
      const field = path ? `${path}.${error.params.missingProperty}` : error.params.missingProperty;
      return { field, label: PATH_NAMES[field] || nameOf(field.split(".").pop()), message: "is required." };
    }
    const parent = path.replace(/\.(writing_samples|credentials|themes|talking_points|platform|active_platforms|reviews_endorsements|where_they_spend_time)(\.\d+)?.*$/, ".$1");
    const label = PATH_NAMES[path] || PATH_NAMES[parent] || PATH_NAMES[path.split(".").slice(0, 2).join(".")]
      || nameOf(path.split(".").pop() || "record");
    const message = friendly[error.keyword] ? friendly[error.keyword](error) : error.message;
    return { field: path, label, message };
  });
}
