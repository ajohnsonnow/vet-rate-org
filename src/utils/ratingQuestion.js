/**
 * Rating arithmetic never comes from a model. A question that asks for a
 * combined rating, a bilateral factor result or the TDIU percentage
 * thresholds is answered here: from the calculator when ratings were supplied
 * or can be read from the question with certainty, and otherwise by a fixed
 * answer that asks for them. Pure functions; nothing here calls a model.
 */

import { calculateVARating } from "./vaCalculator";
import {
  TDIU_REGULATION_QUOTES,
  buildCalculatorAnswer,
  mentionsUnemployability,
} from "./raterGrounding";

const COMBINED_RATING_QUESTION = [
  /\bcombined (?:disability |va )?ratings?\b/i,
  /\b(?:total|overall) (?:disability |va )?rating\b/i,
  /\bbilateral factor\b|\bva math\b/i,
  /\bratings?\b[^.?!]*\bcombin(?:e|es|ed)\b/i,
  /\bcombin(?:e|es|ed|ing)\b[^.?!]*\bratings?\b/i,
];

// A TDIU question is a calculation only when it asks about the percentages.
// How to apply, or which form to use, is for the model.
const TDIU_THRESHOLD_QUESTION =
  /\beligib|\bqualif|\bentitle|\bthreshold|\bpercent|%|\bmeet\b|\bratings?\b|\benough\b/i;

export function asksRatingArithmetic(question) {
  const text = String(question ?? "");
  if (COMBINED_RATING_QUESTION.some((pattern) => pattern.test(text))) {
    return true;
  }
  return mentionsUnemployability(text) && TDIU_THRESHOLD_QUESTION.test(text);
}

/*
 * Words that mean a percentage in the question may not be a rating the
 * veteran holds: a hypothetical, a change, a bound, an example, or one figure
 * shared between conditions. Any of them sends the question to the fixed
 * answer instead of a guess.
 */
