/**
 * VA Disability Rating Calculator
 * Implements 38 CFR § 4.25 - Combined Ratings Table
 *
 * The VA uses "efficiency" math, not simple addition.
 * Each rating reduces the remaining "whole person" efficiency.
 *
 * CRITICAL RULES:
 * - 38 CFR § 4.14: Pyramiding prohibited (same manifestation cannot be rated twice)
 * - 38 CFR § 4.26: Bilateral factor for paired extremities (10% boost)
 * - 38 CFR § 4.66: Amputation special rules (minimum guaranteed ratings)
 * - 38 CFR § 3.400: Payment effective date is first of month following effective date
 */

import { VA_PAY_RATES_HISTORICAL } from "../data/vaPayRatesHistorical";

/**
 * Calculate Payment Effective Date per 38 CFR § 3.400
 * Payment begins the first day of the month following the effective date
 *
 * @param {Date|string} effectiveDate - The effective date of the claim
 * @returns {Date} - The payment effective date (first of following month)
 *
 * Examples:
 * - Effective 12/3/2025 → Payment starts 1/1/2026
 * - Effective 6/30/2024 → Payment starts 7/1/2024
 * - Effective 3/15/2023 → Payment starts 4/1/2023
 */
export const calculatePaymentEffectiveDate = (effectiveDate) => {
  const date = new Date(effectiveDate);
  // Move to first day of next month
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Calculate months of backpay between two dates
 * Uses payment effective dates (first of month) per 38 CFR § 3.400
 *
 * @param {Date|string} effectiveDate - Original effective date
 * @param {Date|string} currentDate - Current date (defaults to today)
 * @returns {Object} - Backpay calculation details
 */
export const calculateBackpayMonths = (
  effectiveDate,
  currentDate = new Date(),
) => {
  const paymentEffectiveDate = calculatePaymentEffectiveDate(effectiveDate);
  const current = new Date(currentDate);

  // Calculate full months between payment effective date and current date
  const yearsDiff = current.getFullYear() - paymentEffectiveDate.getFullYear();
  const monthsDiff = current.getMonth() - paymentEffectiveDate.getMonth();
  const totalMonths = Math.max(0, yearsDiff * 12 + monthsDiff);

  return {
    effectiveDate: new Date(effectiveDate),
    paymentEffectiveDate,
    currentDate: current,
    totalMonths,
    explanation: `Payment starts first of month following effective date (38 CFR § 3.400)`,
  };
};

// 2026 VA Disability Compensation Rates (Effective Dec 1, 2025)
// Base tables come from the single source of truth in vaPayRatesHistorical.js.
// Source: https://www.va.gov/disability/compensation-rates/veteran-rates/
const HISTORICAL_2026 = VA_PAY_RATES_HISTORICAL[2026];

export const VA_PAY_RATES_2026 = {
  // Base rates for veteran alone (no dependents)
  solo: HISTORICAL_2026.solo,
  // Additional amounts for spouse (added to base for 30%+) — ADDITIONS, not totals
  spouse: HISTORICAL_2026.spouse,
  // Each additional child under 18
  childUnder18: HISTORICAL_2026.childUnder18,
  // Each additional child 18+ in qualifying school program
  childSchool: HISTORICAL_2026.childSchool,
  // Additional amount for 1 dependent parent
  parentOne: HISTORICAL_2026.parentOne,
  // Additional amount for 2 dependent parents
  parentTwo: HISTORICAL_2026.parentTwo,
  // Added amount for spouse receiving Aid and Attendance
  // (not in the historical table; SMC-adjacent addition specific to 2026)
  spouseAidAttendance: {
    30: 61.0,
    40: 81.0,
    50: 101.0,
    60: 121.0,
    70: 141.0,
    80: 161.0,
    90: 181.0,
    100: 201.41,
  },
  // First child addition (added to solo rate when veteran has 1+ child)
  // Calculated from "Veteran with 1 child only" minus "Veteran alone"
  firstChild: {
    30: 44.0, // 596.47 - 552.47
    40: 58.0, // 853.84 - 795.84
    50: 73.0, // 1205.90 - 1132.90
    60: 88.0, // 1523.02 - 1435.02
    70: 102.0, // 1910.45 - 1808.45
    80: 117.0, // 2219.15 - 2102.15
    90: 132.0, // 2494.30 - 2362.30
    100: 146.85, // 4085.43 - 3938.58
  },
};

// Body part categories for bilateral detection
export const BODY_PARTS = {
  extremities: [
    {
      value: "shoulder",
      label: "Shoulder",
      canBeBilateral: true,
      limb: "upper",
    },
    { value: "arm", label: "Arm (Upper)", canBeBilateral: true, limb: "upper" },
    { value: "elbow", label: "Elbow", canBeBilateral: true, limb: "upper" },
    { value: "forearm", label: "Forearm", canBeBilateral: true, limb: "upper" },
    { value: "wrist", label: "Wrist", canBeBilateral: true, limb: "upper" },
    { value: "hand", label: "Hand", canBeBilateral: true, limb: "upper" },
    { value: "fingers", label: "Fingers", canBeBilateral: true, limb: "upper" },
    { value: "hip", label: "Hip", canBeBilateral: true, limb: "lower" },
    { value: "thigh", label: "Thigh", canBeBilateral: true, limb: "lower" },
    { value: "knee", label: "Knee", canBeBilateral: true, limb: "lower" },
    { value: "leg", label: "Leg (Lower)", canBeBilateral: true, limb: "lower" },
    { value: "ankle", label: "Ankle", canBeBilateral: true, limb: "lower" },
    { value: "foot", label: "Foot", canBeBilateral: true, limb: "lower" },
    { value: "toes", label: "Toes", canBeBilateral: true, limb: "lower" },
  ],
  other: [
    { value: "head", label: "Head/Brain", canBeBilateral: false },
    { value: "eye", label: "Eye(s)", canBeBilateral: true },
    { value: "ear", label: "Ear(s)/Hearing", canBeBilateral: true },
    { value: "nose", label: "Nose/Sinuses", canBeBilateral: false },
    { value: "mouth", label: "Mouth/Teeth", canBeBilateral: false },
    { value: "neck", label: "Neck/Cervical Spine", canBeBilateral: false },
    { value: "back", label: "Back/Thoracolumbar Spine", canBeBilateral: false },
    { value: "chest", label: "Chest/Ribs", canBeBilateral: false },
    { value: "heart", label: "Heart/Cardiovascular", canBeBilateral: false },
    { value: "lungs", label: "Lungs/Respiratory", canBeBilateral: false },
    { value: "digestive", label: "Digestive System", canBeBilateral: false },
    { value: "kidney", label: "Kidney(s)", canBeBilateral: true },
    { value: "bladder", label: "Bladder/Urinary", canBeBilateral: false },
    {
      value: "reproductive",
      label: "Reproductive System",
      canBeBilateral: false,
    },
    { value: "skin", label: "Skin", canBeBilateral: false },
    {
      value: "mental",
      label: "Mental Health (PTSD, etc.)",
      canBeBilateral: false,
    },
    { value: "tbi", label: "TBI", canBeBilateral: false },
    { value: "diabetes", label: "Diabetes", canBeBilateral: false },
    { value: "migraines", label: "Migraines", canBeBilateral: false },
    { value: "other", label: "Other", canBeBilateral: false },
  ],
};

/**
 * Combine two ratings using VA "efficiency" math
 * Formula: A + B(1-A) where A and B are decimals
 * Example: 50% + 30% = 0.5 + 0.3(1-0.5) = 0.5 + 0.15 = 0.65 = 65%
 *
 * CRITICAL: The VA Combined Ratings Table (38 CFR § 4.25) uses WHOLE NUMBERS.
 * When you look up "88 combined with 20" you get 90, not 90.4.
 * Each step must be rounded to a whole number to match official VA calculations.
 *
 * This matches how VA.gov, DAV, and Hill & Ponton calculators work.
 */
export const combineTwoRatings = (rating1, rating2) => {
  // Validate inputs
  if (typeof rating1 !== "number" || typeof rating2 !== "number") {
    console.error("Invalid rating input:", rating1, rating2);
    return 0;
  }
  if (rating1 < 0 || rating1 > 100 || rating2 < 0 || rating2 > 100) {
    console.error("Rating out of range:", rating1, rating2);
    return Math.max(0, Math.min(100, rating1));
  }

  // Whole-number arithmetic, half rounded up, as Table I is built. In floating
  // point (0.57 + 0.5 * 0.43) * 100 is 78.49999..., which rounds to 78 where
  // the table gives 79.
  return Math.floor((rating1 * 100 + rating2 * (100 - rating1) + 50) / 100);
};

/**
 * Combine multiple ratings using VA math
 * Must sort descending and apply iteratively
 *
 * When `trail` (an array) is passed, each pairwise step is appended to it as
 * { stage, from, with, result } so callers can show the working.
 */
export const combineMultipleRatings = (
  ratings,
  trail = null,
  stage = "all",
) => {
  if (ratings.length === 0) return 0;
  if (ratings.length === 1) return ratings[0];

  // Sort descending
  const sorted = [...ratings].sort((a, b) => b - a);

  let combined = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const result = combineTwoRatings(combined, sorted[i]);
    if (trail) trail.push({ stage, from: combined, with: sorted[i], result });
    combined = result;
  }

  return combined;
};

