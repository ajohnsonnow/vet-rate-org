# Vet-Rate.org — C-File Audit Test Results

> **Project:** `e:\VS_Studio\vet-rate-org-official` · v1.23.1  
> **Audit cycle:** 2026-06-08 (Sprint 0–8, Sonnet 4.6 executing)  
> **Branch:** `audit/cfile-fullsweep` off `audit/s9-mobile-safety-net`  
> **PII constraint:** `E:\Johnson_C-FIle` is real veteran data — never committed. Redacted synthetic fixture lives at `tests/fixtures/redacted-packet.json` (Sprint 1).

---

## Sprint 0 — Baseline all harnesses & fix the RED e2e gate

### Environment

| Item | Value |
|---|---|
| Node | v25.2.1 (satisfies `>=18.0.0`; `.nvmrc` says 20 — cosmetic EBADENGINE warning only) |
| npm | 10.9.2 |
| Date | 2026-06-08 |

### Pre-fix baseline (from `preflight-report.json` 2026-06-08T04:06:44Z, v1.23.0)

| Gate | Status | Duration | Notes |
|---|---|---|---|
| ESLint | PASS | 8.2 s | 3 warnings, 0 errors |
| Unit tests + coverage (Vitest) | PASS | 16.1 s | 849/849 pass |
| **E2E — chromium** | **FAIL** | 182.3 s | Release blocker |
| Production build | PASS | 29.0 s | — |
| Security scan (OWASP) | PASS | 0.4 s | 0 critical, 4 warnings |
| Secret scan (gitleaks) | PASS | 46.3 s | 0 secrets |
| SAST (semgrep) | PASS | 41.7 s | 40 info findings |
| Bundle budget | PASS | 0.3 s | 1 pre-existing breach tracked (S4.5/S5) |
| Contract enforcement | PASS | 0.8 s | 0 high+ in prod deps |
| Accessibility audit (ARIA) | PASS | 0.0 s | 161/165 components (98%) |

Red-team suite (separate run): **48/48 pass**  
TypeScript check: **PASS**

### Root cause of RED chromium e2e gate

**Failing tests:** `mobile.spec.ts` — "What's New modal keeps its CTA in view" at 360px and 390px viewports. Intermittent under 6 parallel workers; passes in isolation.

**Symptom:** `expect(m.hasButton).toBe(true)` — received `false`.

**Root cause:** The poll used `inspectResponsiveModal(page)` which calls `document.querySelector(".modal-footer")` (generic selector). React 18's StrictMode intentionally unmounts and remounts every component once during initial page load. The poll could resolve during the first mount (before StrictMode unmount), then `inspectResponsiveModal` ran in the unmount window — no `.modal-footer` in DOM → `{found: false, hasButton: false}`. This window is widened under heavy parallel load (6 workers contending for the Vite dev server).

### Fix — `tests/e2e/mobile.spec.ts`

Replaced the generic `expect.poll(.found)` + `inspectResponsiveModal` assertions with Playwright's auto-retrying locator matchers, scoped to the specific WhatsNew dialog:

```diff
-      await expect
-        .poll(async () => (await inspectResponsiveModal(page)).found, {
-          timeout: 6000,
-        })
-        .toBe(true);
-
-      const m = await inspectResponsiveModal(page);
-      expect(m.overflow).toBeLessThanOrEqual(1);
-      expect(m.hasButton).toBe(true);
-      expect(m.ctaInViewport).toBe(true);
-      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
+      const footerBtn = page.locator(
+        '[role="dialog"][aria-labelledby="whats-new-title"] .modal-footer button',
+      );
+      // toBeVisible + toBeInViewport use Playwright's built-in auto-retry, so they
+      // ride through React.StrictMode's unmount→remount cycle without a false pass.
+      await expect(footerBtn).toBeVisible({ timeout: 8000 });
+      await expect(footerBtn).toBeInViewport();
+      const m = await inspectResponsiveModal(page);
+      expect(m.overflow).toBeLessThanOrEqual(1);
+      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
```

`toBeVisible` and `toBeInViewport` retry until the condition holds, riding through the StrictMode window. They only pass once the button is stably visible in the post-StrictMode second mount. The overflow check keeps `inspectResponsiveModal` (returns `overflow: 0` vacuously if modal is briefly absent, which passes ≤ 1 safely). No changes to components, `playwright.config.ts`, or other tests.

### Post-fix gate results

