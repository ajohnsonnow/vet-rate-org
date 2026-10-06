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
 * App-wide layout sweep: on the home page, in every tool of the launch
 * matrix and on every tab inside each tool, at 390, 1280 and 3840px:
 *
 *  - the page does not scroll horizontally;
 *  - no vertically scrolling pane (a dialog body) also scrolls horizontally;
 *  - no control sits off the left or right edge of the viewport, unless it
 *    is inside a strip that scrolls horizontally on purpose.
 */

async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const describe = (el: Element) => {
      const label =
        el.getAttribute("aria-label") ||
        (el.textContent ?? "").trim().slice(0, 30) ||
        el.getAttribute("placeholder") ||
        "";
      return `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 1 &&
        r.height > 1 &&
        cs.visibility !== "hidden" &&
        cs.display !== "none"
      );
    };

    const root = document.documentElement;
    const pageOverflow = root.scrollWidth - root.clientWidth;
    if (pageOverflow > 1)
      problems.push(`page scrolls sideways by ${pageOverflow}px`);

    const dialogs = [
      ...document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [role="alertdialog"]',
      ),
    ].filter(visible);
    const scope: Element = dialogs.at(-1) ?? document.body;

    for (const el of [scope, ...scope.querySelectorAll("*")]) {
      const cs = getComputedStyle(el);
      const scrollsDown = cs.overflowY === "auto" || cs.overflowY === "scroll";
      const overflow = el.scrollWidth - el.clientWidth;
      if (scrollsDown && el.scrollHeight > el.clientHeight && overflow > 1) {
        problems.push(
          `${describe(el).slice(0, 40)} pane scrolls sideways by ${overflow}px`,
        );
      }
    }

    const insideSidewaysScroller = (el: Element) => {
      for (
        let p = el.parentElement;
        p && p !== scope.parentElement;
        p = p.parentElement
      ) {
        const cs = getComputedStyle(p);
        if (
          (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
          p.scrollWidth > p.clientWidth + 1
        ) {
          return true;
        }
      }
      return false;
    };
    const width = window.innerWidth;
    const controls = scope.querySelectorAll(
      'button, a[href], input, select, textarea, [role="tab"], [role="button"]',
    );
    const offScreen = new Set<string>();
    for (const el of controls) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue;
      if ((r.left < -1 || r.right > width + 1) && !insideSidewaysScroller(el)) {
        offScreen.add(
          `${describe(el)} is off-screen (x ${Math.round(r.left)} to ${Math.round(r.right)} of ${width})`,
        );
      }
    }
    problems.push(...[...offScreen].slice(0, 6));
    return problems;
  });
}

for (const viewport of WIDTHS) {
  test.describe(`layout sweep at ${viewport.width}px (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("no horizontal scroll and no control off-screen on any tool or tab", async ({
      page,
    }, testInfo) => {
      test.setTimeout(900_000);
      await bootForSweep(page);
      const result = await sweep(page, layoutProblems);
      recordFindings("layout", viewport.width, testInfo.project.name, result);
      expect(result.screens).toBeGreaterThan(48);
      expect(describeFindings(result.findings)).toBe("");
    });

    test("the same holds in the states behind input", async ({
      page,
    }, testInfo) => {
      test.setTimeout(900_000);
      await bootForSweep(page);
      const result = await sweepStates(page, layoutProblems);
      recordFindings(
        "layout-states",
        viewport.width,
        testInfo.project.name,
        result,
      );
      expect(describeFindings(result.findings)).toBe("");
    });
  });
}
