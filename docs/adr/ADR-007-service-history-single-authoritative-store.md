# ADR-007: Service entry date — one authoritative store with a corrections layer; every other copy is a projection

**Status:** Accepted. DR-1 (the cross-enlistment "service began" comparator) is resolved: the "chronological" variant, per owner decision 2026-09-28.
**Date:** 2026-09-27
**Amends:** ADR-002.
**Supersedes in part:** ADR-004 and ADR-005.
**Context:** QA final12, defects D12-1, D12-2, D12-3, D12-4, D12-10, plus 9 review findings synthesized by a two-judge panel (see the implementation spec this ADR ships alongside).

---

## 1. Context

ADR-004 and ADR-005 kept "one selector per storage shape" (`pickServiceEntry`/`getServiceEntry()`), plus a set of read-time overrides layered on top when the selector's own answer disagreed with a flat mirror. QA final12 showed this approach cannot converge: the start date lived in four copies (`servicePeriods[].serviceStartDate`, the flat `profile.serviceStartDate`, `dd214Data.entryDate`, and the VKB's own top-level + per-period fields), written by six independent writers, each running its own merge rule:

- `mergeDD214ServiceDates` (VKB): earliest wins.
- VKB and profile identity: the date is part of the key, with a 7-day tolerance.
- `_mergeDD214Record`: highest confidence wins.
- `autoPopulateProfile`: protects fields marked `'user'`.
- `_syncFlatServiceStartDateMirror`: copies from the resolved entry, unconditionally on every period write.
- `VKBViewer`: edited the top-level value directly, with no path back to `servicePeriods[]`.

Provenance was one overloaded boolean (`serviceStartDateDerived`) plus a lock that covers the _whole period_ (`userEdited`). Nothing could tell "the veteran corrected this specific field" apart from "a document printed this, and something else on the period happens to have been hand-edited." A correction that moved the date by more than `isSameServicePeriod`'s 7-day tolerance broke the period's own identity match, creating a second period instead of updating the first (D12-2). Each of the four editors (Muster Call review modal, VKB viewer, My Packet, FormsHelper) wrote only its own store, so a correction in one never reached the other three (D12-1, D12-4, D12-10). Stale component state could revert an already-projected value (D12-3).

This is ADR-002's own revisit trigger (b): shape 2 should be derived from shape 1, not written independently.

## 2. Decision

### 2.1 Where the fact lives

`vet_rate_service_history.servicePeriods[]` (shape 1) is the only place a service-entry fact is decided. Each period carries `serviceStartDateSource: 'veteran' | 'code_sheet' | 'printed' | 'calculated' | null` — authoritative provenance for that period's own effective start date. `serviceStartDateDerived` is now computed from it (`derived = (source === 'calculated')`), never merged as an independent fact. Each period also carries a corrections layer, `startDateCorrection: {via, correctedAt, documentDate, documentSource} | null` — `serviceStartDate` is always the effective date; `documentDate` (the best date any document has ever stated for this period) is never discarded, so a revert or a later disagreement always has something real to point at. `userEdited` is only the whole-period ingest lock; it is never read as date provenance again.

### 2.2 Precedence

Within one enlistment: **veteran > code_sheet > printed > calculated**. Ingest can never produce `'veteran'`, and never changes the effective start of a `'veteran'` period — it only refreshes `documentDate`/`documentSource` and records a deduplicated conflict when a printed/code-sheet document actively disagrees with the veteran's own correction.

Across different enlistments (no shared document, no shared end date): the earliest enlistment's best start wins, marked `'calculated'` when it is — a calculated NGB-22 start can only run _late_, never early, so a real, later-printed enlistment can never actually be "earlier" than a calculated guess (`_compareEnlistmentGroups`, the "chronological" variant — see DR-1 below).

### 2.3 Identity

