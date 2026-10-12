import { test, expect, Page } from "@playwright/test";

/**
 * With site storage blocked, merely reading window.localStorage throws a
 * SecurityError. The app used to render a blank page; it must now explain
 * itself, and Quick Exit and triple-Escape must still leave.
 */
async function blockStorage(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    }
  });
  return errors;
}

test("blocked storage shows a plain explanation, not a blank page", async ({
  page,
}) => {
  const errors = await blockStorage(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "This browser is blocking storage" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This app stores your information only on this device, and this browser is blocking storage",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Quick Exit still leaves with storage blocked", async ({ page }) => {
  await blockStorage(page);
  await page.goto("/");
  await page
    .locator('button[aria-label="Quick exit - immediately leave this page"]')
    .click();
  await page.waitForURL(/weather\.com/, { timeout: 5000 });
});

test("triple Escape still leaves with storage blocked", async ({ page }) => {
  await blockStorage(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Escape");
  await page.waitForURL(/weather\.com/, { timeout: 5000 });
});

test("the message fits at 390px without sideways scrolling", async ({
  page,
}) => {
  await blockStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
