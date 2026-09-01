# Unreferenced components — archived 2026-08-31

Two React components with **zero importers** anywhere in `src/`, `tests/`,
`scripts/`, or `docs/`. Verified by static import search and by grepping for
any occurrence of the component name outside its own file, so dynamic and JSX
usage are both covered.

| File | Lines | Added | Last functional change |
| --- | --- | --- | --- |
| `AIModelQuickLoad.jsx` | 392 | 2026-01-24 | none since it was added |
| `ZonkButton.jsx` | 227 | 2026-01-18 | none since it was added |

Every commit either has touched since creation was mechanical — lint-cleanup
waves, AGPL header alignment, release version bumps. They were being carried
along by automated sweeps, paying lint, format and review cost on every pass
while being unreachable at runtime.

`src/components/examples/DynamicCopyExamples.jsx` was also unreferenced by
code but is **deliberately kept**: `docs/DYNAMIC_STATS_GUIDE.md` and
`docs/DYNAMIC_STATS_INDEX.md` cite it as the worked-example reference.

To restore: `git mv` the file back to `src/components/` and add an import.
Full history follows the file, so `git log --follow` still works.