In order: an exact `(serviceStartDate, serviceEndDate)` key; a same-document + same-end-date match (stable filenames only, non-window periods only, exactly one match); a correction alias (matching a period's `startDateCorrection.documentDate` against the incoming key); the existing 7-day tolerance. No filename-only identity is added anywhere — two different files sharing a name must never merge.

### 2.4 One write API

`setServiceEntryDate` (`veteranProfile.js`) is the one path every editor and every corrected import routes through. `updateServicePeriod`/`addServicePeriod` use the same corrections layer (`_applyStartCorrection`). `saveVeteranProfile` is a chokepoint: while a period backs the entry, it replaces any payload values for the flat start-date fields with the projection, regardless of what a stale caller supplies (closing D12-3 structurally, not just at the one call site that first exposed it). A static boundary test (`src/__tests__/serviceEntryWriteBoundary.test.js`) enforces this at review time — no ESLint rule, no runtime warning.

### 2.5 Projections

`saveServiceHistory` projects the resolved entry into the flat profile mirror and into `dd214Data.entryDate`/`entryDateDerived`. The VKB's service-entry subset (top-level fields, linked/folded period rows, entry timeline events) is projected by `projectServiceEntryIntoVkb`, applied at read time (`loadVKB`) and write time (`saveVKB`), so every existing VKB writer converges storage without a new asynchronous writer, a commit engine, or a journal. Rows that exist only in the VKB (never linked to a canonical period) are preserved untouched. The projection fails open on error.

### 2.6 No loss

Every value that would otherwise be overwritten survives as one of: a period's own `serviceStartDate`; a `startDateCorrection.documentDate`; an entry in the entry period's `fieldConflicts`; or, on the VKB side only, `serviceHistory.preProjectionSnapshot` (written once, on the first real change, never read back by anything — a pure audit trail). `pendingProfileConflicts` is never used as a sink for this feature.

### 2.7 Migration

`SERVICE_HISTORY_SCHEMA_VERSION` goes to 3. Each step is gated on its own prior version (`v<1`, `v<2`, `v<3`) so a history already past a given repair never re-runs it. The v3 steps infer provenance for data older than `serviceStartDateSource` (`_inferStartDateProvenance`), then fold the legacy D12-2 duplicate-period pairs a pre-fix >7-day correction left behind (`_mergeReviewCorrectionDuplicates`). A save from outside a full read/migration cycle stores `schemaVersion: 2`, not the current version, so the next read still runs the missed steps. All date comparisons in migration, adoption, and projection use calendar-day equality (`isSameCalendarDay`/`parseExplicitDate`), never raw string comparison — dd214Data/VKB dates can be `MM/DD/YYYY` while canonical dates are ISO. The VKB's own one-time legacy adoption is guarded by `metadata.migratedServiceEntryProjection`.

### 2.8 Shape 3

The VA API (shape 3, ADR-002) never flows into shape 1: no adoption, no conflict entry. A VA.gov-API-sourced VKB value is recognized by `serviceHistory.source === 'VA.gov API'` and is neither adopted nor recorded when the one-time legacy-edit adoption runs.

## 3. Decision recorded here (DR-1)

The cross-enlistment comparator (`_compareEnlistmentGroups`, section 2.2) is the "chronological" variant: the earliest enlistment's best start wins outright, even when calculated. Owner decision, recorded 2026-09-28: chronological is final. The competing "two-tier" variant (non-calculated beats calculated, then earliest) considered in the original draft of this ADR is not implemented and will not be; the `[DR-1]`-tagged tests pin the chronological behavior.

## 4. Consequences

Positive:

- Both AI context paths (`aiSystemPrompts.js`'s system prompt, the VKB's `generateLLMContext`), the dossier export, the Service card, the profile editor, Duty Stations, FormsHelper, the VKB viewer, and both timelines now show one date with one provenance, always.
- Re-imports are idempotent: an unedited re-import of a corrected document never reverts the correction, and never creates a duplicate period.
- The provenance label (`serviceStartDateSource`) is now reliable — no more inferring "veteran-corrected" from an unrelated field edit's `userEdited` flag (ADR-005's own flagged unreliability, closed here).

Visible behavior changes:

- The cross-enlistment rule (DR-1, above).
- Unchecking "Save to Knowledge Base" in the Muster Call review modal no longer keeps a correction out of the VKB — the VKB is a projection now, not an independently-editable store, so a correction that reaches shape 1 always reaches its VKB projection too (DR-2, accepted).
- DD214Analyzer creates a canonical period for a single DD-214 with both dates, rather than only ever writing the legacy flat/`dd214Data` fields (DR-3, accepted).
- A printed DD-214 start within 7 days of a calculated start now replaces it (unchanged from ADR-005, restated here since it's part of the same precedence machinery).
- The VKB's AI context lists veteran-entered periods, plus one entry timeline event per enlistment-level period (never a Box-18 window).

Costs:

- Every `loadVKB`/`saveVKB` call now reads shape 1 once, through a cached dynamic `import()` (`veteranKnowledgeBase.js` → `serviceEntryView.js`), to avoid the load-time cycle `veteranProfile.js`'s own static VKB import already creates. Vite may warn that the module is imported both statically and dynamically; harmless.
- `saveVeteranProfile` silently ignores a caller's attempt to write the start-date fields directly while a period backs the entry — enforced by the boundary test and this ADR, not a runtime warning nobody reads.

Risks:

- Provenance on migrated (pre-`serviceStartDateSource`) data is inferred, not recorded firsthand — the `via` values (`legacy_edit`, `legacy_muster_review`, `legacy_profile`, `legacy_dd214`, `legacy_vkb_viewer`) make every inferred correction auditable after the fact.
- `fieldConflicts` is capped at 20 entries per period (unchanged, pre-existing cap) — a fixture that would exceed it is out of scope for this pass.
- Downgrading to a pre-ADR-007 build keeps the effective `serviceStartDate`/`serviceStartDateDerived` (still consistent) but drops `serviceStartDateSource`/`startDateCorrection` on the next save under the old sanitizer's whitelist — the correction _metadata_ is lost, the effective date is not.
- A profile restored from backup without its matching service history keeps a stale flat mirror until the next save of the history runs the projection — every live consumer reads the canonical store (or FormsHelper's own overlay) in the meantime, so this is a display staleness window, not a data-loss risk.

## 5. Alternatives considered

- **Status quo (ADR-004 + ADR-005):** one selector per shape plus read-time overrides. QA final12 showed this fails structurally (D12-1 through D12-10) — a correction made through one editor has no path to the other three stores without either a shared write API or a projection, and read-time overrides can only ever patch one symptom at a time.
- **Corrections-overlay with a filename-only period key** (a competing design considered alongside this one): rejected because it matches on filename identity _before_ dates, which collapses two different documents that happen to share a name into one period; it would misclassify main-branch VKB rows as Box-18 windows whenever `serviceStartDateDerived` happened to be absent (main-era VKBs never set that flag at all); and it left two independent resolvers inside the VKB viewer that could still diverge from each other.
- **A single write service with a commit engine, journal, and whole-VKB compensating writes** (a third competing design): rejected because its compensating `saveVKB(vkb0)` whole-object write reopens the exact lost-update race this ADR is trying to close; it made editors fail visibly when IndexedDB is slow (a UX regression with no equivalent problem to justify it); and it touches roughly 20 files for a journal and a bespoke ESLint rule this codebase doesn't otherwise use. Ideas grafted from it into the winning design: the link-and-fold period-matching algorithm, `getServiceEntryForDocument()`, and the write-boundary test itself (in the `readFileSync`-scan style already established by `s6Cleanup.test.js`, not a new lint rule).

Both judges scored this design (the "one-store" design) highest on correctness and data-safety (15/16 and 15/16, combined 30 vs. 27 for write-through and 17 for corrections-overlay) with no tie-break needed.

## 6. Amendments to earlier ADRs

**ADR-002** (amended, header note added: "Amended by ADR-007 (2026-09-27)"): the storage table is corrected — shape 2 lives in IndexedDB `VetRateVKB/knowledge_base`; the localStorage key `vetrate_knowledge_base` is only a metadata cache and legacy data, not shape 2 itself. "Do not make one shape read from another" is narrowed: only the _service-entry subset_ of shape 2 is now a projection of shape 1. Shape 2's other facts, `generateLLMContext` as the only flattener, and the shape-3 rules are all unchanged.

**ADR-004** (status: Accepted; superseded in part by ADR-007): superseded — "one selector applied once per storage shape" (now one authoritative store, shape 2 projected); "the selector does not re-resolve conflicting sources" (it now does, via `_mergeIncomingStart`'s precedence); VKBViewer writing through to its own period (it is a projection now, never an editor); "legacy fields left in place, unread" (they are now active projections, not dead mirrors); `autoPopulateProfile` owning the flat field (the projection/chokepoint owns it once a period exists). Still in force, unchanged: pairing `serviceStartDateDerived` with its date, and excluding Box-18 windows from entry-date candidacy.

**ADR-005** (status: Accepted; superseded in part by ADR-007): superseded — the same-source bypass and `_profileOverridesDerivedEntry` (both folded into `_mergeIncomingStart`/`getServiceEntry`'s new logic); the guard in `_syncFlatServiceStartDateMirror` (that function is deleted — the chokepoint and the projection now own this entirely); the tolerance edit in VKBViewer (VKBViewer no longer edits `servicePeriods[]` at all); the cross-period two-tier rule (superseded — DR-1 resolved chronological). Each of ADR-005's open issues is closed with a pointer: code sheets reaching the profile/timeline → the projection; the stale Save Profile → the chokepoint (`_saveProfileTab`'s `EXCLUDED_FROM_SOURCE_TRACKING`); the `ProfileImportConfirmModal.jsx` flag → the canonical period plus `serviceStartDateEdited` metadata; disagreement between the stores → the projection; three-tier precedence → section 2.2 above; an unreliable `source` label → `serviceStartDateSource`; the ADR numbering collision → already resolved in commit `89bbccb7`.

## 7. Verification

One named test per defect and review finding (D12-1 through D12-10, the 9 review findings, and judge gaps G1–G13) plus: property tests for projection idempotence and import-order independence; the migration conservation test; the write-boundary test (a static scan, not a dataflow guarantee — see its own file-level comment); and Vera's manual replay of QA final12 on synthetic data.

`serviceEntryConsistency.integration.test.js` exercises 14 consumers agreeing after a correction, but is weaker than an earlier draft of this section claimed: it mocks `musterCallProcessor` entirely, so its "re-import" steps call `upsertServicePeriod`/`persistVerifiedDocument` directly rather than the real `persistFormationDocument`/`autoPopulateProfile` ingest path, and it omits several spec-named scenarios (Box-18 windows, the code-sheet dedup step, the printed-DD-214-enlistment case, `_saveProfileTab`'s stale-state path). A separate, ad hoc real-ingest probe (unmocked `persistFormationDocument`/`autoPopulateProfile`, per the pattern in `musterCallProcessor.persistFormationDocument.test.js`) confirmed the real path agrees with this suite's mocked one for the scenarios it covers; that probe was not committed. Closing this gap for real - un-mocking `musterCallProcessor` in the committed suite and adding the missing scenarios - is tracked as follow-up, not done in this pass.

## 8. Open issues and follow-ups (not built in this pass)

- `loadVKB`'s fallback on an IndexedDB read error can return a fresh/metadata-only VKB that a caller then saves over real data (pre-existing, `veteranKnowledgeBase.js:501-523`). Candidate fix: a dedicated `loadVKBForWrite`.
- `vaDataPersistence.js:123`'s dormant shape-3-to-shape-2 `entryDate` fill still violates ADR-002; flagged, not touched (out of file ownership for this pass).
- `IntelligenceBriefing.jsx`'s batch "Service Start" edits still reach only the orphaned key and `mergeMusterCallIntoVKB` — that component is untouched by this pass.
- Verify & Save for a `multiple_service_records` file never reaches the profile at all (`musterCallProcessor.js:1046` requires `type === 'service_record'`); the correction path returns `'no_period_for_document'` plus a warning toast in that case, which is the honest result, not a fix.
- An end-date correction more than 7 days away still creates a new period (unchanged scope — this pass is start-date only).
- The pre-existing VKB lost-update race in batch mode is unchanged; readers remain correct through the read-time projection overlay regardless.
- Legacy DD214Analyzer-only histories that predate any canonical period are not retroactively recovered into one; the legacy fallback in `getServiceEntry()` keeps working for them.
- A code sheet (or any later document) merging onto an already-corrected period can still overwrite that period's own `formType`/`sourceDocument` through the generic confidence-based field merge, which can flip a Guard enlistment's projected timeline event from `guard_enlistment` to `service_entry`. Fixed in this same pass: the packet AI context's "this document shows X" note, which used to read the shared, since-overwritten `startDateCorrection.documentDate` instead of the specific document's own extracted value. Not fixed: `formType`/`sourceDocument` themselves still follow the shared confidence-based merge; carving them out is a wider change to core merge precedence, left open.
- `serviceEntryConsistency.integration.test.js`'s real-ingest gap (§7 above) is open, not closed.

## 9. Post-review fixes (QA re-review, 2026-09-27)

A second QA pass against this branch's HEAD found six real defects this ADR's own design missed, all fixed with a regression test in the same commit:

- `removeServicePeriod` saved with no `supersededValue`, so deleting a period could resurrect its own just-deleted date as a veteran correction (or a spurious conflict) on whichever period the entry resolved to next. Fixed by computing the pre-removal entry and passing it through, the same guard `updateServicePeriod` already used.
- `setServiceEntryDate` had no way to force flat mode: an editor with no `periodId` always fell back to the current entry period. DD214Analyzer's import-modal edit (no period created for a multi-DD-214 import) silently retargeted an unrelated existing enlistment. Fixed with an explicit `noPeriod` option.
- `_sameEnlistmentGroup` (`serviceEntryDate.js`) required a shared document _and_ a shared end date, not the "either" this ADR's own §2.2 text describes; a code sheet or second DD-214 filed under a different name, whose start fell outside identity-matching's tolerance, silently outranked an existing veteran correction via the DR-1 cross-enlistment comparator. Fixed to match §2.2 as written.
- `_resolveServiceEntryTarget`'s `sourceDocument` branch required the period's _current_ effective start to match the caller's `documentStartDate`, so a review-modal correction was refused once a later, higher-ranked document had moved that start away from what the reviewed document itself printed - even though (filename, end date) alone already proves the period per §2.3. Fixed to resolve by end date first.
- `saveVkbViewerEdits` never checked `saveVKB`'s result, so a quota/IndexedDB failure was reported to the caller as a success and the veteran's edits were silently discarded (a regression from base, which did check it).
- `buildVerifyAndSaveHandler`/`_displayedStartMarker` (`DocumentIntelligenceBriefing.jsx`) compared an edited value only against the document's raw extraction, never against a seeded prior correction - retyping the document's own printed value to undo a saved correction read as "no change" and was silently dropped, with the marker suppressed too.

See git history for the six commits (one per defect) and their paired tests.
