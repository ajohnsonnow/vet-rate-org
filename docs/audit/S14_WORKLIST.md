# S14 Worklist — Performance / Core Web Vitals on mobile

> Cycle S9–S17, Sprint 14 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S14).
> Status: **complete** (source/spec `dfb0551`, CI/config in the follow-up commit).
> Branch `audit/s9-mobile-safety-net`, local commits only — no push/PR until the
> owner authorizes (standing instruction).

## Goal (S14 Definition of Done)

> Lighthouse-CI gate (mobile + throttled) — the explicitly-deferred piece of
> AUDIT_FINDINGS #33; Playwright CWV via `window.__VITALS__`; image `width/height`
> (CLS), `fetchpriority` + preload LCP hero, lazy below-fold; verify modal-open INP.
> **DoD:** lhci mobile ≥ budget (LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1); Playwright
> CWV gate green; no image-load shift.

## Baseline (before S14)

- **CWV capture already existed** — [src/utils/webVitals.js](../../src/utils/webVitals.js)
  observes LCP/CLS/INP/FCP/TTFB natively (no npm dep), exposes the buffer at
  `window.__VITALS__`, dispatches `web-vital` CustomEvents, and is initialized from
  [src/main.jsx](../../src/main.jsx) after render. **Nothing consumed it as a gate.**