/**
 * Round to nearest 10 (VA final rounding rule)
 * Per 38 CFR § 4.25: "combined values ending in 5 will be adjusted upward"
 * Examples: 65 → 70, 74 → 70, 75 → 80, 84 → 80, 85 → 90
 */
export const roundToNearest10 = (value) => {
  // JavaScript Math.round() correctly rounds 0.5 up
  // 6.5 → 7, 7.4 → 7, 7.5 → 8
  const rounded = Math.round(value / 10) * 10;
  return Math.max(0, Math.min(100, rounded)); // Clamp to 0-100
};

const SIDED = ["left", "right", "bilateral"];
const LIMBS = ["upper", "lower"];
// 38 CFR § 4.26(c) needs a disability "of compensable degree": 10% or more.
const COMPENSABLE = 10;
const LIMB_BY_BODY_PART = new Map(
  BODY_PARTS.extremities.map((part) => [part.value, part.limb]),
);
const NON_LIMB_BODY_PARTS = new Set(
  BODY_PARTS.other.map((part) => part.value).filter((v) => v !== "other"),
);
const withPlurals = (words) => words.flatMap((w) => [w, `${w}s`]);

// The name tier is an allowlist. A limb is read from a name only when every
// word in it is a side word, a limb part, a musculoskeletal or peripheral-nerve
// condition term of a limb, or a plain connective. One word outside the list
// ("insomnia because of right knee pain", "plantar wart, left foot") and the
// name gives no limb, because a blocklist of other conditions can never be
// complete and a wrong guess overstates the rating.
const NAME_SIDE_WORDS = {
  left: "left",
  right: "right",
  bilateral: "bilateral",
  both: "bilateral",
};
const NAME_LIMB_PARTS = new Map([
  ...withPlurals([
    "shoulder",
    "arm",
    "elbow",
    "forearm",
    "wrist",
    "hand",
    "finger",
    "thumb",
  ]).map((word) => [word, "upper"]),
  ...withPlurals(["hip", "thigh", "knee", "leg", "ankle", "toe"]).map(
    (word) => [word, "lower"],
  ),
  ["foot", "lower"],
  ["feet", "lower"],
]);
// Phrases are matched before single words. A phrase with a limb counts as a
// limb part ("upper extremity") or implies one ("pes planus" is the foot).
const NAME_PHRASES = [
  { words: "upper extremity", limb: "upper", part: true },
  { words: "upper extremities", limb: "upper", part: true },
  { words: "lower extremity", limb: "lower", part: true },
  { words: "lower extremities", limb: "lower", part: true },
  { words: "carpal tunnel syndrome", limb: "upper" },
  { words: "pes planus", limb: "lower" },
  { words: "plantar fasciitis", limb: "lower" },
  { words: "degenerative joint disease" },
  { words: "limitation of motion" },
  { words: "limitation of flexion" },
  { words: "limitation of extension" },
];
const NAME_CONDITION_WORDS = new Set([
  "strain",
  "sprain",
  "arthritis",
  "osteoarthritis",
  "limitation",
  "instability",
  "tendonitis",
  "tendinitis",
  "bursitis",
  "meniscus",
  "meniscal",
  "replacement",
  "fracture",
  "residual",
  "residuals",
  "amputation",
  "radiculopathy",
  "neuropathy",
  "impingement",
  "of",
  "the",
  "with",
]);
// The sided body parts that are not limbs (ear, eye, kidney in BODY_PARTS).
const NAME_NON_LIMB_WORDS = new Set([
  "hearing",
  "tinnitus",
  "vision",
  ...withPlurals(["ear", "eye", "kidney"]),
]);

