import { readFileSync } from "node:fs";
import { test, expect, Page, Locator } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * WS-5 — interaction-level a11y checks for the three simulators, covering what
 * the static axe gate cannot: keyboard-only operation of the What-If Sandbox
 * and the Body Map, and the Tribunal's live-caption panel. Real TTS/speech is
 * never driven (headless CI has no audio); the caption panel's presence and
 * live-region wiring are asserted instead.
 */

/** Pre-accept first-run modals so the surface under test is the only dialog. */
async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * Dispatch a modal-open window event until a dialog appears (the owning
 * feature clusters are lazy-loaded, so a single dispatch sent before the
 * listener attaches is silently lost; re-dispatching is idempotent).
 */
async function openModalByEvent(page: Page, event: string): Promise<Locator> {
  await expect
    .poll(
      async () => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, event);
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

/** Press Tab until `target` holds focus — fails if unreachable in maxTabs. */
async function tabTo(
  page: Page,
  target: Locator,
  maxTabs: number,
): Promise<void> {
  const isFocused = () =>
    target.evaluate((el) => el === document.activeElement);
  for (let i = 0; i < maxTabs; i++) {
    if (await isFocused()) return;
    await page.keyboard.press("Tab");
  }
  expect(
    await isFocused(),
    `target not reachable within ${maxTabs} Tab presses`,
  ).toBe(true);
}

test.describe("simulator accessibility (WS-5)", () => {
  test.beforeEach(async ({ page }) => {
    await bootReturningUser(page);
  });

  test("What-If Sandbox: keyboard-only pill add updates the combined rating", async ({
    page,
  }) => {
    const dialog = await openModalByEvent(page, "openWhatIfSandbox");

    const pill = dialog.locator('button[aria-label="Add PTSD at 10%"]');
    await pill.waitFor({ state: "visible" });

    await tabTo(page, pill, 15);
    await page.keyboard.press("Enter");

    await expect(dialog.locator('[data-testid="combined-rating"]')).toHaveText(
      "10%",
    );
    await expect(dialog.locator('[role="status"]')).toContainText(
      "PTSD 10 percent added. Combined rating now 10 percent.",
    );
  });

  test("Body Map: keyboard-only zone selection opens the symptom panel", async ({
    page,
  }) => {
    const dialog = await openModalByEvent(page, "openBodyMapSelector");

    // The SVG zone carries an explicit role="button" attribute; the
    // quick-select <button> elements do not, so this matches only the zone.
    const zone = dialog.locator(
      '[role="button"][aria-label="Head/Skull — select to log symptoms"]',
    );
    await zone.waitFor({ state: "visible" });

    await tabTo(page, zone, 30);
    await page.keyboard.press("Enter");

    await expect(
      dialog.getByRole("heading", { name: "Head/Skull" }),
    ).toBeVisible();
    await expect(dialog.locator('[role="status"]')).toContainText(
      "Head/Skull selected, 7 symptoms available",
    );
  });

  test("Tribunal: courtroom shows a live-caption panel wired as aria-live", async ({
    page,
  }) => {
    const dialog = await openModalByEvent(page, "openTheTribunal");

    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: /Enter the Courtroom/ }).click();

    const captions = dialog.locator('[data-testid="tribunal-captions"]');
    await expect(captions).toBeVisible();
    await expect(captions).toHaveAttribute("aria-live", "polite");

    // The text input must stay usable in the courtroom (never voice-gated).
    await expect(
      dialog.getByRole("textbox", { name: "Type your response" }),
    ).toBeEnabled();
  });
});
