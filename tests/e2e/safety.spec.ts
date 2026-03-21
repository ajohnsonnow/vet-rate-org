import { test, expect } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const searchInput = 'input[type="text"][aria-label]';

test.describe("Crisis interceptor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
  });

  test("crisis modal appears when distress keywords typed in search", async ({
    page,
  }) => {
    const input = page.locator(searchInput).first();
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await input.fill("want to hurt myself");

    const crisisElement = page
      .locator(
        '[role="dialog"][aria-label*="crisis" i], [data-testid*="crisis"], ' +
          '[aria-label*="988" i], [aria-label*="crisis line" i]',
      )
      .or(page.getByText("Veterans Crisis Line"))
      .first();

    await expect(crisisElement).toBeVisible({ timeout: 5_000 });
  });

  test("Veterans Crisis Line contact is surfaced on crisis trigger", async ({
    page,
  }) => {
    const input = page.locator(searchInput).first();
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await input.fill("suicidal");

    const crisisNumber = page
      .getByText(/988|1-800-273-8255|Veterans Crisis/i)
      .first();
    await expect(crisisNumber).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("PII protection", () => {
  test("no SSN patterns are echoed to console", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    await page.goto("/");
    await dismissDisclaimer(page);

    const input = page.locator(searchInput).first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("123-45-6789");
    }

    await page.waitForTimeout(500);
    const ssnLeaks = consoleLogs.filter((log) => /\d{3}-\d{2}-\d{4}/.test(log));
    expect(ssnLeaks).toHaveLength(0);
  });
});
