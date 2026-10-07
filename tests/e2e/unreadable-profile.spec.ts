import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * D24-1: a saved profile that cannot be read froze the tab (the console
 * capture and the profile reader fed each other: 786,391 identical errors in
 * 20 minutes, same after reload). With a corrupted saved profile the app must
 * still answer at once, tell the veteran plainly, keep the profile as it is,
 * hold a bounded console, and Quick Exit and triple-Escape must work in their
 * normal time.
 */
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const PROFILE_KEY = "vet_rate_veteran_profile";
const CORRUPT_PROFILE = "{this-is-not-json";
const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';
const ANSWER_BUDGET_MS = 2000;
const MAX_CONSOLE_LINES = 200;

async function loadWithCorruptProfile(page: Page): Promise<string[]> {
  const lines: string[] = [];
  page.on("console", (message) => lines.push(message.text()));
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
  await page.addInitScript(
    ({ version, key, value }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      if (localStorage.getItem("e2e-profile-seeded") === null) {
        localStorage.setItem(key, value);
        localStorage.setItem("e2e-profile-seeded", "1");
      }
    },
    { version: APP_VERSION, key: PROFILE_KEY, value: CORRUPT_PROFILE },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
  return lines;
}

async function mainThreadRoundTripMs(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return performance.now() - start;
  });
}

test("a corrupted saved profile: the app answers, says so plainly, and keeps the profile", async ({
  page,
}) => {
  const lines = await loadWithCorruptProfile(page);

  const notice = page.getByTestId("unreadable-profile-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("could not be read");
  await expect(notice).toContainText("untouched");
  await expect(
    notice.getByRole("button", { name: "Restore a backup" }),
  ).toBeVisible();
  await expect(
    notice.getByRole("button", { name: "Start a new profile" }),
  ).toBeVisible();

  expect(await mainThreadRoundTripMs(page)).toBeLessThan(ANSWER_BUDGET_MS);

  const before = lines.length;
  await page.waitForTimeout(1500);
  expect(lines.length - before).toBeLessThan(50);
  expect(lines.length).toBeLessThan(MAX_CONSOLE_LINES);

  const stored = await page.evaluate((key) => {
    const logs = JSON.parse(
      sessionStorage.getItem("vet_rate_console_logs") || "[]",
    );
    return { profile: localStorage.getItem(key), entries: logs.length };
  }, PROFILE_KEY);
  expect(stored.profile).toBe(CORRUPT_PROFILE);
  expect(stored.entries).toBeLessThanOrEqual(50);
});

test("Quick Exit redirects from the unreadable-profile state within its normal time", async ({
  page,
}) => {
  await loadWithCorruptProfile(page);
  await expect(page.getByTestId("unreadable-profile-notice")).toBeVisible();

  const quickExit = page.locator(QUICK_EXIT_SELECTOR);
  await expect(quickExit).toBeVisible();
  const covered = await quickExit.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return !(hit === el || el.contains(hit));
  });
  expect(covered).toBe(false);

  await quickExit.click();

  await page.waitForURL(/weather\.com/, { timeout: ANSWER_BUDGET_MS });
});

test("triple Escape redirects from the unreadable-profile state within its normal time", async ({
  page,
}) => {
  await loadWithCorruptProfile(page);
  await expect(page.getByTestId("unreadable-profile-notice")).toBeVisible();

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.waitForURL(/weather\.com/, { timeout: ANSWER_BUDGET_MS });
});

test("starting a new profile is the veteran's confirmed choice and keeps a copy", async ({
  page,
}) => {
  await loadWithCorruptProfile(page);
  const notice = page.getByTestId("unreadable-profile-notice");
  await expect(notice).toBeVisible();

  await notice.getByRole("button", { name: "Start a new profile" }).click();
  await expect(notice).toContainText("a copy");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROFILE_KEY),
  ).toBe(CORRUPT_PROFILE);

  await notice
    .getByRole("button", { name: "Yes, start a new profile" })
    .click();
  await expect(notice).toBeHidden();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("vet_rate_veteran_profile_unreadable_copy"),
    ),
  ).toBe(CORRUPT_PROFILE);
});
