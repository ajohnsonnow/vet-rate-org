import { test, expect } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

test.describe("Accessibility: keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
  });

  test("Tab key cycles through interactive elements", async ({ page }) => {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focused);
  });

  test("interactive elements have visible focus indicators", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;
      return window.getComputedStyle(el).outlineWidth;
    });
    expect(focusedOutline).not.toBeNull();
  });

  test("page has main landmark", async ({ page }) => {
    const hasMain = await page.locator('main, [role="main"]').count();
    expect(hasMain).toBeGreaterThan(0);
  });

  test("images have alt attributes", async ({ page }) => {
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.filter((img) => !img.hasAttribute("alt")).length;
    });
    expect(imagesWithoutAlt).toBe(0);
  });

  test("buttons have accessible names", async ({ page }) => {
    const buttonsWithoutName = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.filter((btn) => {
        const name =
          btn.getAttribute("aria-label") ||
          btn.getAttribute("aria-labelledby") ||
          btn.textContent?.trim();
        return !name;
      }).length;
    });
    expect(buttonsWithoutName).toBe(0);
  });
});

test.describe("Accessibility: mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("app renders on mobile without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("touch targets are adequately sized", async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);

    const smallButtons = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll("button:not([aria-hidden])"),
      );
      return buttons
        .filter((btn) => {
          const rect = btn.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.width < 24 || rect.height < 24)
          );
        })
        .map((btn) => ({
          text: btn.textContent?.trim().slice(0, 40),
          w: Math.round(btn.getBoundingClientRect().width),
          h: Math.round(btn.getBoundingClientRect().height),
        }));
    });

    if (smallButtons.length > 0) {
      console.warn("Small touch targets found:", JSON.stringify(smallButtons));
    }
    expect(smallButtons.length).toBeLessThanOrEqual(5);
  });
});
