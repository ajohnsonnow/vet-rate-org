# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 11)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status  | Notes                                                                                                     |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| Baseline + test infra   | ✅      | `e287c03` restored vitest.                                                                                |
| RT-13                   | 🟡      | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                    |
| RT-15 calm restyle      | 🟡 / ⏭️ | Systemic done; long-tail ⏭️ owner visual review.                                                          |
| RT-1 egress honesty     | 🟡      | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                   |
| RT-2 evidence integrity | ✅      | AIS-01/02/03 + RT2-5.                                                                                     |
| RT-3 crisis/non-English | ✅\*    | AIS-04, AIS-05, i18n test, **RT3-4 ✅ (`83dbf7f`)**. RT3-5 (DbqFinder t()→innerHTML) folds into RT-5/XSS. |
| RT-4 injection wiring   | ⏳ NEXT | PI-01 stripUntrustedUrls central; PI-02 spotlight on doc paths.                                           |
| RT-5 XSS/CSP            | ⏳      | incl. RT3-5 (DbqFinder t()→innerHTML).                                                                    |
| RT-6..RT-12             | ⏳      |                                                                                                           |
| RT-14 brand enrichment  | ⏳      | After RT-15 review.                                                                                       |

---

## Done (newest first)

- `83dbf7f` RT3-4 — flag non-Latin text on cloud egress (locale-aware PII gap) + 4 tests.
- `dcda6eb` RT-3 i18n safety-key test · `623353c` AIS-05 · `ca4b118` AIS-04.
- `b0cbf8e` RT2-5 · `166d01f` AIS-03 · `5f803b2` AIS-02 · `195eaba` AIS-01.
- `c9e310d` RT1-6 · `2252992` RT1-1 · `7023029` RT1-2 · `e287c03` vitest · `6a88014`/`bd5ebed` RT-15 · `97d9675` RT13-6 · `005affc` WIP · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/\*.html (privacy/terms), AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats. Commit only explicit paths (never `git add -A`); route around; if history diverges STOP, never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (parallel edits).
- 🚩 RT1-1 key rotation · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (not mine).
- 📋 Crisis-pattern follow-up (bare "suicide attempt"/"self-harm"); i18n English-fallback note.

## Notes for next chunk

- **RT-4 PI-01**: in `unifiedAIService.js` apply `stripUntrustedUrls` (sanitize.js:179) to the model output text before `generateAI`/`generateAIInternal` returns it, with an opt-out for JSON-only/internal calls (e.g. `options.expectJSON` or a new `skipUrlStrip`). Add an integration test that drives the real return path with a mocked engine emitting an attacker URL and asserts it is stripped. Confirm the return shape stays consistent (text/mode/agent/hallucinationReport).
- **RT-4 PI-02**: wrap OCR/document text in `untrustedSection(label, text)` or `scrubAndSpotlight()` (aiSystemPrompts.js / piiScrubber.js exports) at `cfileAnalyzer.js` (the `--- BEGIN C-FILE TEXT ---` builder ~1686) and `musterCallProcessor.js:155` so the `<untrusted_content>` delimiters the BASE_SYSTEM_PROMPT relies on are actually present.
- Verify with individual `npx vitest run`, not full suite.
