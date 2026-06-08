# S12 — Screen-Reader Manual Checklist (NVDA / VoiceOver / TalkBack)

> Cycle S9–S17, Sprint 12 ([SPRINT_PLAN_S9-S17.md](../SPRINT_PLAN_S9-S17.md), row S12;
> companion to [S12_WORKLIST.md](./S12_WORKLIST.md)).
> **Why this exists:** axe + Playwright (CI) verify _structure_ — roles, names, contrast,
> overflow, focus-trap mechanics, ESC. They **cannot** verify what a blind user actually
> _hears_: announcement wording, announcement _order_, whether a live region fires once vs
> re-reads the whole stack, swipe/rotor navigation order, or VoiceOver/TalkBack touch
> gestures. This checklist is the owner-run pass that closes that gap. The plan's
> Verification Matrix marks every row below with `*` = manual-only, owner-run.

## How to use

1. Pick a row from the **Environment matrix**, run the whole **Surface checklist** in it,
   record pass/fail + notes in the **Sign-off log** at the bottom.
2. A surface "passes" only when its **Expected** column is true _by ear_ (eyes closed for
   the live-region and order checks — that is the point).
3. File any failure as a normal bug (the in-app Report Bug flow stores it locally); link the
   bug id in the log. Do not edit code from this doc — it is a test script, not a worklist.

## Environment matrix (run at least the **bold** three before S12 sign-off)

| SR            | Browser     | OS              | Notes                                               |
| ------------- | ----------- | --------------- | --------------------------------------------------- |
| **NVDA**      | **Firefox** | **Windows 11**  | Reference desktop pair (most faithful ARIA)         |
| NVDA          | Chrome      | Windows 11      | Second desktop engine                               |
| **VoiceOver** | **Safari**  | **iOS 17+**     | Real device — covers URL-bar/notch + touch rotor    |
| VoiceOver     | Safari      | macOS           | Desktop touch-free; good for focus-order checks     |
| **TalkBack**  | **Chrome**  | **Android 13+** | Real device — covers swipe order + reading controls |

> JAWS is optional (NVDA is the free reference). Narrator is **not** required.
> Mobile rows MUST be a real phone — emulators do not reproduce gesture/rotor behaviour.

## Global setup (each session)

- [ ] Fresh profile or cleared site data (so first-run gates fire: Disclaimer → Terms →
      AI-consent).
- [ ] SR speech on, **screen curtain / monitor off** for the announcement-order and
      live-region rows (forces ear-only verification).
- [ ] Learn the three "next item" gestures: NVDA `↓` / browse vs focus mode; VoiceOver
      swipe-right; TalkBack swipe-right. Live-region checks need NO navigation — the SR must
      speak on its own.

---

## Surface checklist

### 1. Landmarks & global navigation