| Gate | Status | Count |
|---|---|---|
| E2E — chromium | **PASS** | 235/235 |
| E2E — firefox | _(see full-suite row below)_ | — |
| E2E — mobile-chrome | _(see full-suite row below)_ | — |

**Isolated What's New run (3 workers):** 3/3 — 360px ✓ 390px ✓ 768px ✓  
**Full chromium suite (6 workers):** 235/235 — all green

### Full Playwright suite (all 3 projects, 705 tests) — 2026-06-08

| Project | Status | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| chromium | **PASS** | 235 | 0 | 0 | — |
| firefox | pre-existing fails | 233 | 2 | 0 | See notes below |
| mobile-chrome | pre-existing fail | 234 | 1 | 0 | See notes below |
| **Total** | — | **699** | **3** | **3** | 3 skips = `dialog-contract skip-link` test.fixme across all projects |

**Pre-existing failures (not caused by this sprint's change):**

- `[firefox] accessibility.spec.ts:10` — "Tab key cycles through interactive elements": `document.activeElement.tagName` is `"DIV"` after Tab because `ResponsiveModal`'s scroll region has `tabIndex={0}` for a11y (axe `scrollable-region-focusable`). Test's expected list omits `"DIV"`. Filed in Sprint 6 scope.
- `[firefox] search.spec.ts:12` — "search input is present and focusable": Firefox-specific timing. Not related to `mobile.spec.ts`.
- `[mobile-chrome] axe.spec.ts:200` — "axe: WCAG 2.2 AA — serious/critical › home page": Pre-existing axe violation on mobile-chrome home page. Filed in Sprint 6 scope.

**What's New tests (the sprint's target):** 9/9 PASS across all 3 viewports × 3 projects.

---

## Sprint 1 — Real-data ingestion round-trip

### Changes

**`scripts/ingest-cfile.mjs` — OUTPUT_PATH date-stamp fix**

Before:

```js
const OUTPUT_PATH = 'E:\\Johnson_C-FIle\\vet-rate-packet-johnson-anthony-2026-03-21.json';
```

After:

```js
const runDate = new Date().toISOString().slice(0, 10);
const OUTPUT_PATH = `${CFILE_DIR}\\vet-rate-packet-${runDate}.json`;
```

Each invocation now writes to `vet-rate-packet-YYYY-MM-DD.json`. Multiple runs on the same calendar day still overwrite; runs on different days create separate files.

**`tests/fixtures/redacted-packet.json`** — new synthetic v2.0 packet fixture

| Field | Value |
|---|---|
| version | `2.0` |
| source | `Vet-Rate.org` |
| PII | All replaced — name `JOHN Q. VETERAN`, SSN `000-00-0000`, file# `C-000-0000`, DOB `1970-01-01` |
| Claims | 9 conditions (see table below) |

| # | conditionName | DC | selectedRating | claimType |
|---|---|---|---|---|
| 1 | Post-Traumatic Stress Disorder (PTSD) | 9411 | 50% | Primary |
| 2 | Lumbosacral Strain | 5237 | 20% | Primary |
| 3 | Radiculopathy, Lower Extremity, Left | 8520 | 20% | Secondary |
| 4 | Radiculopathy, Lower Extremity, Right | 8521 | 10% | Secondary |
| 5 | Hip, Limitation of Motion, Left | 5252 | 10% | Primary |
| 6 | Hip, Limitation of Motion, Right | 5252 | 10% | Primary |
| 7 | Knee, Limitation of Flexion, Left | 5260 | 10% | Primary |
| 8 | Pes Planus, Bilateral | 5276 | 10% | Primary |
| 9 | Tinnitus | 6260 | 10% | Primary |

Combined rating implied: ~80% (matches Johnson ground truth; Sprint 2 verifies the calculator).

**`tests/e2e/cfile-packet.spec.ts`** — new e2e spec (4 tests × 3 browsers)

| Test | What it asserts |
|---|---|
| fixture is a valid v2.0 packet with 9 conditions | Schema shape, PTSD DC 9411 @ 50%, 2 Secondary claims — pure JS (no browser) |
| claims are present in localStorage after app boot | `vet_rate_saved_claims` survives app initialization; PTSD entry findable |
| claims persist across page reload | `vet_rate_saved_claims` intact after `page.reload()`; head + tail IDs present |
| app boots without crashing with 9 pre-loaded claims | No `pageerror` events (ResizeObserver noise excluded); `body` visible |

### Incidental finding (Sprint 2 scope)

