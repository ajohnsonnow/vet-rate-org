# S11 Worklist — Error boundaries

> Cycle S9–S17, Sprint 11 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S11).
> Status: **done** (evidence below). Branch `audit/s9-mobile-safety-net`, local commits
> only — no push/PR until the owner authorizes (standing instruction).

## Goal (S11 Definition of Done)

> Forced throw in any cluster → fallback (not a blank page), one-tap report lands in
> `bugReportStorage`, rest of app stays interactive; Playwright injects a throw and asserts
> recovery @360px.

## What shipped

- **[src/components/common/ErrorBoundary.jsx](../../src/components/common/ErrorBoundary.jsx)** —
  the missing primitive (prior grep = 0). Class component (required: `getDerivedStateFromError`
  + `componentDidCatch` have no hook equivalent). Two levels:
  - `level="app"` — full-screen fallback, **"Reload app"** (`window.location.reload()`); a
    top-level crash means the tree is gone, so re-mounting in place can't help.
  - `level="cluster"` (default) — inline card, **"Try again"** (`resetBoundary` clears
    `hasError` → the subtree re-mounts); siblings keep running.

  Both render a mobile-first, offline-safe fallback: `role="alert"`, `data-testid`
  `error-boundary-fallback`, amber alert glyph, "your data is safe on this device" copy,
  `min-h-[44px]` tap targets, safe-area bottom padding, dark-mode classes. `componentDidCatch`
  lands the crash in the same session log the BugSquasher reads (via `logConsoleError`) so a
  later manual report still carries the stack. **One-tap "Report this problem"** calls
  `saveBugReport` with `severity = CRITICAL`, `category = FEATURE_BROKEN`, `module = name`,
  plus `getSystemInfo()`, then toasts the returned `report_id`. Toast is read via
  `static contextType = ToastContext`, null-safe so the boundary still renders outside a
  `ToastProvider` (unit tests, defensive).

- **[src/contexts/ToastContext.jsx](../../src/contexts/ToastContext.jsx)** — added `export` to
  `ToastContext` (one word) so the class can read it through `static contextType`. The
  `useToast` hook path is untouched.

- **[src/App.jsx](../../src/App.jsx)** — wiring:
  - App-level boundary wraps `<App/>` **inside** `AppProviders` (so the boundary can read
    `ToastContext` when it catches): `AppWrapper = <AppProviders><ErrorBoundary level="app"
    name="Vet-Rate.org"><App/></ErrorBoundary></AppProviders>`.
  - `<ErrorBoundary name="Home">` wraps `<HomeMain/>` so a crash in the primary search surface
    degrades to the inline fallback while the shell (header, footer, floating actions, modals)
    stays live.

- **[src/features/modals/AppModals.jsx](../../src/features/modals/AppModals.jsx)** — a
  module-scoped `Cluster({name, children})` wrapper (stable component type across renders) wraps
  **each of the ~30 lazy modal clusters** in its own boundary, all still under the single
  `<Suspense>`. One tool crashing now shows that cluster's fallback instead of taking down its
  siblings or the shell.

- **[src/debug/CrashCanary.jsx](../../src/debug/CrashCanary.jsx)** — DEV/E2E-only crash injector
  mounted inside Home's boundary behind `import.meta.env.DEV` (dead code → tree-shaken from
  production). Throws during render while a persistent `window.__VETRATE_E2E_CRASH__` flag is set
  (flag flipped by a `vetrate:e2e-crash` window event). See the StrictMode note below for why the
  flag is persistent rather than one-shot.

## Tests

- **Unit — [ErrorBoundary.test.jsx](../../src/components/common/ErrorBoundary.test.jsx)
  (6/6):** renders children when safe; cluster fallback (Try again) on throw; app fallback
  (Reload app) at `level="app"`; one-tap report persists a sanitized report (`saveBugReport`
  called with `module`/`severity`/`error_message`) + success toast carrying the `report_id`;
  error toast when the save rejects; **Try again recovers** once the underlying fault clears.
  `saveBugReport` is mocked (vitest/jsdom has no IndexedDB); `console.error` silenced (React logs
  caught render errors). jsdom has no StrictMode/Fast-Refresh, so this tree is deterministic —
  it carries the interactive-logic coverage.

