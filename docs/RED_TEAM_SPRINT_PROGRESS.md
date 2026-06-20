# Red-Team Sprint Execution — Progress Tracker

> Live status of the autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits are **local only** (no push, no PRs).
> Updated each chunk. Source of truth for "where am I" across wake cycles.

**Last updated:** 2026-06-20 (chunk 2)
**Verification baseline:** `npm run build` green (✓ ~17s). Full `npm test` baseline not yet captured.

---

## Order & status

Legend: ✅ done · 🟡 partial/in-progress · ⏳ pending · 🚩 blocked (needs you) · ⏭️ deferred

| Sprint                            | Status | Notes                                                                                                                                                            |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline**                      | ✅     | Plan doc committed (`95a835f`); pre-existing WIP checkpointed (`chore: WIP checkpoint`, 83 files); build baseline green.                                         |
| **RT-13 (partial, pulled early)** | 🟡     | RT13-6 done (`97d9675`) — deduped lint-staged + dropped uninstalled stylelint hook (was a blocker for any CSS commit). Rest of RT-13 pending.                    |
| **RT-15 — Calm restyle**          | 🟡     | RT15-6 ✅ + RT15-1 (D2) ✅ (`bd5ebed`). Rainbow-kill (RT15-2/3), emoji demote (RT15-4), calm default (RT15-5), lint rule (RT15-7), contrast (RT15-8/D1) pending. |
| **RT-1 — Egress honesty**         | ⏳     | Next P0 after RT-15. RT1-1 (Gemini key) has a 🚩 external part (rotate in Google Cloud Console).                                                                 |
| **RT-2 — Evidence integrity**     | ⏳     |                                                                                                                                                                  |
| **RT-3 — Crisis/non-English**     | ⏳     |                                                                                                                                                                  |
| **RT-4..RT-12**                   | ⏳     |                                                                                                                                                                  |
| **RT-13 (remainder)**             | ⏳     | RT13-1,2,3(partial via 6),4,5,7,8,9                                                                                                                              |
| **RT-14 — Brand enrichment**      | ⏳     | Builds on RT-15.                                                                                                                                                 |

---

## Done (commits, newest first)

- `bd5ebed` feat(brand): RT15 — calm dev banner (D14/RT15-6) + unify va-blue/va-gold to theme vars (D2/RT15-1). Verified: build green + live screenshot (banner now calm dark-green, page intact).
- `97d9675` fix(ci): RT13-6 — dedupe lint-staged + drop uninstalled stylelint hook.
- `chore: WIP checkpoint before red-team sprints` — 83 pre-existing files.
- `95a835f` docs(audit): red-team plan.

## Blocked / needs-you (do NOT auto-complete)

- 🚩 **RT1-1** — rotate the live `VITE_GEMINI_API_KEY` in Google Cloud Console (external). I'll do the code side (remove env fallback + dist-leak CI gate).
- 🚩 **RT9-1/RT9-2/RT9-3** — counsel sign-off (CCPA/GDPR, UPL/38 CFR 14.629, FTC substantiation). I'll draft the disclosures; legal call is yours.
- 🚩 **RT6-3** — at-rest-encryption default-vs-opt-in (owner choice). 🚩 keep-BYOK-Gemini-or-not. 🚩 VA-OAuth data-classification policy.
- 🚩 **RT8-8** — Lighthouse mobile ratchet needs a real throttled-mobile baseline.

## Notes for next chunk

- RT-15 next: the big visible win is RT15-2 (kill the per-category rainbow gradients in `Header.jsx`/`colorSchemas.js`/`HomeFeatureCards.jsx`) + RT15-3 (re-skin tool headers). These are judgment-heavy and need screenshot verification — recreate a temporary Playwright shot harness, verify, then clean it up.
- `*.vue` lint-staged entry still references stylelint, but there are no `.vue` files (harmless; left as-is).
- D1 (gold-as-text contrast on light) deferred to RT15-8 — needs a per-theme `--va-gold-text` across the 7 theme blocks in `index.css`.
