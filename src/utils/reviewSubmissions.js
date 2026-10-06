/**
 * Whether a sentence has the reader hand in something new in or with a
 * Higher-Level Review: a medical opinion, a nexus letter, a witness
 * statement, records, or "new" anything. That lane decides on the record as
 * it stood (38 CFR 3.2601(f)), so whatever the sentence calls it, it is new
 * evidence. A written argument about an error is not, and is left alone.
 */

const REVIEW = String.raw`(?:higher[- ]level review|HLR)(?: request)?`;
const PLACED_IN_REVIEW = new RegExp(
  String.raw`\b(?:in|during|as part of|with|within) (?:the|your|a) ${REVIEW}\b`,
  "i",
);
const HANDS_IN = String.raw`\b(?:submit(?:ting)?|includ(?:e|ing)|provid(?:e|ing)|attach(?:ing)?|add(?:ing)?|send(?:ing)?(?: in)?|upload(?:ing)?|present(?:ing)?|enclos(?:e|ing))\b`;
const NOT_EVIDENCE = String.raw`(?!forms?\b|requests?\b|arguments?\b|reviews?\b|claims?\b|appeals?\b|decisions?\b)`;
const SOMETHING_NEW = String.raw`(?:new|additional|updated|further)\s+${NOT_EVIDENCE}`;
const NAMED_EVIDENCE = String.raw`(?:[\w']+ ){0,2}(?:medical opinions?|nexus letters?|(?:buddy|lay|witness|personal) statements?|(?:medical|treatment|private) records|evidence|documentation|test results)\b`;
const HANDS_IN_EVIDENCE = new RegExp(
  String.raw`${HANDS_IN} (?:an? |any |your |the |some |more )?(?:${SOMETHING_NEW}|${NAMED_EVIDENCE})`,
  "gi",
);
const WITH_THE_REVIEW = new RegExp(
  String.raw`^[^.;]{0,80}\b(?:in|with|during|as part of) (?:the|your|a) ${REVIEW}\b`,
  "i",
);

// "you cannot submit", "do not include": a denial counts only when it sits on
// the verb, within a few words before it. A "not" earlier in the sentence is
// about something else.
const DENIAL = /^(?:not|cannot|never|no|without)$|n't$/i;
const WORDS_CHECKED = 5;
const deniedJustBefore = (text) =>
  text
    .split(/[^A-Za-z']+/)
    .filter(Boolean)
    .slice(-WORDS_CHECKED)
    .some((word) => DENIAL.test(word));
const ANOTHER_LANE = /\bsupplemental\b|\binstead\b|\brather than\b|\bboard\b/i;

// "If the Higher-Level Review is denied ...", "... of the Higher-Level Review
// decision": the review is the decision being appealed, not the lane in use.
const REVIEW_ALREADY_DECIDED = new RegExp(
  String.raw`\b${REVIEW} (?:is|was|gets|has been) (?:denied|decided|unsuccessful|unfavou?rable)\b|\b${REVIEW} (?:decision|denial|result|outcome)\b|\bafter (?:the|a|your) ${REVIEW}\b`,
  "gi",
);
const ANY_REVIEW = new RegExp(String.raw`\b${REVIEW}\b`, "gi");
const A_LANE_THAT_TAKES_EVIDENCE =
  /\bboard\b|\bnotices? of disagreement\b|\bNOD\b|\b10182\b|\bsupplemental claims?\b|\b20-0995\b/gi;
const THE_EVIDENCE = /\b(?:new|additional) (?:evidence|medical opinion)\b/i;

const lastStart = (text, pattern) =>
  [...text.matchAll(pattern)].reduce((last, match) => match.index, -1);

/**
 * Whether the new evidence in a sentence that names a Higher-Level Review
 * goes somewhere else: the review is only the decision being appealed, or
 * the lane named last before the evidence is a Board appeal or a
 * Supplemental Claim. "In the Higher-Level Review, request a Board hearing
 * to submit additional evidence" puts it all inside the review and is not
 * that.
 */
export function evidenceGoesToAnotherLane(sentence) {
  const reviewInUse = sentence.replace(REVIEW_ALREADY_DECIDED, "");
  if (lastStart(reviewInUse, ANY_REVIEW) < 0) return true;
  if (PLACED_IN_REVIEW.test(reviewInUse)) return false;
  const evidence = THE_EVIDENCE.exec(sentence);
  if (!evidence) return false;
  const before = sentence.slice(0, evidence.index);
  return (
    lastStart(before, A_LANE_THAT_TAKES_EVIDENCE) >
    lastStart(before, ANY_REVIEW)
  );
}

export function submitsNewMaterialInReview(sentence) {
  if (ANOTHER_LANE.test(sentence)) return false;
  const placed = PLACED_IN_REVIEW.exec(sentence);
  return [...sentence.matchAll(HANDS_IN_EVIDENCE)].some((handsIn) => {
    if (deniedJustBefore(sentence.slice(0, handsIn.index))) return false;
    const after = sentence.slice(handsIn.index + handsIn[0].length);
    return (
      (placed !== null && placed.index < handsIn.index) ||
      WITH_THE_REVIEW.test(after)
    );
  });
}
