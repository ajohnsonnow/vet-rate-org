import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * ADR-009 decision G, end to end in a real browser: with the fake on-device
 * engine filling nearly every field and the local parser reading only three,
 * exactly those three rows are pre-ticked, and Import without touching
 * anything saves exactly those three. Nothing the model read is saved
 * unseen. Generic fixture text only; the fake engine stands in for the model.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DD214_DIALOG = '[role="dialog"][aria-labelledby="dd214-analyzer-title"]';
const FILL_MARKER = "E2E_MODEL_FILLS_EVERY_FIELD";
const MODEL_WRITTEN = /Navy|E-9|Rifleman|Completion of required service/;

const PARSER_THREE_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
18. REMARKS: ${FILL_MARKER}
24. CHARACTER OF SERVICE: HONORABLE
`;

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

async function readScanWithFakeEngine(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openDD214Analyzer")),
  );
  const dialog = page.locator(DD214_DIALOG);
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await dialog.locator("textarea").first().fill(PARSER_THREE_TEXT);
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
  await dialog.getByRole("button", { name: /Analyze with AI/i }).click();
  await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: /Import Selected Fields/i }),
  ).toBeVisible({ timeout: 10000 });
}

async function tickedRows(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter((box) => (box as HTMLInputElement).checked)
      .map((box) => box.getAttribute("aria-label") ?? "")
      .sort(),
  );
}

// Only stores holding this scan's own document: the shared reference corpus
// legitimately contains words like Navy.
async function dumpIndexedDb(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: unknown[] = [];
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const req = db
            .transaction(store, "readonly")
            .objectStore(store)
            .getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (JSON.stringify(rows).includes("Pasted DD214 Text")) {
          out.push({ db: info.name, store, rows });
        }
      }
      db.close();
    }
    return JSON.stringify(out);
  });
}

test.describe("ADR-009 decision G: nothing the model read is pre-ticked", () => {
  test("a reply that fills every field and a parser that reads three pre-ticks exactly those three", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "the mobile device tier cannot load an on-device engine by design",
    );
    test.setTimeout(90000);
    await shimFakeGpuAdapter(page);
    await bootApp(page);
    await readScanWithFakeEngine(page);

    expect(await tickedRows(page)).toEqual(
      ["Character of Service", "Separation Date", "Service Start Date"].sort(),
    );
    await expect(page.getByTestId("import-source-counts")).toContainText(
      "3 values read by the app's own parser",
    );
    const rank = page.getByRole("checkbox", {
      name: "Rank",
      exact: true,
    });
    await expect(rank).not.toBeChecked();
    await expect(
      page
        .locator(".rounded-lg.border", { has: rank })
        .getByTestId("import-row-source"),
    ).toContainText("Read by the AI");

    await page.getByRole("button", { name: /Import Selected Fields/i }).click();
    await expect(
      page.getByRole("button", { name: /Import Selected Fields/i }),
    ).toBeHidden({ timeout: 20000 });

    const profile = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("vet_rate_veteran_profile") ?? "{}"),
    );
    expect(profile.serviceStartDate).toBeTruthy();
    expect(profile.serviceEndDate).toBeTruthy();
    expect(profile.characterOfService).toMatch(/honorable/i);
    for (const key of [
      "branch",
      "rank",
      "payGrade",
      "mos",
      "mosTitle",
      "component",
      "separationType",
    ]) {
      expect(profile[key], key).toBeFalsy();
    }
    const history = await page.evaluate(
      () => localStorage.getItem("vet_rate_service_history") ?? "",
    );
    expect(history).not.toMatch(MODEL_WRITTEN);
    const filed = await dumpIndexedDb(page);
    expect(filed).toContain("Pasted DD214 Text");
    expect(filed).not.toMatch(MODEL_WRITTEN);
  });

  test("Import stays disabled once every row is unticked", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "the mobile device tier cannot load an on-device engine by design",
    );
    test.setTimeout(90000);
    await shimFakeGpuAdapter(page);
    await bootApp(page);
    await readScanWithFakeEngine(page);

    await page.getByRole("button", { name: /Select None/i }).click();
    expect(await tickedRows(page)).toEqual([]);
    await expect(
      page.getByRole("button", { name: /Import Selected Fields/i }),
    ).toBeDisabled();
  });

  for (const width of [390, 3840]) {
    test(`the source labels and counts fit without horizontal scroll at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name === "mobile-chrome",
        "the mobile device tier cannot load an on-device engine by design",
      );
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 2160 });
      await shimFakeGpuAdapter(page);
      await bootApp(page);
      await readScanWithFakeEngine(page);

      await expect(page.getByTestId("import-source-counts")).toBeVisible();
      await expect(page.getByTestId("import-row-source").first()).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
