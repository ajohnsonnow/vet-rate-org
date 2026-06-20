# Red-Team Sprint Execution — Progress Tracker

> Live status of the autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits are **local only** (no push, no PRs).
> Source of truth for "where am I" across wake cycles.

**Last updated:** 2026-06-20 (chunk 5)
**Verification baseline:** `npm run build` green (✓ ~17s). `npm test`: **1011 passing**, 3 pre-existing `cfileResilience.test.js` failures (unrelated). Only NEW failures matter.

---

## Order & status

Legend: ✅ done · 🟡 partial · ⏳ pending · 🚩 blocked-needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                        | Status  | Notes                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline + test infra**     | ✅      | Plan (`95a835f`), WIP checkpoint (`005affc`), vitest restored via `@testing-library/dom` (`e287c03`).                                                                                                                                                                   |
| **RT-13**                     | 🟡      | RT13-6 ✅ (`97d9675`). Rest pending. (Note: lint-staged omits `.jsx` from eslint.)                                                                                                                                                                                      |
| **RT-15 — Calm restyle**      | 🟡 / ⏭️ | Systemic de-rainbow done (`bd5ebed`, `6a88014`). Long-tail (HomeFeatureCards sections, Header pills, per-modal) **DEFERRED FOR OWNER VISUAL REVIEW** — mapping in prior tracker note.                                                                                   |
| **RT-1 — Egress honesty**     | 🟡      | RT1-2 ✅ (`7023029`), RT1-1 ✅ (`2252992`), RT1-6 ✅ (`c9e310d`). **RT1-5 (README), RT1-3 (privacy-policy render) = 🔒** the parallel actor is actively editing README/legal HTML right now — route around to avoid entangling. RT1-7 (self-host CDN/lazy GSI) pending. |
| **RT-2 — Evidence integrity** | ⏳ NEXT | Files clean (not touched by parallel actor). Start AIS-01 (re-enable dead validator).                                                                                                                                                                                   |
| **RT-3 — Crisis/non-English** | ⏳      |                                                                                                                                                                                                                                                                         |
| **RT-4..RT-12**               | ⏳      |                                                                                                                                                                                                                                                                         |
| **RT-14 — Brand enrichment**  | ⏳      | After RT-15 review.                                                                                                                                                                                                                                                     |

---

## Done (commits, newest first)

- `c9e310d` docs(privacy): RT1-6 — egress inventory from the CSP allowlist.
- `2252992` fix(privacy): RT1-1 — BYOK only; drop Gemini build-env key fallback + dist-secret scan + release gate. Verified (build, dist scan, routing tests 29/29).
- `7023029` fix(privacy): RT1-2 — env-gate + PII-scrub feedback egress.
- `e287c03` fix(test): restore vitest (`@testing-library/dom`).
- `6a88014` feat(brand): RT15-2 central de-rainbow + hero. · `bd5ebed` RT15 banner + va-vars.
- `97d9675` fix(ci): RT13-6. · `005affc` WIP checkpoint. · `95a835f` plan.

## 🔒 Parallel actor on this branch

Commits `d788a01` (e2e), `933e8a6` (`[pre-push]` stats auto-commit) appeared from elsewhere, and the working tree has **uncommitted** changes (not mine) to `README.md`, `public/privacy-policy.html`, `public/terms-of-service.html`, `AGENTIC_VALUE_PROPOSITION.md`, `docs/LEGAL_PAGES_SYNC.md`, `public/version.json`, `src/data/projectStats.json` — i.e. someone is doing a **legal-pages/README/marketing pass right now** (overlaps RT1-3/RT1-5). I am committing only my own explicit file paths (never `git add -A`) and routing around their files. If history diverges, STOP and report — never force.

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail → owner visual review.
- 🔒 RT1-5 / RT1-3 → wait for the parallel legal/README edits to settle, then reconcile.
- 🚩 RT1-1 key **rotation** (Google Cloud Console). 🚩 RT9 counsel. 🚩 RT6-3 / keep-BYOK / VA-OAuth classification. 🚩 RT8-8 LH baseline.
- ⚠️ Pre-existing: `cfileResilience.test.js` ×3 (in-flight C-file work, not mine).

## Notes for next chunk

- **RT-2 (AIS-01)**: `unifiedAIService.js:1971-1973` passes `taskType` where `validateAIResponse` expects a `{taskType, loadedRegulations}` context object → the forbidden-phrase + CFR-grounding validator is dead. Fix the call shape; make the forbidden-phrase block run unconditionally; add a test driving the real `generateAI` return path. Files: `unifiedAIService.js` (mine/clean), `aiSystemPrompts.js`. Then AIS-02 (nexus packet), AIS-03 (buddy statement), LEGAL-03 + in-doc 18 USC 1001 warnings.
- Avoid README / public/\*.html / AGENTIC_VALUE_PROPOSITION.md / LEGAL_PAGES_SYNC.md until the parallel edits land.
