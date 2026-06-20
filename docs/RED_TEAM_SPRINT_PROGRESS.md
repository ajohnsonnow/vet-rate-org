# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 15)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status  | Notes                                                                                                                                                                                                         |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline + test infra   | ✅      | `e287c03` restored vitest.                                                                                                                                                                                    |
| RT-13                   | 🟡      | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                                                                                                                        |
| RT-15 calm restyle      | 🟡 / ⏭️ | Systemic done; long-tail ⏭️ owner visual review.                                                                                                                                                              |
| RT-1 egress honesty     | 🟡      | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                                                                                                                       |
| RT-2 evidence integrity | ✅      | AIS-01/02/03 + RT2-5.                                                                                                                                                                                         |
| RT-3 crisis/non-English | ✅      | AIS-04/05 + i18n test + RT3-4.                                                                                                                                                                                |
| RT-4 injection wiring   | ✅      | **PI-01 (`abcb766`) + PI-02 (`af23975`).**                                                                                                                                                                    |
| RT-5 XSS/CSP            | ✅      | `63eca37` sanitizeInlineHtml/DbqFinder/RT3-5 · `c8ba9f2` BadgeDisplay SVG scrub + UserManual escape · `9a96f46` CSP drop unsafe-eval (boot smoke test clean). RESIDUAL: manual WASM-model-load check (owner). |
| RT-6 crypto             | ✅ / 🚩 | **CRYPTO-04 (`0e7faff`) · PARSE-002 (`1555c0a`) · CRYPTO-03 (`50d460a`) · CRYPTO-02 weak-key warning done.** 🚩 owner: RT6-3 at-rest default + random-DEK envelope re-arch (needs-decision).                  |
| RT-7 parsing/rating     | 🟡      | **RT7-2 + RT7-3 + RT7-1 + RT7-5 done.** RT7-1: pdf.js onPassword prompt+retry on both primary paths + `describePdfPasswordError` specific copy across all 3 getDocument sites. RT7-5: `failedPages`/`pagesRead` in ripTextFromPdf return. RT7-4 (DOCX zip-bomb) pending. 🚩 UI surfacing of password prompt modal + "N of M pages" count = follow-up. |
| RT-8..RT-12             | ⏳      |                                                                                                                                                                                                               |
| RT-14 brand enrichment  | ⏳      | After RT-15 review.                                                                                                                                                                                           |

---

## Done (newest first)

- RT7-1/PARSE-001 + RT7-5/PARSE-006 — encrypted VA C-files: `attachPdfPasswordPrompt` (pdf.js onPassword → prompt+retry) on ripTextFromPdf + processLargePDF; pure `describePdfPasswordError` maps PasswordException → specific copy (`code: PDF_PASSWORD_REQUIRED`) at all 3 getDocument catch sites (pdfExtractor ×2, documentAnalyzer vision). ripTextFromPdf now returns `failedPages`/`pagesRead`. Test 10/10. Follow-up: surface the password modal + "N of M pages" in CFileAnalyzer UI.
- RT7-2/PARSE-004 — vaCalculator made the single source of truth for combined ratings. WhatIfSandbox (was Knee/Shoulder-only, round-additions, silently dropped conditions when both pairs present) + SecondaryScoutLauncher (was bespoke continuous non-table math, no bilateral) now combine via combineMultipleRatings/calculateBilateralFactor/roundToNearest10. New combinedRatingParity.test.js pins [50,30L,30R]→80 + legacy parity; 96/96 rating tests green. 🚩 follow-ups: WhatIfSandbox bilateral detection still Knee/Shoulder-name-only (not full side-aware); legacy flat ratingCalculator retained (≈30 pinned tests) — full retirement is needs-decision.
- RT7-3/PARSE-003 — shared pdf.js-free `isPdfFile` guard (src/utils/fileTypeGuards.js); CFileAnalyzer accepts octet-stream/empty-MIME .pdf, rejects 0-byte with `emptyPdfFile` copy (5 langs); test 7/7.
- `50d460a` RT-6/CRYPTO-03 — Dropbox + OneDrive OAuth state/CSRF (generateState, reject on mismatch).
- CRYPTO-02 — passphrase-less cloud write no longer silent: `isWeakWriteKey` + console.warn + `weakKey` in return surfaced in CloudSyncManager status; test 10/10. (Random-DEK envelope deferred 🚩.)
- `1555c0a` RT-6/PARSE-002 — drop false "encrypted/password-protected" framing on DBQ email zip (createEncryptedZip → createDocumentZip, removed password UI + PII-password tip).
- `0e7faff` RT-6/CRYPTO-04 — debug dump redacts veteran PII via non-PII allowlist.
- `9a96f46` RT-5 — CSP drop 'unsafe-eval' + correct wasm-unsafe-eval placement (preview smoke test: app renders, 0 violations).
- `c8ba9f2` RT-5 — BadgeDisplay SVG scrub (scrubSvg) + UserManual escape-first. sanitize 44/44.
- `63eca37` RT-5/RT3-5 — sanitizeInlineHtml + DbqFinder i18n sink + dompurify README (false-CSP-comment corrected).
- `af23975` PI-02 — spotlight untrusted doc text (cfileAnalyzer ×2, musterCall).
- `abcb766` PI-01 — wire stripUntrustedUrls into generateAI output + integration test (3/3).
- `83dbf7f` RT3-4 · `dcda6eb` i18n test · `623353c` AIS-05 · `ca4b118` AIS-04.
- `b0cbf8e` RT2-5 · `166d01f` AIS-03 · `5f803b2` AIS-02 · `195eaba` AIS-01.
- `c9e310d` RT1-6 · `2252992` RT1-1 · `7023029` RT1-2 · `e287c03` vitest · `6a88014`/`bd5ebed` RT-15 · `97d9675` RT13-6 · `005affc` WIP · `95a835f` plan.

