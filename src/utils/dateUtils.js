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
    // Prose ("July 31, 2015") and US ("05/30/2015") dates saved from letters
    // and DD214s already parse at local midnight.
    return new Date(dateString);
  }
  return new Date(`${datePart}T00:00:00`);
};

const SAME_PERIOD_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when two dated service periods are the same period recorded by
 * different documents: an NGB-22 and VA's code sheet can disagree on a start
 * date by a few days (report date vs entry date). Both periods need both
 * dates.
 */
export const isSameServicePeriod = (aStart, aEnd, bStart, bEnd) => {
  const days = [aStart, aEnd, bStart, bEnd].map((d) =>
    formatLocalDate(d).getTime(),
  );
  if (days.some((t) => Number.isNaN(t))) return false;
  return (
    Math.abs(days[0] - days[2]) <= SAME_PERIOD_TOLERANCE_MS &&
    Math.abs(days[1] - days[3]) <= SAME_PERIOD_TOLERANCE_MS
  );
};
