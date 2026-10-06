import { test, expect, Page } from "@playwright/test";
import {
  bootForSweep,
  describeFindings,
  recordFindings,
  sweep,
  sweepStates,
} from "./sweep";

/**
 * Large screens: the app shell has a bounded width that grows with the
 * screen instead of leaving a 1280px column in a 3840px void, dialogs grow
 * with it, and long-form text keeps a reading measure near 65 characters.
 */

const DIALOG = '[role="dialog"]';

async function shellWidths(page: Page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    main: Math.round(
      document.querySelector("#main-content")!.getBoundingClientRect().width,
    ),
    rootFont: Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    ),
  }));
}

async function openTool(page: Page, event: string) {
  await page.evaluate(
    (name) => window.dispatchEvent(new CustomEvent(name)),
    event,
  );
  const dialog = page.locator(DIALOG).first();
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  return dialog;
}

/** Widths of long paragraphs in the open dialog, in `ch` of their own font. */
async function longParagraphMeasures(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')!;
    return [...dialog.querySelectorAll("p, li")]
      .filter((el) => (el.textContent ?? "").trim().length > 220)
      .map((el) => {
        const probe = document.createElement("span");
        probe.style.cssText =
          "position:absolute;visibility:hidden;width:1ch;display:block";
        el.appendChild(probe);
        const ch = probe.getBoundingClientRect().width;
        probe.remove();
        return Math.round(el.getBoundingClientRect().width / ch);
      });
  });
}

/**
 * On whatever is open: text fields and selects whose type is smaller than the
 * page's body size, and long paragraphs wider than about 90 characters.
 */
async function typeAndMeasureProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems = new Set<string>();
    const dialogs = [
      ...document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [role="alertdialog"]',
      ),
    ].filter((el) => el.getBoundingClientRect().height > 1);
    const scope: Element = dialogs.at(-1) ?? document.body;
    const rootFont = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    const controls = scope.querySelectorAll<HTMLElement>(
      'input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="hidden"], [type="color"]), select, textarea',
    );
    for (const el of controls) {
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      if (size < rootFont - 0.5) {
        const name =
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.id ||
          el.tagName.toLowerCase();
        problems.add(
          `${el.tagName.toLowerCase()} "${name.slice(0, 30)}" text is ${size}px, body is ${rootFont}px`,
        );
      }
    }

    for (const el of scope.querySelectorAll<HTMLElement>("p, li")) {
      const text = (el.textContent ?? "").trim();
      if (text.length <= 90 || el.getBoundingClientRect().width < 2) continue;
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;visibility:hidden;width:1ch;display:block";
      el.appendChild(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Map<number, { left: number; right: number }>();
      for (const rect of range.getClientRects()) {
        const key = Math.round(rect.top / 4);
        const line = lines.get(key);
        lines.set(key, {
          left: Math.min(line?.left ?? rect.left, rect.left),
          right: Math.max(line?.right ?? rect.right, rect.right),
        });
      }
      const widest = Math.max(
        0,
        ...[...lines.values()].map((line) => line.right - line.left),
      );
      const measure = Math.round(widest / ch);
      if (measure > 90) {
        problems.add(
          `paragraph is ${measure} characters wide: "${text.slice(0, 50)}"`,
        );
      }
    }
    return [...problems].slice(0, 12);
  });
}

test.describe("at 3840px", () => {
  test.use({ viewport: { width: 3840, height: 2160 } });

  test("form controls are at least body size and no paragraph runs past about 90 characters, on every tool and tab", async ({
    page,
  }, testInfo) => {
    test.setTimeout(900_000);
    await bootForSweep(page);
    const result = await sweep(page, typeAndMeasureProblems);
    recordFindings("type-measure", 3840, testInfo.project.name, result);
    expect(describeFindings(result.findings)).toBe("");
  });

  test("the same holds in the states behind input", async ({
    page,
  }, testInfo) => {
    test.setTimeout(900_000);
    await bootForSweep(page);
    const result = await sweepStates(page, typeAndMeasureProblems);
    recordFindings("type-measure-states", 3840, testInfo.project.name, result);
    expect(describeFindings(result.findings)).toBe("");
  });

  test("the shell fills most of the screen but stays bounded", async ({
    page,
  }) => {
    await bootForSweep(page);
    const { viewport, main, rootFont } = await shellWidths(page);
    expect(rootFont).toBe(24);
    expect(main / viewport).toBeGreaterThanOrEqual(0.6);
    expect(main / viewport).toBeLessThanOrEqual(0.9);
  });

  test("a large dialog grows with the screen", async ({ page }) => {
    await bootForSweep(page);
    const dialog = await openTool(page, "openTacticalCalculator");
    const box = await dialog.boundingBox();
    expect(box!.width / 3840).toBeGreaterThanOrEqual(0.5);
    expect(box!.width / 3840).toBeLessThanOrEqual(0.9);
  });

  for (const [name, event] of [
    ["Privacy Policy", "openPrivacyPolicy"],
    ["Terms of Service", "openTermsOfService"],
  ]) {
    test(`${name} keeps a reading measure near 65 characters`, async ({
      page,
    }) => {
      await bootForSweep(page);
      await openTool(page, event);
      const measures = await longParagraphMeasures(page);
      expect(measures.length).toBeGreaterThan(2);
      expect(Math.max(...measures)).toBeLessThanOrEqual(75);
    });
  }
});

test.describe("at 1920px", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("the shell is wider than the 1280px column and the type is unchanged", async ({
    page,
  }) => {
    await bootForSweep(page);
    const { main, rootFont } = await shellWidths(page);
    expect(rootFont).toBe(16);
    expect(main).toBeGreaterThan(1280);
    expect(main).toBeLessThanOrEqual(1920 * 0.9);
  });
});

test.describe("at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("nothing changes below the large breakpoints", async ({ page }) => {
    await bootForSweep(page);
    const { main, rootFont } = await shellWidths(page);
    expect(rootFont).toBe(16);
    expect(main).toBeLessThanOrEqual(1280);
  });
});
