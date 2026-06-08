# Vet-Rate.org — C-File Full-Sweep: Test → Fix → Audit → Improvement-Plan Sprints

> **Hand-off doc.** Authored 2026-06-08 (Opus 4.8) for a **Sonnet 4.6 (max effort) executing session**.
> Start at **Sprint 0** and proceed consecutively. Read **Operating rules** first and apply them throughout.
> This session's two saved outputs are `audit/2026-06-cfile/AUDIT-REPORT.md` and `audit/2026-06-cfile/IMPROVEMENT-PLAN.md`
> (plus the running `TEST-RESULTS.md`). Source data: `E:\Williams_C-FIle` (real veteran C-File — handle as PII).

---

## Context

Vet-Rate.org (`e:\VS_Studio\vet-rate-org-official`, v1.23.1) is a privacy-first, **100% client-side** React+Vite SPA that helps veterans build, strengthen, and appeal VA disability claims. It exposes **48 user-facing tools** across 7 clusters (Calculate, Discover, Evidence, Quality Control, Maximize, Appeals, Body Mapping), runs AI in-browser (Wllama 7B GGUF, Florence-2/SmolVLM vision, Tesseract.js OCR) with optional opt-in Gemini cloud + Google Drive sync, and stores all veteran data locally (localStorage + IndexedDB).

Goal: (1) **thoroughly and exhaustively test every tool against the real C-File** at `E:\Williams_C-FIle`, (2) **fix everything feasible** in the same session, and (3) leave behind a **saved improvement plan** for everything not fixed.

A read-only recon (9 agents) established the ground truth this plan is built on:

- **Run procedure**: `npm run dev` → `http://localhost:5173`; import the pre-built packet `E:\Williams_C-FIle\vet-rate-packet-johnson-anthony-2026-03-21.json` (0.72 MB, schema v2.0, 38 importedFiles, 16 claims, 11 ratings) via **My Packet → Import**. This single import seeds nearly every downstream tool.
- **Canonical correctness check**: Johnson's real **combined rating = 80%** — PTSD 50 (9411), lumbosacral/DDD 20 (5242), L femoral radiculopathy 20 (8520), R femoral radiculopathy 10 (8620), L hip 10 + R hip 10 (5252, bilateral pair), L knee ITB 10 (5260), bilateral pes planus 10 (5276), tinnitus 10 (6260), plus several 0% conditions. **The app MUST compute 80%.**
- **Current release blocker**: `preflight-report.json` (2026-06-08) shows the chromium Playwright e2e suite **RED** (fails after ~182 s, no captured error). All other gates (ESLint, 782+ unit tests, build, Snyk, gitleaks, semgrep, a11y) pass.
- **Server/browser asymmetry**: the 4 scanned DD214 PDFs are image-only (`needsBrowserOCR:true`); `scripts/ingest-cfile.mjs` does **not** OCR them — only the browser **Muster Call** (Tesseract) path completes them.

### Decisions (from the owner)
- **Scope of action:** Fix everything feasible during the session; write the improvement plan for the rest.
- **Test method:** Hybrid — automated harness (Playwright + Vitest + a Node packet-load script) for all 48 tools; documented manual-verification steps for OCR/vision/AI-output-quality (need a GPU browser + human judgment).
- **Coverage depth:** Risk-weighted — deep on rating math, ingestion/OCR, privacy/PII, and domain accuracy; fast smoke/wiring verification on the rest.

---

## Operating rules for the executing Sonnet 4.6 session (read first, apply throughout)

