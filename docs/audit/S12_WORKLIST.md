# S12 Worklist — Accessibility (WCAG 2.2 AA)

> Cycle S9–S17, Sprint 12 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S12).
> Status: **in progress**. Branch `audit/s9-mobile-safety-net`, local commits only — no
> push/PR until the owner authorizes (standing instruction).

## Goal (S12 Definition of Done)

> `useFocusTrap` across all overlays; add `role="dialog"`/`aria-modal`/`aria-labelledby` to the
> modals missing them; ESC + focus-restore; verify skip-link/`sr-only`/`focus-visible`; wire
> `vitest-axe`/`@axe-core` into CI; author NVDA/VoiceOver/TalkBack manual checklist.
> **DoD:** axe = 0 serious/critical on top-20 (CI-gated); every modal trappable + ESC + restore
> (Playwright); skip-link keyboard-reachable; SR checklist drafted.

## Approach decision (owner, 2026-06-06)

For the ~38 **standard centered modals** that lack the dialog contract: **migrate to
[ResponsiveModal](../../src/components/common/ResponsiveModal.jsx)** rather than hand-apply
a11y in place. ResponsiveModal already wires `useFocusTrap` (trap + ESC via `onEscape` +
focus-restore on teardown), `useBodyScrollLock`, `role="dialog"`, `aria-modal="true"`,
`aria-labelledby` (`title` or `labelledBy`), and `createPortal` to `document.body`; migration
gets the full WCAG dialog contract *and* the mobile-first sticky-footer layout for free.
Bespoke-pattern overlays (safety-critical `alertdialog`, command palette, drawer, two-pane
shells, dropdowns) are **hand-applied** — migration would be semantically wrong for them.

## Source of the inventory

Read-only understand workflow (`s12-a11y-overlay-audit`, 13 agents) audited the **48 bespoke
`fixed inset-0` overlay files** (those not already on ResponsiveModal) → **63 overlay
surfaces**, each classified for kind / dialog semantics / focus trap / ESC / focus-restore /
gaps (SC-tagged) / severity. A completeness-critic pass caught 3 gap-text errors (below) and
the surfaces the 48-file grep missed. Every finding is **re-verified by reading the file before
editing** — the audit is the map and priority, not a license to edit blind.

### Critic corrections (do NOT act on the raw gap text for these)

- **CrisisModal** — already `role="alertdialog"` + `aria-modal` + `aria-labelledby` +
  `aria-describedby` + an `aria-live="assertive"` status region + `z-[9999]`. Only real gap:
  **no focus trap**. Do **not** add `createPortal`/`aria-live` (redundant); do **not** migrate
  (non-dismissible safety modal). Add `useFocusTrap` with ESC blocked (`onEscape` omitted).
- **AIConsentModal** — `aria-modal` is **already on the outer dialog div**. Only needs
  `useFocusTrap` + ESC. (hand-apply, not a fresh aria-modal.)
- **TheTribunal** — the "scroll lock blocks even when hidden" note is imprecise (parent-mounted,
  no `isOpen` prop). Real gaps stand → migrate.
- **StressReliefDivision / DoomOverlay** — already `role="dialog"` + ESC + label; only needs
  focus trap + `aria-modal` (closer to medium).
- **VADataCenter** — audit said "role/aria/portal present"; reading the file proved this **false**
  (no `role`/`aria-modal`/`aria-labelledby`, no ESC, no trap, unlabeled close button). The dual-use
  `embeddedMode` renders inline, so the full dialog contract was hand-applied only when
  `!embeddedMode` (role/aria conditional, `id` on the h2, `aria-label` on close, trap + ESC).
  Caught by read-before-edit — exactly why the audit is a map, not a license.

## Buckets

### A. Hand-apply a11y (~11 — migration would be wrong)

| Surface | Fix | Priority |
|---|---|---|
| `CrisisModal` | `useFocusTrap` (ESC **blocked**, autoFocus → Call button) | **#1 safety** |
| `VoiceInput` Safety Confirmation | see Bucket B (migrate, dismissable per flow) | — |
| `GlobalCommandSearch` | `useFocusTrap` under existing roving-tabindex; **don't migrate** | high |
| `Header` Mobile Menu Drawer | `useFocusTrap` + ESC + `role="dialog"` (drawer) | **high (mobile nav)** |
| `Header` Tools dropdown | `role="menu"` + ESC + focus mgmt | medium |
| `Header` Resources dropdown | `role="menu"` + ESC + focus mgmt | medium |
| `AboutUs` main modal | `useFocusTrap` + ESC (semantics present) | medium |
| `AboutUs` VersionDropUp | `role="menu"` + ESC + `aria-haspopup`/`expanded` | low |
| `AIConsentModal` | `useFocusTrap` + ESC (aria-modal already there) | high (cheap) |
| `VADataCenter` Primary | `useFocusTrap` + focus-restore (role/aria/portal present) | medium |
| `StressReliefDivision` DoomOverlay | `useFocusTrap` + `aria-modal` | medium |
| `FeatureLookup` main two-pane shell | top-level ESC + nested-pane focus mgmt | medium |

