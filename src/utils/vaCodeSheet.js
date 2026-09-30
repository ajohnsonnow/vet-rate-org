/**
 * Vet-Rate.org - VA Rating Decision code sheet parser
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The code sheet printed with every VA rating decision ("SUBJECT TO
 * COMPENSATION (1.SC)" ... "COMBINED EVALUATION FOR COMPENSATION" ... "NOT
 * SERVICE CONNECTED") is VA's own list of every rated condition, its
 * diagnostic code and the dated history of its percentage. A C-File carries
 * one per rating decision, newest first, so the newest sheet is the
 * authoritative current rating list.
 */

const SC_HEADER =
  /SUBJECT TO COMPENSATION\s{0,3}\(?\s{0,3}[0-9il]?\.?\s{0,3}SC\)/gi;
const COMBINED_HEADER = /COMBINED\s?EVAL\s?UATION FOR COMPENSATION\s{0,5}:/i;
const NSC_HEADER = /NOT SERVICE CONNECTED\s?\/\s?NOT SUBJECT TO COMPENSATION/i;
const SHEET_END = /\beSign\b/i;
// The decision date sits in the page header (older sheets, above ACTIVE DUTY)
// or in the page-1 footer (newer sheets), both right before "NAME OF VETERAN".
const SHEET_DATE =
  /Page\s{1,5}\d{1,2}\s{1,5}(?:of\s{1,5}\d{1,2}\s{1,5})?(\d{2}\/\d{2}\/\d{4})\s{1,5}NAME OF VETERAN/g;
const RATING_STEP = /(\d{1,3})% from (\d{2}\/\d{2}\/\d{4})/g;
const DENIAL_DATE = /Original Date of Denial:\s{0,3}(\d{2}\/\d{2}\/\d{4})/i;
const MAX_SHEET_CHARS = 25000;
const DATE_LOOKBACK_CHARS = 1500;
const HEADER_TO_ACTIVE_DUTY_CHARS = 400;

// Page furniture that the PDF text layer drops into the middle of entries:
// the repeating "Rating Decision ... Page 2 of 5 05/06/2024" footer (with the
// veteran's name and numbers on page 1), the scan stamp, page markers, and
// bare 9-digit SSN / VA file numbers.
const PAGE_NOISE = [
  /Rating Decision\s{1,5}Department of Veterans Affairs.{0,120}?Page\s{1,5}\d{1,2}(?:\s{1,5}of\s{1,5}\d{1,2})?\s{1,5}\d{2}\/\d{2}\/\d{4}(?:\s{1,5}NAME OF VETERAN.{0,400}?COPY TO)?/gi,
  /COPY MADE BY VBA FROM A RECORD IN VA'?S POSSESSION/gi,
  /[=-]{3} PAGE \d{1,5} [=-]{3}/g,
  /\b\d{3}[ -]?\d{2}[ -]?\d{4}\b/g,
];

const ACRONYMS = /\b(nos|ptsd|tbi|copd|gerd|ibs|ivds|tera|itb)\b/g;

const flatten = (text) => text.replace(/\s+/g, " ");

const stripNoise = (text) =>
  flatten(PAGE_NOISE.reduce((t, re) => t.replace(re, " "), text));

// D19-7: flatten() alone measured ~290ms on a real-sized C-File's full text
// (14.6M chars) - one synchronous regex.replace, long enough on its own to
// blow the ~100ms/1x main-thread-task budget. Chunked equivalent: never cut
// inside or adjacent to a run of whitespace (only between two non-space
// characters), so no `\s+` run can ever straddle a chunk boundary - each
// chunk's flatten() is then provably identical to what the whole-string
// flatten() would have produced for that span. See
// vaCodeSheet.chunked.equivalence.test.js's flattenChunked-specific cases.
const FLATTEN_CHUNK_CHARS = 200_000;
const SAFE_CUT_SEARCH_RADIUS = 2000;

function _isWhitespace(char) {
  return char !== undefined && /\s/.test(char);
}

