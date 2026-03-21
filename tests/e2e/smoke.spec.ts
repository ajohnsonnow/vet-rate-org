import { test, expect } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

test.describe("App bootstrap", () => {
  test("loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await dismissDisclaimer(page);

    const fatalErrors = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection"),
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test("page has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/); // any non-empty title
  });

  test("renders a main landmark", async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("renders a heading", async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
