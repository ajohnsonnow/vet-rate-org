/**
 * Vet-Rate.org - Canonical Service Entry Date Selector
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ADR-007: servicePeriods[] is the ONE authoritative store for the service
 * entry/start date. Every period carries serviceStartDateSource ('veteran'
 * | 'code_sheet' | 'printed' | 'calculated' | null), the provenance of its
 * own effective serviceStartDate - see veteranProfile.js's
 * _sanitizeServicePeriodIdentity for how that field is derived/whitelisted.
 *
 * pickServiceEntry() is the ONE precedence algorithm every consumer (AI
 * system prompt, dossier export, VKB LLM context, Service tab summary) runs
 * against its own store's canonical servicePeriods[] array, so "the"
 * service entry date and its provenance are decided in exactly one place.
 * See docs/adr/ADR-007-service-history-single-authoritative-store.md.
 */

import { parseExplicitDate, isSameDate } from "./dateUtils";

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

export const START_SOURCES = ["veteran", "code_sheet", "printed", "calculated"];

export const SOURCE_RANK = {
  calculated: 1,
  printed: 2,
  code_sheet: 3,
  veteran: 4,
};

// A period with no other contributor - a corrected/manually-added period,
// or the legacy migration pseudo-source below - reads as having no stable
// document to key identity or same-enlistment grouping off of.
export const NON_STABLE_SOURCE_NAMES = [
  "",
  "DD-214",
  "Pasted DD214 Text",
  "VA code sheet",
];

// migrationManager.js's own label for a period that was never backed by
// any real document - a flat profile field the veteran typed directly,
// carried forward as a period at v1. Never a real "document" for identity
// or grouping purposes.
export const VETERAN_PSEUDO_SOURCE = "Migrated (manual profile entry)";

/**
 * True when both values parse to the exact same calendar day
 * (parseExplicitDate equality) - unlike dateUtils.isSameDate, this has NO
 * 7-day tolerance. Used for every comparison in migration, adoption and
 * projection: dd214Data and VKB dates can be MM/DD/YYYY while canonical
 * periods are ISO, so raw string comparison is never safe.
 */
export function isSameCalendarDay(a, b) {
  const da = parseExplicitDate(a);
  const db = parseExplicitDate(b);
  return !!da && !!db && da === db;
}

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

/**
 * Provenance of a period's own effective start date. Never infers
 * 'veteran' from userEdited (that's the whole-period ingest lock, not date
 * provenance) - only setServiceEntryDate/updateServicePeriod/
 * addServicePeriod/the migration ever set serviceStartDateSource:
 * 'veteran'.
 */
export function periodStartSource(p) {
  if (!p?.serviceStartDate) return null;
  if (START_SOURCES.includes(p.serviceStartDateSource)) {
    return p.serviceStartDateSource;
  }
  const isCodeSheet =
    p.formType === "Code Sheet" ||
    (Array.isArray(p.sources) &&
      p.sources.some((s) => s?.formType === "Code Sheet"));
  if (isCodeSheet) return "code_sheet";
  if (p.serviceStartDateDerived) return "calculated";
  return "printed";
}

/**
 * Every document name that has ever contributed to `p` - sources[]
 * entries plus the legacy single sourceDocument field, deduplicated, with
 * the migration's manual-entry pseudo-source excluded (it names no real
 * document).
 */
export function documentSources(p) {
  const names = new Set();
  (p?.sources || []).forEach((s) => {
    if (s?.sourceDocument) names.add(s.sourceDocument);
  });
  if (p?.sourceDocument) names.add(p.sourceDocument);
  names.delete(VETERAN_PSEUDO_SOURCE);
  return [...names];
}

/**
 * False for a source-document name too generic/legacy to prove identity
 * with (an empty name, a bare "DD-214"/"VA code sheet" label predating
 * per-file names, or any "Migrated (...)" label) - true for a real
 * filename.
 */
export function isStableSourceDocument(name) {
  if (!name) return false;
  if (NON_STABLE_SOURCE_NAMES.includes(name)) return false;
  return !name.startsWith("Migrated (");
}

