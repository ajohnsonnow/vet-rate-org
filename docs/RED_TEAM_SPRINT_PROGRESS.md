# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits are **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 6)
**Verification:** `npm run build` green. **Run test files individually** (`npx vitest run <file>`) — the full 58-file `npm test` flakes under load (jsdom env setup ~300s, worse with the parallel actor). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status  | Notes                                                                                                                                            |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline + test infra   | ✅      | Plan, WIP checkpoint, vitest restored (`e287c03`).                                                                                               |
| RT-13                   | 🟡      | RT13-6 ✅ (`97d9675`). (Note: lint-staged omits `.jsx` from eslint.)                                                                             |
| RT-15 calm restyle      | 🟡 / ⏭️ | Systemic de-rainbow done (`bd5ebed`, `6a88014`). Long-tail ⏭️ owner visual review.                                                               |
| RT-1 egress honesty     | 🟡      | RT1-1 ✅ (`2252992`), RT1-2 ✅ (`7023029`), RT1-6 ✅ (`c9e310d`). RT1-3/RT1-5 🔒 parallel edits. RT1-7 pending.                                  |
| RT-2 evidence integrity | 🟡      | **AIS-01 ✅ (`195eaba`)** validator re-enabled + test. Next: AIS-02 (nexusLogicGenerator), AIS-03 (WitnessBench), LEGAL-03 (in-doc 18 USC 1001). |
| RT-3 crisis/non-English | ⏳      |                                                                                                                                                  |
| RT-4..RT-12             | ⏳      |                                                                                                                                                  |
| RT-14 brand enrichment  | ⏳      | After RT-15 review.                                                                                                                              |

---

## Done (newest first)

- `195eaba` fix(ai-safety): RT-2/AIS-01 — re-enable dead AI-response validator (was gated on taskType + passed a string as context) + regression test. Build green; routing 29/29; aiSystemPrompts 50/50.
- `c9e310d` RT1-6 egress inventory. · `2252992` RT1-1 BYOK-only + dist gate. · `7023029` RT1-2 feedback egress.
- `e287c03` restore vitest. · `6a88014` / `bd5ebed` RT-15 systemic de-rainbow. · `97d9675` RT13-6. · `005affc` WIP. · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/privacy-policy.html, public/terms-of-service.html, AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats files. Commit only explicit paths (never `git add -A`). Route around these. If history diverges, STOP — never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (wait for parallel edits).
- 🚩 RT1-1 key rotation (Google Cloud Console) · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (in-flight C-file work, not mine).

## Notes for next chunk

- **AIS-02** (`nexusLogicGenerator.js:43-62,88-103,182-214`): the nexus "Doctor's Packet" emits a signature-ready physician OPINION with validation bypassed. Run output through `validateAIResponse` (with regulation context); strip the pre-printed signature/license block; reframe as a question-list for the physician OR gate download behind an explicit "the physician must independently author/verify" acknowledgement.
- **AIS-03** (`WitnessBench.jsx:258,380,436,1040-1129`): don't auto-append the "true and correct" certification to AI-drafted testimony — gate it behind an explicit personal-knowledge confirm + point-of-output disclaimer (mirror NexusDisclaimerFooter).
- **LEGAL-03 / gap-extra**: embed an 18 U.S.C. 1001 + "AI-drafted, verify every fact" banner INSIDE exported nexus/buddy PDFs/DOCX (pdfGenerator.js / docx paths), not just on screen.
- Verify with individual `npx vitest run` calls, not the full suite.
