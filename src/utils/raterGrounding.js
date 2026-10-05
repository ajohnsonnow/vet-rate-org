/**
 * Deterministic grounding for the Rater agent: the working shown to the model,
 * the check of its answer against the calculator, and the plain-language
 * replacement used when the answer contradicts the calculator. Pure functions
 * over the result of calculateVARating (vaCalculator.js); nothing here calls a
 * model.
 */

import { evaluateTdiuThresholds } from "./smcDetector";

// Same pattern as STATED_COMBINED in scripts/eval/lib/goldenChecks.js. Both are
// pinned by src/__tests__/agentic/eval/fixtures/statedCombinedRatings.json.
const NEAR_FILLER = String.raw`(?:[\s:=*~≈]|\b(?:va|disability|rating|evaluation|is|of|would|be|comes|to|equals|at|rounds|approximately|about|roughly|percentage|calculation|results|in)\b){1,12}?`;
const CLAUSE_WORDS = String.raw`when|if|where|because|since|while|which|that|than|group|step|steps|each`;
const FAR_LINK = String.raw`(?:(?!\b(?:${CLAUSE_WORDS})\b)[^\d.!?\n]){0,100}?(?:\b(?:is|are|was|would be|will be|comes? to|equals?|totals?)\b|\\approx|[:=≈])`;
const STATED_COMBINED = new RegExp(
  String.raw`\b(?:(?:combined|overall|final|total)${NEAR_FILLER}|(?:combined|overall|final)${FAR_LINK})[\s*_~:=≈]*(?:(?:about|approximately|roughly|around|nearly|almost)\b[\s*_~]*)?(\d{1,3}(?:\.\d+)?)\s*(?:\\?%|percent)(?!\s*(?:[+×*/÷]\s*\(?\s*\d|or\s+(?:more|higher|greater|better|above|less|lower)\b))`,
  "gi",
);

/**
 * Every distinct combined-rating figure a response states, in order of first
 * appearance. A figure counts when it follows "combined/overall/final/total"
 * either closely ("combined rating of 70%") or after a short subject phrase
 * and a verb or colon ("The combined rating for the veteran, considering the
 * bilateral factor, is **52%**", "Final Result:** 52%"). Ratings merely listed
 * as inputs, group or step values, operands of a sum ("20% + 10% = 30%") and
 * thresholds ("a combined rating of 70 percent or more") do not count.
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

const withRating = (c) => `${c.name} (${c.rating}%)`;

const joinList = (items) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const namesWhere = (list, test) => list.filter(test).map((c) => c.name);

function describeExcluded(calc) {
  const excluded = calc.bilateralExcludedConditions;
  if (excluded.length === 0) return [];
  const list = joinList(excluded.map(withRating));
  const one = excluded.length === 1;
  if (calc.bilateralConditions.length === 0) {
    return [
      `No bilateral factor was applied: ${list} are bilateral disabilities, and combining them separately gives a higher combined rating than including them in the bilateral factor calculation (38 CFR § 4.26(d)).`,
    ];
  }
  return [
    `${list} ${one ? "is also a bilateral disability" : "are also bilateral disabilities"}, left out of the bilateral factor calculation and combined separately because that gives a higher combined rating (38 CFR § 4.26(d)).`,
  ];
}

const MANUAL = "VA manual M21-1, V.iv.1.C.4.b";

function describeBothSidesMembers(calc) {
  const bothSides = namesWhere(
    calc.bilateralConditions,
    (c) => c.side === "bilateral",
  );
  if (bothSides.length === 0) return [];
  const separate = namesWhere(
    calc.bilateralConditions,
    (c) => c.side !== "bilateral",
  );
  if (separate.length === 0) {
    return [
      `${joinList(bothSides)} are each one evaluation that covers both sides. Vet-Rate treats two such evaluations of the same limbs as separately rated disabilities of those limbs, so together they take the factor; ${MANUAL} does not address this case directly.`,
    ];
  }
  const one = bothSides.length === 1;
  return [
    `${joinList(bothSides)} ${one ? "is" : "are each"} one evaluation that covers both sides; ${one ? "it takes" : "they take"} the factor because ${joinList(separate)} ${separate.length === 1 ? "is" : "are"} rated separately (${MANUAL}).`,
  ];
}

const ISSUE_NOTES = {
  "limb-unknown": (names, one) =>
    `Vet-Rate could not tell whether ${names} ${one ? "is an arm or a leg condition, so it" : "are arm or leg conditions, so they"} took no bilateral factor.`,
  "side-unknown": (names, one) =>
    `Vet-Rate did not recognise the side entered for ${names}, so ${one ? "it" : "they"} took no bilateral factor.`,
  "side-not-set": (names, one) =>
    `${names} ${one ? "names" : "name"} a side, but no side is set on ${one ? "that entry" : "those entries"}, so ${one ? "it" : "they"} took no bilateral factor.`,
  "single-bilateral-evaluation": (names, one) =>
    `${names} ${one ? "is one evaluation that covers both sides, and by itself it takes" : "are each one evaluation that covers both sides, and by themselves they take"} no bilateral factor: the factor needs another separately rated disability of the same limbs (${MANUAL}).`,
};

function describeIssues(issues) {
  const notes = Object.entries(ISSUE_NOTES).flatMap(([reason, sentence]) => {
    const names = namesWhere(issues, (i) => i.reason === reason);
    return names.length > 0
      ? [sentence(joinList(names), names.length === 1)]
      : [];
  });
  if (issues.some((i) => i.reason === "most-favourable-not-checked")) {
    notes.push(
      "Vet-Rate did not check whether leaving some bilateral disabilities out of the bilateral factor calculation would give a higher combined rating (38 CFR § 4.26(d)), because there are too many arrangements to try.",
    );
  }
  return notes;
}

function describeIgnored(ignored) {
  const unread = namesWhere(
    ignored,
    (entry) => entry.reason === "rating-unreadable" && entry.name,
  );
  if (unread.length === 0) return [];
  return [
    `Vet-Rate could not read the rating entered for ${joinList(unread)}, so ${unread.length === 1 ? "it is" : "they are"} not in this result.`,
  ];
}

/**
 * Plain sentences about entries left out of the result, and about entries the
 * bilateral factor treated specially: left
 * out under 38 CFR § 4.26(d), in the group as one evaluation covering both
 * sides, or given no factor because of a calculator `bilateralIssues` entry.
 */
