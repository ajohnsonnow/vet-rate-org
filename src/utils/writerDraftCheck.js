/**
 * Vet-Rate.org - acceptance check for a model-worded draft
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The writing tools hand the model an app-built draft (writerTemplates.js)
 * and ask it to improve the wording. This decides, from the text alone,
 * whether the model's answer may replace that draft:
 *
 *   1. it is a draft: not empty, a refusal, a request for information, or
 *      advice about what a statement should contain;
 *   2. it keeps what the veteran supplied: every number, every phrase the
 *      caller marks as required, and most of the wording;
 *   3. it adds no number, date, service branch, unit, place, diagnosis,
 *      name or certification wording that is in neither the inputs nor
 *      the app-built draft;
 *   4. it keeps every bracketed blank of the app-built draft;
 *   5. it is a rewording, not new material: not much longer than the
 *      app-built draft, and mostly made of words that draft or the inputs
 *      already use. This is what catches an invented account that happens
 *      to contain no number, name or diagnosis.
 *
 * Anything else, and the tool returns the app-built draft unchanged. The
 * check errs toward rejecting: a rejected good answer costs the veteran
 * some polish, an accepted invented fact goes into sworn evidence.
 */

import {
  STANDARD_DRAFT_NOTE,
  listPlaceholders,
  standardDraftNote,
  tdiuAnalysisText,
} from "./writerTemplates.js";

export const DRAFT_PATH = { MODEL: "model", TEMPLATE: "template" };

const MIN_DRAFT_CHARS = 150;
const MIN_SHARE_OF_TEMPLATE = 0.5;
const MIN_WORDING_KEPT = 0.6;
const MAX_LENGTH_OF_TEMPLATE = 1.75;
const MAX_NEW_WORDING = 0.45;

const lower = (value) => String(value ?? "").toLowerCase();
const squash = (value) => lower(value).replace(/\s+/g, " ").trim();
const straighten = (value) => String(value ?? "").replace(/[‘’]/g, "'");

const anyOf = (alternatives) => `(?:${alternatives.join("|")})`;
const pattern = (source, flags = "i") => new RegExp(source, flags);
const WS = String.raw`\s+`;
const sameSentence = (max) => `[^.\\n]{0,${max}}`;

const OPENERS = [
  "certainly",
  "sure",
  "of course",
  "absolutely",
  "here's",
  "here is",
  "below is",
  "i've improved",
  "i have improved",
  "i've revised",
  "i have revised",
  "i've reworded",
  "i have reworded",
];
const CLOSERS = [
  "note",
  "please note",
  "let me know",
  "feel free",
  "i hope this",
  "if you'd",
  "if you would",
  "if you need",
  "if you have",
];
const REMARK_SUBJECT = anyOf(["draft", "version", "statement", "letter"]);
const REMARK_VERB = anyOf([
  "keeps",
  "maintains",
  "preserves",
  "should be tailored",
  "is based on",
]);
const CLOSING_REMARK = pattern(
  String.raw`^this (?:\w+ )?${REMARK_SUBJECT} ${REMARK_VERB}`,
);
const RULE_LINE = /^[-*_=]{3,}$/;

const startsWithPhrase = (text, phrases) =>
  phrases.some(
    (phrase) =>
      text.startsWith(phrase) && !/[a-z]/.test(text[phrase.length] ?? ""),
  );

