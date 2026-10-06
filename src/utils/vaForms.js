/**
 * VA form numbers as the app knows them: the bundled forms table
 * (src/data/verifiedReference.json, entry va-forms, built from M21-1 and
 * checked against the allowlist) and the allowlist itself
 * (src/data/validVAForms.json). Nothing here is typed in: the form each
 * filing takes is read from the table by its title.
 */

import reference from "../data/verifiedReference.json";
import quotes from "../data/verifiedQuotes.json";
import allowlist from "../data/validVAForms.json";

const TABLE = reference.entries.find((entry) => entry.id === "va-forms");
const INTENT_TO_FILE_TITLE = /^Intent to File\b/;

const tableLine = (number) =>
  TABLE.text.split("\n").find((line) => line.startsWith(`VA Form ${number}:`));

export const LANE_FORMS = Object.freeze({
  ...Object.fromEntries(
    quotes.reviewOptions.lanes.map((lane) => [lane.id, lane.form.number]),
  ),
  "intent-to-file": TABLE.forms.find((form) =>
    INTENT_TO_FILE_TITLE.test(form.title),
  ).number,
});

const KNOWN_NUMBERS = new Set(
  [
    ...Object.values(allowlist.forms).flatMap((group) => group.forms),
    ...TABLE.forms.map((form) => form.number),
  ].map((number) => number.toUpperCase()),
);
const QUESTIONNAIRE_PREFIXES = allowlist.dbqPrefixes.filter((prefix) =>
  /\d/.test(prefix),
);

export const FORMS_LIST_DATE = allowlist._metadata.lastUpdated;

export const isKnownForm = (number) => {
  const upper = number.toUpperCase();
  return (
    KNOWN_NUMBERS.has(upper) ||
    QUESTIONNAIRE_PREFIXES.some((prefix) => upper.startsWith(prefix))
  );
};

const HYPHENATED = String.raw`\d{2}[A-Za-z]?-\d{3,5}[A-Za-z]{0,2}(?:-\d{1,2})?`;
const PLAIN = String.raw`\d{3,5}[A-Za-z]?`;
// DD, SF and other agencies' forms are not VA forms and are not in the list.
const OTHER_AGENCY = String.raw`(?<!\b(?:DD|SF|DA|OF|Standard)\s)`;
const FORM_MENTION = new RegExp(
  String.raw`${OTHER_AGENCY}\b(VA\s+)?Forms?\s+(?:No\.?\s*|Number\s+|#\s*)?(${HYPHENATED}|${PLAIN})(?![\w-])`,
  "gi",
);

/**
 * The VA form numbers a text names after the word "Form": { number, start,
 * end }. A number with no hyphen counts only after "VA Form" or when it is a
 * known form, so "Form 1040" and "DD Form 214" are not read as VA forms.
 */
export function formMentions(text) {
  return [...String(text ?? "").matchAll(FORM_MENTION)]
    .filter(
      ([, va, number]) =>
        number.includes("-") || Boolean(va) || isKnownForm(number),
    )
    .map((match) => ({
      number: match[2].toUpperCase(),
      start: match.index,
      end: match.index + match[0].length,
    }));
}

const LANES = [
  {
    id: "supplemental-claim",
    label: "a Supplemental Claim",
    words: String.raw`supplemental claims?`,
  },
  {
    id: "higher-level-review",
    label: "a Higher-Level Review",
    words: String.raw`higher[- ]level reviews?|HLR`,
  },
  {
    id: "board-appeal",
    label: "a Board appeal",
    words: String.raw`board appeals?|board hearings?|notices? of disagreement|appeals? to the board`,
  },
  {
    id: "intent-to-file",
    label: "an Intent to File",
    words: String.raw`intent to file|ITF`,
  },
];
const ANY_LANE = LANES.map((lane) => `(?:${lane.words})`).join("|");
const LANE_WORDS = new RegExp(String.raw`\b(?:${ANY_LANE})\b`, "gi");
const laneOf = (words) =>
  LANES.find((lane) => new RegExp(`^(?:${lane.words})$`, "i").test(words));

