import { readFileSync } from "node:fs";
import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Vision Simulator (D): a reviewer reported this dialog "consistently
 * failing" in the tool-grid sweep, hidden by Playwright's own `retries: 2`
 * (playwright.config.ts). Root-caused via a `--retries=0` investigation
 * (isolated, under 6-worker load, and with console/DOM tracing) - verdict:
 * TEST BUG. There is no defect in VisionSimulator.jsx / VisionSimulatorPanel
 * .jsx / visionSimulator.js.
 *
 * Confirmed real cause: `useBootSequence` (src/features/boot/useBootSequence
 * .js) starts `isMigrating` at `false`, so App.jsx renders the live app tree
 * (AppModals, Quick Exit, everything) immediately on first paint. Only
 * *after* an async `needsMigration()` check resolves does it flip to `true`,
 * at which point App.jsx swaps to `<MigrationScreen />` ("replaces the
 * entire app tree... siblings intentionally do not mount") - unmounting
 * whatever a user (or test) just opened, mid-session - then flips back to
 * `false` once migration finishes, remounting everything fresh
 * (VisionSimulator's `open` state reset to `false`).
 *
 * This is a real hazard for a real user too: `needsMigration()` (src/utils
 * /storage.js) returns true whenever pre-IndexedDB localStorage keys are
 * still present, which is every *returning* user who hasn't gone through
 * the migration yet - not, as an earlier draft of this comment claimed,
 * "first-visit-only" (a genuinely first-ever visit has no legacy keys and
 * never swaps). It also isn't Vision-Simulator-specific in mechanism -
 * every dialog mounted through AppModals loses the same race - but Vision
 * Simulator is the one that visibly reproduces it: its `openVisionSimulator`
 * listener is registered eagerly (mounted directly, not behind a lazy
 * cluster), so it's reliably attached and open by the time the swap hits,
 * where several other tools' lazy-cluster listeners aren't even attached
 * yet and just silently drop the dispatch. `useBootSequence.js` / `App.jsx`
 * are outside this task's file ownership, so `openIssues` flags the
 * product-side question (should the app protect an already-open dialog
 * from the post-render migration swap?) for a product decision.
 *
 * The fix that belongs here is test-side, and it is NOT retrying the whole
 * open-verify-close sequence on any failure: that hides a real regression
 * in Close exactly as well as it hides this migration race (verified: with
 * VisionSimulator.jsx's onClose changed to ignore every other click, the
 * old retry-loop version of this spec still passed 9/9 under
 * --retries=0 --repeat-each=3, at 8-17s per test - the loop was absorbing
 * the failure). Instead, this waits for the migration boot gate to settle
 * - via the same console signal useBootSequence.js already logs, plus
 * confirming MigrationScreen's own text is gone - before ever dispatching
 * the open event, then does one single, ordinary open/verify/close. A
 * condition-based wait for that signal, with no retry loop at all, passed
 * 15/15 in an isolated diagnostic; a single attempt with no wait at all
 * failed 15/15.
 *
 * This tool had no regression coverage before this file (no unit test, no
 * dedicated e2e spec - only mobile.spec.ts's generic, already-robust
 * tool-grid checks, which is why the wider suite never reproduced a
 * failure).
 */

const MIGRATION_SETTLED_RE =
  /IndexedDB Migration: (Successfully migrated|Already complete)/;

/**
 * Waits for useBootSequence's one-time IndexedDB-migration boot gate
 * (src/features/boot/useBootSequence.js, MigrationScreen.jsx) to finish, so
 * the dialog interaction below can't be unmounted out from under it by the
 * post-render tree swap. The console listener is attached before
 * navigation so a fast "Already complete" log can't fire and be missed
 * before this function gets a chance to listen.
 */
async function bootReturningUser(page: Page): Promise<void> {
  let settled = false;
  const onConsole = (msg: ConsoleMessage) => {
    if (MIGRATION_SETTLED_RE.test(msg.text())) settled = true;
  };
  page.on("console", onConsole);

  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);

  await expect.poll(() => settled, { timeout: 20_000 }).toBe(true);
  await expect(
    page.getByText("Upgrading your data storage. This only happens once."),
  ).toHaveCount(0);
  page.off("console", onConsole);
}

async function dispatchOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("openVisionSimulator"));
  });
}

/**
 * Opens Vision Simulator, confirms its title, clicks Close, and confirms it
 * hides - a single, ordinary attempt. Boot has already settled by the time
 * this runs (see bootReturningUser above), and VisionSimulator's listener
 * is mounted eagerly, so there is no remaining race here to retry around: a
 * real failure (a dropped open, a Close button that only works sometimes)
 * should fail this test, not disappear into a hidden retry.
 */
async function verifyVisionSimulatorOpensAndCloses(page: Page): Promise<void> {
  await dispatchOpen(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog
    .getByRole("heading", { name: "Document Vision Simulator" })
    .waitFor({ state: "visible", timeout: 10_000 });
  const closeButton = dialog.getByRole("button", { name: "Close dialog" });
  await closeButton.click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
}

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "short-desktop", width: 1024, height: 768 },
  { name: "wide-desktop", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Vision Simulator @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await bootReturningUser(page);
    });

    test("opens on the openVisionSimulator event, shows its title, and closes cleanly", async ({
      page,
    }) => {
      test.setTimeout(35000);
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await verifyVisionSimulatorOpensAndCloses(page);

      expect(pageErrors).toEqual([]);
    });
  });
}
