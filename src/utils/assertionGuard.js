/**
 * The test every correction rule passes through before it may fire: does the
 * sentence put its claim to the reader as true? The rules match words, and
 * the same words appear under a "Myth:" label, in a list of common mistakes,
 * in a warning against the error, in what someone else said, in a veteran's
 * own history and in an account of the law as it used to be. None of those
 * states the error, so none of them gets a correction.
 *
 * `claimAsserted(sentence, guard, matches, around)` is the one entry point.
 * In order:
 * 1. Not an assertion at all, for every rule: a question; a sentence framed
 *    as a myth, a mistake or a thing that is false; a sentence under a
 *    heading such as "Common mistakes:"; a statement that something is
 *    excluded; a claim attributed to someone else; a narrative of the
 *    veteran's or a witness's own past; the law as it was; a sentence the
 *    next sentence corrects.
 * 2. A denial inside the sentence: the clauses that deny or warn are taken
 *    out, and the rule is asked whether it matches what is left. "VA does not
 *    add ratings together" has nothing left. "Ratings are added, with
 *    exceptions for conditions that cannot be combined" still says ratings
 *    are added.
 *
 * A label is never cut off and the rest matched again: "Myth: X" does not
 * assert X.
 *
 * Two kinds of rule switch one part off, in the rule table:
 * - `readsDenialItself`: the error is itself a denial ("you cannot appeal
 *   without new evidence"), so step 2 is skipped and the rule reads the "not";
 * - `datedClaim`: the error is a date, so an older year in the sentence is
 *   the claim, not a sign of history.
 */

// The examiner's standard wording, and "not" used for "so far" or "more
// than": none of these denies anything.
const NOT_A_DENIAL =
  /\bas likely as not\b|\bless likely than not\b|\bnot (?=(?:previously|yet|already|just|only)\b)/gi;

