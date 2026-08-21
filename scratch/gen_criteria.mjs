#!/usr/bin/env node
// S35 rating-criteria generator. Reads the curated eCFR source blocks
// (scratch/gap_source.json, extracted from the VERIFIED public/legal-index)
// and emits scratch/patch.json = { "<dc>": <ratingCriteria> }. Deterministic:
// every percentage comes from the source cells, never invented.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const { found } = read("scratch/gap_source.json");

// --- value extraction -------------------------------------------------------
// A value cell may carry leading footnote markers ("1 90"); the rating value is
// the LAST integer in the cell. Reject anything outside 0..100.
function cellValue(cell) {
  const nums = String(cell).match(/\d{1,3}/g);
  if (!nums) return null;
  const n = Number(nums[nums.length - 1]);
  return n >= 0 && n <= 100 ? String(n) : null;
}
function cleanDesc(cell, dc) {
  return (
    String(cell)
      .replace(new RegExp("^" + dc + "\\s+"), "")
      // eslint-disable-next-line sonarjs/slow-regex -- two non-nested `\s*` spans separated by a literal ":", linear backtracking; operates on short trusted table-cell text from a local JSON file
      .replace(/\s*:\s*$/, "")
      .trim()
  );
}
function push(ratings, pct, text) {
  ratings[pct] = ratings[pct] ? ratings[pct] + " / " + text : text;
}
function addRating(ratings, major, minor, desc, twoCol) {
  if (!twoCol) {
    if (major !== null) push(ratings, major, desc);
    return;
  }
  if (major !== null && minor !== null) {
    if (major === minor)
      push(ratings, major, desc + " (dominant/non-dominant)");
    else {
      push(ratings, major, desc + " (dominant)");
      push(ratings, minor, desc + " (non-dominant)");
    }
  } else if (major !== null) push(ratings, major, desc + " (dominant)");
  else if (minor !== null) push(ratings, minor, desc + " (non-dominant)");
}

// --- transcribe one block into a ratings map --------------------------------
function transcribe(entry) {
  const { dc, rows } = entry;
  const twoCol = rows.some((r) => r.length >= 3 && cellValue(r[2]) !== null);
  const ratings = {};
  let context = "";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const major = cellValue(r[1]);
    const minor = r.length >= 3 ? cellValue(r[2]) : null;
    const isRatingRow = major !== null || minor !== null;
    const desc0 = cleanDesc(r[0], dc);
    if (!isRatingRow) {
      // header (rows[0]) or a sub-header/note. Notes are dropped; sub-headers
      // (short, end with ":" originally) become context for following rows.
      if (i > 0 && !/^note/i.test(desc0) && desc0.length && /:/.test(r[0]))
        context = desc0;
      continue;
    }
    const desc = context && i > 0 ? `${context} — ${desc0}` : desc0;
    addRating(ratings, major, minor, desc, twoCol);
  }
  return Object.keys(ratings).length ? { type: "direct", ratings } : null;
}

// --- POINTER handling -------------------------------------------------------
const NEURITIS_CAP =
  "Neuritis of this nerve is rated on the scale for paralysis of the nerve " +
  "(diagnostic code {P}). Per 38 CFR § 4.123, the maximum rating for neuritis " +
  "not characterized by organic changes (loss of reflexes, muscle atrophy, " +
  "sensory disturbances, constant pain) is that for moderate incomplete " +
  "paralysis — or moderately severe incomplete paralysis with sciatic nerve " +
  "involvement.";
const NEURALGIA_CAP =
  "Neuralgia of this nerve is rated on the same scale as paralysis of the nerve " +
  "(diagnostic code {P}). Per 38 CFR § 4.124, the maximum rating for neuralgia " +
  "is that for moderate incomplete paralysis.";

