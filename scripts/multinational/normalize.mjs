#!/usr/bin/env node
/**
 * normalize.mjs — turn a loose per-category research file into canonical records.
 *
 * The repeatable half of the S38 ingestion pattern (mirrors S36's normalize): a
 * researcher (human or a scoped subagent) produces
 * `sources/<category>.research.json` by reading official VA/CFR pages; this module
 * deterministically normalizes each finding into the `schema.mjs` shape.
 *
 * Raw finding contract (only `category`, `name`, `description`, `sourceUrl` are
 * required; everything else defaults):
 *   { category, name, description, keyPoints?, eligibility?, howToFile?, agency?,
 *     form?, applicationUrl?, phone?, legalCitation?, sourceUrl, sourceExcerpt?,
 *     verificationStatus? }
 */

import {
  DISPLAY_FOR_CATEGORY,
  MULTINATIONAL_AUTHORITY_TIER,
} from "./schema.mjs";

/** URL-safe slug from a provision name, for stable ids. */
function slug(s) {
  return String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
    .slice(0, 48);
}

/** One raw finding → one canonical provision. */
export function normalizeFinding(finding, category, lastVerified) {
  const status =
    finding.verificationStatus === "verified" ? "verified" : "unverified";
  return {
    id: `${category}-${slug(finding.name)}`,
    category,
    displayCategory: DISPLAY_FOR_CATEGORY[category] || category,
    name: finding.name,
    description: finding.description,
    keyPoints: Array.isArray(finding.keyPoints) ? finding.keyPoints : [],
    eligibility: finding.eligibility ?? null,
    application: {
      howToFile: finding.howToFile ?? null,
      agency: finding.agency ?? null,
      form: finding.form ?? null,
      url: finding.applicationUrl ?? null,
      phone: finding.phone ?? null,
    },
    legalCitation: finding.legalCitation ?? null,
    authorityTier: MULTINATIONAL_AUTHORITY_TIER,
    sourceUrl: finding.sourceUrl ?? null,
    lastVerified,
    verificationStatus: status,
  };
}

/** A whole research file → a canonical per-category file. */
export function normalizeCategoryFile(raw, { lastVerified }) {
  const category = raw.category;
  const provisions = (raw.findings || []).map((f) =>
    normalizeFinding(f, category, lastVerified),
  );
  // A category file is "verified" only when at least one provision is verified;
  // if none are, it stays "template" so the UI shows the pending note.
  const anyVerified = provisions.some(
    (p) => p.verificationStatus === "verified",
  );
  return {
    category,
    displayName: raw.displayName ?? DISPLAY_FOR_CATEGORY[category] ?? category,
    officialSource: raw.officialSource ?? null,
    verificationStatus: anyVerified ? "verified" : "template",
    lastVerified,
    provisions,
  };
}
