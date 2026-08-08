# Vet-Rate.org — C-File Audit Report

> **Version audited:** v1.23.1  
> **Audit session:** 2026-06-08  
> **Branch:** `audit/cfile-fullsweep` off `audit/s9-mobile-safety-net`  
> **Auditor:** Claude Sonnet 4.6 (Anthropic) + Anthony Johnson  
> **Source of truth:** `audit/2026-06-cfile/TEST-RESULTS.md` — this report is a synthesis; for raw evidence consult that file.  
> **PII constraint:** All real veteran data stayed at `E:\Williams_C-FIle` and was never committed. The redacted synthetic fixture (`tests/fixtures/redacted-packet.json`) uses `JOHN Q. VETERAN / 000-00-0000 / C-000-0000` with Williams's condition+rating set.

---

## 1. Harness baseline → final state

### Pre-audit baseline (v1.23.0, 2026-06-08)

| Gate                  | Status                               |
| --------------------- | ------------------------------------ |
| ESLint                | PASS (3 warnings, 0 errors)          |
| Unit tests (Vitest)   | PASS (849/849)                       |
| E2E chromium          | **FAIL** — release blocker           |
| Production build      | PASS                                 |
| Security scan (OWASP) | PASS (0 critical)                    |
| gitleaks              | PASS (0 secrets)                     |
| semgrep               | PASS (40 info)                       |
| Bundle budget         | PASS (1 pre-existing breach tracked) |
| Red-team suite        | PASS (48/48)                         |

### Final state (v1.23.1, end of session)

| Gate                | Status               | Count             |
| ------------------- | -------------------- | ----------------- |
| ESLint              | PASS                 | 0 errors          |
| Unit tests (Vitest) | PASS                 | 849/849           |
| E2E chromium        | **PASS**             | 235/235           |
| E2E firefox         | Pre-existing 2 fails | 233/235           |
| E2E mobile-chrome   | Pre-existing 1 fail  | 234/235           |
| axe (WCAG 2.2 AA)   | PASS                 | 21/21             |
| mobile CTA parity   | PASS                 | 177/177           |
| Red-team suite      | PASS                 | 48/48             |
| npm audit           | PASS                 | 0 vulnerabilities |
| gitleaks (session)  | PASS                 | 0 leaks           |
| semgrep (session)   | PASS                 | 0 findings        |

Pre-existing firefox/mobile failures are unrelated to this audit's changes (Firefox Tab focus, mobile axe home-page violation — both documented for follow-up).

---

## 2. 48-tool launch matrix

**Sprint 3 result: 45/48 tools render a `role="dialog"` on event dispatch.**

| Cluster   | Tools  | Renders | Non-renders                      |
| --------- | ------ | ------- | -------------------------------- |
| Calculate | 5      | 5       | 0                                |
| Discover  | 7      | 5       | 2 (ClaimNavigator, NexusBuilder) |
| Evidence  | 10     | 10      | 0                                |
| QC        | 8      | 7       | 1 (DenialDecoder)                |
| Maximize  | 5      | 5       | 0                                |
| Appeals   | 3      | 3       | 0                                |
| Support   | 10     | 10      | 0                                |
| **Total** | **48** | **45**  | **3**                            |

### Non-render root causes (all genuine findings, not test flaws)

| Tool            | Root cause                                                                                 | Status                                                                         |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Claim Navigator | Uses `fixed inset-0` div without `role="dialog"` — axe scan + tool-matrix cannot detect it | **ARIA fix committed** (Sprint 6, `b381472`) — tool still non-modal for matrix |
| Denial Decoder  | Custom card layout rendered without `role="dialog"` wrapper                                | **ARIA fix committed** (Sprint 6, `b381472`) — tool still non-modal for matrix |
| Nexus Builder   | Context-driven — requires condition data in app state to render                            | Open — not a bug, requires pre-seeded state                                    |

---

## 3. Williams 80% ground-truth result

**Both calculators independently produce 80% for Williams's 9-condition set.**

Step trace (38 CFR § 4.25):

