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
import { findWrongCoverageDate } from "./coverageDates";
import { submitsNewMaterialInReview } from "./reviewSubmissions";
import { findFormMismatch, findIntentFormAsApplication } from "./vaForms";
import { detectReferenceTopics } from "./verifiedReference";
import {
  citesIntentParagraphForSupplementalClaim,
  takesHigherOfTwoAsCombined,
  wrongSingleDisabilityThreshold,
} from "./wrongLawPatterns";

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
const ASKS_FOR =
  /\b(?:need|needs|must|requires?|required|provide|show|ensure|gather|submit)\b/i;
const EVIDENCE_OF_EXPOSURE =
  /\b(?:evidence|documentation|proof|records?)(?: \([^)]{0,90}\))? (?:of|regarding|showing|confirming|noting|detailing) (?:\w+ ){0,3}exposures?\b/i;
const EXPOSURE_PAPERWORK = /\bexposure (?:documentation|records|history)\b/i;
// Asking for a medical link is a different demand, and outside a presumption
// it is the right one.
const ABOUT_THE_LINK =
  /\brelationship\b|\bnexus\b|\blink(?:s|ed|ing)?\b|\bcaus|\bwithout\b|\bno (?:evidence|documentation|proof)\b/i;

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
// "Less likely than not" is the examiner's wording, not a denial of anything.
const LIKELIHOOD_WORDING = /\bas likely as not\b|\bless likely than not\b/gi;
const withoutLikelihoodWording = (sentence) =>
  sentence.replace(LIKELIHOOD_WORDING, "");

const HEARING_INSIDE_REVIEW =
  /\b(?:in|during|as part of|at|with) (?:the|your|a) higher[- ]level review\b(?:(?! or )[^.;]){0,80}\bhearing\b/i;
const HEARING_THEN_REVIEW =
  /\bhearing\b(?:(?! or )[^.;]){0,40}\b(?:in|during|as part of|at|with|for) (?:the|your|a) higher[- ]level review\b/i;
const REVIEW_HEARING = /\bhigher[- ]level review hearing\b/i;
const NO_HEARING = /\bno\b|\bnot\b|n't\b|\bcannot\b|\bwithout\b|\binstead\b/i;

const YEAR_FROM_TODAY =
  /\b(?:one|1|a)[- ]year(?: period)? (?:from|after|of|starting) (?:today|now|right now|this moment)\b/i;
const ABOUT_A_REVIEW = /\breview\b|\bappeal|\bdecision\b|\bboard\b|\bdisagree/i;

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

const BY_ADDING_RATINGS =
  /\bby (?:simply )?adding (?:up )?(?:all )?(?:of )?(?:the |your )?(?:individual |separate )?ratings\b/i;
const ADD_RATINGS_TOGETHER =
  /\badd(?:s|ed|ing)? (?:up )?(?:the |your |all )?(?:individual )?ratings (?:of [^.]{0,40} )?together\b/i;
const RATINGS_ARE_ADDED =
  /\bratings (?:are|get) (?:simply |just )?added (?:together|up)\b/i;
// An answer that explains combining, or says adding is wrong, uses the same
// words. Any of these in the sentence means it is not the addition myth.
const NOT_PLAIN_ADDITION =
  /\bnot\b|n't\b|\bnever\b|\brather than\b|\binstead of\b|\bsequential|\bone by one\b|\bone at a time\b|\bremaining\b|\bmyth\b|\bwrong\b|\bincorrect\b|\bexpect\b|\bthink\b/i;

const PERCENT = String.raw`(\d{1,3}) ?\\?%\)?`;
const LABEL_AFTER = String.raw`(?: ?\([^)]{0,30}\))?`;
const LABEL_BEFORE = String.raw`(?:[A-Za-z ]{0,25}\()?`;
const TWO_RATINGS_SUMMED = new RegExp(
  String.raw`(?<![\d.])${PERCENT}${LABEL_AFTER} ?\+ ?${LABEL_BEFORE}${PERCENT}${LABEL_AFTER} ?= ?${PERCENT}`,
  "g",
);