const _nameWords = (name) =>
  String(name ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

function _takeNamePhrases(name) {
  let text = ` ${_nameWords(name).join(" ")} `;
  const limbs = new Set();
  let phraseParts = 0;
  for (const phrase of NAME_PHRASES) {
    const pieces = text.split(` ${phrase.words} `);
    if (pieces.length > 1) {
      text = pieces.join(" ");
      if (phrase.limb) limbs.add(phrase.limb);
      if (phrase.part) phraseParts += pieces.length - 1;
    }
  }
  return { words: text.trim().split(" ").filter(Boolean), limbs, phraseParts };
}

/**
 * What a condition name says, read against the allowlist:
 * { limb, side }. `limb` is "upper" or "lower" only when every word is
 * allowed and the name has at most one limb part and points at one limb;
 * "none" when it has no limb part and is about hearing, eyes or kidneys;
 * otherwise "unknown". `side` is the single side the name states, or null.
 */
function _readName(name) {
  const { words, limbs, phraseParts } = _takeNamePhrases(name);
  let parts = phraseParts;
  const sides = new Set();
  let allAllowed = true;
  let nonLimb = false;
  for (const word of words) {
    if (NAME_SIDE_WORDS[word]) {
      sides.add(NAME_SIDE_WORDS[word]);
    } else if (NAME_LIMB_PARTS.has(word)) {
      limbs.add(NAME_LIMB_PARTS.get(word));
      parts += 1;
    } else if (!NAME_CONDITION_WORDS.has(word)) {
      allAllowed = false;
      nonLimb = nonLimb || NAME_NON_LIMB_WORDS.has(word);
    }
  }

  const side = sides.size === 1 ? [...sides][0] : null;
  if (allAllowed && limbs.size === 1 && parts <= 1) {
    return { limb: [...limbs][0], side };
  }
  return { limb: nonLimb && limbs.size === 0 ? "none" : "unknown", side };
}

const _limbFromName = (name) => _readName(name).limb;

/**
 * Which extremity a condition affects: "upper", "lower", "none" (not a limb)
 * or "unknown". An explicit `limb` wins, then a recognised `bodyPart`, then
 * the name (ratings imported from a decision letter carry only a name and a
 * side), read by _limbFromName.
 */
function _limbOf(condition) {
  if ([...LIMBS, "none"].includes(condition.limb)) return condition.limb;
  if (LIMB_BY_BODY_PART.has(condition.bodyPart)) {
    return LIMB_BY_BODY_PART.get(condition.bodyPart);
  }
  const fromName = _limbFromName(condition.name);
  if (!NON_LIMB_BODY_PARTS.has(condition.bodyPart)) return fromName;
  // A non-limb body part whose name plainly names a limb ("Left leg
  // radiculopathy" filed under back) is a conflict, not a non-limb entry.
  return LIMBS.includes(fromName) ? "unknown" : "none";
}

const RECOGNISED_SIDES = ["none", "left", "right", "bilateral"];

/** Trimmed, lower-cased side; "both" is "bilateral" and no side is "none". */
function _normaliseSide(side) {
  if (side === null || side === undefined) return "none";
  if (typeof side !== "string") return side;
  const text = side.trim().toLowerCase();
  if (text === "") return "none";
  return text === "both" ? "bilateral" : text;
}

const _withNormalisedSide = (conditions) =>
  conditions.map((c) => ({ ...c, side: _normaliseSide(c.side) }));

/**
 * Entries left out of the group for a reason the veteran can fix, in input
 * order: an unrecognised side on a compensable limb entry, a limb that is
 * unknown where knowing it could have changed the group, or a both-sides
 * evaluation with nothing to pair with.
 */
function _groupIssues(conditions, candidates, inGroup, alone) {
  const couldPair = (entry) =>
    inGroup.size > 0 ||
    candidates.some(
      (other) =>
        other !== entry &&
        (entry.condition.side === "bilateral" ||
          other.condition.side === "bilateral" ||
          other.condition.side !== entry.condition.side),
    );
  const entryOf = new Map(candidates.map((entry) => [entry.condition, entry]));

  const issues = [];
  for (const condition of conditions) {
    const entry = entryOf.get(condition);
    const limb = _limbOf(condition);
    const unknownSide =
      !RECOGNISED_SIDES.includes(condition.side) &&
      condition.rating >= COMPENSABLE &&
      (LIMBS.includes(limb) || (limb === "unknown" && candidates.length > 0));
    if (unknownSide) {
      issues.push({ ...condition, reason: "side-unknown" });
    } else if (entry?.limb === "unknown" && couldPair(entry)) {
      issues.push({ ...condition, reason: "limb-unknown" });
    } else if (alone.has(condition)) {
      issues.push({ ...condition, reason: "single-bilateral-evaluation" });
    }
  }
  return issues;
}

/**
 * The disabilities that take the bilateral factor under 38 CFR § 4.26.
 *
 * (a) the pair is both arms or both legs, each limb taken as a whole;
 * (c) each side needs a compensable disability, so entries under 10% never
 *     count;
 * (b) when both arms and both legs are affected, all four form one group.
 *
 * One evaluation that already covers both sides (side "bilateral") takes the
 * factor only alongside a separately rated disability of those limbs, or when
 * the other two limbs form a pair (M21-1 V.iv.1.C.4.b).
 *
 * Returns { group, limbs, issues }; see _groupIssues for `issues`.
 */
function _formBilateralGroup(conditions) {
  const candidates = conditions
    .filter((c) => SIDED.includes(c.side) && c.rating >= COMPENSABLE)
    .map((condition) => ({ condition, limb: _limbOf(condition) }))
    .filter((entry) => entry.limb !== "none");

  const byLimb = {};
  for (const limb of LIMBS) {
    const members = candidates
      .filter((entry) => entry.limb === limb)
      .map((entry) => entry.condition);
    const left = members.some((c) => c.side === "left");
    const right = members.some((c) => c.side === "right");
    const bothSidesEntries = members.filter((c) => c.side === "bilateral");
    byLimb[limb] = {
      members,
      bothSidesEntries,
      bothSidesAffected: (left && right) || bothSidesEntries.length > 0,
      qualifies:
        (left && right) ||
        (bothSidesEntries.length > 0 && (left || right)) ||
        bothSidesEntries.length > 1,
    };
  }

  const anyQualifies = LIMBS.some((limb) => byLimb[limb].qualifies);
  const limbs = LIMBS.filter(
    (limb) =>
      byLimb[limb].qualifies ||
      (anyQualifies && byLimb[limb].bothSidesAffected),
  );
  const inGroup = new Set(limbs.flatMap((limb) => byLimb[limb].members));
  const alone = new Set(
    LIMBS.filter((limb) => !limbs.includes(limb)).flatMap(
      (limb) => byLimb[limb].bothSidesEntries,
    ),
  );

  return {
    group: conditions.filter((c) => inGroup.has(c)),
    limbs,
    issues: _groupIssues(conditions, candidates, inGroup, alone),
  };
}

function _bilateralGroupValue(ratings, trail = null) {
  const combinedBilateral = combineMultipleRatings(ratings, trail, "bilateral");
  // Whole numbers, half rounded up. A rating cannot exceed 100, so when the
  // factor would carry the group past it the factor is what is left to 100.
  const uncapped = Math.floor((combinedBilateral * 11 + 5) / 10);
  const bilateralFactorCapped = uncapped > 100;
  return {
    combinedBilateral,
    bilateralFactor: bilateralFactorCapped
      ? 100 - combinedBilateral
      : combinedBilateral / 10,
    bilateralGroupRating: Math.min(100, uncapped),
    bilateralFactorCapped,
  };
}

const MAX_EXCEPTION_ARRANGEMENTS = 20000;

const _isMoreFavourable = (candidate, best, full) =>
  candidate.rating > best.rating ||
  (best !== full &&
    candidate.rating === best.rating &&
    (candidate.raw > best.raw ||
      (candidate.raw === best.raw &&
        candidate.kept.length > best.kept.length)));

/**
 * 38 CFR § 4.26(d): when leaving one or more bilateral disabilities out of the
 * bilateral factor calculation gives a higher combined evaluation, they are
 * left out and combined separately. The whole group stays unless some other
 * arrangement gives a higher evaluation after the final rounding. What stays
 * in must still be a group under (a) to (c): keeping the factor on one side
 * alone would turn the 60/20/10/10 example that § 4.26 itself gives into 80.
 *
 * Entries with the same limb, side and rating are interchangeable, so
 * arrangements are counted per such class. Returns { kept, removed, searched };
 * `searched` is false when there were too many arrangements to try.
 */
function _mostFavourableGroup(group, otherRatings) {
  const evaluate = (members) => {
    const kept = group.filter((c) => members.includes(c));
    const removed = group.filter((c) => !members.includes(c));
    const ratings = [...otherRatings, ...removed.map((c) => c.rating)];
    if (kept.length > 0) {
      ratings.push(
        _bilateralGroupValue(kept.map((c) => c.rating)).bilateralGroupRating,
      );
    }
    const raw = combineMultipleRatings(ratings);
    return { kept, removed, raw, rating: roundToNearest10(raw) };
  };

  const full = evaluate(group);
  const classes = new Map();
  for (const c of group) {
    const key = `${_limbOf(c)}|${c.side}|${c.rating}`;
    classes.set(key, [...(classes.get(key) ?? []), c]);
  }
  const lists = [...classes.values()];
  const arrangements = lists.reduce((n, list) => n * (list.length + 1), 1);
  if (arrangements > MAX_EXCEPTION_ARRANGEMENTS) {
    return { ...full, searched: false };
  }

  let best = full;
  const visit = (index, members) => {
    if (index < lists.length) {
      for (let n = 0; n <= lists[index].length; n++) {
        visit(index + 1, [...members, ...lists[index].slice(0, n)]);
      }
      return;
    }
    if (members.length === group.length) return;
    const stillAGroup =
      members.length === 0 ||
      _formBilateralGroup(members).group.length === members.length;
    if (!stillAGroup) return;
    const candidate = evaluate(members);
    if (_isMoreFavourable(candidate, best, full)) best = candidate;
  };
  visit(0, []);
  return { ...best, searched: true };
}

const _emptyResult = () => ({
  combinedRating: 0,
  rawScore: 0,
  bilateralConditions: [],
  bilateralFactor: 0,
  bilateralGroupRating: 0,
  nonBilateralConditions: [],
  bilateralExcludedConditions: [],
  bilateralLimbs: [],
  bilateralIssues: [],
  calculationSteps: [],
  combineSteps: [],
  gapToNext10: 0,
  ratingNeededFor100: 0,
});

function _ratingValue(rating) {
  if (typeof rating !== "string") return rating;
  const text = rating.trim();
  if (text === "") return Number.NaN;
  return Number(text.endsWith("%") ? text.slice(0, -1) : text);
}

/**
 * The entries calculateVARating can use: objects whose rating is a number or a
 * numeric string ("50", "50%") of 0 or more, capped at 100. Anything else (a
 * null entry, a missing, negative or non-numeric rating) is left out, so one
 * bad entry cannot turn the result into NaN.
 */
function _usableConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.flatMap((c) => {
    if (c === null || typeof c !== "object") return [];
    const rating = _ratingValue(c.rating);
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0) {
      return [];
    }
    return [{ ...c, rating: Math.min(100, rating) }];
  });
}

