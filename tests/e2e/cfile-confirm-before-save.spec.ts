import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * D22-4 (owner rule F): the C-File Analyzer saves nothing until the veteran
 * chooses Save to my records. Generic fixture only. The cloud endpoint is
 * stubbed and never called (cloud-only configuration, so the built-in
 * documented-term scan produces the findings), no real provider runs.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const CLOUD_KEY = "AIzaSyE2EFAKEKEY00000000000000000000";
const CFILE_DIALOG = '[role="dialog"][aria-labelledby="cfile-analyzer-title"]';
const CONSENT_DIALOG = '[role="dialog"][aria-labelledby="cfile-privacy-title"]';

const LETTER_LINES = [
  "CODE SHEET",
  "",
  "5237 - Lumbosacral Strain 20%",
  "6260 - Tinnitus 10%",
  "Combined: 30%",
  "",
  "This rating summary reflects the veteran's currently service-connected",
  "conditions as of the most recent rating decision on file.",
];

async function makePdf(lines: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => {
    if (line) page.drawText(line, { x: 50, y: 740 - i * 16, size: 11, font });
  });
  return Buffer.from(await pdfDoc.save());
}

async function boot(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (local) return route.continue();
    if (url.hostname.includes("generativelanguage")) {
      return route.fulfill({ status: 500, body: "stub" });
    }
    return route.abort("blockedbyclient");
  });
  await page.addInitScript(
    ({ version, key }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_gemini_key", key);
    },
    { version: APP_VERSION, key: CLOUD_KEY },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openCFileAnalyzer")),
  );
  await page.locator(CFILE_DIALOG).waitFor({ state: "visible" });
}

async function dropAndAnalyze(page: Page): Promise<void> {
  const dialog = page.locator(CFILE_DIALOG);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "generic-letter.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(LETTER_LINES),
  });
  await dialog.getByRole("button", { name: /Analyze My C-File/i }).click();
  const consent = page.locator(CONSENT_DIALOG);
  await consent.waitFor({ state: "visible" });
  await consent
    .getByRole("button", { name: /I Understand - Start Analysis/i })
    .click();
  await expect(dialog.getByTestId("cfile-save-to-records")).toBeVisible({
    timeout: 45000,
  });
}

interface StorageSnapshot {
  local: Record<string, string | null>;
  idb: Record<string, unknown>;
}

async function snapshotStorage(page: Page): Promise<string> {
  const snap = await page.evaluate(async (): Promise<StorageSnapshot> => {
    const local: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) as string;
      local[k] = localStorage.getItem(k);
    }
    const idb: Record<string, unknown> = {};
    const dbs = (await indexedDB.databases()) || [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const stores: Record<string, unknown> = {};
      for (const name of Array.from(db.objectStoreNames)) {
        stores[name] = await new Promise((res, rej) => {
          const r = db.transaction(name, "readonly").objectStore(name).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      db.close();
      idb[`${info.name}@${info.version}`] = stores;
    }
    return { local, idb };
  });
  return JSON.stringify(snap);
}

async function packetRecordCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const dbs = (await indexedDB.databases()) || [];
    let total = 0;
    for (const info of dbs) {
      if (!info.name || !/packet/i.test(info.name)) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      if (db.objectStoreNames.contains("documents")) {
        total += await new Promise<number>((res, rej) => {
          const r = db
            .transaction("documents", "readonly")
            .objectStore("documents")
            .count();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      db.close();
    }
    return total;
  });
}

async function vkbCounts(
  page: Page,
): Promise<{ claims: number; evidence: number; documents: number }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open("VetRateVKB");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const vkb = await new Promise<Record<string, unknown>>((res, rej) => {
      const r = db
        .transaction("knowledge_base", "readonly")
        .objectStore("knowledge_base")
        .get("main");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    const documentation = (vkb.documentation || {}) as Record<
      string,
      unknown[]
    >;
    return {
      claims: ((vkb.claims as unknown[]) || []).length,
      evidence: ((vkb.evidence as unknown[]) || []).length,
      documents: Object.values(documentation).reduce(
        (n, list) => n + list.length,
        0,
      ),
    };
  });
}

test.describe("C-File Analyzer: nothing is saved until the veteran confirms", () => {
  test("drop, analyze, close leaves localStorage and IndexedDB unchanged", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await boot(page);
    const before = await snapshotStorage(page);

    await dropAndAnalyze(page);
    const dialog = page.locator(CFILE_DIALOG);
    await expect(dialog.getByText(/Nothing has been saved yet/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Save to my records" }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: /Close C-File/i }).click();
    await expect(dialog).toBeHidden();

    expect(await snapshotStorage(page)).toBe(before);
  });

  test("save files the document once and saving again adds nothing", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await boot(page);
    const packetBefore = await packetRecordCount(page);

    await dropAndAnalyze(page);
    const dialog = page.locator(CFILE_DIALOG);
    expect(await packetRecordCount(page)).toBe(packetBefore);

    const panel = dialog.getByTestId("cfile-save-to-records");
    const save = panel.getByRole("button", { name: "Save to my records" });
    await save.click();
    await expect(panel).toHaveAttribute("data-saves", "1");
    expect(await packetRecordCount(page)).toBe(packetBefore + 1);
    const first = await vkbCounts(page);
    expect(first.claims).toBeGreaterThan(0);
    expect(first.documents).toBe(1);

    await save.click();
    await expect(panel).toHaveAttribute("data-saves", "2");
    expect(await packetRecordCount(page)).toBe(packetBefore + 1);
    expect(await vkbCounts(page)).toEqual(first);

    await dialog.getByRole("button", { name: /Analyze Another/i }).click();
    await dropAndAnalyze(page);
    await panel.getByRole("button", { name: "Save to my records" }).click();
    await expect(panel).toHaveAttribute("data-saves", "1");
    expect(await packetRecordCount(page)).toBe(packetBefore + 1);
    expect(await vkbCounts(page)).toEqual(first);
  });
});
