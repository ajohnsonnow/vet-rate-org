/**
 * Vet-Rate.org - Service Entry Date: the VKB-side view of the ADR-007
 * projection
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The VKB's service-entry subset (entry fields, linked period rows, entry
 * timeline events) is a PROJECTION of shape 1 (servicePeriods[]) - it is
 * never independently edited. This module is the read-side boundary
 * veteranKnowledgeBase.js's projection reads through; it imports
 * veteranProfile.js statically, so veteranKnowledgeBase.js (which
 * veteranProfile.js already imports statically) has to reach it through a
 * cached dynamic import() instead, to avoid a load-time cycle.
 * See docs/adr/ADR-007-service-history-single-authoritative-store.md.
 */

import {
  getServiceEntry,
  getServicePeriods,
  getUnmatchedServiceRecords,
  isKnownServiceEntryDate,
  recordServiceEntryDisagreement,
  setServiceEntryDate,
} from "./veteranProfile";
import { documentSources, isSameCalendarDay } from "./serviceEntryDate";
import { parseExplicitDate } from "./dateUtils";

/**
 * @returns {{entry: object, periods: Array<object>, knownSources: Set<string>, isKnownDate: (value: string) => boolean}}
 */
export function buildServiceEntryView() {
  const periods = getServicePeriods();
  const unmatched = getUnmatchedServiceRecords();
  const knownSources = new Set();
  [...periods, ...unmatched].forEach((p) => {
    documentSources(p).forEach((s) => knownSources.add(s));
    if (p.sourceDocument) knownSources.add(p.sourceDocument);
  });
  return {
    entry: getServiceEntry(),
    periods,
    knownSources,
    isKnownDate: isKnownServiceEntryDate,
  };
}

function _preHasMatchingVerifiedRow(periods, iso) {
  return periods.some(
    (p) => p.datesVerifiedBy && isSameCalendarDay(p.serviceStartDate, iso),
  );
}

function _preHasUnknownSourceRow(periods, iso, knownSources) {
  return periods.some(
    (p) =>
      p.source &&
      !knownSources.has(p.source) &&
      isSameCalendarDay(p.serviceStartDate, iso),
  );
}

/**
 * One-time (per VKB, guarded by metadata.migratedServiceEntryProjection)
 * adoption of a legacy VKB viewer edit that pre-dates ADR-007 - the VKB
 * used to be independently editable, so a veteran's own top-level
 * entryDate correction may have never reached shape 1 at all. Idempotent:
 * once adopted (or recorded), isKnownServiceEntryDate makes every later
 * call a no-op. `pre` must be read BEFORE the projection runs.
 * @param {{entryDate: string|null, entryDateDerived: boolean, servicePeriods: Array<object>, source: string|null}} pre
 */
export function adoptLegacyVkbEntryEdits(pre) {
  // Invariant I7: a VA-API-sourced VKB value never flows into shape 1.
  if (!pre || pre.source === "VA.gov API") return;

  const iso = parseExplicitDate(pre.entryDate);
  if (!iso || pre.entryDateDerived !== false) return;
  if (isKnownServiceEntryDate(iso)) return;

  const view = buildServiceEntryView();
  const periods = Array.isArray(pre.servicePeriods) ? pre.servicePeriods : [];
  const entryPeriod = view.entry.periodId
    ? view.periods.find((p) => p.id === view.entry.periodId)
    : null;

  const eligible =
    view.entry.source === "calculated" &&
    !_preHasMatchingVerifiedRow(periods, iso) &&
    !_preHasUnknownSourceRow(periods, iso, view.knownSources) &&
    !!entryPeriod?.serviceEndDate &&
    new Date(iso) < new Date(entryPeriod.serviceEndDate);

  if (eligible) {
    setServiceEntryDate({
      date: iso,
      via: "legacy_vkb_viewer",
      periodId: view.entry.periodId,
    });
  } else {
    recordServiceEntryDisagreement(iso, "Knowledge Base (earlier value)");
  }
}