| Step | Condition          | Rating | Remaining | Combined                   |
| ---- | ------------------ | ------ | --------- | -------------------------- |
| 1    | PTSD               | 50%    | 50        | 50                         |
| 2    | Lumbosacral Strain | 20%    | 50        | 60                         |
| 3    | Radiculopathy L    | 20%    | 40        | 68                         |
| 4    | Radiculopathy R    | 10%    | 32        | 71                         |
| 5    | Hip L              | 10%    | 29        | 74                         |
| 6    | Hip R              | 10%    | 26        | 77                         |
| 7    | Knee L             | 10%    | 23        | 79                         |
| 8    | Pes Planus         | 10%    | 21        | 81                         |
| 9    | Tinnitus           | 10%    | 19        | **83** → rounds to **80%** |

Bilateral factor (38 CFR § 4.26): Hip pair + Radiculopathy pair both detected.
Nearest-10 rounding: 83% → **80%**. ✓

Ground-truth test: `src/__tests__/utils/williamsGroundTruth.test.js` (15 tests, all passing).

---

## 4. Privacy egress evidence

### Summary

This is a **zero-knowledge, client-side application**. All veteran data stays in the browser.

| Vector                          | Status         | Evidence                                                               |
| ------------------------------- | -------------- | ---------------------------------------------------------------------- |
| localStorage                    | Local only     | No outbound network calls on data operations                           |
| IndexedDB                       | Local only     | Atomic Wipe confirmed it clears all databases                          |
| Bug report send (formsubmit.co) | **FIXED**      | Was hardcoded endpoint; now env-configurable; PII scrubbed before send |
| AI (local mode)                 | Zero egress    | WebGPU inference; confirmed by design                                  |
| AI (Gemini)                     | BYOK           | User supplies own API key; piiScrubber.js guards prompts               |
| Gemini default state            | Off by default | Confirmed in LanguageContext.jsx:16470                                 |

### Atomic Wipe verification

`AtomicWipe.jsx` clears: localStorage, sessionStorage, cookies, all IndexedDB databases (modern API + known-name fallback), Cache Storage, Service Workers. Full coverage confirmed.

### piiScrubber.js coverage

SSN, VA file number (C-prefix + standalone 8–9 digit), EDIPI, MRN, email, phone, DOB (labeled + unlabeled), address. Unicode NFKC normalization prevents obfuscation bypasses. `scrubAndSpotlight()` wraps output in `<untrusted_content>` delimiters for downstream LLM prompt safety.

### BugSquasher fix (Sprint 4)

The `formsubmit.co` endpoint was hardcoded in source. The fix:

1. Endpoint moved to `VITE_BUG_REPORT_ENDPOINT` env var (empty = remote send disabled)
2. `scrubPII()` applied to all 5 free-text fields + `full_report` before payload construction
3. Documented in `.env.example`

Commit: `100b78d`

### Manual verification still needed

Interactive browser test with real packet in DevTools: confirm no PII in network request bodies for both local-AI and Gemini paths. This cannot be automated without the real packet.

---

## 5. Domain accuracy spot-check

### eCFR spot-check — 7 diagnostic codes (38 CFR Part 4)

`lastVerifiedDate` in `disabilityData.json`: 2026-01-18 (5 months at session date).

| DC   | Condition                           | App ratings         | eCFR status          | Finding                                 |
| ---- | ----------------------------------- | ------------------- | -------------------- | --------------------------------------- |
| 9411 | PTSD                                | 0/10/30/50/70/100%  | ✓ Confirmed § 4.130  | MATCH                                   |
| 5242 | Degenerative arthritis/disc (spine) | 10/20/30/40/50/100% | ✓ Confirmed § 4.71a  | MATCH                                   |
| 8520 | Sciatic nerve paralysis             | 10/20/40/60/80%     | ✓ Confirmed § 4.124a | MATCH                                   |
| 8620 | Sciatic nerve neuritis              | (empty)             | ⚠ Partial            | Gap — no rating percentages in app data |
| 5276 | Flatfoot, acquired                  | 0/10/20/30/50%      | ⚠ Fetch failed       | Reasonable; unverified                  |
| 6260 | Tinnitus                            | 10% only            | ✓ Confirmed § 4.87   | MATCH                                   |
| 5252 | Thigh, limitation of flexion        | 10/20/30/40%        | ⚠ Fetch failed       | Reasonable; unverified                  |

