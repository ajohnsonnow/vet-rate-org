import { Page } from "@playwright/test";

/**
 * Dismiss the DisclaimerSplash modal if it appears.
 *
 * The splash renders on first visit and has a single acknowledge button
 * with translated text (key: 'enterVetRate'). We use the dialog role
 * as the anchor to find and click whatever button is inside it.
 *
 * The interactive tree (and the splash inside it) only mounts once
 * useBootSequence's boot gate resolves (src/features/boot/useBootSequence.js),
 * so this waits for boot to settle - via #main-content attaching, which is
 * part of the same gated tree - before deciding whether the splash is even
 * there to dismiss. `isVisible({ timeout })` does not wait (Playwright
 * ignores that option on isVisible), so checking it right after goto() used
 * to race the boot gate and silently no-op every time.
 */
export async function dismissDisclaimer(page: Page): Promise<void> {
  await page
    .locator("#main-content")
    .waitFor({ state: "attached", timeout: 15000 })
    .catch(() => {});

  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="splash-title"]',
  );
  const isVisible = await dialog.isVisible().catch(() => false);
  if (!isVisible) return;

  // On mobile viewports the dialog scrolls; use JS click to bypass pointer intercepts
  await page.evaluate(() => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-labelledby="splash-title"]',
    );
    if (!dialog) return;
    const buttons = dialog.querySelectorAll("button");
    const lastBtn = buttons[buttons.length - 1] as HTMLElement;
    lastBtn?.click();
  });

  // Wait for the dialog to disappear
  await dialog.waitFor({ state: "hidden", timeout: 8000 });
}