function _findSafeFlattenCut(text, approxIndex) {
  for (let offset = 0; offset <= SAFE_CUT_SEARCH_RADIUS; offset++) {
    const after = approxIndex + offset;
    if (
      after > 0 &&
      after < text.length &&
      !_isWhitespace(text[after - 1]) &&
      !_isWhitespace(text[after])
    ) {
      return after;
    }
    const before = approxIndex - offset;
    if (
      before > 0 &&
      before < text.length &&
      !_isWhitespace(text[before - 1]) &&
      !_isWhitespace(text[before])
    ) {
      return before;
    }
  }
  // No safe cut nearby (pathological input) - fall back to finishing the
  // rest of the text as one slice rather than risking an unsafe cut.
  return text.length;
}

async function flattenChunked(text, slicer) {
  let result = "";
  let pos = 0;
  while (pos < text.length) {
    let cut = Math.min(pos + FLATTEN_CHUNK_CHARS, text.length);
    if (cut < text.length) cut = _findSafeFlattenCut(text, cut);
    if (cut <= pos) cut = text.length;
    result += flatten(text.slice(pos, cut));
    pos = cut;
    await slicer.maybeYield();
  }
  return result;
}

const toIsoDay = (mmddyyyy) => {
  const [mm, dd, yyyy] = mmddyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
};

// "RADICULOPATHY, LEFT LOWER EXTREMITY (NOS)" -> "Radiculopathy, left lower
// extremity (NOS)". Only all-caps names are recased.
const recase = (name) => {
  if (name !== name.toUpperCase()) return name;
  const lower = name.toLowerCase().replace(ACRONYMS, (m) => m.toUpperCase());
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// A code sheet entry starts at a diagnostic code ("9411", "5299-5237") that
// stands alone and is followed by the condition name in capitals.
const ENTRY_START = /(?:^|\s)(\d{4}(?:-\d{4})?)\s(?=[A-Z])/g;

function splitEntries(section, statusPattern) {
  const starts = [...section.matchAll(ENTRY_START)];
  const entries = [];
  for (let i = 0; i < starts.length; i++) {
    const begin = starts[i].index + starts[i][0].length;
    const end = i + 1 < starts.length ? starts[i + 1].index : section.length;
    const body = section.slice(begin, end);
    const status = statusPattern.exec(body);
    if (!status) {
      if (entries.length > 0) entries.at(-1).rest += ` ${starts[i][0]}${body}`;
      continue;
    }
    entries.push({
      diagnosticCode: starts[i][1],
      rawName: body.slice(0, status.index).trim(),
      rest: body.slice(status.index),
    });
  }
  return entries;
}

function cleanName(rawName) {
  const tags = [...rawName.matchAll(/\[([^\]]{1,120})\]/g)].map((m) => m[1]);
  const name = rawName
    .replace(/\[[^\]]{0,120}\]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([,)])/g, "$1")
    .replace(/\( /g, "(")
    .trim();
  return { name: recase(name), tags };
}

function parseServiceConnected(section) {
  return splitEntries(section, /\bService Connected\b/).map((e) => {
    const { name, tags } = cleanName(e.rawName);
    const history = [...e.rest.matchAll(RATING_STEP)].map((m) => ({
      percentage: Number(m[1]),
      effectiveDate: toIsoDay(m[2]),
    }));
    const current = history.at(-1) || null;
    return {
      name,
      diagnosticCode: e.diagnosticCode,
      rating: current ? current.percentage : null,
      effectiveDate: current ? current.effectiveDate : null,
      history,
      tags,
      serviceConnected: true,
    };
  });
}

function parseNotServiceConnected(section) {
  return splitEntries(section, /\bNot Service Connected\b/).map((e) => {
    const denial = DENIAL_DATE.exec(e.rest);
    return {
      name: cleanName(e.rawName).name,
      diagnosticCode: e.diagnosticCode,
      originalDenialDate: denial ? toIsoDay(denial[1]) : null,
    };
  });
}