/**
 * Entries with no side set whose name states a side and an allowlisted limb
 * ("Left knee strain" pasted from VA.gov arrives with side "none"). They take
 * no factor. They are reported only when setting the side the name states
 * would put them in a bilateral group, so the veteran is told to set it.
 */
function _sideNotSetIssues(conditions) {
  const namedSide = new Map();
  for (const c of conditions) {
    if (c.side !== "none" || c.rating < COMPENSABLE) continue;
    const name = _readName(c.name);
    if (name.side && LIMBS.includes(name.limb) && _limbOf(c) === name.limb) {
      namedSide.set(c, name.side);
    }
  }
  if (namedSide.size === 0) return [];
  const asNamed = conditions.map((c) =>
    namedSide.has(c) ? { ...c, side: namedSide.get(c) } : c,
  );
  const wouldGroup = _formBilateralGroup(asNamed).group;
  return conditions
    .filter((c, i) => namedSide.has(c) && wouldGroup.includes(asNamed[i]))
    .map((c) => ({ ...c, reason: "side-not-set" }));
}

function _sortIntoBilateralGroup(rawConditions) {
  const conditions = _withNormalisedSide(rawConditions);
  const formed = _formBilateralGroup(conditions);
  const issues = [...formed.issues, ..._sideNotSetIssues(conditions)];
  const {
    kept: bilateralConditions,
    removed: bilateralExcludedConditions,
    searched,
  } = _mostFavourableGroup(
    formed.group,
    conditions.filter((c) => !formed.group.includes(c)).map((c) => c.rating),
  );
  return {
    bilateralConditions,
    bilateralExcludedConditions,
    nonBilateralConditions: conditions.filter(
      (c) => !bilateralConditions.includes(c),
    ),
    bilateralLimbs: formed.limbs.filter((limb) =>
      bilateralConditions.some((c) => _limbOf(c) === limb),
    ),
    bilateralIssues: searched
      ? issues
      : [...issues, { reason: "most-favourable-not-checked" }],
  };
}

