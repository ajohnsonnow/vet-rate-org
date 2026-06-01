# Sprint Plan — Cycle S9–S17: Mobile + Quality Audit Remediation

> Companion to [SPRINT_PLAN.md](./SPRINT_PLAN.md) and the scoreboard in [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md). The prior cycle (S2–S8) closed 36/40 best‑practice rows. **This cycle front‑loads mobile** — the headline gap that cycle never tackled — then closes the remaining quality/best‑practice gaps. Created 2026‑05‑31.
>
> Status legend: `planned` · `in-progress` · `done` (with evidence) · `deferred` (justified)

---

## Context

Vet‑Rate.org is a mature React 18 + Vite 6 + Tailwind 3 privacy/local‑first PWA (~80+ components, on‑device AI) that helps service‑disabled veterans navigate VA disability claims.

**Why this cycle:** the owner reports **"the current mobile layouts do not work at all"** and wants a comprehensive pass to the highest quality standards. The app literally ships a `SmallScreenWarning` below 640px reading *"VetRate is optimized for tablet and desktop screens. Some features may not work properly on smaller devices."* — a standing confession that mobile was never finished. This plan **extends** the existing scoreboard; it does not duplicate completed work.

**Verified scope (direct reads, not assumptions):**

- [src/App.jsx](../src/App.jsx) is **already a lean 140‑line shell** — the "3,913‑line monolith" in AUDIT_FINDINGS is historical (S2). **No App.jsx split is planned.**
- [tailwind.config.js](../tailwind.config.js) **already** defines mobile tokens: `xs/tablet/tablet-lg/tablet-landscape/tablet-portrait/touch/no-touch` breakpoints, `safe-top/bottom/left/right` (env safe‑area), `min-h/w touch:44px`, AAA 3px focus rings. **The tokens exist; components don't use them.**
- Mobile defect scale: **~87 hardcoded `grid-cols-{3..8}` with no responsive prefix (51 files); ~125 oversized `max-w-{4xl..7xl}` (93 files); ~91 `max-h-[85/90/95vh]` modals (79 files)**; 13 scattered `innerWidth`/`matchMedia` detections; floating buttons collide with the 70px `MobileBottomNav`; two contradictory banners (`SmallScreenWarning` vs `MobileNotice`).
- `ErrorBoundary` is **genuinely absent** (grep = 0). No focus‑trap utility exists.
- ESLint = legacy [.eslintrc.json](../.eslintrc.json) with only `eslint:recommended` + `plugin:react`; **missing `eslint-plugin-jsx-a11y` and `eslint-plugin-react-hooks`**; `no-console:"off"`.
- CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs lint/test/build/e2e/red‑team/security but has **no `type-check` job, no Lighthouse/CWV gate, no mobile/visual‑regression gate**.
- Reusable assets already present: [useBodyScrollLock.js](../src/utils/useBodyScrollLock.js), [useDeviceCapability.js](../src/utils/useDeviceCapability.js), [MobileBottomNav.jsx](../src/components/MobileBottomNav.jsx) (+`MobileNavSpacer`), [bugReportUtils.js](../src/utils/bugReportUtils.js), [ToastContext.jsx](../src/contexts/ToastContext.jsx), [webVitals.js](../src/utils/webVitals.js) (exposes `window.__VITALS__`), [src/components/common/](../src/components/common/) (Tooltip, ErrorBanner), [src/hooks/](../src/hooks/), [scripts/preflight-extras.mjs](../scripts/preflight-extras.mjs).

**Owner decisions for this cycle:** mobile baseline = **360 / 390 / 768px** (iOS Safari = manual device check); **include** key‑rotation + device‑deauth, LanguageContext i18n split, and console→logger migration in the program.

---

## Mobile Remediation Architecture (centerpiece)

Sequenced **safety‑net → primitives → systematic refactor → proven by tests**.

### Layer 1 — CSS safety‑net (immediate relief, S9)
One consolidated, commented block in [src/index.css](../src/index.css) (de‑duping the existing mobile blob) that, on `<768px`/`touch`, neutralizes the worst defects **without touching the 90+ offending components**:

- Modal caps: `.modal-content`, `[role="dialog"] > *` → `width:100%; max-width:100vw; max-height:100dvh` (kills the 125 oversized + 91 vh‑locked modals at once).
- `dvh` migration with fallback: replace the `max-h:90vh` modal rule with `100dvh` + `@supports not (height:100dvh){ …vh }`. `dvh` fixes "action button below the URL bar"; `env(safe-area-*)` stays for notch/home‑indicator (complementary, never dvh‑only).
- `.above-mobile-nav { bottom: calc(70px + env(safe-area-inset-bottom) + 1rem) }` on `FloatingBugButton`, `AIAssistantBubble`, `UpdateBanner` so they clear the `md:hidden` bottom nav.
- Overflow guards + touch‑scrollable tables.

### Layer 2 — Shared primitives (S9)