### B. Migrate to ResponsiveModal (~38 standard modals)

AIAssistant (Expanded), AICommandCenter, AdminLogin, AppealsLaneAdvisor, AtomicWipe ConfirmModal
(`dismissable=false`), BugLookup (main + Resolve), BugSquasher, ClaimEvidenceUpload,
CommandersChecklist ChecklistModal, DbqFinder, DemoDataLoader (card + link variants),
DoctorsPacket, DocumentIntelligenceBriefing, FeatureLookup StatusUpdateModal (nested),
FeatureRequest, HelperModeToggle ExplainerModal, IntelligenceBriefing (main + Discard sub-modal),
LanguageSuggestionModal, LocalAIPanel, MultiCloudManager (main + Passphrase nested),
NexusQualityAnalyzer, PWAInstallButton iOS-Instructions, ProfileImportConfirmModal,
QuickExitButton Confirmation, RemandRiskChecker, SecurityBadge Security Modal, ShareButton
PreviewModal, TheTribunal, UnityLanguageTutor, UserManual, VAGovRatingPaster, VaDataConsentPrompt
(`dismissable=false`), VaSandboxTest, VeteranTranslator, VoiceInput Safety prompt, WhatIfSandbox,
WhatsNewModal, ZonkButton, AdversarialTestingCluster ClaimStressTest, QualityControlCluster
SharkRadar.

**Top user-facing, fix first:** VaDataConsentPrompt → AtomicWipe → QuickExitButton → VoiceInput →
ProfileImportConfirmModal → DbqFinder → DoctorsPacket → VAGovRatingPaster → VeteranTranslator →
WhatsNewModal → ShareButton → RemandRiskChecker.

### C. Passive — aria only (2)

- `PWAInstallButton` Desktop Install Prompt → `role="region"` + `aria-label`.
- `PWAInstallButton` Mobile Install Banner → `role="status"` + `aria-live="polite"` + `aria-label`.

### D. No action (6, verified)

`AdminPanel` (full-screen two-pane shell, `useBodyScrollLock`), `CommandersChecklist` widget +
embedded view, `QuickExitButton` button, `SecurityBadge` button, `AdversarialTestingCluster`
RedTeam (already on ResponsiveModal).

### E. Surfaces the 48-file grep missed (fold into S12)

- `AccessibilityMenu` — `role="menu"` panel; misuses `role="menu"` with non-menuitem children,
  `aria-labelledby="accessibility-menu"` points at a **non-existent id**; verify trap/restore on open.
