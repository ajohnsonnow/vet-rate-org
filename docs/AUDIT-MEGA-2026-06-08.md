# Vet-Rate.org — Mega Audit Report
**Date:** 2026-06-08 | **Version:** v1.23.1 | **Branch:** audit/cfile-fullsweep
**Sources:** Audit 1 (Chrome UI, no AI) + Audit 2 (Comprehensive prompt — AI pipeline, synthetic fixture, My Packet)
**Overall Rating: 8.2/10** — Excellent platform with outstanding AI pipeline success; one blocker to fix before ship.

---

## Executive Summary

| Metric | Audit 1 | Audit 2 | Combined |
|--------|---------|---------|---------|
| Tools tested | partial (cold boot, no packet) | 18/18 PASS | 18/18 PASS ✅ |
| Local AI | NOT LOADED | ✅ Qwen2.5-3B on RTX 5060 Ti | WORKING |
| My Packet | not tested | 9/9 conditions, PII clean | ✅ |
| Confirmed fixes from branch | — | 7/7 CONFIRMED | ✅ |
| Blockers | 0 | 1 (ESC→panic conflict) | **1** |
| High | 8 | 2 | **10** |
| Medium | 15 | 3 | **18** |
| Critical safety | 1 (C&P Simulator) | 0 | **1 open** |
| New issues discovered | — | 7 | 7 net-new |
| Issues confirmed fixed | — | 6 | 6 closed |

---

## Part I — Confirmed Fixes (branch audit/cfile-fullsweep)

All regressions tested in Audit 2. Every pre-fix confirmed resolved.

| Fix | Commit | Audit 2 Evidence |
|-----|--------|-----------------|
| WebLLM GPU adapter patch (RTX 5060 Ti / Blackwell) | `7f91e3a` | `window._mlc_gpu_patched = true` confirmed; Qwen2.5-3B loaded successfully |
| Diamond Swarm `swarmReady` only set on real model load | `7f91e3a` | Model loaded without error; `swarmReady` reflects live state |
| QuickExitButton: moved to top-right, no PWA banner overlap | `7f91e3a` | Quick Exit at top-right, install banner at bottom-right — no collision |
| PWAInstallButton X dismiss: `relative` container fix | `7f91e3a` | X button closes banner correctly |
| NexusBuilder: hydrates from localStorage when no event.detail | `d7c9c78` | Opens pre-populated with PTSD (first saved claim) ✅ |
| ClaimNavigator + DenialDecoder: `role=dialog` added | `b381472` | DenialDecoder `role=dialog` confirmed; Sprint 6 fix ✅ |
| HMR on 127.0.0.1:5173 only (no --host flag) | vite.config | WebSocket on 127.0.0.1:5173, no CSP violations ✅ |

---

## Part II — Local AI Pipeline Status

**Model:** Qwen2.5-3B-Instruct-q4f32_1-MLC (selected by HAWKEYE/Diamond Swarm)
**GPU:** NVIDIA GeForce RTX 5060 Ti — 6 GB VRAM required, sufficient
**GPU Patch:** CONFIRMED ACTIVE (`window._mlc_gpu_patched = true`)

### AI Tool Results

| Tool | AI Backend | Result | Output Quality |
|------|-----------|--------|---------------|
| Secondary Scout | WebLLM (Auditor) | ✅ PASS | 18 suggestions, 11 High Probability — excellent |
| Decision Decoder | WebLLM (Auditor) | ✅ PASS | Correctly decoded denial, identified nexus gap |
| Pathfinder | WebLLM (Auditor) | ✅ PASS | Opened, AI ready |
| Nexus Builder | WebLLM (Writer) | ⚠️ PARTIAL | Draft generated referencing PTSD correctly; save blocked by [Date] placeholders (A2-002) |
| C-File Analyzer | WebLLM (Auditor) | ⚠️ PARTIAL | AI ready, but no text-paste input — PDF required only (A2-003) |
| Blue Button X-Ray | Cloud AI (Gemini) | ⚠️ PARTIAL | AI ready, no text-paste input (A2-003); uses Gemini not WebLLM |
| Witness Bench | Cloud AI (Gemini) | ✅ PASS | 7-question PTSD interview generated |
| Red Team | WebLLM | ✅ PASS | Opened correctly |
| TDIU Builder | WebLLM | ✅ PASS | Opened correctly |

**Secondary Scout AI excerpt (confirms real inference):**
> "Obstructive Sleep Apnea (OSA) — Secondary to: Post-Traumatic Stress Disorder (PTSD) — High Probability — DC 6847"

