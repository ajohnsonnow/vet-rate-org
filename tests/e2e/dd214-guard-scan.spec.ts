import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";
import {
  COMPONENT_TOKEN,
  COURSE,
  GUARD_RESERVE_SCAN,
  REASON,
} from "../../src/utils/dd214GuardReserveScan.fixture.js";

/**
 * Final24 D24-2 and D24-4 in a real browser: a Guard/Reserve-era scan read in
 * columns. The component the parser could not read from box 2 is shown
 * unticked with a check note, Days Lost is the box's own NONE, and the
 * education, awards and reason are the form's own words with no label text or
 * redaction marks. Synthetic page text only; the fake on-device engine stands
 * in for the model.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const DD214_DIALOG = '[role="dialog"][aria-labelledby="dd214-analyzer-title"]';

async function shimFakeGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    navigator.gpu.requestAdapter = async () => ({
      info: {
        vendor: "e2e-fake",
        architecture: "fake",
        device: "e2e fake GPU",
        description: "Deterministic e2e test adapter",
      },
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
    });
  });
}

async function bootApp(page: Page): Promise<void> {
  await page.addInitScript((version) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", version);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function readGuardScan(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openDD214Analyzer")),
  );
  const dialog = page.locator(DD214_DIALOG);
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await dialog.locator("textarea").first().fill(GUARD_RESERVE_SCAN);
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
  await dialog.getByRole("button", { name: /Analyze with AI/i }).click();
  await expect(
    page.getByRole("button", { name: /Import Selected Fields/i }),
  ).toBeVisible({ timeout: 30000 });
}

const rowOf = (page: Page, name: string) =>
  page.locator(".rounded-lg.border", {
    has: page.getByRole("checkbox", { name, exact: true }),
  });

test.describe("a Guard/Reserve-era scan in the DD-214 import dialog", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "the mobile device tier cannot load an on-device engine by design",
    );
    test.setTimeout(90000);
  });

  test("shows the Guard component unticked with a note, NONE days lost and the form's own words", async ({
    page,
  }) => {
    await shimFakeGpuAdapter(page);
    await bootApp(page);
    await readGuardScan(page);

    for (const name of ["Component", "Component (Full Name)"]) {
      await expect(
        page.getByRole("checkbox", { name, exact: true }),
      ).not.toBeChecked();
      await expect(
        rowOf(page, name).getByTestId("import-row-source"),
      ).toContainText("Check this against your document");
    }
    await expect(
      rowOf(page, "Component").locator("input[type=text]"),
    ).toHaveValue(COMPONENT_TOKEN);
    await expect(
      rowOf(page, "Days Lost").locator("input[type=text]"),
    ).toHaveValue("NONE");
    await expect(
      rowOf(page, "Military Education").locator("input[type=text]"),
    ).toHaveValue(COURSE);
    await expect(
      rowOf(page, "Narrative Reason for Separation").locator(
        "input[type=text]",
      ),
    ).toHaveValue(REASON);
    const awards = await rowOf(page, "Awards and Decorations")
      .locator("input[type=text]")
      .inputValue();
    expect(awards.split(";")).toHaveLength(12);

    const shown = await page.locator("body").innerText();
    expect(shown).not.toContain("[REDACTED]");
    expect(shown).not.toMatch(/ROM ACTIVE DUTY|RENDER FORM/);
  });

  test("saves no component when Import is clicked without touching anything", async ({
    page,
  }) => {
    await shimFakeGpuAdapter(page);
    await bootApp(page);
    await readGuardScan(page);

    await page.getByRole("button", { name: /Import Selected Fields/i }).click();
    await expect(
      page.getByRole("button", { name: /Import Selected Fields/i }),
    ).toBeHidden({ timeout: 20000 });
    const profile = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("vet_rate_veteran_profile") ?? "{}"),
    );
    expect(profile.component).toBeFalsy();
    expect(profile.componentFull).toBeFalsy();
  });

  for (const width of [390, 3840]) {
    test(`the note and rows fit without horizontal scroll at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 2160 });
      await shimFakeGpuAdapter(page);
      await bootApp(page);
      await readGuardScan(page);

      await expect(
        rowOf(page, "Component").getByTestId("import-row-source"),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