const IS_A_QUESTION = /\?\s*["')\]]*$/;

const any = (patterns) => (text) => patterns.some((p) => p.test(text));

// "Myth: X", "A common mistake is X", "It is false that X", "The idea that X
// is mistaken": the sentence is about the error, it does not state it.
const LABELS = [
  "myths?|false|untrue|not true|wrong|incorrect|misconceptions?|mistakes?",
  "errors?|rumou?rs?|fiction|outdated advice|bad advice",
].join("|");
const framedAsAnError = any([
  new RegExp(String.raw`^\W*(?:${LABELS})\s*[:–—-]`, "i"),
  /\b(?:myths?|misconceptions?|mistake(?:s|n|nly)?|mix-ups?|wrongly|typos?)\b/i,
  /\bmis(?:label|quot|stat)\w*/i,
  /\b(?:common|classic|frequent|usual|familiar|big|biggest) errors?\b|\bis (?:the|an?) (?:\w+ )?error\b/i,
  /\bit is (?:not|false|untrue|not true|not the case|never true)\b[^.]{0,12}\bthat\b/i,
  /\bneither is it true\b|\bthe idea that\b|\bfar from\b|\bonly in the popular imagination\b/i,
]);

// "A Higher-Level Review is closed to new evidence", "the bilateral factor
// requires a left and a right": the sentence says what is kept out.
const saysWhatIsExcluded = any([
  /\bclosed to\b|\bexcludes?\b|\bexcluded\b|\bskips?\b|\bunavailable\b/i,
  /\brequires a left and a right\b|\bbelongs? in a different lane\b/i,
]);

// The claim is someone else's: "some say", "your VSO advised", "you may have
// heard", "it is often claimed", "if someone tells you". The speaker has to
// be named as other than the answer itself: "As I said" and "VA told
// Congress it would keep the rule simple" attribute nothing.
const SPEAKERS = String.raw`(?:someone|somebody|anyone|people|some|many|others?|they|veterans|forums?|websites?|sites|guides?|advis[eo]rs?|(?:the|my|your|his|her|an?|another|earlier) (?:\w+ )?(?:vso|representative|rep|lawyer|attorney|clerk|letter|decision|veteran|friend|buddy|paperwork|website|forum|guide))`;
const SPEECH = String.raw`(?:say|says|said|tell|tells|told|claim that|claims|claimed|writes|wrote|advises|advised|assume|assumes|assumed|think|thinks|thought|believe|believes|believed|expected|talk about|talks about|list the|lists|mention|mentions)`;
const attributedToSomeoneElse = any([
  new RegExp(String.raw`\b${SPEAKERS}\b[^.;:]{0,30}\b${SPEECH}\b`, "i"),
  /\b(?:you|he|she|I|we) (?:may have |might have |will have |were |was )?(?:heard|been told|told (?:that|to)|read (?:that|somewhere))\b/i,
  /\b(?:he|she|I|we|you) (?:was|were) told\b/i,
  /\bI (?:thought|assumed|expected|believed)\b/,
  /\bit is (?:often|sometimes|commonly|widely|still) (?:claimed|said|believed|assumed|thought)\b/i,
]);

// A narrative of the speaker's or a witness's own past: "I asked for a
// Higher-Level Review ...", "she was rated under both codes". A bare "my",
// "me", "he" or "her" is not that: answers say "let me be clear", "in my
// experience" and "a veteran and her spouse" about nobody's history.
const PAST_ACTS = String.raw`(?:had|did|filed|asked|tried|chose|mailed|appealed|deployed|served|got|received|submitted|sent|went|left|applied|requested|missed)`;
const tellsOwnPast = any([
  new RegExp(String.raw`\bI ${PAST_ACTS}\b`),
  /\bI was (?!able\b|going\b|about\b)/,
  new RegExp(String.raw`\b(?:he|she) (?:was|${PAST_ACTS})\b`, "i"),
  /\b[Mm]y \w+(?: \w+)? (?:was|were|left|had)\b/,
]);

// The law as it was. A year before 2019 counts only where it dates something
// ("in 2014", "of March 2016"); "since 2015 the rule has been" is about now.
const describesTheOldLaw = any([
  /\bbefore the appeals modernization act\b|\bback then\b|\bat that time\b|\bright at the time\b|\bpre-2019\b|\bearlier (?:test|standard)\b/i,
]);
const DATED_BEFORE_2019 =
  /\b(?:in|of|from|during|until|before|dated) (?:\w+ )?(?:19\d\d|200\d|201[0-8])\b/i;

// The answer saying what it lacks in order to decide: a request, not a rule.
const saysWhatItLacks = any([
  /\bplease (?:provide|upload|share|send|supply|attach)\b/i,
  /\bI (?:do not|don't) have\b|\bwould allow me to\b|\bI (?:would )?need\b/,
  /\bI (?:cannot|can't) (?:determine|tell|say) (?:if|whether)\b/,
]);

// The sentence, or the one after it, goes on to give the right rule.
const givesTheRightRule = any([
  /\bthe (?:real|right|correct|actual|current) (?:answer|rule|number|form|figure|term|test) is\b/i,
  /\bthe real \w+(?:-\w+)? figure\b/i,
  /^(?:in fact|actually|in reality)\b/i,
  /\bVA combines them\b|^they are combined\b/i,
]);

// Taking one phrase out can leave another behind ("not not previously"
// becomes "not previously"), so it repeats until nothing more comes out.
function plain(sentence) {
  let text = String(sentence ?? "");
  let before;
  do {
    before = text;
    text = text.replace(NOT_A_DENIAL, "");
  } while (text !== before);
  return text.trim();
}

/**
 * Whether a sentence is the kind that can state a claim to the reader at
 * all. `around` carries `next` (the sentence after) and
 * `underDenyingHeading` (the sentence sits under "Common mistakes:" or the
 * like). Denials inside the sentence are judged in `claimAsserted`.
 */
export function addressesTheReader(
  sentence,
  { datedClaim = false } = {},
  { next = "", underDenyingHeading = false } = {},
) {
  const text = plain(sentence);
  if (text === "" || IS_A_QUESTION.test(text)) return false;
  if (underDenyingHeading) return false;
  if (framedAsAnError(text) || saysWhatIsExcluded(text)) return false;
  if (attributedToSomeoneElse(text) || tellsOwnPast(text)) return false;
  if (saysWhatItLacks(text)) return false;
  if (describesTheOldLaw(text)) return false;
  if (!datedClaim && DATED_BEFORE_2019.test(text)) return false;
  return !givesTheRightRule(text) && !givesTheRightRule(plain(next));
}

const DENIES_OR_WARNS =
  /\bnot\b|n't\b|\bno\b|\bnothing\b|\bneither\b|\bnor\b|\bcannot\b|\bnever\b|\bwrong\b|\bincorrect\b|\bfalse\b|\brather than\b|\binstead of\b|\bin place of\b|\bbarred\b|\bignored?\b/i;

const CLAUSE_BREAK =
  /([,;:()]|\s[-–—]\s|\b(?:but|and|unless|because|which|that|while|although|though)\b)/i;

/** The sentence with every clause that denies or warns taken out. */
export function withoutDenyingClauses(sentence) {
  const parts = plain(sentence).split(CLAUSE_BREAK);
  const kept = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (DENIES_OR_WARNS.test(parts[i])) continue;
    kept.push(kept.length > 0 ? (parts[i - 1] ?? "") : "", parts[i]);
  }
  return kept.join("").trim();
}

// A heading whose items are things not to do or not to believe.
const DENYING_HEADING =
  /\b(?:mistakes?|myths?|misconceptions?|errors?|pitfalls?|don'ts|what not to do|things to avoid|not to do|avoid)\b/i;

/** Whether a line is a heading that marks what follows as not asserted. */
export function isDenyingHeading(line) {
  const text = String(line ?? "").trim();
  return /:$/.test(text) && DENYING_HEADING.test(text);
}

/**
 * Whether `matches` (a rule's own test of a piece of text) holds for a claim
 * the sentence puts to the reader. `guard` is the rule's entry from the rule
 * table: {}, { readsDenialItself: true } or { datedClaim: true }.
 */
export function claimAsserted(
  sentence,
  guard = {},
  matches = () => true,
  around = {},
) {
  if (!addressesTheReader(sentence, guard, around)) return false;
  if (guard.readsDenialItself) return matches(sentence);
  if (!matches(sentence)) return false;
  if (!DENIES_OR_WARNS.test(plain(sentence))) return true;
  const rest = withoutDenyingClauses(sentence);
  return rest !== "" && matches(rest);
}
