/**
 * The start date each place has in the PACT covered-Veteran table, read from
 * the bundled entry (src/data/verifiedReference.json, entry pact-toxic). The
 * table has two date rows; an answer that puts a place from one row under
 * the other row's date contradicts it.
 */

import reference from "../data/verifiedReference.json";

const ENTRY = reference.entries.find((entry) => entry.id === "pact-toxic");
const DATE_ROW = /^Active service on or after (.+?):?$/;
const ITEM = /^- (.+)$/;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_NAME = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const MONTH_FIRST = new RegExp(
  String.raw`\b${MONTH_NAME} (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})\b`,
  "gi",
);
const DAY_FIRST = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)? ${MONTH_NAME},? (\d{4})\b`,
  "gi",
);
const SLASHED = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

const pad = (value) => String(value).padStart(2, "0");
const monthNumber = (name) =>
  MONTHS.findIndex((month) =>
    month.startsWith(name.slice(0, 3).toLowerCase()),
  ) + 1;
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/** Every calendar date written in a text, as YYYY-MM-DD, in any common form. */
export function datesIn(text) {
  const source = String(text ?? "");
  return [
    ...[...source.matchAll(MONTH_FIRST)].map(([, m, d, y]) =>
      iso(y, monthNumber(m), d),
    ),
    ...[...source.matchAll(DAY_FIRST)].map(([, d, m, y]) =>
      iso(y, monthNumber(m), d),
    ),
    ...[...source.matchAll(SLASHED)].map(([, m, d, y]) => iso(y, m, d)),
    ...[...source.matchAll(ISO)].map(([, y, m, d]) => iso(y, m, d)),
  ];
}

const properNouns = (text) => text.match(/\b[A-Z][a-z]+\b/g) ?? [];

function readBlocks(text) {
  const blocks = [];
  for (const line of text.split("\n")) {
    const row = DATE_ROW.exec(line);
    if (row) {
      blocks.push({ date: row[1], iso: datesIn(row[1])[0], lines: [] });
      continue;
    }
    const item = ITEM.exec(line);
    const current = blocks[blocks.length - 1];
    if (item && current && line.includes("Duty station in")) {
      current.lines.push(item[1]);
    }
  }
  return blocks;
}

// Words in the table that are also ordinary English or part of other names
// ("United States", "Red Cross"). They never identify a place by themselves.
const NOT_A_PLACE_ALONE = new Set(["United", "Arab", "Red", "Sea"]);

function withPlaces(blocks) {
  const wordsOf = (block) => new Set(block.lines.flatMap(properNouns));
  return blocks.map((block) => {
    const others = blocks
      .filter((other) => other !== block)
      .flatMap((other) => [...wordsOf(other)]);
    return {
      ...block,
      places: [...wordsOf(block)].filter(
        (word) => !others.includes(word) && !NOT_A_PLACE_ALONE.has(word),
      ),
    };
  });
}

/**
 * The table's date rows: { date, iso, lines, places }. `places` are the
 * proper nouns that appear under that date and under no other.
 */
export const COVERAGE_BLOCKS = withPlaces(readBlocks(ENTRY.text));

const CITATION = `VA manual ${ENTRY.citation.split(" (")[0]}`;

// "August 1990" and "since 1990" give a place its own date as surely as the
// full date does, so the row's year anywhere in the sentence counts.
const statesYearOf = (sentence, block) =>
  new RegExp(String.raw`\b${block.iso.slice(0, 4)}\b`).test(sentence);

const found = (block, place, wrongDate) => ({
  place,
  wrongDate,
  quote: {
    citation: CITATION,
    text: `Active service on or after ${block.date}: ${block.lines.find(
      (line) => properNouns(line).includes(place),
    )}`,
  },
});

// "Covered on or after <date>", "counts only from <date>": the sentence
// gives the date as where coverage starts. "You deployed to Iraq after
// September 11, 2001" gives a date in someone's service, which is after 1990
// too, and is no error.
const GIVES_A_COVERAGE_START =
  /\bon or after\b|\b(?:covered|counts?(?: only)?|only) from\b/i;
const A_DEPLOYMENT = /\bdeploy(?:ed|ment|ments)?\b/i;
const givesACoverageStart = (text) =>
  GIVES_A_COVERAGE_START.test(text) && !A_DEPLOYMENT.test(text);

// "Unlike Kuwait, Camp Lejeune coverage applies to service on or after
// August 1, 1953": the date belongs to the programme named before it, not to
// the table place named for contrast. These programmes have dates of their
// own that the table does not hold.
const ANOTHER_PROGRAMME =
  /\bcamp lejeune\b|\bthailand\b|\bvietnam\b|\bkorea\b|\bgi bill\b|\bherbicides?\b|\bagent orange\b|\bradiation\b/i;
const A_YEAR = /\b(?:19|20)\d\d\b/;

function datesAnotherProgramme(text) {
  const year = A_YEAR.exec(text);
  return year !== null && ANOTHER_PROGRAMME.test(text.slice(0, year.index));
}

function swappedDate(text) {
  if (!givesACoverageStart(text)) return null;
  const written = datesIn(text);
  const named = properNouns(text);
  for (const block of COVERAGE_BLOCKS) {
    if (statesYearOf(text, block)) continue;
    const place = block.places.find((word) => named.includes(word));
    if (!place) continue;
    const wrong = COVERAGE_BLOCKS.find(
      (other) =>
        other !== block &&
        written.includes(other.iso) &&
        !other.places.some((word) => named.includes(word)),
    );
    if (wrong) return found(block, place, wrong.date);
  }
  return null;
}

// "You must have served on or after <date>": a date service has to start by.
// A claim filed, or a law taking effect, on or after a date is something else.
const REQUIRED = String.raw`\b(?:must|needs? to|have to|has to|required?|requires|only if)\b`;
const SERVICE = String.raw`\b(?:served?|service|deployed|duty)\b`;
const NOT_A_FILING = String.raw`(?:(?!fil|claim|appl)[^.;]){0,30}?`;
const SERVICE_MUST_START = new RegExp(
  String.raw`${REQUIRED}[^.;]{0,40}${SERVICE}${NOT_A_FILING}\bon or after\b`,
  "i",
);

const written = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  const name = MONTHS[month - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${day}, ${year}`;
};

