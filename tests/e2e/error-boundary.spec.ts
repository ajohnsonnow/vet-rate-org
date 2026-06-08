import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

// Current release, read from package.json (Playwright's cwd is the repo root).
// Marking it already-seen keeps the What's New modal (useUpdateOrchestrator)
// from popping over the fallback and intercepting its button clicks.
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * ErrorBoundary recovery gate (audit cycle S9–S17, S11). Proves the real
 * running app — not just a unit-mocked tree — degrades gracefully when a
 * subtree crashes: the cluster shows an inline fallback instead of a blank
 * page, the rest of the shell stays interactive, a one-tap report lands in the
 * bug-report IndexedDB, and "Try again" re-mounts the recovered cluster.
 *
 * The crash is injected by `src/debug/CrashCanary.jsx` (mounted only under
 * `import.meta.env.DEV`, which the Playwright dev server sets), which throws
 * during render when the `vetrate:e2e-crash` window event fires. It lives
 * inside Home's per-cluster boundary, so the catch is scoped to Home while the
 * App-level shell (header, footer, floating actions, modals) keeps running.
 *
 * Pinned to the 360px small-Android baseline — the worst-case mobile width the
 * fallback must stay usable at (docs/SPRINT_PLAN_S9-S17.md, S11 DoD).
 */

const VIEWPORT = { width: 360, height: 740 };

/** Horizontal overflow of the document, in px (<= 1 is clean). */
async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return Math.round(el.scrollWidth - el.clientWidth);
  });
}

/**
 * Fire the crash event until Home's boundary swaps in its fallback. CrashCanary
 * attaches its listener on mount; re-firing covers the (tiny) window before the
 * listener is live and is idempotent (it only sets the persistent crash flag).
 * Once set, the fallback survives the dev server's StrictMode/Fast-Refresh
 * auto-recovery remounts (CrashCanary re-reads the flag and re-throws), so the
 * tests below can interact with a stable fallback instead of racing recovery.
 */
async function crashHome(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("vetrate:e2e-crash")),
        );
        return page
          .locator('[data-testid="error-boundary-fallback"]')
          .isVisible();
      },
      { timeout: 6000 },
    )
    .toBe(true);
}

/** Every Home-module crash report currently in the bug-report IndexedDB. */
async function readHomeReports(page: Page): Promise<
  Array<{
    report_id: string;
    module: string;
    severity: string;
    error_message: string;
  }>
> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("VetRateBugSquasher");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db
            .transaction("BugReports", "readonly")
            .objectStore("BugReports")
            .getAll();
          all.onsuccess = () =>
            resolve(all.result.filter((r) => r.module === "Home"));
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

test.describe(`ErrorBoundary @ ${VIEWPORT.width}px (small-android)`, () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    // Returning-user fixture (mirrors mobile.spec.ts): clear every first-run
    // overlay so the only thing on screen is Home, then the injected crash.
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
    }, APP_VERSION);
    await page.goto("/");
    await dismissDisclaimer(page);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("a cluster crash shows the inline fallback, not a blank page", async ({
    page,
  }) => {
    await crashHome(page);

    const fallback = page.locator('[data-testid="error-boundary-fallback"]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText("Home hit a snag");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Report this problem" }),
    ).toBeVisible();

    // The crashed subtree is gone, but the fallback itself must not overflow.
    await expect(page.locator("#main-content")).toHaveCount(0);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("the rest of the app stays interactive after a cluster crash", async ({
    page,
  }) => {
    await crashHome(page);

    // App-level siblings of the crashed Home boundary survive untouched.
    await expect(
      page.getByRole("button", { name: "Report a bug (Ctrl+Shift+B)" }),
    ).toBeVisible();

    // And event-driven siblings still respond: opening a modal proves the
    // AppModals subtree is alive while Home is down.
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.dispatchEvent(new CustomEvent("openPrivacyPolicy")),
          );
          return page.locator('[role="dialog"]').first().isVisible();
        },
        { timeout: 6000 },
      )
      .toBe(true);
  });

  test("one-tap report persists a sanitized crash report to IndexedDB", async ({
    page,
  }) => {
    await crashHome(page);

    const reportBtn = page.getByRole("button", {
      name: "Report this problem",
    });
    await reportBtn.click();
    await expect(
      page.getByRole("button", { name: "Reported ✓" }),
    ).toBeVisible();

    const reports = await readHomeReports(page);
    expect(reports.length).toBeGreaterThanOrEqual(1);
    const report = reports[0];
    expect(report.report_id).toMatch(/^BUG-/);
    expect(report.severity).toBe("critical");
    expect(report.error_message).toContain("canary");
  });

  test("Try again re-mounts the recovered cluster", async ({ page }) => {
    await crashHome(page);
    await expect(
      page.locator('[data-testid="error-boundary-fallback"]'),
    ).toBeVisible();

    // Clear the underlying fault before recovering. CrashCanary is unmounted
    // while the fallback shows (so a heal *event* would have no listener) — the
    // flag it re-reads on remount must be cleared directly, mirroring a real
    // fix landing before the user retries.
    await page.evaluate(() => {
      (
        window as unknown as { __VETRATE_E2E_CRASH__?: boolean }
      ).__VETRATE_E2E_CRASH__ = false;
    });
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(
      page.locator('[data-testid="error-boundary-fallback"]'),
    ).toHaveCount(0);
    await expect(page.locator("#main-content")).toBeVisible();
  });
});