export function describeBilateralNotes(calc) {
  return [
    ...describeExcluded(calc),
    ...describeBothSidesMembers(calc),
    ...describeIssues(calc.bilateralIssues),
    ...describeIgnored(calc.ignoredEntries),
  ];
}

const groupCappedLine = (group) =>
  group.combinedBilateral >= 100
    ? "  Bilateral factor: the group already combines to 100%, so the factor adds nothing and the group rating is 100%"
    : `  Bilateral factor: 10% of ${group.combinedBilateral}% = ${group.combinedBilateral / 10}, but a rating cannot exceed 100%, so the group rating is 100%`;

const stepLine = (s) => `${s.from}% combined with ${s.with}% = ${s.result}%`;

function bilateralGroupStep(calc) {
  return calc.calculationSteps.find(
    (s) => s.bilateralGroupRating !== undefined,
  );
}

/**
 * The calculator's working as plain lines: the bilateral group (when a pair
 * exists), any bilateral disabilities left out of it under 38 CFR § 4.26(d),
 * each combining step in order, the raw value and the single final rounding.
 * Every figure comes from calculateVARating.
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
      group.bilateralFactorCapped
        ? groupCappedLine(group)
        : `  Bilateral factor: 10% of ${group.combinedBilateral}% = ${group.bilateralFactor}, so the group rating is ${group.bilateralGroupRating}%`,
    );
  }
  if (calc.bilateralExcludedConditions.length > 0) {
    lines.push(
      `Bilateral disabilities left out of the factor and combined separately under 38 CFR § 4.26(d): ${joinList(calc.bilateralExcludedConditions.map(withRating))}`,
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
  const notes = describeBilateralNotes(calc);
  return `\n\n=== COMPUTED RESULT (38 CFR § 4.25/4.26 - already calculated, do not recompute) ===
Bilateral pair: ${describeBilateralPair(calc)}
Bilateral group rating: ${calc.bilateralGroupRating || "n/a"}
Working:
${formatCalculatorWorking(calc).join("\n")}
${notes.length > 0 ? `Notes:\n${notes.join("\n")}\n` : ""}Combined rating: ${calc.combinedRating}%
This result is final. Restate it exactly and explain it. Never recompute it, apply your own bilateral-factor arithmetic, or invent a different pairing.
=== END COMPUTED RESULT ===\n`;
}

const splitSentences = (text) => String(text ?? "").split(/(?<=[.!?])\s+|\n+/);

const normalizeWords = (text) =>
  ` ${String(text)
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()} `;

/**
 * Whether a sentence contains any listed word or phrase, compared as whole
 * words with punctuation ignored ("e.g." is "e g").
 */
const mentionsAny = (sentence, { words = [], phrases = [] }) => {
  const text = normalizeWords(sentence);
  return [...words, ...phrases].some((w) => text.includes(normalizeWords(w)));
};

const NEGATION =
  /\b(?:no|not|none|neither|nor|without|isn't|aren't|doesn't|don't|didn't|cannot|can't|never|n\/a)\b/i;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mentionsName = (sentence, name) =>
  Boolean(name) &&
  new RegExp(`\\b${escapeRegExp(String(name))}\\b`, "i").test(sentence);

const EXAMPLE_WORDS = {
  phrases: [
    "e.g.",
    "for example",
    "for instance",
    "such as",
    "an example",
    "example",
    "examples",
  ],
};
const HYPOTHETICAL_WORDS = {
  words: ["if", "unless", "whether", "suppose", "assuming", "assume"],
};
const COMBINING_WORDS = {
  words: ["combine", "combines", "combined", "combining", "remaining", "other"],
};
const GROUP_WORDS = {
  phrases: ["bilateral group", "group rating", "bilateral knees"],
};
const NON_BILATERAL_WORDS = {
  phrases: ["non-bilateral"],
  words: ["nonbilateral"],
};
const PAIR_WORDS = {
  words: ["bilateral", "pair", "paired", "pairs", "pairing"],
};
const PAIRING_VERBS = {
  words: ["pair", "paired", "pairs", "pairing"],
};
const NO_PAIR_FINDING = {
  phrases: [
    "no bilateral",
    "does not apply",
    "do not apply",
    "not applicable",
    "n/a",
    "not applied",
    "not found",
    "not identified",
    "not formed",
  ],
  words: ["none"],
};