const isRating = (value) => value > 0 && value <= 100 && value % 10 === 0;

/**
 * Whether a sentence shows two ratings added to a figure that is their plain
 * sum ("50% + 30% = 80%"). Combining never gives the sum, so the figure is
 * wrong whenever both operands are ratings. A bilateral factor being added
 * ("20% + 2% = 22%") is not two ratings.
 */
function showsRatingsSummed(sentence) {
  return [...sentence.matchAll(TWO_RATINGS_SUMMED)].some(([, a, b, total]) => {
    const first = Number(a);
    const second = Number(b);
    return (
      isRating(first) && isRating(second) && Number(total) === first + second
    );
  });
}

const PACT_TOPICS = ["toxic-exposure", "herbicide", "pact-act"];
const REVIEW_TOPICS = ["decision-review", "supplemental", "next-claim-step"];
const FILING_TOPICS = [...REVIEW_TOPICS, "intent-to-file"];

const EVERY_ANSWER = null;

/**
 * One rule per contradiction. `topics` are the verified-reference topics the
 * rule belongs to (EVERY_ANSWER for the one rule that is not tied to a
 * topic), `matches(sentence, { next, text, hasConditions })` decides one
 * sentence (`next` is the sentence after it, `text` the whole answer), `says`
 * is what the note tells the reader the answer said, and `correction` names
 * the quotation in verifiedQuotes.json.
 */
