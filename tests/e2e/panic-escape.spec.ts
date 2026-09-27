import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Coverage for safetyRedirect.js's triple-Escape panic key vs. an Escape
 * that closes a dialog. Root cause (verified live, not assumed): the guard
 * used to read "is a dialog open right now" from a *bubble*-phase listener
 * on window, by which point a closing dialog's own Escape handler (a React
 * state update) had already removed its `role="dialog"` node from the DOM -
 * so a dialog-closing Escape read as "nothing open" and got counted anyway.
 * Three of those in a row (exactly what a veteran does closing dialogs one
 * after another) fired the panic redirect. The fix moves the check to the
 * capture phase, which runs before the dialog's own handler does.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';
const TOOL_GRID_SELECTOR =
  '#main-content .mt-12.max-w-4xl.mx-auto button, footer[role="contentinfo"] button';
const MARKER_KEY = "panic-escape-test-marker";

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "still-here"),
    MARKER_KEY,
  );
}

/**
 * The real panic redirect navigates to https://www.weather.com. Faking the
 * response (rather than skipping the assertion) keeps the test hermetic and
 * fast while still proving a real cross-origin navigation occurred - the
 * browser's own navigation is exercised, only the network round-trip is
 * short-circuited.
 */
async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

async function stillOnApp(page: Page): Promise<boolean> {
  if (!/127\.0\.0\.1/.test(page.url())) return false;
  const marker = await page
    .evaluate((key) => sessionStorage.getItem(key), MARKER_KEY)
    .catch(() => null);
  return marker === "still-here";
}

async function openFirstDialog(page: Page): Promise<void> {
  await page.locator(TOOL_GRID_SELECTOR).first().click();
  await page
    .locator(DIALOG_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
}

async function closeDialogWithEscape(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page
    .locator(DIALOG_SELECTOR)
    .first()
    .waitFor({ state: "hidden", timeout: 5000 });
}

test.describe("Panic key (triple-Escape) vs. dialog-closing Escapes", () => {
  test("closing 4 dialogs in a row via Escape never trips the panic key", async ({
    page,
  }) => {
    await seedReturningUser(page);

    for (let i = 0; i < 4; i++) {
      await openFirstDialog(page);
      await closeDialogWithEscape(page);
    }

    expect(await stillOnApp(page)).toBe(true);
  });

  test("3 deliberate Escapes with nothing open trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  test("mixed: dialog-closing Escapes don't count toward 3 real ones", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    // Two dialog-closes shouldn't move the counter at all.
    await openFirstDialog(page);
    await closeDialogWithEscape(page);
    await openFirstDialog(page);
    await closeDialogWithEscape(page);
    expect(await stillOnApp(page)).toBe(true);

    // Now 3 real, deliberate Escapes with nothing open still fire.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });
});
