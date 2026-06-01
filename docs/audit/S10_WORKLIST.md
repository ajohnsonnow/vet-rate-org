# S10 Discovery Worklist (mobile systematic refactor)

> Generated 2026-05-31 by the `s10-discovery` workflow (7 agents, verified by two
> independent completeness critics). Raw structured output: [s10-discovery.json](s10-discovery.json).
> This is the authoritative input for S10 execution. Paused here at owner request
> (usage limit) **before any code edits** — resume from "Execution clusters" below.

## Headline corrections to the S9–S17 plan (from critic verification)

1. **Modal surface count ≈ 103, not ~30.** The event-driven scan captured ~93; the
   critic added ~10 surfaces it structurally missed + flipped 3 nested flags.
   S10's "top-15" target is the high-risk head; the long tail continues as trailing
   clusters (S10→S12). Do **not** treat full migration of all 103 as in-scope for one sprint.
2. **The grid worklist in s10-discovery.json is NOT safe to apply.** Verified
   undercount: ~200 `grid-cols-*` across 94 files (excl. index.css), vs 47/32 reported.
   The "clean" bucket is unreliable — items with `col-span-*` children against a fixed
   track count were mislabeled clean. **Re-run a dedicated grid codemod pass with a
   `col-span`/fixed-child detector before touching any grid.** Treat existing grid items as
   leads, not a worklist.
3. **Detection consolidation is mostly a no-op.** 25 detections found; only **1** is a
   genuine viewport-breakpoint decision safe to move onto `useBreakpoint`:
   `SmallScreenWarning.jsx:15` (`window.innerWidth >= 640` guard → `useBreakpoint().width`,
   gains live resize reactivity). All others are physical `screen.*`, UA sniffing,
   `prefers-reduced-motion`/`prefers-color-scheme`/`display-mode` media features,
   element-box measurement (→ `ResizeObserver`, e.g. WebOfConditions.jsx:721), drag-clamp
   pixel math (AIAssistant.jsx), or non-component utils that can't call a hook. Leave them.
4. **The mobile e2e gate already runs in CI.** `tests/e2e/mobile.spec.ts` self-applies
   360/390/768 via `test.use({viewport})` and is picked up by `npx playwright test` in the
   `e2e` job (no `continue-on-error`). The only missing "blocking" lever is **GitHub
   branch-protection required checks**, which is repo-settings, not code (out of repo).
   In-repo improvement = a dedicated bisectable `e2e-mobile` job + a `test:e2e:mobile`
   package script (mirrors the `red-team` job pattern).

## Warnings reconciliation (S10)

- **SmallScreenWarning** — rendered once in [AppShellOverlays.jsx:24](../../src/features/app-shell/AppShellOverlays.jsx#L24)
  (via App.jsx:129). Trigger: `innerWidth < 640` on mount, dismissal in sessionStorage
  `vetrate-small-screen-dismissed`. Copy: "VetRate is optimized for tablet and desktop…".
  **Removal GATED** on the mobile suite green across the top-20 surfaces (no overflow,
  CTAs in viewport ≤innerHeight, tap≥44, per-modal) — never remove early.
- **MobileNotice** — the `isPhone` branch is now **dead code** after S9 (deviceType is only
  `'tablet'|null`). It still ships the contradictory "90% of veterans use mobile — built for
  you" copy. **Minimal immediate cleanup: prune the dead `isPhone` branch** (emerald banner,
  the "90%/built for you" lines, isPhone aria-label/emoji), collapsing it to the tablet-only
  notice it already is. Leaves SmallScreenWarning as the single small-screen source of truth
  until the gate removes it.

## Execution clusters (modal → ResponsiveModal)

ResponsiveModal API: `isOpen, onClose, title, size(sm|md|lg|xl|2xl|full), children, footer,
closeOnBackdrop, labelledBy`. Renders at **z-[60]** — nested children must move to z-[70]+.
Pattern per modal: replace the `fixed inset-0…` wrapper + panel with `<ResponsiveModal>`,
move body → `children`, primary CTA → `footer`, drop the bespoke close button / scroll lock /
backdrop handler (the shell owns them). Verify desktop snapshot unmoved + extend mobile.spec.ts.

- **Cluster A — quick clean wins (low risk, role=dialog + clear CTA), prove the pattern:**
  **DisclaimerSplash ✅**, **ContactUs ✅**, **TermsOfServiceModal ✅**, **PrivacyPolicyPage ✅**, **TimeMachine ✅**.
  **Reality check (during execution):** ContactUs + PrivacyPolicyPage were the genuine clean
  fits (plain title + close CTA). The other three needed the additive header slot first:
  - *DisclaimerSplash* (z-100) and *TermsOfServiceModal* (z-99) are **mandatory consent gates**
    — no close button, must-not ESC/backdrop-dismiss, custom gradient header, a read-gate
    countdown (ToS). **Now migrated** (commit `74ec944`) using the `header` slot +
    `showClose={false}` + `dismissable={false}` + `zIndex` + `backdropClassName` (splash's
    branded gradient scrim). Behavioral contracts preserved; the un-seeded `consent gates`
    block in mobile.spec.ts proves the footer CTA stays in view at 360/390/768.
  - *TimeMachine* is **dual-mode** (`isWidget` inline vs. full modal) with an urgency-colored
    gradient header that varies by state. **Now migrated** (commit `18fcc9e`): the full-modal
    branch uses the header slot (urgency gradient + ReportBugLink + close); the `isWidget` inline
    branch is untouched. `useBodyScrollLock` dropped (shell owns it).
