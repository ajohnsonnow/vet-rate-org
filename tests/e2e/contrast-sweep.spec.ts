import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  WIDTHS,
  bootForSweep,
  describeFindings,
  recordFindings,
  sweep,
} from "./sweep";

/**
 * Colour contrast on every swept screen (home, all 48 tools, every tab), in
 * the light and dark themes, at 390, 1280 and 3840px. Runs axe's
 * `color-contrast` rule (WCAG 1.4.3: 4.5:1 for text, 3:1 for large text) and
 * fails on any node it reports.
 *
 * Honest limit: axe marks text over gradients, images or overlapping layers
 * as "incomplete" instead of failing it; those are not checked here.
 */

const DIALOG = '[role="dialog"], [aria-modal="true"]';

async function contrastProblems(page: Page): Promise<string[]> {
  // A tab that has just lost its active state can still be mid-transition;
  // wait for every running animation and transition to finish before reading
  // colours.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) =>
          animation.playState === "running"
            ? animation.finished.catch(() => undefined)
            : undefined,
        ),
    ),
  );
  const inDialog = (await page.locator(DIALOG).count()) > 0;
  let builder = new AxeBuilder({ page }).withRules(["color-contrast"]);
  if (inDialog) builder = builder.include(DIALOG);
  const { violations } = await builder.analyze();
  const problems = new Set<string>();
  for (const violation of violations) {
    for (const node of violation.nodes) {
      const data = (node.any[0]?.data ?? {}) as {
        fgColor?: string;
        bgColor?: string;
        contrastRatio?: number;
        expectedContrastRatio?: string;
      };
      const text = node.html.replace(/\s+/g, " ").slice(0, 90);
      problems.add(
        `${data.contrastRatio ?? "?"}:1 (needs ${data.expectedContrastRatio ?? "4.5:1"}) ${data.fgColor} on ${data.bgColor} | ${String(node.target[0]).slice(0, 80)} | ${text}`,
      );
    }
  }
  return [...problems];
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of WIDTHS) {
    test.describe(`contrast sweep, ${theme} theme, ${viewport.width}px (${viewport.name})`, () => {
      // Reduced motion zeroes the app's transitions (index.css), so axe never
      // reads a colour halfway through a fade or a tab's colour change.
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        contextOptions: { reducedMotion: "reduce" },
      });

      test("no colour-contrast failure on any tool or tab", async ({
        page,
      }, testInfo) => {
        test.setTimeout(1_800_000);
        await bootForSweep(page, theme);
        const result = await sweep(page, contrastProblems);
        recordFindings(
          `contrast-${theme}`,
          viewport.width,
          testInfo.project.name,
          result,
        );
        expect(result.screens).toBeGreaterThan(48);
        expect(describeFindings(result.findings)).toBe("");
      });
    });
  }
}
