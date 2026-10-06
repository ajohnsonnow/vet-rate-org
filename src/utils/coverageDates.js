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

/**
 * A sentence that gives a place the other row's date and not its own:
 * { place, wrongDate, quote }, where `quote` is the table line that carries
 * the right date for that place. Null when the sentence is consistent with
 * the table, or names no place from it.
 */
export function findWrongCoverageDate(sentence) {
  const written = datesIn(sentence);
  const named = properNouns(String(sentence ?? ""));
  for (const block of COVERAGE_BLOCKS) {
    if (written.includes(block.iso)) continue;
    const place = block.places.find((word) => named.includes(word));
    if (!place) continue;
    const wrong = COVERAGE_BLOCKS.find(
      (other) => other !== block && written.includes(other.iso),
    );
    if (!wrong) continue;
    const line = block.lines.find((text) => properNouns(text).includes(place));
    return {
      place,
      wrongDate: wrong.date,
      quote: {
        citation: CITATION,
        text: `Active service on or after ${block.date}: ${line}`,
      },
    };
  }
  return null;
}
