# Red-Team Sprint Execution — Progress Tracker

> Live status of the autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits are **local only** (no push, no PRs).
> Updated each chunk. Source of truth for "where am I" across wake cycles.

**Last updated:** 2026-06-20 (chunk 4)
**Verification baseline:** `npm run build` green (✓ ~17-21s). `npm test` (vitest) now RUNS after the test-infra fix: **1011 passing, 3 pre-existing failures** in `cfileResilience.test.js` (unrelated to this work — see below).

---

## Order & status

Legend: ✅ done · 🟡 partial/in-progress · ⏳ pending · 🚩 blocked (needs you) · ⏭️ deferred-for-review

| Sprint                        | Status  | Notes                                                                                                                                                                                                                                                        |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Baseline + test infra**     | ✅      | Plan doc (`95a835f`); WIP checkpoint (`005affc`); restored vitest suite by adding missing `@testing-library/dom` peer dep (`e287c03`).                                                                                                                       |
| **RT-13**                     | 🟡      | RT13-6 ✅ (`97d9675`). Rest pending. (New: lint-staged pattern `*.{…js…}` omits `.jsx`, so JSX skips eslint on commit — fold into RT13.)                                                                                                                     |
| **RT-15 — Calm restyle**      | 🟡 / ⏭️ | RT15-6 ✅, RT15-1/D2 ✅ (`bd5ebed`), RT15-2 central ✅ (`6a88014`). **Long-tail DEFERRED FOR OWNER VISUAL REVIEW** — see note.                                                                                                                               |
| **RT-1 — Egress honesty**     | 🟡      | RT1-2 ✅ (`7023029`) feedback egress env-gated + PII-scrubbed. Next: RT1-1 (code: drop Gemini env-key fallback + dist-leak gate; 🚩 key rotation is external), RT1-5 (README "no analytics"), RT1-3 (privacy-policy {t()} render), RT1-6 (egress inventory). |
| **RT-2 — Evidence integrity** | ⏳      |                                                                                                                                                                                                                                                              |
| **RT-3 — Crisis/non-English** | ⏳      |                                                                                                                                                                                                                                                              |
| **RT-4..RT-12**               | ⏳      |                                                                                                                                                                                                                                                              |
| **RT-14 — Brand enrichment**  | ⏳      | Builds on RT-15.                                                                                                                                                                                                                                             |

---

## Done (commits, newest first)

- `7023029` fix(privacy): RT1-2 — env-gate + PII-scrub feedback egress (FeatureRequest, CommunityRoadmap, .env.example). Build green; no new test failures.
- `e287c03` fix(test): install missing `@testing-library/dom` — restores the vitest suite (was 100% broken at import).
- `6a88014` feat(brand): RT15-2 — de-rainbow central HEADER_GRADIENTS + hero → green.
- `bd5ebed` feat(brand): RT15 — calm dev banner (D14) + unify va-blue/va-gold to theme vars (D2).
- `97d9675` fix(ci): RT13-6 — dedupe lint-staged + drop uninstalled stylelint hook.
- `005affc` chore: WIP checkpoint (83 files). · `95a835f` docs(audit): plan.

## ⏭️ RT-15 long-tail — DEFERRED FOR OWNER VISUAL REVIEW (per the loop's escape-hatch instruction)

The systemic de-rainbow is done (banner, va-vars, central tool-header gradients, flagship hero). The **remaining** rainbow is hardcoded across many files with no central control and is too subjective to finish well _blind_ in an autonomous loop (and hard to verify — the home grid renders only behind modals). Proposed mapping for the owner to greenlight, then I (or a Sonnet pass) can apply it quickly:

- `HomeFeatureCards.jsx` (~40 bespoke section gradients): teal/violet/rose/amber/blue card+button+icon+badge gradients → deep green (`green-700/800`) for most; **keep** semantic green FREE badges, red ACTIVE-DUTY/danger badges, and one muted-gold (`amber-700`) accent for the "Maximize" section.
- `Header.jsx` nav pills (the blue/teal/yellow/pink/purple/indigo row).
- Per-tool modal headers/buttons (e.g. Symptom Logger orange, MyPacket "Analyze Strategy" purple).
- Then RT15-3/4 (emoji→lucide), RT15-5 (calm default/motion), RT15-7 (lint rule), RT15-8/D1 (per-theme `--va-gold-text`).
  **Recommendation:** do this as one focused pass with the dev server up so each screen can be eyeballed.

## ⚠️ Pre-existing test failures (NOT from this work)

`cfileResilience.test.js` — 3 failures ("strips a hallucinated diagnostic code from the merged result", `Cannot read properties of undefined (reading 'diagnosticCode')`). In the in-flight C-file analyzer work present at session start; relates to AIS hallucination-stripping. Flagged for the owner — not touched by these sprints.

## Blocked / needs-you (do NOT auto-complete)

- 🚩 **RT1-1** — rotate the live `VITE_GEMINI_API_KEY` in Google Cloud Console (external). Code side (drop env fallback + dist-leak CI gate) is doable and next.
- 🚩 **RT9-1/2/3** counsel (CCPA/GDPR, UPL, FTC). 🚩 **RT6-3** at-rest-encryption default. 🚩 keep-BYOK-or-not. 🚩 VA-OAuth data-classification. 🚩 **RT8-8** LH mobile baseline.

## Notes for next chunk

- Next: RT1-1 code — in `unifiedAIService.js` (~498, ~684) and `aiStatementHelper.js:47`, drop the `import.meta.env.VITE_GEMINI_API_KEY` fallback so the cloud key comes ONLY from the user's localStorage BYOK entry; add a release/CI grep that fails if `dist/` contains an `AIza…` key. Then RT1-5 (README), RT1-3 (sync-legal-pages {t()} render).
- Parallel-actor watch: `d788a01` (e2e) appeared earlier from elsewhere; reconcile cleanly, no force.
- Port leakage from stopped dev servers (5173/5174/5175) — clean stray node when convenient.