function isClosingChatter(block) {
  const text = lower(block).replace(/^[#*\s]+/, "");
  return (
    RULE_LINE.test(block) ||
    startsWithPhrase(text, CLOSERS) ||
    CLOSING_REMARK.test(text)
  );
}

function dropOpeningChatter(draft) {
  const lineEnd = draft.indexOf("\n");
  if (lineEnd === -1 || !startsWithPhrase(lower(draft), OPENERS)) return draft;
  return draft.slice(lineEnd + 1).trimStart();
}

function dropClosingChatter(draft) {
  const blocks = draft.split(/\n{2,}/);
  while (blocks.length > 1 && isClosingChatter(blocks.at(-1).trim())) {
    blocks.pop();
  }
  return blocks.join("\n\n");
}

/**
 * The draft inside a model reply: without a code fence, an opening line such
 * as "Certainly! Here is the improved draft:", a closing remark to the user,
 * or the rule lines models put around the body.
 */
export function extractDraft(output) {
  let draft = straighten(output).trim();
  const fenced = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(draft);
  if (fenced) draft = fenced[1].trim();
  const blocks = dropClosingChatter(dropOpeningChatter(draft)).split(/\n{2,}/);
  while (blocks.length > 1 && RULE_LINE.test(blocks[0].trim())) blocks.shift();
  return blocks.join("\n\n").trim();
}

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
 * "draft", or why the text is not one: "empty", "refusal",
 * "asks-for-information" or "advice".
 *
 * `addressedToReader` is for a document that itself asks its reader for
 * something and says what to include (a nexus-letter request to a doctor):
 * the request and advice rules would misread it, so only the empty and
 * refusal rules apply.
 */
export function classifyDraftKind(
  draft,
  template = "",
  { addressedToReader = false } = {},
) {
  const body = String(draft ?? "").trim();
  if (body.length === 0) return "empty";

  const withoutBlanks = body.replace(BLANK, " ");
  const head = withoutBlanks.slice(0, 400);
  if (matchesAny(REFUSALS, head)) return "refusal";
  const toVeteran = addressedToReader
    ? "draft"
    : remarkToVeteran(withoutBlanks, head);
  if (toVeteran !== "draft") return toVeteran;

  const floor = template
    ? MIN_SHARE_OF_TEMPLATE * template.length
    : MIN_DRAFT_CHARS;
  return body.length < floor ? "empty" : "draft";
}

function remarkToVeteran(withoutBlanks, head) {
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
  return matchesAny(ADVICE, withoutBlanks) ? "advice" : "draft";
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

const contentWords = (value) =>
  [...wordSet(value)].filter(
    (word) => word.length >= 4 && !STOP_WORDS.has(word),
  );

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
    const bodyWords = wordSet(body);
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

export function findMissingPlaceholders(draft, template) {
  const bodyLower = squash(straighten(draft));
  return [...new Set(listPlaceholders(template))].filter(
    (placeholder) => !bodyLower.includes(squash(placeholder)),
  );
}

/**
 * Why `draft` is new material and not a rewording of `template`, as a list
 * of plain reasons (empty when it is a rewording). Without a template there
 * is nothing to compare against and nothing is reported.
 */
export function findNewMaterial(draft, template, allowedText) {
  if (!template) return [];
  const reasons = [];
  const ratio = draft.length / template.length;
  if (ratio > MAX_LENGTH_OF_TEMPLATE) {
    reasons.push(`${ratio.toFixed(1)} times the length of the app-built draft`);
  }
  const words = contentWords(draft.replace(BLANK, " "));
  if (words.length > 0) {
    const known = wordSet(allowedText);
    const share =
      words.filter((word) => !known.has(word)).length / words.length;
    if (share > MAX_NEW_WORDING) {
      reasons.push(`${Math.round(share * 100)}% of its wording is new`);
    }
  }
  return reasons;
}

const itemise = (items) =>
  items.map((item) => `${item.kind} "${item.value}"`).join(", ");

/**
 * @param {object} args
 * @param {string} args.output   the model's reply
 * @param {string} args.template the app-built draft the model was given
 * @param {string[]} [args.inputs] what the veteran supplied, as entered
 * @param {string[]} [args.keep] phrases that must survive verbatim
 *   (condition names)
 * @param {string[]} [args.reference] other text the model was shown and
 *   may draw on, which the draft need not keep
 * @param {boolean} [args.addressedToReader] see classifyDraftKind
 * @returns {{ accepted: boolean, draft: string, kind: string,
 *   reasons: string[], newFacts: object[], missingFacts: object[],
 *   missingPlaceholders: string[], newMaterial: string[] }}
 */
export function checkWriterDraft({
  output,
  template = "",
  inputs = [],
  keep = [],
  reference = [],
  addressedToReader = false,
}) {
  const draft = extractDraft(output);
  const kind = classifyDraftKind(draft, template, { addressedToReader });
  if (kind !== "draft") {
    return {
      accepted: false,
      draft,
      kind,
      reasons: [`not a draft: ${kind}`],
      newFacts: [],
      missingFacts: [],
      missingPlaceholders: [],
      newMaterial: [],
    };
  }

  const allowedText = [...inputs, ...keep, ...reference, template].join("\n");
  const newFacts = findNewFacts(draft, allowedText);
  const missingFacts = findMissingFacts(draft, inputs, keep);
  const missingPlaceholders = findMissingPlaceholders(draft, template);
  const newMaterial = findNewMaterial(draft, template, allowedText);
  const reasons = [
    ...(newFacts.length > 0 ? [`adds ${itemise(newFacts)}`] : []),
    ...(missingFacts.length > 0 ? [`drops ${itemise(missingFacts)}`] : []),
    ...(missingPlaceholders.length > 0
      ? [`drops blank ${missingPlaceholders.join(", ")}`]
      : []),
    ...newMaterial,
  ];
  return {
    accepted: reasons.length === 0,
    draft,
    kind,
    reasons,
    newFacts,
    missingFacts,
    missingPlaceholders,
    newMaterial,
  };
}

/**
 * The draft a tool returns: the model's wording when it passes the check,
 * otherwise `fallback` (the app-built draft) with the one-line note.
 * `draftPath` records which.
 */
export function resolveWriterDraft({ fallback, ...args }) {
  const check = checkWriterDraft(args);
  return check.accepted
    ? {
        content: check.draft,
        draftPath: DRAFT_PATH.MODEL,
        draftNote: null,
        draftRejectReasons: [],
      }
    : {
        content: fallback ?? args.template,
        draftPath: DRAFT_PATH.TEMPLATE,
        draftNote: STANDARD_DRAFT_NOTE,
        draftRejectReasons: check.reasons,
      };
}

function parseJsonObject(output) {
  const reply = String(output ?? "");
  const first = reply.indexOf("{");
  const last = reply.lastIndexOf("}");
  if (first === -1 || last < first) return null;
  try {
    return JSON.parse(reply.slice(first, last + 1));
  } catch {
    return null;
  }
}

const sameText = (a, b) => typeof a === "string" && squash(a) === squash(b);

function tdiuShapeProblems(analysis, template) {
  const limitations = Array.isArray(analysis.limitations)
    ? analysis.limitations
    : [];
  const problems = [];
  if (limitations.length !== template.limitations.length) {
    problems.push(
      `has ${limitations.length} limitations, the app-built analysis has ${template.limitations.length}`,
    );
  } else if (
    !template.limitations.every(
      (expected, i) =>
        sameText(limitations[i]?.condition, expected.condition) &&
        sameText(limitations[i]?.symptom, expected.symptom) &&
        typeof limitations[i]?.vocational_impact === "string",
    )
  ) {
    problems.push("changes a condition or symptom");
  }
  for (const field of ["combined_effect", "summary_argument"]) {
    if (typeof analysis[field] !== "string") problems.push(`has no ${field}`);
  }
  const jobTypes = Array.isArray(analysis.job_types_precluded)
    ? analysis.job_types_precluded
    : [];
  if (
    jobTypes.length !== template.job_types_precluded.length ||
    !template.job_types_precluded.every((type, i) =>
      sameText(jobTypes[i], type),
    )
  ) {
    problems.push("changes the kinds of work ruled out");
  }
  return problems;
}

/**
 * The TDIU analysis a tool returns: the model's wording of the three text
 * fields when its reply is JSON in the app-built shape and passes the same
 * check as a statement, otherwise the app-built analysis with the note.
 * Conditions, symptoms and the kinds of work ruled out always come from the
 * app-built analysis.
 */
export function resolveTdiuDraft({ output, template, reference = [] }) {
  const rejected = (draftRejectReasons) => ({
    analysis: template,
    draftPath: DRAFT_PATH.TEMPLATE,
    draftNote: STANDARD_DRAFT_NOTE,
    draftRejectReasons,
  });
  const parsed = parseJsonObject(output);
  if (!parsed) return rejected(["not a draft: no JSON object in the reply"]);
  const shape = tdiuShapeProblems(parsed, template);
  if (shape.length > 0) return rejected(shape);

  const check = checkWriterDraft({
    output: tdiuAnalysisText(parsed),
    template: tdiuAnalysisText(template),
    keep: template.limitations.flatMap((item) => [
      item.condition,
      item.symptom,
    ]),
    reference,
  });
  if (!check.accepted) return rejected(check.reasons);
  return {
    analysis: {
      limitations: template.limitations.map((item, i) => ({
        ...item,
        vocational_impact: parsed.limitations[i].vocational_impact,
      })),
      combined_effect: parsed.combined_effect,
      summary_argument: parsed.summary_argument,
      job_types_precluded: template.job_types_precluded,
    },
    draftPath: DRAFT_PATH.MODEL,
    draftNote: null,
    draftRejectReasons: [],
  };
}

/**
 * What a tool returns when the model could not answer at all (an engine
 * error, a timeout, the request limit): the app-built draft with the note,
 * and the error named in `draftErrorReason`.
 */
export const draftAfterError = (error) => ({
  draftPath: DRAFT_PATH.TEMPLATE,
  draftNote: STANDARD_DRAFT_NOTE,
  draftRejectReasons: [],
  draftErrorReason:
    (error instanceof Error ? error.message : String(error ?? "")) ||
    "the AI did not answer",
});

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

/**
 * The reworded passages in a model reply, by number: an array of `count`
 * entries, each the text after "N." up to the next number or blank line, or
 * null when that number is missing. Anything before the first number is
 * ignored. A reply to a single passage may come back with no number.
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
  const kind = classifyDraftKind(rewrite);
  if (kind !== "draft" && kind !== "empty") return [`not a rewording: ${kind}`];

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
  const known = wordSet(original);
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
    ...extra,
  };
}

/**
 * Settle a model reply for the passages that were sent (`sent`, as returned
 * by selectPassages, in the order they were numbered). The draft is built
 * again with each accepted rewording in its passage's place. `draftPath` is
 * "model" only when at least one passage was reworded and accepted;
 * `passages` counts how each one fared.
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

  if (passages.accepted === 0) {
    return standardDraft(plan, { passages, draftRejectReasons });
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
  };
}
