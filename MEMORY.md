# MEMORY.md — Agent memory index

One line per entry, ~150 chars max. Each entry is a non-obvious fact a future
agent run would otherwise miss. **Do not** save anything derivable from the
current repo state (file paths, function names, git history, code patterns).
**Always include the *why*.**

See [CLAUDE.md §6](./CLAUDE.md#6-memory-hygiene-file-based-memory) for the full
memory-hygiene rules and `ai-memory-systems-best-practices.md` in the toolkit.

## Active memories

<!-- Format:
- YYYY-MM-DD | scope | one-sentence fact + WHY future-you needs it
-->

- 2026-04-24 | tooling | Tool count is 42 across 6 categories — `toolkitData.js` is the single source of truth; `projectStats.js` and `projectStats.json` mirror it and a vitest cross-check guards drift.
- 2026-04-24 | tests | E2E specs need `preAcceptModals(page)` from `tests/e2e/helpers.ts` before `page.goto()`, otherwise the ToS modal blocks pointer events.
- 2026-04-24 | security | `.snyk` ignores expire on a 90-day rolling window — re-validate before bumping the date, don't rubber-stamp.
- 2026-04-24 | calculators | Two combined-rating implementations exist (`vaCalculator.js` + `ratingCalculator.js`); `ratingCalculator.crosscheck.test.js` keeps them in lockstep — fix both or fix neither.
