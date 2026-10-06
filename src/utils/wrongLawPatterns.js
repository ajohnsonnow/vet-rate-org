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
