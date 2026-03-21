import { Page } from "@playwright/test";

/**
 * Dismiss the DisclaimerSplash modal if it appears.
 *
 * The splash renders on first visit and has a single acknowledge button
 * with translated text (key: 'enterVetRate'). We use the dialog role
 * as the anchor to find and click whatever button is inside it.
 */
export async function dismissDisclaimer(page: Page): Promise<void> {
  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="splash-title"]',
  );
  const isVisible = await dialog
    .isVisible({ timeout: 4000 })
    .catch(() => false);
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
