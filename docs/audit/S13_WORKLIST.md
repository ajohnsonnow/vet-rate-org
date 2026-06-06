# S13 Worklist — ESLint hardening + type-check gate

> Cycle S9–S17, Sprint 13 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S13).
> Status: **complete** (commit `2cd5b5a`). Branch `audit/s9-mobile-safety-net`, local commits
> only — no push/PR until the owner authorizes (standing instruction).

## Goal (S13 Definition of Done)

> Add `jsx-a11y` + `react-hooks` (ESLint-8-compat) at "warn", triage backlog, ratchet
> high-signal rules to "error"; `no-console`→"warn"; add `tsc --noEmit` CI job.
> **DoD:** jsx-a11y + react-hooks active and blocking **new** violations; `type-check` job
> green + blocking; backlog counts documented; **no mass auto-disable**.

## Baseline (before S13, pre-existing `.eslintrc.json`)

`npm run lint` (= `eslint src --ext .js,.jsx`) — **0 errors / 1274 warnings**. ESLint exits 0
on warnings, so CI's lint job is green and only **errors** break it. Top pre-existing warnings:

| count | rule | class |
|---:|---|---|
| 669 | `no-unused-vars` | hygiene |
| 472 | `react/no-unescaped-entities` | hygiene |
| 94 | `no-useless-escape` | hygiene |
| 12 | `no-undef` | **correctness — see "Discovered bug cluster" below** |
| 9 | `no-case-declarations` | hygiene |
| 4 | `no-dupe-keys` | **correctness — see below** |
| 4 | `no-control-regex` | hygiene |
| 3 | `no-constant-condition` | hygiene |
| 2 | `no-misleading-character-class`, `react/jsx-no-comment-textnodes` | hygiene |
| 1 | `react/no-unknown-property` | hygiene |

`no-console` was `"off"` (uncounted). `tsc --noEmit` (`npm run type-check`) — **0 errors**
already (`checkJs:false`, so JS/JSX bodies are not type-checked; `.ts/.tsx` + config are).

## What changed in `.eslintrc.json`

**Strategy — keep recommended defaults blocking everywhere there is no debt; downgrade only
the specific rules that carry an existing backlog to "warn" with a documented count.** This is
the opposite of a mass auto-disable: the entire zero-backlog portion of each recommended set
ships at **error** (blocking new violations) on day one.

- `extends` += `plugin:react-hooks/recommended`, `plugin:jsx-a11y/recommended`.
- `plugins` += `react-hooks`, `jsx-a11y`.
- `no-console`: `"off"` → **`"warn"`** (now surfaces 1211 calls in `src`; ratchet to "error"
  is deferred to **S17**, which migrates `console.*` → `logger` then closes the rule).
  Test files (`*.test.{js,jsx}`, `__tests__/**`, `tests/**`) override `no-console` back to
  `"off"` — diagnostics in tests are intentional.

### react-hooks

| rule | severity | backlog | note |
|---|---|---:|---|
| `react-hooks/rules-of-hooks` | **error** (blocking) | **0** | the 1 violation was a false positive — a plain handler named `useQuickPhrase` in [VeteranTranslator.jsx](../../src/components/VeteranTranslator.jsx); renamed → `applyQuickPhrase` (it calls `setMyText`/`setTimeout`/`speak`, no hooks). Highest-signal rule now blocks new violations with zero debt. |
| `react-hooks/exhaustive-deps` | warn | 36 | documented backlog; warn per plan ("ratchet once drained"). |

### jsx-a11y — zero-backlog rules stay at **error** (blocking); backlogged rules → **warn**

The `jsx-a11y/recommended` set is ~30 rules at error. Only the **8** below have existing
violations and were downgraded to "warn"; **every other recommended jsx-a11y rule remains at
error and blocks new violations**.

| rule | severity | backlog |
|---|---|---:|
| `jsx-a11y/label-has-associated-control` | warn | 134 |
| `jsx-a11y/click-events-have-key-events` | warn | 34 |
| `jsx-a11y/no-static-element-interactions` | warn | 33 |
| `jsx-a11y/no-autofocus` | warn | 6 |
| `jsx-a11y/no-noninteractive-element-interactions` | warn | 3 |
| `jsx-a11y/no-redundant-roles` | warn | 1 |
| `jsx-a11y/iframe-has-title` | warn | 1 |
| `jsx-a11y/no-noninteractive-tabindex` | warn | 1 |
| *(all other recommended jsx-a11y rules)* | **error** | 0 |

### Post-change lint

`npm run lint` — **0 errors / 2734 warnings**, exit 0 (CI green). The warning rise is
expected and intentional: `no-console` flipped on (+1211) and the 213 jsx-a11y backlog items
are now visible instead of silent. **No rule was disabled to hide debt.**

## type-check CI job (owner-authorized for S13)