- **Cluster B — no-max-h modals (migration is pure overflow fix): all ✅.**
  - **MissionProtocol ✅** — permanently-dark (gray-900 + va-gold); header slot for the gradient
    banner, `className="!bg-gray-900 border-2 border-va-gold"` forces the dark panel, "Roger That"
    button kept in the body (shell's light footer slot would clash). MODALS group (overflow).
  - **StateBenefitHunter ✅** — standard-themed; header slot (green gradient + ReportBugLink +
    close), `size="xl"`, and the BuyMeCoffee + Close bar moved to the sticky **footer slot**.
    MIGRATED_MODALS group (sticky-CTA-in-viewport contract).
  - **RetroPayHunter ✅** — permanently-dark; header slot (amber gradient), dark-panel override
    `className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700"`, disclaimer +
    BuyMeCoffee footer kept in body as a `bg-gray-800/50` card. MODALS group (overflow).
  - **DemoDashboard ✅** + **VaIntegrationTest ✅** — standard-themed, `size="2xl"` (`max-w-5xl`→
    `max-w-6xl`); full hero (title + embedded `grid-cols-5` status bar) → header slot. DemoDashboard
    wraps its full-bleed body sections in `-mx-4` (cancels the shell's `px-4` so the `border-b`
    dividers reach the panel edge) and puts the status line in the footer slot; VaIntegrationTest
    renders its nested `VaSandboxTest` (own root `z-50`) in a `relative z-[70]` wrapper to clear the
    shell's z-60. **Both gated behind `isVaApiEnabled()`** (build-time `VITE_VA_API_ENABLED`, off by
    default) so they never mount in the standard build — migrated and type-checked, but **not
    e2e-coverable here**; manual check in a VA-demo build. *Follow-up:* their header rows pack an
    inline action button next to the close-X in a `justify-between` flex — verify the close stays
    reachable (add `flex-wrap`) when exercised on a phone in a demo build.
- **Cluster C — medium single-CTA tools:** SecondaryScoutLauncher, NexusBuilder,
  DecisionDecoder, WorkflowGuide, SymptomLogger, VAResources, LegislativeWatchdog,
  MOSHazardMatcher, VSOFinder, MillionDollarDashboard, RedTeam.
- **Cluster D — multi-step wizards (footer nav = Continue/Submit):** TDIUBuilder, BDDBuilder
  (max-h-95vh), WitnessBench, PACTActNavigator, RiskAssessment, FOIAGenerator, FormsHelper, DD214Analyzer.
- **Cluster E — wide tables / page-scroll → size='full':** SecondaryScout (max-w-7xl),
  ConsistencyEngine (2 shells, max-w-7xl), CommunityRoadmap (z-100, max-w-7xl), CFileAnalyzer
  (upload+results 2 shells), VAAITransparency, RecordSearch, MusterCall.
- **Cluster F — nested children (z-index care, migrate child → its own ResponsiveModal):**
  MyPacket (4 nested z-60 + confirm), CAPSimulator (8 shells in one file), VKBTimeline,
  VKBViewer, PainPainter (nested confirm), BackupManager (2 confirms), ClaimNavigator,
  TacticalCalculator (nested @2507), DD214Analyzer→DD214FormBuilder (z-9999),
  PublicationsLibrary→PublicationDetailsModal, Pathfinder→File-Drop-In.
- **Cluster G — graphic/SVG reflow (hardest; may need layout work, not just shell):**
  BodyMapSelector, WebOfConditions (force graph), EvidenceGapVisualizer, UserManual (two-pane
  sidebar must stack), BlueButtonXRay (dense tables), EvidenceTimeline.
- **Critic-added surfaces to fold in:** RegulationsReference (opened via VAResources state, not
  an event), TermsOfServicePage (full-page variant ≠ TermsOfServiceModal), VisionSimulator
  (AppModals:126), StressReliefDivision (z-9999 easter egg), FeatureLookup/BugLookup (admin shells).

## S10 order of operations (when resumed)

