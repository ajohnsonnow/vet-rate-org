# Vet-Rate.org — C-File Audit Improvement Plan

> **Source audit:** `audit/2026-06-cfile/AUDIT-REPORT.md`  
> **Session date:** 2026-06-08  
> **Purpose:** Forward-looking, executable plan for everything not fixed in the audit session. Every item includes severity, veteran-impact rationale, affected files, and a proposed sprint.  
> **PII-free:** No real veteran data in this document.

---

## Theme 1 — Correctness & Compensation Completeness

### IP-1.1 — TDIU ("Individual Unemployability") is uncalculated

**Severity:** HIGH  
**Veteran impact:** Johnson at 80% combined with PTSD is a textbook TDIU candidate under 38 CFR § 4.16(a) (single disability 60%+ or combined 70%+ with one 40%+). A veteran who qualifies can receive 100% compensation ($3,938/mo) but is currently shown 80% ($2,358/mo) — a $1,580/month gap. The app produces no "you may qualify for TDIU" banner, meaning veterans may not know to file.  
**Affected files:** `src/utils/ratingCalculator.js`, `src/components/TacticalCalculator.jsx`, `src/components/TDIUBuilder.jsx`  
**Proposed sprint:** S-IP-1 (Compensation Completeness)  
**Implementation:** Add a `checkTDIUEligibility(conditions)` function that tests both 38 CFR § 4.16(a) criteria. When eligible, surface a `TDIUEligibilityBanner` inside the Tactical Calculator output. The full TDIU Builder tool already exists — just link to it from the banner.

### IP-1.2 — SMC (Special Monthly Compensation) is uncalculated

**Severity:** HIGH  
**Veteran impact:** Veterans with loss/loss-of-use of specific body parts, aided by another person, or housebound qualify for SMC (38 CFR § 3.350 / 38 U.S.C. § 1114 K–T). These supplements can add $100–$9,000/month. The app does not calculate, detect, or flag any SMC rate.  
**Affected files:** `src/utils/ratingCalculator.js`, `src/utils/vaCalculator.js`, `src/components/MillionDollarDashboard.jsx`  
**Proposed sprint:** S-IP-1  
**Implementation:** At minimum, add a "SMC: this calculator does not compute SMC — speak with a VSO if you have loss-of-use, housebound status, or need regular aid and attendance." banner. Full calculation is complex; a banner prevents under-claiming while full implementation is scoped.

### IP-1.3 — CRSC / CRDP (Combat-Related / Concurrent Retirement) not addressed

**Severity:** MEDIUM  
**Veteran impact:** Retired veterans may be eligible for CRSC (combat-related) or CRDP (concurrent retirement) — each can restore thousands in retirement pay offset. Neither is mentioned in the calculator output or the Million Dollar Dashboard.  
**Affected files:** `src/components/MillionDollarDashboard.jsx`  
**Proposed sprint:** S-IP-1  
**Implementation:** Add a CRSC/CRDP eligibility check card to the Million Dollar Dashboard: "Are you a military retiree? You may also qualify for CRSC or CRDP — these are NOT included in the above calculation."

### IP-1.4 — DC 8620 ratingCriteria.ratings is empty

**Severity:** LOW  
**Veteran impact:** Veterans with sciatic nerve neuritis (DC 8620) see no percentage breakdown in the app — they cannot understand what their rating means or what they'd need to prove for a higher rating.  
**Affected files:** `src/data/disabilityData.json`  
**Proposed sprint:** S-IP-2 (Data Refresh)  
**Implementation:** Populate `ratingCriteria.ratings` for DC 8620 from § 4.124a: 10% mild incomplete, 20% moderate incomplete, 40% moderately severe, 60% severe with marked muscle wasting, 80% complete paralysis equivalent.

---

## Theme 2 — Ingestion & Data Pipeline

### IP-2.1 — disabilityData.json manual refresh cycle

**Severity:** MEDIUM  
**Veteran impact:** `lastVerifiedDate: 2026-01-18` on all entries. VA modifies the rating schedule via Final Rules in the Federal Register; stale criteria can cause veterans to misjudge their rating tier.  
**Affected files:** `scripts/scrapers/va_data_pipeline.py`, `src/data/disabilityData.json`  
**Proposed sprint:** S-IP-2  
**Implementation:** Automate a quarterly refresh job: `va_data_pipeline.py` → diff against current file → PR with diff for human review. Update `lastVerifiedDate` on changed entries. Add a `dataFreshnessWarning` banner in the app when `lastVerifiedDate` is > 120 days old.

### IP-2.2 — secondary_conditions_db.json has no verified citations

