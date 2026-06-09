# Vet-Rate.org — Audit Issue Register
**Prepared:** 2026-06-08 | **Branch:** audit/cfile-fullsweep | **Version:** v1.23.1
**Purpose:** Master register for merging Audit 1 (Chrome UI audit, no AI) with Audit 2 (comprehensive AI + document pipeline audit). When Audit 2 results arrive, append `A2-xxx` rows to the table, mark cross-confirmed issues, and run the merge procedure in §4.

---

## §1 — What Each Audit Covers

| Dimension | Audit 1 (Chrome, No AI) | Audit 2 (Comprehensive Prompt) |
|-----------|------------------------|-------------------------------|
| Cold-start / onboarding modals | ✅ | ✅ |
| Every tool cluster renders | partial (no pre-loaded packet) | ✅ (synthetic fixture pre-loaded) |
| Keyboard / a11y | ✅ | partial |
| Local AI (WebLLM/Diamond Swarm) load | ❌ — ran in "No AI" mode | ✅ (GPU patch, model ID, VRAM) |
| AI pipeline output per tool | ❌ | ✅ (C-File, Blue Button, Nexus, etc.) |
| My Packet storage after AI writes | ❌ | ✅ (localStorage audit post-AI) |
| NexusBuilder with pre-loaded conditions | ❌ (not pre-loaded) | ✅ |
| Document upload + processing | ❌ | ✅ (synthetic text injected) |
| Crisis safety gate | noted only | ✅ (actively triggered) |
| PII guard (no real SSN in storage) | ❌ | ✅ |
| Console / network health | partial | ✅ |
| Known-fix regression check | ❌ (ran before today's commits) | ✅ |

---

## §2 — Branch Pre-Fixes (already on audit/cfile-fullsweep)

These commits landed **before** Audit 2 runs. Audit 2 should confirm each as RESOLVED.

| Commit | Fix | Maps to Audit 1 Issues |
|--------|-----|------------------------|
| `7f91e3a` | Diamond Swarm GPU adapter patch (RTX 5060 Ti); swarmReady only set on real model load | Addresses Audit 1 "No AI" root cause |
| `7f91e3a` | QuickExitButton moved from `floating` (bottom-right, overlaps PWA banner) to `top-right` | No Audit 1 issue (missed by cold-start) |
| `7f91e3a` | PWAInstallButton X dismiss: inner div `relative` so absolute button positions correctly | No Audit 1 issue (missed by cold-start) |
| `d7c9c78` | NexusBuilder hydrates from `getSavedClaims()[0]` when no event.detail | A1-044 indirectly; not directly tested in Audit 1 |
| `b381472` | ClaimNavigator + DenialDecoder get `role=dialog` + `aria-labelledby` | A1-023, A1-024 — PARTIAL (role added; focus trap + ESC handler still TODO) |
| `f441612` | Wire 48-tool launch matrix; dead-end button stubs now dispatch events | A1-038 — PARTIAL |
| `96eb6b9` | Reconcile dual calculators; bilateral match (38 CFR § 4.26); 80% ground truth | A1-019 — VERIFY: Time Machine rate source unchanged |
| `2dcae2b` | LLM pipeline audit: TOOL_AGENT_MAP routing fix + PDCA test coverage | No direct Audit 1 issue (internal routing) |

**Pre-fix status for Audit 2 checklist:**
- [ ] `7f91e3a` GPU patch confirmed active (`window._mlc_gpu_patched = true` visible in console)
- [ ] `7f91e3a` WebLLM model loads successfully (log: `🎖️ WebLLM engine loaded for Warrant Council`)
- [ ] `7f91e3a` Quick Exit at top-right, no PWA banner overlap
- [ ] `7f91e3a` PWA dismiss X clickable
- [ ] `d7c9c78` NexusBuilder renders with pre-loaded packet (hard assertion in `tool-with-packet.spec.ts`)
- [ ] `b381472` ClaimNavigator announces as dialog in screen reader / has `role=dialog`
- [ ] `b381472` DenialDecoder announces as dialog in screen reader / has `role=dialog`

---

## §3 — Normalized Issue Register (Audit 1 — 47 unique issues)

Duplicates from the chrome audit (#5/#47/#58 → A1-004, #24/#48 → A1-023, etc.) are merged here.
**Status legend:** `OPEN` · `FIXED-BRANCH` · `PARTIAL` · `IN-AUDIT-2` (Audit 2 will verify/expand) · `POSITIVE`

| ID | Title | Sev | Tool/Area | Sprint | Status | Notes |
|----|-------|-----|-----------|--------|--------|-------|
| A1-001 | ToS modal: no scroll progress indicator | LOW | Onboarding | S4 | OPEN | User must scroll to accept; no % remaining shown |
| A1-002 | Three sequential modals fatigue return visitors | MED | Onboarding | S4 | OPEN | Welcome → ToS → Changelog |
| A1-003 | Welcome modal: no skip for return visitors | LOW | Onboarding | S4 | OPEN | localStorage accepted flag could skip it |
| A1-004 | Tool count inconsistent site-wide (39 vs 40 vs 42 vs 48) | HIGH | Site-wide | S3 | OPEN | Browser title, Field Manual, homepage, changelog all differ |
| A1-005 | Secondary toolbar too visually dense for cognitive load | MED | Navigation | S3 | OPEN | DKB, version, AI toggle, Helping, EN, A11y, Roadmap, Ideas |
| A1-006 | Atomic Wipe: dangerous floating placement, no confirmation | HIGH | Navigation | S3 | OPEN | Top-left corner, easily mis-clicked; needs confirm + re-placement |
| A1-007 | "Active Development" banner not dismissible | LOW | Navigation | S4 | OPEN | Takes space on every visit; add dismiss + sessionStorage |
| A1-008 | DKB badge tooltip: hover-only, not tap-accessible | MED | Navigation | S3 | OPEN | Veterans on touch devices can't read the explanation |
| A1-009 | "No AI" button: yellow styling looks like error/warning | MED | Navigation | S3 | OPEN | Color also fails WCAG AA contrast (A1-047) |
| A1-010 | Duplicate "My Packet" — main nav AND mobile nav | MED | Navigation | S3 | OPEN | Confusing which one to use |
| A1-011 | Search: "No Results" shows while autocomplete suggestions visible | HIGH | Condition Search | S2 | OPEN | Race condition between two state paths |
| A1-012 | Condition detail panel opens below fold (no auto-scroll) | MED | Condition Search | S3 | OPEN | User doesn't know content appeared; `scrollIntoView` fix |
| A1-013 | "Click to view full details" — only link text, not full card | LOW | Condition Search | S4 | OPEN | Make full card clickable |
| A1-014 | Save to Packet: ~30s main-thread freeze | HIGH | Condition Search | S4 | OPEN | CDP timeout twice; localStorage write is synchronous + blocking |
| A1-015 | "Load Example Data" styled as label, not CTA | LOW | Condition Search | S4 | OPEN | First-time users don't notice it |
| A1-016 | Condition List dropdown: expand/collapse not obvious | MED | Condition Search | S3 | OPEN | Looks like select; add chevron animation |
| A1-017 | Disabled checkbox state unclear before conditions selected | LOW | Condition Search | S4 | OPEN | |
| A1-018 | Luna mascot tooltip: doesn't auto-dismiss, covers pay amount | HIGH | Tactical Calculator | S2 | OPEN | Overlaps monthly pay figure; blocks key content |
| A1-019 | Time Machine: shows $1,716/mo for 70% (correct = $1,808.45) | HIGH | Time Machine | S2 | OPEN | Outdated rate table; see also A1-033 |
| A1-020 | Body Part dropdown: 35 items, no search | LOW | Tactical Calculator | S4 | OPEN | |
| A1-021 | Rating % select appears as text input | MED | Tactical Calculator | S3 | OPEN | Missing dropdown indicator |
| A1-022 | "Clear All" conditions: no confirmation | LOW | Tactical Calculator | S4 | OPEN | Data loss risk |
| A1-023 | ESC key doesn't close all modals (WCAG 2.1.2) | HIGH A11Y | All modals | S2 | PARTIAL | `b381472` added `role=dialog` to ClaimNavigator + DenialDecoder; ESC handler + focus trap still needed everywhere |
| A1-024 | Close button hit targets < 44×44px (WCAG 2.5.5) | HIGH A11Y | All modals | S2 | PARTIAL | Same commit as above; semantic improvement only |
| A1-025 | Secondary Scout results: filter label misleading | LOW | Secondary Scout | S4 | OPEN | "High & Medium" toggle state unclear |
| A1-026 | Secondary Scout: no PDF export from results screen | LOW | Secondary Scout | S6 | OPEN | Only "My Packet" save available |
| A1-027 | C&P Simulator: suicidal ideation Q shows no crisis line | CRITICAL SAFETY | C&P Simulator | S1 | OPEN | Selecting "Yes, frequently" must immediately surface 988/838255 |
| A1-028 | C&P Simulator: only 4 questions for PTSD | LOW | C&P Simulator | S4 | OPEN | Needs 6-8 to differentiate 50/70/100% |
| A1-029 | C&P Simulator: "Close Simulator" styling inconsistent | LOW | C&P Simulator | S4 | OPEN | |
| A1-030 | Decision Decoder: non-functional without AI, no fallback | HIGH | Decision Decoder | S3 | OPEN | Pattern-match fallback would work offline |
| A1-031 | Textarea: Ctrl+A then type prepends "a" character | LOW | Decision Decoder | S4 | OPEN | |
| A1-032 | AI model size not disclosed before download (~4.7GB) | MED | AI Settings | S3 | OPEN | User needs hardware/download warning before clicking |
| A1-033 | Time Machine "Start Countdown" closes modal with no output | CRITICAL | Time Machine | S1 | OPEN | Modal dismisses; countdown, backpay, effective date never shown |
| A1-034 | Time Machine: no support for multiple ITF deadlines | LOW | Time Machine | S6 | OPEN | |
| A1-035 | Shark Radar: non-functional without AI, no pattern fallback | MED | Shark Radar | S3 | OPEN | 50+ known red-flag phrases could match offline |
| A1-036 | AI badge in tools doesn't explain setup path | LOW | AI Settings | S4 | OPEN | |
| A1-037 | My Packet: claim shows 0% readiness despite saved condition | HIGH | My Packet | S3 | OPEN | Readiness gauge doesn't recognize condition-added event |
| A1-038 | My Packet: "Coming Soon" buttons present but undated | MED | My Packet | S3 | PARTIAL | `f441612` wired some stubs; verify remaining ones in Audit 2 |
| A1-039 | My Packet Ratings tab: doesn't sync from Tactical Calculator | LOW | My Packet | S4 | OPEN | |
| A1-040 | My Packet: 8-tab strip overflows on mobile | LOW | My Packet | S3 | OPEN | |
| A1-041 | Mission progress: doesn't persist or update | LOW | Missions | S4 | OPEN | |
| A1-042 | Missions: Retro Pay mission undisclosed AI requirement | LOW | Missions | S4 | OPEN | |
| A1-043 | PACT Act Navigator: no search within exposure type list | LOW | PACT Act | S4 | OPEN | |
| A1-044 | Field Manual: raw template literals visible (CRITICAL content bug) | CRITICAL | Field Manual | S1 | OPEN | `{getTotalToolCount()}` and `{PROJECT_STATS.disabilitiesValidated}` render as raw code |
| A1-045 | Emoji in interactive elements lack `aria-hidden` or `aria-label` | LOW A11Y | Site-wide | S5 | OPEN | |
| A1-046 | Search placeholder truncated on mobile (unclear what field accepts) | LOW A11Y | Condition Search | S5 | OPEN | |
| A1-047 | "No AI" button: yellow background fails WCAG AA contrast | MED A11Y | Navigation | S5 | OPEN | Duplicate surface of A1-009 |

### Issues Not in Audit 1 (found on branch work this session)

| ID | Title | Sev | Tool/Area | Status |
|----|-------|-----|-----------|--------|
| B-001 | Quick Exit button overlapped PWA install banner (bottom-right collision) | MED | App Shell | FIXED-BRANCH `7f91e3a` |
| B-002 | PWA dismiss X not clickable (missing `relative` on container) | MED | PWAInstallButton | FIXED-BRANCH `7f91e3a` |
| B-003 | Diamond Swarm `swarmReady = true` even when all WebLLM models fail | HIGH | Diamond Swarm | FIXED-BRANCH `7f91e3a` |
| B-004 | Diamond Swarm missing GPU adapter patch → model load fails on Blackwell GPU | HIGH | Diamond Swarm | FIXED-BRANCH `7f91e3a` |
| B-005 | NexusBuilder: blank render when `openNexusBuilder` fires with no event.detail | HIGH | NexusBuilder | FIXED-BRANCH `d7c9c78` |
| B-006 | 3 Playwright tests flake under 4-worker parallel load (timing, not logic) | LOW | Test Suite | OPEN |

---

## §4 — Audit 2 Coverage Map (what to look for)

When Audit 2 results arrive, these are the new dimensions it adds. Every finding gets an `A2-xxx` ID.

| Audit 2 Phase | What it verifies | Expected new issue categories |
|---------------|-----------------|-------------------------------|
| Phase 2: Local AI init | GPU patch fires, model loads, log lines present | WebLLM failure modes, VRAM, CSP violations for model fetch |
| Phase 3: Tool renders with packet | All 19 tools open with 9-condition fixture pre-loaded | Any tools that regressed since `f441612` |
| Phase 3: Crisis gate | Actively trigger suicidal keyword; overlay must appear before AI responds | Regression of A1-027 |
| Phase 4: C-File AI | AI response references condition names from fixture | Response quality, hallucination, empty responses |
| Phase 4: Blue Button AI | AI response references Blue Button conditions | Same |
| Phase 4: NexusBuilder AI draft | Draft references pre-populated condition; statement saves to localStorage | B-005 regression, statement persistence |
| Phase 4: Secondary Scout AI | Suggestions list returns results | Result count, quality |
| Phase 4: Decision Decoder AI | AI decodes synthetic denial text | A1-030 — is fallback wired? |
| Phase 4: Witness Bench AI | Draft generated | Quality, PTSD-specific content |
| Phase 5: My Packet storage | 9 conditions present after 3 tool open/close cycles; statement from phase 4 persists | A1-037 regression, data loss under tool churn |
| Phase 5: PII guard | No real SSN pattern in any localStorage key | Security |
| Phase 6: Console health | All BLOCKER/HIGH errors | Catches B-003, B-004 regressions and any new AI-specific errors |
| Phase 6: Known-fix regression | B-001 through B-006 all confirmed resolved | Any regressions from today's commits |

---

## §5 — Severity / Priority Matrix (combined view)

```
CRITICAL SAFETY (fix before any release)
  A1-027  C&P Simulator: suicidal ideation Q → no crisis line
  
CRITICAL BUGS (broken core functionality)
  A1-033  Time Machine Start Countdown closes modal with no output
  A1-044  Field Manual: raw template literals visible to users

HIGH FUNCTIONAL
  A1-004  Tool count inconsistent site-wide
  A1-006  Atomic Wipe: no confirmation, dangerous placement
  A1-011  Search "No Results" race condition
  A1-014  Save to Packet: 30s main-thread freeze
  A1-018  Luna tooltip blocks pay amount (doesn't dismiss)
  A1-019  Time Machine: wrong rate ($1,716 vs $1,808.45)
  A1-023  ESC key: not all modals close (WCAG 2.1.2) [PARTIAL FIX]
  A1-024  Close button hit targets < 44px (WCAG 2.5.5) [PARTIAL FIX]
  A1-030  Decision Decoder non-functional without AI
  A1-037  My Packet: 0% readiness despite saved condition

HIGH (pre-fixed on branch — Audit 2 should confirm resolved)
  B-003  Diamond Swarm: swarmReady true even on all-model failure [FIXED]
  B-004  WebLLM: no GPU adapter patch → model load fails Blackwell [FIXED]
  B-005  NexusBuilder blank render with no event.detail [FIXED]

MEDIUM (20 issues — see table above)
LOW (17 issues — see table above)
```

---

## §6 — Merge Procedure (run when Audit 2 arrives)

1. **Assign A2-xxx IDs** to every new finding in Audit 2 results.
2. **Cross-confirm**: if Audit 2 mentions the same issue as an A1-xxx entry, mark that row `CONFIRMED-BOTH` and add an `A2-xxx` reference in the Notes column.
3. **Upgrade severity** if Audit 2 finds a worse manifestation of an A1 issue (e.g., A1-023 ESC key is PARTIAL on branch — if Audit 2 finds it still broken everywhere, upgrade to OPEN/HIGH with higher urgency).
4. **Downgrade / close** A1 issues where Audit 2 confirms the branch pre-fix resolved them (status → `FIXED-BRANCH`, add ✅ to §2 pre-fix checklist).
5. **Add A2-only issues** below the A1 table as a new section.
6. Produce the **Mega Audit** = §2 (branch pre-fixes, updated) + §3 (all A1 + A2 issues, merged) + prioritized sprint plan cross-referencing both audits.

---

## §7 — Sprint Crosswalk (Audit 1 sprints vs open issues)

| Sprint | Audit 1 Issues | Pre-fixed (branch) | Remaining |
|--------|---------------|-------------------|-----------|
| S1 — Critical (1-2 days) | A1-027, A1-033, A1-044 | — | 3 open |
| S2 — High bugs (2-3 days) | A1-011, A1-018, A1-019, A1-023, A1-024 | A1-023/24 PARTIAL | 3 full open + 2 partial |
| S3 — Medium UX (3-5 days) | A1-004, A1-005, A1-006, A1-008, A1-009, A1-010, A1-012, A1-016, A1-021, A1-030, A1-032, A1-035, A1-037, A1-038, A1-040 | A1-038 PARTIAL | 14 open |
| S4 — Low/polish (5-7 days) | A1-001, A1-002, A1-003, A1-007, A1-013, A1-015, A1-017, A1-020, A1-022, A1-025, A1-028, A1-029, A1-031, A1-034, A1-036, A1-039, A1-041, A1-042, A1-043 | — | 19 open |
| S5 — A11y deep dive (3-4 days) | A1-023, A1-024, A1-045, A1-046, A1-047 | PARTIAL on 023/024 | 3 open + 2 partial |
| S6 — New tools | A1-026, A1-034 | — | 2 open |

---

*Source: `docs/VET-RATE-ORG-AUDIT-REPORT-2026-06-08.md` (Chrome UI audit, no AI) + branch work on `audit/cfile-fullsweep` as of 2026-06-08. Audit 2 results pending.*
