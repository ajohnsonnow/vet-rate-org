import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * The Tactical Calculator with several conditions must fit a 390px phone: no
 * horizontal scroll on the page or inside the dialog, every tab fully inside
 * the viewport, and no condition row showing above the sticky tab bar once
 * the dialog is scrolled. Also checked at 1280px and 3840px.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const CONDITIONS = [
  { bodyPart: "knee", side: "left", rating: "40" },
  { bodyPart: "knee", side: "right", rating: "20" },
  { bodyPart: "mental", side: null, rating: "50" },
  { bodyPart: "back", side: null, rating: "20" },
  { bodyPart: "ear", side: null, rating: "10" },
];

async function openCalculatorWithConditions(page: Page) {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openTacticalCalculator")),
  );
  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="calculator-title"]',
  );
  await expect(dialog).toBeVisible({ timeout: 8000 });

  for (const condition of CONDITIONS) {
    await dialog
      .getByLabel("Body Part / Condition Type")
      .selectOption(condition.bodyPart);
    if (condition.side) {
      await dialog
        .getByLabel("Side", { exact: true })
        .selectOption(condition.side);
    }
    await dialog.getByLabel("Rating %").selectOption(condition.rating);
    await dialog.getByRole("button", { name: /Add to Calculator/i }).click();
  }
  await expect(dialog.locator("span.text-4xl")).toHaveText("90%");
  return dialog;
}

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "4K", width: 3840, height: 2160 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`TacticalCalculator layout at ${viewport.width}px (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("no horizontal scroll on the page or inside the dialog", async ({
      page,
    }) => {
      const dialog = await openCalculatorWithConditions(page);

      const pageOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBeLessThanOrEqual(1);

      const dialogOverflow = await dialog.evaluate((node) =>
        Math.max(
          ...[node, ...node.querySelectorAll("*")]
            .filter((el) => getComputedStyle(el).overflowY === "auto")
            .map((el) => el.scrollWidth - el.clientWidth),
          0,
        ),
      );
      expect(dialogOverflow).toBeLessThanOrEqual(1);
    });

    test("every tab is fully inside the viewport", async ({ page }) => {
      const dialog = await openCalculatorWithConditions(page);
      const tabs = dialog.locator("nav button");
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i++) {
        const box = await tabs.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test("condition names keep a readable width and their buttons a 44px target", async ({
      page,
    }) => {
      const dialog = await openCalculatorWithConditions(page);
      const name = dialog.getByText("Knee (Left)", { exact: true }).first();
      const nameBox = await name.boundingBox();
      expect(nameBox).not.toBeNull();
      // A name squeezed to nothing wraps one letter per line.
      expect(nameBox!.width).toBeGreaterThanOrEqual(80);
      expect(nameBox!.height).toBeLessThanOrEqual(60);
      const rootFont = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      for (const label of ["Edit", "Remove"]) {
        const box = await dialog
          .getByRole("button", { name: label, exact: true })
          .first()
          .boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        // An icon button, not a 120px action button; rem-sized, so the
        // limit follows the root font size (which grows above 2560px).
        expect(box!.width).toBeLessThanOrEqual(3.75 * rootFont);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });

    test("on the Rates tab, the element that scrolls is the one a keyboard can focus", async ({
      page,
    }) => {
      const dialog = await openCalculatorWithConditions(page);
      await dialog.locator("nav button").filter({ hasText: /Rates/ }).click();
      const regions = dialog.locator('section[tabindex="0"]:has(table)');
      await expect(regions).toHaveCount(3);

      const measured = await regions.evaluateAll((sections) =>
        sections.map((section) => {
          const table = section.querySelector("table")!;
          return {
            name: section.getAttribute("aria-label"),
            regionOverflow: section.scrollWidth - section.clientWidth,
            tableOverflow: table.scrollWidth - table.clientWidth,
          };
        }),
      );
      for (const region of measured) {
        expect(region.name).toBeTruthy();
        // The table must never be the scroller: it cannot take focus.
        expect(region.tableOverflow).toBeLessThanOrEqual(1);
      }

      const scrolling = measured.findIndex((r) => r.regionOverflow > 1);
      if (viewport.width <= 390) expect(scrolling).toBeGreaterThanOrEqual(0);
      if (scrolling >= 0) {
        const region = regions.nth(scrolling);
        await region.focus();
        await expect(region).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => region.evaluate((el) => el.scrollLeft))
          .toBeGreaterThan(0);
      }
    });

    test("no condition row shows above the sticky tab bar after scrolling", async ({
      page,
    }) => {
      const dialog = await openCalculatorWithConditions(page);
      const nav = dialog.locator("nav").first();
      await dialog.evaluate((node) => {
        const scroller = [...node.querySelectorAll("*")].find(
          (el) =>
            getComputedStyle(el).overflowY === "auto" &&
            el.scrollHeight > el.clientHeight,
        );
        scroller?.scrollBy(0, 400);
      });
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();
      // Just above the first tab, and at the left edge beside the strip, the
      // topmost element must belong to the tab bar, not to scrolled content.
      const points = [
        { x: Math.max(2, navBox!.x - 6), y: navBox!.y + 4 },
        { x: navBox!.x + 10, y: navBox!.y - 4 },
      ];
      const coveredByBar = await page.evaluate(
        (probes) =>
          probes.every(({ x, y }) =>
            Boolean(
              document
                .elementFromPoint(x, y)
                ?.closest("[data-calculator-tab-bar]"),
            ),
          ),
        points,
      );
      expect(coveredByBar).toBe(true);
    });
  });
}
