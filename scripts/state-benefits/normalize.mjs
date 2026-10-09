#!/usr/bin/env node
/**
 * normalize.mjs — turn a loose per-state research file into canonical records.
 *
 * This is the repeatable half of the S36 ingestion pattern: a researcher (human
 * or a scoped subagent) produces `sources/<code>.research.json` by reading
 * official state sites; this module deterministically normalizes that into the
 * `schema.mjs` shape. Adding a state in S37 is "write a research file, run the
 * build" — no bespoke per-state code.
 *
 * Raw finding contract (only `benefitType`, `name`, `description`, `sourceUrl`
 * are required; everything else defaults):
 *   { benefitType, name, description, value?, estimatedAnnualValue?,
 *     minRating?, maxRating?, isPermanentTotal?, residencyRequired?, otherReqs?,
 *     agency?, form?, applicationUrl?, documentation?, legalCitation?,
 *     sourceUrl, sourceExcerpt?, verificationStatus? }
 */

import { CATEGORY_FOR_TYPE, STATE_BENEFIT_AUTHORITY_TIER } from "./schema.mjs";

/** URL-safe slug from a benefit name, for stable ids. */
function slug(s) {
  // Split on runs of non-alphanumerics and rejoin — drops leading/trailing and
  // collapsed separators without an anchored/backtracking-prone regex.
  return String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
    .slice(0, 48);
}

/** One raw finding → one canonical benefit. */
export function normalizeFinding(finding, stateCode, lastVerified) {
  const type = finding.benefitType;
  const status =
    finding.verificationStatus === "verified" ? "verified" : "unverified";
  return {
    id: `${stateCode.toLowerCase()}-${type}-${slug(finding.name)}`,
    benefitType: type,
    category: CATEGORY_FOR_TYPE[type] || "Other",
    name: finding.name,
    description: finding.description,
    value: finding.value ?? null,
    estimatedAnnualValue:
      typeof finding.estimatedAnnualValue === "number"
        ? finding.estimatedAnnualValue
        : null,
    requirements: {
      minRating: typeof finding.minRating === "number" ? finding.minRating : 0,
      maxRating:
        typeof finding.maxRating === "number" ? finding.maxRating : null,
      isPermanentTotal: finding.isPermanentTotal === true,
      residencyRequired: finding.residencyRequired !== false,
      otherReqs: Array.isArray(finding.otherReqs) ? finding.otherReqs : [],
    },
    application: {
      agency: finding.agency ?? null,
      form: finding.form ?? null,
      url: finding.applicationUrl ?? null,
      documentation: Array.isArray(finding.documentation)
        ? finding.documentation
        : [],
    },
    legalCitation: finding.legalCitation ?? null,
    authorityTier: STATE_BENEFIT_AUTHORITY_TIER,
    sourceUrl: finding.sourceUrl ?? null,
    lastVerified,
    verificationStatus: status,
  };
}

/** A whole research file → a canonical per-state file. */
export function normalizeStateFile(raw, { lastVerified }) {
  const stateCode = raw.stateCode;
  const benefits = (raw.findings || []).map((f) =>
    normalizeFinding(f, stateCode, lastVerified),
  );
  // A state file is "verified" only when at least one benefit is verified; if
  // none are, it stays "template" so the UI shows the pending-verification note.
  const anyVerified = benefits.some((b) => b.verificationStatus === "verified");
  return {
    state: raw.state,
    stateCode,
    officialSource: raw.officialSource ?? null,
    verificationStatus: anyVerified ? "verified" : "template",
    lastVerified,
    benefits,
  };
}
