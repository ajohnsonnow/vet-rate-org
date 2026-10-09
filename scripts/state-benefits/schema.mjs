#!/usr/bin/env node
/**
 * schema.mjs — the canonical state-benefit schema (S36) and its validator.
 *
 * One shape for every state, replacing the two divergent formats the Jan-2026
 * Python scraper emitted (the hand-authored TX/CA/FL `benefitName`/
 * `applicationProcess`/`sources[]` shape and the template `name`/`howToApply`/
 * `sourceUrl` shape). Every consumer and every future state (S37) reads this.
 *
 * Accuracy discipline (S28): every benefit MUST carry `sourceUrl`,
 * `lastVerified`, and `authorityTier`. A benefit marked `verificationStatus:
 * "verified"` MUST cite an official source URL — the validator enforces this so
 * unverified data can never masquerade as verified.
 *
 * No dependencies — plain data + pure functions, importable by the build script
 * and by the vitest guard.
 */

/**
 * The six benefit types the S36 DoD requires every pilot state to cover where
 * the program exists, plus the broader set the live UI already buckets. The
 * first six are the DoD-mandated categories; the rest keep coverage honest for
 * programs that don't fit them.
 */
export const BENEFIT_TYPES = [
  "property_tax_exemption", // DoD: property tax exemption
  "state_veterans_home", // DoD: state VA homes
  "education_tuition", // DoD: education / tuition waivers
  "hiring_preference", // DoD: hiring preference
  "license_plate", // DoD: license plates
  "state_va_healthcare", // DoD: state VA hospital / nursing-home network
  "vehicle_registration",
  "recreation",
  "housing",
  "financial_bonus",
  "other",
];

/** verificationStatus vocabulary — mirrors the UI's verified/pending split. */
export const VERIFICATION_STATUSES = ["verified", "template", "unverified"];

/**
 * benefitType → UI display `category`. The live StateBenefitHunter keys its
 * icon/colour config on these strings (Property Tax, Vehicle, Education,
 * Recreation, Employment, Healthcare, Housing), so the canonical record carries
 * both: `benefitType` (machine, stable) and `category` (display, derived).
 */
export const CATEGORY_FOR_TYPE = {
  property_tax_exemption: "Property Tax",
  state_veterans_home: "Housing",
  education_tuition: "Education",
  hiring_preference: "Employment",
  license_plate: "Vehicle",
  state_va_healthcare: "Healthcare",
  vehicle_registration: "Vehicle",
  recreation: "Recreation",
  housing: "Housing",
  financial_bonus: "Other",
  other: "Other",
};

/** State benefits are secondary reference material, never binding authority. */
export const STATE_BENEFIT_AUTHORITY_TIER = "reference";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

/** requirements.minRating is the load-bearing eligibility gate the search filters on. */
function requirementErrors(r, where) {
  if (!r || typeof r !== "object") return [`${where}: missing requirements`];
  const errs = [];
  if (typeof r.minRating !== "number" || r.minRating < 0 || r.minRating > 100)
    errs.push(`${where}: requirements.minRating must be 0-100`);
  if (r.maxRating != null && (r.maxRating < 0 || r.maxRating > 100))
    errs.push(`${where}: requirements.maxRating out of range`);
  return errs;
}

/**
 * Accuracy fields (S28 discipline) + the verified-needs-a-source rule. A
 * legalCitation is recommended but NOT required — an official agency page (a
 * state DMV or veterans-home page) is valid grounding on its own, and requiring
 * a statute number would only pressure a researcher into guessing one. The
 * sourceUrl is the load-bearing proof.
 */
function accuracyErrors(b, where) {
  const errs = [];
  if (b.authorityTier !== STATE_BENEFIT_AUTHORITY_TIER)
    errs.push(
      `${where}: authorityTier must be "${STATE_BENEFIT_AUTHORITY_TIER}"`,
    );
  if (!ISO_DATE.test(b.lastVerified || ""))
    errs.push(`${where}: lastVerified must be YYYY-MM-DD`);
  if (!VERIFICATION_STATUSES.includes(b.verificationStatus))
    errs.push(`${where}: verificationStatus invalid`);
  if (b.verificationStatus === "verified") {
    if (!HTTPS_URL.test(b.sourceUrl || ""))
      errs.push(`${where}: verified benefit needs an https sourceUrl`);
  } else if (b.sourceUrl && !HTTPS_URL.test(b.sourceUrl)) {
    errs.push(`${where}: sourceUrl must be https when present`);
  }
  return errs;
}

/**
 * Validate one canonical benefit record. Returns an array of error strings
 * (empty === valid). Pure; no throwing.
 */
export function validateBenefit(b, { stateCode } = {}) {
  const where = `${stateCode || "??"}:${b?.id || b?.name || "<unnamed>"}`;
  if (!b || typeof b !== "object") return [`${where}: not an object`];

  const errs = [];
  if (!b.id || typeof b.id !== "string") errs.push(`${where}: missing id`);
  if (!b.name || typeof b.name !== "string")
    errs.push(`${where}: missing name`);
  if (!BENEFIT_TYPES.includes(b.benefitType))
    errs.push(`${where}: benefitType "${b.benefitType}" not in vocabulary`);
  if (b.category !== CATEGORY_FOR_TYPE[b.benefitType])
    errs.push(
      `${where}: category "${b.category}" != expected "${CATEGORY_FOR_TYPE[b.benefitType]}" for type ${b.benefitType}`,
    );
  if (!b.description || typeof b.description !== "string")
    errs.push(`${where}: missing description`);

  errs.push(
    ...requirementErrors(b.requirements, where),
    ...accuracyErrors(b, where),
  );
  return errs;
}

/**
 * Validate a whole per-state file. Returns { valid, errors, counts }.
 */
export function validateStateFile(state) {
  const errors = [];
  if (!state || typeof state !== "object")
    return {
      valid: false,
      errors: ["state file is not an object"],
      counts: {},
    };
  if (!state.stateCode) errors.push("missing stateCode");
  if (!VERIFICATION_STATUSES.includes(state.verificationStatus))
    errors.push(
      `invalid file verificationStatus "${state.verificationStatus}"`,
    );
  if (!ISO_DATE.test(state.lastVerified || ""))
    errors.push("missing/invalid file lastVerified");
  if (!Array.isArray(state.benefits) || state.benefits.length === 0)
    errors.push("benefits must be a non-empty array");

  const ids = new Set();
  for (const b of state.benefits || []) {
    errors.push(...validateBenefit(b, { stateCode: state.stateCode }));
    if (b?.id) {
      if (ids.has(b.id))
        errors.push(`${state.stateCode}: duplicate id ${b.id}`);
      ids.add(b.id);
    }
  }

  const counts = {
    benefits: (state.benefits || []).length,
    verified: (state.benefits || []).filter(
      (b) => b.verificationStatus === "verified",
    ).length,
  };
  return { valid: errors.length === 0, errors, counts };
}
