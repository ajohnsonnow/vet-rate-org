# Red-Team Sprint Execution — Progress Tracker

> Autonomous execution of [RED_TEAM_AUDIT_2026-06.md](./RED_TEAM_AUDIT_2026-06.md).
> Branch: `audit/fable-master-plan` · Commits **local only** (no push, no PRs).

**Last updated:** 2026-06-20 (chunk 13)
**Verification:** `npm run build` green. Verify tests with **individual** `npx vitest run <file>` (full `npm test` flakes under load). Baseline: 3 pre-existing `cfileResilience.test.js` fails; only NEW fails matter.

---

## Order & status

✅ done · 🟡 partial · ⏳ pending · 🚩 needs-you · 🔒 blocked-by-parallel-edits · ⏭️ deferred-for-review

| Sprint                  | Status  | Notes                                                                                                                                                                                                               |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline + test infra   | ✅      | `e287c03` restored vitest.                                                                                                                                                                                          |
| RT-13                   | 🟡      | RT13-6 ✅. (lint-staged omits `.jsx`.)                                                                                                                                                                              |
| RT-15 calm restyle      | 🟡 / ⏭️ | Systemic done; long-tail ⏭️ owner visual review.                                                                                                                                                                    |
| RT-1 egress honesty     | 🟡      | RT1-1/2/6 ✅. RT1-3/5 🔒 parallel edits. RT1-7 pending.                                                                                                                                                             |
| RT-2 evidence integrity | ✅      | AIS-01/02/03 + RT2-5.                                                                                                                                                                                               |
| RT-3 crisis/non-English | ✅      | AIS-04/05 + i18n test + RT3-4.                                                                                                                                                                                      |
| RT-4 injection wiring   | ✅      | **PI-01 (`abcb766`) + PI-02 (`af23975`).**                                                                                                                                                                          |
| RT-5 XSS/CSP            | 🟡      | `sanitizeInlineHtml` + DbqFinder/RT3-5 + dompurify README ✅ (`63eca37`). RecordSearch/pdfSearchEngine already safe. Remaining: CSP unsafe-eval (runtime preview), BadgeDisplay SVG scrub, UserManual escape check. |
| RT-6..RT-12             | ⏳      |                                                                                                                                                                                                                     |
| RT-14 brand enrichment  | ⏳      | After RT-15 review.                                                                                                                                                                                                 |

---

## Done (newest first)

- `63eca37` RT-5/RT3-5 — sanitizeInlineHtml + DbqFinder i18n sink + dompurify README (false-CSP-comment corrected). sanitize 41/41.
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

## Notes for next chunk — finish RT-5

- **CSP unsafe-eval (index.html:14)**: `wasm-unsafe-eval` is currently MISPLACED in `connect-src` (line 18, ineffective there) — so WASM relies on `unsafe-eval`. Correct fix: drop `'unsafe-eval'` from `script-src`, ADD `'wasm-unsafe-eval'` to `script-src`, and remove the stray `wasm-unsafe-eval` from `connect-src`. **Runtime-risky** (could break WASM/WebGPU AI or an eval-using dep) — verify with `npm run build` + `npm run preview` + a Playwright load that checks the console for CSP `unsafe-eval` violations and that the app shell renders; if violations appear, revert + flag. (Recheck `git status` — index.html must not be in the parallel set.)
- **BadgeDisplay.jsx:152 SVG sink**: renders raw `badge.svg`. Add a small SVG scrub (strip `<script>…</script>` + `\son\w+=` handlers + `javascript:` in xlink/href) before render; rewrite the false "CSP blocks" comment. (escapeHtml would break the SVG — don't use it here.)
- **UserManual.jsx:3867**: verify the manual text is escapeHtml'd before the bold/link replacements (read the function start ~3840); if it is, just fix the false-CSP comment; if not, escape-first. RecordSearch + pdfSearchEngine are already safe (no change).
- Then **RT-6** (crypto): CRYPTO-02 email-as-passphrase (cloudSync.js:439-467), PARSE-002 plaintext zip (pdfDbqFiller.js:299-361), CRYPTO-03 OAuth state param (multiCloudStorage.js), CRYPTO-04 debug-dump PII (debugDump.js).
- Verify with individual `npx vitest run`, not full suite.
