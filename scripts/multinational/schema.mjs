#!/usr/bin/env node
/**
 * schema.mjs — the canonical multinational/OCONUS-service schema (S38) and its
 * validator.
 *
 * One shape for every category of US-veteran benefit content that concerns
 * overseas or allied service: foreign-location presumptive exposure, the Foreign
 * Medical Program, OCONUS claims-filing procedures, and allied/Commonwealth
 * service credit. This is US-veteran-benefit content ABOUT overseas service — not
 * a comparative reference to other countries' benefit systems (S38 scope, see
 * docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md line 63).
 *
 * Mirrors the S36 state-benefits pipeline (schema/normalize/build) deliberately:
 * a proven, reproducible ingestion pattern with an enforced accuracy floor.
 *
 * Accuracy discipline (S28): every provision MUST carry `sourceUrl`,
 * `lastVerified`, and `authorityTier`. A provision marked
 * `verificationStatus: "verified"` MUST cite an official https source URL — the
 * validator enforces this so unverified data can never masquerade as verified.
 *
 * No dependencies — plain data + pure functions, importable by the build script
 * and by the vitest guard.
 */

/**
 * The four S38 content categories. Each maps to one research/source file and one
 * shipped data file under src/data/multinational/.
 */
export const CATEGORIES = [
  "presumptive_exposure_overseas", // foreign-location radiation/herbicide presumptions
  "foreign_medical_program", // FMP: VA-covered care while abroad
  "oconus_filing", // filing/paying claims from outside the US
  "allied_service_credit", // Philippine Commonwealth / allied-forces credit
];

/** category → UI display label. Derived, never hand-set (validator enforces). */
export const DISPLAY_FOR_CATEGORY = {
  presumptive_exposure_overseas: "Overseas Presumptive Exposure",
  foreign_medical_program: "Foreign Medical Program",
  oconus_filing: "OCONUS Claims Filing",
  allied_service_credit: "Allied & Commonwealth Service Credit",
};

/** verificationStatus vocabulary — mirrors the state-benefits UI split. */
export const VERIFICATION_STATUSES = ["verified", "template", "unverified"];

/**
 * Multinational content is secondary reference material, never binding
 * authority. Matches the `multinational: "reference"` slot already registered in
 * src/services/dkbAuthorityTiers.js.
 */
export const MULTINATIONAL_AUTHORITY_TIER = "reference";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

/**
 * Accuracy fields (S28 discipline) + the verified-needs-a-source rule. A
 * legalCitation is recommended but NOT required — an official VA program page is
 * valid grounding on its own, and requiring a statute number would only pressure
 * a researcher into guessing one. The sourceUrl is the load-bearing proof.
 */
function accuracyErrors(p, where) {
  const errs = [];
  if (p.authorityTier !== MULTINATIONAL_AUTHORITY_TIER)
    errs.push(
      `${where}: authorityTier must be "${MULTINATIONAL_AUTHORITY_TIER}"`,
    );
  if (!ISO_DATE.test(p.lastVerified || ""))
    errs.push(`${where}: lastVerified must be YYYY-MM-DD`);
  if (!VERIFICATION_STATUSES.includes(p.verificationStatus))
    errs.push(`${where}: verificationStatus invalid`);
  if (p.verificationStatus === "verified") {
    if (!HTTPS_URL.test(p.sourceUrl || ""))
      errs.push(`${where}: verified provision needs an https sourceUrl`);
  } else if (p.sourceUrl && !HTTPS_URL.test(p.sourceUrl)) {
    errs.push(`${where}: sourceUrl must be https when present`);
  }
  return errs;
}

/**
 * Validate one canonical provision record. Returns an array of error strings
 * (empty === valid). Pure; no throwing.
 */
export function validateProvision(p, { category } = {}) {
  const where = `${category || "??"}:${p?.id || p?.name || "<unnamed>"}`;
  if (!p || typeof p !== "object") return [`${where}: not an object`];

  const errs = [];
  if (!p.id || typeof p.id !== "string") errs.push(`${where}: missing id`);
  if (!p.name || typeof p.name !== "string")
    errs.push(`${where}: missing name`);
  if (!CATEGORIES.includes(p.category))
    errs.push(`${where}: category "${p.category}" not in vocabulary`);
  if (category && p.category !== category)
    errs.push(
      `${where}: category "${p.category}" != file category ${category}`,
    );
  if (p.displayCategory !== DISPLAY_FOR_CATEGORY[p.category])
    errs.push(
      `${where}: displayCategory "${p.displayCategory}" != expected "${DISPLAY_FOR_CATEGORY[p.category]}"`,
    );
  if (!p.description || typeof p.description !== "string")
    errs.push(`${where}: missing description`);

  errs.push(...accuracyErrors(p, where));
  return errs;
}

/**
 * Validate a whole per-category file. Returns { valid, errors, counts }.
 */
export function validateCategoryFile(file) {
  const errors = [];
  if (!file || typeof file !== "object")
    return {
      valid: false,
      errors: ["category file is not an object"],
      counts: {},
    };
  if (!CATEGORIES.includes(file.category))
    errors.push(`invalid file category "${file.category}"`);
  if (!VERIFICATION_STATUSES.includes(file.verificationStatus))
    errors.push(`invalid file verificationStatus "${file.verificationStatus}"`);
  if (!ISO_DATE.test(file.lastVerified || ""))
    errors.push("missing/invalid file lastVerified");
  if (!Array.isArray(file.provisions) || file.provisions.length === 0)
    errors.push("provisions must be a non-empty array");

  const ids = new Set();
  for (const p of file.provisions || []) {
    errors.push(...validateProvision(p, { category: file.category }));
    if (p?.id) {
      if (ids.has(p.id)) errors.push(`${file.category}: duplicate id ${p.id}`);
      ids.add(p.id);
    }
  }

  const counts = {
    provisions: (file.provisions || []).length,
    verified: (file.provisions || []).filter(
      (p) => p.verificationStatus === "verified",
    ).length,
  };
  return { valid: errors.length === 0, errors, counts };
}
