# ADR-002: Three separate "service history" shapes — do not merge

**Status:** Accepted
**Date:** 2026-08-08
**Context:** QA-flagged doc gap — nothing in `docs/` explained the split, risking a future fix conflating the three shapes.

---

## Context

The codebase has three distinct, differently-shaped representations of a veteran's military service history. They share overlapping vocabulary (all three have a concept of "service periods" or "service history"), which makes them easy to confuse, but they are backed by three separate `localStorage` keys and serve three different purposes.

| Shape                                   | Lives in                                                                   | Storage key                | Managed via                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Canonical multi-period model**     | `src/utils/veteranProfile.js`, `serviceHistory.servicePeriods[]`           | `vet_rate_service_history` | `getServicePeriods()`, `upsertServicePeriod()`, `addServicePeriod()`, `updateServicePeriod()`, `removeServicePeriod()`, `summarizeServicePeriods()` |
| **2. VKB flat AI-context merge target** | `src/utils/veteranKnowledgeBase.js`, `vkb.serviceHistory.servicePeriods[]` | `vetrate_knowledge_base`   | `mergeDD214ServicePeriodTracking()` (write), `buildServicePeriodsAndSeparationContext()` (read, for AI chat context)                                |
| **3. Raw VA-API response**              | Rendered by `VkbServiceHistorySection` in `src/components/MyPacket.jsx`    | `vet_rate_va_records`      | `saveVARecordsRaw()` / `vaRecords.serviceHistory` (`src/utils/vaDataPersistence.js`)                                                                |

### 1. Canonical multi-period model (`veteranProfile.js`)

The source of truth. Editable by the veteran (Profile tab), populated by DD214/NGB22 parsing (`musterCallProcessor.js`), and the only shape that models **multiple, distinct enlistment periods** as first-class array entries keyed by `(serviceStartDate, serviceEndDate)`. Every other feature that needs "what did this veteran's service actually look like" should read from here.

### 2. VKB flat AI-context merge target (`veteranKnowledgeBase.js`)

`mergeDD214ServicePeriodTracking()` writes to `vkb.serviceHistory.servicePeriods[]` — an array that, confusingly, uses almost the same field names (`serviceStartDate`, `serviceEndDate`, `branch`, `rank`, `mos`, ...) as shape 1. **It is not the same object and is not kept in sync with shape 1.** It exists purely so `buildServicePeriodsAndSeparationContext()` can flatten it into a text block for the AI assistant's chat context. A DD214 import writes to both shape 1 (via `musterCallProcessor.js`'s `upsertServicePeriod`) and shape 2 (via `mergeDD214IntoVKB` → `mergeDD214ServicePeriodTracking`) independently, in two separate write paths.

### 3. Raw VA-API response (`MyPacket.jsx` → `VkbServiceHistorySection`)

The last service-history payload returned by the (currently dormant, `VITE_VA_API_ENABLED=false`) VA Lighthouse API integration, cached untouched in `vaRecords.serviceHistory`. Single-period, read-only, rendered under a distinct "VA-Verified" badge. Deliberately **never merged** into shape 1 or shape 2 — see the comment directly above `VkbServiceHistorySection` in `MyPacket.jsx`: a veteran with DD214 data loaded first must never see DD214-derived values silently relabeled as VA-verified.

## Decision

**Do not merge these three shapes, and do not make any one of them read from another at runtime.** Keep three separate write paths and three separate storage keys.

Rationale:

1. **Different trust levels.** Shape 3 is a distinct, less-trustworthy data source by design (dormant third-party API, not user-editable, not cross-checked) — collapsing it into the canonical model would silently launder its provenance.
2. **Different consumers, different shapes on purpose.** Shape 2 exists only to serve a text-flattening function for AI context; forcing shape 1's richer multi-period array through that flattening path on every read would be wasted work with no benefit to the AI context, which only needs a short summary.
3. **Independent write timing.** DD214 import writes shapes 1 and 2 in two separate calls in `musterCallProcessor.js`/`veteranKnowledgeBase.js`. They are _usually_ consistent right after an import, but nothing enforces that they stay consistent afterward (e.g., a manual edit to shape 1 via the Profile tab does not propagate to shape 2). Treat any apparent agreement between shape 1 and shape 2 as coincidental, not guaranteed.

## Consequences

- A future contributor searching for "service periods" will find matches in all three files. **Check which shape you're actually looking at before wiring it into a new feature** — the field names alone (`serviceStartDate`/`serviceEndDate`/`branch`/`rank`/`mos`) will not tell you which of the three you have.
- If a feature needs the veteran's real, editable service history, it must read shape 1 (`veteranProfile.js`). Do not read shape 2 for that purpose, even though it looks similar — it can silently disagree with shape 1 after a manual profile edit.
- If a feature needs to feed the AI assistant, use shape 2's existing `buildServicePeriodsAndSeparationContext()` output rather than re-flattening shape 1 yourself in a new location.
- Never wire shape 3 into shape 1 or shape 2. If the VA API integration is ever re-enabled (`VITE_VA_API_ENABLED=true`), any reconciliation between shape 3 and the canonical model must be an explicit, veteran-visible action (e.g. an "import from VA.gov" button with a diff/confirm step) — never a silent background merge.
- Revisit this decision if: (a) the VA API integration is re-enabled and product wants automatic reconciliation, or (b) shape 2 is refactored to derive from shape 1 at read time instead of being written independently (which would eliminate the drift risk in Consequence 3, but is a larger refactor out of scope here).
