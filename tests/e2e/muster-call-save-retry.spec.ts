import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * D21-1: an import must never hang silently when the browser's storage stops
 * answering. A My Packet write transaction that never completes is injected
 * (test-harness only, via page.addInitScript - no src/ file touched); the
 * import must end, say plainly which document did not finish saving, offer a
 * Retry, and the Retry must complete the document into the review screen and
 * leave exactly one copy in My Packet.
 *
 * Same fake on-device engine and GPU adapter shim as muster-call-ai-panic.spec.ts.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const MUSTER_CALL_DIALOG_SELECTOR = '[aria-labelledby="muster-call-title"]';
const FIXTURE_NAME = "e2e-generic-fixture.txt";

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

async function stallMyPacketWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const realTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      storeNames: string | string[],
      mode?: IDBTransactionMode,
    ) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const stalled =
        (window as unknown as { __stallPacketWrites?: boolean })
          .__stallPacketWrites === true &&
        mode === "readwrite" &&
        names.includes("documents");
      if (!stalled) return realTransaction.call(this, storeNames, mode);
      return {
        objectStore: () => ({ put: () => ({}) }),
      } as unknown as IDBTransaction;
    } as typeof IDBDatabase.prototype.transaction;
    (
      window as unknown as { __stallPacketWrites?: boolean }
    ).__stallPacketWrites = true;
  });
}

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function countPacketDocuments(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("VetRateMyPacket");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction(["documents"], "readonly")
            .objectStore("documents")
            .count();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

test.describe("Muster Call: a save that stops answering is reported and can be retried", () => {
  test.skip(
    ({ isMobile }) => !!isMobile,
    "Warrant Council AI is desktop/laptop-only by device-tier design",
  );

  test("names the document, offers Retry, and Retry completes it exactly once", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await shimFakeGpuAdapter(page);
    await stallMyPacketWrites(page);
    await seedReturningUser(page);

    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openMusterCall")),
    );
    const dialog = page.locator(MUSTER_CALL_DIALOG_SELECTOR);
    await expect(dialog).toBeVisible();

    await page.locator("#muster-call-files").setInputFiles({
      name: FIXTURE_NAME,
      mimeType: "text/plain",
      buffer: Buffer.from(
        "This is a generic e2e test fixture with no real veteran information. " +
          "It contains no service dates, no SSNs, no diagnostic codes, and no PII.",
      ),
    });
    await page.getByRole("button", { name: /load ai/i }).click();
    await expect(page.getByText(/CW5 Auditor ready/i)).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole("button", { name: "Start processing documents" })
      .click();

    // The stalled save is given up on (60s bound), not waited on forever.
    const failure = dialog.getByRole("alert").filter({
      hasText: /did not finish/i,
    });
    await expect(failure).toBeVisible({ timeout: 120_000 });
    await expect(failure).toContainText(FIXTURE_NAME);
    const retry = dialog.getByTestId("retry-save-button");
    await expect(retry).toBeVisible();
    expect(await countPacketDocuments(page)).toBe(0);

    await page.evaluate(() => {
      (
        window as unknown as { __stallPacketWrites: boolean }
      ).__stallPacketWrites = false;
    });
    await retry.click();

    const skip = page.getByRole("button", { name: /skip this document/i });
    await expect(skip).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => countPacketDocuments(page)).toBe(1);

    await skip.click();
    await expect(
      page.getByRole("button", { name: /fall in.*new formation/i }),
    ).toBeVisible();
    expect(await countPacketDocuments(page)).toBe(1);
  });
});
