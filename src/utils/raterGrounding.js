/**
 * Deterministic grounding for the Rater agent: the working shown to the model,
 * the check of its answer against the calculator, and the plain-language
 * replacement used when the answer contradicts the calculator. Pure functions
 * over the result of calculateVARating (vaCalculator.js); nothing here calls a
 * model.
 */

// Same pattern as STATED_COMBINED in scripts/eval/lib/goldenChecks.js. Both are
// pinned by src/__tests__/agentic/eval/fixtures/statedCombinedRatings.json.
const NEAR_FILLER = String.raw`(?:[\s:=*~≈]|\b(?:va|disability|rating|evaluation|is|of|would|be|comes|to|equals|at|rounds|approximately|about|roughly|percentage|calculation|results|in)\b){1,12}?`;
const CLAUSE_WORDS = String.raw`when|if|where|because|since|while|which|that|than|group|step|steps|each`;
const FAR_LINK = String.raw`(?:(?!\b(?:${CLAUSE_WORDS})\b)[^\d.!?\n]){0,100}?(?:\b(?:is|are|was|would be|will be|comes? to|equals?|totals?)\b|\\approx|[:=≈])`;
const STATED_COMBINED = new RegExp(
  String.raw`\b(?:(?:combined|overall|final|total)${NEAR_FILLER}|(?:combined|overall|final)${FAR_LINK})[\s*_~:=≈]*(?:(?:about|approximately|roughly|around|nearly|almost)\b[\s*_~]*)?(\d{1,3}(?:\.\d+)?)\s*(?:\\?%|percent)(?!\s*[+×*/÷]\s*\(?\s*\d)`,
  "gi",
);

/**
 * Every distinct combined-rating figure a response states, in order of first
 * appearance. A figure counts when it follows "combined/overall/final/total"
 * either closely ("combined rating of 70%") or after a short subject phrase
 * and a verb or colon ("The combined rating for the veteran, considering the
 * bilateral factor, is **52%**", "Final Result:** 52%"). Ratings merely listed
 * as inputs, group or step values, and operands of a sum ("20% + 10% = 30%")
 * do not count.
 */
