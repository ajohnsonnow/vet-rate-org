/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

/**
 * D-8: `new Date("YYYY-MM-DD")` parses as UTC midnight; rendering it with
 * `.toLocaleDateString()` (or any local-timezone formatter) then shows the
 * previous calendar day anywhere west of UTC. Only affects date-only
 * "YYYY-MM-DD" strings — full ISO timestamps (dateSaved, uploadDate,
 * exportDate, etc.) already carry a real time and must NOT be routed
 * through this helper.
 *
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {Date} A Date constructed at local midnight for that calendar day
 */
export const formatLocalDate = (dateString) => {
  if (!dateString) return new Date(Number.NaN);
  // Defensive: some call sites store a spurious full-ISO string derived
  // from a date-only <input type="date"> value (new Date(v).toISOString())
  // — the intent is still a calendar day, not a real instant, so only the
  // YYYY-MM-DD portion is meaningful here.
  const datePart = String(dateString).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    // Prose ("July 12, 2015") and US ("05/30/2015") dates saved from letters
    // and DD214s already parse at local midnight.
    return new Date(dateString);
  }
  return new Date(`${datePart}T00:00:00`);
};

const SAME_PERIOD_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when two dates are the same real-world day within a small tolerance -
 * different documents describing the same event (an NGB-22 and VA's code
 * sheet, or two scans of the same deployment tour) can disagree on a date
 * by a few days (report date vs entry date). Both dates must be present and
 * parseable; either side missing or invalid is never treated as "same".
 */
export const isSameDate = (a, b) => {
  const ta = formatLocalDate(a).getTime();
  const tb = formatLocalDate(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) <= SAME_PERIOD_TOLERANCE_MS;
};

/**
 * True when two dated service periods are the same period recorded by
 * different documents. Both periods need both dates.
 */
export const isSameServicePeriod = (aStart, aEnd, bStart, bEnd) =>
  isSameDate(aStart, bStart) && isSameDate(aEnd, bEnd);

const MONTH_ABBREVIATIONS = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const _expandTwoDigitYear = (year) => {
  if (year.length !== 2) return year;
  return Number(year) > 50 ? `19${year}` : `20${year}`;
};

const MIN_VALID_YEAR = 1900;
const MAX_VALID_YEAR = 2100;

/**
 * N13 (final9 QA, 2026-09-25): every branch below built its "YYYY-MM-DD"
 * candidate from whatever digits its own pattern matched, with no check
 * that the result is a real calendar day - "13" for a month or "30" for
 * February round-tripped straight through, and an 8-digit run like
 * "99999999" parsed as year 9999. Round-tripping the candidate through
 * `Date.UTC` and reading the fields back out catches both: an invalid
 * month/day rolls over to a DIFFERENT date (e.g. Feb 30 becomes Mar 2),
 * so the fields never match what was asked for. The year band rejects
 * anything outside a real veteran's or claimant's plausible lifetime -
 * this app has no dates before 1900 or after 2100.
 */
function _isValidCalendarDate(isoDate) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_VALID_YEAR || year > MAX_VALID_YEAR) return false;
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

/**
 * N7 (final8 QA, 2026-09-24): both musterCallProcessor's own
 * `_toISODateString` and the VKB's `_toIsoDate` used to fall back to
 * `Date.parse`/`new Date()` for anything that didn't match their explicit
 * patterns - V8's parser is lenient enough that garbage like "SINAI 12",
 * "SINAI 2004" or "NGB FORM 2022" (a location/form label plus a stray
 * number, not a date at all) all parse as a real, wrong date instead of
 * failing. Shared by both call sites so the accepted format list only
 * needs to be right in one place: only the explicit shapes this
 * codebase's own parsers actually emit are ever accepted - ISO, numeric
 * MM-DD-YYYY (slash or dash, 2-4 digit year, the same shape
 * DECISION_DATE_RE and the DD214 box extractors capture), compact
 * YYYYMMDD, "DD MON YYYY" (NGB-22 remarks style), and prose "Month DD,
 * YYYY" (rating-decision "effective ..." style) - anything else is null,
 * never guessed at via Date's own leniency.
 * @param {string} value
 * @returns {string|null} "YYYY-MM-DD", or null if `value` isn't one of the
 *   explicit accepted formats, or isn't a real calendar date (N13).
 */
// Split out so each parseExplicitDate branch below can validate with a
// plain call (not its own ternary) - keeps the N13 round-trip check from
// adding a branch to every format's cognitive complexity.
function _validCandidate(candidate) {
  return _isValidCalendarDate(candidate) ? candidate : null;
}