- [ ] **Skip link** ([Header.jsx:200](../../src/components/Header.jsx#L200)) — on first
      `Tab` from page load the SR announces "Skip to main content, link"; activating it moves
      reading focus into `#main-content` (not back to the top). _CI checks it exists; only an
      SR confirms focus actually lands._
- [ ] **Landmark rotor** — NVDA elements list / VO rotor / TalkBack headings-and-landmarks
      shows: a `banner`/header, `main`, `contentinfo`/footer, and on mobile a `navigation`
      named "Main navigation" ([MobileBottomNav.jsx](../../src/components/MobileBottomNav.jsx)).
- [ ] **Bottom nav (mobile)** — each item announces its label + "current page" on the active
      one (`aria-current="page"`); targets are reachable by swipe in visual order.
- [ ] **Heading order** — rotor heading list is hierarchical (one `h1`, no skipped levels on
      Home / a tool page). Note any jumps.

### 2. Dialog contract (ResponsiveModal-backed overlays)

Run on a representative sample — at minimum **DisclaimerSplash**, **TermsOfServiceModal**,
**WhatsNewModal**, **VaDataConsentPrompt**, one tool modal (e.g. **AppealsLaneAdvisor**), and
the **Header mobile drawer**. The contract is identical across all migrated modals, so a clean
sample generalises.

- [ ] **On open** focus moves _into_ the dialog and the SR reads the dialog's accessible name
      (its title / `labelledBy`), announcing "dialog".
- [ ] **Trap** — swiping/Tab past the last control wraps to the first; you cannot reach page
      content behind the dialog (verify by ear: background headings are NOT reachable).
- [ ] **ESC** closes dismissable dialogs; focus returns to the control that opened it
      (exception, by design: **ZonkButton** restores to `<body>` — its opener unmounts;
      **CrisisModal** does not close on ESC — non-dismissible safety alertdialog).
- [ ] **CrisisModal** announces as **alertdialog** with its assertive status line read on open.
- [ ] **Sticky footer CTA** (e.g. "Save & Continue", "Confirm Wipe") is reachable and labelled;
      on mobile it is not visually clipped under the URL bar (VoiceOver iOS).
- [ ] No "phantom" announcement of hidden background content while a modal is open.

### 3. Live regions (the highest-risk, ear-only section)

These were the core S12 passive-surface fixes — verify the _audible_ behaviour, monitor off.

- [ ] **Toast — severity routing** ([Toast.jsx](../../src/components/Toast.jsx)): trigger a
      **success/info** toast → SR speaks it **politely** (does NOT cut off whatever you were
      reading). Trigger an **error/warning/network** toast → SR **interrupts** (assertive).
- [ ] **Toast — no re-read storm**: with one toast visible, trigger a second → SR reads ONLY
      the new toast, not both again (confirms `aria-atomic` removal on the container).
- [ ] **UpdateBanner** ([UpdateBanner.jsx](../../src/components/UpdateBanner.jsx)) — when a SW
      update is detected the banner is announced politely on appearance (no navigation needed).
- [ ] **MobileNotice** ([MobileNotice.jsx](../../src/components/MobileNotice.jsx)) — on a
      tablet, the tablet-mode notice is announced politely on appearance.
- [ ] **PWA install banner** ([PWAInstallButton.jsx](../../src/components/PWAInstallButton.jsx))
      — mobile banner announced politely; the banner's own text is read (NOT a bare label) and
      its dismiss "×" announces "Dismiss install prompt".
- [ ] **Negative check**: navigating the page normally does NOT spuriously re-announce any of
      the above (a live region should be silent until its content changes).

### 4. Disclosure & menu patterns

- [ ] **AccessibilityMenu** ([AccessibilityMenu.jsx](../../src/components/AccessibilityMenu.jsx))
      — the toggle announces an accessible name + expanded/collapsed state; opening it the SR
      can reach the settings rows; the menu is named by its trigger (no "unlabelled" group).
- [ ] **AboutUs → VersionDropUp** — trigger announces **expanded/collapsed** (disclosure, NOT
      a menu); ESC collapses it and focus returns to the trigger; the changelog content is then
      reachable in reading order.
- [ ] **Header Tools / Resources dropdowns** — trigger announces expanded state + "has popup";
      items are reachable; click-away / focus-out closes without trapping.

### 5. Tooltips (WCAG 1.4.13 — desktop SR + keyboard)

- [ ] **common/Tooltip** ([Tooltip.jsx](../../src/components/common/Tooltip.jsx)) — moving
      keyboard focus to a tooltipped control announces the tip via `aria-describedby` (read
      after the control's name).
- [ ] **Dismissable** — `Esc` hides the tooltip without moving focus.
- [ ] **Hoverable / persistent** — the tip stays while pointer moves onto it and does not
      auto-dismiss on a timer while focused.

### 6. Guided tour

- [ ] **BootCampTour** (driver.js) — start the tour; each step's title + description is
      announced; `Esc` exits the tour (`allowClose: true`); focus is sensible per step and you
      are never trapped. Note any step whose description is not read or whose focus is lost.

### 7. Forms & error messaging

- [ ] In a form-bearing modal (e.g. **FeatureRequest**, **VaDataConsentPrompt**), each field
      announces its label; required state is conveyed; a validation error is announced (assertive
      live region / `aria-describedby` error text) and focus/association lets the SR find it.
- [ ] Submit confirmation is announced (politely) — see Toast routing above.

---

## Known limits (record, don't "fix" from here)

- **ZonkButton** focus-restore lands on `<body>` (opener unmounts) — accepted for an easter egg.
- **AccessibilityMenu** `role="menu"` children are toggle rows, not `menuitem`s — the SC 4.1.2
  _naming_ blocker is fixed; a future chunk may revisit the role. Note SR behaviour if confusing.
- Real iOS Safari URL-bar collapse / notch safe-area and Android gesture order are **only**
  observable here — that is the whole reason for the mobile rows.

## Sign-off log

| Date | SR / Browser / OS | Sections run | Result | Bug ids / notes |
| ---- | ----------------- | ------------ | ------ | --------------- |
|      |                   |              |        |                 |

> **S12 SR sign-off = the bold three matrix rows green across sections 1–7.** Until then this
> deliverable is "drafted" (DoD met for S12 authoring); the owner-run pass is tracked here.