- **E2E — [tests/e2e/error-boundary.spec.ts](../../tests/e2e/error-boundary.spec.ts) (4/4
  @360px chromium):** proves the *real running app* (real providers, real IndexedDB) degrades
  gracefully, which the mocked unit tree can't:
  1. A cluster crash shows the inline fallback ("Home hit a snag" + Try again + Report), the
     crashed `#main-content` is gone, and the fallback itself does not overflow (`scrollWidth -
     clientWidth ≤ 1`).
  2. The rest of the app stays interactive — the floating bug button is present and an
     event-driven sibling modal (`openPrivacyPolicy`) still opens while Home is down.
  3. One-tap report **persists a sanitized crash report to the real `VetRateBugSquasher`
     IndexedDB** — read back: `report_id` matches `/^BUG-/`, `severity === "critical"`,
     `error_message` contains "canary". (This is the one path the unit test mocks, now proven
     end-to-end.)
  4. Try again re-mounts the recovered cluster (clear the flag, click Try again → fallback gone,
     `#main-content` back).

  Returning-user fixture mirrors `mobile.spec.ts` (seeds `vet-rate-tos-accepted`,
  `vet_rate_last_seen_version` = package.json version, `vetrate-tour-completed`) so no first-run
  overlay — notably the What's New modal — intercepts the fallback's buttons.

## Dev-server StrictMode / Fast-Refresh finding (why the canary uses a persistent flag)

The first e2e draft caught the fallback (`toBeVisible` passed) but it **detached within ~250ms**
before the report/recovery steps could run. A throwaway diagnostic spec (instrumented with a
`window` marker + 250 ms sampling) isolated the cause:

```
t=0ms    marker=12345  fallback=true   main=false     ← boundary caught the throw
t=250ms+ marker=12345  fallback=false  main=true      ← subtree auto-recovered, stays healthy
pageerror: "E2E canary crash"  (logged twice)         ← StrictMode double-invoke of the render
```

The `marker` survived the whole window → **no page reload**; it is an in-app boundary
auto-recovery. In dev, `<React.StrictMode>` ([main.jsx:90](../../src/main.jsx#L90)) + Fast
Refresh remount a crashed boundary's subtree once to "retry." A one-shot `useState` crash was
lost on that remount (fresh state, event already consumed), so the fallback vanished.

Fix: CrashCanary keys off a **persistent** `window.__VETRATE_E2E_CRASH__` flag read on every
render, so each auto-recovery remount re-throws and the fallback holds steady — exactly how a
real, non-transient render bug behaves. Re-running the diagnostic confirmed `fallback=true,
main=false` stable from t=0 through t=3750ms with **no white-screen escalation**. The throwaway
diagnostic was then deleted.

**Honest scope note:** this auto-recovery is a **dev-only** artifact. A production build has no
StrictMode double-invoke and no Fast Refresh, so a real error boundary holds its fallback until
the user acts — and CrashCanary is tree-shaken out of prod entirely. The e2e therefore runs
against the dev server (as the rest of the suite does) with the persistent-flag canary making
the fallback stable enough to assert report-persistence and Try-again recovery. A separate
production-preview e2e (prod build + an e2e-gated canary + its own Playwright project) was
considered and judged unnecessary: the interactive recovery logic is covered deterministically by
the unit test, the real-IndexedDB write is now covered by the dev e2e, and a prod-preview job
would add a CI change (owner authorization required) for marginal extra coverage.

## Verification gate — GREEN

- **ESLint:** 0 errors (1349 pre-existing warnings — the `jsx-a11y`/`react-hooks`/`no-console`
  backlog is S13 scope). New files (`ErrorBoundary.jsx`, `CrashCanary.jsx`) lint clean (exit 0).
- **Type-check (`tsc --noEmit`):** clean.
- **Unit (vitest):** 809/809 across 47 files (+6 ErrorBoundary, +1 file vs S10's 803/46).
- **E2E (Playwright, chromium):** error-boundary 4/4; full chromium suite green. One transient
  failure in `smoke.spec.ts` ("loads without JS errors") was an **environmental** artifact — a
  stale dev server holding port 5173 broke Vite's HMR WebSocket, surfacing
  `"WebSocket closed without opened."` as a pageerror. Unrelated to S11 (nothing here touches
  WebSockets/Vite/HMR); cleared the stale process and the smoke + boundary suites re-ran 8/8
  green.

**S11 coding work is complete.** Per the standing instruction, **no push / PR until the owner
authorizes** — all work to date is local commits on `audit/s9-mobile-safety-net`.
