/**
 * Vet-Rate.org - acceptance check for model-reworded passages
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The writing tools build each draft themselves (writerTemplates.js). The
 * model is offered only the passages someone typed, numbered, and asked to
 * make each into clear, complete sentences that say only what the passage
 * says. This decides, from the text alone, whether each rewording may take
 * its passage's place:
 *
 *   1. it is a rewording: not empty, a refusal, a request for information,
 *      or advice about what a statement should contain;
 *   2. it keeps what the passage supplied: every number, every required
 *      phrase (a condition name) the passage had, and most of its wording;
 *   3. it adds no number, counted quantity, date, service branch, unit,
 *      place, diagnosis, name or certification wording the passage lacks;
 *   4. it carries no bracketed text the passage did not have, and no
 *      redaction marker: an invented fact in brackets is still invented;
 *   5. it is not much longer or much newer than the passage. This is what
 *      catches an invented account that happens to contain no number, name
 *      or diagnosis.
 *
 * A rewording that fails keeps the writer's own words. The check errs
 * toward rejecting: a rejected good rewording costs some polish, an
 * accepted invented fact goes into sworn evidence.
 */

import { standardDraftNote } from "./writerTemplates.js";

export const DRAFT_PATH = { MODEL: "model", TEMPLATE: "template" };

const MIN_WORDING_KEPT = 0.6;
const MAX_NEW_WORDING = 0.45;

const lower = (value) => String(value ?? "").toLowerCase();
const squash = (value) => lower(value).replace(/\s+/g, " ").trim();
const straighten = (value) => String(value ?? "").replace(/[‘’]/g, "'");

const anyOf = (alternatives) => `(?:${alternatives.join("|")})`;
const pattern = (source, flags = "i") => new RegExp(source, flags);
const WS = String.raw`\s+`;
const sameSentence = (max) => `[^.\\n]{0,${max}}`;

const CANNOT = anyOf([
  `i${WS}can't`,
  `i${WS}cannot`,
  `i${WS}won't`,
  `i${WS}will${WS}not`,
  `i${WS}am${WS}unable`,
  `i${WS}am${WS}not${WS}able`,
  `i'm${WS}unable`,
  `i'm${WS}not${WS}able`,
  `i'm${WS}sorry`,
]);
const TASK_VERB = anyOf([
  "draft",
  "write",
  "help",
  "assist",
  "provide",
  "create",
  "generate",
  "calculate",
  "complete",
  "fulfil",
  "prepare",
  "build",
  "invent",
  "ensure",
]);
const TASK_OBJECT = anyOf([
  "statements?",
  "letter",
  "nexus",
  "draft",
  "rating",
  "calculation",
  "opinion",
  "advice",
  "document",
  "facts",
  "request",
  `for${WS}you`,
  `you${WS}with`,
]);
const LACKS = anyOf([
  "access",
  `that${WS}information`,
  `the${WS}specific`,
  `your${WS}specific`,
  `the${WS}veteran's`,
]);
const DO_NOT = anyOf([`do${WS}not`, "don't"]);
const OUTSIDE = anyOf(["outside", "beyond"]);
const REMIT = anyOf(["scope", "role", "lane", "expertise"]);

/*
 * A refusal names the task it declines ("I cannot draft a buddy statement").
 * A veteran's own "I cannot stand for long" has no such object and is left
 * alone.
 */
const REFUSALS = [
  pattern(
    String.raw`\b${CANNOT}\b${sameSentence(40)}\b${TASK_VERB}\b${sameSentence(60)}\b${TASK_OBJECT}\b`,
  ),
  pattern(String.raw`\bi${WS}${DO_NOT}${WS}have${WS}${LACKS}`),
  pattern(String.raw`\b${OUTSIDE}${WS}(?:of${WS})?my${WS}${REMIT}`),
  pattern(String.raw`\bi${WS}only${WS}(?:draft|write)\b`),
];