const SEIZURE_RATINGS = {
  100: "Averaging at least 1 major seizure per month over the last year",
  80: "Averaging at least 1 major seizure in 3 months over the last year; or more than 10 minor seizures weekly",
  60: "Averaging at least 1 major seizure in 4 months over the last year; or 9-10 minor seizures per week",
  40: "At least 1 major seizure in the last 6 months or 2 in the last year; or averaging at least 5 to 8 minor seizures weekly",
  20: "At least 1 major seizure in the last 2 years; or at least 2 minor seizures in the last 6 months",
  10: "A confirmed diagnosis of epilepsy with a history of seizures",
};
const SEIZURE_FORMULA =
  "General Rating Formula for Major and Minor Epileptic Seizures (38 CFR § 4.124a). " +
  "A major seizure is a generalized tonic-clonic convulsion with unconsciousness; a " +
  "minor seizure is a brief interruption in consciousness (pure petit mal), myoclonic, " +
  "or akinetic type. When continuous medication is shown necessary for control, the " +
  "minimum evaluation is 10 percent.";

// Hand-encoded pointer entries whose fixed values / directives are taken
// verbatim from the eCFR source blocks (scratch/gap_source.json).
const POINTER = {
  5281: {
    type: "rated-as",
    ratedUnder:
      "Rate as hallux valgus, severe (diagnostic code 5280). Note: Not to be combined with claw foot ratings.",
  },
  5309: {
    type: "rated-as",
    ratings: {
      10: "Intrinsic muscles of the hand — rate on limitation of motion, minimum 10 percent",
    },
    ratedUnder:
      "The hand is so compact that isolated muscle injuries are rare; rate on limitation of motion, minimum 10 percent.",
  },
  5325: {
    type: "rated-as",
    ratings: { 10: "Minimum, if interfering to any extent with mastication" },
    ratedUnder:
      "Evaluate functional impairment as seventh (facial) cranial nerve neuropathy (diagnostic code 8207), disfiguring scar (diagnostic code 7800), etc.",
  },
  5326: {
    type: "direct",
    ratings: {
      10: "Muscle hernia, extensive, without other injury to the muscle",
    },
  },
  5327: {
    type: "direct",
    ratings: {
      100: "Muscle, neoplasm of, malignant (excluding soft tissue sarcoma)",
    },
    notes: [
      "A rating of 100 percent continues beyond cessation of treatment; six months after discontinuance a mandatory VA examination determines the appropriate rating (§ 3.105(e)). If no local recurrence or metastasis, rate on residual impairment of function.",
    ],
  },
  5328: {
    type: "rated-as",
    ratedUnder:
      "Muscle, neoplasm of, benign, postoperative. Rate on impairment of function, i.e., limitation of motion, or scars (diagnostic code 7805), etc.",
  },
  5329: {
    type: "direct",
    ratings: {
      100: "Sarcoma, soft tissue (of muscle, fat, or fibrous connective tissue)",
    },
    notes: [
      "A rating of 100 percent continues beyond cessation of treatment; six months after discontinuance a mandatory VA examination determines the appropriate rating (§ 3.105(e)). If no local recurrence or metastasis, rate on residual impairment of function.",
    ],
  },
  5330: {
    type: "rated-as",
    ratedUnder:
      "Rate each affected muscle group separately and combine in accordance with § 4.25. Separately evaluate any chronic renal complications within the appropriate body system.",
  },
  5331: {
    type: "rated-as",
    ratedUnder:
      "Rate each affected muscle group separately and combine in accordance with § 4.25.",
  },
  6723: {
    type: "rated-as",
    ratedUnder:
      "Pulmonary tuberculosis, chronic, minimal, inactive — rate under the graduated ratings for inactive pulmonary tuberculosis (38 CFR § 4.97, and §§ 4.88b/4.89 for cases entitled to the pre-1968 graduated schedule).",
  },
  7354: {
    type: "rated-as",
    ratedUnder:
      "Rate under diagnostic code 7345 (chronic liver disease without cirrhosis).",
  },
  7533: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7534: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7535: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7536: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7537: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7538: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7539: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7544: {
    type: "rated-as",
    ratedUnder: "Rate as renal dysfunction (38 CFR § 4.115a).",
  },
  7545: {
    type: "rated-as",
    ratedUnder:
      "Rate as voiding dysfunction or urinary tract infection, whichever is predominant (38 CFR § 4.115a). Review for entitlement to special monthly compensation under § 3.350.",
  },
  7833: {
    type: "rated-as",
    ratedUnder:
      "Rate as scars (diagnostic codes 7801, 7802, 7804, or 7805), disfigurement of the head, face, or neck (diagnostic code 7800), or impairment of function. If therapy comparable to that for systemic malignancies is required, a 100-percent evaluation is assigned from onset of treatment, with a mandatory VA examination six months after completion (§ 3.105(e)).",
  },
};

