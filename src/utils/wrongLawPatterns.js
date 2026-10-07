/**
 * Sentence patterns for statements of wrong law seen in the recorded
 * answers. Each is narrow on purpose. Whether a sentence asserts anything at
 * all (a question, a denial, reported speech, a veteran's own account) is
 * decided once, for every rule, in assertionGuard.js; what is here is only
 * what each rule needs to tell its error from a true sentence that uses the
 * same words. The true sentences each one must stay silent on are in
 * src/__tests__/utils/fixtures/correctionRuleReview.json.
 */

// "one disability rated at 70% or two or more disabilities ...": the figure
// is offered as the single-disability threshold, with the two-disability
// alternative after it. 60 is the right figure, and 40 is the right figure
// for one disability on the two-disability route, so neither is an error.
// A rating of 100 belongs to other benefits.
const SINGLE_DISABILITY_THRESHOLD =
  /\b(?:one|single)(?: service-connected)? disability (?:is )?(?:rated|ratable) at (?:least )?(\d{2,3}) ?(?:%|percent)(?: or (?:more|higher))?,? or two (?:or more )?disabilities\b/i;
const RIGHT_OR_UNRELATED_FIGURES = [40, 60, 100];
const ON_THE_TWO_DISABILITY_ROUTE = /\btwo or more\b|\bsecond\b/i;

/** The percentage a sentence gives for one disability, when it is wrong. */
export function wrongSingleDisabilityThreshold(sentence) {
  const stated = SINGLE_DISABILITY_THRESHOLD.exec(sentence);
  if (!stated) return null;
  if (ON_THE_TWO_DISABILITY_ROUTE.test(sentence.slice(0, stated.index))) {
    return null;
  }
  const percent = Number(stated[1]);
  return RIGHT_OR_UNRELATED_FIGURES.includes(percent) ? null : percent;
}

// "60% or more, or a combined rating of 70% or more" for TDIU, with no word
// of the 40 percent one disability must reach, in this sentence or the ones
// on either side of it. The sentence has to name TDIU itself, and must not
// be offering the figures as a shorthand it says is incomplete.
const SIXTY_OR_COMBINED_SEVENTY =
  /\b60 ?(?:%|percent) or (?:more|higher),? or (?:a )?combined (?:rating|total)(?: of)? 70 ?(?:%|percent)/i;
const NAMES_TDIU = /\btdiu\b|unemployab/i;
const GIVES_THE_FORTY = /\b40\b|\bforty\b/i;
const CALLS_IT_INCOMPLETE =
  /\bleft out\b|\bleaves? out\b|\bshorthand\b|\bincomplete\b|\bdrops?\b|\bhalf the rule\b/i;

export function givesTdiuThresholdsWithoutForty(
  sentence,
  { next = "", previous = "" } = {},
) {
  return (
    SIXTY_OR_COMBINED_SEVENTY.test(sentence) &&
    NAMES_TDIU.test(sentence) &&
    !GIVES_THE_FORTY.test(sentence) &&
    !GIVES_THE_FORTY.test(next) &&
    !GIVES_THE_FORTY.test(previous) &&
    !CALLS_IT_INCOMPLETE.test(sentence)
  );
}

