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
- **Cluster C — medium single-CTA tools: all ✅** (C1 `f074b97` standard-light → MIGRATED_MODALS;
  C2 `cb435bc` dark/nested → MODALS). SecondaryScoutLauncher, NexusBuilder (not e2e-listed),
  DecisionDecoder, WorkflowGuide, SymptomLogger, VAResources, LegislativeWatchdog,
  MOSHazardMatcher, VSOFinder, MillionDollarDashboard, RedTeam. See progress log for detail.
- **Cluster D — multi-step wizards: all ✅** (D1 `1b796a1`, D2 `f86066d`). TDIUBuilder, BDDBuilder
  (max-h-95vh), WitnessBench, PACTActNavigator, RiskAssessment, FOIAGenerator, FormsHelper, DD214Analyzer.
  Per-step nav lives in-body (overflow contract); only DD214Analyzer's single action bar uses the footer slot.
- **Cluster E — wide tables / page-scroll → size='full': all ✅** (`4d4f3cc`). SecondaryScout
  results, ConsistencyEngine (2 shells), CommunityRoadmap, CFileAnalyzer, VAAITransparency,
  RecordSearch, MusterCall → size="full". See progress log for grouping detail.
- **Cluster F — nested children (z-index care, migrate child → its own ResponsiveModal): all ✅**
  (F1 `e603d00`, F2 `e1971b4`, F3 `bcc194a`, F4 `ed9413c`, F5 `885a9c5`, F6 `9cbfb74`,
  F7 `eb43814`, F8 `5cc1556`, F9 `7e1fc4a`). MyPacket (4 nested z-60 + confirm), CAPSimulator
  (7 shells in one file), VKBTimeline, VKBViewer, PainPainter (nested confirm), BackupManager
  (2 confirms), ClaimNavigator, TacticalCalculator (nested @2507), DD214Analyzer→DD214FormBuilder
  (z-9999), PublicationsLibrary→PublicationDetailsModal, Pathfinder→File-Drop-In, plus
  CloudSyncManager + DbqBrowser/PreFillModal/DbqShareMenu (BackupManager-nested follow-ups
  discovered during F3). See progress log for detail.
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

- **Cluster F migrated — all ✅ (F1 `e603d00` → F9 `7e1fc4a`; nine sub-commits, one per
  surface group, e2e after each):** nested-children modals where a child overlay had to become
  its own body-portaled ResponsiveModal to clear its parent shell. Stacking is now purely the
  inline `zIndex` (every instance `createPortal`s to `document.body`): parents at the default
  z-60, in-shell children at `zIndex={70}`, deeper children at `zIndex={80}`, and the
  DD214/`z-[9999]` cases preserved verbatim.
  1. **F1 (`e603d00`)** — made `useBodyScrollLock` **ref-counted** (a child no longer unlocks the
     body behind a still-open parent; single-modal behavior unchanged) — the foundation for the
     rest of the cluster. Migrated PublicationsLibraryModal (`size="2xl"`), PublicationDetailsModal
     (child `zIndex={70}`), DD214FormBuilder (`size="xl"` `zIndex={9999}`, section nav in header
     slot + Prev/Next/Save in footer slot). Publications Library → MODALS.
  2. **F2 (`e1971b4`)** — VKB pair. VKBTimeline (dark `size="2xl"`) + VKBViewer (`size="2xl"`,
     data-gated header/footer, dropped createPortal + useBodyScrollLock, w-64 sidebar reflows to a
     horizontal scroller < sm); each `absolute inset-0` overlay (Comparison / LLM Context) became
     its own `size="xl"` sibling. Both → MODALS; nested children open only via interaction.
  3. **F3 (`bcc194a`)** — BackupManager (`size="xl"`; Confirm-Clear → `size="sm"` `zIndex={70}`
     sibling with footer CTA) + PainPainter (dark `size="2xl"`; Save Map → `size="sm"`
     `zIndex={70}` sibling). The CloudSyncManager + DbqBrowser launches were deliberately left
     intact here for independent migration (→ F8/F9). Both parents → MODALS.
  4. **F4 (`ed9413c`)** — ClaimNavigator nested Help (`size="lg"`, dark header, CTA in body; the
     main Mission Control surface stays a correct full-bleed takeover) + Pathfinder pair
     (PathfinderModal `size="2xl"`; File Drop-In child `size="md"` `zIndex={70}`). Pathfinder +
     Claim Navigator → MODALS.
  5. **F5 (`885a9c5`)** — MyPacket main (`size="2xl"`) + four nested viewers (Pain Map Detail /
     Form Viewer / Statement Viewer `size="xl"`, Import Confirm `size="sm"`), all lifted to
     `zIndex={70}`; packetContentRef wraps the body. My Packet → MODALS.
  6. **F6 (`9cbfb74`)** — CAPSimulator: all seven mode-branch modals (intro / exam-prep /
     exam-prep-detail / select-condition / flashcard / simulation / results) → the shell; two dark
     branches carry their gradient via className; the results branch stays headerless with an
     sr-only title + labelledBy. "C&P Simulator" → MODALS (opens in the intro branch).
  7. **F7 (`eb43814`)** — TacticalCalculator main (`size="2xl"`, header with ShareButton /
     ReportBugLink / close-X, footer kept as the last body element) + Edit Condition (`size="md"`
     `zIndex={70}`, Cancel/Save in the footer slot). VAGovRatingPaster (z-100) + Edit Condition
     are fragment siblings. The existing overflow probe moved into the F group (Edit Condition is
     `editingCondition`-gated — no bare event, exercised via flow).
  8. **F8 (`5cc1556`)** — CloudSyncManager (BackupManager-nested, permanently-dark green panel) →
     `size="xl"` `zIndex={70}` with the gradient via className. Not e2e-listed (no bare event; the
     `openCloudSyncManager` event mounts MultiCloudManager, not this).
  9. **F9 (`7e1fc4a`)** — DbqBrowser (`size="xl"` `zIndex={70}`), its PreFillModal (`size="lg"`
     `zIndex={80}`, Cancel/Continue in the footer slot) and DbqShareMenu (`size="md"`
     `zIndex={80}`, now owns its own backdrop); removed BackupManager's fixed-inset wrapper around
     `<DbqBrowser>`. All three are BackupManager-nested with no bare open* event → not e2e-listed.