function _calculateBilateralGroup(bilateralConditions, steps, trail) {
  const bilateralRatings = bilateralConditions.map((c) => c.rating);
  const {
    combinedBilateral,
    bilateralFactor,
    bilateralGroupRating,
    bilateralFactorCapped,
  } = _bilateralGroupValue(bilateralRatings, trail);

  steps.push({
    step: 2,
    description: "Calculate Bilateral Group",
    bilateralRatings: bilateralRatings.sort((a, b) => b - a),
    combinedBilateral: combinedBilateral,
    bilateralFactor: bilateralFactor,
    bilateralGroupRating: bilateralGroupRating,
    bilateralFactorCapped,
  });

  return { bilateralFactor, bilateralGroupRating };
}

// nextTier must be the tier ABOVE the veteran's current combined (rounded)
// rating, not a ceiling of the raw score - ceil(rawScore/10)*10 collides with
// the already-achieved combinedRating whenever rawScore isn't an exact
// multiple of 10 (e.g. raw 78 -> combined 80 already, but ceil(78/10)*10 is
// also 80, showing "Gap to 80%: 2% away" while already AT 80%).
function _calculateGapAnalysis(rawScore, combinedRating) {
  const nextTier = Math.min(100, combinedRating + 10);
  // VA rounding is round-half-up (roundToNearest10): a raw score rounds up
  // into `nextTier` once it reaches `nextTier - 5`.
  const rawNeededForNextTier = nextTier - 5;
  const gapToNext10 =
    combinedRating >= 100 ? 0 : Math.max(0, rawNeededForNextTier - rawScore);

  // Using reverse VA math: If current = C, need X where C + X(1-C) >= 95 (rounds to 100)
  const currentEfficiency = 1 - rawScore / 100;
  const neededForRoundTo100 =
    currentEfficiency > 0 ? Math.ceil((95 - rawScore) / currentEfficiency) : 0;
  const ratingNeededFor100 = Math.max(0, Math.min(100, neededForRoundTo100));

  return { nextTier, gapToNext10, currentEfficiency, ratingNeededFor100 };
}

function _buildFinalCalculationStep(
  steps,
  rawScore,
  combinedRating,
  allRatings,
) {
  return {
    step: steps.length + 1,
    description: "Final calculation",
    rawScore: rawScore,
    roundedTo: combinedRating,
    method: "38 CFR § 4.25 Combined Ratings Table",
    validation: {
      inputValid: allRatings.every((r) => r >= 0 && r <= 100),
      outputValid:
        combinedRating >= 0 &&
        combinedRating <= 100 &&
        combinedRating % 10 === 0,
      roundingRule: rawScore % 10 >= 5 ? "Rounded UP" : "Rounded DOWN",
    },
  };
}

/**
 * Main VA Rating Calculator — the single source of truth for combined ratings.
 * Implements full 38 CFR § 4.25 logic including the § 4.26 Bilateral Factor.
 *
 * The bilateral factor is applied to the group _formBilateralGroup forms, NOT
 * to the two highest ratings. UI surfaces (MillionDollarDashboard, WhatIfSandbox,
 * SecondaryScoutLauncher, RetroPayHunter) all combine through this engine so
 * the math stays consistent. The flat ratingCalculator.calculateCombinedRating
 * is legacy.
 *
 * @param {Array} rawConditions - Array of condition objects (see
 *   _usableConditions for what is read and what is left out):
 *   { name: string, rating: number, side: 'left'|'right'|'bilateral'|'none',
 *     bodyPart: string, limb?: 'upper'|'lower'|'none' }
 * @returns {Object} - Calculation results. `bilateralExcludedConditions` are
 *   the bilateral disabilities left out of the factor under § 4.26(d); they are
 *   also in `nonBilateralConditions`, which is everything combined outside the
 *   group. `bilateralIssues` lists sided entries that got no bilateral factor
 *   for a reason the veteran can fix:
 *   { ...condition, reason: 'limb-unknown'|'side-unknown'|'side-not-set'|
 *     'single-bilateral-evaluation' },
 *   plus { reason: 'most-favourable-not-checked' } when § 4.26(d) was skipped
 *   because there were too many arrangements to try.
 */
export const calculateVARating = (rawConditions) => {
  const conditions = _usableConditions(rawConditions);
  if (conditions.length === 0) return _emptyResult();

  const steps = [];
  const combineSteps = [];

  const {
    bilateralConditions,
    bilateralExcludedConditions,
    nonBilateralConditions,
    bilateralLimbs,
    bilateralIssues,
  } = _sortIntoBilateralGroup(conditions);

  const label = (c) => `${c.name} (${c.rating}%)`;
  steps.push({
    step: 1,
    description: "Identify bilateral conditions",
    bilateral: bilateralConditions.map(label),
    nonBilateral: nonBilateralConditions.map(label),
    excludedFromFactor: bilateralExcludedConditions.map(label),
  });

  let allRatings = [];
  let bilateralGroupRating = 0;
  let bilateralFactor = 0;

  // Handle bilateral conditions if any exist
  if (bilateralConditions.length > 0) {
    ({ bilateralFactor, bilateralGroupRating } = _calculateBilateralGroup(
      bilateralConditions,
      steps,
      combineSteps,
    ));

    // Add bilateral group as single rating
    allRatings.push(bilateralGroupRating);
  }

  // Add non-bilateral ratings
  allRatings = allRatings.concat(nonBilateralConditions.map((c) => c.rating));

  // Sort all ratings descending for final calculation
  allRatings.sort((a, b) => b - a);

  steps.push({
    step: bilateralConditions.length > 0 ? 3 : 2,
    description: "Combine all ratings (sorted descending)",
    ratings: allRatings,
  });

  // Calculate combined rating
  const rawScore = combineMultipleRatings(allRatings, combineSteps, "all");
  const combinedRating = roundToNearest10(rawScore);

  steps.push(
    _buildFinalCalculationStep(steps, rawScore, combinedRating, allRatings),
  );

  const { nextTier, gapToNext10, currentEfficiency, ratingNeededFor100 } =
    _calculateGapAnalysis(rawScore, combinedRating);

  return {
    combinedRating,
    rawScore: Math.round(rawScore * 10) / 10,
    bilateralConditions: bilateralConditions.map((c) => ({ ...c })),
    bilateralFactor,
    bilateralGroupRating,
    nonBilateralConditions: nonBilateralConditions.map((c) => ({ ...c })),
    bilateralExcludedConditions: bilateralExcludedConditions.map((c) => ({
      ...c,
    })),
    bilateralLimbs,
    bilateralIssues,
    calculationSteps: steps,
    combineSteps,
    gapToNext10: Math.round(gapToNext10 * 10) / 10,
    nextTier,
    ratingNeededFor100,
    currentEfficiency: Math.round(currentEfficiency * 1000) / 10, // As percentage
  };
};

