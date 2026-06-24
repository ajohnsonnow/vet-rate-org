# Vet-Rate.org — Master Audit Execution Report (Fable session)

> **Branch:** `audit/fable-master-plan` off `main`
> **Session dates:** 2026-06-09 → 2026-06-10
> **Executor:** Claude Fable 5 + Anthony Johnson
> **Plan:** approved master plan (WS-0…WS-9), builds on `audit/2026-06-cfile/` (2026-06-08)
> **PII constraint:** real veteran data stayed at `E:\Williams_C-FIle`; only the redacted
> fixture pattern (`JOHN Q. VETERAN`) appears in the repo. Stress results are gitignored.

---

## Commits (in order)

| Commit | Workstream | Summary |
|---|---|---|
| `a1dc40c` | WS-0 | Pay-rate single source of truth — three rate vintages (2024/2025/2026) were live at once; all consumers now derive from `vaPayRatesHistorical.js`; drift-guard test scans for re-hardcoded tables; retro-pay date validation + day-31 month-skip fix |
| `782938a` | WS-2/3 | Ingestion resilience: chunk retry + failedChunks manifest, AI circuit breaker, Florence-2 worker watchdog, merged-result DC validation, date-normalized dedup, quota pre-flight, OCR confidence persisted |
| `9eb02dd` | WS-4 | TDIU (38 CFR § 4.16(a)) + SMC-S (38 U.S.C. § 1114(s)) detection banners; DC 8620 criteria filled from § 4.124a |
| `fbd4b2a` | WS-5 | Simulator WCAG 2.2 AA: Tribunal live captions + always-usable text input + Firefox no-SpeechRecognition fix; What-If Sandbox keyboard drag-drop alternative; Body Map keyboard zones + non-color state |
| `64c14eb` | WS-6 | ClaimNavigator/DenialDecoder focus traps + aria-modal; ResponsiveModal overflow-aware scroll tabIndex (fixes documented Firefox F6-2) |
| `bf05720` | WS-8 | Storage quota guards, packet version unification (1.0→2.0.0 migration seeded), import restore point + confirm, profile save failures surfaced |
| `89f1bf9` | WS-9 | DKB freshness pipeline: validate-dkb CI gate, eCFR inverse index, weekly dkb-freshness workflow, eval:rag baseline gate, Legislative Watchdog static-first (+ fixed its since-inception HTTP 400), Florence-2 model pinned |
| `876ea98` | WS-5 fix | Axe-clean simulator dialogs (amber badges, dark-mode yellow-button contrast, focusable scroll regions) |
| perf commit | perf | C-File analysis hours→realistic: engine-aware chunk budgets (8K swarm context honored, ~11x fewer generations), boilerplate page screen, ETA double-count fix (~100x inflation), OCR worker pool + confidence-gated ensemble |
| `80dda1d` | UX | Elapsed-time heartbeat during C-File processing (silent phases looked like crashes) |
| `5b973e4` | test | Atomic Wipe e2e follows the real trigger location (failed on main too) |
| `0d5330a` | WS-7 | VKB→calculator wiring: "Load into calculator" banner, Evidence Timeline import, sourceDocumentId linkage, normalized dedup; fixed dead Consistency-Engine/WhatIfSandbox store keys; strict packet acceptance e2e (old one passed vacuously); QuickExit/close-button mobile target collision |
| _(this)_ | WS-1 | 313MB stress harness (env-gated, dev-machine only) |

## Performance investigation (user-reported "712-minute ETA")

Three compounding causes, all fixed:

1. `estimateProcessingTime` multiplied per-chunk time by total text size —
   double-counting that inflated the display ~100x.
2. Local chunk budget was a flat 400 tokens against an 8K-context engine —
   thousands of sequential generations. Now engine-aware (4,500 swarm /
   1,500 for 4K engines).
3. Every page reached the LLM. A keep-biased boilerplate screen (fails open)
   now drops pages with no dates and no claim vocabulary.

Plus: OCR worker pool (was 1 sequential worker × 3 resolution scales per
page) with confidence-gated escalation for sub-50MB scanned documents.

Verified during stress runs: extraction of the real 313MB C-File completes
inside the first ~15 minutes; the Warrant Council then runs at ~92% GPU
utilization (8GB VRAM) for the analysis phase. Full-pipeline wall time
exceeds 30 minutes; exact number recorded from the 3h-budget run below.

## Notable bugs found beyond the plan

1. **Consistency Engine read six localStorage keys nothing writes** (`savedClaims`,
   `statements`, `forms`, `ratings`, `symptomLogs`, `veteranProfile`) — every rule ran
   against empty data; the tool could never find a contradiction. Now bound to the
   canonical stores with shape adapters.
2. **Legislative Watchdog Federal Register query had failed with HTTP 400 since
   inception** (invalid field + comma-joined `fields[]`) — permanently on curated
   fallback. Fixed in component + new weekly snapshot script.
3. **The Tribunal hung forever on Firefox** ("Initializing speech recognition…") where
   SpeechRecognition is unavailable — tool was 100% unusable there.
4. **tool-with-packet calculator test passed vacuously on Chromium** — `innerText`
   includes `<option>` values there ("50"/"80" matched the rating dropdown, not data).
   Firefox exposed it. Replaced with a strict load-path assertion (PTSD + 80%).
5. **Blocked IndexedDB opens never settle** — a VKB read could silently hang consumers;
   `getLoadableConditions` now races a 3s guard.
6. **Quick Exit panic button overlapped modal close buttons on phones** (WCAG 2.5.8) —
   Workflow Guide + Appeals Lane close targets enlarged to 44px and shifted clear.
7. **Pre-existing e2e reds cleared:** Firefox Tab-cycle (F6-2), mobile-chrome axe
   home-page (F6-3), Atomic Wipe spec (stale trigger location, failed on main).

## Gate status

| Gate | Status |
|---|---|
| Unit (vitest) | 1010/1010 PASS (was 849 pre-session) |
| ESLint | 0 errors (2 pre-existing warnings) |
| tsc --noEmit | PASS |
| e2e chromium (full) | _pending final run_ |
| e2e firefox + mobile-chrome | 569 passed; all 4 failures triaged → fixed (2 were pre-existing on main, verified) |
| axe WCAG 2.2 AA | 24 surfaces (was 21) incl. Tribunal, What-If Sandbox, Body Map — PASS |
| Stress harness (313MB real C-File) | _pending_ |
| preflight:full | _pending_ |

## Open items / follow-ups

- `vetrate:ai-engine-failed` window event has no UI toast listener yet (WS-2 emitted it).
- `florenceOCRService.askQuestion()` has no watchdog (processDocument does).
- Dormant legal-ingestion fetchers (M21-1 / CAVC / FedCir) are scaffolds with placeholder
  URLs — need verified endpoints before enabling (WS-9 deliberately did not enable).
- Part 3/appeals eval queries (target recall@5 ≥ 0.92) blocked on the above.
- GitHub labels `dkb-freshness` / `dkb-freshness-stale` must exist before the weekly
  workflow can open issues.
- Florence-2 worker revision pin not yet exercised in a browser — run one OCR pass before release.
- `extract` (AI-off) stress mode is un-drivable by design (Analyze button gates on AI
  availability) — documented skip in the harness.
- Stress wasm mode initializes wllama via a dev-module import (no production UI path).

_Stress results and final gate numbers appended below when complete._
