/**
 * The calculator's answer to a rating question, in plain language: its
 * working, its notes on the bilateral factor and on entries it left out, and
 * the 38 CFR § 4.16(a) threshold paragraph for a TDIU question. Pure functions
 * over the result of calculateVARating (vaCalculator.js); nothing here calls
 * or reads a model.
 */

import { evaluateTdiuThresholds } from "./smcDetector";

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
  "side-unspecified": (names, one) =>
    `No side is set for ${names}, so ${one ? "it" : "they"} took no bilateral factor; if ${one ? "it is" : "they are"} on a different side from another arm or leg condition, the side needs to be set.`,
  "separate-entry": (names, one) =>
    `${names} ${one ? "has" : "have"} a body part that is not an arm or a leg, so ${one ? "it" : "they"} took no bilateral factor; an arm or leg condition that is rated separately needs its own entry with a body part and side.`,
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

const ASKS_ABOUT_BILATERAL =
  /\bbilateral|\bpair(?:ed|s)?\b|\bboth (?:knees|legs|arms|feet|hands|ankles|hips|shoulders|elbows|wrists|sides)\b/i;

const hasSidedEntry = (calc) =>
  [...calc.nonBilateralConditions, ...calc.bilateralExcludedConditions].some(
    (c) => c.side && c.side !== "none",
  );

/**
 * Whether to say anything about the bilateral factor having no pair. It is
 * noise when no entry has a side and the question does not ask about it. A
 * pair the calculator formed, and its notes on entries left out or treated
 * specially, are always described. With no question given the finding is
 * stated, since nothing shows it was not asked.
 */
const pairFindingIsRelevant = (calc, question) =>
  question === null ||
  calc.bilateralConditions.length > 0 ||
  hasSidedEntry(calc) ||
  ASKS_ABOUT_BILATERAL.test(question);

/**
 * The answer to a rating question, built only from the calculator's result.
 * For a TDIU question the threshold paragraph comes right after the combined
 * rating, ahead of the working, because it is what was asked. `question` is the veteran's text and
 * decides only whether the no-pair finding is worth saying.
 */
export function buildCalculatorExplanation(
  calc,
  { tdiu = false, question = null } = {},
) {
  const pairNote = [
    pairFindingIsRelevant(calc, question) ? describePairFinding(calc) : "",
    ...describeBilateralNotes(calc),
  ]
    .filter(Boolean)
    .join(" ");
  return [
    `Your combined rating is ${calc.combinedRating}%.`,
    tdiu ? buildTdiuThresholdParagraph(calc) : "",
    "VA does not add ratings together. It combines them one at a time, so each new rating applies only to the efficiency left after the earlier ones (38 CFR § 4.25).",
    formatCalculatorWorking(calc).join("\n"),
    pairNote,
    "Check these figures with a Veterans Service Officer before relying on them.",
  ]
    .filter(Boolean)
    .join("\n\n");
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