export function parseExplicitDate(value) {
  if (!value) return null;
  const text = String(value).trim();

  const iso = text.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
  if (iso) return _validCandidate(iso[1]);

  const numeric = text.match(/^(\d{1,2})([-/])(\d{1,2})\2(\d{2,4})$/);
  if (numeric) {
    const [, month, , day, year] = numeric;
    return _validCandidate(
      `${_expandTwoDigitYear(year)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    );
  }

  if (/^\d{8}$/.test(text)) {
    return _validCandidate(
      `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`,
    );
  }

  // "14 SEP 2011" - day first, month abbreviation.
  const dayFirst = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (dayFirst) {
    const month = MONTH_ABBREVIATIONS[dayFirst[2].slice(0, 3).toUpperCase()];
    return month
      ? _validCandidate(
          `${dayFirst[3]}-${month}-${dayFirst[1].padStart(2, "0")}`,
        )
      : null;
  }

  // "March 9, 2012" / "Nov. 21 2013" - month first, full or abbreviated name.
  const monthFirst = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const month = MONTH_ABBREVIATIONS[monthFirst[1].slice(0, 3).toUpperCase()];
    return month
      ? _validCandidate(
          `${monthFirst[3]}-${month}-${monthFirst[2].padStart(2, "0")}`,
        )
      : null;
  }

  return null;
}

/**
 * N9c (final9 QA, 2026-09-25): a real NGB-22 (Report of Separation and
 * Record of Service) never prints "date entered this period" directly -
 * only Item 10's "NET SERVICE THIS PERIOD" duration (YRS|MOS|DAYS) plus
 * the separation date it counts back from. Subtracts a calendar Y/M/D
 * duration from an ISO date, field by field (not a fixed day-count
 * approximation), matching how that duration was itself computed so the two
 * round-trip exactly.
 * @param {string} isoDate - "YYYY-MM-DD"
 * @returns {string|null} "YYYY-MM-DD", or null if `isoDate` isn't that shape.
 */
// D-E (final10 QA, 2026-09-25): `Date#setUTCFullYear`/`setUTCMonth` don't
// clamp an out-of-range day-of-month, they ROLL OVER into the following
// month - "Feb 31" (March 31 minus 1 month) silently became "Mar 2/3",
// and "Feb 29" minus 1 year (landing on a non-leap year, where Feb only
// has 28 days) became "Mar 1". The calendar convention or - Date, JS
// libraries and every DoD net-service worksheet - is to clamp to the
// LAST day of the target month instead. Years/months are resolved on the
// calendar month grid first (with that clamp) before days are subtracted;
// day-level subtraction has no equivalent overflow (rolling from, say,
// March 3rd back across the month boundary into February is correct,
// calendar-accurate behavior, not overflow).
export function subtractDuration(isoDate, years, months, days) {
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const origYear = Number(match[1]);
  const origMonth = Number(match[2]) - 1;
  const origDay = Number(match[3]);

  const targetMonthIndex = origYear * 12 + origMonth - years * 12 - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex - targetYear * 12;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(origDay, daysInTargetMonth);

  const date = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
  date.setUTCDate(date.getUTCDate() - days);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// IRS/DoD combat-zone tax-exclusion designations under 26 U.S.C. §112,
// dated from the Executive Order that created each one - Afghanistan (EO
// 13239, effective 2001-09-19) and the Persian Gulf area, including Iraq
// and Kuwait (EO 12744, effective 1991-01-17). This is a DoD/IRS tax
// designation, NOT a VA "engaged in combat with the enemy" finding under
// 38 U.S.C. § 1154(b) - the two are legally distinct, and this flag must
// never be read as satisfying 1154(b) on its own.
//
// S46 QA (2026-09-24): the previous version of this list also carried
// Saudi Arabia, Bahrain, Qatar, UAE, Oman, Syria, Sinai and Kosovo with no
// dates at all, so every deployment to any of them was flagged regardless
// of when it happened. None of those has a start date sourced anywhere
// else in this codebase, so rather than guess one from memory they were
// removed - a missed flag is far cheaper than a wrong one on a
// veteran-facing legal claim.
const COMBAT_ZONE_DESIGNATIONS = {
  AFGHANISTAN: "2001-09-19",
  IRAQ: "1991-01-17",
  KUWAIT: "1991-01-17",
};

/**
 * True only when the location has a sourced designation AND the
 * deployment has a start date on or after it - an undated deployment (or
 * one to a location this file has no sourced designation for) is never
 * flagged, since there is nothing to confirm the dates against.
 *
 * N6 (final8 QA, 2026-09-24): shared by musterCallProcessor.js's
 * document-parse path and veteranKnowledgeBase.js's VKB merge path so the
 * flag is computed by one function instead of two copies that can drift -
 * the VKB copy used to only ever OR a stale `true` forward on merge and
 * never recompute it.
 * @param {string} location - Upper-cased location name.
 * @param {string} startDate - Any accepted format (see parseExplicitDate)
 *   or an already-ISO date.
 */
export function isDesignatedCombatZone(location, startDate) {
  const designationStart = COMBAT_ZONE_DESIGNATIONS[location];
  if (!designationStart || !startDate) return false;
  const deploymentStart = formatLocalDate(startDate).getTime();
  const zoneStart = formatLocalDate(designationStart).getTime();
  return !Number.isNaN(deploymentStart) && deploymentStart >= zoneStart;
}
