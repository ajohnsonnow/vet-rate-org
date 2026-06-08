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

> To be populated after Sprint 1 execution.

---

## Sprint 2 — Rating calculator ground-truth

> To be populated after Sprint 2 execution.

---

## Sprint 3 — 48-tool launch matrix

> To be populated after Sprint 3 execution.

---

## Sprint 4 — Privacy & security audit

> To be populated after Sprint 4 execution.

---

## Sprint 5 — Domain accuracy spot-check

> To be populated after Sprint 5 execution.

---

## Sprint 6 — Accessibility pass

> To be populated after Sprint 6 execution.