const GIVE = anyOf([
  "provide",
  "share",
  "tell",
  "give",
  "supply",
  "send",
  "specify",
  "clarify",
  "describe",
]);
const SOME = anyOf([
  `the${WS}following`,
  "the",
  "more",
  "some",
  "specific",
  "additional",
  "further",
  "any",
  "your",
  `a${WS}few`,
  `a${WS}bit${WS}more`,
]);
const DETAILS = anyOf([
  "information",
  "details?",
  "specifics",
  "context",
  "facts",
]);
const I_NEED = `i(?:'ll|${WS}will|${WS}would)?${WS}need`;
const POLITELY = anyOf(["please", "kindly"]);
const COULD = anyOf(["could", "can", "would"]);
const FIND_OUT = anyOf(["know", "gather", "see"]);
const TO_START = anyOf([`get${WS}started`, "proceed", "begin", `help${WS}you`]);

const ASKS = [
  pattern(
    String.raw`\b${POLITELY}${WS}${GIVE}${WS}(?:me${WS})?(?:with${WS})?${SOME}\b${sameSentence(60)}\b${DETAILS}`,
  ),
  pattern(String.raw`\b${COULD}${WS}you${WS}(?:please${WS})?${GIVE}\b`),
  pattern(String.raw`\b${I_NEED}${WS}to${WS}${FIND_OUT}\b`),
  pattern(String.raw`\b${I_NEED}${WS}${SOME}${WS}(?:\w+${WS})?${DETAILS}`),
  pattern(String.raw`\bonce${WS}you${WS}${GIVE}\b`),
  pattern(String.raw`\bto${WS}${TO_START}${sameSentence(80)}\b${I_NEED}\b`),
  pattern(String.raw`\bi${WS}am${WS}ready${WS}to${WS}(?:assist|help|draft)\b`),
];

const INCLUDE = anyOf([
  "include",
  "contain",
  "describe",
  "cover",
  "address",
  "explain",
  "mention",
]);
const A_STATEMENT = anyOf(["a", "an", "your", "each"]);
const A_LIST_OF = anyOf(["some", `a${WS}few`, "the", "several"]);
const POINTERS = anyOf([
  "tips",
  "steps",
  "guidelines",
  "things",
  "suggestions",
  String.raw`key${WS}\w+`,
]);
const YOU_OUGHT = anyOf([
  "should",
  `will${WS}want${WS}to`,
  `may${WS}want${WS}to`,
  `need${WS}to`,
]);
const TO_DO = anyOf([
  "include",
  "describe",
  "mention",
  "explain",
  "gather",
  "start",
  "begin",
]);

const ADVICE = [
  pattern(
    String.raw`\b${A_STATEMENT}${WS}(?:\w+${WS}){0,2}statements?${WS}should${WS}(?:\w+${WS})?${INCLUDE}`,
  ),
  pattern(
    String.raw`\bhere${WS}(?:are|is)${WS}${A_LIST_OF}${WS}(?:\w+${WS})?${POINTERS}`,
  ),
  pattern(String.raw`\b(?:make|be)${WS}sure${WS}to${WS}${INCLUDE}`),
  pattern(String.raw`\bremember${WS}to${WS}${INCLUDE}`),
  pattern(String.raw`\byou${WS}${YOU_OUGHT}${WS}${TO_DO}`),
  pattern(String.raw`\bconsider${WS}including\b`),
  /\bstep\s+\d+\s*[:.-]/i,
];

const matchesAny = (patterns, text) => patterns.some((p) => p.test(text));

const BLANK = /\[[^[\]\n]*\]/g;

const sentencesOf = (draft) =>
  draft.split(/(?<=[.!?])\s+|\n+/).filter((part) => part.trim() !== "");

/**
 * What a piece of model text is: "rewording", or why it is not one:
 * "empty", "refusal", "asks-for-information" or "advice". A veteran's own
 * "I cannot stand for long" is not a refusal: a refusal names the task it
 * declines.
 */
export function classifyReplyKind(text) {
  const body = String(text ?? "").trim();
  if (body.length === 0) return "empty";

  const withoutBlanks = body.replace(BLANK, " ");
  const head = withoutBlanks.slice(0, 400);
  if (matchesAny(REFUSALS, head)) return "refusal";
  const questions = sentencesOf(withoutBlanks).filter((part) =>
    /\?\s*$/.test(part),
  ).length;
  if (
    matchesAny(ASKS, head) ||
    matchesAny(ASKS, withoutBlanks.slice(-400)) ||
    questions >= 3
  ) {
    return "asks-for-information";
  }
  return matchesAny(ADVICE, withoutBlanks) ? "advice" : "rewording";
}

