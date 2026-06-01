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
  DisclaimerSplash, ContactUs, TermsOfServiceModal, PrivacyPolicyPage, TimeMachine.
- **Cluster B — no-max-h modals (migration is pure overflow fix):**
  RetroPayHunter, DemoDashboard, VaIntegrationTest, MissionProtocol, StateBenefitHunter.
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