`.github/workflows/ci.yml` gains a `type-check` job (mirrors the existing `quality`/`Lint`
job shape: checkout → setup-node 20 + npm cache → `npm ci` → `npm run type-check`), needed by
the same downstream jobs lint feeds. `tsc --noEmit` is green today, so the gate is blocking
without breaking CI. Scope authorized by the owner's "Start S13 (ESLint + type-check gate)"
selection.

## Discovered bug cluster — `no-undef` (correctness, pre-existing, OUT of S13 plugin scope)

Triage of the pre-existing `no-undef` backlog surfaced **real latent runtime bugs**, not
style noise. These were already `no-undef:"warn"` before S13 (not newly introduced) and
`tsc --noEmit` does **not** catch them (`checkJs:false`). The 3 `setShowAISettings` crashes
were **fixed** in this sprint because the correct behavior was unambiguous from the
codebase's own convention (not a guess — see below). The rest remain a documented fast-follow
backlog: several need intended-UX/domain judgment. Left at "warn"; do **not** ratchet
`no-undef` to "error" until drained.

**Fixed (3 of the cluster) — `setShowAISettings` → `onOpenAISettings?.()`.** CFileAnalyzer,
DenialDecoder, and Pathfinder each already **receive** an `onOpenAISettings` prop (wired by
their cluster shells to dispatch the `openAISettings` event / call the shell handler) and use
it for their `AIStatusBadge`. Their no-AI-available path wrongly called the nonexistent local
setter `setShowAISettings(true)` → `ReferenceError` instead of opening settings. Switched each
to the prop they already own. Convention-following, not guesswork; lint `no-undef` 12 → 9.

| file:line | undefined name | assessment |
|---|---|---|
| [CFileAnalyzer.jsx:162](../../src/components/CFileAnalyzer.jsx#L162) | `setShowAISettings` | **FIXED** → `onOpenAISettings?.()`. |
| [DenialDecoder.jsx:148](../../src/components/DenialDecoder.jsx#L148) | `setShowAISettings` | **FIXED** → `onOpenAISettings?.()`. |
| [Pathfinder.jsx:637](../../src/components/Pathfinder.jsx#L637) | `setShowAISettings` | **FIXED** → `onOpenAISettings?.()`. |
| [LocalAIPanel.jsx:1558](../../src/components/LocalAIPanel.jsx#L1558) | `setWebGPUStatus` | undefined setter cluster — needs read of intended state wiring. |
| [LocalAIPanel.jsx:1568](../../src/components/LocalAIPanel.jsx#L1568) | `handleUnload` | undefined handler. |
| [LocalAIPanel.jsx:1572](../../src/components/LocalAIPanel.jsx#L1572) | `handleLoadModel` | undefined handler. |
| [LocalAIPanel.jsx:2704](../../src/components/LocalAIPanel.jsx#L2704) | `setError` | undefined setter. |
| [DD214Analyzer.jsx:732](../../src/components/DD214Analyzer.jsx#L732) | `hasVisionModel` | undefined identifier. |
| [AppealsLaneAdvisor.jsx:91](../../src/components/AppealsLaneAdvisor.jsx#L91) | `priorAppeals` | undefined identifier. |
| [BlueButtonXRay.jsx:390](../../src/components/BlueButtonXRay.jsx#L390) | `STANDARD_FONT_DATA_URL` | undefined constant. |
| [florence-ocr-worker.js:385](../../src/workers/florence-ocr-worker.js#L385), [smolvlm-worker.js:260](../../src/workers/smolvlm-worker.js#L260) | `gc` | likely intentional optional `global.gc()` in a worker — verify before touching (may be a legit env global, not a bug). |

### `no-dupe-keys` (correctness, pre-existing) — 4 sites, all in one data file

[mosDatabase.js](../../src/data/mosDatabase.js): duplicate keys `1A031` (L243), `3D0X2`
(L312), `3D0X3` (L313), `SK` (L552). A duplicate object key silently drops the earlier
value. Fix needs MOS-code domain judgment (which definition is canonical) → fast-follow, not
a blind edit. Left at "warn"; do not ratchet `no-dupe-keys` to "error" until resolved.

## Verification

- [x] `npm run lint` → 0 errors (exit 0); jsx-a11y + react-hooks loaded; zero-backlog
      recommended rules + `rules-of-hooks` at error.
- [x] `npm run type-check` → 0 errors (exit 0).
- [x] `ci.yml` `type-check` job added (YAML validated) + committed (`2cd5b5a`).

## Out of S13 scope (documented backlog → fast-follow / later sprints)

- `no-undef` cluster (above) — 3 `setShowAISettings` crashes fixed in this sprint; the
  remaining 9 (LocalAIPanel handler/setter cluster, `hasVisionModel`, `priorAppeals`,
  `STANDARD_FONT_DATA_URL`, worker `gc`) are a dedicated bug-fix fast-follow needing per-site
  investigation.
- `no-dupe-keys` in `mosDatabase.js` — MOS-code dedupe with domain judgment.
- `no-console` → "error" ratchet — deferred to **S17** (after `console.*` → `logger`).
- jsx-a11y + `exhaustive-deps` backlog drain — incremental; ratchet each rule to error once 0.