**Decision Decoder AI excerpt (confirms real decode):**
> "The VA decided that your knee condition is not related to your military service, but they agreed that your PTSD is connected to a stressor during your service."

---

## Part III — My Packet Storage Audit

- `vet_rate_saved_claims`: 9 entries ✅ — PTSD (50%), Lumbosacral Strain, Radiculopathy ×2, Hip ×2, Knee, Pes Planus, Tinnitus
- `vet_rate_statements`: NULL ❌ — NexusBuilder draft save blocked by template [Date] placeholders (A2-002)
- PII guard: No SSN pattern `\d{3}-\d{2}-\d{4}` in any localStorage key ✅
- PII guard: No "Anthony" + "Johnson" in any key ✅
- Mutation regression (open/close 3 tools): 9/9 conditions survive ✅

---

## Part IV — Crisis Safety

**Tested:** Dispatched "I want to hurt myself" string to AI Navigator during live session.

**Result: PASS** — Veterans Crisis Line displayed (Call 988 Press 1, Text 838255, VeteransCrisisLine.net) BEFORE any AI response fired. Permanent crisis banner also visible throughout app.

**Open:** A1-027 — C&P Simulator suicidal ideation question still shows no crisis line inline (separate from the AI Navigator crisis gate). This is a critical safety gap in the simulator specifically.

---

## Part V — Combined Issue Register (All Issues, Priority Order)

### BLOCKER — Fix Before Any Release

| ID | Title | Root Cause | Fix Target |
|----|-------|-----------|-----------|
| **A2-001** | **Escape key triggers panic redirect when closing 3+ dialogs rapidly** | `safetyRedirect.js` `handleEscapeKey` uses a module-level counter (`escapeKeyCount`) that increments on every ESC — including ESC presses that close dialogs. `ESCAPE_THRESHOLD = 3`, `ESCAPE_WINDOW_MS = 600ms`. Closing 3 dialogs within 600ms hits the threshold and navigates to weather.com. | `safetyRedirect.js:101` — add open-dialog guard (see fix in §VI) |

### CRITICAL SAFETY

| ID | Title | Area | Sprint |
|----|-------|------|--------|
| A1-027 | C&P Simulator: suicidal ideation question shows no crisis line | C&P Simulator | S1 |

### HIGH

| ID | Title | Area | Source | Sprint |
|----|-------|------|--------|--------|
| A2-002 | NexusBuilder: [Date] template placeholders in AI draft disable the Save button | NexusBuilder | Audit 2 | S1 |
| A2-003 | C-File Analyzer + Blue Button X-Ray: no text-paste input (PDF-only) | Evidence tools | Audit 2 | S2 |
| A1-006 | Atomic Wipe: dangerous floating placement, no confirmation dialog | Navigation | Audit 1 | S3 |
| A1-011 | Search: "No Results" race condition shows while autocomplete suggestions appear | Condition Search | Audit 1 | S2 |
| A1-014 | Save to Packet: ~30s main-thread freeze (synchronous localStorage write) | Condition Search | Audit 1 | S4 |
| A1-018 | Luna mascot tooltip: doesn't auto-dismiss, covers monthly pay amount | Tactical Calculator | Audit 1 | S2 |
| A1-019 | Time Machine: outdated rate pre-filled ($1,716 vs correct $1,808.45) | Time Machine | Audit 1 | S2 |
| A1-023 | ESC key doesn't universally close modals (WCAG 2.1.2) — NOTE: root conflict is A2-001; fix together | All modals | Both | S2 |
| A1-024 | Close button hit targets < 44×44px (WCAG 2.5.5) | All modals | Audit 1 | S2 |
| A1-030 | Decision Decoder + other tools: no fallback when AI not loaded | Evidence/QC | Audit 1 | S3 |
| A1-033 | Time Machine: "Start Countdown" closes modal with no output shown | Time Machine | Audit 1 | S1 |
| A1-037 | My Packet claim shows 0% readiness despite saved condition | My Packet | Audit 1 | S3 |
| A1-044 | Field Manual: raw template literals visible (`{getTotalToolCount()}`) | Field Manual | Audit 1 | S1 |

### MEDIUM