- **Cluster E migrated — all ✅ (commit `4d4f3cc`; type-check + 803 unit + 0 lint errors +
  105 full mobile e2e @360/390/768 chromium, no regression):** wide-table / page-scrolling
  tools (legacy `max-w-6xl`/`max-w-7xl`) → `size="full"` so they go full-bleed on phones and
  keep a desktop ceiling. Two overflow-contract groups in `mobile.spec.ts`:
  - **MODALS (overflow-only probe):** Record Search, Consistency Engine, C-File Analyzer,
    Muster Call. Their footer slot carries status/disclaimer text or a CTA that is conditional
    and **absent on a fresh open**, so they are not asserted to have an in-viewport footer button.
  - **MIGRATED_MODALS (footer Close CTA probe):** VA AI Transparency, Community Roadmap.
  - **Not e2e-listed:** Secondary Scout *results* (DiscoverCluster wrapper) — migrated, but it
    mounts only via the launcher `onLaunch` flow with no bare `open*` event to dispatch (mirrors
    the existing NexusBuilder/DemoDashboard exclusions).
  ConsistencyEngine has **two** shells (AI tab `size="full"` `!bg-gray-900`; rules tab
  `size="2xl"`) sharing one `consistency-engine-title` id (never rendered together); its rules
  status grid gained `grid-cols-2 sm:grid-cols-4`. CFileAnalyzer's privacy-consent gate is
  lifted out of the body to a `z-[70]` Fragment sibling so its `fixed` overlay paints above the
  z-60 shell. MusterCall uses `dismissable={!processing}` to keep its lock-during-processing
  behavior (blocks ESC + backdrop close while a file is processing).
- **Cluster D migrated — all ✅ (D1 commit `1b796a1`, D2 commit `f86066d`; type-check +
  803 unit + 0 lint errors + 174 mobile e2e @360/390/768 across chromium/mobile-chrome):**
  multi-step wizards. Their per-step nav (Back/Continue/Submit) lives inside each step
  render in the scroll body, **not** a single shared footer, so the wizards assert the
  overflow contract (MODALS group) rather than the sticky-footer-CTA one. DD214Analyzer is
  the exception — it has one clean action bar, so it uses the footer slot (MIGRATED_MODALS).
  1. **D1 (`1b796a1`)** — TDIUBuilder, BDDBuilder, WitnessBench, PACTActNavigator,
     RiskAssessment, FOIAGenerator → shell via the header slot (gradient banner + badges +
     ReportBugLink + close), `size="2xl"` (legacy `max-w-6xl`). ShareButton content refs
     (TDIU, Witness) moved to a body wrapper `<div ref=…>`. The BuyMeCoffee/Luna popups in
     TDIU/BDD/PACT/FOIA (`fixed z-50`) lifted to `relative z-[70]` Fragment siblings to clear
     the z-60 shell; WitnessBench + RiskAssessment have no siblings (plain ResponsiveModal).
  2. **D2 (`f86066d`)** — the two complex-nested wizards, `size="xl"` (legacy `max-w-4xl`):
     - *FormsHelper* — header slot; footer slot = the privacy note only (no CTA button → MODALS
       group). ShareButton ref → body wrapper. BuyMeCoffee/Luna (`fixed z-50`) **and** the
       AIConsentModal gate (`fixed z-[60]`) lifted to `relative z-[70]` siblings.
     - *DD214Analyzer* — header slot + the Clear/Save/Analyze action bar relocated into the
       sticky **footer slot** (MIGRATED_MODALS). Its ProfileImportConfirmModal and the
       `z-[9999]` DD214FormBuilder both already `createPortal` to `document.body`, so they clear
       the shell without a lift wrapper.
  3. **mobile.spec.ts** — the 6 D1 wizards + FormsHelper added to `MODALS` (overflow);
     DD214Analyzer added to `MIGRATED_MODALS` (sticky-CTA). 162 → 174 tests.
- **Cluster C migrated — all ✅ (C1 commit `f074b97`, C2 commit `cb435bc`):** medium
  single-CTA tools.
  1. **C1 (`f074b97`)** — standard-light modals migrated with a rich header slot + sticky
     footer slot (encouragement/BuyMeCoffee + Close): DecisionDecoder, LegislativeWatchdog,
     RedTeam, VSOFinder, SymptomLogger, WorkflowGuide → `MIGRATED_MODALS` (Workflow Guide moved
     out of MODALS now that its Close CTA lives in the shell footer).
  2. **C2 (`cb435bc`)** — dark-panel / nested-child tools (footerless; actions stay in-body) →
     `MODALS` (overflow): MOSHazardMatcher, MillionDollarDashboard, SecondaryScoutLauncher,
     VAResources. Nested children clear the z-60 shell — VAGovRatingPaster already paints at
     z-100; RegulationsReference, AIConsentModal, DoctorsPacket and the BuyMeCoffee/Luna popups
     are wrapped in a `relative z-[70]` lift. NexusBuilder also migrated but is **not e2e-listed**
     — DiscoverCluster only mounts it once `nexusBuilderData` is set from the event detail, so a
     bare event never mounts it (exercised via the Secondary Scout "Learn how" flow manually).
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