// "You cannot appeal the denial without new evidence." True of a Supplemental
// Claim, of a decision that has become final, and of any decision once the
// year for review has run; a correction pointing to a higher-level review
// would then send the reader to a lane that is closed.
const CANNOT_APPEAL_WITHOUT_NEW_EVIDENCE =
  /\b(?:cannot|can't|can not|may not)\b (?:\w+ ){0,2}(?:appeal|challenge)\b[^.;]{0,40}\b(?:without|unless you have|unless there is)\b[^.;]{0,15}\bnew\b[^.;]{0,20}\bevidence\b/i;
const TRUE_OF_THESE = /\bfinal\b|\bsupplemental\b|\bhigher[- ]level review\b/i;
// Any word of time in the sentence: it may be about a decision whose review
// period has run, and no list of ways to say that is complete.
const TIME_WORDS = [
  "years?|months?|days?|period|window|deadline",
  "late|expired?|lapsed?|passed|ago|long|longer|old|older|open|closed",
].join("|");
const SPEAKS_OF_TIME = new RegExp(String.raw`\b(?:${TIME_WORDS})\b`, "i");

export function saysAppealNeedsNewEvidence(sentence) {
  return (
    CANNOT_APPEAL_WITHOUT_NEW_EVIDENCE.test(sentence) &&
    !TRUE_OF_THESE.test(sentence) &&
    !SPEAKS_OF_TIME.test(sentence)
  );
}

// The bilateral factor is for the right and left sides together (38 CFR
// 4.26). "Bilateral" alone is an ordinary medical word, so the sentence has
// to speak of the factor or of a bilateral pair, and tie it to the same side.
const BILATERAL_RULE = String.raw`\bbilateral["']? (?:factor|pair)\b`;
const SAME_SIDE = String.raw`\bsame side\b`;
const FACTOR_FOR_THE_SAME_SIDE = new RegExp(
  String.raw`${BILATERAL_RULE}[^;]{0,120}${SAME_SIDE}|${SAME_SIDE}[^;]{0,120}${BILATERAL_RULE}|\bbilateral \(same side\b`,
  "i",
);
const NAMES_BOTH_SIDES =
  /\beach side\b|\bboth sides\b|\bopposite sides?\b|\bother side\b|\b(?:right|left)-side\b/i;

export function putsBilateralOnOneSide(sentence) {
  return (
    FACTOR_FOR_THE_SAME_SIDE.test(sentence) && !NAMES_BOTH_SIDES.test(sentence)
  );
}

// The year after an intent to file runs from VA's receipt of the intent.
// "File ... within 1 year of receiving that form" starts it when the veteran
// is sent an application form. Where VA is the one receiving, it is right.
const FILE_WITHIN_A_YEAR_OF_RECEIVING_THAT_FORM =
  /\b(?:must|can|should|have to|need to)\b (?:then )?(?:file|be filed)\b[^.;]{0,50}\bwithin (?:1|one) year of receiving that form\b(?! from you\b| at\b)/i;

export function countsYearFromReceivingAForm(sentence) {
  return FILE_WITHIN_A_YEAR_OF_RECEIVING_THAT_FORM.test(sentence);
}

// A decided claim goes back by Supplemental Claim, not by a new claim. An
// abandoned or withdrawn claim, and a claim for increase, do take a new one.
const NEW_CLAIM_TO_REOPEN =
  /\breopen(?:ing|ed|s)?\b[^.]{0,50}\bclaim\b[^.]{0,30}\b(?:must|should|need to|have to) file a new claim\b/i;
const TAKES_A_NEW_CLAIM =
  /\babandon|\bwithdr[ae]w|\bincrease\b|\bworse|\bnever (?:decided|claimed)\b/i;

export function filesNewClaimToReopen(sentence) {
  return (
    NEW_CLAIM_TO_REOPEN.test(sentence) && !TAKES_A_NEW_CLAIM.test(sentence)
  );
}

// "If you are currently employed, you cannot receive TDIU": marginal
// employment is not substantially gainful employment (38 CFR 4.16(a)). Said
// of a substantially gainful occupation, it is the regulation's own rule.
const EMPLOYED_SO_NO_TDIU =
  /\bemployed\b[^.;]{0,40}\byou (?:cannot|can't|will not|won't) (?:receive|get|qualify for|be eligible for) TDIU\b/i;
const SUBSTANTIALLY_GAINFUL = /\bsubstantially gainful\b/i;
const MARGINAL = /\bmarginal\b|\bfull[- ]time\b|\bliving wage\b/i;
// "Being employed does not automatically mean you cannot receive TDIU" says
// the opposite of the error, with the error's words inside it.
const DENIES_THAT_IT_FOLLOWS =
  /\b(?:not|n't|never)\b (?:\w+ ){0,2}(?:mean|follow|true|the case)\b/i;

export function saysEmploymentBarsTdiu(sentence) {
  const stated = EMPLOYED_SO_NO_TDIU.exec(sentence);
  return (
    stated !== null &&
    !SUBSTANTIALLY_GAINFUL.test(stated[0]) &&
    !MARGINAL.test(sentence) &&
    !DENIES_THAT_IT_FOLLOWS.test(sentence)
  );
}

// 38 CFR 3.155(b) given as the rule that calls for a Supplemental Claim. A
// sentence that says what the paragraph is for, the intent to file, and then
// sends a denial to a Supplemental Claim is drawing the right distinction.
const INTENT_PARAGRAPH =
  /\b(?:per|under|according to|pursuant to)\b[^.,;]{0,12}\b3\.155\(b\)/i;
const SUPPLEMENTAL_CLAIM_CALLED_FOR =
  /\bsupplemental claims?\b[^.;]{0,20}\b(?:is|are) required\b|\b(?:should|must|need to|have to) (?:file|submit) a supplemental claim\b/i;
const SAYS_WHAT_THE_PARAGRAPH_IS_FOR = /\bintent[- ]to[- ]file\b|\bITF\b/i;

export function citesIntentParagraphForSupplementalClaim(sentence) {
  const cited = INTENT_PARAGRAPH.exec(sentence);
  const called = SUPPLEMENTAL_CLAIM_CALLED_FOR.exec(sentence);
  if (!cited || !called) return false;
  if (SAYS_WHAT_THE_PARAGRAPH_IS_FOR.test(sentence)) return false;
  const between = sentence.slice(
    Math.min(cited.index, called.index),
    Math.max(cited.index, called.index),
  );
  return !between.includes(";");
}

// "The higher of two evaluations" is 38 CFR 4.7, about one disability, and
// "the higher of the two" is how pension and compensation, and other paired
// benefits, are paid. It is wrong only as the way disability ratings combine,
// so the sentence has to be about that.
const HIGHER_OF_TWO = String.raw`\bhigher of (?:the )?two\b`;
const HIGHER_OF_TWO_AS_COMBINING = [
  new RegExp(String.raw`\bcombined ratings?\b[^.]{0,80}${HIGHER_OF_TWO}`, "i"),
  new RegExp(
    String.raw`\b(?:two or more|multiple) disabilities\b[^.;]{0,40}\brating is determined by\b[^.]{0,40}${HIGHER_OF_TWO}`,
    "i",
  ),
  /\breceives? the higher of the two (?:ratings|percentages|evaluations)\b/i,
];

// "More than the higher of the two and less than their sum" is the true rule.
// "... while the higher of two evaluations applies within one disability"
// sets the two rules apart, which is right.
const WITHIN_ONE_DISABILITY = /\b(?:one|a single|the same) disability\b/i;
const ABOVE_THE_HIGHER =
  /\b(?:more than|above|greater than|higher than|exceeds?) the higher of\b/i;

export function takesHigherOfTwoAsCombined(sentence) {
  return (
    HIGHER_OF_TWO_AS_COMBINING.some((pattern) => pattern.test(sentence)) &&
    !ABOVE_THE_HIGHER.test(sentence) &&
    !WITHIN_ONE_DISABILITY.test(sentence)
  );
}

// "Sleep apnea cannot be rated as secondary to PTSD", as a statement of what
// the regulations allow. 38 CFR 3.310(a) bars no pairing of conditions; a
// secondary claim turns on medical evidence. The gap between the verb and
// "secondary to" is kept short and free of figures, so "cannot be rated
// higher than 10 percent, whether direct or secondary to ..." is not this.
const SHORT_GAP = String.raw`(?:(?!higher|more than|percent|%)[^.;]){0,30}?`;
const BARRED_AS_SECONDARY = [
  new RegExp(
    String.raw`\b(?:cannot|can't|can not|may not) be (?:rated|service[- ]connected|claimed|granted|awarded|approved|compensated)\b${SHORT_GAP}\bsecondary to\b`,
    "i",
  ),
  new RegExp(
    String.raw`\b(?:cannot|can't|can not|may not) (?:claim|file for|get|receive)\b${SHORT_GAP}\bsecondary to\b`,
    "i",
  ),
  new RegExp(
    String.raw`\b(?:does|do) not (?:allow|permit|recognize)\b${SHORT_GAP}\bsecondary to\b`,
    "i",
  ),
  /\b(?:cannot|can't|can not) be secondary to\b/i,
  /\b(?:does|do) not qualify (?:as|for) secondary\b/i,
];

// Limits that do exist: the primary condition has to be service connected,
// and the same symptoms are not rated twice.
const A_REAL_LIMIT =
  /\bnon-?service[- ]connected\b|\b(?:not|n't) (?:yet )?service[- ]connected\b|\bpyramiding\b|\btwice\b|\bsame symptoms?\b|\balready rated\b|\bseparately\b/i;
// A statement about the proof in a case, or about what is still needed.
const ABOUT_THE_PROOF =
  /\bwithout\b|\bunless\b|\buntil\b|\byet\b|\bevidence\b|\brecords?\b|\bnexus\b|\bmedical opinion\b|\bin your (?:case|file)\b/i;

const statesARealLimitOrProof = (sentence) =>
  A_REAL_LIMIT.test(sentence) || ABOUT_THE_PROOF.test(sentence);

export function saysSecondaryIsBarred(sentence) {
  return (
    BARRED_AS_SECONDARY.some((pattern) => pattern.test(sentence)) &&
    !statesARealLimitOrProof(sentence)
  );
}

/** For the rule's older patterns, which share the same true exceptions. */
export function statesARealSecondaryLimit(sentence) {
  return A_REAL_LIMIT.test(sentence);
}