/** Sentences about pairing that are not findings about this veteran. */
const isNotAFinding = (sentence) =>
  mentionsAny(sentence, EXAMPLE_WORDS) ||
  mentionsAny(sentence, HYPOTHETICAL_WORDS) ||
  mentionsAny(sentence, NON_BILATERAL_WORDS) ||
  (mentionsAny(sentence, COMBINING_WORDS) &&
    mentionsAny(sentence, GROUP_WORDS));

const namesIn = (sentence, names) =>
  names.filter((n) => mentionsName(sentence, n));

/**
 * Sentences that present, as a finding about this veteran, a bilateral pairing
 * the calculator did not form: a pairing sentence that names a condition
 * outside the formed pair, or (with no pair formed) names two or more of the
 * veteran's conditions. Disabilities left out of the factor under 38 CFR
 * § 4.26(d) are still bilateral disabilities and count as part of the pair.
 * Sentences that are examples ("e.g.", "for example",
 * "such as"), hypotheticals ("if you have"), negations, mentions of the
 * non-bilateral conditions, or that combine the already-formed bilateral group
 * with another condition never count. When the sentence names no condition the
 * check cannot tell and does not fire. A heuristic over sentences, not a
 * parse.
 */
export function findInventedBilateralClaims(text, calc) {
  const inPair = [
    ...calc.bilateralConditions,
    ...calc.bilateralExcludedConditions,
  ].map((c) => c.name);
  const outside = calc.nonBilateralConditions
    .map((c) => c.name)
    .filter((name) => !inPair.includes(name));
  const pairFormed = inPair.length > 0;
  const hits = [];
  for (const raw of splitSentences(text)) {
    const sentence = raw.trim();
    if (!mentionsAny(sentence, PAIR_WORDS) || NEGATION.test(sentence)) continue;
    if (isNotAFinding(sentence)) continue;
    const touchesOutside = namesIn(sentence, outside).length > 0;
    const namedCount = namesIn(sentence, [...inPair, ...outside]).length;
    const sayPaired = mentionsAny(sentence, PAIRING_VERBS);
    const asserts = pairFormed
      ? touchesOutside && (namedCount >= 2 || sayPaired)
      : namedCount >= 2;
    if (asserts) hits.push(sentence);
  }
  return hits;
}

/**
 * Sentences that deny the pair the calculator formed: a negated pairing
 * sentence that names every condition of the pair (and no other condition), or
 * a plain finding such as "no bilateral pair applies". Examples, hypotheticals
 * and sentences about the other conditions never count. Always empty when the
 * calculator formed no pair.
 */
export function findDeniedBilateralClaims(text, calc) {
  const inPair = calc.bilateralConditions.map((c) => c.name);
  if (inPair.length === 0) return [];
  const outside = calc.nonBilateralConditions.map((c) => c.name);
  const hits = [];
  for (const raw of splitSentences(text)) {
    const sentence = raw.trim();
    if (!mentionsAny(sentence, PAIR_WORDS) || !NEGATION.test(sentence))
      continue;
    if (
      mentionsAny(sentence, EXAMPLE_WORDS) ||
      mentionsAny(sentence, HYPOTHETICAL_WORDS)
    ) {
      continue;
    }
    if (namesIn(sentence, outside).length > 0) continue;
    const namesPair = namesIn(sentence, inPair).length === inPair.length;
    const saysNone =
      mentionsAny(sentence, { words: ["bilateral"] }) &&
      mentionsAny(sentence, NO_PAIR_FINDING);
    if (namesPair || saysNone) hits.push(sentence);
  }
  return hits;
}