const _joinNames = (names) =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

// Why the compliance check cannot ask the veteran to verify a factor, by
// bilateralIssues reason, in the order they are reported.
const _NO_CHECK_MESSAGES = {
  "side-unknown": (names) =>
    `Vet-Rate did not recognise the side entered for ${names}, so it could not check the bilateral factor.`,
  "side-not-set": (names, one) =>
    `${names} ${one ? "names" : "name"} a side, but no side is set, so Vet-Rate could not check the bilateral factor. Set the side and check again.`,
  "limb-unknown": (names, one) =>
    `Vet-Rate could not tell whether ${names} ${one ? "is an arm or a leg condition" : "are arm or leg conditions"}, so it could not check the bilateral factor for ${one ? "it" : "them"}.`,
  "single-bilateral-evaluation": (names, one) =>
    `${names} ${one ? "is one evaluation that covers both sides, and by itself it takes" : "are each one evaluation that covers both sides, and by themselves they take"} no bilateral factor. The factor needs another separately rated disability of the same limbs (VA manual M21-1, V.iv.1.C.4.b).`,
};

/**
 * Whether the bilateral factor belongs in a veteran's combined rating, for
 * tools that ask the veteran to check a decision against it. It reads the
 * group calculateVARating forms, so it never points at a pairing 38 CFR § 4.26
 * does not support. `pairedParts` holds the names of the conditions in the
 * group.
 */
export const checkBilateralFactorCompliance = (conditions) => {
  const result = calculateVARating(conditions);
  const names = (list) => _joinNames(list.map((c) => c.name));

  if (result.bilateralConditions.length > 0) {
    const group = result.calculationSteps.find(
      (step) => step.bilateralGroupRating !== undefined,
    );
    return {
      applicable: true,
      pairedParts: result.bilateralConditions.map((c) => c.name),
      message: `The bilateral factor applies to ${names(result.bilateralConditions)} (38 CFR § 4.26). Check that your rating decision applied it.`,
      potentialBonus: group.bilateralFactorCapped
        ? `Combined, these ratings are ${group.combinedBilateral}%. With the factor they count as 100%, because a rating cannot exceed 100%.`
        : `Combined, these ratings are ${group.combinedBilateral}%. The factor adds 10% of that (${group.bilateralFactor}), so they count as ${group.bilateralGroupRating}% before combining with your other ratings.`,
    };
  }

  const none = { applicable: false, pairedParts: [] };
  const excluded = result.bilateralExcludedConditions;
  if (excluded.length > 0) {
    return {
      ...none,
      message: `${names(excluded)} are bilateral disabilities, but leaving them out of the bilateral factor gives a higher combined rating, so no factor is expected (38 CFR § 4.26(d)).`,
    };
  }
  for (const [reason, sentence] of Object.entries(_NO_CHECK_MESSAGES)) {
    const found = result.bilateralIssues.filter((i) => i.reason === reason);
    if (found.length > 0) {
      return { ...none, message: sentence(names(found), found.length === 1) };
    }
  }
  return {
    ...none,
    message:
      "No bilateral factor applies to these ratings. It needs a compensable rating in both arms or both legs (38 CFR § 4.26).",
  };
};

// Spouse base addition, plus Aid & Attendance if applicable. Mutates
// `breakdown` in place and returns the total amount added.
function _applySpouseAdditions(
  breakdown,
  rating,
  married,
  spouseAidAttendance,
) {
  if (!married) return 0;

  breakdown.spouseAddition = VA_PAY_RATES_2026.spouse[rating] || 0;
  let added = breakdown.spouseAddition;

  if (spouseAidAttendance) {
    breakdown.spouseAidAttendanceAddition =
      VA_PAY_RATES_2026.spouseAidAttendance[rating] || 0;
    added += breakdown.spouseAidAttendanceAddition;
  }

  return added;
}

// The VA's "veteran with child" base-rate rows already pay for 1 child
// (see va.gov compensation-rates page). Only the 2nd+ child gets the
// "each additional child" rate — applying that rate to the first child
// undercounts every veteran with dependents. Mutates `breakdown` in place
// and returns the total amount added.
function _applyChildAdditions(
  breakdown,
  rating,
  childrenUnder18,
  childrenSchool,
) {
  let remainingUnder18 = childrenUnder18;
  let remainingSchool = childrenSchool;
  let added = 0;

  if (remainingUnder18 + remainingSchool > 0) {
    breakdown.firstChildAddition = VA_PAY_RATES_2026.firstChild[rating] || 0;
    added += breakdown.firstChildAddition;
    if (remainingUnder18 > 0) {
      remainingUnder18 -= 1;
    } else {
      remainingSchool -= 1;
    }
  }

  // Children under 18 (2nd and beyond)
  if (remainingUnder18 > 0) {
    const perChild = VA_PAY_RATES_2026.childUnder18[rating] || 0;
    breakdown.childrenUnder18Addition = perChild * remainingUnder18;
    added += breakdown.childrenUnder18Addition;
  }

  // Children 18-23 in school (2nd and beyond, or 1st if no under-18 child)
  if (remainingSchool > 0) {
    const perChild = VA_PAY_RATES_2026.childSchool[rating] || 0;
    breakdown.childrenSchoolAddition = perChild * remainingSchool;
    added += breakdown.childrenSchoolAddition;
  }

  return added;
}

// Dependent-parent addition. Mutates `breakdown` in place and returns the
// amount added.
function _applyParentAdditions(breakdown, rating, dependentParents) {
  if (dependentParents === 1) {
    breakdown.parentsAddition = VA_PAY_RATES_2026.parentOne[rating] || 0;
  } else if (dependentParents >= 2) {
    breakdown.parentsAddition = VA_PAY_RATES_2026.parentTwo[rating] || 0;
  }
  return breakdown.parentsAddition;
}