**Severity:** MEDIUM  
**Veteran impact:** The nexus theory entries contain plausible regulatory language but no specific study citations. AI-generated output fills this gap but is unverified.  
**Affected files:** `src/data/secondary_conditions_db.json`  
**Proposed sprint:** S-IP-2  
**Implementation:** For each condition's top 3 secondaries, add at least one specific citation (PubMed PMID + DOI) verified by a human reviewer. Add a `citation_verified: true/false` flag per entry so the UI can distinguish static-verified from AI-generated content.

### IP-2.3 — Packet import is full-overwrite with no migration

**Severity:** MEDIUM  
**Veteran impact:** Importing a backup packet silently overwrites all existing data — no merge, no delta preview, no rollback. A veteran who accidentally imports an old backup loses current work with no recovery path.  
**Affected files:** `src/utils/dataBackup.js`, `src/utils/packetBackup.js`, `src/components/BackupManager.jsx`  
**Proposed sprint:** S-IP-3 (Data Management)  
**Implementation:** Add a diff-preview modal before import: show add/remove/change counts. Offer "Replace all" vs "Merge (keep newer)" vs "Cancel". Write the previous state to IndexedDB as a restore point before overwriting.

### IP-2.4 — IndexedDB quota / eviction not handled

**Severity:** LOW  
**Veteran impact:** On low-storage devices or private-browsing contexts, IndexedDB writes silently fail — claim data is lost. The app has no user-facing warning.  
**Affected files:** `src/utils/claimsStorage.js`, `src/utils/bugReportStorage.js`  
**Proposed sprint:** S-IP-3  
**Implementation:** Wrap all IndexedDB writes in a `StorageQuotaGuard` that calls `navigator.storage.estimate()`. If remaining quota < 5 MB, show a persistent `StorageWarningBanner`. On `QuotaExceededError`, degrade gracefully to localStorage with an explicit user warning.

---

## Theme 3 — Privacy & Security

### IP-3.1 — Console log PII vector not systematically addressed

**Severity:** MEDIUM  
**Veteran impact:** `initializeErrorCapture()` intercepts `console.error` and `console.warn` without keyword filtering. If any future code path logs a value that includes a VA file number or SSN through these channels, it would be captured in sessionStorage and potentially sent to formsubmit.co.  
**Affected files:** `src/utils/bugReportUtils.js` (lines 657–678), `src/utils/piiScrubber.js`  
**Proposed sprint:** S-IP-4 (Security Hardening)  
**Implementation:** Add `scrubPII()` to the `logConsoleError` path so all captured console messages are scrubbed at capture time, not just at send time. This eliminates the vector at the source.

### IP-3.2 — ClaimNavigator + DenialDecoder lack focus trap

**Severity:** MEDIUM  
**Veteran impact (a11y):** Both components now have `role="dialog"` but without `aria-modal="true"` and a focus trap, keyboard and screen reader users can tab outside the dialog to background content.  
**Affected files:** `src/components/ClaimNavigator.jsx`, `src/components/DenialDecoder.jsx`, `src/utils/useFocusTrap.js`  
**Proposed sprint:** S-IP-5 (Accessibility)  
**Implementation:** Apply `useFocusTrap(containerRef)` to each component's main container ref. After confirming focus is trapped, promote each to `aria-modal="true"`. Add both to the axe spec surface.

### IP-3.3 — Gemini API key stored in localStorage without encryption

**Severity:** LOW  
**Veteran impact:** A Gemini key stored in `localStorage` is visible to any browser extension or XSS attack. For a BYOK application, this is acceptable but warrants disclosure.  
**Affected files:** `src/components/AICommandCenter.jsx` (GEMINI_KEY_STORAGE), Privacy Policy  
**Proposed sprint:** S-IP-4  
**Implementation:** Add a disclosure to the Gemini key input UI: "Your API key is stored locally in this browser. Do not use this app on shared or untrusted computers." Consider `sessionStorage` as an alternative (cleared on tab close).

---

## Theme 4 — Domain Accuracy

### IP-4.1 — Legal RAG index covers Part 4 only

**Severity:** HIGH  
**Veteran impact:** eval:rag misses questions about § 4.25 (combined ratings), § 4.14 (pyramiding), and dental schedules because the retriever only has Part 4 content. Veterans asking about benefit entitlement (Part 3), appeals (Parts 19/20), M21-1 adjudication, or CAVC case law get no citations.  
**Affected files:** `scripts/legal-ingestion/`, RAG index  
**Proposed sprint:** S-IP-6 (Legal Coverage)  
**Implementation:** Ingest 38 CFR Parts 3 (Service Connection, Effective Dates), 19/20 (BVA appeals), and a curated M21-1 subset. Add at least 10 eval queries covering Part 3 and appeals. Target recall@5 ≥ 0.92.

### IP-4.2 — eCFR criteria for 5276 and 5252 unverified this session

