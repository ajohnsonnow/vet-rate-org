import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * The "a new version is ready" notice, driven by the same CustomEvent
 * main.jsx dispatches when a new service worker is waiting. The dev server
 * never registers a service worker, so the event is dispatched by hand.
 */
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const TEXT = "A new version is ready. Reload to update.";
const QUICK_EXIT =
  'button[aria-label="Quick exit - immediately leave this page"]';

async function openApp(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
  await page.addInitScript((version) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", version);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function announceUpdate(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __accepted: number }).__accepted = 0;
    window.dispatchEvent(
      new CustomEvent("sw-update-available", {
        detail: {
          accept: () => {
            (window as unknown as { __accepted: number }).__accepted += 1;
          },
        },
      }),
    );
  });
}

test("the notice fits at 390px, clears Quick Exit and does not reload by itself", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.evaluate(() => {
    (window as unknown as { __alive: boolean }).__alive = true;
  });
  await announceUpdate(page);

  const notice = page.getByRole("status").filter({ hasText: TEXT });
  await expect(notice).toBeVisible();

  const box = (await notice.locator("> div").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  const exit = (await page.locator(QUICK_EXIT).boundingBox())!;
  const overlap =
    box.x < exit.x + exit.width &&
    exit.x < box.x + box.width &&
    box.y < exit.y + exit.height &&
    exit.y < box.y + box.height;
  expect(overlap).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const reload = notice.getByRole("button", { name: "Reload" });
  const dismiss = notice.getByRole("button", { name: "Dismiss update notice" });
  for (const button of [reload, dismiss]) {
    const b = (await button.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }

  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => (window as any).__alive)).toBe(true);
  expect(await page.evaluate(() => (window as any).__accepted)).toBe(0);

  await dismiss.click();
  await expect(notice).toHaveCount(0);
});

test("Reload asks the waiting worker to take over, once, on click only", async ({
  page,
}) => {
  await openApp(page);
  await announceUpdate(page);
  await page.getByRole("button", { name: "Reload" }).click();
  expect(await page.evaluate(() => (window as any).__accepted)).toBe(1);
});

test("triple Escape still leaves while the notice is showing", async ({
  page,
}) => {
  await openApp(page);
  await announceUpdate(page);
  await expect(page.getByText(TEXT)).toBeVisible();
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Escape");
  await page.waitForURL(/weather\.com/, { timeout: 5000 });
});

test("the notice waits while a tool dialog is open", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openSymptomLogger")),
  );
  await page.locator("#symptom-logger-title").waitFor({ timeout: 15000 });
  await announceUpdate(page);
  await page.waitForTimeout(2000);
  await expect(page.getByText(TEXT)).toHaveCount(0);
});