// "Supplemental Claim (VA Form N)", "a Supplemental Claim for the denied
// claims using VA Form N": the form is given as the filing's own. A list, an
// attachment ("with", "and") or another clause in between is not that.
const NAMED_AS_ITS_FORM =
  /^(?:(?! and | or | with )[^.,;:()]){0,40}?\s*(?:\(|\b(?:using|on|via)\s+(?:the\s+)?)$/i;
const FORM_THEN_LANE = new RegExp(
  String.raw`^\s*(?:\(|to (?:file|request|submit|start) )(?:an? |the |your )?(${ANY_LANE})\b`,
  "i",
);
const DENIES = /\bnot\b|n't\b|\bnever\b|\binstead of\b|\brather than\b/i;

// "A Higher-Level Review of a Supplemental Claim decision (VA Form 20-0996)":
// the Supplemental Claim is what was decided, not the filing being made.
const WHAT_WAS_DECIDED = /^ (?:decisions?|denials?|was denied|is denied)\b/i;

function laneBefore(sentence, mention) {
  const upToTheForm = sentence.slice(0, mention.start);
  const before = [...upToTheForm.matchAll(LANE_WORDS)]
    .filter(
      (lane) =>
        !WHAT_WAS_DECIDED.test(upToTheForm.slice(lane.index + lane[0].length)),
    )
    .pop();
  if (!before) return null;
  const between = sentence.slice(
    before.index + before[0].length,
    mention.start,
  );
  return NAMED_AS_ITS_FORM.test(between) ? laneOf(before[0]) : null;
}

function laneAfter(sentence, mention) {
  const after = FORM_THEN_LANE.exec(sentence.slice(mention.end));
  return after ? laneOf(after[1]) : null;
}

// A real form of another kind beside a filing is usually an attachment (a lay
// statement with a Supplemental Claim), which the table does not contradict.
const couldBeAttachment = (number) =>
  isKnownForm(number) && !Object.values(LANE_FORMS).includes(number);

const APPLICATION_TITLE = /^Application for Disability Compensation\b/;
const APPLICATION_FORM = TABLE.forms.find((form) =>
  APPLICATION_TITLE.test(form.title),
).number;
const CALLED_THE_APPLICATION =
  /\b(?:application(?: form)?|complete claim)\s*\($/i;
// "The Intent to File a Claim for Compensation application (VA Form
// 21-0966)" names the form rightly in the same phrase.
const CALLED_AN_INTENT_TO_FILE =
  /\b(?:intent[- ]to[- ]file|ITF)\b[^,;]{0,45}$/i;
const CLOSES_THE_NAME = /^\s*[),.]|^\s*$/;

/**
 * The Intent to File form named as the application form ("the appropriate
 * application form (VA Form 21-0966)"): { number, quote }, or null. The
 * quote is the table's line for the disability application.
 */
export function findIntentFormAsApplication(sentence) {
  for (const mention of formMentions(sentence)) {
    if (mention.number !== LANE_FORMS["intent-to-file"]) continue;
    const before = sentence.slice(0, mention.start);
    if (DENIES.test(before) || !CALLED_THE_APPLICATION.test(before)) continue;
    if (CALLED_AN_INTENT_TO_FILE.test(before)) continue;
    if (!CLOSES_THE_NAME.test(sentence.slice(mention.end))) continue;
    return {
      number: mention.number,
      quote: {
        citation: `The list of VA claim forms (${TABLE.sourceLabel})`,
        text: tableLine(APPLICATION_FORM),
      },
    };
  }
  return null;
}

/**
 * A filing given a form number that the forms table gives to something
 * else, or to nothing: { lane, label, number, quote }, or null. The quote is
 * the table's line for the form that filing does take.
 */
export function findFormMismatch(sentence) {
  for (const mention of formMentions(sentence)) {
    if (DENIES.test(sentence.slice(0, mention.start))) continue;
    const lane = laneBefore(sentence, mention) ?? laneAfter(sentence, mention);
    if (!lane) continue;
    if (mention.number === LANE_FORMS[lane.id]) continue;
    if (couldBeAttachment(mention.number)) continue;
    return {
      lane: lane.id,
      label: lane.label,
      number: mention.number,
      quote: {
        citation: `The list of VA claim forms (${TABLE.sourceLabel})`,
        text: tableLine(LANE_FORMS[lane.id]),
      },
    };
  }
  return null;
}
