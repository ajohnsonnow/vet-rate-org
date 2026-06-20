# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 8)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status  | Notes                                                                                                                                                  |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline + test infra   | ✅      | `e287c03` restored vitest.                                                                                                                             |
| RT-13                   | 🟡      | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                                                                 |
| RT-15 calm restyle      | 🟡 / ⏭️ | Systemic done; long-tail ⏭️ owner visual review.                                                                                                       |
| RT-1 egress honesty     | 🟡      | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                                                                |
| RT-2 evidence integrity | ✅      | AIS-01 (`195eaba`), AIS-02 (`5f803b2`), AIS-03 (`166d01f`), RT2-5 (`b0cbf8e`).                                                                         |
| RT-3 crisis/non-English | 🟡      | **AIS-04 ✅ (`ca4b118`)** obfuscation+slang+multilingual crisis detection + 6 tests. Next: AIS-05, i18n safety-key CI test, locale-aware PII scrubber. |
| RT-4..RT-12             | ⏳      |                                                                                                                                                        |
| RT-14 brand enrichment  | ⏳      | After RT-15 review.                                                                                                                                    |

---

## Done (newest first)

- `ca4b118` AIS-04 — crisis gate catches obfuscation (iwanttodie/w4nt), slang (kms/unalive), non-English (es/tl/vi/ko/zh/ja/ar) + 6 tests.
- `b0cbf8e` RT2-5 — page-1 18 USC 1001 banner + honest metadata on buddy PDF/DOCX exports.
- `166d01f` AIS-03 buddy attestation gate · `5f803b2` AIS-02 nexus research brief · `195eaba` AIS-01 validator.
- `c9e310d` RT1-6 egress inventory · `2252992` RT1-1 BYOK-only + dist gate · `7023029` RT1-2 feedback egress.
- `e287c03` restore vitest · `6a88014`/`bd5ebed` RT-15 systemic · `97d9675` RT13-6 · `005affc` WIP · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/\*.html (privacy/terms), AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats. Commit only explicit paths (never `git add -A`); route around; if history diverges STOP, never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (parallel edits).
- 🚩 RT1-1 key rotation · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (not mine).

## Notes for next chunk

- **AIS-05** (`BlueButtonXRay.jsx:680,731`, `cfileAnalyzer.js:1715,1921`, `musterCallProcessor.js:163`): crisis detection is fully no-op'd (`skipCrisisCheck`) on uploaded C-files/health records — the docs most likely to contain ideation history. Decouple: keep `skipCrisisCheck` for the blocking AI-egress decision, but run a NON-blocking `detectCrisisLanguage` pass over the document text and, on a hit, surface a passive crisis-resources banner (CRISIS_RESOURCES) — do not silently no-op safety.
- Then i18n safety-key CI test (assert crisis hotline / medical disclaimer / 1001 / non-accreditation keys non-empty in all locales) + locale-aware PII scrubber (RT3-4).
- Then RT-4 (prompt-injection wiring: stripUntrustedUrls central, spotlight on doc paths) and onward.
- Verify with individual `npx vitest run`, not full suite.
