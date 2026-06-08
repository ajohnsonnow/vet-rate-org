# S15 Worklist — PWA / offline + SEO / meta

> Cycle S9–S17, Sprint 15 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S15).
> Status: **complete** (commits `af1e2d7`, `b41ff7b`, `807bf6f`, `ab5f6f2`).
> Branch `audit/s9-mobile-safety-net`, local commits only — no push/PR until the
> owner authorizes (standing instruction).

## Goal (S15 Definition of Done)

> PWA audit (manifest, maskable icons, install via `PWAInstallButton`, SW offline
> smoke, update via `useUpdateOrchestrator`); per-page title/desc/canonical/OG/
> twitter; `robots.txt` + `sitemap.xml`; verify no PII in meta.
> **DoD:** lhci PWA + SEO pass; offline Playwright smoke green; robots/sitemap
> valid; owner install-tests Android + iOS (manual).

## Baseline (before S15)

- **Manifest icons were broken** — [public/manifest.json](../../public/manifest.json)
  declared a `screenshots` array and per-shortcut icon references pointing at files
  that do not exist, and combined `purpose:"any maskable"` on a single non-maskable
  asset. An install prompt would have shipped a broken/cropped emblem.
- **No social/search metadata** — [index.html](../../index.html) had only `<title>`
  and `<meta name="description">`. No `canonical`, no `robots`, no Open Graph, no
  Twitter card, no iOS standalone hints, no dedicated apple-touch-icon.
