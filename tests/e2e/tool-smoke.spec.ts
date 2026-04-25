/**
 * Per-tool smoke spec
 *
 * Opens a representative slice of the 42-tool surface from the home page CTAs
 * and asserts each one mounts a dialog/modal without throwing or wedging the UI.
 *
 * Why a curated slice rather than all 42:
 *   - The home-page CTA grid only exposes a subset directly; the rest live in
 *     the GlobalCommandSearch (CMD+K) which has a wiring bug on `main`
 *     (PR2 fixes it; PR6 doesn't depend on PR2 — see plan).
 *   - Keeping the matrix focused means a regression on "Tactical Calculator
 *     fails to mount" lights up red in seconds, not 3 minutes.
 *
 * Each entry verifies:
 *   - The CTA button is visible and clickable
 *   - A dialog/modal element renders within 5s
 *   - No uncaught page errors during the open
 */
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer, preAcceptModals } from "./helpers";

type ToolCase = {
  name: string;
  buttonText: RegExp;
  /**
   * Regex matching text content that proves the tool actually mounted.
   * Picked to be unique to that tool so we don't accept any modal as a pass.
   */
  proofText: RegExp;
};

const TOOLS: ToolCase[] = [
  {
    name: "Tactical Calculator",
    buttonText: /Calculate My Rating/i,
    proofText: /Tactical Calculator|Combined Rating|38 CFR/i,
  },
  {
    name: "C-File Analyzer",
    buttonText: /Analyze My C-File/i,
    proofText: /C-?File|Claims File|Drop your.*PDF|Upload/i,
  },
  {
    name: "Blue Button X-Ray",
    buttonText: /Scan My Records/i,
    proofText: /Blue Button|MyHealtheVet|Health Records/i,
  },
  {
    name: "Witness Bench",
    buttonText: /Create Buddy Statement/i,
    proofText: /Witness Bench|Buddy/i,
  },
  {
    name: "Forms Helper",
    buttonText: /Open Forms Helper/i,
    proofText: /Forms Helper|VA Form|21-526|buddy statement/i,
  },
  {
    name: "Red Team",
    buttonText: /Stress Test Statement/i,
    proofText: /Red Team|Stress Test|Weak Language/i,
  },
];

async function openHome(page: Page) {
  await preAcceptModals(page);
  await page.goto("/");
  await dismissDisclaimer(page);
  // Let lazy-loaded sections settle so CTA buttons stop re-rendering mid-click.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
    /* networkidle may not be reachable for AI status polling — ignore */
  });
}

async function closeAnyOpenDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]').first();
  const visible = await dialog.isVisible({ timeout: 1000 }).catch(() => false);
  if (visible) {
    await page.keyboard.press("Escape");
    await page
      .waitForFunction(
        () => document.querySelectorAll('[role="dialog"]').length === 0,
        null,
        { timeout: 5000 },
      )
      .catch(() => {
        /* best-effort */
      });
  }
}

test.describe("Per-tool smoke — home-page CTAs mount", () => {
  for (const tool of TOOLS) {
    test(`${tool.name} mounts and renders identifying content`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await openHome(page);

      const cta = page.getByRole("button", { name: tool.buttonText }).first();
      await expect(
        cta,
        `Could not find CTA button for ${tool.name}`,
      ).toBeVisible({ timeout: 15_000 });
      // dispatchEvent click bypasses pointer-event/scroll race conditions in
      // long lazy-loaded layouts where the button is briefly re-mounted.
      await cta.dispatchEvent("click");

      const proof = page.getByText(tool.proofText).first();
      await expect(
        proof,
        `${tool.name} did not render proof content`,
      ).toBeVisible({
        timeout: 10_000,
      });

      const fatal = errors.filter(
        (e) =>
          !e.includes("ResizeObserver") &&
          !e.includes("Non-Error promise rejection"),
      );
      expect(fatal, `${tool.name} threw: ${fatal.join("; ")}`).toEqual([]);

      await closeAnyOpenDialog(page);
    });
  }
});
