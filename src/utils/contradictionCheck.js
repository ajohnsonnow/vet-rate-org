/**
 * Post-generation contradiction check, by topic. A small model can be given
 * the regulation and still state the opposite. For each topic whose verified
 * text applies to the request, a short list of patterns finds the statements
 * that contradict it; the answer then gets a plain correction under it that
 * quotes the one sentence of verified text in point, and a marker on the
 * result. The answer itself is never rewritten.
 *
 * These are sentence heuristics, tuned against the recorded evaluation
 * answers, not a parse. The quotations come from src/data/verifiedQuotes.json,
 * which scripts/verified-reference/build.mjs copies from the legal index and
 * the M21-1 shard.
 */

import quotes from "../data/verifiedQuotes.json";
import { detectReferenceTopics } from "./verifiedReference";

const anyMatch = (text, ...patterns) =>
  patterns.some((pattern) => pattern.test(text));

const sentencesOf = (text) =>
  String(text ?? "")
    .replace(/[*_`#>]/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const NO_MECHANISM =
  /\bno (?:established|recognized|known|such|accepted|valid) (?:medical )?(?:mechanism|link|connection|relationship)\b/i;
const CANNOT_CONNECT =
  /\bcannot (?:be|establish)(?: a)? service[- ]connect(?:ed|ion)\b[^.]{0,80}\bsecondary\b/i;
const SECONDARY_NOT_ALLOWED =
  /\bsecondary\b[^.]{0,80}\b(?:is|are) not (?:possible|allowed|permitted|recognized)\b/i;
const LINK_NOT_SUPPORTED =
  /\bdoes not (?:support|recognize|allow|permit) (?:a |any )?(?:direct )?(?:causal )?(?:link|connection)\b|\bis not supported by (?:current )?medical (?:consensus|literature)\b/i;
const NOT_A_QUALIFYING_CAUSE =
  /\bdoes not list\b[^.]{0,40}\bqualifying cause\b/i;
const NO_VALID_OPINION =
  /\b(?:clinician|doctor|physician|provider|examiner) cannot provide a valid (?:opinion|nexus)\b/i;
const UNLESS_EVIDENCE = /\b(?:without|unless|until)\b/i;

const PRESUMPTIVE = /\bpresumpti/i;
const OUTSIDE_THE_PRESUMPTION =
  /\bnon-?presumptive\b|\bnot (?:covered|presumptive|listed)\b|\b(?:does|do|may|might|would) not apply\b|\bif\b|\bunless\b|\botherwise\b/i;
const NO_PROOF_NEEDED =
  /\b(?:does|do) not (?:need|require)\b|n't (?:need|require)\b|\bno (?:need|nexus)\b/i;
const NEEDS_SERVICE_PROOF =
  /\b(?:requires?|needs?|must|have to|has to)\b[^.]{0,100}\b(?:nexus|in-service (?:incurrence|event|injury|aggravation)|incurred in service)\b/i;
const NEEDS_EXPOSURE_PROOF =
  /\b(?:need to|needs to|must|have to|has to) (?:demonstrate|prove|show|establish) that (?:you were|they were|the veteran was) exposed\b/i;
const PACT_ACT = /\bpact\b/i;

const TDIU_SUBJECT = /\btdiu\b|\bunemployab|\b4\.16\b/i;
const YOU_ARE_ELIGIBLE =
  /\byou (?:are|would be|will be)(?: (?:currently|fully|indeed|now|therefore))? (?:eligible|entitled) (?:for|to)\b/i;
const YOU_QUALIFY =
  /(?<!\b(?:can|could|may|might|do|did|would|will|should) )\byou(?: would| do)?(?: indeed)? qualify for\b/i;
const QUALIFIES_YOU = /\bqualif(?:ies|y) you for\b/i;
const WORK_CAVEAT = /\bunable\b|\bemploy\w*|\bgainful\b|\bable to work\b/i;
const IS_QUESTION = /\?$/;

const HIGHER_LEVEL_REVIEW = /\bhigher[- ]level review\b|\bHLR\b/i;
const ADDS_EVIDENCE = /\b(?:new|additional) evidence\b/i;
const NOT_ABOUT_ADDING =
  /\bno\b|\bnot\b|n't\b|\bwithout\b|\bcannot\b|\bsame evidence\b|\bsupplemental\b|\bexisting\b/i;
const DENIES_ENTITLEMENT =
  /\byou (?:cannot|can't|do not|don't|would not|will not) (?:currently )?qualify for\b|\byou are not (?:currently )?(?:eligible|entitled) (?:for|to)\b/i;
const NEGATED = /\bnot\b|n't\b|\bcannot\b/i;
const TURNS_ON_WORK =
  /\b(?:may|might|could|likely|appear|appears|potentially|consideration|if|unless|unable|employ\w*|gainful|determination|evidence|automatic|automatically)\b/i;
const MENTIONS_EXTRA_SCHEDULAR = /extra-?schedular|4\.16\(b\)/i;

const FILES_STATEMENT_OF_THE_CASE =
  /\b(?:file|files|filing|submit|submits|submitting|send|sending)\b[^.]{0,30}\bstatement of the case\b/i;
const VA_SENDS =
  /\b(?:va|office|agency|board) (?:\w+ )?(?:sends?|sent|mails?|mailed)\b/i;
const VA_ISSUES =
  /\b(?:va|office|agency|board) (?:\w+ )?(?:issues?|issued|provides?|provided)\b/i;
const REVIEW_SENT_TO_BOARD =
  /\bhigher[- ]level review(?: request)?(?: \w+){0,2} (?:to|with|at|from|by) the board\b/i;
const BOARD_ASKED_FOR_REVIEW =
  /\bboard\b(?:(?! or )[^.,;]){0,60}\b(?:to request|for|conducts?|performs?) a higher[- ]level review\b/i;

const SUPPLEMENTAL_CLAIM = /\bsupplemental claims?\b/i;
const YEAR_TO_FILE =
  /\b(?:one|1) year\b[^.]{0,80}\bto file a supplemental claim\b|\bdeadline to file a supplemental claim\b/i;
const MUST_FILE_WITHIN_A_YEAR =
  /\bsupplemental claims?\b[^.]{0,20}\b(?:must|has to|have to|needs to) be filed within (?:one|1) year\b/i;
const NOT_FILED_WITHIN_A_YEAR =
  /\b(?:do not|don't|does not|fail to|fails to) file a supplemental claim within (?:one|1) year\b/i;
const DATE_NOT_DEADLINE =
  /\beffective date\b|\bback ?pay\b|\bany time\b|\bmore than\b|\bcontinuous/i;

const NEW_AND_MATERIAL = /\bnew and material\b/i;
const FORMER_STANDARD =
  /\b(?:previous|former|formerly|old|older|legacy|replaced|no longer|used to|lower bar|higher (?:bar|threshold))\b/i;

const INTENT_TO_FILE = /\bintent to file\b|\bITF\b/i;
const FOR_PENDING_CLAIMS = /\bfor (?:\w+ ){0,5}(?:pending|existing) claims?\b/i;
const FOR_CLAIMS_ALREADY_FILED =
  /\bfor (?:\w+ )?claims? (?:\w+ ){0,3}already (?:filed|pending)\b/i;

const PACT_TOPICS = ["toxic-exposure", "herbicide", "pact-act"];
const REVIEW_TOPICS = ["decision-review", "supplemental", "next-claim-step"];
const FILING_TOPICS = [...REVIEW_TOPICS, "intent-to-file"];

/**
 * One rule per contradiction. `topics` are the verified-reference topics the
 * rule belongs to, `matches(sentence, { next, text, hasConditions })` decides
 * one sentence (`next` is the sentence after it, `text` the whole answer),
 * `says` is what the note tells the reader the answer said, and
 * `correction` names the quotation in verifiedQuotes.json.
 */
const RULES = [
  {
    id: "secondary-barred",
    topics: ["secondary"],
    matches: (sentence) =>
      anyMatch(
        sentence,
        NO_MECHANISM,
        LINK_NOT_SUPPORTED,
        NOT_A_QUALIFYING_CAUSE,
        NO_VALID_OPINION,
      ) ||
      (anyMatch(sentence, CANNOT_CONNECT, SECONDARY_NOT_ALLOWED) &&
        !UNLESS_EVIDENCE.test(sentence)),
    says: "says a secondary connection cannot be made",
    correction: () => "secondary",
  },
  {
    id: "presumptive-needs-proof",
    topics: PACT_TOPICS,
    matches: (sentence) =>
      PRESUMPTIVE.test(sentence) &&
      NEEDS_SERVICE_PROOF.test(sentence) &&
      !anyMatch(sentence, OUTSIDE_THE_PRESUMPTION, NO_PROOF_NEEDED),
    says: "says a presumptive condition still needs proof that it began in service, or a nexus",
    correction: (topics) =>
      topics.includes("herbicide")
        ? "presumptive-herbicide"
        : "presumptive-toxic",
  },
  {
    id: "presumptive-needs-exposure-proof",
    topics: ["toxic-exposure"],
    matches: (sentence) =>
      anyMatch(sentence, PRESUMPTIVE, PACT_ACT) &&
      NEEDS_EXPOSURE_PROOF.test(sentence) &&
      !anyMatch(sentence, OUTSIDE_THE_PRESUMPTION, NO_PROOF_NEEDED),
    says: "says you must prove you were exposed",
    correction: () => "presumed-toxic-exposure",
  },
  {
    id: "tdiu-from-percentages",
    topics: ["tdiu"],
    matches: (sentence, { next }) =>
      TDIU_SUBJECT.test(sentence) &&
      anyMatch(sentence, YOU_ARE_ELIGIBLE, YOU_QUALIFY, QUALIFIES_YOU) &&
      !IS_QUESTION.test(sentence) &&
      !NEGATED.test(sentence) &&
      !TURNS_ON_WORK.test(sentence) &&
      !WORK_CAVEAT.test(next),
    says: "says you are eligible for TDIU on the percentages",
    correction: () => "tdiu-judgment",
  },
  {
    // Calls that carry structured conditions already have their threshold
    // conclusion checked against the calculator (raterGrounding.js).
    id: "tdiu-denied-on-percentages",
    topics: ["tdiu"],
    matches: (sentence, { hasConditions, text }) =>
      !hasConditions &&
      TDIU_SUBJECT.test(sentence) &&
      DENIES_ENTITLEMENT.test(sentence) &&
      !TURNS_ON_WORK.test(sentence) &&
      !MENTIONS_EXTRA_SCHEDULAR.test(text),
    says: "says you cannot get TDIU because of the percentages",
    correction: () => "tdiu-extra-schedular",
  },
  {
    id: "files-statement-of-the-case",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      FILES_STATEMENT_OF_THE_CASE.test(sentence) &&
      !anyMatch(sentence, VA_SENDS, VA_ISSUES),
    says: "tells you to file a Statement of the Case, which is not one of the review options",
    correction: () => "review-filing",
  },
  {
    id: "higher-level-review-new-evidence",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      HIGHER_LEVEL_REVIEW.test(sentence) &&
      ADDS_EVIDENCE.test(sentence) &&
      !NOT_ABOUT_ADDING.test(sentence),
    says: "has you send new evidence with a higher-level review",
    correction: () => "higher-level-review-evidence",
  },
  {
    id: "higher-level-review-at-the-board",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      anyMatch(sentence, REVIEW_SENT_TO_BOARD, BOARD_ASKED_FOR_REVIEW),
    says: "sends a higher-level review to the Board, but they are separate review options",
    correction: () => "review-filing",
  },
  {
    // Filing inside the year keeps the effective date (38 CFR 3.2500(h)), so
    // a sentence about the date is not a sentence about a deadline.
    id: "supplemental-claim-deadline",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      SUPPLEMENTAL_CLAIM.test(sentence) &&
      anyMatch(
        sentence,
        YEAR_TO_FILE,
        MUST_FILE_WITHIN_A_YEAR,
        NOT_FILED_WITHIN_A_YEAR,
      ) &&
      !DATE_NOT_DEADLINE.test(sentence),
    says: "puts a deadline on filing a Supplemental Claim",
    correction: () => "supplemental-any-time",
  },
  {
    id: "new-and-material-standard",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      NEW_AND_MATERIAL.test(sentence) && !FORMER_STANDARD.test(sentence),
    says: 'gives "new and material" evidence as the test, which is the previous standard',
    correction: () => "new-and-relevant",
  },
  {
    id: "intent-to-file-for-filed-claim",
    topics: FILING_TOPICS,
    matches: (sentence) =>
      INTENT_TO_FILE.test(sentence) &&
      anyMatch(sentence, FOR_PENDING_CLAIMS, FOR_CLAIMS_ALREADY_FILED) &&
      !NEGATED.test(sentence.replace(/\bnot yet filed an intent\b/i, "")),
    says: "recommends an Intent to File for a claim that is already filed",
    correction: () => "intent-to-file-purpose",
  },
];

export const CONTRADICTION_RULE_IDS = RULES.map((rule) => rule.id);

/**
 * The contradictions in an answer, at most one per rule: { rule, sentence,
 * says, correction }. `topics` are the verified-reference topics of the
 * request; rules of other topics are not applied.
 */
export function findContradictions(
  text,
  { topics = [], hasConditions = false } = {},
) {
  const sentences = sentencesOf(text);
  const context = { hasConditions, text: String(text ?? "") };
  const hits = [];
  for (const rule of RULES) {
    if (!rule.topics.some((topic) => topics.includes(topic))) continue;
    const sentence = sentences.find((s, i) =>
      rule.matches(s, { ...context, next: sentences[i + 1] ?? "" }),
    );
    if (!sentence) continue;
    hits.push({
      rule: rule.id,
      sentence,
      says: rule.says,
      correction: rule.correction(topics),
    });
  }
  return hits;
}

function quoteWithSource(correctionId) {
  const quote = quotes.corrections[correctionId];
  const meanings = (quote.abbreviations ?? [])
    .map((a) => `${a.short} means ${a.long}`)
    .join("; ");
  const gloss = meanings ? ` (${meanings})` : "";
  return `${quote.citation} says: "${quote.text}"${gloss}`;
}

/** The plain note appended for one contradiction. */
export function buildContradictionNote(hit) {
  return `Vet-Rate check: this answer ${hit.says}. ${quoteWithSource(hit.correction)} Check this point with a Veterans Service Officer before relying on it.`;
}

const looksStructured = (text) => /^\s*(?:```|[{[])/.test(text);

const hasConditions = (options) =>
  Array.isArray(options.conditions) && options.conditions.length > 0;

/**
 * Append a correction to a prose answer for each contradiction found, and
 * record them on the result (contradictionsFound, plus validationWarnings).
 * Nothing is checked when reference material was turned off for the call,
 * when the answer is structured output, or when the calculator guard already
 * replaced the answer with the app's own text.
 */
export function flagContradictions(result, options = {}, prompt = "") {
  const text = result?.text;
  if (typeof text !== "string" || text === "") return result;
  if (options.useDKB === false || result.calculatorReplacement) return result;
  if (options.responseFormat || looksStructured(text)) return result;
  const topics = detectReferenceTopics(prompt, options.toolId, {
    conditions: options.conditions,
    dataClass: options.dataClass,
  });
  const hits = findContradictions(text, {
    topics,
    hasConditions: hasConditions(options),
  });
  if (hits.length === 0) return result;
  return {
    ...result,
    text: [text.trimEnd(), ...hits.map(buildContradictionNote)].join("\n\n"),
    validationWarnings: [
      ...(result.validationWarnings || []),
      `Answer contradicts the verified reference: ${hits.map((h) => h.rule).join(", ")}`,
    ],
    contradictionsFound: hits.map(({ rule, sentence }) => ({ rule, sentence })),
  };
}