| Path | Responsibility | Reuses |
|---|---|---|
| `src/hooks/useBreakpoint.js` (+`useIsMobile`) | single SSR‑safe `matchMedia` source reading Tailwind tokens (kills 640‑vs‑768 split); returns `{width,bp,isMobile(<768),isTablet,isTouch,isLandscape}` | feeds `useDeviceCapability.js` |
| `src/hooks/useFocusTrap.js` | trap focus + ESC + restore focus to opener | — (none exists) |
| `src/components/common/ResponsiveModal.jsx` | mobile‑first modal shell: `size` prop sets desktop ceiling, mobile full‑bleed; `max-h-[100dvh] sm:max-h-[90dvh]` flex column with sticky header + sticky footer CTA bar; single `overflow-y-auto` body; safe‑area + `MobileNavSpacer`; dialog a11y | `useBodyScrollLock`, `useFocusTrap`, `MobileNavSpacer` |

### Layer 3 — Systematic refactor (S10 + trailing clusters)
- Modals → `ResponsiveModal`, worst‑overflow first (MyPacket, CAPSimulator, BDDBuilder, CFileAnalyzer, TacticalCalculator). One cluster per PR; preserve nested z‑60 child modals.
- **Grid fix = codemod‑assisted, human‑reviewed (NOT blind regex).** Reporting‑only codemod → clean/ambiguous buckets; mechanical `grid-cols-1 sm:grid-cols-2 md:grid-cols-N` only on the clean bucket per cluster with visual review; exclude `index.css` literals + string‑builders. Never bulk auto‑commit.
- Consolidate the 13 detections onto `useBreakpoint`.
- **`SmallScreenWarning` removal is GATED** on the mobile suite green across the top‑20 surfaces (S10 exit). `MobileNotice` copy reconciled.

### Proving mobile works
`tests/e2e/mobile.spec.ts` under the `mobile-chrome` (Pixel 5, 393px) project + pinned **360px and 768px**. Per surface: root `scrollWidth ≤ clientWidth+1`; every primary CTA `getBoundingClientRect().bottom ≤ innerHeight`; tap targets `≥44×44`; then dispatch each top‑20 modal `open*` event and re‑run inside the modal. Promote `mobile-chrome` to a **blocking** CI job once green.

**Honest limit:** real iOS Safari URL‑bar/notch and screen‑reader gestures are owner‑run manual checklist items.

---

## Sprint Plan (S9–S17)

| # | Theme | Key deliverables | Definition of done | Effort | Toolkit guide |
|---|---|---|---|---|---|
| **S9** | Mobile emergency safety‑net + primitives | index.css safety‑net; `useBreakpoint`/`useIsMobile`, `useFocusTrap`, `ResponsiveModal`; quiet `MobileNotice` on phones; `mobile.spec.ts` skeleton | Home + 3 worst modals: zero overflow @360/390/768 with safety‑net only; primitives unit‑tested; desktop snapshots unchanged | M | frontend‑react, pwa‑privacy |
| **S10** | Systematic mobile refactor + mobile CI gate | Migrate top‑15 modals to ResponsiveModal; grid codemod worklist + clean‑bucket apply + hand‑fix; 13 detections → `useBreakpoint`; promote `mobile-chrome`+360/768 to blocking CI; delete SmallScreenWarning (gated); reconcile MobileNotice | `mobile.spec.ts` green across top‑20 @360/390/768; SmallScreenWarning removed; CI mobile job blocking | L | frontend‑react, tooltip‑ux, codebase‑audit |
| **S11** | Error boundaries | `common/ErrorBoundary.jsx` wired to `bugReportUtils`+`ToastContext`; app‑level boundary; per‑cluster boundaries around `AppModals` children + `HomeMain`; mobile‑first fallback | Forced throw → fallback (not blank), one‑tap report stored, rest stays interactive; Playwright asserts recovery @360px | M | frontend‑react, developer‑experience |
| **S12** | Accessibility (WCAG 2.2 AA) | `useFocusTrap` across overlays; `role/aria-modal/labelledby` on the ~48 modals missing them; ESC + focus‑restore; verify skip‑link/`sr-only`/`focus-visible`; wire `vitest-axe`/`@axe-core` into CI; SR manual checklist | axe = 0 serious/critical on top‑20 (gated); every modal trappable + ESC + restore; skip‑link reachable | L | frontend‑react (a11y), tooltip‑ux |
| **S13** | ESLint hardening + type‑check gate | Add `jsx-a11y` + `react-hooks` at "warn", triage, ratchet high‑signal rules to "error"; `no-console`→"warn"; add `tsc --noEmit` CI job | plugins active + blocking new violations; `type-check` job green + blocking; backlog documented | M | developer‑experience, preflight‑checks |
| **S14** | Performance / Core Web Vitals on mobile | Lighthouse‑CI gate (mobile + throttled) — deferred piece of finding #33; Playwright CWV via `window.__VITALS__`; image `width/height`, `fetchpriority`+preload hero, lazy below‑fold; verify modal‑open INP | lhci mobile ≥ budget (LCP≤2.5s / INP≤200ms / CLS≤0.1); Playwright CWV gate green | M | performance‑engineering |
| **S15** | PWA/offline + SEO/meta | PWA audit (manifest, maskable icons, install, SW offline smoke, update); per‑page title/desc/canonical/OG/twitter; `robots.txt` + `sitemap.xml`; no PII in meta | lhci PWA + SEO pass; offline Playwright smoke green; robots/sitemap valid | S/M | pwa‑privacy, seo, zero‑knowledge‑local‑first |
| **S16** | Local‑first security residuals | Implement **key‑rotation + device‑deauthorization** on local‑first storage; resolve `piiScrubber` 3 TODOs with red‑team cases; formalize lhci sign‑off | rotation + deauth implemented + tested; piiScrubber TODOs closed; scoreboard updated | M | zero‑knowledge‑local‑first, ai‑agent‑security |
| **S17** | Maintainability: i18n split + logging | Split 16,763‑line `LanguageContext.jsx` into lazy per‑locale JSON; migrate ~1,200 `console.*` → existing `logger` (verify/create `src/utils/logger.js`) | per‑locale lazy load verified; initial bundle reduced; context unit‑tested; `no-console` ratcheted to "error" | L | file‑organization, observability‑monitoring |