- Header **skip-link** + `#main-content` target — present ([Header.jsx:188](../../src/components/Header.jsx#L188),
  [HomeMain.jsx:39](../../src/features/home/HomeMain.jsx#L39)); verify first-focusable + visible-on-focus via e2e.
- `MobileBottomNav` — nav landmark; verify `aria-current`, label, 44px targets.
- `Toast` — verify `aria-live`/`role="status"` (passive).
- `DisclaimerSplash`, `TermsOfService` — S10 ResponsiveModal-backed consent gates; spot-check shell coverage.
- `BootCampTour` — coachmark overlay; verify ESC + per-step focus, no keyboard trap.
- `common/Tooltip` — verify `aria-describedby` + dismiss (WCAG 1.4.13).
- The ~30 S10 ResponsiveModal-migrated modals (`MODALS`/`MIGRATED_MODALS` in
  [tests/e2e/mobile.spec.ts](../../tests/e2e/mobile.spec.ts)) — already covered; spot-check
  custom-header `labelledBy` ones genuinely render through the shell.

## Tooling note (needs owner authorization before CI work)

- e2e axe needs **`@axe-core/playwright`** (not installed; `axe-core`/`vitest-axe`/`@axe-core/react`
  are). Adding a dev dep.
- **"Wire axe into CI"** = modifying `.github/workflows/ci.yml` → **explicit owner authorization
  required** (standing constraint). Flagged; will ask before touching CI.

## Progress

- [x] Chunk 1 — hand-apply safety-critical/partial (CrisisModal, AIConsentModal, VADataCenter,
      AboutUs, DoomOverlay, GlobalCommandSearch) — trap + ESC (where dismissable) + restore;
      VADataCenter also got the full role/aria contract the audit wrongly assumed present
- [x] Chunk 2 — establish ResponsiveModal migration pattern: migrated **WhatsNewModal** to
      ResponsiveModal (custom gradient `header` slot + "Roger That" CTA in the sticky `footer`
      slot, `data-whats-new-modal` hook preserved for [BootCampTour](../../src/components/BootCampTour.jsx#L205),
      `whatsNewClosed` event preserved). Added a dedicated `mobile.spec.ts` block (stale
      `last_seen_version` trips it on boot) — green at 360/390/768. ShareButton's always-dark
      image-preview modal is deferred into a themed-modal cluster (Chunk 3+) where its
      forced-dark frame is handled alongside similar panels, to keep the canonical pattern clean.
- [x] Chunk 3 — migrate the non-dismissible gates (`dismissable=false`): **VaDataConsentPrompt**
      (Shield+title+subtitle → custom header slot with `id="va-consent-title"`; Save & Continue /
      Skip → sticky footer slot; Data Summary / Storage Options / Privacy Notice → body) and
      **AtomicWipe ConfirmModal** (⚠️ header slot `id="atomic-wipe-title"`; Cancel / Confirm Wipe →
      footer slot; delete-list + amber note → body). Both gain focus-trap + `role="dialog"` +
      ESC-blocked for free. AtomicWipe's bespoke `isDark` ternaries were converted to the standard
      `light dark:` pattern — verified theme-correct across all four themes because TBI/AAA are
      handled by global `!important` overrides on base utility classes in `index.css`
      (`html.tbi-comfort .bg-white`, `html.aaa-high-contrast body/*`), not Tailwind `dark:`. Added a
      `mobile.spec.ts` block clicking the real AppShellTop trigger (`aria-label="Clear all local
      data"`) → asserts the footer-CTA contract, then never touches Confirm — green at 360/390/768.
      VaDataConsentPrompt is VA-OAuth-gated (no automatable trigger) → same shell, manual-verify only.
- [x] Chunk 4 — migrate the event-triggerable BVA-data tool modals: **AppealsLaneAdvisor**
      (blue→cyan), **RemandRiskChecker** (amber→orange) and **NexusQualityAnalyzer**
      (indigo→purple). Each shed the legacy `fixed inset-0` + `max-w-4xl max-h-[90vh]` shell for
      `ResponsiveModal size="xl"` with its gradient bar in a custom `header` slot (now carrying an
      `id` for `labelledBy` + `aria-label="Close"` on the `×`). All three are header-close-only
      (toggles/results live in the scroll body, no always-present footer CTA) and gain focus-trap +
      `role="dialog"` + ESC/backdrop dismiss for free. Added all three to the `mobile.spec.ts`
      `MODALS` array (overflow contract) — they mount on `openAppealsLaneAdvisor` /
      `openRemandRiskChecker` (AppealsToolsCluster) and `openNexusQualityAnalyzer`
      (QualityControlCluster); green at 360/390/768.
- [x] Chunk 5 — migrate the event-triggerable 3-step wizard twins **BugSquasher** (red→orange)
      and **FeatureRequest** (purple→indigo). Each shed the legacy `fixed inset-0 z-[100]` +
      `min-h-screen` wrapper + `max-w-3xl max-h-[90vh]` card for `ResponsiveModal size="lg"`
      (`zIndex={100}`). The gradient bar + progress steps move to a custom `header` slot (h2 now
      carries an `id` for `labelledBy`); the Back / Next / Generate / Done bar is extracted to a
      `footer` const fed to the sticky `footer` slot (footer-CTA contract); the three step bodies
      become the scroll body. Each component's redundant `useBodyScrollLock(true)` was removed —
      the shell owns the (ref-counted) scroll-lock — and both gain focus-trap + `role="dialog"` +
      ESC/backdrop dismiss for free. Added both to the `mobile.spec.ts` `MIGRATED_MODALS` array;
      they mount on `openBugSquasher` (SystemToolsCluster) / `openFeatureRequest` (FeedbackHub) —
      green at 360/390/768.
- [x] Chunk 6 — migrate the EASY embedded/flow-gated standard modals: **VAGovRatingPaster**
      (blue→indigo; reused by 6+ host tools incl. TacticalCalculator/Pathfinder/RetroPayHunter) and
      **HelperModeToggle ExplainerModal** (pink→rose→purple onboarding gate). Each shed the legacy
      `fixed inset-0` + `max-w-3xl/2xl max-h-[90vh]` card for `ResponsiveModal` (VAGovRatingPaster
      `size="xl" zIndex={100}` — it renders **over** a parent tool modal, so the high z-index is
      preserved; ExplainerModal `size="lg" zIndex={9999}`). Gradient bars move to a custom `header`
      slot (h2 now carries an `id` for `labelledBy`; `aria-label="Close"` added to VAGovRatingPaster's
      `✕`). VAGovRatingPaster's action bar is **state-dependent** (Parse/Clear before parse →
      Import/Start Over after) — extracted to a `const footer` that branches on `parsedResult` and
      feeds the sticky `footer` slot; ExplainerModal's Not-Right-Now / Enable bar likewise. Both gain
      focus-trap + `role="dialog"` + ESC/backdrop dismiss for free (ExplainerModal ESC → dismiss, not
      enable). Also fixed two pre-existing **SC 4.1.2** button-name failures flagged by axe-linter in
      the same file: the Helper Mode on/off `role="switch"` and the tooltips `role="switch"` had no
      accessible name → added `aria-label`. **No `mobile.spec.ts` entry** — neither is event-triggerable
      (VAGovRatingPaster is prop-driven, mounted by host tools; ExplainerModal is localStorage +
      first-click gated), so both are **manual-verify** for mobile through the proven shell (precedent:
      VaDataConsentPrompt, Chunk 3). Gate: ESLint 0 errors, `tsc` clean, 809 unit tests green.
- [x] Chunk 7 — migrate two more standard prop/flow-gated modals: **ProfileImportConfirmModal**
      (DD214/PDF import review; rendered by DD214Analyzer) and **LanguageSuggestionModal**
      (`isOpen`-driven; rendered by LanguageSelector). ProfileImportConfirmModal shed its
      `fixed inset-0 z-[9999]` + `max-w-5xl max-h-[90vh]` card for `ResponsiveModal size="2xl"
      zIndex={9999}` (`onClose={onCancel}`); its **three stacked top bars** (title + warning banner +
      Select-All/None controls) move into the custom `header` slot as a fragment so they stay pinned
      edge-to-edge (desktop unchanged), the four field-category sections become the scroll body
      (inner `flex-1 overflow-y-auto` wrapper flattened to avoid double-scroll), and the Cancel /
      Import-Selected bar is extracted to a `const footer`. LanguageSuggestionModal → `size="lg"`
      (default z); gradient cyan→blue bar → `header` slot (h2 gains `id`; `aria-label="Close"` added to
      its `✕`), the static "40+ languages" caption demoted to a body note, and the **state-dependent**
      CTA extracted to a `const footer` branching on `isSubmitted` (Generate-Request before → Suggest-
      More/Done after). The submit button moved to the sticky footer but stays wired to the in-body
      `<form>` via HTML5 `form="lang-suggestion-form"` (Enter-to-submit preserved); `if (!isOpen)
      return null` removed (shell owns it via `isOpen`). Both shed redundant `useBodyScrollLock` and
      gain focus-trap + `role="dialog"` + ESC/backdrop dismiss for free. **No `mobile.spec.ts` entry** —
      both are prop/flow-gated, not event-triggerable, so **manual-verify** through the proven shell
      (precedent: VaDataConsentPrompt, Chunk 3; VAGovRatingPaster, Chunk 6). Gate: ESLint 0 errors,
      `tsc` clean, 809 unit tests green.
- [ ] Chunks 8+ — migrate remaining standard modals (batched by cluster)
- [ ] Navigation — Header drawer + Tools/Resources dropdowns + AboutUs VersionDropUp
- [ ] Passive/aria — PWA banners, Toast, MobileBottomNav, AccessibilityMenu
- [ ] Tests — Playwright trap/ESC/restore + axe; SR manual checklist
- [ ] CI wiring — flagged for owner authorization

## Verification gate (per chunk)

ESLint 0 errors • `tsc --noEmit` clean • unit green • migrated modals re-verified at 360/390/768px
(dev server / mobile.spec.ts) — desktop must not regress.
