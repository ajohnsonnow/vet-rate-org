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