- **No perf gate in CI** — [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
  ran lint / type-check / test / build / e2e / mobile / axe / red-team / security
  but had no Lighthouse or Core-Web-Vitals job. The one perf-adjacent gate,
  [scripts/check-bundle-budget.mjs](../../scripts/check-bundle-budget.mjs) (S5), is
  informational unless `STRICT_BUNDLE=true` — the repo's "informational → strict
  ratchet" precedent, reused below.
- **Images shipped without intrinsic dimensions** — no `width`/`height`,
  `fetchpriority`, `decoding`, or `loading` attribute anywhere; no LCP preload.
  The LCP candidate is the Header logo (every load) / DisclaimerSplash logo (first
  visit). Below-fold photos in AboutUs (`w-full h-auto` / `w-48 h-auto`) reserved
  no box, so their late load could shift the page.

## What changed

### 1. Source perf fixes (commit `dfb0551`)

| File | Change | Why |
|---|---|---|
| [index.html](../../index.html) | `<link rel="preload" as="image" href="/images/Vet-Rate-org-logo-official.png" fetchpriority="high">` after the favicon block | Start the LCP-hero fetch immediately, not after the JS bundle parses. The `brandingPlugin` regex rewrites this filename per brand, so the preload stays correct for the supplylocker build. |
| [Header.jsx](../../src/components/Header.jsx) | `width={80} height={80} fetchPriority="high" decoding="async"` on the logo | LCP hero (every load). React 18.3.1 supports the camelCase `fetchPriority` DOM prop. The container is a fixed square with `object-cover`, so the 1:1 attrs match the ~square source (1644×1645). |
| [DisclaimerSplash.jsx](../../src/components/DisclaimerSplash.jsx) | `width={96} height={96} fetchPriority="high" decoding="async"` on the splash logo | First-visit LCP candidate; same rationale (fixed `w-24 h-24` square, `object-cover`). |
| [AboutUs.jsx](../../src/components/AboutUs.jsx) | intrinsic `width`/`height` (real file dims) + `loading="lazy"` + `decoding="async"` on all four photos | Reserve the correct aspect-ratio box so loading the bitmap causes **zero** layout shift. Dims read from the actual files: Anth 435×604, ReadyForHerCloseup 1750×2048, Kitty_Coder 2048×1536, NaptimeLuna 2048×1536. Photos are below-fold (in a modal, inside a `<details>`), so `lazy` is safe. |

The small `Anth.jpg` **avatars** elsewhere (fixed `w-14 h-14` etc.) were left
unchanged: a fixed-size box already reserves its space, so they carry no CLS risk
and touching ~12 files for zero measurable gain would be over-reach.

### 2. Playwright CWV gate (commit `dfb0551`)

- [tests/e2e/cwv.spec.ts](../../tests/e2e/cwv.spec.ts) under the `mobile-chrome`
  (Pixel 5) project, run via `npm run test:e2e:cwv`. Reuses the returning-user
  fixture + `dismissDisclaimer` from the mobile suite.
- **Finalize:** LCP/CLS/INP only emit on the `pagehide`/`visibilitychange` finalize
  (`{once:true}` in webVitals.js), so the spec dispatches `pagehide` to flush them,
  then reads `window.__VITALS__`.
- **`home reports CLS within budget`** — hard-asserts `CLS ≤ 0.1` on the home
  surface (after a real `h1` click so INP has an event to measure), smoke-checks an
  LCP/FCP metric exists, and bounds INP by a generous dev ceiling *only when present*.
- **`About gallery images reserve layout space`** — opens AboutUs (`openAboutUs`),
  expands the galleries, and asserts each photo declares the real intrinsic dims
  **and** its rendered box already honors that ratio (within 2px) before the bitmap
  loads — a direct, load-race-free proof of the CLS fix.
- Chromium-only observers, so the spec `test.skip`s on Firefox.

### 3. Lighthouse-CI mobile gate (CI/config commit)

- [lighthouserc.json](../../lighthouserc.json) — `lhci autorun` builds nothing
  itself; it serves the already-built SPA via `vite preview` on port 4173 and runs
  Lighthouse's **default mobile form factor with simulated throttling**, the median
  of `numberOfRuns: 3`. `vite preview` (single URL) is used instead of
  `staticDistDir` so lhci audits only the SPA root, not every emitted legal `.html`.
- **Assertions (informational → strict ratchet, mirroring check-bundle-budget):**

  | audit | severity | budget | rationale |
  |---|---|---|---|
  | `cumulative-layout-shift` | **error** (hard) | ≤ 0.1 | deterministic (layout-driven); safe to block day one |
  | `largest-contentful-paint` | warn | ≤ 2500ms | ratchet to error once CI establishes a stable throttled baseline |
  | `total-blocking-time` | warn | ≤ 300ms | lab proxy for INP (INP is a field metric Lighthouse-lab cannot measure) |
  | `categories:performance` | warn | ≥ 0.90 | overall score, ratcheted with LCP/TBT |

- `@lhci/cli@0.15.1` is installed **globally** in CI (the standard lhci pattern),
  not as a devDependency, to avoid lockfile churn. Chrome ships on `ubuntu-latest`;
  lhci's chrome-launcher discovers it automatically.

### 4. CI jobs (CI/config commit)

Two new jobs in [ci.yml](../../.github/workflows/ci.yml), both `needs: [build]` and
modeled on the existing `mobile`/`axe` gates so a regression is bisectable at a glance:

- **`cwv`** — installs chromium, runs `npm run test:e2e:cwv` (blocking), uploads the
  report. The deterministic CLS gate.
- **`lighthouse`** — `npm run build`, `npm install -g @lhci/cli@0.15.1`, `lhci autorun`,
  uploads `lighthouse-report/`. The throttled-mobile budget gate.

[.gitignore](../../.gitignore) now excludes `.lighthouseci/` and `lighthouse-report/`
(regenerated every run; the report is a CI artifact).

## Verification

| Gate | Result |
|---|---|
| `npm run lint` | **0 errors** / 2721 warnings (unchanged baseline; the 2 `gc` no-undef are the known worker false-positives) |
| `npm run type-check` (`tsc --noEmit`) | **clean** (e2e specs are outside the tsconfig `include`) |
| `npm run test` (vitest) | **809 passed** / 47 files — no snapshot regressions from the new img attrs |
| `npm run test:e2e:cwv` | **2 passed** (CLS ≤ 0.1 hard + aspect-ratio reservation) |
| `vite build` | clean |
| **Lighthouse mobile (throttled, local Chrome)** | **CLS 0** · **LCP 1837ms (1.8s)** · **TBT 0ms** · **perf 0.99** — every lighthouserc assertion passes, including the LCP/TBT/perf warn budgets |

The local `lhci autorun` completed the full mobile audit but hit a Windows-only
`EPERM` while chrome-launcher deleted its temp profile at teardown — a known
chrome-launcher quirk on Windows, irrelevant to the Linux CI runner. The metric
numbers above were captured from the Lighthouse JSON, which is written before that
teardown step. **lhci's authoritative run is the CI `lighthouse` job** (Linux).

## Honest limits / out of scope

- **INP** is a *field* metric; neither the Playwright spec (dev timing) nor
  Lighthouse-lab (TBT proxy) measures real-user INP. True INP needs RUM on real
  low-end Android — out of scope for a local-first app with no telemetry backend
  (zero-knowledge stance, AUDIT_FINDINGS #38).
- **iOS Safari** URL-bar / notch CWV behavior is an owner-run manual device check.
- The **warn** budgets (LCP / TBT / perf-score) are intentionally not hard gates on
  day one; ratchet to `error` once the CI runner's throttled baseline proves stable
  (tracked here, same playbook as STRICT_BUNDLE).
- Runtime modal-preview images of **user-uploaded** files (DecisionDecoder, MyPacket,
  ShareButton, VisionSimulator) have unknown intrinsic dims and cannot take static
  `width`/`height`; they are deep in modals (not first paint) and are a documented
  residual, not silently dropped.