const CAP_WORDS =
  /\b(?:maximum|max|cannot exceed|can't exceed|cap|limit|up to|at most|no more than)\b/i;

const WHAT_IF =
  /\b(?:adding (?:a|an|another)|if you (?:had|add|added|were|get|got))\b/i;
const NEED_WORDS = {
  words: ["need", "needs", "needed", "require", "requires", "required", "must"],
};
const RATING_THRESHOLD_WORDS = { words: ["threshold", "thresholds"] };
const TDIU_THRESHOLD_FIGURES = new Set([40, 60, 70]);

/** "50% for PTSD, 30% for tinnitus": two or more of the ratings entered. */
function listsEnteredRatings(sentence, calc) {
  const listed = [
    ...calc.bilateralConditions,
    ...calc.nonBilateralConditions,
  ].filter((c) =>
    new RegExp(
      String.raw`\b${c.rating}\s*(?:%|percent)\s+for\s+${escapeRegExp(String(c.name))}\b`,
      "i",
    ).test(sentence),
  );
  return listed.length >= 2;
}

/**
 * Sentences whose figures are not statements of this veteran's combined
 * rating: a cap ("the maximum is 100%"), an example or what-if ("e.g.",
 * "adding a 10% condition would result in"), or a list of the ratings
 * entered.
 */
const isNotOwnRating = (sentence, calc) =>
  CAP_WORDS.test(sentence) ||
  WHAT_IF.test(sentence) ||
  mentionsAny(sentence, EXAMPLE_WORDS) ||
  listsEnteredRatings(sentence, calc);

/**
 * The combined ratings one sentence states. In a sentence that says a
 * threshold is not reached or is needed, the 38 CFR § 4.16(a) figures are the
 * threshold, not the veteran's rating.
 */
function statedInSentence(sentence) {
  const figures = extractStatedCombinedRatings(sentence);
  const namesThreshold =
    mentionsAny(sentence, RATING_THRESHOLD_WORDS) &&
    (NEGATION.test(sentence) || mentionsAny(sentence, NEED_WORDS));
  return namesThreshold
    ? figures.filter((v) => !TDIU_THRESHOLD_FIGURES.has(v))
    : figures;
}

function workingValues(calc) {
  const values = new Set(calc.combineSteps.map((s) => s.result));
  if (calc.bilateralGroupRating) values.add(calc.bilateralGroupRating);
  values.add(calc.rawScore);
  return values;
}

const CALCULATOR_SUBJECT = {
  words: ["calculator", "calculator's"],
  phrases: [
    "computed result",
    "computed block",
    "provided result",
    "provided math",
    "provided text",
    "provided block",
    "provided logic",
    "provided figure",
    "provided figures",
    "provided number",
    "provided numbers",
    "provided calculation",
    "the system",
    "the prompt",
  ],
};
const DISPUTE_WORDS = {
  words: [
    "incorrect",
    "wrong",
    "erroneous",
    "error",
    "errors",
    "mistake",
    "mistakes",
    "mistaken",
    "discrepancy",
    "discrepancies",
    "impossible",
    "inaccurate",
    "flawed",
    "miscalculated",
    "miscalculation",
    "inconsistent",
    "inconsistency",
  ],
  phrases: ["non-standard"],
};
const DISPUTE_DENIED = {
  phrases: [
    "no error",
    "no errors",
    "not an error",
    "no mistake",
    "not a mistake",
    "no discrepancy",
    "no inconsistency",
    "not incorrect",
    "not wrong",
    "not inaccurate",
    "not inconsistent",
    "without error",
  ],
};

/**
 * Sentences that call the computed block wrong: a word such as "incorrect",
 * "error" or "discrepancy" in a sentence that names the calculator, the
 * computed result or the prompt, or that directly follows one. A sentence
 * saying there is no error does not count.
 */
export function findCalculatorDisputes(text) {
  const sentences = splitSentences(text)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.filter(
    (sentence, i) =>
      mentionsAny(sentence, DISPUTE_WORDS) &&
      !mentionsAny(sentence, DISPUTE_DENIED) &&
      (mentionsAny(sentence, CALCULATOR_SUBJECT) ||
        (i > 0 && mentionsAny(sentences[i - 1], CALCULATOR_SUBJECT))),
  );
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Every figure that can follow an equals sign in working that agrees with the
 * calculator: the ratings entered, each combining step written any of the
 * usual ways (a + b x (100 - a) / 100, a + b - a x b / 100, or the remaining
 * efficiency), the bilateral group figures, the raw value and the final
 * rating.
 */
function consistentValues(calc) {
  const values = new Set();
  const add = (...numbers) =>
    numbers.forEach((n) => Number.isFinite(n) && values.add(round2(n)));
  add(10, 100, calc.rawScore, calc.combinedRating);
  for (const c of calcConditions(calc)) add(c.rating, 100 - c.rating);
  for (const { from: a, with: b, result } of calc.combineSteps) {
    const weighted = (b * (100 - a)) / 100;
    const remaining = ((100 - a) * (100 - b)) / 100;
    add(result, 100 - result, a, b, 100 - a, 100 - b);
    add(a / 100, b / 100, (100 - a) / 100, (100 - b) / 100);
    add(weighted, a + weighted, (a * b) / 100);
    add(remaining, remaining / 100, 100 - remaining);
  }
  const group = bilateralGroupStep(calc);
  if (group) {
    add(group.combinedBilateral, group.bilateralFactor);
    add(group.combinedBilateral + group.bilateralFactor);
    add(group.bilateralGroupRating);
  }
  return values;
}

const normalizeMath = (line) =>
  line.replace(/\\(?:times|cdot)/g, "×").replace(/\\%/g, "%");

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const EQUALS_FIGURE = new RegExp(
  String.raw`(?<![<>!=≤≥])=[\s*_\`([]*(\$?)\s*${NUMBER}(,\d{3})?\s*([%$\\]?)`,
  "g",
);
const GAP = String.raw`[^\d+=×*/\n]{0,30}`;
const PLAIN_SUM = new RegExp(
  String.raw`${NUMBER}${GAP}\+${GAP}?${NUMBER}${GAP}=[^\d\n]{0,6}${NUMBER}`,
  "g",
);

function ratingValues(calc) {
  const values = new Set(calcConditions(calc).map((c) => c.rating));
  calc.combineSteps.forEach((s) => values.add(s.result));
  if (calc.bilateralGroupRating) values.add(calc.bilateralGroupRating);
  return values;
}

const isCombiningStep = (calc, a, b, sum) =>
  calc.combineSteps.some(
    (s) =>
      s.result === sum &&
      ((s.from === a && s.with === b) || (s.from === b && s.with === a)),
  );

function lineReworksFigures(line, calc, consistent, ratings) {
  for (const m of line.matchAll(EQUALS_FIGURE)) {
    const [, dollar, digits, thousands, unit] = m;
    const isMoney = thousands !== undefined || (dollar !== "" && unit === "");
    if (!isMoney && !consistent.has(Number(digits))) return true;
  }
  for (const m of line.matchAll(PLAIN_SUM)) {
    const [a, b, sum] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const addsRatings = ratings.has(a) && ratings.has(b) && sum === a + b;
    if (addsRatings && !isCombiningStep(calc, a, b, sum)) return true;
  }
  return false;
}

/**
 * Lines whose arithmetic the calculator did not produce: a figure after an
 * equals sign that is not part of the calculator's working, or two ratings
 * added as a plain sum where the calculator combines them. Lines that are
 * examples or hypotheticals ("e.g.", "for example", "if") and money amounts
 * are not working about this veteran and do not count. A heuristic over
 * lines, not a parse.
 */
export function findReworkedFigures(text, calc) {
  const consistent = consistentValues(calc);
  const ratings = ratingValues(calc);
  const hits = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line.includes("=") || hits.includes(line)) continue;
    if (
      mentionsAny(line, EXAMPLE_WORDS) ||
      mentionsAny(line, HYPOTHETICAL_WORDS)
    ) {
      continue;
    }
    if (lineReworksFigures(normalizeMath(line), calc, consistent, ratings)) {
      hits.push(line);
    }
  }
  return hits;
}