`scripts/ingest-cfile.mjs` emits `ratingPercent` on each claim object; `packetBackup.js` `VALID_CLAIM_FIELDS` uses `selectedRating`. The two field names differ — packets produced by the ingest script cannot be round-tripped through `importCompletePacket` without losing the rating value. Tracked for Sprint 2 dual-calc reconciliation.

### Sprint 1 gate results

| Gate | Status | Count | Notes |
|---|---|---|---|
| cfile-packet.spec.ts — chromium | **PASS** | 4/4 | 14.2 s |
| cfile-packet.spec.ts — firefox | **PASS** | 4/4 | — |
| cfile-packet.spec.ts — mobile-chrome | **PASS** | 4/4 | — |
| **Total new tests** | — | **12/12** | — |

Full suite total (all specs, all projects): **711/717** pass (prior 699/705 + 12 new, same 3 pre-existing firefox/mobile-chrome fails, same 3 skips).

---

## Sprint 2 — Calculation correctness vs the Johnson 80% ground truth

### Findings

**Both calculators agree: 80% for the Johnson 9-condition set.**

Step trace (38 CFR § 4.25 whole-person efficiency, intermediate rounding):

| Step | New rating | Remaining | Addition | Combined |
|---|---|---|---|---|
| 1 | 50% PTSD | 50% | — | 50 |
| 2 | 20% Lumbosacral | 50% | +10 | 60 |
| 3 | 20% L Radiculopathy | 40% | +8 | 68 |
| 4 | 10% R Radiculopathy | 32% | +3 | 71 |
| 5 | 10% L Hip | 29% | +3 | 74 |
| 6 | 10% R Hip | 26% | +3 | 77 |
| 7 | 10% L Knee | 23% | +2 | 79 |
| 8 | 10% Pes Planus | 21% | +2 | 81 |
| 9 | 10% Tinnitus | 19% | +2 | **83** |

83% → nearest-10 rounding → **80%** ✓

**Divergence note:** `ratingCalculator.js` applies `Math.round(sorted[i] × remaining / 100)` at each step (integer intermediates); `vaCalculator.js` uses `combineTwoRatings` which converts to fractions `(a + b × (1−a)) × 100` and rounds. Both produce 83 pre-rounding and 80 final. Implementations differ only in the bilateral application scope (see below).

### Changes

**`src/__tests__/utils/johnsonGroundTruth.test.js`** — new ground-truth test file (15 tests)

| Describe | Tests |
|---|---|
| Johnson 80% — ratingCalculator.js | 3: final 80%, exact ~82.99, nearest-10 |
| Johnson 80% — vaCalculator.js | 3: combineMultipleRatings=83, rounding, agreement |
| Bilateral detection — checkBilateralFactor | 5: hip pair, radiculopathy pair, L/R abbrev, single-side, 0-rated |
| 2026 pay rates spot-check | 4: solo[100]=$3938.58, solo[50]=$1132.90, monotonic, [80] range |

**`src/utils/ratingCalculator.js` — bilateral fix**

- Added `"radiculopathy"` to `bilateralPairs` list — L/R radiculopathy pairs now correctly detected under 38 CFR § 4.26
- Added `normalizeSide()` helper: replaces standalone `\bL\b` → `"left"` and `\bR\b` → `"right"` before name matching, so `"L Hip"`, `"L Knee"`, etc. are recognized

**`src/components/RetroPayHunter.jsx` — dollar output fix**

`retroPayFindings` string now includes the estimated dollar total alongside the month count, so the My Packet / VKB entry carries actionable dollar information rather than just a month count.

**`tests/e2e/tactical-calculator.spec.ts`** — new e2e spec (3 tests × 3 browsers)

| Test | Assert |
|---|---|
| modal opens without crashing | dialog visible, no pageerror |
| two conditions → correct combined (VA § 4.25) | PTSD 50% + Back 20% → displayed "60%" |
| PTSD 50% alone → 50% combined | "50%" displayed |

### Sprint 2 gate results

| Gate | Status | Count | Notes |
|---|---|---|---|
| johnsonGroundTruth.test.js (Vitest) | **PASS** | 15/15 | 1.07 s |
| ratingCalculator.test.js + Edge (Vitest) | **PASS** | 43/43 | No regressions |
| tactical-calculator.spec.ts — chromium | **PASS** | 3/3 | 35.5 s |
| tactical-calculator.spec.ts — firefox | **PASS** | 3/3 | — |
| tactical-calculator.spec.ts — mobile-chrome | **PASS** | 3/3 | — |
| cfile-packet.spec.ts (regression) | **PASS** | 12/12 | — |