const RULES = [
  {
    // The rating guards run on the rater route only. Any tool can repeat the
    // most common false belief about VA ratings, so this one runs everywhere.
    id: "ratings-added-together",
    topics: EVERY_ANSWER,
    matches: (sentence) =>
      !NOT_PLAIN_ADDITION.test(sentence) &&
      (anyMatch(
        sentence,
        BY_ADDING_RATINGS,
        ADD_RATINGS_TOGETHER,
        RATINGS_ARE_ADDED,
      ) ||
        showsRatingsSummed(sentence)),
    says: "adds VA ratings together",
    correction: () => "ratings-combined",
  },
  {
    id: "ratings-higher-of-two",
    topics: EVERY_ANSWER,
    matches: takesHigherOfTwoAsCombined,
    says: "takes the higher of two ratings as the combined rating",
    correction: () => "ratings-combined",
  },
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
    topics: ["toxic-exposure", "herbicide"],
    matches: (sentence) =>
      (NEEDS_EXPOSURE_PROOF.test(sentence) ||
        (ASKS_FOR.test(sentence) &&
          anyMatch(sentence, EVIDENCE_OF_EXPOSURE, EXPOSURE_PAPERWORK))) &&
      !anyMatch(
        sentence,
        OUTSIDE_THE_PRESUMPTION,
        NO_PROOF_NEEDED,
        ABOUT_THE_LINK,
      ),
    says: "asks you to prove you were exposed",
    correction: (topics) =>
      topics.includes("toxic-exposure")
        ? "presumed-toxic-exposure"
        : "presumed-herbicide-exposure",
  },
  {
    id: "coverage-date-for-wrong-place",
    topics: ["toxic-exposure"],
    matches: (sentence, { question }) =>
      findWrongCoverageDate(sentence, { question }) !== null,
    describe: (sentence, { question }) => {
      const { wrongDate, quote } = findWrongCoverageDate(sentence, {
        question,
      });
      const rightDate = quote.text.slice(
        "Active service on or after ".length,
        quote.text.indexOf(":"),
      );
      return {
        says: `gives ${wrongDate} as the start date for a place the table lists under ${rightDate}`,
        quote,
      };
    },
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
    // `hasConditions` marks an answer recorded when a calculator guard checked
    // threshold conclusions on calls with structured conditions. No live call
    // sets it: such a call is now answered by the calculator, or, when its
    // conditions are unusable, by the model with this rule applied.
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
    id: "tdiu-wrong-single-threshold",
    topics: ["tdiu"],
    matches: (sentence) => wrongSingleDisabilityThreshold(sentence) !== null,
    describe: (sentence) => ({
      says: `gives ${wrongSingleDisabilityThreshold(sentence)} percent as the rating one disability needs for TDIU`,
    }),
    correction: () => "tdiu-judgment",
  },
  {
    id: "intent-paragraph-for-supplemental-claim",
    topics: FILING_TOPICS,
    matches: citesIntentParagraphForSupplementalClaim,
    says: "cites 38 CFR 3.155(b), the intent-to-file paragraph, as the rule for a Supplemental Claim",
    correction: () => "intent-paragraph-scope",
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
    matches: (sentence) => {
      const plain = withoutLikelihoodWording(sentence);
      return (
        (HIGHER_LEVEL_REVIEW.test(plain) &&
          ADDS_EVIDENCE.test(plain) &&
          !NOT_ABOUT_ADDING.test(plain)) ||
        submitsNewMaterialInReview(plain)
      );
    },
    says: "has you send new evidence with a higher-level review",
    correction: () => "higher-level-review-evidence",
  },
  {
    id: "higher-level-review-hearing",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      anyMatch(
        sentence,
        HEARING_INSIDE_REVIEW,
        HEARING_THEN_REVIEW,
        REVIEW_HEARING,
      ) && !NO_HEARING.test(withoutLikelihoodWording(sentence)),
    says: "asks for a hearing in a higher-level review, where the regulation provides for an informal conference",
    correction: () => "higher-level-review-conference",
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
    // An Intent to File does run for a year from the day it is filed.
    id: "review-period-from-wrong-day",
    topics: REVIEW_TOPICS,
    matches: (sentence) =>
      YEAR_FROM_TODAY.test(sentence) &&
      ABOUT_A_REVIEW.test(sentence) &&
      !INTENT_TO_FILE.test(sentence),
    says: "counts the year for asking for a review from today, but it runs from the date of the decision notice",
    correction: () => "review-period-start",
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
    id: "form-for-another-filing",
    topics: FILING_TOPICS,
    matches: (sentence) => findFormMismatch(sentence) !== null,
    describe: (sentence) => {
      const { label, number, quote } = findFormMismatch(sentence);
      return {
        says: `gives VA Form ${number} as the form for ${label}`,
        quote,
      };
    },
  },
  {
    id: "intent-form-as-application",
    topics: FILING_TOPICS,
    matches: (sentence) => findIntentFormAsApplication(sentence) !== null,
    describe: (sentence) => {
      const { number, quote } = findIntentFormAsApplication(sentence);
      return {
        says: `gives VA Form ${number} as the application form, but that is the Intent to File form`,
        quote,
      };
    },
  },
  {
    id: "intent-to-file-for-filed-claim",
    topics: FILING_TOPICS,
    matches: (sentence) =>
      INTENT_TO_FILE.test(sentence) &&
      anyMatch(sentence, FOR_PENDING_CLAIMS, FOR_CLAIMS_ALREADY_FILED) &&
      !NEGATED.test(sentence.replace(/\bnot yet filed an intent\b/i, "")),
    says: "recommends an Intent to File for a claim that is already filed, and a filed claim already has its own filing date",
    correction: () => "claim-has-its-own-date",
  },
];

export const CONTRADICTION_RULE_IDS = RULES.map((rule) => rule.id);

/**
 * The contradictions in an answer, at most one per rule: { rule, sentence,
 * says, correction } (or `quote` in place of `correction` when the rule
 * takes its quotation from the bundled entry itself). `topics` are the
 * verified-reference topics of the request; rules of other topics are not
 * applied.
 */
