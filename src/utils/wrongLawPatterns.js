/**
 * Sentence patterns for three statements of wrong law seen in the recorded
 * laptop-model answers. Each is narrow on purpose: it has to stay silent on
 * every correct sentence in the recorded runs that uses the same words.
 */

// "one disability rated at 70% or two or more ...": the figure is offered as
// the threshold, with the two-disability alternative after it. "You have one
// disability rated at 70%." states a rating and is not this.
const SINGLE_DISABILITY_THRESHOLD =
  /\b(?:one|single)(?: service-connected)? disability (?:is )?(?:rated|ratable) at (?:least )?(\d{2,3}) ?(?:%|percent)(?: or (?:more|higher))?,? or two\b/i;
const SINGLE_DISABILITY_PERCENT = 60;

/** The percentage a sentence gives for one disability, when it is not 60. */
export function wrongSingleDisabilityThreshold(sentence) {
  if (/\?$/.test(sentence)) return null;
  const stated = SINGLE_DISABILITY_THRESHOLD.exec(sentence);
  if (!stated) return null;
  const percent = Number(stated[1]);
  return percent === SINGLE_DISABILITY_PERCENT ? null : percent;
}

// "60% or more, or a combined rating of 70% or more" for TDIU, with no word
// of the 40 percent one disability must reach. The sentence has to name TDIU
// itself, which is what lets the rule run without a topic.
const SIXTY_OR_COMBINED_SEVENTY =
  /\b60 ?(?:%|percent) or (?:more|higher),? or (?:a )?combined (?:rating|total)(?: of)? 70 ?(?:%|percent)/i;
const NAMES_TDIU = /\btdiu\b|unemployab/i;

export function givesTdiuThresholdsWithoutForty(sentence) {
  return (
    SIXTY_OR_COMBINED_SEVENTY.test(sentence) &&
    NAMES_TDIU.test(sentence) &&
    !/\b40\b/.test(sentence) &&
    !/\bnot\b|n't\b|\bnever\b/i.test(sentence)
  );
}

// "You cannot appeal the denial without new evidence." True of a Supplemental
// Claim and of a decision that has become final, so both are left alone.
const CANNOT_APPEAL_WITHOUT_NEW_EVIDENCE =
  /\b(?:cannot|can't|can not|may not)\b (?:\w+ ){0,2}(?:appeal|challenge)\b[^.;]{0,40}\b(?:without|unless you have|unless there is)\b[^.;]{0,15}\bnew\b[^.;]{0,20}\bevidence\b/i;
const TRUE_OF_THESE = /\bfinal\b|\bsupplemental\b/i;

export function saysAppealNeedsNewEvidence(sentence) {
  return (
    CANNOT_APPEAL_WITHOUT_NEW_EVIDENCE.test(sentence) &&
    !TRUE_OF_THESE.test(sentence)
  );
}

// The bilateral factor is for the right and left sides together (38 CFR
// 4.26). "Not conditions on the same side" says so and is left alone.
const BILATERAL = /\bbilateral\b/i;
const SAME_SIDE = /\bsame side\b/i;
const SAYS_OTHERWISE = /\bnot\b|n't\b|\bnever\b|\brather than\b/i;

export function putsBilateralOnOneSide(sentence) {
  return (
    BILATERAL.test(sentence) &&
    SAME_SIDE.test(sentence) &&
    !SAYS_OTHERWISE.test(sentence)
  );
}

// A Board order or a veteran's own history uses "new and material" rightly:
// it was the test when those decisions were made.
const QUOTED_DECISION =
  /\bBVA\b|\bBoard\b|\bORDER\b|\bhaving been (?:received|submitted|presented)\b|\bpreviously denied\b/i;
const OWN_HISTORY = /\b(?:I|[Mm]y)\b|\b(?:19\d\d|200\d|201[0-8])\b/;
// Outside a review question the phrase counts only where the sentence tells
// the reader what to do or what is required now. "New and material evidence
// was submitted" and "the Veteran did not submit new and material evidence"
// recount a decision.
const TELLS_THE_READER = /\byou\b|\bmust\b|\bis only appropriate\b/i;

export function givesNewAndMaterialAsAdvice(sentence) {
  return (
    TELLS_THE_READER.test(sentence) &&
    !QUOTED_DECISION.test(sentence) &&
    !OWN_HISTORY.test(sentence)
  );
}

const INTENT_PARAGRAPH = /\b3\.155\(b\)/;
const SUPPLEMENTAL_CLAIM_CALLED_FOR =
  /\bsupplemental claims?\b[^.;]{0,20}\b(?:is|are) required\b|\b(?:should|must|need to|have to) (?:file|submit) a supplemental claim\b/i;
const DENIED = /\bnot\b|n't\b|\bnever\b/i;

/** 38 CFR 3.155(b) given as the rule that calls for a Supplemental Claim. */
export function citesIntentParagraphForSupplementalClaim(sentence) {
  const cited = INTENT_PARAGRAPH.exec(sentence);
  const called = SUPPLEMENTAL_CLAIM_CALLED_FOR.exec(sentence);
  if (!cited || !called) return false;
  const upToTheCall = sentence.slice(0, called.index + called[0].length);
  if (DENIED.test(upToTheCall)) return false;
  const between = sentence.slice(
    Math.min(cited.index, called.index),
    Math.max(cited.index, called.index),
  );
  return !between.includes(";");
}

// "The higher of two evaluations" is 38 CFR 4.7, about one disability. It is
// wrong only as the way two disabilities combine.
const HIGHER_OF_TWO_AS_COMBINING =
  /\b(?:two or more disabilities|multiple disabilities|combined ratings?)\b[^.]{0,120}\bhigher of (?:the )?two\b|\breceives? the higher of the two\b/i;

export function takesHigherOfTwoAsCombined(sentence) {
  return HIGHER_OF_TWO_AS_COMBINING.test(sentence) && !DENIED.test(sentence);
}