/**
 * Calculate monthly compensation based on rating and dependents
 *
 * @param {number} rating - Combined VA rating (0-100, multiples of 10)
 * @param {Object} dependents - Dependent information
 * @returns {Object} - Compensation breakdown
 */
export const calculateCompensation = (rating, dependents = {}) => {
  const {
    married = false,
    spouseAidAttendance = false,
    childrenUnder18 = 0,
    childrenSchool = 0,
    dependentParents = 0,
  } = dependents;

  // Must be at least 30% for dependent benefits
  const qualifiesForDependents = rating >= 30;

  // Get base rate
  const baseRate = VA_PAY_RATES_2026.solo[rating] || 0;

  let total = baseRate;
  const breakdown = {
    baseRate,
    spouseAddition: 0,
    spouseAidAttendanceAddition: 0,
    firstChildAddition: 0,
    childrenUnder18Addition: 0,
    childrenSchoolAddition: 0,
    parentsAddition: 0,
  };

  if (qualifiesForDependents) {
    total += _applySpouseAdditions(
      breakdown,
      rating,
      married,
      spouseAidAttendance,
    );
    total += _applyChildAdditions(
      breakdown,
      rating,
      childrenUnder18,
      childrenSchool,
    );
    total += _applyParentAdditions(breakdown, rating, dependentParents);
  }

  return {
    monthlyTotal: Math.round(total * 100) / 100,
    annualTotal: Math.round(total * 12 * 100) / 100,
    breakdown,
    qualifiesForDependents,
  };
};

/**
 * Calculate "What If" scenarios
 * Shows how adding a new rating would change the combined
 *
 * @param {Array} existingConditions - Conditions already rated
 * @param {number} newRating - Rating of the proposed condition
 * @param {Object} proposed - Where the proposed condition is:
 *   { side, bodyPart, limb }, read as calculateVARating reads any condition,
 *   so it takes the bilateral factor only if 38 CFR § 4.26 gives it one.
 */
export const calculateWhatIf = (
  existingConditions,
  newRating,
  proposed = {},
) => {
  // Current combined rating
  const current = calculateVARating(existingConditions);

  // New condition
  const newCondition = {
    name: "Proposed Condition",
    rating: newRating,
    side: proposed.side ?? "none",
    bodyPart: proposed.bodyPart ?? "other",
    limb: proposed.limb,
  };

  // Calculate with new condition added
  const withNew = calculateVARating([...existingConditions, newCondition]);

  return {
    currentRating: current.combinedRating,
    newRating: withNew.combinedRating,
    currentRaw: current.rawScore,
    newRaw: withNew.rawScore,
    increase: withNew.combinedRating - current.combinedRating,
    percentageIncrease: (
      ((withNew.combinedRating - current.combinedRating) /
        current.combinedRating) *
      100
    ).toFixed(1),
  };
};

/**
 * Pyramiding Detection per 38 CFR § 4.14
 * Detects when the same disability manifestation may be rated multiple times
 *
 * Pyramiding occurs when:
 * - Same body part is rated under multiple diagnostic codes
 * - Same manifestation (pain, ROM limitation, weakness) counted twice
 * - Nerve injury AND the part it supplies both rated for same symptom
 *
 * @param {Array} conditions - Array of condition objects with bodyPart, manifestations
 * @returns {Object} - Pyramiding analysis and warnings
 */