- **No `robots.txt` / `sitemap.xml`** anywhere in `public/` or the build output.
- **The service worker had no test gate** — [public/service-worker.js](../../public/service-worker.js)
  (network-first nav + offline fallback, closes AUDIT_FINDINGS #27) existed and is
  registered from [src/main.jsx](../../src/main.jsx), but only under
  `import.meta.env.PROD`, and nothing exercised its offline contract in CI.
- **No PWA/SEO gate in CI** — [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
  ran lint / type-check / test / build / e2e / mobile / axe / cwv / lighthouse /
  red-team / security but had no manifest, icon, meta, or offline gate.
- **Multi-brand SEO gap** — the `brandingPlugin` ([vite.config.js](../../vite.config.js))
  rewrote only the `index.html` title / logo filename / theme color; it did **not**
  rewrite origins, and `public/` ships identically to both brands (`dist/` vs
  `dist-supplylocker/`). So absolute URLs in meta / robots / sitemap could not be
  brand-correct via static files alone.

## What changed

### 1. PWA manifest + icon set (commit `af1e2d7`)

| File | Change | Why |
|---|---|---|
| [scripts/generate-pwa-icons.mjs](../../scripts/generate-pwa-icons.mjs) | New `sharp`-based generator: `logo192/512`, `apple-touch-icon-180`, and `logo-maskable-192/512` (logo scaled to the inner-80% safe zone, centered on white) | Deterministic regeneration of committed binary icons. Maskable variants keep the emblem inside the safe zone so Android/Chrome's circle mask doesn't crop it. |
| [public/manifest.json](../../public/manifest.json) | Rewrote `icons` to four valid entries — 192 + 512 `purpose:"any"`, 192 + 512 `purpose:"maskable"` (separate entries, not combined); added `id`/`scope`/`lang`/`dir`; dropped the broken `screenshots` array and per-shortcut icon refs | Real, resolvable install icons; per-spec separate `any`/`maskable` purposes; no dangling references. The 3 shortcuts are kept (icon-less). |

### 2. SEO + social meta + iOS hints (commit `b41ff7b`)

- [index.html](../../index.html): added `canonical`, `robots` (`index, follow`), full
  Open Graph (`type`/`site_name`/`url`/`title`/`description`/`image`/`image:alt`),
  Twitter `summary_large_image` card, the `apple-touch-icon-180` link, and the iOS
  standalone metas (`mobile-web-app-capable`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`). `og:image:alt`
  is brand-neutral ("VA disability claims toolkit logo").
- [vite.config.js](../../vite.config.js): added `url` to both `BRAND_CONFIGS`; extended
  `brandingPlugin.transformIndexHtml` to rewrite the title, the og/twitter title and
  description copies, the app name, the origin, and the analytics host. The og/twitter
  tags reuse the **exact** title/description strings so the plugin's global regexes
  rewrite every copy in one pass.

### 3. Brand-aware `robots.txt` + `sitemap.xml` (commit `807bf6f`)

- [vite.config.js](../../vite.config.js): new `seoFilesPlugin` emits both files at build
  via `generateBundle`, using the brand's origin. They **cannot** be static `public/`
  files because the absolute origin differs per brand. The sitemap lists the indexable
  surfaces only (`/`, `/faq.html`, `/support.html`, `/terms-of-service.html`,
  `/privacy-policy.html`) — the offline shell and vision-test page are intentionally
  excluded — with no `lastmod`, so the output is deterministic.

### 4. PWA + SEO gate + lhci SEO assertion + CI job (commit `ab5f6f2`)

- [tests/e2e/pwa.spec.ts](../../tests/e2e/pwa.spec.ts) (chromium project, 7 tests):
  the manifest is linked and parses; **every** icon it declares loads as a real PNG
  (directly guards the broken-icon regression); apple-touch-icon + favicon resolve;
  the SEO/OG/Twitter meta are present and brand-correct; **no PII** leaks into any
  crawler-visible `<meta>`; and the service worker serves the app shell offline.
- The SW offline test **registers the worker manually** — the app only registers it
  under `import.meta.env.PROD`, so it never auto-registers on the Vite dev server the
  spec runs against. The test exercises the SW's own caching contract (precache →
  offline navigation → cached shell), not the app's PROD registration glue.
- [package.json](../../package.json): `test:e2e:pwa` script.
- [lighthouserc.json](../../lighthouserc.json): `categories:seo` **warn ≥ 0.9**,
  following the same informational → strict ratchet as the S14 LCP/TBT/perf budgets
  and `scripts/check-bundle-budget.mjs`.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml): new blocking `pwa` job
  (`needs: [build]`), modeled on the `cwv`/`axe` gates, runs `npm run test:e2e:pwa`.

## Verification

| Gate | Result |
|---|---|
| `npm run lint` | **0 errors** / 2721 warnings (unchanged baseline; the 2 `gc` no-undef are the known worker false-positives) |
| `npm run type-check` (`tsc --noEmit`) | **clean** (e2e specs are outside the tsconfig `include`; Playwright type-checks them at run) |
| `npm run test` (vitest) | **809 passed** / 47 files |
| `npm run test:e2e:pwa` | **7 passed** (chromium): manifest link + parse + icons-load + apple/favicon + SEO meta + no-PII + SW offline shell |
| `vite build` (vetrate) · `npm run build:supplylocker` | both clean |
| `robots.txt` / `sitemap.xml` | vetrate → `https://vet-rate.org`, supplylocker → `https://supplylocker.vet` — both origins verified in their respective dist trees |
| Built `index.html` head (per brand) | brand-rewritten: supplylocker `dist-supplylocker/index.html` shows `canonical`/`og:url` = `https://supplylocker.vet/`, `og:site_name` = "Supply Locker", `og:image` = `supply-locker-logo.png` |
| **Lighthouse SEO category** | **1.00** on all 3 mobile-throttled runs — every scored SEO audit passes; `categories:seo` warn ≥ 0.9 clears comfortably |

## Honest limits / out of scope

- **Lighthouse 12 removed the PWA category**, so "lhci PWA pass" is no longer assertable
  as a Lighthouse category. PWA correctness is instead proven directly by the Playwright
  spec (manifest validity + all icons load + offline shell) — a stronger, deterministic
  check than the old category score.
- **The local lhci run's performance / LCP numbers in this session are unreliable** —
  lhci's `startServerReadyPattern` (`/Local:/i`) timed out under the alternate-port
  override, so Lighthouse navigated against a not-yet-ready preview and recorded a ~30s
  LCP. Performance was validated clean in S14 (LCP 1837ms / perf 0.99) and the CI
  `lighthouse` job (Linux) is authoritative. Only the **SEO** score (1.00, server-state
  independent) is taken from this run.
- **The SW offline spec runs against the dev server with a manual registration** because
  the app's registration is PROD-only. It verifies the worker's caching contract, not
  the PROD registration/update glue (`useUpdateOrchestrator`); the live install + update
  flow remains an owner-run manual device check.
- **`robots.txt` / `sitemap.xml` are build-emitted** (absent on the dev server), so their
  validity is verified here from the build output rather than in the e2e spec.
- **The supplylocker `manifest.json` icons and apple-touch-icon still ship vet-rate-branded
  PNGs.** `public/` is not brand-transformed for binary assets, so the manifest's
  `/images/logo192.png` etc. resolve to the vet-rate emblem under the supplylocker build.
  The `index.html` `og:image` / favicon / logo filename **are** rewritten by the plugin
  (`supply-locker-logo.png`, which exists) because they live in HTML; the static manifest
  icon `src`s are not. Documented residual — closing it needs a per-brand icon pass
  (`generate-pwa-icons.mjs` already supports pointing `SOURCE` at `supply-locker-logo.png`).
- **Owner manual checks:** install on real Android + iOS, relaunch offline, and validate
  social cards in a sharing debugger (per the plan's verification matrix).
- **Windows-local note:** stale `node` processes from a prior session held the default
  lhci port 4173; the SEO capture was run on an alternate port to avoid killing
  processes (no authorization for that). The CI run uses 4173 on a clean runner.