/**
 * Compare a response with the calculator. A stated combined figure is wrong
 * when it differs from the calculator's rating and is either a multiple of 10
 * (it reads as a final rating) or is not one of the calculator's own working
 * values. Intermediate values from the working are not treated as final
 * claims. Figures in a cap ("the maximum is 100%"), an example, a what-if or
 * a list of the ratings entered, and a threshold figure the answer says is
 * not reached, are not statements of the veteran's rating and are ignored.
 * An answer that lands on the right figure is still not ok when it shows
 * working the calculator did not produce (`reworked`) or calls the computed
 * block wrong (`disputes`).
 */
export function checkRaterResponse(text, calc) {
  const sentences = splitSentences(text).filter(
    (sentence) => !isNotOwnRating(sentence, calc),
  );
  const stated = [...new Set(sentences.flatMap(statedInSentence))];
  const working = workingValues(calc);
  const wrongFigures = stated.filter(
    (v) => v !== calc.combinedRating && (v % 10 === 0 || !working.has(v)),
  );
  const wrongFigureSentences = wrongFigures.map(
    (v) =>
      sentences.find((s) => statedInSentence(s).includes(v))?.trim() ?? null,
  );
  const inventedPairs = findInventedBilateralClaims(text, calc);
  const deniedPairs = findDeniedBilateralClaims(text, calc);
  const reworked = findReworkedFigures(text, calc);
  const disputes = findCalculatorDisputes(text);
  return {
    ok:
      wrongFigures.length === 0 &&
      inventedPairs.length === 0 &&
      deniedPairs.length === 0 &&
      reworked.length === 0 &&
      disputes.length === 0,
    expected: calc.combinedRating,
    stated,
    wrongFigures,
    wrongFigureSentences,
    inventedPairs,
    deniedPairs,
    reworked,
    disputes,
  };
}

export function describeMismatch(check, tdiuCheck = null) {
  const parts = [];
  if (check.wrongFigures.length > 0) {
    const quote = (check.wrongFigureSentences ?? []).find(Boolean);
    parts.push(
      `stated combined rating ${check.wrongFigures.join("%, ")}% but the calculator gives ${check.expected}%${
        quote ? ` (from: "${quote.slice(0, 140)}")` : ""
      }`,
    );
  }
  if (check.inventedPairs.length > 0) {
    parts.push("presented a bilateral pair the calculator did not find");
  }
  if (check.deniedPairs?.length > 0) {
    parts.push("denied the bilateral pair the calculator found");
  }
  if (check.reworked?.length > 0) {
    parts.push(
      `showed working the calculator did not produce (from: "${check.reworked[0].slice(0, 140)}")`,
    );
  }
  if (check.disputes?.length > 0) {
    parts.push(
      `disputed the computed result (from: "${check.disputes[0].slice(0, 140)}")`,
    );
  }
  if (tdiuCheck?.contradicted) {
    const { eligible, highest, combined } = tdiuCheck.thresholds;
    const said = tdiuCheck.direction === "denies" ? "not met" : "met";
    const is = eligible ? "are met" : "are not met";
    parts.push(
      `said the 38 CFR § 4.16(a) percentage thresholds are ${said} but they ${is} (highest rating ${highest}%, combined ${combined}%)`,
    );
  }
  return parts.join("; ");
}

const NOTICE_FIGURES =
  "stated a combined rating that did not match Vet-Rate's calculator";
const NOTICE_PAIR =
  "described a bilateral pairing that did not match Vet-Rate's calculator";
const NOTICE_DENIED_PAIR =
  "denied a bilateral pairing that Vet-Rate's calculator found";
const NOTICE_WORKING =
  "showed working that did not match Vet-Rate's calculator";
const NOTICE_DISPUTE = "questioned the result from Vet-Rate's calculator";
const NOTICE_TDIU =
  "gave a TDIU conclusion that did not match the percentage thresholds of 38 CFR § 4.16(a) applied to the ratings you entered";

/**
 * The sentence shown to the veteran when an answer is replaced. It names only
 * what actually fired. With no check supplied it is the combined-rating
 * wording, the original reason for replacement.
 */
