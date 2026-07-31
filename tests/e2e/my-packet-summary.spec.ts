import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Unit tests cover packetSummary.js as a pure function. This covers the part
 * they cannot: that the derived TL;DR and the per-document findings actually
 * reach the DOM from a real IndexedDB-backed VKB.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

declare global {
  interface Window {
    __packetMods: { vkbMod: typeof import("../../src/utils/veteranKnowledgeBase") };
  }
}

async function injectVkbModule(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as vkbMod from "/src/utils/veteranKnowledgeBase.js";
      window.__packetMods = { vkbMod };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__packetMods), null, {
    timeout: 60_000,
  });
}

async function seedVkb(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { vkbMod } = window.__packetMods;

    await vkbMod.addDocumentToVKB({
      fileName: "seed_dd214.pdf",
      fileSize: 240_000,
      pageCount: 2,
      classification: "DD214",
      extractedText: "DD FORM 214",
      extractedData: {
        branch: "Army",
        rank: "SGT",
        entryDate: "2010-06-01",
        separationDate: "2015-05-30",
        characterOfService: "Honorable",
        mos: [{ code: "11B", title: "Infantryman" }],
        awards: ["Army Commendation Medal"],
      },
    });

    await vkbMod.addDocumentToVKB({
      fileName: "seed_cfile.pdf",
      fileSize: 9_000_000,
      pageCount: 412,
      classification: "C_FILE_MEDICAL",
      extractedText: "consolidated claims file",
      extractedData: {
        summary: "Consolidated claims file covering 2015-2024.",
        claimNumber: "C-12345678",
        conditions: ["Tinnitus", "Lumbar strain"],
        segments: [{ type: "DD214" }, { type: "STR" }],
      },
    });

    const vkb = await vkbMod.loadVKB();
    vkb.serviceHistory.separationDate = "2015-05-30";
    vkb.medicalConditions.current = [
      {
        name: "Tinnitus",
        ratedPercentage: 10,
        serviceConnected: true,
        source: "C-File Analysis",
      },
      { name: "Lumbar strain", ratedPercentage: 20, serviceConnected: true },
    ];
    vkb.evidenceTimeline = [
      { date: "2016-02-02", eventType: "exam", description: "C&P exam" },
    ];
    await vkbMod.saveVKB(vkb);
  });
}

async function openMyPacket(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("openMyPacket")),
        );
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page.locator('[role="dialog"]').last().waitFor({ state: "visible" });
}

test.describe("My Packet — derived TL;DR and per-document findings", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      // Without this the onboarding affiliation prompt mounts its own dialog,
      // whose backdrop sits over My Packet and swallows every tab click.
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    }, APP_VERSION);

    await page.goto("/");
    await dismissDisclaimer(page);
    await injectVkbModule(page);
    await seedVkb(page);
  });

  test("TL;DR panel renders counts derived from the stored VKB", async ({
    page,
  }) => {
    await openMyPacket(page);

    const tldr = page.locator('section[aria-labelledby="packet-tldr-heading"]');
    await expect(tldr).toBeVisible({ timeout: 30_000 });

    await expect(tldr).toContainText("TL;DR");
    // 2 seeded documents, 2 conditions, both named in the C-File.
    await expect(tldr).toContainText("2 documents");
    await expect(tldr).toContainText("2 conditions");
    // 414 = 2-page DD214 + 412-page C-File.
    await expect(tldr).toContainText("414");
    await expect(tldr).toContainText("not AI-generated");
  });

  test("TL;DR does not claim a missing DD-214 when one is on file", async ({
    page,
  }) => {
    await openMyPacket(page);

    const tldr = page.locator('section[aria-labelledby="packet-tldr-heading"]');
    await expect(tldr).toBeVisible({ timeout: 30_000 });
    await expect(tldr).not.toContainText("No DD-214");
  });

  test("Documents tab shows findings for every category, not just C-Files", async ({
    page,
  }) => {
    await openMyPacket(page);

    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole("button", { name: /Documents/ }).click();

    // The DD-214's extracted fields previously never rendered anywhere —
    // the tab listed the bucket count only.
    await expect(dialog).toContainText("seed_dd214.pdf");
    await expect(dialog).toContainText("Honorable");
    await expect(dialog).toContainText("11B — Infantryman");

    await expect(dialog).toContainText("seed_cfile.pdf");
    await expect(dialog).toContainText("Consolidated claims file");
    await expect(dialog).toContainText("C-12345678");
  });

  test("cross-document section links each condition to its source documents", async ({
    page,
  }) => {
    await openMyPacket(page);

    const dialog = page.locator('[role="dialog"]').last();
    await dialog.getByRole("button", { name: /Documents/ }).click();

    await expect(dialog).toContainText("Conditions across your records");
    await expect(dialog).toContainText("Tinnitus");
    await expect(dialog).toContainText("service connected");
    await expect(dialog).toContainText("seed_cfile.pdf");
  });

  test("no horizontal overflow at 390px with the panel rendered", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMyPacket(page);

    await expect(
      page.locator('section[aria-labelledby="packet-tldr-heading"]'),
    ).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