export function extractStatedCombinedRatings(text) {
  const seen = [];
  const source = String(text ?? "");
  STATED_COMBINED.lastIndex = 0;
  let match;
  while ((match = STATED_COMBINED.exec(source)) !== null) {
    const value = Number(match[1]);
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

const pairNames = (calc) => calc.bilateralConditions.map((c) => c.name);

export const describeBilateralPair = (calc) =>
  calc.bilateralConditions.length
    ? calc.bilateralConditions
        .map((c) => `${c.name} (${c.side}, ${c.rating}%)`)
        .join(", ")
    : "none";

const stepLine = (s) => `${s.from}% combined with ${s.with}% = ${s.result}%`;

function bilateralGroupStep(calc) {
  return calc.calculationSteps.find(
    (s) => s.bilateralGroupRating !== undefined,
  );
}

/**
 * The calculator's working as plain lines: the bilateral group (when a pair
 * exists), each combining step in order, the raw value and the single final
 * rounding. Every figure comes from calculateVARating.
 */
export function formatCalculatorWorking(calc) {
  const lines = [];
  const bilateralSteps = calc.combineSteps.filter(
    (s) => s.stage === "bilateral",
  );
  const finalSteps = calc.combineSteps.filter((s) => s.stage === "all");

  if (calc.bilateralConditions.length > 0) {
    const group = bilateralGroupStep(calc);
    lines.push(
      `Bilateral group (${pairNames(calc).join(" and ")}, 38 CFR § 4.26):`,
    );
    bilateralSteps.forEach((s) => lines.push(`  ${stepLine(s)}`));
    lines.push(
      `  Bilateral factor: 10% of ${group.combinedBilateral}% = ${group.bilateralFactor}, so the group rating is ${group.bilateralGroupRating}%`,
    );
  }

  if (finalSteps.length === 0) {
    lines.push(
      `Combining: only one rating to carry forward (${calc.rawScore}%), so there is nothing to combine.`,
    );
  } else {
    lines.push(
      "Combining all ratings, largest first, each step rounded to a whole number (38 CFR § 4.25):",
    );
    finalSteps.forEach((s, i) => lines.push(`  Step ${i + 1}: ${stepLine(s)}`));
  }
  lines.push(
    `Combined value before final rounding: ${calc.rawScore}%`,
    `Rounded once, at the end, to the nearest 10 with a 5 going up (38 CFR § 4.25(b)): ${calc.combinedRating}%`,
  );
  return lines;
}

export function buildComputedResultBlock(calc) {
  return `\n\n=== COMPUTED RESULT (38 CFR § 4.25/4.26 - already calculated, do not recompute) ===
Bilateral pair: ${describeBilateralPair(calc)}
Bilateral group rating: ${calc.bilateralGroupRating || "n/a"}
Working:
${formatCalculatorWorking(calc).join("\n")}
Combined rating: ${calc.combinedRating}%
This result is final. Restate it exactly and explain it. Never recompute it, apply your own bilateral-factor arithmetic, or invent a different pairing.
=== END COMPUTED RESULT ===\n`;
}

const splitSentences = (text) => String(text ?? "").split(/(?<=[.!?])\s+|\n+/);

const NEGATION =
  /\b(?:no|not|none|neither|nor|without|isn't|aren't|doesn't|don't|didn't|cannot|can't|never|n\/a)\b/i;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mentionsName = (sentence, name) =>
  Boolean(name) &&
  new RegExp(`\\b${escapeRegExp(String(name))}\\b`, "i").test(sentence);

/**
 * Sentences that present a bilateral pairing the calculator did not find.
 * With no pair found, any un-negated sentence that mentions "bilateral" next
 * to one of the veteran's conditions counts. With a pair found, a sentence
 * that mentions "bilateral" and a condition outside the pair, and none inside
 * it, counts. Negated sentences ("no bilateral pair", "not applicable") never
 * count. This is a heuristic: it does not parse arbitrary prose.
 */
export function findInventedBilateralClaims(text, calc) {
  const inPair = calc.bilateralConditions.map((c) => c.name);
  const outside = calc.nonBilateralConditions.map((c) => c.name);
  const hits = [];
  for (const raw of splitSentences(text)) {
    const sentence = raw.trim();
    if (!/\bbilateral/i.test(sentence) || NEGATION.test(sentence)) continue;
    const touchesOutside = outside.some((n) => mentionsName(sentence, n));
    if (calc.bilateralConditions.length === 0) {
      if (touchesOutside) hits.push(sentence);
      continue;
    }
    const touchesPair = inPair.some((n) => mentionsName(sentence, n));
    if (touchesOutside && !touchesPair) hits.push(sentence);
  }
  return hits;
}

const CAP_WORDS =
  /\b(?:maximum|max|cannot exceed|can't exceed|cap|limit|up to|at most|no more than)\b/i;

const withoutCapStatements = (text) =>
  splitSentences(text)
    .filter((sentence) => !CAP_WORDS.test(sentence))
    .join("\n");

function workingValues(calc) {
  const values = new Set(calc.combineSteps.map((s) => s.result));
  if (calc.bilateralGroupRating) values.add(calc.bilateralGroupRating);
  values.add(calc.rawScore);
  return values;
}

/**
 * Compare a response with the calculator. A stated combined figure is wrong
 * when it differs from the calculator's rating and is either a multiple of 10
 * (it reads as a final rating) or is not one of the calculator's own working
 * values. Intermediate values from the working are not treated as final
 * claims, and sentences that state a cap ("the maximum is 100%") are ignored.
 */
export function checkRaterResponse(text, calc) {
  const stated = extractStatedCombinedRatings(withoutCapStatements(text));
  const working = workingValues(calc);
  const wrongFigures = stated.filter(
    (v) => v !== calc.combinedRating && (v % 10 === 0 || !working.has(v)),
  );
  const inventedPairs = findInventedBilateralClaims(text, calc);
  return {
    ok: wrongFigures.length === 0 && inventedPairs.length === 0,
    expected: calc.combinedRating,
    stated,
    wrongFigures,
    inventedPairs,
  };
}

/**
 * One plain line carrying the calculator's figure, appended to an answer that
 * never states the combined rating itself.
 */
export const buildCalculatorSummaryLine = (calc) =>
  `Vet-Rate's calculator result for the ratings you entered: your combined rating is ${calc.combinedRating}% (38 CFR § 4.25).`;

export function describeMismatch(check) {
  const parts = [];
  if (check.wrongFigures.length > 0) {
    parts.push(
      `stated combined rating ${check.wrongFigures.join("%, ")}% but the calculator gives ${check.expected}%`,
    );
  }
  if (check.inventedPairs.length > 0) {
    parts.push("presented a bilateral pair the calculator did not find");
  }
  return parts.join("; ");
}

/**
 * Plain-language answer built only from the calculator's working, used when
 * the model's draft contradicts it.
 */
export function buildCalculatorExplanation(calc) {
  const pairNote = calc.bilateralConditions.length
    ? `The bilateral factor applies to ${describeBilateralPair(calc)}: disabilities of paired extremities, one on the left and one on the right (38 CFR § 4.26).`
    : 'No bilateral pair applies. The bilateral factor needs "partial disability of compensable degree in each of 2 paired extremities, or paired skeletal muscles" (38 CFR § 4.26(c)), that is both arms or both legs, one on each side. "Arms" and "legs" mean the upper and lower extremities as a whole, so a right thigh and a left foot are a pair (38 CFR § 4.26(a)). Two conditions on the same side are not a pair, and the two highest ratings are not automatically a pair.';
  return [
    "The AI's draft answer did not match Vet-Rate's calculator, so it is not shown. This is the calculator's working for the ratings you entered.",
    "",
    `Your combined rating is ${calc.combinedRating}%.`,
    "",
    "VA does not add ratings together. It combines them one at a time, so each new rating applies only to the efficiency left after the earlier ones (38 CFR § 4.25).",
    "",
    ...formatCalculatorWorking(calc),
    "",
    pairNote,
    "",
    "Check these figures with a Veterans Service Officer before relying on them.",
  ].join("\n");
}