## 🔒 Parallel actor — uncommitted (not mine): README.md, public/\*.html (privacy/terms), AGENTIC_VALUE_PROPOSITION.md, docs/LEGAL_PAGES_SYNC.md, stats. Commit only explicit paths (never `git add -A`); route around; if history diverges STOP, never force. (index.html is NOT theirs — RT-5 CSP edits OK; recheck git status before editing.)

## ⏭️ / 🚩 Deferred & needs-you

- ⏭️ RT-15 long-tail (owner visual review) · 🔒 RT1-5/RT1-3 (parallel edits).
- 🚩 RT1-1 key rotation · RT9 counsel · RT6-3 at-rest default · keep-BYOK · VA-OAuth classification · RT8-8 LH baseline.
- ⚠️ Pre-existing `cfileResilience.test.js` ×3 (not mine).
- 🚩 RT-5 WASM residual: after dropping CSP `unsafe-eval`, load a local AI model once in a real browser to confirm no dep needs eval()/new Function() at model-load (boot smoke test was clean; `wasm-unsafe-eval` is the standard token).

## Notes for next chunk — RT-6 (crypto)

- **CRYPTO-02** (`cloudSync.js:439-467`): passphrase-less cloud-sync writes derive the content key from the user's EMAIL. Refuse passphrase-less writes OR generate a random DEK stored via the wrapped keystore (mirror encryptForCloud's random-DEK path); at minimum surface a blocking warning. Read the encrypt path first; don't break V1/V2/V3 envelope decrypt (legacy backups must still restore).
- **PARSE-002** (`pdfDbqFiller.js:299-361`): `createEncryptedZip()` ships a PLAINTEXT zip while claiming password protection on medical DBQs. Implement real AES zip (zip.js w/ password) OR remove the misleading name/param + "SECURE" framing. Check callers before renaming.
- **CRYPTO-03** (`multiCloudStorage.js:143-255,417-528`): Dropbox/OneDrive OAuth omit `state`/CSRF. Generate per-flow state via `generateState()` from pkce.js, store in sessionStorage, append `&state=`, reject callback on mismatch (reuse the VA flow pattern).
- **CRYPTO-04** (`debugDump.js:23-32,75-95`): debug-dump easter egg exfiltrates plaintext PII to a download. Invert to an allowlist of non-sensitive diagnostic keys, or require an explicit "include my personal data" confirm.
- Verify with individual `npx vitest run`, not full suite. Crypto changes — be conservative; don't break existing encrypted backups.