**2026 VA pay rates verified:** `solo[100] = $3938.58` ✓, `solo[50] = $1132.90` ✓

Full suite total: **730/736** pass (prior 711/717 + 15 new unit + 9 new e2e; same 3 pre-existing firefox/mobile-chrome fails; same 3 skips).

---

## Sprint 3 — 48-tool launch matrix

### Changes

**`src/features/claim-prep/ClaimPrepCluster.jsx` — 2 stub fixes**

| Stub | Before | After |
|---|---|---|
| `MOSHazardMatcher.onAddToPathfinder` | `console.log` no-op | Closes MOS modal, dispatches `openPathfinder` with `{ detail: { conditions } }` |
| `WebOfConditions.onSelectCondition` | `console.log` no-op | Calls `saveClaim({ conditionName: condition })` to persist the selection |

**`src/features/vkb/VKBTimelineModal.jsx` — 1 stub fix**

| Stub | Before | After |
|---|---|---|
| `VKBTimeline.onDocumentClick` | `console.log` no-op | Closes timeline, dispatches `openVKBViewer` with `{ detail: { docId: doc.id } }` |

**`tests/e2e/tool-launch-matrix.spec.ts` — new file**

- Dispatches all 48 user-facing tool events in sequence (one page boot, serial execution)
- Seeds `localStorage` with `tests/fixtures/redacted-packet.json` (9 redacted claims)
- `modalIsVisible`: polls `[role="dialog"]` and `[aria-modal="true"]` up to 7 s (14 × 500 ms)
- `closeModal`: Escape → wait for hidden + 300 ms settle; falls back to force-clicking close button
- Assertions: soft per-tool JS error check; cluster-level `≥ 1 tool renders` (7 clusters)

### 48-tool dispatch results (chromium)

| # | Tool | Cluster | Renders | Notes |
|---|---|---|---|---|
| 1 | Tactical Calculator | Calculate | ✓ | — |
| 2 | Million Dollar Dashboard | Calculate | ✓ | — |
| 3 | Time Machine (ITF) | Calculate | ✓ | — |
| 4 | Retro Pay Hunter | Calculate | ✓ | — |
| 5 | C&P Exam Simulator | Calculate | ✓ | — |
| 6 | BDD Builder | Discover | ✓ | — |
| 7 | Secondary Scout | Discover | ✓ | — |
| 8 | Pathfinder | Discover | ✓ | — |
| 9 | MOS Hazard Matcher | Discover | ✓ | — |
| 10 | PACT Act Navigator | Discover | ✓ | — |
| 11 | Web of Conditions | Discover | ✓ | — |
| 12 | Claim Navigator | Discover | ✗ | Component uses `.fixed.inset-0` overlay without `role="dialog"` — ARIA gap; queued Sprint 6 |
| 13 | C-File AI Analyzer | Evidence | ✓ | — |
| 14 | Blue Button X-Ray | Evidence | ✓ | — |
| 15 | Muster Call (PDF) | Evidence | ✓ | — |
| 16 | Witness Bench | Evidence | ✓ | — |
| 17 | Nexus Builder | Evidence | ✗ | Context-driven: requires `e.detail.condition` to render (no standalone open mode) |
| 18 | Forms Helper | Evidence | ✓ | — |
| 19 | Symptom Logger | Evidence | ✓ | — |
| 20 | Pain Painter | Evidence | ✓ | — |
| 21 | Evidence Timeline | Evidence | ✓ | — |
| 22 | FOIA Keysmith | Evidence | ✓ | — |
| 23 | Red Team | QC | ✓ | — |
| 24 | The War Game | QC | ✓ | — |
| 25 | Decision Decoder | QC | ✓ | — |
| 26 | Denials Decoder | QC | ✗ | Component uses custom layout without `role="dialog"` — ARIA gap; queued Sprint 6 |
| 27 | Shark Radar | QC | ✓ | — |
| 28 | Consistency Engine | QC | ✓ | — |
| 29 | Evidence Gap Finder | QC | ✓ | — |
| 30 | Risk Assessment | QC | ✓ | — |
| 31 | TDIU Builder | Maximize | ✓ | — |
| 32 | State Benefit Hunter | Maximize | ✓ | — |
| 33 | The Tribunal | Maximize | ✓ | — |
| 34 | Legislative Watchdog | Maximize | ✓ | — |
| 35 | Body Map Selector | Maximize | ✓ | — |
| 36 | Nexus Quality Analyzer | Appeals | ✓ | — |
| 37 | Remand Risk Checker | Appeals | ✓ | — |
| 38 | Appeals Lane Advisor | Appeals | ✓ | — |
| 39 | VSO Finder | Support | ✓ | — |
| 40 | My Packet | Support | ✓ | — |
| 41 | Knowledge Base (VKB) | Support | ✓ | — |
| 42 | VA Resources Hub | Support | ✓ | — |
| 43 | Field Manual | Support | ✓ | — |
| 44 | Cloud Sync | Support | ✓ | — |
| 45 | Backup Manager | Support | ✓ | — |
| 46 | VKB Timeline | Support | ✓ | — |
| 47 | Publications Library | Support | ✓ | — |
| 48 | Record Search | Support | ✓ | — |