const NOT_PLAIN_RATINGS = [
  /\bwhat if\b|\bsuppos|\bhypothetic|\bexample\b|\be\.g\b|\binstead of\b/i,
  /\bincreas|\bdecreas|\brais(?:e|es|ed|ing)\b|\breduc|\bwent\b|\bgoes\b/i,
  /\bgets?\b|\bgot\b|\bawarded\b|\bpending\b|\bexpect|\bhop(?:e|ing)\b/i,
  /\bmight\b|\bbetween\b|\bat least\b|\bminimum\b|\bmaximum\b|\bor\b/i,
  /\beach\b|\bboth\b|\bfrom \d|\bapproximately\b|\babout \d|\baround \d/i,
  /\bdenied\b|\bpreviously\b|\bformerly\b|\bused to\b|\bpropos|\bappeal/i,
  /\bclaiming\b|\bshould\b|\bdeserve|\bnot\b|n['’]t\b|\bno\b|\bnever\b/i,
];

const SEGMENT_BREAK = /[,;\n]|\s(?:and|plus)\s|\s[&+]\s|[.?!](?:\s|$)/i;
const HAS_DIGIT = /\d/;
const ONE_PERCENT = /^(.*?)(\d{1,3}(?:\.\d+)?)\s?(?:%|percent\b)(.*)$/is;
const ANY_PERCENT = /\d\s?(?:%|percent\b)/gi;

const COUNT_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
const FILLER_BEFORE = new Set([
  "my",
  "a",
  "an",
  "the",
  "only",
  "just",
  "also",
  "another",
  "with",
  "for",
  "at",
  "i",
  "have",
  "then",
]);
const LEAD_MARKERS = new Set([
  "are",
  "is",
  "have",
  "has",
  "with",
  "for",
  "of",
  "include",
  "includes",
  "including",
]);
const CONNECTOR_AFTER_NAME =
  /\s(?:rated at|rated as|rated|evaluated at|at|is|was|of)$|\s?[:=(-]$/i;
const NAME_LEAD = /^(?:(?:for|my|a|an|the|of|in|on)\s)+/i;
const NAME_TAIL =
  /(?:\s(?:ratings?|disability|disabilities|conditions?|claim|disabling|rated))+$/i;
const GENERIC_ONLY = /^(?:disability )?ratings?$/i;
const NAME_WORD = /^[a-z][a-z'’/-]*$/i;
const NAME_STOP_WORDS = new Set(
  "rating ratings combined total overall percent bilateral factor tdiu unemployability unemployable threshold thresholds pay compensation month monthly more less higher lower least than to from if would could should will can do does did need needs require required qualify qualifies eligible entitled mean means i you we they it what how why when which who is are was were be am my your and or but so that this these those calculate combine combines explain analyze math work works".split(
    " ",
  ),
);
const MAX_NAME_WORDS = 4;
const MAX_UNNAMED = 10;
const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

const words = (text) => text.trim().split(/\s+/).filter(Boolean);

function trimChars(text, chars) {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start += 1;
  while (end > start && chars.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}
const EDGE_PUNCTUATION = " \t\n:(-.?!)";

function cleanName(raw) {
  const name = trimChars(raw, EDGE_PUNCTUATION)
    .replace(NAME_LEAD, "")
    .replace(NAME_TAIL, "")
    .trim();
  const parts = words(name);
  const valid =
    parts.length > 0 &&
    parts.length <= MAX_NAME_WORDS &&
    parts.every(
      (word) =>
        NAME_WORD.test(word) && !NAME_STOP_WORDS.has(word.toLowerCase()),
    );
  return valid ? name : null;
}

function readRating(figure) {
  const rating = Number(figure);
  return Number.isInteger(rating) && rating <= 100 && rating % 10 === 0
    ? rating
    : null;
}

/*
 * The words before a rating that comes first ("only one 60% mental health").
 * In the first item anything may lead in; later items may carry only filler.
 * The last word may be a count.
 */
function readLead(before, isFirst) {
  const lead = words(trimChars(before, EDGE_PUNCTUATION));
  const count = COUNT_WORDS[lead.at(-1)?.toLowerCase()];
  const rest = count ? lead.slice(0, -1) : lead;
  const acceptable =
    isFirst || rest.every((word) => FILLER_BEFORE.has(word.toLowerCase()));
  return acceptable ? { count: count ?? null } : null;
}

function ratingFirstItem(before, after, isFirst) {
  const lead = readLead(before, isFirst);
  if (!lead) return null;
  const tail = trimChars(after, EDGE_PUNCTUATION);
  if (GENERIC_ONLY.test(tail)) {
    return lead.count ? { name: null, count: lead.count, counted: true } : null;
  }
  const name = cleanName(tail);
  if (!name || (lead.count ?? 1) > 1) return null;
  return { name, count: 1 };
}

// In the first item the condition is what follows the last lead-in marker:
// a colon, or a word such as "are", "have" or "for".
function nameAfterLead(text) {
  const colon = text.lastIndexOf(":");
  if (colon !== -1)
    return { lead: text.slice(0, colon), name: text.slice(colon + 1) };
  const parts = words(text);
  const at = parts.findLastIndex((word) =>
    LEAD_MARKERS.has(word.toLowerCase()),
  );
  return {
    lead: parts.slice(0, at + 1).join(" "),
    name: parts.slice(at + 1).join(" "),
  };
}

function nameFirstItem(before, isFirst) {
  const stripped = before.trim().replace(CONNECTOR_AFTER_NAME, "");
  const { lead, name: rawName } = isFirst
    ? nameAfterLead(stripped)
    : { lead: "", name: stripped };
  if (rawName.trim() === "") {
    const listed = !isFirst || /\bratings?\b/i.test(lead);
    return listed ? { name: null, count: 1, counted: false } : null;
  }
  const name = cleanName(rawName);
  return name ? { name, count: 1 } : null;
}

function readItem(segment, isFirst) {
  const match = ONE_PERCENT.exec(segment);
  const rating = readRating(match[2]);
  if (rating === null || HAS_DIGIT.test(match[1])) return null;
  const afterText = trimChars(match[3], EDGE_PUNCTUATION);
  const item =
    afterText === ""
      ? nameFirstItem(match[1], isFirst)
      : ratingFirstItem(match[1], match[3], isFirst);
  return item && { ...item, rating };
}

function readItems(text) {
  const items = [];
  for (const segment of text.split(SEGMENT_BREAK)) {
    const percents = segment.match(ANY_PERCENT)?.length ?? 0;
    if (percents === 0 && !HAS_DIGIT.test(segment)) continue;
    if (percents !== 1) return null;
    const item = readItem(segment, items.length === 0);
    if (!item) return null;
    items.push(item);
  }
  return items;
}

/*
 * A bare figure ("50% and 30%") is a rating only in a list of nothing but
 * bare figures. A counted one ("three 20% ratings") says what it is, so it
 * may stand beside named ratings; a single rating with no condition needs
 * that count to be read at all.
 */
function itemsAreUnambiguous(items) {
  if (items.length === 0) return false;
  const bare = items.filter((item) => item.name === null && !item.counted);
  if (bare.length > 0 && bare.length !== items.length) return false;
  return bare.length !== 1;
}

const sideOf = (name) => /\b(left|right)\b/i.exec(name)?.[1].toLowerCase();

function toConditions(items) {
  const conditions = [];
  let unnamed = 0;
  for (const item of items) {
    for (let i = 0; i < item.count; i += 1) {
      if (item.name === null) {
        if (unnamed >= MAX_UNNAMED) return null;
        conditions.push({
          name: `The ${ORDINALS[unnamed]} rating listed`,
          rating: item.rating,
          listedWithoutCondition: true,
        });
        unnamed += 1;
      } else {
        conditions.push({
          name: item.name,
          rating: item.rating,
          side: sideOf(item.name),
        });
      }
    }
  }
  return conditions;
}

/**
 * The ratings a question lists, when every percentage in it is plainly a
 * rating the veteran holds: tied to a condition ("50% PTSD", "back 20%") or
 * listed as ratings ("my ratings are 50%, 30% and 10%", "three 20% ratings").
 * Returns `{ conditions, sidesGiven }`, or null when anything in the question
 * is not certain. A side is taken only from the word left or right.
 */
export function parseRatingsFromQuestion(question) {
  if (typeof question !== "string" || !HAS_DIGIT.test(question)) return null;
  if (NOT_PLAIN_RATINGS.some((pattern) => pattern.test(question))) return null;
  const items = readItems(question);
  if (!items || !itemsAreUnambiguous(items)) return null;
  const conditions = toConditions(items);
  if (!conditions) return null;
  return { conditions, sidesGiven: conditions.some((c) => c.side) };
}

const joinList = (items) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** The sentence that says exactly which ratings were read from the question. */
export function describeQuestionRatings({ conditions, sidesGiven }) {
  const list = joinList(
    conditions.map((c) =>
      c.listedWithoutCondition ? `${c.rating}%` : `${c.name} ${c.rating}%`,
    ),
  );
  const sides = sidesGiven
    ? "Sides were taken from the words left and right; your question gave no body part, so Vet-Rate read it from the condition's name."
    : "Your question gave no side or body part for them, so no bilateral factor was applied.";
  return `This uses the ratings read from your question: ${list}. ${sides}`;
}

export const NEEDS_RATINGS_LEAD =
  "Vet-Rate works out combined ratings, the bilateral factor and the TDIU percentage thresholds with its calculator, not with the AI, so the figures are computed the same way every time. To answer this it needs your ratings, and it could not read a clear list of them in your question.";

const NEEDS_RATINGS_STEPS = [
  "You can do either of these:",
  "- Open the Rating Calculator and enter each condition with its rating. For an arm or leg condition, add the body part and the side so the bilateral factor can be checked.",
  '- Ask again and list each rating with its condition, for example: "50% PTSD, 30% migraines and 10% tinnitus".',
].join("\n");

const NEEDS_RATINGS_SAVED =
  'If you save your ratings in My Ratings, you can also ask "What is my combined rating?" and Vet-Rate will use them.';

const HOW_RATINGS_COMBINE =
  "How the calculation works: VA does not add ratings together. It combines them one at a time, so each new rating applies only to the efficiency left after the earlier ones, and the result is rounded once at the end to the nearest 10 (38 CFR § 4.25).";

const tdiuThresholdsQuoted = () =>
  `For TDIU, 38 CFR § 4.16(a) sets these percentage thresholds: "${TDIU_REGULATION_QUOTES.thresholds}". It also requires that the person be "${TDIU_REGULATION_QUOTES.unable}". Vet-Rate can check your ratings against the percentages once it has them; it cannot decide unemployability.`;

/**
 * The fixed answer to a rating question that came with no ratings Vet-Rate
 * could use. It states no figure of the veteran's and works nothing out.
 */
export function buildNeedsRatingsAnswer(question) {
  return [
    NEEDS_RATINGS_LEAD,
    NEEDS_RATINGS_STEPS,
    NEEDS_RATINGS_SAVED,
    mentionsUnemployability(question)
      ? tdiuThresholdsQuoted()
      : HOW_RATINGS_COMBINE,
  ].join("\n\n");
}

function calculate(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) return null;
  const calc = calculateVARating(conditions);
  const used =
    calc.bilateralConditions.length + calc.nonBilateralConditions.length;
  return used > 0 ? calc : null;
}

function answerFromQuestion(question) {
  const parsed = parseRatingsFromQuestion(question);
  const calc = parsed && calculate(parsed.conditions);
  if (!calc) return null;
  return {
    text: [
      describeQuestionRatings(parsed),
      buildCalculatorAnswer(calc, question),
    ].join("\n\n"),
    calculatorLead: { expected: calc.combinedRating },
    ratingsSource: "question",
  };
}

/**
 * The answer to a call on the rater's route, without a model, or null when
 * the call is not a calculation and may go to one. Supplied conditions are
 * used first. With `recognise`, a question that asks for rating arithmetic is
 * answered from the ratings it lists, or by the fixed request for ratings.
 */
export function answerRatingQuestion(
  question,
  conditions,
  { recognise = false } = {},
) {
  const calc = calculate(conditions);
  if (calc) {
    return {
      text: buildCalculatorAnswer(calc, question),
      calculatorLead: { expected: calc.combinedRating },
      ratingsSource: "supplied",
    };
  }
  if (!recognise || !asksRatingArithmetic(question)) return null;
  return (
    answerFromQuestion(question) ?? {
      text: buildNeedsRatingsAnswer(question),
      needsRatings: true,
    }
  );
}