1. Prune MobileNotice dead phone branch (safe, immediate).
2. Migrate Cluster A (prove pattern + extend mobile.spec.ts to cover each), commit.
3. Migrate Cluster B, then C — one cluster per commit, e2e after each.
4. Fresh grid codemod pass (with col-span detector) → apply clean bucket per-cluster w/ review.
5. Clusters D–G as capacity allows; the rest become trailing clusters.
6. SmallScreenWarning removal **only after** the top-20 mobile suite is green.
7. Add `e2e-mobile` CI job + `test:e2e:mobile` script; note branch-protection is owner-run.
8. S10 verification gate: full lint/type/unit/e2e green; desktop snapshots unmoved.

## S10 progress (live)

- **Cluster B + TimeMachine migrated (type-check + 803 unit + 0 lint errors + 108 mobile e2e
  @360/390/768 across chromium/firefox/mobile-chrome):**
  1. **TimeMachine** (commit `18fcc9e`) — full-modal branch → ResponsiveModal via the urgency
     header slot; `isWidget` inline branch untouched.
  2. **Cluster B** — MissionProtocol, StateBenefitHunter, RetroPayHunter migrated to the shell
     (header slot; dark panels override `className` and keep their action bar in the body, the
     standard StateBenefitHunter uses the sticky footer slot). DemoDashboard + VaIntegrationTest
     also migrated but are `isVaApiEnabled()`-gated (off by default) so they don't mount in the
     standard build — not e2e-coverable here (manual check in a VA-demo build). See the Cluster B
     list above for the per-modal detail.
  3. **mobile.spec.ts** — added MissionProtocol + RetroPayHunter to the `MODALS` (overflow) group
     and StateBenefitHunter to `MIGRATED_MODALS` (sticky-CTA) group; documented why the two
     VA-demo modals are excluded.
- **Gates migrated (commit `74ec944`; type-check + 803 unit + 0 lint errors + 24 mobile e2e @360/390/768):**
  1. **ResponsiveModal** gained an additive `backdropClassName` prop (default `bg-black/60`
     preserved) on top of the prior `header`/`showClose`/`dismissable`/`zIndex` enhancement.
  2. **DisclaimerSplash** → ResponsiveModal (`size="lg"`, `dismissable={false}`,
     `showClose={false}`, `zIndex={100}`, gradient header, branded `backdropClassName`; the sole
     acknowledge button is the sticky footer, preserving the e2e "last button" contract).
  3. **TermsOfServiceModal** → ResponsiveModal (`size="xl"`, `dismissable={false}`,
     `zIndex={99}`, red warning header, read-gate countdown on the footer Accept button; still
     reads/writes `vet-rate-tos-accepted` and dispatches `tosAccepted`).
  4. **mobile.spec.ts** — returning-user fixture (seeds all first-run keys) + `openModalByEvent`
     re-dispatch helper + a dedicated un-seeded `consent gates` block covering both gates; the
     overflow metric now discounts bleed contained by an ancestor
     `overflow-x:hidden/clip/auto/scroll` (fixes false positives from a clipped header flourish
     in TacticalCalculator and the intentional scrollable tab bar in MyPacket — `getBoundingClientRect`
     returns the unclipped box). Document scroll still asserted via `pageOverflow`.
- **Done & verified (type-check + 798 unit + 0 lint errors + 18 mobile e2e @360/390/768):**
  1. MobileNotice dead `isPhone` branch pruned → tablet-only banner; dropped the now-unused
     `useLanguage`.
  2. **PrivacyPolicyPage** → ResponsiveModal (`size="xl"`, header `ReportBugLink` relocated to
     the sticky footer beside Close).
  3. **ContactUs** → ResponsiveModal (`size="lg"`; the `type="submit"` Send button stays inside
     the `<form>` in `children` — ResponsiveModal's `footer` renders outside the form, so it
     can't host a submit. Footer carries Close + relocated `ReportBugLink`). Dropped
     `useColorSchemas`/`useBodyScrollLock` (shell owns scroll lock).
  4. **mobile.spec.ts** extended: a `MIGRATED_MODALS` group asserts the ResponsiveModal contract
     (sticky `.modal-footer` button stays within the viewport) at all three baselines.
- **Gate validity fix (important):** the spec now pre-dismisses `SmallScreenWarning` via
  `addInitScript(sessionStorage…)` in `beforeEach`. Before this, at <640px the warning's
  `.fixed.inset-0 z-[100]` overlay satisfied the "overlay found" poll *before* the lazy modal
  loaded, so the existing modal tests were racing / measuring the warning, not the modal. The
  warning has **no** `role="dialog"`, which is why the strict footer assertion caught it.
- **Primitive gap resolved:** the additive ResponsiveModal enhancement — `header` node slot,
  `showClose`, `dismissable` (ESC/backdrop), `zIndex` override (commit `a460126`), and
  `backdropClassName` (commit `74ec944`) — is in place and backward-compatible (ContactUs/
  PrivacyPolicy plain-`title` path untouched). The consent gates are migrated; TimeMachine +
  the remaining rich-header modals (Clusters B–G) are the next targets, one cluster per commit.
