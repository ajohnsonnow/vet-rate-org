# Red-Team Sprint Execution — Progress Tracker

> Live status of the autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits are **local only** (no push, no PRs).
> Updated each chunk. Source of truth for "where am I" across wake cycles.

**Last updated:** 2026-06-20 (chunk 3)
**Verification baseline:** `npm run build` green (✓ ~17s). Full `npm test` baseline not yet captured.

---

## Order & status

Legend: ✅ done · 🟡 partial/in-progress · ⏳ pending · 🚩 blocked (needs you) · ⏭️ deferred

| Sprint                        | Status | Notes                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline**                  | ✅     | Plan doc (`95a835f`); WIP checkpoint (`005affc`, 83 files); build baseline green.                                                                                                                                                                                                                                                   |
| **RT-13**                     | 🟡     | RT13-6 ✅ (`97d9675`) deduped lint-staged + dropped uninstalled stylelint. RT13-1,2,3-rest,4,5,7,8,9 pending.                                                                                                                                                                                                                       |
| **RT-15 — Calm restyle**      | 🟡     | RT15-6 ✅, RT15-1/D2 ✅ (`bd5ebed`), RT15-2 central ✅ (`6a88014`). **Still pending:** RT15-2 long-tail (HomeFeatureCards ~40 section gradients, Header nav pills, per-tool-modal colors, My Packet buttons), RT15-3 tool headers, RT15-4 emoji demote, RT15-5 calm default/motion, RT15-7 lint rule, RT15-8/D1 gold-text contrast. |
| **RT-1 — Egress honesty**     | ⏳     | Next P0 after RT-15 core. RT1-1 has 🚩 external (rotate Gemini key).                                                                                                                                                                                                                                                                |
| **RT-2 — Evidence integrity** | ⏳     |                                                                                                                                                                                                                                                                                                                                     |
| **RT-3 — Crisis/non-English** | ⏳     |                                                                                                                                                                                                                                                                                                                                     |
| **RT-4..RT-12**               | ⏳     |                                                                                                                                                                                                                                                                                                                                     |
| **RT-14 — Brand enrichment**  | ⏳     | Builds on RT-15.                                                                                                                                                                                                                                                                                                                    |

---

## Done (commits, newest first)

- `6a88014` feat(brand): RT15-2 — de-rainbow central HEADER_GRADIENTS (8 rainbow families → green + 1 brass accent + slate) + flagship hero card → green. Build green.
- `bd5ebed` feat(brand): RT15 — calm dev banner (D14) + unify va-blue/va-gold to theme vars (D2). Verified live (banner calm).
- `97d9675` fix(ci): RT13-6 — dedupe lint-staged + drop uninstalled stylelint hook.
- `005affc` chore: WIP checkpoint (83 pre-existing files).
- `95a835f` docs(audit): red-team plan.

## ⚠️ Scope note on RT-15 (important)

The rainbow is **hardcoded across many files with no central control** — `HomeFeatureCards.jsx` (1273 lines, ~40 bespoke gradients per category section), `Header.jsx` nav pills, `MyPacket` modal buttons, and likely each of the 41 tool modals. A complete de-rainbow is a large, multi-chunk, judgment-heavy effort (hundreds of color edits) and is hard to verify in an autonomous loop (the home feature grid renders only conditionally; tools live behind modals). **Strategy:** keep doing the highest-visibility safe wins (home page first), commit incrementally, screenshot-verify where feasible. If the long-tail per-modal recolor proves too subjective to finish blind, flag it for an owner visual-review pass rather than risk a worse/inconsistent result.

## Blocked / needs-you (do NOT auto-complete)

- 🚩 **RT1-1** — rotate the live `VITE_GEMINI_API_KEY` in Google Cloud Console (external). I'll do the code side.
- 🚩 **RT9-1/2/3** — counsel sign-off (CCPA/GDPR, UPL/38 CFR 14.629, FTC). I'll draft; legal call is yours.
- 🚩 **RT6-3** at-rest-encryption default; 🚩 keep-BYOK-Gemini-or-not; 🚩 VA-OAuth data-classification.
- 🚩 **RT8-8** — Lighthouse mobile ratchet needs a real throttled-mobile baseline.

## Notes for next chunk

- Next: RT15-2 home-grid recolor — systematically map the HomeFeatureCards section gradients (teal/violet/rose/amber → green/neutral, keep semantic green FREE badges, red danger badges, one gold accent) + Header nav pills. Screenshot-verify (load example data renders the grid behind a modal; may need to dismiss MyPacket to see the grid).
- Port leakage: stopped dev-server tasks left ports 5173/5174 held by lingering vite processes — clean up stray node processes when convenient.
- `*.vue` lint-staged entry still references stylelint (harmless — no .vue files).
- D1 (gold-as-text contrast on light) deferred to RT15-8 — needs per-theme `--va-gold-text` across the 7 theme blocks in `index.css`.
