import { test, expect, Page } from "@playwright/test";
import {
  WIDTHS,
  bootForSweep,
  describeFindings,
  recordFindings,
  sweep,
  sweepStates,
} from "./sweep";

/**
 * Every checkbox and radio on the swept screens (home, all 48 tools, every
 * tab) must be something a person can see and hit: either the input itself
 * draws a box of at least 12px, or it is deliberately visually hidden and a
 * label that belongs to it is drawn instead.
 */

async function tickBoxProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems = new Set<string>();
    const dialogs = [
      ...document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [role="alertdialog"]',
      ),
    ].filter((el) => el.getBoundingClientRect().height > 1);
    const scope: Element = dialogs.at(-1) ?? document.body;
    const inputs = scope.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"], input[type="radio"]',
    );
    for (const input of inputs) {
      const cs = getComputedStyle(input);
      if (
        cs.display === "none" ||
        input.closest('[hidden], [aria-hidden="true"]')
      ) {
        continue;
      }
      const box = input.getBoundingClientRect();
      const label =
        input.labels?.[0] ?? (input.closest("label") as HTMLElement | null);
      const name =
        input.getAttribute("aria-label") ||
        (label?.textContent ?? "").trim().slice(0, 40) ||
        input.name ||
        "(unnamed)";
      // A sized input still shows nothing if its native box is switched off
      // and no border or fill is drawn in its place.
      const native = (cs.appearance || cs.webkitAppearance) !== "none";
      const painted =
        Number.parseFloat(cs.borderTopWidth) > 0 ||
        !["rgba(0, 0, 0, 0)", "transparent"].includes(cs.backgroundColor);
      if (box.width >= 12 && box.height >= 12 && (native || painted)) continue;

      const hiddenOnPurpose =
        cs.position === "absolute" && (box.width <= 1 || cs.opacity === "0");
      const labelBox = label?.getBoundingClientRect();
      const labelDrawn = Boolean(
        labelBox && labelBox.width > 8 && labelBox.height > 8,
      );
      if (hiddenOnPurpose && labelDrawn) continue;
      problems.add(
        `${input.type} "${name}" draws no box (${Math.round(box.width)}x${Math.round(box.height)}${native ? "" : ", native box off"})`,
      );
    }
    // A slider with its native look switched off shows only what a component
    // paints for it. A thin painted bar is a custom track; a tall filled box
    // is a slider nobody can read.
    for (const slider of scope.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )) {
      const cs = getComputedStyle(slider);
      const box = slider.getBoundingClientRect();
      if (cs.display === "none" || box.width < 2) continue;
      const native = (cs.appearance || cs.webkitAppearance) !== "none";
      const paintedTrack =
        box.height <= 16 &&
        !["rgba(0, 0, 0, 0)", "transparent"].includes(cs.backgroundColor);
      if (native || paintedTrack) continue;
      problems.add(
        `slider "${slider.getAttribute("aria-label") || slider.id || "(unnamed)"}" draws no track (native look off, ${Math.round(box.width)}x${Math.round(box.height)})`,
      );
    }
    return [...problems];
  });
}

async function countTickBoxes(page: Page): Promise<number> {
  return page.locator('input[type="checkbox"], input[type="radio"]').count();
}

for (const viewport of WIDTHS) {
  test.describe(`form controls sweep at ${viewport.width}px (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("every checkbox and radio draws a box or is hidden behind a drawn label", async ({
      page,
    }, testInfo) => {
      test.setTimeout(900_000);
      await bootForSweep(page);
      let seen = 0;
      const result = await sweep(page, async (p) => {
        seen += await countTickBoxes(p);
        return tickBoxProblems(p);
      });
      recordFindings("form-controls", viewport.width, testInfo.project.name, {
        ...result,
        screens: result.screens,
      });
      expect(seen).toBeGreaterThan(10);
      expect(describeFindings(result.findings)).toBe("");
    });

    test("the same holds in the states behind input", async ({
      page,
    }, testInfo) => {
      test.setTimeout(900_000);
      await bootForSweep(page);
      let seen = 0;
      const result = await sweepStates(page, async (p) => {
        seen += await countTickBoxes(p);
        return tickBoxProblems(p);
      });
      recordFindings(
        "form-controls-states",
        viewport.width,
        testInfo.project.name,
        result,
      );
      expect(seen).toBeGreaterThan(3);
      expect(describeFindings(result.findings)).toBe("");
    });
  });
}
