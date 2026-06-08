import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

// Current release, read from package.json (Playwright's cwd is the repo root).
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Dialog-contract + skip-link keyboard gate (audit cycle S9–S17, Sprint S12).
 *
 * Proves, end-to-end in a real browser, the WCAG dialog contract the
 * ResponsiveModal shell promises: focus is trapped inside an open modal, Escape
 * closes a *dismissable* one, focus returns to whatever opened it, and a
 * non-dismissable safety gate ignores Escape (SC 2.4.3 Focus Order, SC 2.1.2 No
 * Keyboard Trap). The underlying useFocusTrap hook is unit-tested
 * (src/hooks/useFocusTrap.test.jsx for the cycle/restore mechanics); this spec
 * is the integration proof that the wiring holds once mounted in the live app —
 * the S12 Definition of Done item "every modal trappable + ESC + restore
 * (Playwright)" (docs/SPRINT_PLAN_S9-S17.md). Also covers the skip link being
 * keyboard-reachable near the top of the tab order, visible on focus, and
 * jumping to #main-content (SC 2.4.1 Bypass Blocks).
 */

/** Representative dismissable ResponsiveModal surfaces, each event-mountable. */
const DISMISSABLE_SURFACES = [
  { label: "Community Roadmap", event: "openCommunityRoadmap" },
  { label: "Workflow Guide", event: "openWorkflowGuide" },
  { label: "Decision Decoder", event: "openDecisionDecoder" },
  { label: "VSO Finder", event: "openVSOFinder" },
];

async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  // Let the lazy home chunks finish and any late-mounting banner/toast settle
  // BEFORE the test focuses anything — otherwise a post-load re-render steals
  // focus from the opener and toBeFocused() flakes between cold-start runs.
  await page.waitForLoadState("networkidle");
  await page.locator("a.skip-link").waitFor({ state: "attached" });
}

/**
 * Dispatch a modal-open window event until a dialog appears, re-firing on every
 * poll tick (lazy clusters drop a single pre-listener dispatch; every open
 * handler is an idempotent setShow(true)). Then wait for the dialog, its first
 * interactive child, AND network idle so the React.lazy cluster chunk has fully
 * loaded — the lazy Suspense round-trip is what briefly remounts the shell and
 * re-captures the focus-trap restore target, so settling it here is what makes
 * the restore assertion deterministic rather than racing the remount.
 */
async function openModalByEvent(page: Page, event: string): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, event);
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });
  await dialog
    .locator("button, a, h1, h2, h3, input, [role='button']")
    .first()
    .waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");

  // The shell auto-focuses its first focusable on mount; wait for focus to
  // actually land inside the dialog before any trap/ESC assertion so we never
  // race the post-Suspense remount.
  await expect.poll(() => focusInDialog(page)).toBe(true);
}

/** True when the live focus sits inside the open dialog. */
const focusInDialog = (page: Page) =>
  page.evaluate(
    () =>
      !!document.activeElement &&
      !!document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
  );

/**
 * Non-dismissable safety gate: the first-visit DisclaimerSplash is
 * dismissable={false}, so Escape must NOT close it (only the acknowledge button
 * may). Top-level — booted WITHOUT the disclaimer-acknowledged key, so the
 * returning-user beforeEach below never suppresses it here.
 */
test("non-dismissable splash ignores Escape (safety gate)", async ({
  page,
}) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
  }, APP_VERSION);
  const splash = page.locator(
    '[role="dialog"][aria-labelledby="splash-title"]',
  );
  await page.goto("/");
  await splash.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  // Give any (incorrect) close a chance to fire before asserting it didn't.
  await page.waitForTimeout(300);
  await expect(splash).toBeVisible();
});

test.describe("S12 dialog contract: trap / ESC / restore", () => {
  test.beforeEach(async ({ page }) => {
    await bootReturningUser(page);
  });

  test("skip link is keyboard-reachable, visible on focus, jumps to main", async ({
    page,
  }) => {
    const skip = page.locator("a.skip-link");

    // Reachable near the top of the tab order. It is not the literal first
    // focusable (a header control precedes it), so Tab forward until it lands —
    // bounded tight so a regression that buries it deep still fails.
    let reached = false;
    for (let i = 0; i < 4 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await skip.evaluate((el) => el === document.activeElement);
    }
    await expect(skip).toBeFocused();

    // sr-only until focused; focus:not-sr-only must give it real dimensions.
    const box = await skip.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(1);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  for (const surface of DISMISSABLE_SURFACES) {
    test(`${surface.label}: traps focus, ESC closes, restores to opener`, async ({
      page,
    }) => {
      // The skip link is an always-present focusable — focus it as the concrete
      // "opener" so restore-on-close is verifiable against a known element.
      const opener = page.locator("a.skip-link");
      await opener.focus();
      await expect(opener).toBeFocused();

      await openModalByEvent(page, surface.event);

      // Tab must cycle WITHIN the dialog — never out to the page behind it.
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        expect(await focusInDialog(page)).toBe(true);
      }

      await page.keyboard.press("Escape");
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  }
});