Each sprint is independently shippable and verifiable.

---

## Verification Matrix (* = manual‑only, owner‑run)

| Workstream | Automated proof | Manual* |
|---|---|---|
| Mobile layout | `mobile.spec.ts` @360/390/768: no overflow, CTAs in viewport, tap≥44, per‑modal | * iOS Safari URL‑bar/notch; one‑handed reach |
| ResponsiveModal | unit: trap cycles+restores; e2e: open each modal, no overflow, ESC closes | * VoiceOver/TalkBack swipe order |
| ErrorBoundary | Playwright injected throw → fallback, app live, report stored | — |
| Accessibility | `vitest-axe`/`@axe-core` = 0 serious/critical (gated); keyboard tab/skip‑link e2e | * NVDA + VoiceOver + TalkBack full pass |
| ESLint/type‑check | jsx‑a11y+react‑hooks blocking; `tsc --noEmit` job green | — |
| CWV/perf | lighthouse‑ci mobile budget; Playwright reads `window.__VITALS__` | * field/RUM on real low‑end Android |
| PWA/offline | lhci PWA; offline Playwright smoke; SW update e2e | * install on real Android + iOS |
| SEO | lhci SEO; robots.txt + sitemap.xml validate | * Search Console / OG debugger |
| Key‑rotation/deauth, piiScrubber | unit + red‑team cases | — |
| i18n split / logging | i18n unit + lazy‑load test; `no-console` lint ratchet | — |

---

## Risks & Mitigations
- **Grid codemod over‑reach (87 sites):** reporting‑only codemod → clean/ambiguous buckets; per‑cluster apply with visual review; exclude `index.css` literals + string‑builders; never bulk auto‑commit.
- **ResponsiveModal migration touches 30+ modals incl. nested z‑60 children:** one cluster per PR; before/after visual snapshot; desktop snapshot must not move.
- **Removing `SmallScreenWarning` early** re‑exposes broken UI as "supported": removal gated on the mobile suite green (S10 exit).
- **Safety‑net CSS fighting component classes / over‑broad `max-width:100%`:** scope to `<768px`+`touch`; prefer caps on `.modal-content`/`[role=dialog]`; verify desktop snapshots after each edit.
- **`dvh` support:** ship with `@supports not (height:100dvh)` `vh` fallback; never dvh‑only.
- **ESLint ratchet breaking CI day one:** new plugins at "warn"; ratchet per rule once backlog drained.
- **i18n split regression (16.7k lines):** verify structure first; migrate locale‑by‑locale behind tests; keep `en` inline until lazy load proven.

---

## Out‑of‑Scope / Backlog (with rationale)
- **Artifact signing (Cosign/SLSA), branch protection, CODEOWNERS** — GitHub project‑settings layer, not repo code.
- **Remote telemetry (OTel/Sentry/Datadog)** — rejected by design under the zero‑knowledge stance (finding #38); local `logger` only.
- **Promptfoo/PyRIT live‑LLM red‑team** — no live endpoint in CI; deterministic local suite stands.
- **Safari/Edge desktop E2E** — requires macOS/Windows runners; covered by manual checklist for now.

---

## Progress Log

- **2026‑05‑31** — Cycle planned. S9 in progress on branch `audit/s9-mobile-safety-net`.
- **2026‑05‑31** — S9 complete + committed (primitives, CSS safety‑net, mobile.spec.ts; full suite green). S10 **discovery** done via the `s10-discovery` workflow and verified by completeness critics — worklist at [audit/S10_WORKLIST.md](audit/S10_WORKLIST.md), raw output at [audit/s10-discovery.json](audit/s10-discovery.json). Key corrections recorded there: ~103 modal surfaces (not ~30); the grid inventory is an unreliable ~4× undercount and needs a fresh codemod pass before any apply; only 1 of 25 detections is safely migratable to `useBreakpoint`; the mobile e2e already runs in CI (blocking lever is GitHub branch protection, out of repo). **Paused before S10 code edits at owner request.**
