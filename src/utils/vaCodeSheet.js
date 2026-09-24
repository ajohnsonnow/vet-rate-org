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
 * The newest code sheet by its rating-decision date, or null. Undated sheets
 * only win when no sheet carries a date.
 */
export function latestRatingCodeSheet(text) {
  const sheets = parseRatingCodeSheets(text);
  if (sheets.length === 0) return null;
  return sheets.reduce((best, s) =>
    (s.sheetDate || "") > (best.sheetDate || "") ? s : best,
  );
}