export function findContradictions(
  text,
  { topics = [], hasConditions = false, question = "" } = {},
) {
  const sentences = sentencesOf(text);
  const context = { hasConditions, question, text: String(text ?? "") };
  const hits = [];
  for (const rule of RULES) {
    const applies =
      rule.topics === EVERY_ANSWER ||
      rule.topics.some((topic) => topics.includes(topic));
    if (!applies) continue;
    const sentence = sentences.find((s, i) =>
      rule.matches(s, { ...context, next: sentences[i + 1] ?? "" }),
    );
    if (!sentence) continue;
    hits.push({
      rule: rule.id,
      sentence,
      says: rule.says,
      ...(rule.correction ? { correction: rule.correction(topics) } : {}),
      ...(rule.describe ? rule.describe(sentence, context) : {}),
    });
  }
  return hits;
}

function quoteWithSource(hit) {
  const quote = hit.quote ?? quotes.corrections[hit.correction];
  const meanings = (quote.abbreviations ?? [])
    .map((a) => `${a.short} means ${a.long}`)
    .join("; ");
  const gloss = meanings ? ` (${meanings})` : "";
  return `${quote.citation} says: "${quote.text}"${gloss}`;
}

/**
 * The note for one contradiction, shown beside the text it corrects (the
 * Decision Decoder puts it under the field that carried the sentence).
 */
export function buildContradictionNote(hit) {
  return `Vet-Rate check: this answer ${hit.says}. ${quoteWithSource(hit)} Check this point with a Veterans Service Officer before relying on it.`;
}

const MAX_QUOTED_SENTENCE = 200;

const trimmed = (sentence) =>
  sentence.length > MAX_QUOTED_SENTENCE
    ? `${sentence.slice(0, MAX_QUOTED_SENTENCE).trimEnd()}...`
    : sentence;

/**
 * The correction placed above a prose answer: one heading, then for each
 * contradiction the sentence of the answer it applies to and the regulation
 * sentence that says otherwise. It goes first because a wrong instruction is
 * acted on by the time a note at the bottom is read.
 */
export function buildContradictionLead(hits) {
  return [
    "Vet-Rate check: part of the answer below conflicts with the regulation.",
    ...hits.map(
      (hit) =>
        `\nThe answer says: "${trimmed(hit.sentence)}"\nThat ${hit.says}. ${quoteWithSource(hit)}`,
    ),
    "\nCheck that part with a Veterans Service Officer before relying on it. The answer follows, unchanged.",
  ].join("\n");
}

const looksStructured = (text) => /^\s*(?:```|[{[])/.test(text);

/**
 * Put a correction above a prose answer that contradicts the verified text,
 * leaving the answer itself unaltered below it, and record what was found on
 * the result (contradictionsFound, plus validationWarnings).
 * Nothing is checked when the answer is structured output. Text the app wrote
 * without a model (the calculator's answer, the request for ratings) never
 * comes here: generateAI returns it before any model answer is checked. A
 * call with reference material turned off raises no topic, so only the rule
 * that applies to every answer runs on it.
 */
export function flagContradictions(result, options = {}, prompt = "") {
  const text = result?.text;
  if (typeof text !== "string" || text === "") return result;
  if (options.responseFormat || looksStructured(text)) return result;
  const topics =
    options.useDKB === false
      ? []
      : detectReferenceTopics(prompt, options.toolId, {
          conditions: options.conditions,
          dataClass: options.dataClass,
        });
  const hits = findContradictions(text, { topics, question: prompt });
  if (hits.length === 0) return result;
  return {
    ...result,
    text: `${buildContradictionLead(hits)}\n\n${text}`,
    validationWarnings: [
      ...(result.validationWarnings || []),
      `Answer contradicts the verified reference: ${hits.map((h) => h.rule).join(", ")}`,
    ],
    contradictionsFound: hits.map(({ rule, sentence }) => ({ rule, sentence })),
  };
}