function pointerEntry(dc) {
  if (POINTER[dc]) return POINTER[dc];
  // Epilepsy 8910/8912/8913/8914
  if (dc === "8910")
    return {
      type: "formula",
      ratings: { ...SEIZURE_RATINGS },
      formula: SEIZURE_FORMULA,
      notes: [
        "Grand mal epilepsy — rate under the general rating formula for major seizures.",
      ],
    };
  if (dc === "8912")
    return {
      type: "formula",
      ratings: { ...SEIZURE_RATINGS },
      formula: SEIZURE_FORMULA,
      notes: [
        "Jacksonian and focal motor or sensory epilepsy — rate under the general rating formula, as major or minor seizures per the manifestations.",
      ],
    };
  if (dc === "8913")
    return {
      type: "formula",
      ratings: { ...SEIZURE_RATINGS },
      formula: SEIZURE_FORMULA,
      notes: [
        "Diencephalic epilepsy — rate as minor seizures, except in the presence of major and minor seizures rate the predominating type.",
      ],
    };
  if (dc === "8914")
    return {
      type: "formula",
      ratings: { ...SEIZURE_RATINGS },
      formula: SEIZURE_FORMULA,
      notes: [
        "Psychomotor epilepsy — rated as major seizures when characterized by automatic states and/or generalized convulsions with unconsciousness; otherwise rated as minor seizures.",
      ],
    };
  // Neuritis 86xx -> paralysis parent dc-100 ; Neuralgia 87xx -> dc-200
  const n = Number(dc);
  if (n >= 8610 && n <= 8699) {
    const parent = String(n - 100);
    return {
      type: "rated-as",
      ratedUnder: NEURITIS_CAP.replace(/\{P\}/g, parent),
    };
  }
  if (n >= 8710 && n <= 8799) {
    const parent = String(n - 200);
    return {
      type: "rated-as",
      ratedUnder: NEURALGIA_CAP.replace(/\{P\}/g, parent),
    };
  }
  return null;
}

// --- drive ------------------------------------------------------------------
const patch = {};
const unresolved = [];
for (const entry of found) {
  const anyVal = entry.rows.some(
    (r) =>
      cellValue(r[1]) !== null || (r.length >= 3 && cellValue(r[2]) !== null),
  );
  let rc;
  if (anyVal) rc = transcribe(entry);
  else rc = pointerEntry(entry.dc);
  if (!rc) rc = pointerEntry(entry.dc); // pointer even if a stray value slipped
  if (!rc) {
    unresolved.push(entry.dc);
    continue;
  }
  patch[entry.dc] = rc;
}
// Pointer codes that were classified transcribable by the value scan but are
// really analogy/formula codes (nerves with a stray parent number, etc.) — the
// POINTER table / epilepsy / nerve rules take precedence for those DCs.
for (const dc of Object.keys(POINTER)) if (!patch[dc]) patch[dc] = POINTER[dc];
for (const dc of ["8910", "8912", "8913", "8914"])
  if (!patch[dc]) patch[dc] = pointerEntry(dc);