// Same-enlistment grouping (union-find): two candidate periods describe
// the same real enlistment when they share a document OR share an end
// date (ADR-007 §2.2: "different enlistments" requires BOTH no shared
// document AND no shared end date). A shared end date alone is enough -
// a code sheet or a second DD-214 filed under a different filename for the
// exact same separation still describes the same enlistment an existing
// (possibly veteran-corrected) period already represents, even though
// identity matching (upsertServicePeriod, a stricter same-document-or-
// close-date rule) never merged them into one period object. Without this,
// that second period reads as a genuinely different, earlier enlistment
// and silently outranks the veteran's own correction on the first one.
function _sameEnlistmentGroup(a, b) {
  if (
    a.serviceEndDate &&
    b.serviceEndDate &&
    isSameDate(a.serviceEndDate, b.serviceEndDate)
  ) {
    return true;
  }
  const aSources = documentSources(a);
  const bSources = documentSources(b);
  return aSources.some((s) => bSources.includes(s));
}

function _groupByEnlistment(candidates) {
  const parent = candidates.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i, j) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (_sameEnlistmentGroup(candidates[i], candidates[j])) union(i, j);
    }
  }
  const groups = new Map();
  candidates.forEach((p, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  });
  return [...groups.values()];
}

// Best candidate within one enlistment group: highest-ranked source first
// (veteran > code_sheet > printed > calculated), earliest start breaks a
// same-rank tie.
function _bestInGroup(group) {
  return group.reduce((best, p) => {
    const bestRank = SOURCE_RANK[periodStartSource(best)] ?? 0;
    const pRank = SOURCE_RANK[periodStartSource(p)] ?? 0;
    if (pRank !== bestRank) return pRank > bestRank ? p : best;
    return new Date(p.serviceStartDate) < new Date(best.serviceStartDate)
      ? p
      : best;
  });
}

/**
 * [DR-1] Across different enlistments (no shared end date/document), which
 * group's best period is "when service began". Returns negative when `a`
 * should be preferred over `b`, positive when `b` should be preferred, 0
 * on an exact tie.
 *
 * Recommended "chronological" variant (built and tested here): the
 * earliest enlistment's start wins outright, even when it's calculated -
 * a calculated NGB-22 start can only run LATE, never early (a real,
 * printed later enlistment can never be "actually earlier" than a
 * calculated guess), and it keeps every top-level editor (FormsHelper,
 * the VKB viewer) unambiguously correcting the period it displays. Marked
 * "calculated" when it is.
 *
 * If Anth keeps ADR-005 instead: swap this one function's body for the
 * "two-tier" variant (non-calculated beats calculated, then earliest) and
 * rerun the tests tagged [DR-1].
 */
function _compareEnlistmentGroups(a, b) {
  if (!isSameCalendarDay(a.serviceStartDate, b.serviceStartDate)) {
    return new Date(a.serviceStartDate) < new Date(b.serviceStartDate) ? -1 : 1;
  }
  const rankA = SOURCE_RANK[periodStartSource(a)] ?? 0;
  const rankB = SOURCE_RANK[periodStartSource(b)] ?? 0;
  return rankB - rankA;
}

/**
 * Picks the veteran's real service entry date and its provenance out of
 * `periods` (a store's canonical servicePeriods[], windows excluded):
 * groups same-enlistment periods together, resolves each group's real
 * source by precedence (veteran > code_sheet > printed > calculated), then
 * resolves across enlistments by _compareEnlistmentGroups ([DR-1]).
 *
 * Falls back to `legacy` only when no period has a usable date - data
 * saved before servicePeriods[] existed, or a store with nothing else
 * recorded.
 *
 * @param {Array<object>} periods
 * @param {{date: string|null, derived: boolean}|null} [legacy]
 * @returns {ServiceEntry}
 */
export function pickServiceEntry(periods, legacy = null) {
  const candidates = (periods || []).filter(_isEntryCandidate);
  if (candidates.length > 0) {
    const groups = _groupByEnlistment(candidates);
    const groupBests = groups.map(_bestInGroup);
    const best = groupBests.reduce((champion, candidate) =>
      _compareEnlistmentGroups(candidate, champion) < 0 ? candidate : champion,
    );
    const source = periodStartSource(best);
    return {
      date: best.serviceStartDate,
      derived: source === "calculated",
      source,
      periodId: best.id || null,
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
