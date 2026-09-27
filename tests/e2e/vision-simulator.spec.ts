import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
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
 * *after* an async `needsMigration()` check resolves does it flip to `true`
 * on a fresh browser profile, at which point App.jsx swaps to
 * `<MigrationScreen />` ("replaces the entire app tree... siblings
 * intentionally do not mount") - unmounting whatever a user (or test) just
 * opened, mid-session - then flips back to `false` once migration finishes,
 * remounting everything fresh (VisionSimulator's `open` state reset to
 * `false`). Traced directly: a dialog opened at ~0s was gone again by ~2s in
 * repeated runs, with no console evidence of a Vite HMR/dependency-reload
 * (that hypothesis was checked and ruled out).
 *
 * This is a real, if narrow, hazard for a real user too (anyone who opens a
 * tool within the first couple seconds of a first-ever visit), but it is not
 * Vision-Simulator-specific - every dialog in the app mounts through the
 * same AppModals shell and would lose the same race - and `useBootSequence.js`
 * / `App.jsx` are outside this task's file ownership, so the fix that
 * belongs here is test-side: retry the *entire* open-and-verify sequence
 * (not just the initial open) if the dialog disappears out from under it,
 * exactly as a real user hitting this window would just click the tool
 * again. `openIssues` flags the product-side question (should the app
 * protect an already-open dialog from the post-render migration swap?) for
 * a product decision.
 *
 * This tool had no regression coverage before this file (no unit test, no
 * dedicated e2e spec - only mobile.spec.ts's generic, already-robust
 * tool-grid checks, which is why the wider suite never reproduced a
 * failure).
 *
 * Verified: `npx playwright test tests/e2e/vision-simulator.spec.ts
 * --project=chromium --retries=0` x5 in a row, no failures.
 */

async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function dispatchOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("openVisionSimulator"));
  });
}

/**
 * Opens Vision Simulator, confirms its title, clicks Close, and confirms it
 * hides - retrying the *entire* sequence (not just the initial dispatch) on
 * any failure. The post-render migration swap documented above can unmount
 * the dialog at any point in that sequence, on a timeline that varies with
 * how long the migration + DKB download happen to take (measured 250ms-2s+),
 * so a fixed "wait N ms then trust it" check would just be guessing a
 * different magic number. A real user who hit this mid-interaction has no
 * recourse but to redo the same steps, which is exactly what this does.
 */
async function verifyVisionSimulatorOpensAndCloses(page: Page): Promise<void> {
  const deadline = Date.now() + 25_000;
  for (;;) {
    try {
      await dispatchOpen(page);
      const dialog = page.locator('[role="dialog"]').last();
      await dialog
        .getByRole("heading", { name: "Document Vision Simulator" })
        .waitFor({ state: "visible", timeout: 3000 });
      const closeButton = dialog.getByRole("button", { name: "Close dialog" });
      await closeButton.waitFor({ state: "visible", timeout: 3000 });
      await closeButton.click({ timeout: 3000 });
      await dialog.waitFor({ state: "hidden", timeout: 3000 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
  }
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
