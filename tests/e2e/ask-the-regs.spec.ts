import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

// Same returning-user fixture as mobile.spec.ts: suppresses the ToS gate,
// What's New modal, and BootCampTour so they don't layer over (and intercept
// clicks on) the modal under test.
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DIALOG_SELECTOR = '[role="dialog"][aria-labelledby="ask-the-regs-title"]';

/**
 * Dispatching `openAskTheRegs` once immediately after navigation can race
 * AppModals' lazy-loaded Suspense boundary — the listener isn't attached
 * until AskTheRegsModal's chunk resolves and its useEffect runs. Poll the
 * dispatch (same pattern as mobile.spec.ts's openModalByEvent) so it lands
 * however long the chunk takes to mount.
 */
async function openAskTheRegs(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("openAskTheRegs"));
        });
        return page.locator(DIALOG_SELECTOR).isVisible();
      },
      { timeout: 8000 },
    )
    .toBe(true);
}

/**
 * Ask the Regs (S23) — end-to-end coverage of the wiring, not the dual-LLM
 * security internals (those are unit-tested exhaustively in
 * src/__tests__/services/legalAnswerer.test.js, dualLLM.js, piiScrubber.js).
 *
 * There is no network-mock scaffold for the AI backend in this e2e suite
 * (no existing test drives a live/mocked LLM call), so a genuine
 * injectionAttempt:true round-trip isn't exercised here — that path is
 * covered instead by src/__tests__/components/AskTheRegs.test.jsx, which
 * mocks legalAnswerer.answer() to return injectionAttempt:true and asserts
 * the refusal banner renders. What IS honestly verifiable end-to-end,
 * without any mock, is that the modal opens via its window event and that
 * asking without an AI mode configured — the default state for this e2e
 * suite, which never sets up a WebLLM/cloud key — surfaces a clear setup
 * prompt rather than silently failing or throwing.
 */
test.describe("Ask the Regs", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      // Not part of mobile.spec.ts's fixture (added there before this prompt
      // existed) — without it, AffiliationPickerPrompt layers over the modal
      // and intercepts clicks, found by actually running this e2e test.
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    }, APP_VERSION);
    await page.goto("/");
    await dismissDisclaimer(page);
  });

  test("opens via its window event and renders the question input", async ({
    page,
  }) => {
    await openAskTheRegs(page);

    await expect(page.getByLabel(/your question/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /ask/i })).toBeVisible();
  });

  test("asking without an AI mode configured shows a setup prompt, not a crash or silent no-op", async ({
    page,
  }) => {
    await openAskTheRegs(page);

    await page
      .getByLabel(/your question/i)
      .fill("How does VA combine multiple disability ratings?");
    await page.getByRole("button", { name: /ask/i }).click();

    await expect(page.getByText(/set up an ai mode/i)).toBeVisible({
      timeout: 4000,
    });
  });

  test("closes without leaving the app in a broken state", async ({
    page,
  }) => {
    await openAskTheRegs(page);
    const dialog = page.locator(DIALOG_SELECTOR);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 4000 });
    await expect(page.locator("body")).toBeVisible();
  });
});
