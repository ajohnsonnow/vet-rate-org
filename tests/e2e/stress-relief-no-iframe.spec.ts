import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";
import { TOOLS } from "./tool-launch-matrix.data";

/**
 * StressReliefDivision's DOOM easter egg used to embed
 * https://archive.org/embed/msdos_DOOM_1993 in a same-page `<iframe>`. While
 * that iframe held focus, every keydown went to archive.org's own document -
 * cross-origin, so safetyRedirect.js's window-level listeners never saw it at
 * all (no event bubbling across a frame boundary) - and triple-Escape could
 * not fire. The standing rule is that the panic key must never be blockable,
 * so the embed is now a link that opens in a new tab instead: the game still
 * has focus outside the app's own document, and this document itself never
 * contains a third party at all.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DOOM_LINK_SELECTOR =
  'a[href="https://archive.org/embed/msdos_DOOM_1993"]';

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
}

async function openDoomEasterEgg(page: Page): Promise<void> {
  await page.keyboard.type("iddqd");
  await page
    .getByRole("dialog", { name: /Stress Relief Division/i })
    .waitFor({ state: "visible", timeout: 5000 });
}

async function crossOriginSurfaceCounts(
  page: Page,
): Promise<{ frameElements: number; childFrames: number }> {
  const frameElements = await page
    .locator("iframe, frame, embed, object")
    .count();
  // page.frames() always includes the main frame itself.
  const childFrames = Math.max(page.frames().length - 1, 0);
  return { frameElements, childFrames };
}

async function expectNoCrossOriginSurface(
  page: Page,
  context: string,
): Promise<void> {
  const { frameElements, childFrames } = await crossOriginSurfaceCounts(page);
  expect(frameElements, `frame/iframe/embed/object ${context}`).toBe(0);
  expect(childFrames, `child frames ${context}`).toBe(0);
}

test.describe("Stress Relief Division easter egg: no cross-origin iframe", () => {
  test("shows a new-tab link to the game, not an embedded iframe", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await openDoomEasterEgg(page);

    const link = page.locator(DOOM_LINK_SELECTOR);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    const rel = await link.getAttribute("rel");
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    await expect(link).toContainText(/opens in a new tab/i);
    // A clear label that it leaves the app, not just "opens in a new tab".
    await expect(page.getByText(/leaves Vet-Rate\.org/i)).toBeVisible();

    await expectNoCrossOriginSurface(page, "after opening the DOOM easter egg");
  });

  // The iframe this replaces was cross-origin: with it focused, a keydown
  // never reached this document's window listeners at all (no bubbling
  // across a frame boundary), so Escape could not close the dialog. The new
  // link is a normal same-document anchor - focusing it must not reproduce
  // that, proven by the dialog still closing on Escape with the link itself
  // focused (rather than, say, the body).
  test("Escape closes the easter egg even with the new-tab link focused", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await openDoomEasterEgg(page);

    await page.locator(DOOM_LINK_SELECTOR).focus();
    await page.keyboard.press("Escape");

    await page
      .getByRole("dialog", { name: /Stress Relief Division/i })
      .waitFor({ state: "hidden", timeout: 5000 });
  });

  // Regression guard, not proof of this fix: the DOOM easter egg's dialog
  // shows its new-tab link immediately on open (no extra click), so this
  // loop cannot reproduce the old base behaviour (an iframe that only
  // mounted after clicking "INITIATE RELIEF PROTOCOL"). Tests 1 and 2 above
  // are the ones that actually discriminate base from fixed for the DOOM
  // egg. What this test does prove, every run: none of the app's other 48
  // tool dialogs has silently grown a cross-origin frame since. A tool that
  // fails to open its dialog is reported (expect.soft) rather than swallowed
  // silently, so a broken launcher shows up here even though it isn't this
  // test's primary assertion.
  test("regression guard: no dialog anywhere gains a cross-origin frame", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await seedReturningUser(page);
    const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();

    for (const tool of TOOLS) {
      await page.evaluate(
        (eventName) => window.dispatchEvent(new CustomEvent(eventName)),
        tool.event,
      );
      const opened = await dialog
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      expect.soft(opened, `dialog opened for "${tool.name}"`).toBe(true);

      await expectNoCrossOriginSurface(page, `after opening "${tool.name}"`);

      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    }

    await openDoomEasterEgg(page);
    await expectNoCrossOriginSurface(page, "after opening the DOOM easter egg");
  });
});