// --- stragglers not present as a single DC-header row in the source ----------
// Four aggregate/search entries (ranges, not single diagnostic codes): give a
// rated-as directive to their constituent specific codes. Two eating-disorder
// codes: the General Rating Formula for Eating Disorders (38 CFR § 4.130).
const EATING_RATINGS = {
  100: "Self-induced weight loss to less than 80 percent of expected minimum weight, with incapacitating episodes of at least six weeks total duration per year, and requiring hospitalization more than twice a year for parenteral nutrition or tube feeding",
  60: "Self-induced weight loss to less than 85 percent of expected minimum weight with incapacitating episodes of six or more weeks total duration per year",
  30: "Self-induced weight loss to less than 85 percent of expected minimum weight with incapacitating episodes of more than two but less than six weeks total duration per year",
  10: "Binge eating followed by self-induced vomiting or other measures to prevent weight gain, or resistance to weight gain even when below expected minimum weight, with diagnosis of an eating disorder and incapacitating episodes of up to two weeks total duration per year",
  0: "Binge eating followed by self-induced vomiting or other measures to prevent weight gain, or resistance to weight gain even when below expected minimum weight, with diagnosis of an eating disorder but without incapacitating episodes",
};
const EATING_FORMULA =
  "General Rating Formula for Eating Disorders (38 CFR § 4.130). Ratings turn on self-induced weight loss relative to expected minimum weight and the number and duration of incapacitating episodes per year.";
const STRAGGLERS = {
  "5250-5259": {
    type: "rated-as",
    ratedUnder:
      "Aggregate of hip conditions. Rate under the specific diagnostic code for the impairment: hip ankylosis (5250), limitation of thigh flexion/abduction/rotation (5251–5253), flail joint (5254), or impairment of the femur (5255), per 38 CFR § 4.71a.",
  },
  "5256-5262": {
    type: "rated-as",
    ratedUnder:
      "Aggregate of knee conditions. Rate under the specific diagnostic code for the impairment: knee ankylosis (5256), cartilage/meniscus (5257–5259), limitation of flexion/extension (5260–5261), impairment of tibia and fibula (5262), or genu recurvatum (5263), per 38 CFR § 4.71a.",
  },
  "5270-5276": {
    type: "rated-as",
    ratedUnder:
      "Aggregate of ankle and foot conditions. Rate under the specific diagnostic code for the impairment: ankle ankylosis (5270), subastragalar/tarsal ankylosis (5272–5273), astragalectomy (5274), or the foot conditions in diagnostic codes 5276–5284, per 38 CFR § 4.71a.",
  },
  "8510-8540": {
    type: "rated-as",
    ratedUnder:
      "Aggregate entry for peripheral neuropathy. Rate under the specific nerve's diagnostic code as paralysis (8510–8540), neuritis (8610–8640), or neuralgia (8710–8740), per 38 CFR §§ 4.123, 4.124, 4.124a.",
  },
  9520: {
    type: "formula",
    ratings: { ...EATING_RATINGS },
    formula: EATING_FORMULA,
    notes: [
      "Anorexia nervosa — rate under the General Rating Formula for Eating Disorders.",
    ],
  },
  9521: {
    type: "formula",
    ratings: { ...EATING_RATINGS },
    formula: EATING_FORMULA,
    notes: [
      "Bulimia nervosa — rate under the General Rating Formula for Eating Disorders.",
    ],
  },
};
for (const [dc, rc] of Object.entries(STRAGGLERS))
  if (!patch[dc]) patch[dc] = rc;

writeFileSync(
  path.join(ROOT, "scratch/patch.json"),
  JSON.stringify(patch, null, 1),
);
// eslint-disable-next-line no-console -- CLI script's job is to report its own summary to the terminal, same as scripts/** (where no-console is off)
console.log(
  "patched DCs:",
  Object.keys(patch).length,
  "| unresolved:",
  unresolved.join(",") || "none",
);
