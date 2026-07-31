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
  if (!dateString) return new Date(NaN);
  // Defensive: some call sites store a spurious full-ISO string derived
  // from a date-only <input type="date"> value (new Date(v).toISOString())
  // — the intent is still a calendar day, not a real instant, so only the
  // YYYY-MM-DD portion is meaningful here.
  const datePart = String(dateString).slice(0, 10);
  return new Date(`${datePart}T00:00:00`);
};