// "05/06/2002 04/30/2003 Army Honorable": entry date, release date, branch
// (one to three capitalized words), character of discharge.
const SERVICE_ROW =
  /(\d{2}\/\d{2}\/\d{4}) (\d{2}\/\d{2}\/\d{4}) ([A-Z][a-z]{1,10}(?: [A-Z][a-z]{1,10}){0,2}) (Honorable|Under Honorable Conditions|General|Other Than Honorable|Bad Conduct|Dishonorable|Uncharacterized)\b/g;

function parseActiveDuty(preamble) {
  const start = preamble.search(/ACTIVE DUTY/i);
  if (start === -1) return [];
  return [...preamble.slice(start).matchAll(SERVICE_ROW)].map((m) => ({
    entryDate: toIsoDay(m[1]),
    separationDate: toIsoDay(m[2]),
    branch: m[3],
    characterOfDischarge: m[4],
  }));
}

// "JURISDICTION: Claim for Increase Received 03/31/2023": what this decision
// answered and when VA received it (or dated the exam that prompted it).
const JURISDICTION =
  /JURISDICTION: ?([A-Za-z][A-Za-z -]{2,60}?) (Received|Dated) (\d{2}\/\d{2}\/\d{4})/;

function parseJurisdiction(preamble) {
  const m = JURISDICTION.exec(preamble);
  return m
    ? { action: m[1], verb: m[2].toLowerCase(), date: toIsoDay(m[3]) }
    : null;
}

