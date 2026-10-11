import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * The DD-214 Analyzer's identifier cards sit in a grid that is forced to one
 * column on a phone. A card that asked to span two columns added a second,
 * content-sized column and squeezed every other card to about 35px, so the
 * label and value were unreadable. Generic fixture text; the fake on-device
 * engine stands in for the model.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const DD214_DIALOG = '[role="dialog"][aria-labelledby="dd214-analyzer-title"]';

const IDENTIFIER_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: FAKETON, JORDAN QUINCY
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
5. DATE OF BIRTH: 1984 03 15
7B. HOME OF RECORD: ANYTOWN, ANYCOUNTY, TX
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
19. MAILING ADDRESS: 123 MAIN ST, ANYTOWN TX 12345
24. CHARACTER OF SERVICE: HONORABLE
`;

async function shimDesktopGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    Object.defineProperty(navigator, "deviceMemory", {
      value: 8,
      configurable: true,
    });
    navigator.gpu.requestAdapter = async () =>
      ({
        info: { vendor: "e2e-fake", architecture: "fake", device: "fake" },
        limits: {
          maxComputeInvocationsPerWorkgroup: 1024,
          maxStorageBufferBindingSize: 1 << 30,
          maxBufferSize: 2 ** 31,
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

async function openReviewScreen(page: Page, width: number): Promise<void> {
  await shimDesktopGpuAdapter(page);
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((version) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", version);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openDD214Analyzer")),
  );
  const dialog = page.locator(DD214_DIALOG);
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await dialog.locator("textarea").first().fill(IDENTIFIER_TEXT);
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
  await dialog.getByRole("button", { name: /Analyze with AI/i }).click();
  await page
    .getByRole("button", { name: /Cancel Import/i })
    .click({ timeout: 20000 });
}

for (const width of [390, 1440, 3840]) {
  test(`DD-214 review screen at ${width}px: no sideways scroll, identifier label and value visible`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "the mobile device tier cannot load an on-device engine by design",
    );
    test.setTimeout(90000);
    await openReviewScreen(page, width);

    const dialog = page.locator(DD214_DIALOG);
    const label = dialog.locator('label[for="dd214-identifier-fullName"]');
    const value = dialog.locator("#dd214-identifier-fullName");
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeVisible();
    await expect(value).toBeVisible();
    await expect(value).toHaveValue(/FAKETON/);

    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);

    const labelBox = await label.boundingBox();
    const valueBox = await value.boundingBox();
    expect(labelBox!.width).toBeGreaterThan(100);
    expect(valueBox!.width).toBeGreaterThan(100);
    expect(valueBox!.x + valueBox!.width).toBeLessThanOrEqual(width);
  });
}
