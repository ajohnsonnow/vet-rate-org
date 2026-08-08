import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Duty stations + world map spec §8 / acceptance criterion 6: the rendered
 * SVG's aspect ratio must match its viewBox aspect ratio within 1% at
 * 390px, ~1280px, and 3840px, with zero horizontal page scroll. Unit tests
 * (dutyStationMapProjection/Offline) cover the projection math and marker
 * logic in jsdom, which does not compute real layout — only a real browser
 * can verify the rendered box actually preserves the viewBox aspect ratio
 * at each width, which is what this spec exists to check.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "4k", width: 3840, height: 2160 },
];

async function openServiceTab(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("openMyPacket")),
        );
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });

  await dialog.locator('button:has-text("🎖️")').first().click();
}

test.describe("Duty station world map — aspect ratio + no horizontal scroll", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    }, APP_VERSION);

    // Default desktop size for the initial navigation click — the Service
    // tab's label text is CSS-hidden below the sm breakpoint (only the
    // 🎖️ emoji + count badge stay visible), so open/navigate once here,
    // then resize per-viewport below rather than re-navigating at 390px.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await dismissDisclaimer(page);
    await openServiceTab(page);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}px): SVG aspect ratio matches viewBox within 1%, no horizontal scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const svg = page.locator('svg[role="img"]').first();
      await expect(svg).toBeVisible({ timeout: 15_000 });

      const { renderedRatio, viewBoxRatio, overflow } = await svg.evaluate(
        (el: SVGSVGElement) => {
          const box = el.getBoundingClientRect();
          const vb = el.viewBox.baseVal;
          return {
            renderedRatio: box.width / box.height,
            viewBoxRatio: vb.width / vb.height,
            overflow:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          };
        },
      );

      const deviation =
        Math.abs(renderedRatio - viewBoxRatio) / viewBoxRatio;
      expect(deviation).toBeLessThanOrEqual(0.01);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
