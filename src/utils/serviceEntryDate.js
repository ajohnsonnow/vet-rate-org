/**
 * Vet-Rate.org - Canonical Service Entry Date Selector
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The service entry/start date used to live in independent copies -
 * dd214Data.entryDate, profile.serviceStartDate, vkb.serviceHistory.entryDate,
 * and each store's own servicePeriods[] array - each written by a different
 * editor (Muster Call review, VKB viewer, My Packet, FormsHelper), so a
 * correction made through one editor reached some copies and not others.
 *
 * pickServiceEntry() is the ONE precedence algorithm every consumer (AI
 * system prompt, dossier export, VKB LLM context, Service tab summary) runs
 * against its own store's canonical servicePeriods[] array, so "the"
 * service entry date and its provenance are decided in exactly one place.
 * See docs/adr/ADR-004-service-entry-date-single-source-of-truth.md.
 */

/**
 * @typedef {object} ServiceEntry
 * @property {string|null} date - The entry date, or null if unknown.
 * @property {boolean} derived - True when the date was calculated
 *   (separation date minus net service) rather than printed on a document
 *   or supplied by the veteran.
 * @property {'veteran'|'code_sheet'|'printed'|'calculated'|null} source
 * @property {string|null} periodId - id of the period this came from, or
 *   null when it came from a legacy top-level fallback field instead.
 */

const NO_ENTRY = Object.freeze({
  date: null,
  derived: false,
  source: null,
  periodId: null,
});

// A Box-18 IADT/AD training sub-window (musterCallProcessor.js's
// periodScope: "window") is additive detail about a period, not an
// enlistment-level record in its own right - its start can predate the
// enlistment it belongs to, so it never stands in for "when did service
// begin".
function _isEntryCandidate(period) {
  return (
    !!period && !!period.serviceStartDate && period.periodScope !== "window"
  );
}

function _sourceForPeriod(period) {
  if (period.userEdited) return "veteran";
  if (period.serviceStartDateDerived) return "calculated";
  if (period.formType === "Code Sheet") return "code_sheet";
  return "printed";
}

/**
 * Picks the earliest proven period start out of `periods`. Each period is
 * expected to carry `serviceStartDate`/`serviceStartDateDerived`, and may
 * carry `userEdited`/`formType`/`periodScope` - callers pass whichever of
 * those their own store tracks; a store that doesn't track one just never
 * matches that branch of `_sourceForPeriod`.
 *
 * Falls back to `legacy` only when no period has a usable date - data saved
 * before servicePeriods[] existed, or a store with nothing else recorded.
 *
 * @param {Array<object>} periods
 * @param {{date: string|null, derived: boolean}|null} [legacy]
 * @returns {ServiceEntry}
 */
export function pickServiceEntry(periods, legacy = null) {
  const candidates = (periods || []).filter(_isEntryCandidate);
  if (candidates.length > 0) {
    const earliest = candidates.reduce((min, p) =>
      new Date(p.serviceStartDate) < new Date(min.serviceStartDate) ? p : min,
    );
    return {
      date: earliest.serviceStartDate,
      derived: !!earliest.serviceStartDateDerived,
      source: _sourceForPeriod(earliest),
      periodId: earliest.id || null,
    };
  }

  if (legacy?.date) {
    return {
      date: legacy.date,
      derived: !!legacy.derived,
      source: legacy.derived ? "calculated" : "printed",
      periodId: null,
    };
  }

  return NO_ENTRY;
}
