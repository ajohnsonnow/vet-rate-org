/**
 * Readers for DD-214 boxes whose value an OCR page-order can separate from its
 * printed label (ADR-009 section 4). A scan read in columns can put a box's
 * value lines above its label, or put another box's caption or the form title
 * directly under it. Each reader takes a value only from its own labelled box,
 * bounded at the next printed box label, and never from a default or from the
 * form title. A value found away from its label is returned with
 * `located: false` so the import dialog shows it unticked with a note.
 */

const REGION_CHARS = 1500;
const COMPONENT_REGION_CHARS = 400;

// "//NOTHING FOLLOWS" as the paper prints it, and as OCR misreads it: the
// second slash or the N can come out as I, 1, l or a pipe.
export const END_MARKER = /\/{0,2}[ \t]{0,3}[I1l|]?NOTHING\s{1,3}FOLLOWS/;

const noisy = (line) =>
  line
    .replace(/[|"'`_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function findLabelEnd(text, labels) {
  for (const label of labels) {
    const match = label.exec(text);
    if (match) return match.index + match[0].length;
  }
  return -1;
}

function regionAfter(text, end, stops, maxChars) {
  const rest = text.slice(end, end + maxChars);
  const cuts = stops
    .map((stop) => stop.exec(rest)?.index)
    .filter((index) => index !== undefined);
  return cuts.length > 0 ? rest.slice(0, Math.min(...cuts)) : rest;
}

const MARKS = new Set([" ", "\t", "-", "–", "—", ".", "|", ":"]);

function trimTrailingMarks(text) {
  let end = text.length;
  while (end > 0 && MARKS.has(text[end - 1])) end--;
  return text.slice(0, end);
}

// ---------------------------------------------------------------- Box 2

const COMPONENT_LABELS = [
  /2\.?\s{0,5}DEPARTMENT[,\s]{1,5}COMPONENT[,\s]{1,5}(?:AND\s{1,5})?BRANCH/,
  /DEPARTMENT[,\s]{1,5}COMPONENT[,\s]{1,5}(?:AND\s{1,5})?BRANCH/,
  /(?:BLOCK|BOX)\s{0,10}2\b/,
  /2\.\s{0,10}DEPARTMENT/,
];
// The next printed box label after box 2.
const COMPONENT_REGION_END = [
  /(?<![\d.])\d{1,2}[ \t]{0,2}[A-Z]?\.[ \t]{0,3}[A-Z]{3}/,
  /SOCIAL[ \t]{1,5}SECURITY/,
  /DATE[ \t]{1,5}OF[ \t]{1,5}BIRTH/,
  /RESERVE[ \t]{1,5}OBLIG/,
  /GRADE,?[ \t]{1,5}RATE/,
];

const COMPONENT_TOKENS = new Set(
  (
    "ARMY NAVY AIR FORCE MARINE MARINES CORPS COAST GUARD SPACE NATIONAL " +
    "ARNGUS ANGUS NGUS ARNG ANG USAR USNR USAFR USMCR USCGR USN USAF USMC USCG USSF " +
    "ACTIVE REGULAR RA AD RESERVE RESERVES AGR THE OF US DEPT"
  ).split(" "),
);
const BRANCH_WORDS = new Set(["ARMY", "NAVY", "MARINE", "MARINES"]);
const BRANCH_PAIRS = [
  ["AIR", "FORCE"],
  ["COAST", "GUARD"],
  ["SPACE", "FORCE"],
  ["NATIONAL", "GUARD"],
];
const COMPONENT_CODES = new Set(
  "ARNGUS ANGUS NGUS ARNG ANG USAR USNR USAFR USMCR USCGR USN USAF USMC USCG USSF".split(
    " ",
  ),
);
const STANDALONE_COMPONENTS = new Set(
  "ARNGUS ANGUS NGUS ARNG USAR USNR USAFR USMCR USCGR".split(" "),
);
const UNLABELLED_BRANCH_SLASH =
  /(?:ARMY|NAVY|AIR\s{0,5}FORCE|MARINES?|COAST\s{0,5}GUARD|SPACE\s{0,5}FORCE)\s{0,5}\/\s{0,5}([A-Z]{2,8})(?:\s{1,5}GUARD)?/;
const UNLABELLED_COMPONENT_WORDS = new Set(
  "ACTIVE ARNG USAR RESERVE NATIONAL RA USN USAF USMC USCG".split(" "),
);

// The run of box-2 words at the START of a line. A line that opens with any
// other word (the corner notice, the title tail "ROM ACTIVE DUTY") yields
// nothing, and a bare "ACTIVE" with no branch beside it is not a component.
function componentRun(line) {
  const tokens = line
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const run = [];
  for (const token of tokens) {
    if (!COMPONENT_TOKENS.has(token)) break;
    run.push(token);
  }
  const hasPair = BRANCH_PAIRS.some(
    ([first, second]) =>
      run.includes(first) && run[run.indexOf(first) + 1] === second,
  );
  const valid =
    hasPair ||
    run.some((token) => BRANCH_WORDS.has(token) || COMPONENT_CODES.has(token));
  return valid ? run.join(" ") : "";
}

function componentInLabelledRegion(text) {
  const end = findLabelEnd(text, COMPONENT_LABELS);
  if (end < 0) return { labelled: false, value: "" };
  const region = regionAfter(
    text,
    end,
    COMPONENT_REGION_END,
    COMPONENT_REGION_CHARS,
  );
  for (const line of region.split("\n")) {
    const run = componentRun(line);
    if (run) return { labelled: true, value: run };
  }
  return { labelled: true, value: "" };
}

function lonelyComponentToken(text) {
  const found = new Set();
  for (const line of text.split("\n")) {
    const token = noisy(line);
    if (STANDALONE_COMPONENTS.has(token)) found.add(token);
  }
  return found.size === 1 ? [...found][0] : "";
}

/**
 * Box 2 (department, component and branch). `located` is true only when the
 * value sits in the region under the box's own label.
 */
export function readComponentBox(text) {
  const inRegion = componentInLabelledRegion(text);
  if (inRegion.value) return { value: inRegion.value, located: true };
  if (inRegion.labelled) {
    const lonely = lonelyComponentToken(text);
    if (lonely) return { value: lonely, located: false };
  }
  const unlabelled = UNLABELLED_BRANCH_SLASH.exec(text);
  if (!unlabelled || !UNLABELLED_COMPONENT_WORDS.has(unlabelled[1])) {
    return null;
  }
  return { value: unlabelled[0], located: false };
}

// Signals that a page is a National Guard form or report, apart from box 2:
// the form's own title, or the "revert to" wording in box 9.
const GUARD_FORM_SIGNALS = [
  /NATIONAL\s{1,5}GUARD\s{1,5}BUREAU/,
  /NGB[ -]?(?:FORM\s{1,5})?22\b/,
  /REVERT\s{1,5}TO\s{1,5}(?:ARNGUS|ANGUS|NGUS|ARNG|ANG)\b/,
  /REVERT\s{1,5}TO\s{1,5}NATIONAL\s{1,5}GUARD/,
];

export const pageImpliesGuard = (text) =>
  GUARD_FORM_SIGNALS.some((signal) => signal.test(text));

// ---------------------------------------------------------------- Box 29

const DAYS_LOST_LABELS = [
  /29\.?\s{0,5}DATES?\s{1,5}OF\s{1,5}TIME\s{1,5}LOST(?:\s{1,5}DURING\s{1,5}THIS\s{1,5}PERIOD)?/,
  /(?:BLOCK|BOX)\s{0,10}29\b/,
  /TIME\s{1,5}LOST(?:\s{1,5}DURING\s{1,5}THIS\s{1,5}PERIOD)?/,
];

/**
 * Box 29: the first token on the label's own line after the label, or on the
 * line directly under it. The value ends at the first run of spaces, so a
 * stray mark or the form footer printed beside it is never part of it.
 */
export function readDaysLost(text) {
  const end = findLabelEnd(text, DAYS_LOST_LABELS);
  if (end < 0) return null;
  const rest = text.slice(end, end + REGION_CHARS);
  for (const line of rest.split("\n")) {
    const cleaned = line.replace(/^[\s:.]+/, "");
    if (cleaned === "") continue;
    const token = trimTrailingMarks(cleaned.split(/\s{2,}|\t/)[0]);
    return token === "" ? null : token;
  }
  return null;
}

// ---------------------------------------------------------------- Box 28

const NARRATIVE_LABELS = [
  /28\.?\s{0,5}NARRATIVE\s{1,5}REASON(?:\s{1,5}FOR\s{1,5}SEPARATION)?/,
  /(?:BLOCK|BOX)\s{0,10}28\b/,
  /NARRATIVE\s{1,5}REASON(?:\s{1,5}FOR\s{1,5}SEPARATION)?/,
];
const NARRATIVE_REGION_END = [
  /(?:^|\n)[ \t]{0,5}(?:29|3\d)\.?[ \t]{0,3}[A-Z]{3}/,
  /DATES?\s{1,5}OF\s{1,5}TIME\s{1,5}LOST/,
];
const REASON_SHAPE = /^[A-Z][A-Z ]{3,78}$/;
// Words of other boxes' captions; none is in a real narrative reason.
const CAPTION_FRAGMENT =
  /\b(?:ADDRESS|MAILING|INCLUDE|ZIP|SPECIAL|ADDITIONAL|INFORMATION|CHARACTER|AUTHORIZED|AGENCIES|BRANCH|COMPONENT|DEPARTMENT|SIGNATURE|REMARKS)\b/;
const CHARACTER_VOCABULARY = new Set(
  (
    "HONORABLE GENERAL UNDER OTHER THAN CONDITIONS DISHONORABLE BAD CONDUCT " +
    "DISCHARGE UNCHARACTERIZED ENTRY LEVEL SEPARATION VOID UPGRADE UPGRADES"
  ).split(" "),
);

const isReasonLine = (line, { minWords }) => {
  if (!REASON_SHAPE.test(line) || CAPTION_FRAGMENT.test(line)) return false;
  const words = line.split(" ").filter(Boolean);
  return words.length >= minWords;
};

const isCharacterOfService = (line) =>
  line.split(" ").every((word) => CHARACTER_VOCABULARY.has(word));

/**
 * Box 28. The line right under the label is the value when it is plain words.
 * When the form's column order put another box's caption there, the value is
 * the last plain multi-word line before the next box's label, and it is
 * returned with `located: false`.
 */
export function readNarrativeReason(text) {
  const end = findLabelEnd(text, NARRATIVE_LABELS);
  if (end < 0) return null;
  const lines = regionAfter(text, end, NARRATIVE_REGION_END, REGION_CHARS)
    .split("\n")
    .map(noisy)
    .filter(Boolean);
  if (lines.length === 0) return null;
  if (isReasonLine(lines[0], { minWords: 1 })) {
    return { value: lines[0], located: true };
  }
  const far = lines.findLast(
    (line) =>
      isReasonLine(line, { minWords: 2 }) && !isCharacterOfService(line),
  );
  return far ? { value: far, located: false } : null;
}
