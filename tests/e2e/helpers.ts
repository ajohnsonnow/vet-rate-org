import { Page } from "@playwright/test";

/**
 * Pre-acknowledge first-run modals (DisclaimerSplash + Terms-of-Service)
 * so they never render. Faster and more deterministic than clicking
 * through them in every test.
 *
 * Must be called BEFORE `page.goto`. Sets the same localStorage keys the
 * production modals check on mount.
 */
export async function preAcceptModals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem(
        "vet-rate-tos-accepted-date",
        new Date().toISOString(),
      );
    } catch {
      /* localStorage may not be available in some contexts */
    }
  });
}

/**
 * Dismiss the DisclaimerSplash modal if it appears.
 *
 * The splash renders on first visit and has a single acknowledge button
 * with translated text (key: 'enterVetRate'). We use the dialog role
 * as the anchor to find and click whatever button is inside it.
 *
 * Also dismisses the Terms-of-Service modal that gates downstream UI on
 * first run. Both modals can be skipped entirely by calling
 * `preAcceptModals(page)` BEFORE `page.goto`.
 */
export async function dismissDisclaimer(page: Page): Promise<void> {
  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="splash-title"]',
  );
  const isVisible = await dialog
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  if (isVisible) {
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
    await dialog.waitFor({ state: "hidden", timeout: 8000 });
  }

  // TOS modal is a separate gate that may appear after the disclaimer
  const tos = page.locator('[data-tos-modal="true"]').first();
  const tosVisible = await tos.isVisible({ timeout: 2000 }).catch(() => false);
  if (tosVisible) {
    // The Accept button is enabled only after a 3s countdown — wait it out,
    // then click via JS to bypass any layered modal interceptors.
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      const root = document.querySelector('[data-tos-modal="true"]');
      if (!root) return;
      // Strategy: look for an enabled <button> whose text indicates accept
      const buttons = Array.from(root.querySelectorAll("button"));
      const accept = buttons.find(
        (b) =>
          !(b as HTMLButtonElement).disabled &&
          /accept|agree|continue/i.test(b.textContent || ""),
      ) as HTMLButtonElement | undefined;
      accept?.click();
    });
    await tos.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {
      /* best effort */
    });
  }
}