const digitRuns = (value) => String(value ?? "").match(/\d+/g) ?? [];

const LIST_MARKER = /^[ \t]*\d{1,2}[.)](?=\s)/gm;

const NUMBER_WORD = anyOf(
  "one two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty sixty seventy eighty ninety hundred several few many dozen"
    .split(" ")
    .concat([`couple${WS}of`, `half${WS}a`]),
);
const COUNTED = String.raw`(?:years?|months?|weeks?|days?|hours?|minutes?|times?|percent|tours?|deployments?|nights?|decades?)`;
const COUNTED_PHRASE = new RegExp(
  String.raw`\b${NUMBER_WORD}\s+(?:\w+\s+)?${COUNTED}\b`,
  "gi",
);

const NAMED_DAY = anyOf(
  "January February March April June July August September October November December Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(
    " ",
  ),
);
const BEFORE_MAY = anyOf(["in", "of", "since", "until", "by", "during"]);
// "May" alone is usually the verb, so it counts only where it reads as a month.
const CALENDAR = pattern(
  String.raw`\b${NAMED_DAY}\b|\b${BEFORE_MAY}${WS}May\b|\bMay${WS}(?:of${WS})?\d`,
  "g",
);

const SERVICE_TERMS = [
  "army",
  "navy",
  "air force",
  "marine corps",
  "marines",
  "coast guard",
  "space force",
  "national guard",
  "battalion",
  "brigade",
  "regiment",
  "squadron",
  "platoon",
  "infantry",
  "airborne",
  "cavalry",
  "artillery",
  "iraq",
  "afghanistan",
  "vietnam",
  "kuwait",
  "korea",
  "syria",
  "somalia",
  "bosnia",
  "kosovo",
  "persian gulf",
  "gulf war",
  "desert storm",
  "enduring freedom",
  "iraqi freedom",
  "agent orange",
  "burn pit",
  "ied",
  "combat",
  "deployed",
  "deployment",
];

const DIAGNOSES = [
  "ptsd",
  "post-traumatic stress",
  "posttraumatic stress",
  "depression",
  "depressive disorder",
  "anxiety disorder",
  "panic disorder",
  "bipolar",
  "schizophrenia",
  "traumatic brain injury",
  "tbi",
  "tinnitus",
  "hearing loss",
  "sleep apnea",
  "insomnia",
  "migraine",
  "migraines",
  "hypertension",
  "heart disease",
  "diabetes",
  "arthritis",
  "degenerative disc",
  "radiculopathy",
  "sciatica",
  "neuropathy",
  "lumbar strain",
  "fibromyalgia",
  "plantar fasciitis",
  "carpal tunnel",
  "gerd",
  "irritable bowel",
  "ibs",
  "asthma",
  "copd",
  "sinusitis",
  "rhinitis",
  "eczema",
  "psoriasis",
  "cancer",
  "stroke",
  "seizure",
  "seizures",
  "epilepsy",
  "vertigo",
  "erectile dysfunction",
  "concussion",
  "fracture",
  "fractures",
  "herniated",
];

// A statement is signed under penalty of law. Only the app adds
// certification wording, and only above a signature line the signer
// completes (AIS-03 / LEGAL-03).
const ATTESTATIONS = [
  "certify",
  "certifies",
  "attest",
  "attests",
  "sworn",
  "swear",
  "under oath",
  "penalty of perjury",
  "true and correct",
];

const TERM_GAP = String.raw`[-\s]+`;

const termPattern = (term) =>
  pattern(String.raw`\b${term.replace(/[-\s]+/g, TERM_GAP)}\b`);

const newTerms = (terms, draft, allowed) =>
  terms.filter(
    (term) => termPattern(term).test(draft) && !termPattern(term).test(allowed),
  );