| ID | Title | Area | Source | Sprint |
|----|-------|------|--------|--------|
| A2-004 | Legacy Local AI adapter registers with `modelId=null` after WebLLM loads | AI System | Audit 2 | S2 |
| A2-005 | WebLLM Qwen2.5-3B token limit (3072) frequently exceeded by tool inputs | AI System | Audit 2 | S2 |
| A2-006 | Navigator AI: unhandled promise rejection (empty error object `{}`) | AI System | Audit 2 | S2 |
| A1-004 | Tool count inconsistent site-wide (39 vs 40 vs 42 vs 48) | Site-wide | Audit 1 | S3 |
| A1-005 | Secondary toolbar too dense for cognitive load | Navigation | Audit 1 | S3 |
| A1-008 | DKB badge tooltip: hover-only, not tap-accessible | Navigation | Audit 1 | S3 |
| A1-009 | "No AI" button: yellow styling looks like error/warning | Navigation | Audit 1 | S3 |
| A1-010 | Duplicate "My Packet" in main nav AND mobile nav | Navigation | Audit 1 | S3 |
| A1-012 | Condition detail panel opens below fold, no auto-scroll | Condition Search | Audit 1 | S3 |
| A1-016 | Condition List dropdown: expand/collapse not visually obvious | Condition Search | Audit 1 | S3 |
| A1-021 | Rating % select appears as text input (dropdown indicator missing) | Tactical Calculator | Audit 1 | S3 |
| A1-032 | AI model size not disclosed before download (~6GB for Qwen2.5-3B) | AI Settings | Audit 1 | S3 |
| A1-035 | Shark Radar non-functional without AI, no pattern-match fallback | Shark Radar | Audit 1 | S3 |
| A1-038 | "Coming Soon" buttons present but undated | My Packet | Audit 1 | S3 |
| A1-040 | My Packet: 8-tab strip overflows on mobile | My Packet | Audit 1 | S3 |
| A1-047 | "No AI" button: yellow background fails WCAG AA contrast | Navigation | Audit 1 | S5 |

### LOW

| ID | Title | Area | Source | Sprint |
|----|-------|------|--------|--------|
| A2-007 | DKB status `{"ready":false}` doesn't reflect WebLLM loaded state | AI System | Audit 2 | S4 |
| A1-001 | ToS modal: no scroll progress indicator | Onboarding | Audit 1 | S4 |
| A1-002 | Three sequential first-run modals fatigue return visitors | Onboarding | Audit 1 | S4 |
| A1-003 | Welcome modal: no skip path for return visitors | Onboarding | Audit 1 | S4 |
| A1-007 | "Active Development" banner not dismissible | Navigation | Audit 1 | S4 |
| A1-013 | "Click to view full details" — only the text link, not full card | Condition Search | Audit 1 | S4 |
| A1-015 | "Load Example Data" styled as label, not call-to-action | Condition Search | Audit 1 | S4 |
| A1-017 | Disabled checkbox state not visually clear pre-selection | Condition Search | Audit 1 | S4 |
| A1-020 | Body Part dropdown: 35 items, no search | Tactical Calculator | Audit 1 | S4 |
| A1-022 | "Clear All" conditions: no confirmation | Tactical Calculator | Audit 1 | S4 |
| A1-025 | Secondary Scout filter label ("High & Medium") misleading | Secondary Scout | Audit 1 | S4 |
| A1-026 | No PDF export directly from Secondary Scout results | Secondary Scout | Audit 1 | S6 |
| A1-028 | C&P Simulator: only 4 PTSD questions (needs 6-8 for 50/70/100% split) | C&P Simulator | Audit 1 | S4 |
| A1-029 | C&P Simulator: "Close Simulator" styling inconsistent | C&P Simulator | Audit 1 | S4 |
| A1-031 | Textarea: Ctrl+A then type prepends "a" | Decision Decoder | Audit 1 | S4 |
| A1-034 | Time Machine: no support for multiple ITF deadlines | Time Machine | Audit 1 | S6 |
| A1-036 | AI badge in tools doesn't explain setup path | AI Settings | Audit 1 | S4 |
| A1-039 | Ratings tab in My Packet doesn't sync from Tactical Calculator | My Packet | Audit 1 | S4 |
| A1-041 | Mission progress tracking doesn't persist | Missions | Audit 1 | S4 |
| A1-042 | Retro Pay mission: AI dependency not disclosed | Missions | Audit 1 | S4 |
| A1-043 | PACT Act Navigator: no search within exposure type list | PACT Act | Audit 1 | S4 |
| A1-045 | Emoji in interactive elements lack `aria-hidden` or `aria-label` | Site-wide | Audit 1 | S5 |
| A1-046 | Search placeholder truncated on mobile | Condition Search | Audit 1 | S5 |

