import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissDisclaimer } from "./helpers";

/**
 * The profile import dialog's footer was a non-wrapping row: at phone width
 * the "Import Selected Fields" button shrank to about 67px and its label ran
 * past the button and the viewport edge. Generic fixture text; the fake
 * on-device engine stands in for the model.
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
    .waitFor({ state: "visible", timeout: 20000 });
}

for (const width of [390, 1440, 3840]) {
  test(`import dialog footer at ${width}px: every button label fits its button and the viewport`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "the mobile device tier cannot load an on-device engine by design",
    );
    test.setTimeout(90000);
    await openReviewScreen(page, width);

    const footer = page
      .getByRole("dialog", { name: /Review Imported Profile Data/ })
      .locator("footer");
    await expect(footer).toBeVisible();
    const buttons = footer.getByRole("button");
    expect(await buttons.count()).toBeGreaterThanOrEqual(2);

    const measured = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const label = range.getBoundingClientRect();
        const box = node.getBoundingClientRect();
        return {
          text: (node.textContent || "").trim(),
          labelLeft: label.left,
          labelRight: label.right,
          boxLeft: box.left,
          boxRight: box.right,
          height: box.height,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        };
      }),
    );

    for (const b of measured) {
      expect(b.labelLeft, `${b.text} label left`).toBeGreaterThanOrEqual(
        b.boxLeft - 0.5,
      );
      expect(b.labelRight, `${b.text} label right`).toBeLessThanOrEqual(
        b.boxRight + 0.5,
      );
      expect(b.scrollWidth, `${b.text} scroll width`).toBeLessThanOrEqual(
        b.clientWidth + 1,
      );
      expect(b.boxLeft, `${b.text} box left`).toBeGreaterThanOrEqual(0);
      expect(b.labelRight, `${b.text} label vs viewport`).toBeLessThanOrEqual(
        width,
      );
      expect(b.boxRight, `${b.text} box vs viewport`).toBeLessThanOrEqual(
        width,
      );
      expect(b.height, `${b.text} touch target`).toBeGreaterThanOrEqual(44);
    }

    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
  });
}

test("import review dialog has no axe violations: every value input is named, one contentinfo", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chrome",
    "the mobile device tier cannot load an on-device engine by design",
  );
  test.setTimeout(90000);
  await openReviewScreen(page, 1440);

  const review = page.locator(
    '[role="dialog"][aria-labelledby="profile-import-title"]',
  );
  await expect(review).toBeVisible();
  expect(await review.getByRole("textbox").count()).toBeGreaterThan(0);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .include('[role="dialog"][aria-labelledby="profile-import-title"]')
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
  ).toEqual([]);

  const pageWide = await new AxeBuilder({ page })
    .withRules(["landmark-no-duplicate-contentinfo"])
    .analyze();
  expect(pageWide.violations.map((v) => v.id)).toEqual([]);
});