const rowsNamedIn = (text) => {
  const named = properNouns(String(text ?? ""));
  return COVERAGE_BLOCKS.map((block) => ({
    block,
    place: block.places.find((word) => named.includes(word)),
  })).filter((row) => row.place);
};

// "PACT conditions apply to service in specific locations after <date>".
const APPLIES_TO_SERVICE_AFTER =
  /\b(?:appl(?:y|ies)|limited|restricted)\b[^.;]{0,40}\bservice\b[^.;]{0,40}\b(?:on or after|after|since)\b/i;

// The place is the one the sentence names, or failing that the one the
// veteran asked about. A date in neither row is wrong for every place in the
// table, so places from both rows do not make it uncertain; the line quoted
// is the one for the first place named.
const firstNamed = (text, rows) =>
  [...rows].sort((a, b) => text.indexOf(a.place) - text.indexOf(b.place))[0];

function dateOutsideTheTable(text) {
  if (!SERVICE_MUST_START.test(text) && !APPLIES_TO_SERVICE_AFTER.test(text)) {
    return null;
  }
  const dates = datesIn(text);
  const tableDates = COVERAGE_BLOCKS.map((block) => block.iso);
  if (dates.length === 0 || dates.some((date) => tableDates.includes(date))) {
    return null;
  }
  const rows = rowsNamedIn(text);
  if (rows.length === 0) return null;
  if (rows.some(({ block }) => statesYearOf(text, block))) return null;
  const { block, place } = firstNamed(text, rows);
  return found(block, place, written(dates[0]));
}

const ENDS_AS_A_HEADING = /:\)?$/;
const DENIES = /\bnot\b|n't\b|\bnever\b/i;

// "... (Active service on or after September 11, 2001):" with the places in
// the line under it. Only a line that ends as a heading and names no place
// itself lends its date to the next line.
function headingDateForNextLine(text, next) {
  if (!next || !ENDS_AS_A_HEADING.test(text.trim())) return null;
  if (!givesACoverageStart(text)) return null;
  if (rowsNamedIn(text).length > 0 || DENIES.test(next)) return null;
  const dates = datesIn(text);
  const heading = COVERAGE_BLOCKS.filter((block) => dates.includes(block.iso));
  const under = rowsNamedIn(next);
  if (heading.length !== 1 || under.length !== 1) return null;
  const [{ block, place }] = under;
  if (block === heading[0]) return null;
  if (statesYearOf(text, block) || statesYearOf(next, block)) return null;
  return { ...found(block, place, heading[0].date), shownWith: next };
}

/**
 * A sentence that gives a place a start date the table does not give it:
 * the other row's date, or a date service is said to have to start by that
 * is neither row's. { place, wrongDate, quote }, where `quote` is the table
 * line that carries the right date for that place; null when the sentence is
 * consistent with the table. With one of the table's two dates, a sentence
 * that names places from both rows is left alone: the date may belong to
 * either, and a sentence is not parsed finely enough to say which.
 * The place has to be in the sentence itself (or, for a heading, in the
 * line under it). `next` is the sentence after this one, read only
 * when this one is a heading that carries the date (the result then has
 * `shownWith`, the line that names the place).
 */
export function findWrongCoverageDate(sentence, { next } = {}) {
  const text = String(sentence ?? "");
  if (datesAnotherProgramme(text)) return null;
  return (
    swappedDate(text) ??
    dateOutsideTheTable(text) ??
    headingDateForNextLine(text, next)
  );
}