### Secondary conditions citations

Static `secondary_conditions_db.json`: no named author/journal citations — all references are 38 CFR regulatory and general pathophysiology. No fabricated DOIs found.

AI-generated named citations (Gemini output) are unverifiable without a live prompt; guarded by: (1) nexusLogicGenerator.js prompt rule "Do not fabricate specific URLs or DOIs"; (2) NexusDisclaimerFooter citation-verification warning added in Sprint 5.

### AI nexus disclaimer fix (Sprint 5)

`NexusDisclaimerFooter.jsx` now explicitly warns: "AI-generated literature references and study types are research starting points only. They have not been independently verified and **must not be cited to the VA as established medical fact** without physician confirmation. Do not present AI output verbatim in any VA claim or medical record."

Commit: `a2af47a`

### eval:rag results

| Metric   | Score         |
| -------- | ------------- |
| recall@5 | 0.880 (22/25) |
| MRR      | 0.776         |
| NDCG@5   | 0.637         |

Coverage gap: index is 38 CFR Part 4 only. Parts 3, 19, 20, M21-1, and case law not ingested.

---

## 6. Accessibility results

### Gate results

| Suite                               | Result       | Coverage           |
| ----------------------------------- | ------------ | ------------------ |
| axe (WCAG 2.2 AA, serious/critical) | PASS 21/21   | 20 modals + splash |
| mobile CTA parity                   | PASS 177/177 | 360/414/768px      |

### ARIA fixes applied (Sprint 6)

| Component            | Fix                                                                              | Commit    |
| -------------------- | -------------------------------------------------------------------------------- | --------- |
| `ClaimNavigator.jsx` | Added `role="dialog"` + `aria-labelledby="claim-navigator-title"` + id on `<h1>` | `b381472` |
| `DenialDecoder.jsx`  | Added `role="dialog"` + `aria-labelledby="denial-decoder-title"` + id on `<h2>`  | `b381472` |

`aria-modal` deliberately omitted from both — neither has a focus trap; adding `aria-modal` without a trap misleads AT.

---

## 7. Severity-ranked findings

### CRITICAL

None.

### HIGH

| ID   | Finding                                                                                                                                                        | Status    | Commit    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| F2-1 | `ratingCalculator.js` missing `"radiculopathy"` in `bilateralPairs` — 6-condition pairs (hips, knees, radiculopathy) not detected                              | **FIXED** | `96eb6b9` |
| F2-2 | `normalizeSide()` missing — `"L Hip"`, `"R Knee"` abbreviated names not matched for bilateral detection                                                        | **FIXED** | `96eb6b9` |
| F4-1 | BugSquasher hardcoded `formsubmit.co` endpoint — any deployed build sends reports to developer email without operator control                                  | **FIXED** | `100b78d` |
| F4-2 | No PII scrub before formsubmit.co send — `full_report` contained console logs (captured without keyword filter for `console.error/warn`), user-typed free text | **FIXED** | `100b78d` |

### MEDIUM

| ID   | Finding                                                                                                                                 | Status    | Commit    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| F1-1 | `ingest-cfile.mjs` hardcoded OUTPUT_PATH with fixed filename — multiple runs on different days silently overwrote prior output          | **FIXED** | `5d07e9d` |
| F1-2 | `ratingPercent` vs `selectedRating` field-name divergence — packets from ingest script cannot round-trip through `importCompletePacket` | **FIXED** | `96eb6b9` |
| F2-3 | `RetroPayHunter.jsx` dollar amount missing from `retroPayFindings` string — My Packet / VKB entries showed month count only             | **FIXED** | `96eb6b9` |
| F3-1 | `MOSHazardMatcher.onAddToPathfinder` was a `console.log` stub — Pathfinder never opened on "Add to Pathfinder"                          | **FIXED** | `f441612` |
| F3-2 | `WebOfConditions.onSelectCondition` was a `console.log` stub — selected condition was silently dropped                                  | **FIXED** | `f441612` |
| F3-3 | `VKBTimeline.onDocumentClick` was a `console.log` stub — VKB Viewer never opened on document click                                      | **FIXED** | `f441612` |
| F5-1 | DC 8620 (`ratingCriteria.ratings`) empty — veterans see no percentage breakdown for sciatic nerve neuritis                              | Open      | —         |

