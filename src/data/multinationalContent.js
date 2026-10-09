/**
 * MULTINATIONAL / OCONUS SERVICE CONTENT (S38)
 * ============================================
 *
 * US-veteran-benefit content about overseas or allied service — NOT a
 * comparative reference to other countries' benefit systems. Four categories,
 * each built from an official-source research file by
 * scripts/multinational/build-multinational.mjs and validated against
 * scripts/multinational/schema.mjs:
 *
 *   • presumptive_exposure_overseas — foreign-location radiation/herbicide
 *     presumptions (Hiroshima/Nagasaki, Enewetak, Palomares, Thule, Thailand,
 *     Korean DMZ, Laos/Cambodia, Guam/Johnston Atoll), each with its CFR cite.
 *   • foreign_medical_program — VA-covered care while living/traveling abroad.
 *   • oconus_filing — filing and getting paid on a claim from outside the US.
 *   • allied_service_credit — Philippine Commonwealth/Scout and allied-forces
 *     service credit, the $0.50-per-dollar rule, and the FVEC Fund.
 *
 * Every provision carries an official https `sourceUrl` + `lastVerified` +
 * `authorityTier: "reference"` (S28 accuracy discipline). Reached by every in-app
 * consumer through the unified access layer (src/services/knowledgeQuery.js, S30)
 * — this module is the single flat-file boundary it binds to.
 */

import presumptiveExposureOverseas from "./multinational/presumptive_exposure_overseas.json";
import foreignMedicalProgram from "./multinational/foreign_medical_program.json";
import oconusFiling from "./multinational/oconus_filing.json";
import alliedServiceCredit from "./multinational/allied_service_credit.json";

// One entry per S38 category file, in display order.
const CATEGORY_FILES = [
  presumptiveExposureOverseas,
  foreignMedicalProgram,
  oconusFiling,
  alliedServiceCredit,
];

/** Flatten provisions into one array, each stamped with its file's metadata. */
export const multinationalProvisions = CATEGORY_FILES.flatMap((file) =>
  file.provisions.map((provision) => ({
    ...provision,
    categoryDisplayName: file.displayName,
    officialSource: file.officialSource,
    verified: provision.verificationStatus === "verified",
  })),
);

/** The four category files (with their own verificationStatus/lastVerified). */
export const getMultinationalCategories = () => CATEGORY_FILES;

/** Provisions for one category (e.g. "foreign_medical_program"). */
export const getMultinationalByCategory = (category) =>
  multinationalProvisions.filter((p) => p.category === category);

/** Case-insensitive substring search over name/description/eligibility/keyPoints. */
export const searchMultinational = (term) => {
  if (!term) return multinationalProvisions;
  const q = String(term).toLowerCase();
  return multinationalProvisions.filter((p) =>
    [p.name, p.description, p.eligibility, ...(p.keyPoints || [])]
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(q)),
  );
};

export const MULTINATIONAL_STATS = {
  categories: CATEGORY_FILES.length,
  provisions: multinationalProvisions.length,
  verified: multinationalProvisions.filter((p) => p.verified).length,
  lastUpdated: "2026-07-15",
};

export default multinationalProvisions;
