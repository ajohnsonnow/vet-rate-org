/**
 * The test every correction rule passes through before it may fire: does the
 * sentence put its claim to the reader as true? The rules match words, and
 * the same words appear in a question, in a warning against the error, in
 * what someone else said, in a veteran's own history and in an account of
 * the law as it used to be. None of those states the error, so none of them
 * gets a correction.
 *
 * `claimAsserted(sentence, guard, matches)` is the one entry point. It
 * answers no for a question, reported speech, a first-person or witness
 * account and the law as it was. For a denial it asks a narrower question:
 * does the rule still match once the clauses that deny or warn are taken
 * out? "VA does not add ratings together" has nothing left. "Ratings are
 * added, with exceptions for conditions that cannot be combined" still says
 * ratings are added.
 *
 * Two kinds of rule switch one part off, in the rule table:
 * - `readsDenialItself`: the error is itself a denial ("you cannot appeal
 *   without new evidence"), so the rule reads the "not" for itself;
 * - `datedClaim`: the error is a date, so an older year in the sentence is
 *   the claim, not a sign of history.
 */

// The examiner's standard wording, and "not" used for "so far" or "more
// than": none of these denies anything.
const NOT_A_DENIAL =
  /\bas likely as not\b|\bless likely than not\b|\bnot (?=(?:previously|yet|already|just|only)\b)/gi;

const IS_A_QUESTION = /\?\s*["')\]]*$/;

const DENIES_OR_WARNS =
  /\bnot\b|n't\b|\bno\b|\bnothing\b|\bcannot\b|\bnever\b|\bwrong\b|\bincorrect\b|\bmyth\b|\brather than\b|\binstead of\b|\bbarred\b|\bignored?\b/i;

const CLAUSE_BREAK =
  /([,;:()]|\s[-–—]\s|\b(?:but|and|unless|because|which|that|while|although|though)\b)/i;

const WHAT_SOMEONE_SAID =
  /\btold\b|\bsaid\b|\bwrote\b|\bassume[sd]?\b|\bthought\b|\bexpected\b|\bturned out\b|\bthe clerk\b/i;
const WHOSE_WORDS =
  /\b(?:the|my|your) (?:letter|decision|vso|representative) (?:says|said|states|stated|wrote)\b/i;

// The veteran's own account, or a witness's. "I can explain" and "I cannot
// generate" are the assistant speaking, so "I" counts only with a verb of
// something that happened.
const MINE = /\b(?:[Mm]y|me|[Mm]ine|myself)\b/;
const WHAT_I_DID = new RegExp(
  String.raw`\bI (?:${[
    "am|was|had|have|did|filed|asked|tried|chose|mailed|appealed",
    "deployed|served|got|received|submitted|sent|went|left|applied",
    "requested|missed",
  ].join("|")})\b`,
);
const OWN_ACCOUNT = {
  test: (text) => MINE.test(text) || WHAT_I_DID.test(text),
};
const A_WITNESS_ACCOUNT = /\b(?:he|she)\b|\b(?:his|her)\b/i;
const HIS_OR_HER = /\bhis or her\b/gi;

const THE_LAW_AS_IT_WAS =
  /\bbefore the appeals modernization act\b|\bback then\b|\bat that time\b/i;
const AN_OLDER_YEAR = /\b(?:19\d\d|200\d|201[0-8])\b/;

const plain = (sentence) =>
  String(sentence ?? "")
    .replace(NOT_A_DENIAL, "")
    .trim();

/**
 * Whether a sentence is the kind that can state a claim to the reader at
 * all: not a question, not what someone said, not an own or witness account,
 * not the law as it was. Denials are judged in `claimAsserted`.
 */
export function addressesTheReader(sentence, { datedClaim = false } = {}) {
  const text = plain(sentence);
  if (text === "" || IS_A_QUESTION.test(text)) return false;
  if (WHAT_SOMEONE_SAID.test(text) || WHOSE_WORDS.test(text)) return false;
  if (OWN_ACCOUNT.test(text)) return false;
  if (A_WITNESS_ACCOUNT.test(text.replace(HIS_OR_HER, ""))) return false;
  if (THE_LAW_AS_IT_WAS.test(text)) return false;
  return datedClaim || !AN_OLDER_YEAR.test(text);
}

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

/**
 * Whether `matches` (a rule's own test of a piece of text) holds for a claim
 * the sentence puts to the reader. `guard` is the rule's entry from the rule
 * table: {}, { readsDenialItself: true } or { datedClaim: true }.
 */
export function claimAsserted(sentence, guard = {}, matches = () => true) {
  if (!addressesTheReader(sentence, guard)) return false;
  if (guard.readsDenialItself) return matches(sentence);
  if (!matches(sentence)) return false;
  if (!DENIES_OR_WARNS.test(plain(sentence))) return true;
  const rest = withoutDenyingClauses(sentence);
  return rest !== "" && matches(rest);
}
