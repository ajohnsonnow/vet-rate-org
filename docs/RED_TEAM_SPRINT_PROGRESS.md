# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 9)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status      | Notes                                                                                                               |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Baseline + test infra   | ✅          | `e287c03` restored vitest.                                                                                          |
| RT-13                   | 🟡          | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                              |
| RT-15 calm restyle      | 🟡 / ⏭️     | Systemic done; long-tail ⏭️ owner visual review.                                                                    |
| RT-1 egress honesty     | 🟡          | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                             |
| RT-2 evidence integrity | ✅          | AIS-01/02/03 + RT2-5.                                                                                               |
| RT-3 crisis/non-English | 🟡          | **AIS-04 ✅ (`ca4b118`), AIS-05 ✅ (`623353c`).** Next: i18n safety-key CI test, locale-aware PII scrubber (RT3-4). |
| RT-4 injection wiring   | ⏳ NEXT-ish | After RT-3 closeout.                                                                                                |
| RT-5..RT-12             | ⏳          |                                                                                                                     |
| RT-14 brand enrichment  | ⏳          | After RT-15 review.                                                                                                 |

---

## Done (newest first)

- `623353c` AIS-05 — non-blocking passive crisis-resources banner on uploaded C-file/health-record analysis (5 sites) + 2 tests.
- `ca4b118` AIS-04 — obfuscation/slang/multilingual crisis detection + 6 tests.
- `b0cbf8e` RT2-5 export banners · `166d01f` AIS-03 · `5f803b2` AIS-02 · `195eaba` AIS-01.
- `c9e310d` RT1-6 · `2252992` RT1-1 · `7023029` RT1-2 · `e287c03` vitest · `6a88014`/`bd5ebed` RT-15 · `97d9675` RT13-6 · `005affc` WIP · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/\*.html (privacy/terms), AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats. Commit only explicit paths (never `git add -A`); route around; if history diverges STOP, never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (parallel edits).
- 🚩 RT1-1 key rotation · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (not mine).
- 📋 Follow-up (noted during AIS-05): crisis patterns catch "suicidal thoughts/ideation" but NOT bare "suicide attempt" / "self-harm" / gerund "wanting to die" — consider adding to CRISIS_PATTERNS if over-trigger on live input is acceptable (owner judgment).

## Notes for next chunk

- **i18n safety-key CI test**: add a vitest (or node script wired to CI) asserting the safety-critical i18n keys are present & non-empty in every shipped locale — crisis-hotline label, medical disclaimer, the 18 U.S.C. 1001 / false-statement warning, and the non-accreditation clause. Source: `src/contexts/LanguageContext.jsx` (huge translation blob) — find the key names first. A missing key must FAIL, so a non-English veteran can't get a blanked safety string.
- Then **RT3-4 locale-aware PII scrubber**: `piiScrubber.js` is English structured-identifier regex; make it locale-aware or fall back to conservative redaction for non-Latin scripts before any cloud egress.
- Then **RT-4** (prompt-injection wiring): call `stripUntrustedUrls` centrally in `unifiedAIService.generateAI` before output reaches the DOM (PI-01); wrap OCR/document text in spotlight delimiters on the real call sites (PI-02).
- Verify with individual `npx vitest run`, not full suite.