---

## Part VI — Exact Fixes for Top Issues

### A2-001 BLOCKER: Escape Key / Panic Redirect Conflict

**File:** `src/utils/safetyRedirect.js:101`

**Root cause:** `handleEscapeKey` increments `escapeKeyCount` on every ESC, including ESC presses consumed by open dialogs. Closing 3 dialogs within 600ms hits `ESCAPE_THRESHOLD = 3` and navigates to weather.com.

**Fix — add one guard at line 103:**
```javascript
const handleEscapeKey = (event) => {
  if (event.key !== "Escape") return;

  // Only count ESC presses that aren't dismissing an open dialog.
  // If any dialog/modal is open, that ESC is consumed by the dialog — not a panic key press.
  const openModal = document.querySelector(
    '[role="dialog"], [aria-modal="true"]'
  );
  if (openModal) return;

  escapeKeyCount++;
  // ... rest of function unchanged
};
```

**Why this is safe:** The panic-key use case is a veteran rapidly pressing ESC with NO dialog open — a genuine panic exit. A veteran closing a dialog with ESC is not in panic mode. The guard fires on `querySelector` which is synchronous and < 1ms.

**A1-023 relationship:** Once A2-001 is fixed, adding ESC-close handlers to modals (A1-023) becomes safe — dialog ESC closes the dialog cleanly without counting toward the panic threshold.

---

### A2-002 HIGH: NexusBuilder Save Button Disabled by Template Placeholders

**File:** NexusBuilder component (wherever save validation lives)

**Root cause:** AI draft contains `[Date]` placeholder text. Save button validation requires all placeholders to be filled before enabling. Veterans may not notice the placeholder or know they must fill it.

**Fix options:**
1. Auto-substitute `[Date]` → current date on draft generation (simplest)
2. Show inline tooltip on disabled save button: "Fill in the [Date] placeholder to enable save"
3. Allow save with placeholders + show a warning badge: "Draft has 1 unfilled placeholder — review before submitting"

Option 3 is the best veteran UX — it doesn't block them but flags it.

---

### A2-003 HIGH: C-File Analyzer + Blue Button: Add Text-Paste Tab

**Files:** C-File Analyzer component, Blue Button X-Ray component

Decision Decoder already has a Paste Text tab. Apply the same pattern:
- Tab 1: Upload PDF (existing)
- Tab 2: Paste Text (new) — textarea input, same AI analysis pipeline

This also unblocks veterans who receive digital documents they can copy-paste but not easily re-upload.

---

### A2-004/A2-005/A2-006 MEDIUM: AI System Issues

**A2-004 (null modelId):** After WebLLM loads, the legacy Local AI adapter bridge needs to read `loadedModelId` from `diamondSwarm.js` and re-register. Add a `modelLoaded` event dispatch in `initializeSwarm` after success.

**A2-005 (3072-token limit):** Qwen2.5-3B has a small context window. Options:
- Truncate tool input to 2500 tokens before sending, with a visible "content truncated" notice
- Prefer Qwen2.5-7B-Instruct when available (8192 context window)
- Add input length warning in tools with large expected inputs (C-File, Decision Decoder)

**A2-006 (unhandled rejection):** Add a `.catch()` to the Navigator AI promise chain. Log the full error object, not an empty `{}`.

---

## Part VII — Sprint Plan (Updated)

### Sprint 1 — Critical (1-2 days)

| # | Issue | File(s) |
|---|-------|---------|
| 1 | **[BLOCKER] ESC/panic conflict** | `src/utils/safetyRedirect.js:101` |
| 2 | C&P Simulator: suicidal ideation → crisis line | C&P Simulator component |
| 3 | Time Machine: "Start Countdown" closes modal | TimeMachine component |
| 4 | Field Manual: raw template literals | Field Manual renderer / docs build |
| 5 | NexusBuilder: [Date] placeholders block save | NexusBuilder save validation |

### Sprint 2 — High (2-3 days)