export function buildReplacementNotice(check = null, tdiuCheck = null) {
  const reasons = [];
  if (!check || check.wrongFigures.length > 0) reasons.push(NOTICE_FIGURES);
  if (check?.inventedPairs.length > 0) reasons.push(NOTICE_PAIR);
  if (check?.deniedPairs?.length > 0) reasons.push(NOTICE_DENIED_PAIR);
  if (check?.reworked?.length > 0) reasons.push(NOTICE_WORKING);
  if (check?.disputes?.length > 0) reasons.push(NOTICE_DISPUTE);
  if (tdiuCheck?.contradicted) reasons.push(NOTICE_TDIU);
  if (reasons.length === 0) reasons.push("did not match Vet-Rate's calculator");
  return `The AI's draft answer ${reasons.join(" and ")}, so it is not shown. This is the calculator's working for the ratings you entered.`;
}

export const TDIU_REGULATION_QUOTES = {
  thresholds:
    "if there is only one such disability, this disability shall be ratable at 60 percent or more, and that, if there are two or more disabilities, there shall be at least one disability ratable at 40 percent or more, and sufficient additional disability to bring the combined rating to 70 percent or more",
  asOne: "the following will be considered as one disability",
  commonOrigin:
    "disabilities resulting from common etiology or a single accident",
  singleSystem: "disabilities affecting a single body system",
  unable:
    "unable to secure or follow a substantially gainful occupation as a result of service-connected disabilities",
  judgment: "in the judgment of the rating agency",
  extraSchedular:
    "all cases of veterans who are unemployable by reason of service-connected disabilities, but who fail to meet the percentage standards set forth in paragraph (a) of this section",
};

export const mentionsUnemployability = (prompt) =>
  /\btdiu\b|unemployab/i.test(String(prompt ?? ""));

const calcConditions = (calc) => [
  ...calc.bilateralConditions,
  ...calc.nonBilateralConditions,
];

/**
 * The percentage test of 38 CFR § 4.16(a) applied to the calculator's
 * conditions and combined rating: { eligible, basis, highest, combined }.
 */
export function tdiuThresholdsFor(calc) {
  const highest = Math.max(...calcConditions(calc).map((c) => c.rating));
  const combined = calc.combinedRating;
  return { ...evaluateTdiuThresholds(highest, combined), highest, combined };
}

const TDIU_SUBJECT = {
  words: ["tdiu", "unemployability", "unemployable"],
  phrases: ["4.16(a)", "4.16"],
};
const AUXILIARIES = ["do not", "does not", "don't", "doesn't"];
const NEGATIVE_VERBS = ["qualify", "meet", "satisfy"];
const TDIU_NEGATIVE = {
  phrases: [
    "not eligible",
    "not currently eligible",
    "cannot qualify",
    "can't qualify",
    "cannot currently qualify",
    "fails to meet",
    "fail to meet",
    "fails to satisfy",
    "is insufficient",
    "are insufficient",
    "falls short",
    "fall short",
    "unlikely to qualify",
    "unlikely to be eligible",
    "not likely to qualify",
    "will not qualify",
    "would not qualify",
    "won't qualify",
    "wouldn't qualify",
    "likely not eligible",
    "probably not eligible",
    ...AUXILIARIES.flatMap((aux) =>
      NEGATIVE_VERBS.flatMap((v) => [`${aux} ${v}`, `${aux} currently ${v}`]),
    ),
  ],
  words: ["ineligible"],
};
const SUBJECTS = ["you", "the veteran", "veteran"];
const BE_FORMS = ["are", "is", "would be", "will be"];
const ADVERBS = ["", "fully ", "likely ", "currently "];
const TDIU_POSITIVE = {
  phrases: [
    ...SUBJECTS.flatMap((subject) =>
      BE_FORMS.flatMap((be) =>
        ADVERBS.map((adverb) => `${subject} ${be} ${adverb}eligible`),
      ),
    ),
    "is eligible",
    "are eligible",
    "you qualify",
    "you do qualify",
    "you would qualify",
    "you would indeed qualify",
    "you can qualify",
    "you meet",
    "you do meet",
    "you satisfy",
    "meets the",
    "meets this",
    "meets that",
    "meets one",
    "meets both",
    "meets either",
    "likely qualify",
    "probably qualify",
    "likely eligible",
    "probably eligible",
  ],
  words: ["qualifies", "yes"],
};
const THRESHOLD_SUBJECT = {
  words: ["threshold", "thresholds"],
  phrases: [
    "percentage standard",
    "percentage standards",
    "percentage requirement",
    "percentage requirements",
    "percentage test",
    "percentage criteria",
    "schedular requirement",
    "schedular requirements",
    "schedular criteria",
  ],
};
const THRESHOLD_NEGATIVE = {
  phrases: [
    "not meet",
    "not met",
    "not satisfy",
    "not satisfied",
    "unlikely to meet",
    "unlikely to satisfy",
  ],
};
const THRESHOLD_POSITIVE = {
  phrases: [
    "is met",
    "are met",
    "is satisfied",
    "are satisfied",
    ...["likely", "probably", "may", "might", "should"].flatMap((w) => [
      `${w} meet`,
      `${w} meets`,
    ]),
    "appear to meet",
    "appears to meet",
    "seem to meet",
    "seems to meet",
  ],
};
const CONDITIONAL = { words: ["if", "unless", "until", "without", "whether"] };
const EXTRA_SCHEDULAR = {
  phrases: ["4.16(b)", "paragraph (b)", "extra-schedular", "extraschedular"],
};
const TDIU_HEDGE = {
  words: [
    "if",
    "unless",
    "until",
    "without",
    "alone",
    "automatic",
    "automatically",
    "unable",
    "inability",
    "capable",
    "employment",
    "evidence",
    "consider",
    "consideration",
    "apply",
    "file",
    "must",
    "need",
    "needs",
    "require",
    "requires",
    "required",
    "should",
    "may",
    "might",
    "could",
    "depend",
    "depends",
  ],
  phrases: ["able to work", "determination of", "first step"],
};
const SINGLE_TEST = {
  words: ["single", "sixty", "60"],
  phrases: ["one disability", "one condition", "path a", "first"],
};
const COMBINED_TEST = {
  words: ["multiple", "second", "70", "40", "forty", "additional"],
  phrases: ["two or more", "path b"],
};
const COMBINED_WORD = { words: ["combined"] };

