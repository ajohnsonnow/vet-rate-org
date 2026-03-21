import { test, expect } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const searchInput = () => 'input[type="text"][aria-label]';

test.describe("Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
  });

  test("search input is present and focusable", async ({ page }) => {
    const input = page.locator(searchInput()).first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("searching for PTSD returns results", async ({ page }) => {
    const input = page.locator(searchInput()).first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("PTSD");

    // Results or suggestions should appear
    const results = page
      .locator('[role="listbox"] li, [role="option"], article, .result-card')
      .first();
    await expect(results).toBeVisible({ timeout: 5_000 });
  });

  test("searching for tinnitus returns results", async ({ page }) => {
    const input = page.locator(searchInput()).first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("tinnitus");

    const results = page
      .locator('[role="listbox"] li, [role="option"], article, .result-card')
      .first();
    await expect(results).toBeVisible({ timeout: 5_000 });
  });

  test("clearing search resets results", async ({ page }) => {
    const input = page.locator(searchInput()).first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("PTSD");
    await input.clear();
    await expect(input).toHaveValue("");
  });
});