// The sheet's header or page-1 footer names the veteran's power of attorney:
// "POA VETERANS OF FOREIGN WARS OF THE US COPY TO". An empty "POA COPY TO"
// means none.
const REPRESENTATIVE = /\bPOA ([A-Z][A-Z .,'&-]{2,80}?) COPY TO\b/;

const ORG_SMALL_WORDS = new Set(["of", "the", "and", "for", "in"]);

function parseRepresentative(text) {
  const m = REPRESENTATIVE.exec(text);
  if (!m) return null;
  return m[1]
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (word === "us") return "US";
      if (i > 0 && ORG_SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function sheetDate(flat, headerIndex, sheetText) {
  const before = flat.slice(
    Math.max(0, headerIndex - DATE_LOOKBACK_CHARS),
    headerIndex,
  );
  // Older sheets: the dated header runs straight into this sheet's ACTIVE
  // DUTY block. Newer sheets: the first footer after the header.
  const activeDuty = before.lastIndexOf("ACTIVE DUTY");
  const header =
    activeDuty === -1
      ? null
      : [
          ...before
            .slice(
              Math.max(0, activeDuty - HEADER_TO_ACTIVE_DUTY_CHARS),
              activeDuty,
            )
            .matchAll(SHEET_DATE),
        ].at(-1);
  const match = header || [...sheetText.matchAll(SHEET_DATE)][0];
  return match ? toIsoDay(match[1]) : null;
}

function parseOneSheet(flat, headerIndex, headerLength, nextHeaderIndex) {
  const bodyStart = headerIndex + headerLength;
  const limit = Math.min(
    nextHeaderIndex ?? flat.length,
    bodyStart + MAX_SHEET_CHARS,
  );
  const raw = flat.slice(bodyStart, limit);
  const date = sheetDate(flat, headerIndex, raw);
  const representative = parseRepresentative(
    flat.slice(Math.max(0, headerIndex - DATE_LOOKBACK_CHARS), bodyStart) + raw,
  );
  const endMatch = SHEET_END.exec(raw.slice(1));
  const sheet = stripNoise(endMatch ? raw.slice(0, endMatch.index + 1) : raw);

  const combinedAt = sheet.search(COMBINED_HEADER);
  const nscAt = sheet.search(NSC_HEADER);
  const scEnd = [combinedAt, nscAt].filter((i) => i >= 0);
  const scSection = sheet.slice(
    0,
    scEnd.length ? Math.min(...scEnd) : undefined,
  );
  const combinedEnd = nscAt > combinedAt ? nscAt : undefined;
  const combinedSection =
    combinedAt >= 0 ? sheet.slice(combinedAt, combinedEnd) : "";
  const combinedHistory = [...combinedSection.matchAll(RATING_STEP)].map(
    (m) => ({ percentage: Number(m[1]), effectiveDate: toIsoDay(m[2]) }),
  );

  const preamble = stripNoise(
    flat.slice(Math.max(0, headerIndex - DATE_LOOKBACK_CHARS), headerIndex),
  );

  return {
    sheetDate: date,
    conditions: parseServiceConnected(scSection).filter(
      (c) => c.rating !== null,
    ),
    combinedRating: combinedHistory.at(-1)?.percentage ?? null,
    combinedRatingHistory: combinedHistory,
    notServiceConnected:
      nscAt >= 0 ? parseNotServiceConnected(sheet.slice(nscAt)) : [],
    servicePeriods: parseActiveDuty(preamble),
    jurisdiction: parseJurisdiction(preamble),
    representative,
  };
}

/** Every code sheet in the text, in document order. */
export function parseRatingCodeSheets(text) {
  if (typeof text !== "string" || !text) return [];
  const flat = flatten(text);
  const headers = [...flat.matchAll(SC_HEADER)];
  return headers
    .map((h, i) =>
      parseOneSheet(flat, h.index, h[0].length, headers[i + 1]?.index),
    )
    .filter((s) => s.conditions.length > 0);
}

/**
 * D19-7: chunked twin of parseRatingCodeSheets - the flatten() pass is
 * chunked (see flattenChunked), and the loop parsing each individual sheet
 * yields between sheets. Byte-identical output for the same input - see
 * vaCodeSheet.chunked.equivalence.test.js.
 */
export async function parseRatingCodeSheetsChunked(text, slicer) {
  if (typeof text !== "string" || !text) return [];
  const flat = await flattenChunked(text, slicer);
  const headers = [...flat.matchAll(SC_HEADER)];
  const sheets = [];
  for (let i = 0; i < headers.length; i++) {
    const sheet = parseOneSheet(
      flat,
      headers[i].index,
      headers[i][0].length,
      headers[i + 1]?.index,
    );
    if (sheet.conditions.length > 0) sheets.push(sheet);
    await slicer.maybeYield();
  }
  return sheets;
}

/**
 * The newest of an already-parsed set of code sheets by rating-decision
 * date, or null. Undated sheets only win when no sheet carries a date.
 * Split out of latestRatingCodeSheet so a caller that also needs
 * recordEventsFromSheets can parse the text once and derive both, instead
 * of two full passes over the same C-File.
 */
export function latestFromSheets(sheets) {
  if (sheets.length === 0) return null;
  return sheets.reduce((best, s) =>
    (s.sheetDate || "") > (best.sheetDate || "") ? s : best,
  );
}

/**
 * The newest code sheet by its rating-decision date, or null. Undated sheets
 * only win when no sheet carries a date.
 */
export function latestRatingCodeSheet(text) {
  return latestFromSheets(parseRatingCodeSheets(text));
}

/**
 * Dated events an already-parsed set of code sheets records: each rating
 * decision, and the claim (or review exam) it answered. One event per date
 * and kind. See latestFromSheets's doc comment for why this takes `sheets`
 * rather than `text`.
 */
export function recordEventsFromSheets(sheets) {
  const events = new Map();
  const add = (date, eventType, description) => {
    if (date && !events.has(`${date}|${eventType}`)) {
      events.set(`${date}|${eventType}`, { date, eventType, description });
    }
  };
  for (const sheet of sheets) {
    add(sheet.sheetDate, "rating_decision", "VA rating decision");
    const j = sheet.jurisdiction;
    if (j) {
      add(
        j.date,
        j.verb === "received" ? "claim_received" : "exam",
        j.verb === "received" ? `${j.action} received by VA` : j.action,
      );
    }
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Dated events every code sheet in a C-File records: each rating decision,
 * and the claim (or review exam) it answered. One event per date and kind.
 */
export function codeSheetRecordEvents(text) {
  return recordEventsFromSheets(parseRatingCodeSheets(text));
}