const plainSentences = (text) =>
  splitSentences(String(text ?? "").replace(/[*_`#>]/g, ""));

function isEligibilityHeadline(sentence) {
  const colon = sentence.indexOf(":");
  return colon > 0 && /eligib/i.test(sentence.slice(0, colon));
}

const isThresholdStatement = (sentence) =>
  mentionsAny(sentence, THRESHOLD_SUBJECT);

/**
 * A sentence about the percentage thresholds is a conclusion however it is
 * hedged ("may not meet", "it appears"), because whether they are met is
 * arithmetic. Only a real condition ("if", "unless") excuses it, or "alone"
 * when one rating alone is not what met them. Any other TDIU sentence keeps
 * the wider excuses: unemployability, evidence and possibility.
 */
function isTdiuConclusionSentence(sentence, thresholds) {
  if (mentionsAny(sentence, EXTRA_SCHEDULAR)) return false;
  if (isThresholdStatement(sentence)) {
    if (mentionsAny(sentence, CONDITIONAL)) return false;
    return (
      thresholds.basis === "single60" ||
      !mentionsAny(sentence, { words: ["alone"] })
    );
  }
  return (
    (mentionsAny(sentence, TDIU_SUBJECT) || isEligibilityHeadline(sentence)) &&
    !mentionsAny(sentence, TDIU_HEDGE)
  );
}

const saysNotMet = (sentence) =>
  mentionsAny(sentence, TDIU_NEGATIVE) ||
  (isThresholdStatement(sentence) && mentionsAny(sentence, THRESHOLD_NEGATIVE));

const saysMet = (sentence) =>
  mentionsAny(sentence, TDIU_POSITIVE) ||
  (isThresholdStatement(sentence) && mentionsAny(sentence, THRESHOLD_POSITIVE));

/**
 * True when a denial is not a denial of the result: the sentence also affirms
 * a test, or it speaks about the test the result did not rest on and that
 * test is in fact not met. "Combined" by
 * itself does not make a sentence about the two-or-more test when the sentence
 * also names the single-disability test ("your combined rating is 60%, so the
 * single rating does not meet the threshold").
 */
function isAboutUnmetOtherTest(sentence, thresholds) {
  const { basis, highest, combined } = thresholds;
  if (basis === "combined70") return mentionsAny(sentence, SINGLE_TEST);
  if (basis !== "single60") return false;
  const affirmsOneTest =
    mentionsAny(sentence, TDIU_POSITIVE) ||
    mentionsAny(sentence, THRESHOLD_POSITIVE);
  if (affirmsOneTest) return true;
  if (highest >= 40 && combined >= 70) return false;
  return (
    mentionsAny(sentence, COMBINED_TEST) ||
    (mentionsAny(sentence, COMBINED_WORD) &&
      !mentionsAny(sentence, SINGLE_TEST))
  );
}

/**
 * Whether an answer states an overall TDIU conclusion on the percentage test
 * that contradicts evaluateTdiuThresholds for these conditions: "not eligible",
 * "cannot qualify", "does not meet" when the thresholds are met; "eligible",
 * "qualifies", "meets" when they are not. A hedged sentence about the
 * thresholds themselves ("may not meet", "it appears the thresholds are not
 * met", "likely meets") counts. Sentences that hedge overall eligibility on
 * unemployability, evidence or a condition ("if", "alone", "must", "may"),
 * that speak only about a test that is in fact not met, that are about
 * extra-schedular consideration, or that are not about TDIU, are not
 * conclusions. A heuristic over sentences, not a parse.
 */
export function checkTdiuConclusion(text, calc) {
  const thresholds = tdiuThresholdsFor(calc);
  const contradicts = thresholds.eligible
    ? (s) => saysNotMet(s) && !isAboutUnmetOtherTest(s, thresholds)
    : (s) => saysMet(s) && !NEGATION.test(s);
  const sentences = plainSentences(text)
    .map((s) => s.trim())
    .filter((s) => isTdiuConclusionSentence(s, thresholds))
    .filter(contradicts);
  const contradicted = sentences.length > 0;
  let direction = null;
  if (contradicted) direction = thresholds.eligible ? "denies" : "asserts";
  return { contradicted, direction, sentences, thresholds };
}

function describeTdiuResult(calc, conditions) {
  const highest = Math.max(...conditions.map((c) => c.rating));
  const top = conditions.find((c) => c.rating === highest);
  const combined = calc.combinedRating;
  const { basis } = evaluateTdiuThresholds(highest, combined);
  const several = conditions.length > 1;
  const second =
    highest >= 40 && combined >= 70
      ? `The threshold for two or more disabilities is also met: at least one condition is rated 40 percent or more and your combined rating is ${combined} percent.`
      : `The threshold for two or more disabilities is not met on these ratings: it needs a combined rating of 70 percent or more together with one condition at 40 percent or more, and your combined rating is ${combined} percent.`;

  if (basis === "single60") {
    const lead = `${top.name} is rated ${highest} percent, which meets the threshold for a single disability`;
    return several
      ? `${lead}, if that is the only disability you rely on for unemployability. ${second}`
      : `${lead}.`;
  }
  if (basis === "combined70") {
    return `No condition is rated 60 percent or more (the highest is ${highest} percent), so the threshold for a single disability is not met. At least one condition is rated 40 percent or more and your combined rating is ${combined} percent, so the threshold for two or more disabilities is met.`;
  }
  return `On the ratings you entered neither threshold is met: no condition is rated 60 percent or more (the highest is ${highest} percent), and ${
    highest >= 40
      ? `your combined rating, ${combined} percent, is below the 70 percent figure`
      : "no condition is rated 40 percent or more"
  }. Paragraph (b) of the same section directs rating boards to submit for extra-schedular consideration "${TDIU_REGULATION_QUOTES.extraSchedular}".`;
}

/**
 * Deterministic paragraph for a veteran who asked about TDIU: whether the
 * percentage thresholds of 38 CFR § 4.16(a) are met for the supplied
 * conditions, quoting the regulation, and what the percentage cannot settle.
 */
export const TDIU_PARAGRAPH_LEAD =
  "About your question on individual unemployability (TDIU):";

export function buildTdiuThresholdParagraph(calc) {
  const conditions = [
    ...calc.bilateralConditions,
    ...calc.nonBilateralConditions,
  ];
  const q = TDIU_REGULATION_QUOTES;
  return [
    TDIU_PARAGRAPH_LEAD,
    `38 CFR § 4.16(a) sets these percentage thresholds: "${q.thresholds}".`,
    describeTdiuResult(calc, conditions),
    `For the one 60 percent or one 40 percent disability, 38 CFR § 4.16(a) says "${q.asOne}": disabilities of one or both upper extremities or of one or both lower extremities (including the bilateral factor, if applicable), "${q.commonOrigin}", "${q.singleSystem}", multiple injuries incurred in action, and multiple disabilities incurred as a prisoner of war. Vet-Rate does not evaluate these groupings, so the result above treats each condition separately.`,
    `The percentage is only one part. 38 CFR § 4.16(a) also requires that the person be "${q.unable}", "${q.judgment}". Vet-Rate cannot determine that.`,
  ].join("\n\n");
}

/**
 * Plain-language answer built only from the calculator's working, used when
 * the model's draft contradicts it.
 */
export function buildCalculatorExplanation(
  calc,
  { tdiu = false, check = null, tdiuCheck = null } = {},
) {
  const pairNote = [describePairFinding(calc), ...describeBilateralNotes(calc)]
    .filter(Boolean)
    .join(" ");
  return [
    buildReplacementNotice(check, tdiuCheck),
    "",
    `Your combined rating is ${calc.combinedRating}%.`,
    "",
    "VA does not add ratings together. It combines them one at a time, so each new rating applies only to the efficiency left after the earlier ones (38 CFR § 4.25).",
    "",
    ...formatCalculatorWorking(calc),
    "",
    pairNote,
    "",
    ...(tdiu ? [buildTdiuThresholdParagraph(calc), ""] : []),
    "Check these figures with a Veterans Service Officer before relying on them.",
  ].join("\n");
}

function describeGroupBasis(calc) {
  if (calc.bilateralLimbs.length > 1) {
    return "compensable disabilities of both arms and both legs, whose ratings are combined together before the factor is added once (38 CFR § 4.26(b))";
  }
  const count = (side) =>
    calc.bilateralConditions.filter((c) => c.side === side).length;
  const [left, right, both] = ["left", "right", "bilateral"].map(count);
  if (left === 1 && right === 1 && both === 0) {
    return "disabilities of paired extremities, one on the left and one on the right (38 CFR § 4.26)";
  }
  const limbs = calc.bilateralLimbs[0] === "upper" ? "arms" : "legs";
  const held = [
    [left, "on the left"],
    [right, "on the right"],
    [both, "rated for both sides"],
  ]
    .filter(([n]) => n > 0)
    .map(([n, where]) => `${n} ${where}`);
  return `compensable disabilities of both ${limbs}: ${joinList(held)} (38 CFR § 4.26)`;
}

function describePairFinding(calc) {
  if (calc.bilateralConditions.length > 0) {
    return `The bilateral factor applies to ${describeBilateralPair(calc)}: ${describeGroupBasis(calc)}.`;
  }
  if (calc.bilateralExcludedConditions.length > 0) return "";
  return 'No bilateral pair applies. The bilateral factor needs "partial disability of compensable degree in each of 2 paired extremities, or paired skeletal muscles" (38 CFR § 4.26(c)), that is both arms or both legs, one on each side. "Arms" and "legs" mean the upper and lower extremities as a whole, so a right thigh and a left foot are a pair (38 CFR § 4.26(a)). Two conditions on the same side are not a pair, and the two highest ratings are not automatically a pair.';
}
