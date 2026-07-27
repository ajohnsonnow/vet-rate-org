/**
 * STATE BENEFITS DATABASE
 * ======================
 *
 * DATA QUALITY STATUS:
 * - VERIFIED (S36 pilot + S37 + S38 + S39 + S40 + S41 rollout): all 51 states —
 *   TX, CA, FL (S36); PA, VA, NC, OH, GA, NY, IL, WA, MI, AZ, CO, MD
 *   (S37); TN, IN, MA, SC, MO, WI, MN, OR, AL, LA, KY, OK (S38); ME, MS, MT, NE,
 *   NV, NH, NJ, NM (S39); ND, RI, SD, UT, VT, WV, WY, DC (S40); AK, AR, CT, DE,
 *   HI, ID, IA, KS (S41). Canonical schema, every benefit grounded in an
 *   official state .gov source with a per-entry sourceUrl + lastVerified
 *   (individual benefit entries may carry verificationStatus "unverified"
 *   when a specific detail couldn't be confirmed against a readable official
 *   source — see each entry). Built by
 *   scripts/state-benefits/build-state-benefits.mjs from sources/<code>.research.json.
 *   Loaded from ./states/<code>.json.
 *
 * See: docs/STATE_BENEFITS_SCHEMA.md (schema + ingestion pattern),
 *      scripts/state-benefits-scraper/FINAL_REPORT.md (legacy scraper caveats).
 */

// Import all state benefit files.
// The 15 highest-veteran-population states (TX/CA/FL from S36; PA/VA/NC/OH/GA/NY/
// IL/WA/MI/AZ/CO/MD from S37) are VERIFIED — canonical schema, every benefit
// grounded in an official state .gov source (see docs/STATE_BENEFITS_SCHEMA.md).
// The remaining 36 are legacy template-generated files, still pending
// verification (flagged in the UI), until later sprints verify them.
import txBenefits from "./states/tx.json";
import caBenefits from "./states/ca.json";
import flBenefits from "./states/fl.json";
import vaBenefits from "./states/va.json";
import ncBenefits from "./states/nc.json";
import gaBenefits from "./states/ga.json";
import waBenefits from "./states/wa.json";
import paBenefits from "./states/pa.json";
import azBenefits from "./states/az.json";
import ohBenefits from "./states/oh.json";
import miBenefits from "./states/mi.json";
import coBenefits from "./states/co.json";
import tnBenefits from "./states/tn.json";
import inBenefits from "./states/in.json";
import maBenefits from "./states/ma.json";
import mdBenefits from "./states/md.json";
import scBenefits from "./states/sc.json";
import moBenefits from "./states/mo.json";
import wiBenefits from "./states/wi.json";
import mnBenefits from "./states/mn.json";
import orBenefits from "./states/or.json";
import alBenefits from "./states/al.json";
import laBenefits from "./states/la.json";
import kyBenefits from "./states/ky.json";
import okBenefits from "./states/ok.json";
import nyBenefits from "./states/ny.json";
import ilBenefits from "./states/il.json";
import njBenefits from "./states/nj.json";
import ctBenefits from "./states/ct.json";
import arBenefits from "./states/ar.json";
import ksBenefits from "./states/ks.json";
import nvBenefits from "./states/nv.json";
import utBenefits from "./states/ut.json";
import msBenefits from "./states/ms.json";
import iaBenefits from "./states/ia.json";
import nmBenefits from "./states/nm.json";
import wvBenefits from "./states/wv.json";
import neBenefits from "./states/ne.json";
import idBenefits from "./states/id.json";
import hiBenefits from "./states/hi.json";
import nhBenefits from "./states/nh.json";
import meBenefits from "./states/me.json";
import mtBenefits from "./states/mt.json";
import riBenefits from "./states/ri.json";
import deBenefits from "./states/de.json";
import sdBenefits from "./states/sd.json";
import ndBenefits from "./states/nd.json";
import akBenefits from "./states/ak.json";
import vtBenefits from "./states/vt.json";
import wyBenefits from "./states/wy.json";
import dcBenefits from "./states/dc.json";

