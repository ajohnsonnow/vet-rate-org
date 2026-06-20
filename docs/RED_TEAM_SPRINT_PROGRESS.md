# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 10)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status      | Notes                                                                                                                                  |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline + test infra   | ✅          | `e287c03` restored vitest.                                                                                                             |
| RT-13                   | 🟡          | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                                                 |
| RT-15 calm restyle      | 🟡 / ⏭️     | Systemic done; long-tail ⏭️ owner visual review.                                                                                       |
| RT-1 egress honesty     | 🟡          | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                                                |
| RT-2 evidence integrity | ✅          | AIS-01/02/03 + RT2-5.                                                                                                                  |
| RT-3 crisis/non-English | 🟡          | AIS-04, AIS-05, **i18n safety-key test ✅ (`dcda6eb`)**. Next: RT3-4 locale-aware PII; RT3-5 (DbqFinder t()→innerHTML, overlaps RT-5). |
| RT-4 injection wiring   | ⏳ NEXT-ish | PI-01 stripUntrustedUrls central; PI-02 spotlight on doc paths.                                                                        |
| RT-5..RT-12             | ⏳          |                                                                                                                                        |
| RT-14 brand enrichment  | ⏳          | After RT-15 review.                                                                                                                    |

---

## Done (newest first)

- `dcda6eb` RT-3 i18n safety-key test — guards crisis-line/disclaimer/non-affiliation strings against deletion/blanking across all locales (8/8).
- `623353c` AIS-05 passive doc crisis banner · `ca4b118` AIS-04 obfuscation/slang/multilingual crisis.
- `b0cbf8e` RT2-5 · `166d01f` AIS-03 · `5f803b2` AIS-02 · `195eaba` AIS-01.
- `c9e310d` RT1-6 · `2252992` RT1-1 · `7023029` RT1-2 · `e287c03` vitest · `6a88014`/`bd5ebed` RT-15 · `97d9675` RT13-6 · `005affc` WIP · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/\*.html (privacy/terms), AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats. Commit only explicit paths (never `git add -A`); route around; if history diverges STOP, never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (parallel edits).
- 🚩 RT1-1 key rotation · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (not mine).
- 📋 Crisis-pattern follow-up: bare "suicide attempt"/"self-harm"/gerund "wanting to die" not caught (owner judgment on live-input over-trigger).
- 📋 i18n note: `t()` falls back to English, so missing non-English translations degrade to English (not blank) — the audit's blank-string fear is mitigated; deletion/rename is the real risk (now tested).

## Notes for next chunk

- **RT3-4 locale-aware PII**: `piiScrubber.js` PII_PATTERNS are US-centric English (SSN/phone/email/VA-file). They cannot find PII in non-Latin (CJK/Arabic/Cyrillic) narratives, so a non-English veteran leaks more to cloud. Safe approach: detect predominant non-Latin script and, on the CLOUD egress path, apply conservative handling (stronger warning / prefer local AI), rather than over-redacting (which would break analysis). Read `piiScrubber.js` (scrubPII ~125, PII_PATTERNS ~36) + its call site in `unifiedAIService.js` (~760 cloud path) first. Keep it bounded + tested.
- **RT-4** PI-01: call `stripUntrustedUrls` (sanitize.js:179) centrally in `unifiedAIService.generateAI` before returning text (opt-out for JSON-only/internal). PI-02: wrap OCR/doc text in `untrustedSection()`/`scrubAndSpotlight()` (aiSystemPrompts.js) at `cfileAnalyzer.js:1686` + `musterCallProcessor.js:155`.
- Verify with individual `npx vitest run`, not full suite.
