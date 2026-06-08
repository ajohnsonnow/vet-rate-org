import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function openTacticalCalculator(page: Page) {
  // Wait for the app shell to be stable (CalculateCluster useEffect must have run)
  await page.waitForLoadState("networkidle");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openTacticalCalculator")),
  );
  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="calculator-title"]',
  );
  await expect(dialog).toBeVisible({ timeout: 8000 });
  return dialog;
}

test.describe("TacticalCalculator — combined rating math", () => {
  test("modal opens without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await bootReturningUser(page);
    const dialog = await openTacticalCalculator(page);

    await expect(dialog).toBeVisible();
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("two conditions produce correct combined rating (VA § 4.25)", async ({
    page,
  }) => {
    await bootReturningUser(page);
    const dialog = await openTacticalCalculator(page);

    // Add Mental Health (PTSD) at 50%
    await dialog
      .getByLabel("Body Part / Condition Type")
      .selectOption("mental");
    await dialog.getByLabel("Rating %").selectOption("50");
    await dialog.getByRole("button", { name: /Add to Calculator/i }).click();

    // Add Back/Spine at 20%
    await dialog.getByLabel("Body Part / Condition Type").selectOption("back");
    await dialog.getByLabel("Rating %").selectOption("20");
    await dialog.getByRole("button", { name: /Add to Calculator/i }).click();

    // Combined: 50 + round(20 × 50 / 100) = 60 → rounds to 60% (nearest 10)
    const combinedSpan = dialog.locator("span.text-4xl");
    await expect(combinedSpan).toHaveText("60%", { timeout: 4000 });
  });

  test("Johnson PTSD 50% alone shows 50% combined", async ({ page }) => {
    await bootReturningUser(page);
    const dialog = await openTacticalCalculator(page);

    await dialog
      .getByLabel("Body Part / Condition Type")
      .selectOption("mental");
    await dialog.getByLabel("Rating %").selectOption("50");
    await dialog.getByRole("button", { name: /Add to Calculator/i }).click();

    const combinedSpan = dialog.locator("span.text-4xl");
    await expect(combinedSpan).toHaveText("50%", { timeout: 4000 });
  });
});