function _detectBodyPartPyramiding(conditions) {
  const warnings = [];
  const bodyPartGroups = {};

  // Group conditions by body part
  conditions.forEach((condition, index) => {
    const bodyPart = condition.bodyPart || "other";
    if (!bodyPartGroups[bodyPart]) {
      bodyPartGroups[bodyPart] = [];
    }
    bodyPartGroups[bodyPart].push({ ...condition, index });
  });

  // Check each body part for potential pyramiding
  Object.entries(bodyPartGroups).forEach(([bodyPart, condList]) => {
    // Left/right pairs of the same body part (e.g. Left Knee + Right Knee)
    // are separately ratable per §4.25/§4.26 — NOT pyramiding. Only flag
    // conditions whose sides can't be ruled out as the same joint, using
    // the same _sidesMayOverlap() overlap check _detectNervePyramiding
    // below already relies on (grouping by exact side string missed the
    // case where one condition's side is unspecified/bilateral and so
    // can't be ruled out as overlapping a same-body-part left/right entry).
    // Union-find over overlapping pairs so an unspecified-side condition
    // correctly pulls a left AND a right entry of the same body part into
    // one warning, since it can't be ruled out as either.
    const parent = condList.map((_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const union = (i, j) => {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[ri] = rj;
    };
    for (let i = 0; i < condList.length; i++) {
      for (let j = i + 1; j < condList.length; j++) {
        if (_sidesMayOverlap(condList[i].side, condList[j].side)) {
          union(i, j);
        }
      }
    }

    const components = {};
    condList.forEach((c, i) => {
      const root = find(i);
      if (!components[root]) components[root] = [];
      components[root].push(c);
    });

    Object.values(components).forEach((group) => {
      if (group.length <= 1) return;
      const sides = new Set(
        group.map((c) =>
          c.side && c.side !== "none" ? c.side : "unspecified",
        ),
      );
      const singleSide = sides.size === 1 ? [...sides][0] : undefined;
      const side =
        singleSide && singleSide !== "unspecified" ? singleSide : undefined;
      const sideSuffix = side ? ` (${side})` : "";
      warnings.push({
        type: "potential_pyramiding",
        severity: "high",
        bodyPart,
        side,
        conditions: group.map((c) => c.name),
        message: `Multiple conditions for ${bodyPart}${sideSuffix}. Verify these rate different manifestations (not the same pain/limitation twice).`,
        regulation: "38 CFR § 4.14",
        guidance:
          "You cannot rate the same manifestation under different diagnostic codes. For example: cervical pain can only be rated once, not under both strain AND arthritis codes.",
        indices: group.map((c) => c.index),
      });
    });
  });

  return warnings;
}

function _detectNervePyramiding(conditions) {
  const warnings = [];
  const nerveConditions = conditions.filter(
    (c) =>
      c.name?.toLowerCase().includes("nerve") ||
      c.name?.toLowerCase().includes("radiculopathy") ||
      c.name?.toLowerCase().includes("neuropathy"),
  );

  nerveConditions.forEach((nerveCondition, idx) => {
    const bodyPart = nerveCondition.bodyPart;
    // Opposite-side conditions of the same body part (Left Hip nerve +
    // Right Hip condition) are separately ratable, not pyramiding — only
    // flag when the nerve condition and the other condition share a side
    // (or side is unspecified/bilateral, where overlap can't be ruled out).
    const otherInSamePart = conditions.filter(
      (c, i) =>
        i !== idx &&
        c.bodyPart === bodyPart &&
        !c.name?.toLowerCase().includes("nerve") &&
        _sidesMayOverlap(nerveCondition.side, c.side),
    );

    if (otherInSamePart.length > 0) {
      warnings.push({
        type: "nerve_pyramiding",
        severity: "high",
        nerveCondition: nerveCondition.name,
        affectedPart: bodyPart,
        otherConditions: otherInSamePart.map((c) => c.name),
        message: `Nerve condition (${nerveCondition.name}) and ${bodyPart} condition may be rating same symptoms.`,
        regulation: "38 CFR § 4.14",
        guidance:
          "You cannot rate both a nerve injury AND the part it supplies for the SAME manifestation (e.g., both radiculopathy and arm weakness from the same nerve damage).",
        indices: [idx, ...otherInSamePart.map((c) => conditions.indexOf(c))],
      });
    }
  });

  return warnings;
}

// Left+right is a genuine pair (no overlap); unspecified/bilateral sides
// can't be ruled out, so they're conservatively treated as possibly overlapping.
function _sidesMayOverlap(sideA, sideB) {
  const a = sideA || "none";
  const b = sideB || "none";
  if (a === "none" || b === "none") return true;
  if (a === "bilateral" || b === "bilateral") return true;
  return a === b;
}

function _detectSpineExtremityPyramiding(conditions) {
  const spineConditions = conditions.filter(
    (c) =>
      c.bodyPart === "cervical-spine" ||
      c.bodyPart === "thoracic-spine" ||
      c.bodyPart === "lumbar-spine" ||
      c.name?.toLowerCase().includes("spine") ||
      c.name?.toLowerCase().includes("cervical") ||
      c.name?.toLowerCase().includes("lumbar"),
  );

  if (spineConditions.length === 0) return [];

  const extremityConditions = conditions.filter((c) =>
    ["shoulder", "arm", "hand", "hip", "leg", "knee", "foot"].includes(
      c.bodyPart,
    ),
  );

  if (extremityConditions.length === 0) return [];

  return [
    {
      type: "spine_extremity_warning",
      severity: "info",
      message:
        "You have both spine and extremity conditions. Ensure extremity issues are independent, not just manifestations of spine pathology.",
      regulation: "38 CFR § 4.14, § 4.71a",
      guidance:
        "Radicular pain (nerve pain radiating down limbs) is rated under spine codes. Separate extremity conditions need independent pathology.",
      affectedConditions: [
        ...spineConditions.map((c) => c.name),
        ...extremityConditions.map((c) => c.name),
      ],
    },
  ];
}

export const detectPyramiding = (conditions) => {
  const warnings = [
    ..._detectBodyPartPyramiding(conditions),
    ..._detectNervePyramiding(conditions),
    ..._detectSpineExtremityPyramiding(conditions),
  ];

  return {
    hasPotentialPyramiding: warnings.length > 0,
    warnings,
    summary:
      warnings.length > 0
        ? `Found ${warnings.length} potential pyramiding issue(s). Review to ensure you're not rating the same manifestation twice.`
        : "No obvious pyramiding issues detected. Note: This is an automated check - verify with 38 CFR schedules.",
  };
};

/**
 * Amputation Special Rules per 38 CFR § 4.66
 * Amputations have minimum guaranteed ratings regardless of prosthetic function
 *
 * @param {string} amputationLevel - Level of amputation
 * @param {string} bodyPart - Which extremity
 * @returns {Object} - Minimum rating and special rules
 */
export const getAmputationMinimumRating = (amputationLevel, _bodyPart) => {
  const amputationRules = {
    // Upper extremity amputations (DC 5120-5127)
    "above-elbow": { minimum: 70, dc: "5124", note: "Amputation above elbow" },
    "below-elbow": { minimum: 60, dc: "5120", note: "Amputation below elbow" },
    "wrist-disarticulation": {
      minimum: 60,
      dc: "5121",
      note: "Disarticulation at wrist",
    },
    hand: { minimum: 60, dc: "5122", note: "Amputation through hand" },
    "all-fingers": { minimum: 50, dc: "5123", note: "Loss of all fingers" },

    // Lower extremity amputations (DC 5160-5174)
    "above-knee": {
      minimum: 60,
      dc: "5160",
      note: "Amputation above knee (AK)",
    },
    "below-knee": {
      minimum: 40,
      dc: "5160",
      note: "Amputation below knee (BK)",
    },
    "ankle-disarticulation": {
      minimum: 40,
      dc: "5170",
      note: "Disarticulation at ankle",
    },
    foot: { minimum: 40, dc: "5171", note: "Amputation through foot" },
    "all-toes": { minimum: 20, dc: "5172", note: "Loss of all toes" },
  };

  const rule = amputationRules[amputationLevel];

  if (!rule) {
    return {
      isAmputation: false,
      minimumRating: null,
      note: "Not an amputation or level not recognized",
    };
  }

  return {
    isAmputation: true,
    minimumRating: rule.minimum,
    diagnosticCode: rule.dc,
    note: rule.note,
    regulation: "38 CFR § 4.66",
    specialRules: [
      "Minimum rating guaranteed regardless of prosthetic function",
      "Loss of use is equivalent to amputation for rating purposes",
      "Bilateral amputations receive bilateral factor (10% boost)",
      "Cannot rate below minimum even with excellent prosthetic adaptation",
    ],
  };
};

/**
 * Reverse calculate: What rating do I need to reach a target?
 */
export const calculateNeededRating = (currentRaw, targetRating) => {
  if (currentRaw >= targetRating) return 0;

  // We need to find X where: currentRaw + X(1 - currentRaw/100) >= targetRating - 5 (to round up)
  const targetRaw = targetRating - 4.5; // Need at least this to round to target
  const remainingEfficiency = 1 - currentRaw / 100;

  if (remainingEfficiency <= 0) return 100;

  const neededRaw = (targetRaw - currentRaw) / remainingEfficiency;

  // Round up to nearest 10 (VA only gives ratings in 10s)
  return Math.min(100, Math.ceil(neededRaw / 10) * 10);
};

export default {
  calculateVARating,
  calculateCompensation,
  calculateWhatIf,
  calculateNeededRating,
  combineTwoRatings,
  combineMultipleRatings,
  roundToNearest10,
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  detectPyramiding,
  checkBilateralFactorCompliance,
  getAmputationMinimumRating,
  VA_PAY_RATES_2026,
  BODY_PARTS,
};
