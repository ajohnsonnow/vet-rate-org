/**
 * TEMPORARY scratch verification spec — not part of the permanent suite.
 * Deleted before this round's work is reported done. Verifies the 4 fixes
 * in this round (deployment fabrication, service dates, timeline dedup,
 * name extraction) against the real DD214/NGB22 corpus at CORPUS_DIR,
 * using the app's real production pipeline (processFormationDocument),
 * same harness pattern as document-corpus-import-report.spec.ts.
 *
 * PRIVACY: extracted field values ARE written to the JSON report (outside
 * the repo) because this run's whole purpose is confirming those field
 * values are now correct — this is a one-off manual verification run, not
 * a checked-in test asset.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const CORPUS_DIR = process.env.CORPUS_DIR || "E:\\Johnson_C-FIle";
const OUTPUT_DIR =
  process.env.REPORT_OUT_DIR ||
  "C:\\Users\\antho\\AppData\\Local\\Temp\\claude\\e--VS-Studio-vet-rate-org-official\\06c99292-1d1a-4e2f-99b3-bd4c7a19d0d9\\scratchpad\\real-corpus-verify";

const DD214_FILES = [
  "Johnson Service Records DD214 ALL [1].pdf",
  "Johnson Service Records DD214 ALL [2].pdf",
  "Johnson Service Records DD214 ALL [3].pdf",
  "Johnson Service Records DD214 ALL [4].pdf",
];

async function boot(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version }: { version: string }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.removeItem("vetrate_formation_state");
    },
    { version: APP_VERSION },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  await dismissDisclaimer(page);
}

async function precreateDatabases(page: Page): Promise<void> {
  await page.goto("/support.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const buildVkb = (db: IDBDatabase) => {
      if (db.objectStoreNames.contains("knowledge_base")) return;
      const s = db.createObjectStore("knowledge_base", { keyPath: "id" });
      s.createIndex("lastUpdated", "metadata.lastUpdated", { unique: false });
    };
    const buildPacket = (db: IDBDatabase) => {
      if (!db.objectStoreNames.contains("documents")) {
        const s = db.createObjectStore("documents", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
        s.createIndex("uploadDate", "uploadDate", { unique: false });
        s.createIndex("fileName", "fileName", { unique: false });
      }
      if (!db.objectStoreNames.contains("document_index")) {
        const s = db.createObjectStore("document_index", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
      }
    };
    const specs = [
      { name: "VetRateVKB", version: 1, build: buildVkb },
      { name: "VetRateMyPacket", version: 2, build: buildPacket },
    ];
    for (const spec of specs) {
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(spec.name, spec.version);
        req.onupgradeneeded = () => spec.build(req.result);
        req.onsuccess = () => resolve(req.result.close());
        req.onerror = () => resolve();
        setTimeout(resolve, 20_000);
      });
    }
  });
}

async function injectMods(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as musterMod from "/src/utils/musterCallProcessor.js";
      import * as vkbMod from "/src/utils/veteranKnowledgeBase.js";
      import * as profileMod from "/src/utils/veteranProfile.js";
      window.__verifyMods = { musterMod, vkbMod, profileMod };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__verifyMods), null, {
    timeout: 60_000,
  });
}

async function waitForDkbSettled(page: Page): Promise<void> {
  await page.waitForTimeout(60_000);
  await page.evaluate(async () => {
    const mods = window.__verifyMods;
    const race = (pr: Promise<unknown>, ms: number) =>
      Promise.race([pr, new Promise((r) => setTimeout(r, ms))]);
    await race(mods.vkbMod.loadVKB(), 30_000);
  });
  await page.waitForTimeout(5000);
}

async function createFileInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "__verify_file_input";
    input.style.position = "fixed";
    input.style.top = "-9999px";
    document.body.appendChild(input);
  });
}

async function processOneFile(page: Page, filePath: string) {
  await page.locator("#__verify_file_input").setInputFiles(filePath);
  const result = await page.evaluate(async () => {
    const input = document.getElementById(
      "__verify_file_input",
    ) as HTMLInputElement;
    const file = input.files?.[0];
    const mods = window.__verifyMods;
    if (!file) return { outcome: "error", errorMessage: "no file" };
    try {
      const res = await Promise.race([
        mods.musterMod.processFormationDocument(file),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("exceeded 8min budget")), 8 * 60 * 1000),
        ),
      ]);
      return {
        outcome: res.status,
        classificationType: res.classification?.type ?? null,
        extractedData: res.extractedData ?? null,
        errorMessage: res.error ?? null,
      };
    } catch (err) {
      return {
        outcome: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  });
  return result;
}

async function readTimelineDocImportCount(page: Page): Promise<{
  total: number;
  descriptions: string[];
}> {
  return page.evaluate(async () => {
    const vkb = await window.__verifyMods.vkbMod.loadVKB();
    const entries = (vkb.evidenceTimeline || []).filter(
      (e: { eventType?: string }) => e.eventType === "document_import",
    );
    return {
      total: entries.length,
      descriptions: entries.map((e: { description?: string }) => e.description ?? ""),
    };
  });
}

test.describe("Real corpus verification (scratch, not permanent)", () => {
  test("process the 4 real DD214s twice each, capture field values + timeline growth", async ({
    page,
  }) => {
    test.setTimeout(40 * 60 * 1000);
    mkdirSync(OUTPUT_DIR, { recursive: true });

    await precreateDatabases(page);
    await boot(page);
    await injectMods(page);
    await waitForDkbSettled(page);
    await createFileInput(page);

    const passResults: Record<string, unknown>[] = [];

    for (const pass of [1, 2]) {
      const passData: Record<string, unknown> = { pass };
      for (const fileName of DD214_FILES) {
        const filePath = join(CORPUS_DIR, fileName);
        // eslint-disable-next-line no-console
        console.log(`[verify] pass ${pass}: processing ${fileName}...`);
        const result = await processOneFile(page, filePath);
        passData[fileName] = result;
        writeFileSync(
          join(OUTPUT_DIR, "progress.json"),
          JSON.stringify(passResults.concat([passData]), null, 2),
          "utf-8",
        );
      }
      const timeline = await readTimelineDocImportCount(page);
      passData.timelineDocImportCount = timeline.total;
      passData.timelineDescriptions = timeline.descriptions;
      passResults.push(passData);
      writeFileSync(
        join(OUTPUT_DIR, "report.json"),
        JSON.stringify(passResults, null, 2),
        "utf-8",
      );
    }

    writeFileSync(
      join(OUTPUT_DIR, "report.json"),
      JSON.stringify(passResults, null, 2),
      "utf-8",
    );

    expect(passResults).toHaveLength(2);
  });
});