const CAPITALISED_ANYWHERE = new Set([
  "i",
  "i'm",
  "i've",
  "i'd",
  "i'll",
  "va",
  "veteran",
  "veterans",
  "affairs",
  "department",
  "compensation",
  "pension",
  "c&p",
  "form",
  "statement",
  "claim",
  "dear",
  "doctor",
  "dr",
  "sir",
  "madam",
  "sincerely",
  "respectfully",
  "united",
  "states",
  "u.s",
  "us",
  "cfr",
  "dbq",
  "god",
  "english",
  "american",
  "whom",
  "it",
  "may",
  "concern",
]);

// "Dr. Okonkwo": the full stop after a title does not end the sentence.
const TITLES = new Set(
  "dr mr mrs ms sgt cpl pvt capt lt col maj gen cmdr st ft".split(" "),
);

const isHeadingLine = (line) => {
  const trimmed = line.trim();
  return (
    /^(?:#{1,6}\s|[-=]{3,}$)/.test(trimmed) ||
    (trimmed.length <= 70 && !/[.,;!?]/.test(trimmed.replace(/:$/, "")))
  );
};

/** `text` without leading and trailing characters that fail `keep`. */
function trimTo(text, keep) {
  let start = 0;
  let end = text.length;
  while (start < end && !keep.test(text[start])) start++;
  while (end > start && !keep.test(text[end - 1])) end--;
  return text.slice(start, end);
}

const wordKey = (word) =>
  trimTo(lower(straighten(word)), /[a-z0-9&]/).replace(/'s$/, "");

const wordSet = (value) =>
  new Set(
    String(value ?? "")
      .split(/[\s/]+/)
      .map(wordKey)
      .filter(Boolean),
  );

// Words a sentence may open with without being a name.
const SENTENCE_OPENERS = new Set(
  "i my me we our they their them he his she her it its this that these those the a an and but or so because since when while after before during at in on as for from with without to due also now then there here every each some most many all both any no not never always often sometimes usually today still even if although though however additionally because what where who how".split(
    " ",
  ),
);

/**
 * Capitalised words inside a sentence (so, likely names of people, places
 * or units) that the allowed text does not contain. Headings, bold labels,
 * sentence openings and bracketed blanks are skipped.
 *
 * With `prose` the text is a passage, not a document: no line is taken for
 * a heading, and a word that opens a sentence counts too unless it is an
 * ordinary opener ("I", "My", "When") or one of the allowed words.
 */
function newNames(draft, allowedWords, prose = false) {
  const found = new Set();
  for (const line of draft.split("\n")) {
    if (!prose && isHeadingLine(line)) continue;
    const words = line
      .replace(/(\*\*|__)[^*_\n]{1,80}\1:?/g, " . ")
      .split(/\s+/)
      .filter(Boolean);
    let opensSentence = true;
    for (const word of words) {
      const key = wordKey(word);
      const capitalised = /^["'(]*[A-Z]/.test(word);
      const skipped = opensSentence && !(prose && !SENTENCE_OPENERS.has(key));
      if (
        capitalised &&
        !skipped &&
        key.length > 1 &&
        !CAPITALISED_ANYWHERE.has(key) &&
        !allowedWords.has(key)
      ) {
        found.add(trimTo(word, /[A-Za-z0-9]/));
      }
      opensSentence =
        !TITLES.has(key) &&
        (/[.!?:]["')]*$/.test(word) || /^[-*•.]$/.test(word));
    }
  }
  return [...found];
}

/**
 * Facts in `draft` that appear in neither the inputs nor the app-built
 * draft. Each entry is { kind, value }.
 */
export function findNewFacts(draft, allowedText, { prose = false } = {}) {
  const body = straighten(draft).replace(BLANK, " ").replace(LIST_MARKER, " ");
  const allowed = straighten(allowedText);
  const allowedLower = squash(allowed);
  const allowedDigits = new Set(digitRuns(allowed));
  const facts = [];
  const add = (kind, values) => {
    for (const value of new Set(values)) facts.push({ kind, value });
  };

  add(
    "number",
    digitRuns(body).filter((run) => !allowedDigits.has(run)),
  );
  add(
    "quantity",
    (body.match(COUNTED_PHRASE) ?? []).filter(
      (phrase) => !allowedLower.includes(squash(phrase)),
    ),
  );
  add(
    "date",
    (body.match(CALENDAR) ?? []).filter(
      (phrase) => !allowedLower.includes(squash(phrase)),
    ),
  );
  add("service", newTerms(SERVICE_TERMS, body, allowed));
  add("diagnosis", newTerms(DIAGNOSES, body, allowed));
  add("attestation", newTerms(ATTESTATIONS, body, allowed));
  add("name", newNames(body, wordSet(allowed), prose));
  return facts;
}

const STOP_WORDS = new Set(
  "about after again also always because been before being both could doing during each every from have having into just like more most much never often only other over same should some such than that their them then there these they this those through under until very were what when where which while will with would your".split(
    " ",
  ),
);

/*
 * Words that carry no fact of their own in a statement about a veteran. A
 * rewording that turns "They leave" into "The veteran leaves ... and does
 * not" adds "veteran" and "does" and has said nothing new: every statement
 * here is by or about the veteran, and "does" only carries the tense.
 */
const NO_FACT_WORDS = new Set(
  "veteran veterans does doing done didn't doesn't".split(" "),
);

/*
 * A word's stem, so that a change of form is not a change of wording:
 * "leave" and "leaves", "drive", "drives" and "driving", "stop" and
 * "stopped" compare equal. Deliberately crude. It only has to make
 * inflections of one word meet; two different words that happen to share a
 * stem are still two words the passage did or did not use.
 */
function stemOf(word) {
  const base = word
    .replace(/ies$/, "y")
    .replace(/(?:ing|ed|es|s)$/, (ending, at) => (at >= 3 ? "" : ending));
  const undoubled = /([b-df-hj-np-tv-z])\1$/.test(base)
    ? base.slice(0, -1)
    : base;
  return undoubled.length > 3 ? undoubled.replace(/e$/, "") : undoubled;
}

const stemSet = (value) => new Set([...wordSet(value)].map(stemOf));

/** The stems of the words that carry a passage's content. */
const contentWords = (value) => [
  ...new Set(
    [...wordSet(value)]
      .filter(
        (word) =>
          word.length >= 4 && !STOP_WORDS.has(word) && !NO_FACT_WORDS.has(word),
      )
      .map(stemOf),
  ),
];

/**
 * What the veteran supplied that the draft no longer has: numbers, phrases
 * the caller requires verbatim, and (as one "wording" entry) too little of
 * the supplied wording.
 */
export function findMissingFacts(draft, inputs = [], keep = []) {
  const body = straighten(draft);
  const bodyLower = squash(body);
  const supplied = inputs.filter((value) => typeof value === "string");
  const missing = [];

  const bodyDigits = new Set(digitRuns(body));
  for (const run of new Set(supplied.flatMap(digitRuns))) {
    if (!bodyDigits.has(run)) missing.push({ kind: "number", value: run });
  }
  for (const phrase of keep) {
    if (squash(phrase) && !bodyLower.includes(squash(straighten(phrase)))) {
      missing.push({ kind: "phrase", value: phrase });
    }
  }
  const words = [...new Set(supplied.flatMap(contentWords))];
  if (words.length > 0) {
    const bodyWords = stemSet(body);
    const kept = words.filter((word) => bodyWords.has(word)).length;
    const share = kept / words.length;
    if (share < MIN_WORDING_KEPT) {
      missing.push({
        kind: "wording",
        value: `${Math.round(share * 100)}% of the supplied wording kept`,
      });
    }
  }
  return missing;
}

const itemise = (items) =>
  items.map((item) => `${item.kind} "${item.value}"`).join(", ");

export const errorReason = (error) =>
  (error instanceof Error ? error.message : String(error ?? "")) ||
  "the AI did not answer";

/*
 * Passage rewording.
 *
 * The model is offered only the passages someone typed, numbered, and asked
 * for each back reworded under the same number. Each rewording is checked on
 * its own against the passage it came from, and the app builds the draft
 * again with the accepted ones in place. A rewording that fails keeps the
 * writer's own words. Nothing else in the draft passes through the model.
 */

const PASSAGE_NUMBER = /^(?:\*\*|__)?(\d{1,2})[.):](?:\*\*|__)?/;

const stripWrapping = (value) =>
  trimTo(String(value ?? "").trim(), /[^\s"'“”*_`]/);

/*
 * The smaller model drops the numbers and returns one line per passage.
 * Taken in order, but only when the line count matches exactly: a refusal
 * or a preamble does not. Null when it does not match.
 */
function onePerLine(reply, count) {
  const lines = straighten(reply)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length === count ? lines.map(stripWrapping) : null;
}

/**
 * The reworded passages in a model reply, by number: an array of `count`
 * entries, each the text after "N." up to the next number or blank line, or
 * null when that number is missing. Anything before the first number is
 * ignored. A reply to a single passage may come back with no number, and
 * so may a reply to several when it has exactly one line for each.
 */
export function parsePassageReply(reply, count) {
  const found = new Array(count).fill(null);
  let current = -1;
  let closed = false;
  for (const line of straighten(reply).split("\n")) {
    const trimmed = line.trim();
    const numbered = PASSAGE_NUMBER.exec(trimmed);
    const index = numbered ? Number(numbered[1]) - 1 : -1;
    if (numbered && index >= 0 && index < count && found[index] === null) {
      current = index;
      closed = false;
      found[current] = trimmed.slice(numbered[0].length).trim();
    } else if (trimmed === "") {
      closed = current !== -1 && found[current] !== "";
    } else if (current !== -1 && !closed) {
      found[current] = `${found[current]} ${trimmed}`.trim();
    }
  }
  if (count === 1 && found[0] === null && String(reply ?? "").trim() !== "") {
    found[0] = String(reply)
      .trim()
      .split(/\n\s*\n/)[0];
  }
  if (count > 1 && found.every((value) => value === null)) {
    return onePerLine(reply, count) ?? found;
  }
  return found.map((value) => (value ? stripWrapping(value) : null));
}

const BRACKETED = /\[[^[\]\n]*\]/g;
const REDACTION_MARKER = /\[[^[\]\n]*(?:redact|removed|withheld)[^[\]\n]*\]/i;

const sameWording = (a, b) => {
  const plain = (value) =>
    trimTo(squash(straighten(value)), /[a-z0-9]/).replace(/[.,;:!?]/g, "");
  return plain(a) === plain(b);
};

const MAX_PASSAGE_GROWTH = 1.75;
const PASSAGE_GROWTH_ALLOWANCE = 40;
const MIN_NEW_WORDS_ALLOWED = 2;

function passageProblems(original, rewrite, keep) {
  const kind = classifyReplyKind(rewrite);
  if (kind !== "rewording") return [`not a rewording: ${kind}`];

  const problems = [];
  if (REDACTION_MARKER.test(rewrite))
    problems.push("contains a redaction marker");
  const brackets = (rewrite.match(BRACKETED) ?? []).filter(
    (item) => !original.includes(item),
  );
  if (brackets.length > 0) {
    problems.push(`adds bracketed text ${[...new Set(brackets)].join(", ")}`);
  }

  // Bracketed text is judged above; the fact rules read the rest, with the
  // brackets' contents exposed so an invented fact cannot hide in them.
  const exposed = rewrite.replace(/[[\]]/g, " ");
  const newFacts = findNewFacts(exposed, original, { prose: true });
  if (newFacts.length > 0) problems.push(`adds ${itemise(newFacts)}`);
  const missing = findMissingFacts(
    rewrite,
    [original],
    keep.filter((phrase) => squash(original).includes(squash(phrase))),
  );
  if (missing.length > 0) problems.push(`drops ${itemise(missing)}`);

  if (
    rewrite.length >
    MAX_PASSAGE_GROWTH * original.length + PASSAGE_GROWTH_ALLOWANCE
  ) {
    problems.push("much longer than the passage");
  }
  const known = stemSet(original);
  const words = contentWords(rewrite);
  const added = words.filter((word) => !known.has(word));
  if (
    added.length >
    Math.max(MIN_NEW_WORDS_ALLOWED, Math.floor(MAX_NEW_WORDING * words.length))
  ) {
    problems.push(`${added.length} of its ${words.length} main words are new`);
  }
  return problems;
}

/**
 * One reworded passage against the passage it came from.
 *
 *   "accepted"   a different wording that adds and loses nothing
 *   "unchanged"  the same words back (case and punctuation aside)
 *   "rejected"   missing, not a rewording, or failing a fact rule; `reasons`
 *                says which
 *
 * The fact rules are the draft rules applied to the passage alone: no new
 * number, counted quantity, date, service detail, diagnosis, name or
 * certification wording; every number and required phrase of the passage
 * kept, and most of its wording. On top of those: no bracketed text the
 * passage did not have (an invented fact in brackets is still invented), no
 * redaction marker, and not much longer or much newer than the passage.
 */
export function checkPassageRewrite({ original, rewrite, keep = [] }) {
  const source = String(original ?? "").trim();
  const text = String(rewrite ?? "").trim();
  if (text === "") {
    return {
      status: "rejected",
      text: source,
      reasons: ["no rewording returned"],
    };
  }
  if (sameWording(source, text)) {
    return { status: "unchanged", text: source, reasons: [] };
  }
  const reasons = passageProblems(source, text, keep);
  return reasons.length > 0
    ? { status: "rejected", text: source, reasons }
    : { status: "accepted", text, reasons: [] };
}

const NO_PASSAGES = { sent: 0, accepted: 0, unchanged: 0, rejected: 0 };

/**
 * The app-built draft as a tool result: what the veteran gets when there is
 * nothing to reword, or nothing reworded was usable. No claim of AI wording.
 */
export function standardDraft(plan, extra = {}) {
  const content = plan.build(plan.answers);
  return {
    content,
    draftPath: DRAFT_PATH.TEMPLATE,
    draftNote: standardDraftNote(content),
    draftRejectReasons: [],
    passages: NO_PASSAGES,
    passageOutcomes: [],
    ...extra,
  };
}

/**
 * The app-built draft when passages were sent and the model could not
 * answer (engine error, timeout, request limit): `draftErrorReason` names
 * the error, and `passages.sent` still says how many were asked about.
 */
export const draftAfterModelError = (plan, sent, error) =>
  standardDraft(plan, {
    passages: { ...NO_PASSAGES, sent: sent.length },
    draftErrorReason: errorReason(error),
  });

/**
 * Settle a model reply for the passages that were sent (`sent`, as returned
 * by selectPassages, in the order they were numbered). The draft is built
 * again with each accepted rewording in its passage's place. `draftPath` is
 * "model" only when at least one passage was reworded and accepted;
 * `passages` counts how each one fared and `passageOutcomes` lists them:
 * the passage, what the model returned for it, the verdict and the reasons.
 */
export function resolvePassageDraft({ plan, sent, reply }) {
  const rewrites = parsePassageReply(reply, sent.length);
  const outcomes = sent.map((passage, i) => ({
    ...passage,
    number: i + 1,
    ...checkPassageRewrite({
      original: passage.text,
      rewrite: rewrites[i],
      keep: plan.keep,
    }),
  }));
  const count = (status) =>
    outcomes.filter((outcome) => outcome.status === status).length;
  const passages = {
    sent: sent.length,
    accepted: count("accepted"),
    unchanged: count("unchanged"),
    rejected: count("rejected"),
  };
  const draftRejectReasons = outcomes
    .filter((outcome) => outcome.status === "rejected")
    .map(
      (outcome) => `passage ${outcome.number}: ${outcome.reasons.join("; ")}`,
    );

  // What was asked and what came back, passage by passage, so a transcript
  // shows the rewording that was turned down and not only that one was.
  const passageOutcomes = outcomes.map((outcome, i) => ({
    number: outcome.number,
    before: sent[i].text,
    after: rewrites[i],
    verdict: outcome.status,
    reasons: outcome.reasons,
  }));

  if (passages.accepted === 0) {
    return standardDraft(plan, {
      passages,
      draftRejectReasons,
      passageOutcomes,
    });
  }
  const reworded = Object.fromEntries(
    outcomes
      .filter((outcome) => outcome.status === "accepted")
      .map((outcome) => [outcome.key, outcome.text]),
  );
  return {
    content: plan.build({ ...plan.answers, ...reworded }),
    draftPath: DRAFT_PATH.MODEL,
    draftNote: null,
    draftRejectReasons,
    passages,
    passageOutcomes,
  };
}