// State metadata with verification status
const STATE_METADATA = {
  // S36 pilots
  TX: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  CA: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  FL: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  // S37 rollout (next 12 by veteran population)
  PA: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  VA: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  NC: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  OH: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  GA: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  NY: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  IL: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  WA: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  MI: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  AZ: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  CO: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  MD: { verified: true, lastUpdated: "2026-07-15", quality: "high" },
  // S38 rollout (next 12 by veteran population)
  TN: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  IN: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  MA: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  SC: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  MO: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  WI: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  MN: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  OR: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  AL: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  LA: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  KY: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  OK: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  // S39 rollout (next 8 by veteran population)
  ME: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  MS: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  MT: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  NE: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  NV: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  NH: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  NJ: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  NM: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  // S40 rollout (ND, RI, SD, UT, VT, WV, WY, DC)
  ND: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  RI: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  SD: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  UT: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  VT: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  WV: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  WY: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  DC: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  // S41 rollout (AK, AR, CT, DE, HI, ID, IA, KS)
  AK: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  AR: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  CT: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  DE: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  HI: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  ID: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  IA: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  KS: { verified: true, lastUpdated: "2026-07-18", quality: "high" },
  // Remaining states: template quality (pending verification), driven by each
  // file's own dataStatus/verificationStatus in the flatten below.
};

// Combine all state benefits into one master array
const allStateData = [
  txBenefits,
  caBenefits,
  flBenefits,
  vaBenefits,
  ncBenefits,
  gaBenefits,
  waBenefits,
  paBenefits,
  azBenefits,
  ohBenefits,
  miBenefits,
  coBenefits,
  tnBenefits,
  inBenefits,
  maBenefits,
  mdBenefits,
  scBenefits,
  moBenefits,
  wiBenefits,
  mnBenefits,
  orBenefits,
  alBenefits,
  laBenefits,
  kyBenefits,
  okBenefits,
  nyBenefits,
  ilBenefits,
  njBenefits,
  ctBenefits,
  arBenefits,
  ksBenefits,
  nvBenefits,
  utBenefits,
  msBenefits,
  iaBenefits,
  nmBenefits,
  wvBenefits,
  neBenefits,
  idBenefits,
  hiBenefits,
  nhBenefits,
  meBenefits,
  mtBenefits,
  riBenefits,
  deBenefits,
  sdBenefits,
  ndBenefits,
  akBenefits,
  vtBenefits,
  wyBenefits,
  dcBenefits,
];

// Flatten all benefits into single array with metadata. Canonical pilot files
// carry `verificationStatus`/`lastVerified`; legacy template files carry
// `dataStatus`/`lastUpdated` — read whichever is present. A file's own
// `verificationStatus === "verified"` is authoritative for the verified flag.
export const stateBenefits = allStateData.flatMap((stateData) => {
  const fileVerified = stateData.verificationStatus === "verified";
  return stateData.benefits.map((benefit) => ({
    ...benefit,
    state: stateData.state,
    stateCode: stateData.stateCode,
    officialSource: stateData.officialSource,
    lastUpdated: stateData.lastUpdated || stateData.lastVerified,
    dataStatus: stateData.dataStatus || stateData.verificationStatus,
    verified:
      fileVerified || STATE_METADATA[stateData.stateCode]?.verified || false,
    quality:
      STATE_METADATA[stateData.stateCode]?.quality ||
      (fileVerified ? "high" : "template"),
  }));
});

// Export state lookup functions
export const getStateBenefits = (stateCode) => {
  return stateBenefits.filter((b) => b.stateCode === stateCode);
};

export const searchBenefitsByRating = (stateCode, rating) => {
  const normalizeRequirements = (req) => {
    // Handle both old BaseStateScraper format and new SimpleStateScraper format
    if (req.minRating !== undefined) return req.minRating;
    if (req.min_rating !== undefined) return req.min_rating;
    return 0;
  };

  return stateBenefits.filter((b) => {
    const stateMatch = !stateCode || b.stateCode === stateCode;
    const minRating = normalizeRequirements(b.requirements || {});
    const ratingMatch = rating >= minRating;
    return stateMatch && ratingMatch;
  });
};

export const getAllStateData = () => allStateData;

export const getVerifiedStates = () => {
  return Object.entries(STATE_METADATA)
    .filter(([_, meta]) => meta.verified)
    .map(([code, _]) => code);
};

// Statistics
export const STATS = {
  totalStates: allStateData.length,
  totalBenefits: stateBenefits.length,
  verifiedStates: getVerifiedStates().length,
  lastUpdated: "2026-07-18",
};

export default stateBenefits;