1. **Effort:** run at `high`/`xhigh`. This is security- and correctness-sensitive veteran software.
2. **PII/PHI is real.** `E:\Williams_C-FIle` contains a real veteran's SSN, file number, DOB, and diagnoses.
   - **NEVER** copy the real packet, Blue Button `.txt`, or any extracted text into the repo, a test fixture, a report, a commit, or a commit message.
   - Condition names, diagnostic codes, and the aggregate **80%** are **not** PII and are safe to use in committed tests/fixtures.
   - For any committed test that needs packet shape, generate a **redacted synthetic fixture** (real schema, fake name/SSN/file-number, Johnson's *condition+rating* set) under `tests/fixtures/`.
   - Run `gitleaks` before every commit; if any artifact might carry PII, keep it out of git.
3. **Git discipline (owner's global rules apply):** work on a new branch `audit/cfile-fullsweep` off the current branch. Commit **per sprint** with a descriptive message ending in the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. **Do NOT push, open/close PRs, force-push, or skip hooks without explicit user approval.** Leave pushing to the user.
4. **Fix safety:** after each fix, run the narrowest test covering it, then the relevant suite. If a fix risks regressions you cannot verify in-session, **downgrade it to `IMPROVEMENT-PLAN.md` rather than ship it half-done** (no half-finished implementations).
5. **Do not weaken the privacy model:** no new network calls, telemetry, analytics, or external dependencies. If a fix seems to need one, stop and flag it in the plan instead.
6. **Checkpoint-commit each sprint** so progress is durable if the session budget runs out. Sprints are ordered highest-value-first; if you cannot finish all of them, the critical work is already committed.
7. **Deliverables live in `audit/2026-06-cfile/`** (internal audit tree, NOT the published `docs/` MkDocs site). This path is git-tracked; keep it PII-free. The three deliverables are `TEST-RESULTS.md`, `AUDIT-REPORT.md`, `IMPROVEMENT-PLAN.md`.
8. **Browser-only steps** (real OCR of DD214s, vision models, AI generation quality) use `npm run dev:webgpu` and are recorded as **manual-verification checklists with observed results**, not headless gates.

### Key file map (verified during recon)
- Rating math: `src/utils/ratingCalculator.js`, `src/utils/vaCalculator.js` (two implementations — reconcile), `src/components/TacticalCalculator.jsx`, `src/utils/capSimulatorLogic.js`, `src/utils/vaPayRatesHistorical.js`, `VA_PAY_RATES_2026` constant.
- Bilateral logic: `checkBilateralFactor` / `calculateVARating` (brittle `toLowerCase().includes()` body-part matching).
- Ingestion/import: `scripts/ingest-cfile.mjs` (hardcoded dated `OUTPUT_PATH` at line ~25), `src/utils/packetBackup.js` (`importCompletePacket` / `importPacketData` ~lines 224-243), `src/components/MyPacket.jsx` (~1419-1426), `src/utils/myPacketManager.js`.
- Privacy: `src/utils/piiScrubber.js`, BugSquasher/FeatureRequest (hardcoded `formsubmit.co` endpoint), Gemini egress to `generativelanguage.googleapis.com`, `packages/dompurify-noop` override.
- Domain data: `src/data/disabilityData.json` (`lastVerifiedDate 2026-01-18`, stale), `secondary_conditions_db.json` (hand-written citations), `nexusLogicGenerator.js`, legal RAG index (Part 4 only).
- Dead-end stubs: `MOSHazardMatcher.onAddToPathfinder`, `WebOfConditions.onSelectCondition`, `VKBTimeline.onDocumentClick` (console.log no-ops).
- Harnesses: `vitest.config.js`, `playwright.config.ts` (e2e port 5197), `audit/dynamic-testing/`, `scripts/preflight.js`, `scripts/legal-ingestion/eval/run-eval.mjs`. Commands: `npm test`, `npm run test:red-team`, `npm run test:e2e[:axe|:mobile|:cwv|:pwa]`, `npm run preflight:full`, `npm run eval:rag`.

---

## Sprint sequence (consecutive; commit a checkpoint at the end of each)

### Sprint 0 — Baseline all harnesses & FIX the RED e2e gate (release blocker)
**Goal:** establish a green baseline and unblock the chromium Playwright suite — everything downstream rides on a working e2e harness.

**Steps**
1. `node -v` against `.nvmrc`; `npm install` if `node_modules` missing.
2. Run and record pass counts: `npm test` (expect ~782+ pass), `npm run test:red-team`, `npm run type-check`, `npm run lint`, `npm run build`.
3. Reproduce the RED gate: `npx playwright test --project=chromium --reporter=line` then, if it fails, `--debug` / `--trace on`. Diagnose the likely causes from recon: vite `startServerReadyPattern`/webServer timeout (port 5197), a lazy-chunk cold-load stall, or a Web-Locks cross-tab race.
4. **Fix** the root cause. Re-run until chromium e2e is green (or, if the root cause is environmental and not code, document precisely and add a stabilizing config/retry).
5. Open `audit/2026-06-cfile/TEST-RESULTS.md` and record the baseline table.

**Acceptance:** unit + red-team + build green; chromium e2e green or root-caused-and-fixed; baseline recorded.
**Commit:** `fix(e2e): unblock chromium Playwright gate + record audit baseline`

### Sprint 1 — Real-data ingestion round-trip (Node + browser import + OCR)
**Goal:** prove `E:\Williams_C-FIle` flows fully into the app through every entry path.

**Steps**
1. Re-run `node scripts/ingest-cfile.mjs`; inspect the output packet for `version:'2.0'`, 38 `importedFiles`, 16 `claims`, 11 `myRatings`, `veteranProfile.currentCombinedRating === 80`.
2. **Fix** the hardcoded dated `OUTPUT_PATH` (line ~25) so the run date-stamps its own filename and does not silently clobber a prior packet.
3. `npm run dev` → `http://localhost:5173`; dismiss disclaimer; **My Packet → Import** the real packet; verify 16 claims load and **persist across F5** (localStorage `vetrate_my_packet_data` + IndexedDB).
4. **Browser-only (manual, `npm run dev:webgpu`):** Muster Call — drag the 4 scanned DD214s (triggers Tesseract OCR), several `ClaimLetter-*.pdf`, and confirm extracted fields reach the Platoon Sergeant Review → Intelligence Briefing → My Packet. Blue Button X-Ray — load the `.txt`. Record observed OCR quality.
5. Create `tests/fixtures/redacted-packet.json` (synthetic PII, real schema + Johnson's condition/rating set) and add `tests/e2e/cfile-packet.spec.ts` that imports it and asserts claims load + persist. **No real PII in the committed fixture/test.**
6. Record results + any parser-fragility observations in `TEST-RESULTS.md`.

**Acceptance:** packet imports & persists; DD214 OCR produces text (documented); redacted e2e import test passes; ingest date-stamp fixed.
**Commit:** `test(ingest): real C-File round-trip + redacted import e2e; fix(ingest): date-stamp packet output`

### Sprint 2 — Calculation correctness vs the Johnson 80% ground truth (FIX dual-calc divergence)
**Goal:** protect the app's core promise — the combined-rating math — and make all tools agree.

**Steps**
1. Add `src/__tests__/utils/williamsGroundTruth.test.js`: feed Johnson's exact 16-condition set through **both** `ratingCalculator.js` and `vaCalculator.js`; assert **both === 80%** with correct bilateral handling (L/R hips 5252 pair, L/R radiculopathy 8520/8620). (Condition list + DCs are not PII — safe to commit.)
2. **Fix** the bilateral rounding-order divergence (`ratingCalculator` applies the 10% bilateral factor before final rounding; `vaCalculator` after). Make them agree for all inputs — ideally route both through one shared function so **no tool can display a different number**.
3. **Fix** brittle bilateral body-part matching in `checkBilateralFactor`/`calculateVARating` so `"L knee"`, `"left knee"`, and `"knee left"` all detect as the same limb.
4. Add `tests/e2e/tactical-calculator.spec.ts` driving the TacticalCalculator UI with Johnson's set → assert displayed combined = **80%**.
5. Verify 2026 pay rates (`solo[100]=$3938.58`, `solo[50]=$1132.90`) and **fix** Retro Pay Hunter to output **dollars** by integrating `vaPayRatesHistorical.js` (currently counts months only).
6. Record the ground-truth result + reconciliation in `TEST-RESULTS.md`.

**Acceptance:** both calculators = 80% for Johnson; UI shows 80%; bilateral detection robust; pay-rate spot-checks pass; Retro Pay returns dollars.
**Commit:** `fix(calc): reconcile dual rating calculators + robust bilateral match; test: Johnson 80% ground truth`

### Sprint 3 — Systematic functional sweep of all 48 tools (risk-weighted, hybrid)
**Goal:** exercise every tool against the imported state; record a per-tool status matrix; fix dead-end stubs.

**Steps**
1. Add a Playwright **tool-launch matrix** spec (extend `audit/dynamic-testing/` wiring-audit) that, with the redacted packet loaded, opens each of the 48 tools via `dispatchToolById`/CustomEvents and Ctrl+K, and asserts the modal renders without tripping an error boundary.
2. For each tool, record one matrix row in `TEST-RESULTS.md`: *renders? / consumes packet data? / primary action works? / notes*. Deep tools (calculators, ingestion, privacy, domain) are already covered in S1/S2/S4/S5 — here they get a smoke confirmation; the long tail gets smoke + a targeted check of its primary action.
3. **Fix** the 3 console.log dead-end stubs (`MOSHazardMatcher.onAddToPathfinder`, `WebOfConditions.onSelectCondition`, `VKBTimeline.onDocumentClick`) — wire them to their real handlers or hide the control. A button that silently does nothing erodes trust.
4. Flag BETA/incomplete tools (Shark Radar, Publications Library) for the improvement plan.

**Acceptance:** 48-tool matrix complete with status; no unexpected error-boundary trips; stubs wired or hidden.
**Commit:** `test(tools): 48-tool launch matrix vs imported packet; fix(ui): wire dead-end button stubs`

### Sprint 4 — Privacy & security audit with real PII (FIX feasible)
**Goal:** prove the zero-knowledge thesis on Johnson's real data.

**Steps**
1. With the **real** packet loaded, capture network (DevTools or Playwright route logging). On the local-AI path confirm **zero PII egress**.
2. Switch to **Gemini**, submit a prompt containing Johnson's SSN-last-4 / file number; confirm the request body to `generativelanguage.googleapis.com` contains only `[REDACTED]` tokens (validates `piiScrubber.js`). Confirm Gemini opt-in is **OFF by default**.
3. Inspect the BugSquasher/FeatureRequest payload to `formsubmit.co`: confirm it carries no PII; **fix** by making the endpoint env-configurable and adding a free-text PII guard before send.
4. Re-run `npm run test:red-team`; add any new PII-obfuscation traps surfaced by the real-data test.
5. Review `packages/dompurify-noop`: confirm no live dependency relies on real DOMPurify; add a guard test so a future dep can't silently lose sanitization.
6. Run `gitleaks`, `semgrep` (`.semgrep.yml`), Snyk (`.snyk`), `npm audit`; **fix** actionable findings.
7. Verify **Atomic Wipe** clears localStorage **and** IndexedDB completely.

**Acceptance:** no PII egress demonstrated on both paths; Gemini-off default confirmed; scans clean or findings triaged/fixed; Atomic Wipe verified.
**Commit:** `fix(privacy): configurable bug-report endpoint + PII guards; test: real-PII egress + wipe verification`

### Sprint 5 — Domain & legal accuracy spot-check (FIX/refresh feasible)
**Goal:** ensure the tool never hands a veteran wrong legal or medical guidance.

**Steps**
1. Spot-verify Johnson's diagnostic codes (9411, 5242, 8520/8620, 5276, 6260, 5252) against **live eCFR 38 CFR Part 4** (WebFetch `ecfr.gov`). Build an *app-vs-eCFR* table; flag stale criteria in `disabilityData.json` (`lastVerifiedDate 2026-01-18`). Refresh via the scraper pipeline (`scripts/scrapers/va_data_pipeline.py`) **only if** it runs cleanly in-session; otherwise document the refresh as a plan item.
2. Spot-check 3–5 `secondary_conditions_db.json` citations (e.g., "Sharafkhaneh et al., Chest 2005") for existence/support via web search; flag unverifiable ones; **strengthen the UI disclaimer** on AI nexus "Medical Research Brief" output (`nexusLogicGenerator.js`) so a veteran never presents fabricated mechanisms/citations to the VA.
3. Run `npm run eval:rag`; record the score; note the legal-coverage gap (index is Part 4 only — Parts 3/19/20 + M21-1 + case law not ingested).

**Acceptance:** DC spot-check table recorded; citation verification notes recorded; disclaimer strengthened; `eval:rag` score recorded.
**Commit:** `fix(domain): strengthen AI-nexus disclaimers; audit: eCFR + citation spot-checks`

### Sprint 6 — Accessibility & UX-completeness pass
**Goal:** hold WCAG 2.2 AA and remove remaining user-facing rough edges.

**Steps**
1. Run `npm run test:e2e:axe` (expand the gated surface beyond the current ~19-20 modals where feasible), `npm run test:e2e:mobile`, and `lhci` (`lighthouserc.json`). **Fix** high-severity a11y violations.
2. Verify mobile bottom-nav vs desktop-menu parity for tool reachability.
3. Note (for the plan) the missing **explainability** on AI risk/lane/quality scores (Risk Assessment, Remand Risk Checker, Appeals Lane Advisor, Nexus Quality Analyzer) — surfacing top contributing factors is feature work, document rather than rush.

**Acceptance:** axe gate green on expanded surface; mobile parity verified; a11y findings recorded.
**Commit:** `fix(a11y): resolve high-severity axe findings; audit: mobile parity`

### Sprint 7 — Consolidate the AUDIT REPORT
**Goal:** one authoritative record of what was tested, what works, what's broken, and what was fixed.

**Deliverable:** `audit/2026-06-cfile/AUDIT-REPORT.md` containing: harness baseline + final state; the 48-tool coverage matrix; the Johnson **80%** ground-truth result; privacy egress evidence; domain spot-check tables; a11y results; a severity-ranked list of every bug found; and a clear **FIXED-this-session (with commit refs) vs OPEN** split. **PII-free.**

**Acceptance:** report exists, is PII-free, and reconciles with `TEST-RESULTS.md` and the git log.
**Commit:** `docs(audit): consolidated C-File test & audit report`

### Sprint 8 — Write & save the IMPROVEMENT PLAN (second deliverable) + final preflight
**Goal:** a forward-looking, executable plan for everything not fixed — bug fixes, feature enhancements, best practices, and overlooked items — ranked by veteran impact.

**Deliverable:** `audit/2026-06-cfile/IMPROVEMENT-PLAN.md`, organized by theme (correctness/math · ingestion · privacy/security · domain accuracy · a11y · tech-debt · UX/feature), each item with **severity, veteran-impact rationale, affected files, and a proposed implementation sprint**. Lead with the highest-leverage items the recon surfaced and the session could not safely fix in one pass:
- **Compensation completeness:** TDIU (38 CFR 4.16 — Johnson at 80% w/ PTSD is a textbook candidate), SMC (K–T), CRSC/CRDP — currently uncalculated; even a "not yet supported" banner prevents under-claiming thousands.
- **Explainability** for AI risk/lane/quality predictions (audit trail of top factors).
- **Automated eCFR sync** for `disabilityData.json` + verified DOIs for `secondary_conditions_db.json` citations.
- **Legal RAG expansion** to Parts 3/19/20 + M21-1 + CAVC/Fed-Circuit case law.
- **Packet import merge/delta** (currently full-overwrite, no migration) + IndexedDB quota/eviction.
- **AI offline fallback** for text tools when all local models fail and Gemini is opted out.
- **Tech-debt:** `App.jsx` region extraction (3,653 LOC / 66 useState), console.log → structured logger migration, ESLint-warning burndown.
- A **"Things we overlooked"** section and a **"Best practices to incorporate"** section (per the owner's CLAUDE.md: ADRs for the calculator reconciliation, test-first for new comp logic, Renovate cadence, WCAG 2.2 AA).

**Final step:** run `npm run preflight:full`; ensure green; `gitleaks` clean; confirm no PII in the diff; commit the deliverables. **Do not push or open a PR** — report completion and let the user review/push.

**Acceptance:** `IMPROVEMENT-PLAN.md` saved and complete; `preflight:full` green; all deliverables committed locally; no PII in git.
**Commit:** `docs(audit): C-File improvement plan + final preflight`

---

## Verification (how to confirm the whole run succeeded)
- `audit/2026-06-cfile/` contains `TEST-RESULTS.md`, `AUDIT-REPORT.md`, `IMPROVEMENT-PLAN.md`, all PII-free.
- A committed test asserts the app computes **80%** for Johnson's condition set; `tests/e2e/tactical-calculator.spec.ts` passes.
- Chromium Playwright e2e is **green**; `npm run preflight:full` is green; `gitleaks` is clean.
- `git log` on `audit/cfile-fullsweep` shows one checkpoint commit per completed sprint; nothing pushed.
- The 48-tool matrix in `AUDIT-REPORT.md` shows a status for every tool, with the FIXED-vs-OPEN split reconciled against the commits.

## Explicitly deferred (document, do not rush)
TDIU/SMC/CRSC-CRDP compensation engines, AI-output-quality scoring automation, full eCFR auto-sync infra, legal-RAG corpus expansion, and `App.jsx` decomposition are **plan items**, not in-session fixes — they exceed a safe one-session change budget and belong in `IMPROVEMENT-PLAN.md` with proposed sprints.

## Session-budget note
This is intentionally front-loaded: Sprints 0–2 and 4 carry the critical correctness/blocker/privacy value. If the one-session budget is exhausted before Sprint 8, every completed sprint has already left a committed, durable artifact, and the remaining sprints carry over cleanly because each is self-contained.
