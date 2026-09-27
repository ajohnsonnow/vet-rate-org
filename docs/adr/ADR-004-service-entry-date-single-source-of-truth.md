# ADR-004: Service entry date — one selector, with provenance, per storage shape

**Status:** Accepted; superseded in part by ADR-007 (2026-09-27) — see the amendment note at the end of this document.
**Date:** 2026-09-27
**Context:** QA final11 review — verified defects D11-1, D11-2, D11-6 plus a code-sheet/NGB-22 ordering bug.

---

## Context

ADR-002 already documents that this codebase has three separate "service history" shapes (canonical `veteranProfile.js` model, VKB flat AI-context model, raw VA-API cache) and decides, deliberately, **not** to merge them or make one read from another at runtime.

Within shape 1 (`veteranProfile.js`) and shape 2 (`veteranKnowledgeBase.js`) independently, the veteran's service **entry/start date** itself had accumulated a second layer of duplication, inside each shape:

- Shape 1: `dd214Data.entryDate` + `entryDate` (the original DD214/NGB-22 extraction, written once by `saveDD214Data`, never touched again) vs. `servicePeriods[].serviceStartDate` (the canonical, editable, per-period array) vs. `profile.serviceStartDate` (a flat top-level mirror, written by `autoPopulateProfile`/FormsHelper/My Packet).
- Shape 2: `vkb.serviceHistory.entryDate` (top-level, editable via VKBViewer) vs. `vkb.serviceHistory.servicePeriods[].serviceStartDate` (per-period, corrected by code-sheet merges but never by VKBViewer's own top-level editor).

Each copy carried its own independent `*Derived` flag ("was this calculated from net service, or printed on the form"). An editor that corrected one copy (the Muster Call review modal, the VKB viewer's Entry Date field, My Packet's Service tab, FormsHelper) had no way to reach the others, so:

- D11-1: the Muster Call review modal displayed and saved a veteran's correction while leaving `serviceStartDateDerived: true` on it, because the display read `groupedFields` (never updated by edits) and Verify & Save built `verifiedData` with no awareness that an edited field's derived flag needed clearing too.
- D11-6: `aiSystemPrompts.js` read `dd214Data.entryDate`/`entryDateDerived` directly — the one copy no editor ever updates — so a corrected date never reached the AI system prompt. Separately, `generateLLMContext`'s "Period 1:" line and "Service:" line could show different dates because VKBViewer's top-level edit never touched the matching `servicePeriods[]` entry.
- A code sheet correcting an NGB-22-calculated period cleared the date fields (an existing, working `authoritativeDates` bypass in `_mergeExistingServicePeriod`) but NOT `serviceStartDateDerived`, because that flag was merged as an ordinary field and a real printed date (`false`) "disagreed" with the existing calculated guess (`true`).
- D11-2: My Packet's Service tab "Service span" line never had a marker to show at all — `summarizeServicePeriods` discarded which period supplied the earliest start date.

## Decision

**One precedence algorithm, `pickServiceEntry(periods, legacy)` (`src/utils/serviceEntryDate.js`), applied once per storage shape — not one selector spanning both shapes.** This keeps ADR-002's boundary intact (shape 1 and shape 2 stay independent stores) while giving each shape a single, correct notion of "the" entry date:

- **Shape 1** (`veteranProfile.js`): `getServiceEntry()` calls `pickServiceEntry(getServiceHistory().servicePeriods, dd214Legacy)`, falling back to `profile.serviceStartDate` only when no period has ever been recorded. Every shape-1 consumer (`aiSystemPrompts.js`, `dossierExport.js`, `summarizeServicePeriods`'s `serviceSpan.startDerived`) reads this, not `dd214Data`/`profile.serviceStartDate` directly.
- **Shape 2** (`veteranKnowledgeBase.js`): the same `pickServiceEntry` is available for `vkb.serviceHistory.servicePeriods` + `vkb.serviceHistory.entryDate` fallback; `buildServicePeriodsAndSeparationContext` now always lists what's in `servicePeriods[]` (previously gated on 2+ entries), and VKBViewer's top-level Entry Date editor now also updates the matching period, so "Service:" and "Period N:" agree after an edit without needing a shared selector call at render time.

Precedence, encoded once in `pickServiceEntry`: **veteran edit > authoritative printed (code sheet / DD214 Box 12a / VA-verified) > calculated**, expressed as picking the _earliest proven period_ (excluding NGB-22 Box-18 IADT/AD training windows, which are additive detail, not enlistment records) and reporting `source: 'veteran' | 'code_sheet' | 'printed' | 'calculated'` from that period's own `userEdited`/`serviceStartDateDerived`/`formType` fields — fields already written correctly by `upsertServicePeriod`'s `userEdited` protection and (after this fix) `_mergeExistingServicePeriod`'s `authoritativeDates` bypass. The selector does not re-resolve conflicting sources itself; that remains the write-side merge's job (unchanged from before this ADR), matching ADR-002's "read shape 1, don't re-derive it elsewhere" guidance.

Every editor now writes the veteran's correction through to the canonical period it affects, clearing `serviceStartDateDerived`:

- Muster Call review modal (`DocumentIntelligenceBriefing.jsx`): `handleFieldEdit` updates `filteredData`/`groupedFields` (fixing the display) as well as `editedData`; Verify & Save clears `serviceStartDateDerived` in `verifiedData` when the saved value actually differs from the original extraction.
- VKB viewer: the top-level Entry Date field now also updates whichever `servicePeriods[]` entry it was mirroring.
- My Packet's Service tab editor and FormsHelper already wrote through correctly (`_updateServicePeriodField`, `handleProfileChange`) — no change needed there. FormsHelper's own prefill (`buildFormsHelperPrefillDefaults`) reads `profile.serviceStartDate`/`serviceStartDateDerived` directly rather than the new selector, and `FormsHelper.jsx` is out of this fix's file ownership — `addServicePeriod`/`updateServicePeriod`/`removeServicePeriod` (the manual-editor functions, never called by document ingestion) now keep that flat mirror in sync instead, so FormsHelper sees a My Packet correction without needing to change. `upsertServicePeriod` (document ingestion) deliberately does **not** get this treatment: `autoPopulateProfile` already owns writing `profile.serviceStartDate` from an import, with its own never-overwrite-a-user-edited-field/surface-a-conflict protection (`profileFieldSources`) — syncing unconditionally from `upsertServicePeriod` too would bypass that protection for a manually-typed profile date.
- Code sheet corrections (`_mergeExistingServicePeriod`'s `authoritativeDates` bypass) now clear `serviceStartDateDerived` alongside the dates it already corrected, both orders (code sheet before or after the NGB-22), and survive a re-import of the same NGB-22 afterward — `serviceStartDateDerived` is excluded from the generic per-field merge loop entirely (paired exclusively with the dates it describes), mirroring the pattern `veteranKnowledgeBase.js`'s `_applyAuthoritativeCorrection` already used for shape 2.

Legacy fields (`dd214Data.entryDate`, `profile.serviceStartDate`) are left in place and still populated by their existing write paths — no migration needed, no data loss for older saved data. They simply stop being read directly by the consumers this ADR covers.

## Consequences

- A future consumer of "the veteran's service entry date" in shape 1 must call `getServiceEntry()` (`veteranProfile.js`), not read `dd214Data.entryDate` or `profile.serviceStartDate` directly — those remain write-only mirrors for backward compatibility, not read APIs.
- A future consumer in shape 2 should use the same `pickServiceEntry` precedence (or its existing `vkb.serviceHistory.entryDate`/`entryDateDerived`, kept in sync with `servicePeriods[]` by this fix) rather than re-deriving its own notion of "earliest period."
- `serviceStartDateDerived` must always change in lockstep with its paired `serviceStartDate` — never merge it as an independent fact. Any new write path for `servicePeriods[]` should follow this pairing (see `_mergeExistingServicePeriod`'s `authoritativeDates` bypass and `veteranKnowledgeBase.js`'s `_applyAuthoritativeCorrection` as the two reference implementations).
- ADR-002's boundary is unchanged: shape 1 and shape 2 are still independent stores with independent write paths. This ADR does not introduce a runtime read from one into the other; VKBViewer's new period-propagation is entirely internal to shape 2.
- `DD214Analyzer.jsx`'s profile-import prep now sends `serviceStartDate`/`serviceEndDate` (matching `VALID_PROFILE_FIELDS`), not `entryDate`/`separationDate` — a DD214Analyzer-only veteran (no Muster Call import) now gets a populated service span instead of "? - ?".
- `dossierExport.js` now reads deployments from `getServiceHistory().deployments` (they were never on the profile object at all — `profile.deployments` was dead code) and its "Service Dates" line through `getServiceEntry()`.

## Amendment (ADR-007, 2026-09-27)

QA final12 found this "one selector per shape" design could not actually converge: four independent writers (Muster Call, the VKB viewer, My Packet, FormsHelper) each held their own copy with no shared write path, so a correction made through one never reached the other three. ADR-007 replaces the model this ADR describes with one authoritative store (`servicePeriods[]`, shape 1) plus a corrections layer, and a read/write-time _projection_ into shape 2, rather than a same-shaped selector applied independently to each shape. Specifically superseded:

- "One selector, applied once per storage shape" — shape 2's service-entry subset is now a projection of shape 1, not an independently-applied instance of the same algorithm.
- "The selector does not re-resolve conflicting sources itself; that remains the write-side merge's job" — precedence resolution (`_mergeIncomingStart`) is now the selector's own concern, folded into the one write API (`setServiceEntryDate`).
- "VKB viewer... top-level Entry Date field now also updates whichever `servicePeriods[]` entry it was mirroring" — the VKB viewer no longer writes `servicePeriods[]` at all; it calls `setServiceEntryDate` and displays the projection.
- "Legacy fields ... are left in place ... They simply stop being read directly" — `dd214Data.entryDate` and the flat profile mirror are now active projection targets, written on every `saveServiceHistory`, not static legacy mirrors.
- "`autoPopulateProfile` already owns writing `profile.serviceStartDate` from an import" — once a period backs the entry, `autoPopulateProfile` is blocked from moving `serviceStartDate` at all (`hasPeriodBackedServiceEntry()`); the chokepoint in `saveVeteranProfile` owns the flat field from that point on.

Still in force, unchanged by ADR-007: pairing `serviceStartDateDerived` with its date rather than merging it as an independent fact (now expressed as `serviceStartDateDerived = (serviceStartDateSource === 'calculated')`, computed, never merged); and excluding NGB-22 Box-18 IADT/AD training windows from entry-date candidacy.