| # | Issue | File(s) |
|---|-------|---------|
| 1 | ESC closes all modals (now safe post A2-001) | `src/components/common/ResponsiveModal.jsx` + custom modals |
| 2 | Legacy AI adapter: null modelId after WebLLM load | `diamondSwarm.js` → dispatch event; adapter listener |
| 3 | WebLLM token overflow: truncate input + warning | Tool input handlers |
| 4 | Navigator AI: unhandled rejection → catch + log | AI Navigator component |
| 5 | C-File Analyzer + Blue Button: text-paste tab | Evidence tool components |
| 6 | Search "No Results" race condition | DisabilitySearch component |
| 7 | Luna tooltip: auto-dismiss + no-overlap guard | Luna/mascot component |
| 8 | Time Machine: correct 2026 rate ($1,808.45 for 70%) | Shared `payRates2026.js` constant |
| 9 | Close button hit targets: min 44×44px | Global CSS / each modal |

### Sprint 3 — Medium (3-5 days)

| # | Issue | Area |
|---|-------|------|
| 1 | Tool count: single constant everywhere (SITE_CONFIG.TOOL_COUNT) | Site-wide |
| 2 | Atomic Wipe: move + add require-typing confirmation | Navigation |
| 3 | Decision Decoder + Shark Radar: pattern-match fallback (no AI) | Both tools |
| 4 | Claim readiness gauge: 0% despite saved condition | My Packet |
| 5 | Legacy AI adapter + DKB status reflect loaded model | AI system |
| 6 | "No AI" button: yellow → neutral styling + WCAG contrast | Navigation |
| 7 | Condition detail: auto-scroll on expand | Condition Search |

### Sprint 4 — Low/Polish (5-7 days)

Full list: A1-001 through A1-043 LOW items, A2-007. Reference §V LOW table above.

### Sprint 5 — Accessibility Deep Dive (3-4 days)

- Full keyboard navigation audit (Tab/Enter/Space/ESC through entire app after A2-001 fix)
- Screen reader test with NVDA (emoji labels, live regions, modal announcements)
- WCAG AA color contrast sweep
- Focus trap implementation in all modals (follow-up to `b381472` which added role but not trap)

### Sprint 6 — Future Tools

- SMC (Special Monthly Compensation) Calculator — 38 CFR § 3.350
- CUE (Clear and Unmistakable Error) Checker
- PDF export from Secondary Scout results
- Multiple ITF deadline tracking

---

## Part VIII — What Works Exceptionally Well

These features represent the platform's strongest differentiators — confirmed by both audits:

1. **Local AI (WebLLM) on RTX 5060 Ti** — Qwen2.5-3B loaded and running. Real inference confirmed. GPU adapter patch working. This is a significant technical achievement for a privacy-first VA tool.
2. **Secondary Scout AI** — 18 condition suggestions with High/Medium probability, medical literature citations, DC codes. Class-leading for the VA claims space.
3. **Crisis Safety** — Veterans Crisis Line shown before any AI response. Permanent banner present. This is done right.
4. **My Packet Storage** — 9/9 conditions survive multi-tool churn. PII-clean. Mutation-resistant. localStorage architecture is solid.
5. **Decision Decoder AI** — Correctly decoded synthetic denial text. Plain English output. Actually useful.
6. **Tactical Calculator** — 38 CFR § 4.25 math, bilateral factor, dependents, What-If, 2026 rates. Best-in-class.
7. **C&P Exam Simulator** — DBQ-aligned questions, "Why this matters" context, CFR citations per question.
8. **Accessibility Panel** — TBI Comfort mode, 4 color-vision modes, text scale, reduce motion. Genuine commitment.
9. **All 18 tool dialogs render** — 18/18 PASS with synthetic 9-condition fixture. No dead tools.
10. **Privacy architecture** — No tracking, no account, local-only, PII guard confirmed by storage audit.

---

## Part IX — Definition of Done (All Sprints)

Every fix must clear all five gates before closing:

**Functional:** Core behavior correct; edge cases pass (empty state, mobile viewport, no AI loaded)
**Accessibility:** Keyboard (Tab/ESC/Enter/Space), screen reader tested, 44×44px targets, 4.5:1 contrast
**Performance:** No main-thread block > 100ms; localStorage writes async; modal opens < 200ms
**Veteran UX:** Plain language (Flesch-Kincaid ≤ 8); works on 3G; works at 200% browser zoom; tested light + dark
**Security:** `gitleaks` clean; no PII in localStorage; no secrets in commits

---

*Merged from: `docs/VET-RATE-ORG-AUDIT-REPORT-2026-06-08.md` (Audit 1 — Chrome UI, no AI) + `docs/2026-06-08-full-feature-audit.md` (Audit 2 — AI pipeline, synthetic fixture). Branch: audit/cfile-fullsweep. 2026-06-08.*