### LOW

| ID   | Finding                                                                         | Status                        | Notes                                                                  |
| ---- | ------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| F3-4 | ClaimNavigator — `fixed inset-0` overlay with no ARIA role (axe cannot scan it) | **Partially fixed** `b381472` | `role="dialog"` added; focus trap + `aria-modal` remain open           |
| F3-5 | DenialDecoder — card layout without `role="dialog"` (axe cannot scan it)        | **Partially fixed** `b381472` | Same note                                                              |
| F4-3 | `getStorageInfo()` includes condition names in bug-report payload               | Accepted                      | Condition names are not PII under project definition                   |
| F4-4 | `dompurify-noop` pass-through sanitize function                                 | Accepted                      | jspdf never calls `fromHTML`; noop prevents XSS advisories in dep tree |
| F5-2 | Nexus nexus-brief citations lack explicit verification warning in UI            | **FIXED**                     | `a2af47a`                                                              |
| F6-1 | eval:rag misses: § 4.25, § 4.14, § 4.150/§ 4.149                                | Open                          | RAG index covers Part 4 only                                           |
| F6-2 | Firefox: Tab focus test fails (`"DIV"` in cycle from scroll-region `tabIndex`)  | Open                          | Pre-existing                                                           |
| F6-3 | mobile-chrome: axe home-page violation                                          | Open                          | Pre-existing                                                           |

---

## 8. FIXED this session vs OPEN

### Fixed (with commit refs)

| Commit    | Description                                                                          |
| --------- | ------------------------------------------------------------------------------------ |
| `4007b61` | E2E gate unblocked — Playwright StrictMode race in What's New                        |
| `5d07e9d` | Ingest date-stamp + redacted fixture + packet e2e spec                               |
| `96eb6b9` | Dual-calc reconciliation + bilateral fix + dollar output fix + 15 ground-truth tests |
| `f441612` | 48-tool matrix spec + 3 dead-end stubs wired (MOS, WebOfConditions, VKBTimeline)     |
| `100b78d` | BugSquasher env-configurable endpoint + PII scrub before send                        |
| `f6024bc` | Sprint 4 docs: semgrep/gitleaks clean, dompurify-noop confirmed safe                 |
| `a2af47a` | NexusDisclaimerFooter citation-verification warning + Sprint 5 eCFR tables           |
| `b381472` | ClaimNavigator + DenialDecoder `role="dialog"` + `aria-labelledby`                   |

### Open (documented for IMPROVEMENT-PLAN)

| ID        | Description                                                                    | Priority |
| --------- | ------------------------------------------------------------------------------ | -------- |
| F5-1      | DC 8620 ratingCriteria empty                                                   | LOW      |
| F3-4/F3-5 | ClaimNavigator + DenialDecoder focus trap + `aria-modal`                       | MEDIUM   |
| F6-1      | RAG coverage gap (Parts 3/19/20, M21-1, case law)                              | HIGH     |
| F6-2      | Firefox Tab cycle test                                                         | LOW      |
| F6-3      | mobile-chrome axe home-page                                                    | LOW      |
| —         | TDIU/SMC/CRSC completeness (no "not yet supported" banner)                     | HIGH     |
| —         | AI score explainability (Risk Assessment, Remand, Appeals Lane, Nexus Quality) | MEDIUM   |
| —         | Axe spec surface expansion (currently 20/48 tools gated)                       | MEDIUM   |
| —         | 5276/5252 eCFR criteria unverified (fetch failed)                              | LOW      |

---

_Report generated 2026-06-08. PII-free — no SSN, VA file number, DOB, or name from real C-file appears in this document._