**Severity:** LOW  
**Veteran impact:** The app data looks reasonable based on known VA schedules, but eCFR fetch failed — cannot confirm current criteria.  
**Affected files:** `src/data/disabilityData.json`  
**Proposed sprint:** S-IP-2  
**Implementation:** Manual verification against live eCFR § 4.71a for DC 5276 (acquired flatfoot) and DC 5252 (thigh flexion). Update `lastVerifiedDate` and add any missing ratings.

### IP-4.3 — AI nexus brief explainability missing

**Severity:** MEDIUM  
**Veteran impact:** Risk Assessment, Remand Risk Checker, Appeals Lane Advisor, and Nexus Quality Analyzer produce scores/recommendations but do not surface the top 2–3 contributing factors. Veterans and their physicians cannot evaluate or challenge AI reasoning.  
**Affected files:** `src/components/RiskAssessment.jsx`, `src/components/RemandRiskChecker.jsx`, `src/components/AppealsLaneAdvisor.jsx`, `src/components/NexusBuilder.jsx`, AI prompt files  
**Proposed sprint:** S-IP-6  
**Implementation:** Extend AI output schema to include `top_factors: [{factor, weight, direction}]`. Render a collapsible "Why this score?" section in each component. This is feature work — do not rush; get the output schema right first.

---

## Theme 5 — Accessibility

### IP-5.1 — Axe spec covers only 20/48 tool surfaces

**Severity:** MEDIUM  
**Veteran impact:** 28 tools have no automated a11y gating. Regressions in those tools could reach users undetected.  
**Affected files:** `tests/e2e/axe.spec.ts`  
**Proposed sprint:** S-IP-5  
**Implementation:** Expand the `surfaces` array in `axe.spec.ts` to include all 45 tools that render a `role="dialog"`. The 3 non-rendering tools (ClaimNavigator, DenialDecoder, NexusBuilder) need custom scan logic after their ARIA gaps are fully fixed.

### IP-5.2 — Firefox Tab focus test failure

**Severity:** LOW  
**Veteran impact:** Firefox keyboard navigation test fails because `ResponsiveModal`'s scroll region has `tabIndex={0}` (required to satisfy `scrollable-region-focusable` rule) but the `accessibility.spec.ts:10` test's expected element list doesn't include `"DIV"`.  
**Affected files:** `tests/e2e/accessibility.spec.ts`, `src/components/common/ResponsiveModal.jsx`  
**Proposed sprint:** S-IP-5  
**Implementation:** Update test to expect `"DIV"` in the Tab cycle. Add a comment explaining the `tabIndex={0}` is intentional for axe compliance.

### IP-5.3 — mobile-chrome axe home-page violation

**Severity:** LOW  
**Affected files:** `tests/e2e/axe.spec.ts`, home page  
**Proposed sprint:** S-IP-5  
**Implementation:** Investigate the specific axe finding on the home page in mobile-chrome viewport. Likely a color-contrast or landmark role issue introduced by viewport-specific CSS.

---

## Theme 6 — Tech Debt

### IP-6.1 — App.jsx is 3,600+ LOC with 66 useState hooks

**Severity:** MEDIUM  
**Veteran impact (indirect):** Monolithic component slows reviewer confidence, increases regression risk, and makes it harder to test individual surfaces in isolation.  
**Affected files:** `src/App.jsx`  
**Proposed sprint:** S-IP-7 (Architecture)  
**Implementation:** Continue the cluster extraction pattern established in this audit (ClaimPrepCluster, DecisionToolsCluster, etc.). Extract remaining tool clusters: QC tools, Maximize tools, Appeals tools. Each extraction is a safe atomic refactor — no behavior change.

### IP-6.2 — console.log proliferation (no structured logger)

**Severity:** LOW  
**Affected files:** ~40 files throughout `src/`  
**Proposed sprint:** S-IP-7  
**Implementation:** Replace `console.log/warn/error` with a structured logger (`src/utils/logger.js`) that respects `NODE_ENV` and `VITE_LOG_LEVEL`. This also lets the `initializeErrorCapture` noise filter be removed — the logger itself controls what's captured.

### IP-6.3 — 40 semgrep info findings not reviewed

**Severity:** LOW  
**Affected files:** Various  
**Proposed sprint:** S-IP-4  
**Implementation:** Run `semgrep --config .semgrep.yml` and triage all 40 info-level findings. Promote any true positives to warnings; suppress confirmed false positives with `nosemgrep` comments.

### IP-6.4 — ADR for calculator reconciliation not written