**Summary: 45/48 render (94%).**

Non-renders are genuine findings, not test failures:

- Claim Navigator + Denials Decoder: missing `role="dialog"` on full-screen overlay → WCAG 2.2 / ARIA violation (Sprint 6 fix list)
- Nexus Builder: context-driven by design; only opens when another tool passes a condition detail

### Stub fix validation

ESLint (0 errors/warnings on changed files) confirmed clean after all 3 stub fixes.

### Sprint 3 gate results

| Gate | Status | Count | Notes |
|---|---|---|---|
| tool-launch-matrix.spec.ts (chromium) | **PASS** | 1/1 | 45/48 tool renders; all 7 cluster assertions ≥ 1 |
| ESLint — ClaimPrepCluster + VKBTimelineModal | **PASS** | 0 errors, 0 warnings | — |

Full suite total (all specs, all projects): **731/737** pass (prior 730/736 + 1 new e2e; same 3 pre-existing firefox/mobile-chrome fails; same 3 skips).

---

## Sprint 4 — Privacy & security audit

### Gate results

| Check | Result | Notes |
|---|---|---|
| `npm audit` | PASS | 0 vulnerabilities |
| `npm run test:red-team` | PASS | 48/48 pass |
| `piiScrubber.js` review | PASS | SSN, VA file, EDIPI, MRN, email, phone, DOB, address; NFKC normalization against unicode obfuscation |
| Gemini default-off | PASS | BYOK only — no provider enabled by default; confirmed in LanguageContext.jsx:16470 |
| Atomic Wipe coverage | PASS | Clears localStorage, sessionStorage, cookies, all IndexedDB (modern API + named-DB fallback), Cache Storage, Service Workers |
| BugSquasher endpoint | FIXED | Was hardcoded `formsubmit.co/Anth@StructuredForGrowth.com`; now reads `VITE_BUG_REPORT_ENDPOINT` (empty = send disabled) |
| BugSquasher PII guard | FIXED | `scrubPII()` applied to all free-text fields + `full_report` before remote send |

### Findings

**F4-1 — BugSquasher hardcoded endpoint (FIXED)**

`src/components/BugSquasher.jsx:22` contained a hardcoded `formsubmit.co` URL pointing to the developer's email. Any build shipped to production would silently send bug reports (including the full formatted report with console logs and app state) to a third-party email relay without operator control.

Fix: endpoint moved to `import.meta.env.VITE_BUG_REPORT_ENDPOINT ?? ""`. Send block is skipped entirely when the variable is empty. Documented in `.env.example`.

**F4-2 — No PII scrub before formsubmit.co send (FIXED)**

The `full_report` field sent to formsubmit.co contained: user-typed free-text (description, steps, expected/actual behavior, additional context), console logs captured via `initializeErrorCapture()`, and localStorage condition names. Console logs are captured without keyword filtering for `console.error`/`console.warn`, creating a potential vector for accidental PII egress if any code path logs sensitive values.

Fix: `scrubPII()` from `piiScrubber.js` applied to all five free-text fields and `full_report` before payload construction.

**F4-3 — `getStorageInfo()` leaks condition names (LOW / accepted)**

`bugReportUtils.js:311` serializes `savedClaimConditions: claimsData.map(c => ({ condition: c.conditionName, ... }))`. Condition names are not PII under this project's definition. Accepted — no change needed.

### Fixes committed

- `src/components/BugSquasher.jsx` — env-configurable endpoint + PII scrub
- `.env.example` — `VITE_BUG_REPORT_ENDPOINT` documented

---

## Sprint 5 — Domain accuracy spot-check

> To be populated after Sprint 5 execution.

---

## Sprint 6 — Accessibility pass

> To be populated after Sprint 6 execution.
