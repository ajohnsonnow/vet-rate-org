import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * D22-6: the on-device engine load never ends as an endless spinner. The fake
 * engine (tests/e2e/fakes/web-llm.fake.js, window.__e2eFakeEngineStall) stops
 * reporting progress; the browser clock is moved forward past the stall
 * window, the plain message with Try again shows, and Try again (stall off)
 * loads the engine. No real model, no real provider.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const DIALOG = '[role="dialog"][aria-labelledby="decoder-title"]';

async function shimFakeGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    navigator.gpu.requestAdapter = async () =>
      ({
        info: { vendor: "e2e-fake", architecture: "fake", device: "fake" },
        limits: {
          maxComputeInvocationsPerWorkgroup: 1024,
          maxStorageBufferBindingSize: 1 << 30,
          maxBufferSize: 1 << 30,
          maxComputeWorkgroupSizeX: 1024,
          maxComputeWorkgroupSizeY: 1024,
          maxComputeWorkgroupSizeZ: 64,
          maxComputeWorkgroupStorageSize: 32768,
          maxBindGroups: 4,
          maxBindingsPerBindGroup: 1000,
          maxDynamicStorageBuffersPerPipelineLayout: 4,
          maxStorageBuffersPerShaderStage: 8,
        },
        features: new Set(),
        requestDevice: async () => ({}),
      }) as unknown as GPUAdapter;
  });
}

test("a stalled engine load ends with a plain message and Try again, which loads it", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chrome",
    "mobile UA forces the mobile device tier, where on-device AI is unreachable by design",
  );
  test.setTimeout(60000);
  await shimFakeGpuAdapter(page);
  await page.addInitScript(
    ({ version }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      (window as unknown as Record<string, unknown>).__e2eFakeEngineStall =
        true;
    },
    { version: APP_VERSION },
  );
  await page.clock.install();
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openDecisionDecoder")),
  );
  const dialog = page.locator(DIALOG);
  await dialog.waitFor({ state: "visible" });

  await dialog.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ }).click();
  await expect(dialog.getByText(/Fetching param cache 3\/10/)).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await page.clock.fastForward("11:00");

  const alert = dialog.getByRole("alert").filter({ hasText: /stopped making/ });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/try again/i);

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__e2eFakeEngineStall = false;
  });
  await dialog.getByRole("button", { name: "Try again" }).click();

  await expect(dialog.getByRole("button", { name: "Try again" })).toBeHidden();
  await expect(
    dialog.getByRole("alert").filter({ hasText: /stopped making/ }),
  ).toHaveCount(0);
});