**Severity:** LOW  
**Affected files:** `audit/decisions/` (to be created)  
**Proposed sprint:** S-IP-7  
**Implementation:** Write ADR-001 documenting the `ratingCalculator.js` vs `vaCalculator.js` reconciliation decision (both kept, bilateral fix applied to `ratingCalculator`, ground-truth test pinned). This satisfies Commandment 8 ("Document decisions — not code; the *why*").

---

## Theme 7 — UX / Feature Gaps

### IP-7.1 — No AI offline fallback for text tools

**Severity:** MEDIUM  
**Veteran impact:** If a veteran is offline, has no Gemini key, and local models fail to load, text-enhancement tools silently fail with a generic error. Veterans in low-connectivity environments (VA waiting rooms, rural areas) have no degraded path.  
**Affected files:** `src/utils/unifiedAIService.js`, text-tool components  
**Proposed sprint:** S-IP-8 (Offline / Resilience)  
**Implementation:** Add a graceful fallback: when `isAnyAIAvailable()` is false, switch to rule-based text templates for statement enhancement and display a clear "AI features unavailable — using simplified mode" indicator. Template-based fallback is better than silence.

### IP-7.2 — Packet export/backup has no version migration

**Severity:** LOW  
**Veteran impact:** A packet exported at v1.x cannot be imported cleanly into a v2.x app if the schema changes. There is no migration layer.  
**Affected files:** `src/utils/dataBackup.js`, `src/utils/packetBackup.js`  
**Proposed sprint:** S-IP-3  
**Implementation:** Add a `migratePacket(packet)` function that handles known version transitions. Call it at import time before validation. Test with the v2.0 fixture and a synthetic v1.x packet.

---

## Things We Overlooked

1. **`App.jsx` cluster extraction is incomplete.** The audit extracted ClaimPrepCluster, DecisionToolsCluster, and VKBTimelineModal. The QC, Maximize, and Appeals clusters remain in App.jsx.

2. **`ratingPercent` vs `selectedRating` field-name divergence** was fixed in Sprint 2 (`96eb6b9`), but the ingest script may still emit other non-standard field names. A `validatePacketSchema()` function with Zod/Ajv would catch these at import time.

3. **No Renovate or Dependabot configured.** Commandment 7 ("Keep dependencies updated — weekly cadence"). The `npm audit` is clean today but a scheduled dep-update bot would catch future CVEs automatically.

4. **No ADR directory.** Decisions made during this audit (calculator reconciliation, bilateral fix, BYOK Gemini stance, noop-DOMPurify strategy) are documented in commit messages but not in a queryable `docs/decisions/` directory.

5. **`LanguageContext.jsx` is 500KB+ (Babel deoptimization warning).** This is the root cause of the React error #418 noise in the tool-matrix spec. Splitting the file into per-language modules would fix the Babel deopt and likely improve cold-start time.

6. **No automated screenshot regression.** The audit confirmed modal rendering via `role="dialog"` detection but not visual correctness. A Percy/Chromatic integration would catch CSS regressions.

---

## Best Practices to Incorporate

| Practice | Commandment | Status | Action |
|---|---|---|---|
| ADRs for architecture decisions | #8 | Not started | Write ADR-001 (calc reconciliation) as a template; establish `docs/decisions/` |
| Test-first for new compensation logic | #4 | Partial | Ground-truth tests added (S2); extend to TDIU, SMC, CRSC before implementation |
| Renovate for weekly dep updates | #7 | Not configured | Add `.renovaterc.json` targeting `patch` auto-merge, `minor` PR-only |
| WCAG 2.2 AA on all new surfaces | #9 | Partial | Axe spec covers 20/48; expand per IP-5.1 |
| Structured logging | — | Not started | Per IP-6.2 |
| Quarterly eCFR sync | — | Not automated | Per IP-2.1 |

---

## Proposed Sprint Sequence

| Sprint | Theme | Key deliverables |
|---|---|---|
| S-IP-1 | Compensation Completeness | TDIU banner, SMC "not supported" banner, CRSC/CRDP card |
| S-IP-2 | Data Refresh | DC 8620 data fill, 5276/5252 eCFR verify, secondary citations, automated refresh job |
| S-IP-3 | Data Management | Import merge/delta preview, restore point, quota guard |
| S-IP-4 | Security Hardening | Console-log PII scrub at capture, semgrep triage, Gemini key disclosure |
| S-IP-5 | Accessibility | Focus trap for ClaimNavigator + DenialDecoder, axe spec expansion, Firefox fix |
| S-IP-6 | Legal & Domain | RAG corpus expansion (Parts 3/19/20 + M21-1), AI explainability |
| S-IP-7 | Architecture | App.jsx cluster completion, structured logger, ADR-001, Renovate |
| S-IP-8 | Offline / Resilience | AI offline fallback, packet version migration |

---

*Generated 2026-06-08 from C-File audit session. All items are non-PII.*
