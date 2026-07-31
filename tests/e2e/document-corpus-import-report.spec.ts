/**
 * Real document-corpus ingestion report.
 *
 * Drives the app's REAL production ingestion pipeline —
 * processFormationDocument() from src/utils/musterCallProcessor.js — against
 * every real personal document in docs/test-data/ (git-ignored, owner's own
 * files), without ever loading the AI swarm or clicking through the
 * AI-gated Muster Call "Begin Formation" UI.
 *
 * Verified before writing this spec: headless Chromium (Playwright default
 * launch, no special launchOptions) reports `navigator.gpu` as `undefined`,
 * so `isWebGPUSupported()` in src/utils/florenceOCRService.js returns false.
 * That means processSingleDocument()'s vision-primary DD214 path and its
 * OCR-confidence vision fallback both self-skip, and analyzeCFileWithAI()
 * short-circuits on `isAnyAIAvailable()` (cloud key unset, swarm/wllama never
 * initialized, local server never pinged) — extraction, classification, and
 * storage all run through the plain OCR/pdf.js + regex-classifier path with
 * zero AI/model loads, matching the task's hard constraint.
 *
 * Each real file is attached via a bare (non-Muster-Call-UI) <input
 * type="file"> using Playwright's setInputFiles — this transfers the file
 * from disk natively (no base64/JSON bridging, safe for the 313MB C-File)
 * and yields a real File object that's handed directly to
 * processFormationDocument(), exactly as CFileAnalyzer.jsx does.
 *
 * PRIVACY: only filename + extracted character COUNT + classification +
 * pass/fail is ever pulled back into Node/logs — full extracted text never
 * leaves the browser context. Screenshots (real UI, real content) and the
 * JSON report are written OUTSIDE the repo, to the scratchpad output dir.
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, extname } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

// Overridable so the same spec can be pointed at a real, entirely-outside-
// the-repo veteran document corpus (e.g. CORPUS_DIR=E:\Williams_C-FIle) while
// still defaulting to the committed docs/test-data fixture for anyone else
// who runs this test.
const CORPUS_DIR =
  process.env.CORPUS_DIR || join(process.cwd(), "docs", "test-data");
// Must stay outside the repo: screenshots and the report capture real personal
// document content. Overridable so each run can write to its own scratchpad.
const OUTPUT_DIR =
  process.env.REPORT_OUT_DIR ||
  "C:\\Users\\antho\\AppData\\Local\\Temp\\claude\\e--VS-Studio-vet-rate-org-official\\06c99292-1d1a-4e2f-99b3-bd4c7a19d0d9\\scratchpad\\doc-ingestion-report";
const REPORT_PATH = join(OUTPUT_DIR, "report.json");
const TALLY_PATH = join(OUTPUT_DIR, "vkb-tally.json");

// Same extension list as SUPPORTED_FILE_TYPES in src/utils/documentAnalyzer.js:31-57.
const SUPPORTED_EXTS = new Set([".pdf", ".docx", ".doc", ".txt", ".rtf"]);
// Same threshold musterCallProcessor.js:492 uses to route to processLargePDF.
const LARGE_FILE_BYTES = 50 * 1024 * 1024;
const NORMAL_FILE_TIMEOUT_MS = 8 * 60 * 1000;
const LARGE_FILE_TIMEOUT_MS = 25 * 60 * 1000;

interface CorpusFile {
  name: string;
  path: string;
  size: number;
  supported: boolean;
}

interface ProcessOutcome {
  fileName: string;
  sizeBytes: number;
  outcome: "complete" | "error" | "timeout" | "skipped_unsupported";
  textLength: number;
  classificationType: string | null;
  classificationConfidence: number | null;
  method: string | null;
  ocrUsed: boolean | null;
  pageCount: number | null;
  vkbSaved: boolean;
  errorMessage: string | null;
  processingMs: number | null;
}

function discoverCorpus(): CorpusFile[] {
  return readdirSync(CORPUS_DIR).map((name) => {
    const path = join(CORPUS_DIR, name);
    const size = statSync(path).size;
    return {
      name,
      path,
      size,
      supported: SUPPORTED_EXTS.has(extname(name).toLowerCase()),
    };
  });
}

function writeReport(entries: ProcessOutcome[]): void {
  writeFileSync(REPORT_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

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

// Same pre-creation workaround as tests/e2e/cfile-canonical-dataflow.spec.ts:
// opening a NEW IndexedDB database while the DKB bulk write runs was observed
// to stall indefinitely, so both target DBs are created on a static page first.
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
      import * as pktMod from "/src/utils/myPacketManager.js";
      import * as profileMod from "/src/utils/veteranProfile.js";
      window.__verifyMods = { musterMod, vkbMod, pktMod, profileMod };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__verifyMods), null, {
    timeout: 60_000,
  });
}

// Same DKB-auto-download settle window as cfile-canonical-dataflow.spec.ts.
async function waitForDkbSettled(page: Page): Promise<void> {
  await page.waitForTimeout(60_000);
  await page.evaluate(async () => {
    const mods = window.__verifyMods;
    const race = (pr: Promise<unknown>, ms: number) =>
      Promise.race([pr, new Promise((r) => setTimeout(r, ms))]);
    await race(mods.vkbMod.loadVKB(), 30_000);
    await race(mods.pktMod.getAllPacketDocuments(), 30_000);
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

interface BrowserOutcome {
  outcome: "complete" | "error";
  textLength: number;
  classificationType: string | null;
  classificationConfidence: number | null;
  method: string | null;
  ocrUsed: boolean | null;
  pageCount: number | null;
  vkbSaved: boolean;
  errorMessage: string | null;
}

async function processOneFile(
  page: Page,
  filePath: string,
  timeoutMs: number,
): Promise<{ result: BrowserOutcome; elapsedMs: number }> {
  await page.locator("#__verify_file_input").setInputFiles(filePath);

  const started = Date.now();
  const result = await page.evaluate(
    async ({ ms }: { ms: number }) => {
      const input = document.getElementById(
        "__verify_file_input",
      ) as HTMLInputElement;
      const file = input.files?.[0];
      const mods = window.__verifyMods;
      if (!file) {
        return {
          outcome: "error" as const,
          textLength: 0,
          classificationType: null,
          classificationConfidence: null,
          method: null,
          ocrUsed: null,
          pageCount: null,
          vkbSaved: false,
          errorMessage: "no File attached to input",
        };
      }
      try {
        const res = await Promise.race([
          mods.musterMod.processFormationDocument(file),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`exceeded ${ms}ms budget`)), ms),
          ),
        ]);
        return {
          outcome: res.status === "complete" ? "complete" : "error",
          textLength: res.text ? res.text.length : 0,
          classificationType: res.classification?.type ?? null,
          classificationConfidence: res.classification?.confidence ?? null,
          method: res.method ?? null,
          ocrUsed: typeof res.ocrUsed === "boolean" ? res.ocrUsed : null,
          pageCount: res.pageCount ?? null,
          vkbSaved: !!res.vkbSaved,
          errorMessage: res.error ?? null,
        };
      } catch (err) {
        return {
          outcome: "error" as const,
          textLength: 0,
          classificationType: null,
          classificationConfidence: null,
          method: null,
          ocrUsed: null,
          pageCount: null,
          vkbSaved: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    },
    { ms: timeoutMs },
  );
  const elapsedMs = Date.now() - started;
  const timedOut = result.errorMessage?.includes("exceeded") ?? false;
  return {
    result: { ...result, outcome: timedOut ? "error" : result.outcome },
    elapsedMs,
  };
}

interface VkbTally {
  dd214s: number;
  blueButtonReports: number;
  cFiles: number;
  privateRecords: number;
  otherEvidence: number;
  total: number;
}

async function readVkbTally(page: Page): Promise<VkbTally> {
  return page.evaluate(async () => {
    const byCat: Record<string, unknown> =
      await window.__verifyMods.vkbMod.getAllDocumentsByCategory();
    const count = (k: string): number => {
      const entry = byCat?.[k] as { count?: unknown } | undefined;
      return typeof entry?.count === "number" ? entry.count : 0;
    };
    const dd214s = count("dd214s");
    const blueButtonReports = count("blueButtonReports");
    const cFiles = count("cFiles");
    const privateRecords = count("privateRecords");
    const otherEvidence = count("otherEvidence");
    return {
      dd214s,
      blueButtonReports,
      cFiles,
      privateRecords,
      otherEvidence,
      total:
        dd214s + blueButtonReports + cFiles + privateRecords + otherEvidence,
    };
  });
}

interface ServiceAndTimelineState {
  dd214DataPopulatedFields: string[];
  evidenceTimelineLength: number;
  // history.awards (veteranProfile.js localStorage) — feeds the Ribbon Rack
  // (RibbonRackSection in MyPacket.jsx). Deduped via addAward().
  awardsCount: number;
  awardNames: string[];
  // vkb.serviceHistory.awards (IndexedDB VKB) — feeds every AI tool via
  // getVeteranAIContext()/generateLLMContext(). Deduped separately via
  // mergeDD214Awards' own fuzzy match inside mergeDD214IntoVKB. A different
  // array in a different store than awardsCount/awardNames above — both are
  // reported so a real duplicate in either store is independently visible.
  vkbAwardsCount: number;
  vkbAwardNames: string[];
}

// Fields that are non-empty regardless of whether real DD214 field parsing
// found anything, so they don't prove real extraction happened and are
// excluded from the "populated fields" signal below. reenlisted/
// foreignService are `!!undefined` -> false, sensitiveDataStored is a
// computed boolean, dateProcessed is `new Date().toISOString()`, dd214Count
// defaults to 1, confidence defaults to 0 — all from _sanitizeDd214Data
// (veteranProfile.js). extractedText is a raw passthrough of the document's
// extracted text (musterCallProcessor.js's buildDD214ProfileUpdate) and is
// always non-empty by construction — processSingleDocument throws before
// reaching this save if extraction produced no text at all.
const DD214_ALWAYS_DEFAULTED_FIELDS = new Set([
  "reenlisted",
  "foreignService",
  "sensitiveDataStored",
  "dateProcessed",
  "dd214Count",
  "confidence",
  "extractedText",
]);

async function readServiceAndTimelineState(
  page: Page,
): Promise<ServiceAndTimelineState> {
  return page.evaluate(
    async ({ alwaysDefaultedFields }: { alwaysDefaultedFields: string[] }) => {
      const mods = window.__verifyMods;
      const serviceHistory = mods.profileMod.getServiceHistory();
      const dd214Data = serviceHistory?.dd214Data || null;
      const dd214DataPopulatedFields = dd214Data
        ? Object.entries(dd214Data)
            .filter(([k]) => !alwaysDefaultedFields.includes(k))
            .filter(
              ([, v]) =>
                v !== null &&
                v !== undefined &&
                v !== "" &&
                !(Array.isArray(v) && v.length === 0),
            )
            .map(([k]) => k)
        : [];
      const vkb = await mods.vkbMod.loadVKB();
      const evidenceTimelineLength = Array.isArray(vkb.evidenceTimeline)
        ? vkb.evidenceTimeline.length
        : 0;
      const awards = Array.isArray(serviceHistory?.awards)
        ? serviceHistory.awards
        : [];
      const vkbAwards = Array.isArray(vkb.serviceHistory?.awards)
        ? vkb.serviceHistory.awards
        : [];
      return {
        dd214DataPopulatedFields,
        evidenceTimelineLength,
        awardsCount: awards.length,
        awardNames: awards.map((a: { name?: string }) => a.name ?? ""),
        vkbAwardsCount: vkbAwards.length,
        vkbAwardNames: vkbAwards.map((a: { name?: string }) => a.name ?? ""),
      };
    },
    { alwaysDefaultedFields: [...DD214_ALWAYS_DEFAULTED_FIELDS] },
  );
}

async function screenshotMyPacketTabs(page: Page): Promise<string[]> {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  await dismissDisclaimer(page);

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openMyPacket")),
  );
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, "MyPacket modal should open").toBeVisible({
    timeout: 15_000,
  });

  const tabButtons = dialog.locator('nav[aria-label="Tabs"] button');
  const count = await tabButtons.count();
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const btn = tabButtons.nth(i);
    const label = (await btn.innerText().catch(() => `tab${i}`))
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    await btn.click().catch(() => {});
    await page.waitForTimeout(700);
    if (/service/i.test(label)) {
      const ribbonRackToggle = dialog.getByRole("button", {
        name: /view ribbon rack/i,
      });
      if (await ribbonRackToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await ribbonRackToggle.click().catch(() => {});
        await page.waitForTimeout(700);
      }
    }
    const screenshotPath = join(OUTPUT_DIR, `mypacket-${i}-${label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    paths.push(screenshotPath);
  }
  return paths;
}

test.describe("Real document corpus ingestion report", () => {
  test("processFormationDocument over docs/test-data → VKB + My Packet", async ({
    page,
  }) => {
    test.setTimeout(45 * 60 * 1000);

    mkdirSync(OUTPUT_DIR, { recursive: true });

    const corpus = discoverCorpus();
    const supported = corpus.filter((f) => f.supported);
    const unsupported = corpus.filter((f) => !f.supported);

    const outcomes: ProcessOutcome[] = unsupported.map((f) => ({
      fileName: f.name,
      sizeBytes: f.size,
      outcome: "skipped_unsupported",
      textLength: 0,
      classificationType: null,
      classificationConfidence: null,
      method: null,
      ocrUsed: null,
      pageCount: null,
      vkbSaved: false,
      errorMessage: null,
      processingMs: null,
    }));
    writeReport(outcomes);

    await precreateDatabases(page);
    await boot(page);
    await injectMods(page);
    await waitForDkbSettled(page);
    await createFileInput(page);

    for (const entry of supported) {
      const timeoutMs =
        entry.size > LARGE_FILE_BYTES
          ? LARGE_FILE_TIMEOUT_MS
          : NORMAL_FILE_TIMEOUT_MS;
      // eslint-disable-next-line no-console
      console.log(
        `[doc-corpus] processing ${entry.name} (${entry.size} bytes, budget ${timeoutMs}ms)...`,
      );
      const { result, elapsedMs } = await processOneFile(
        page,
        entry.path,
        timeoutMs,
      );
      outcomes.push({
        fileName: entry.name,
        sizeBytes: entry.size,
        outcome: result.outcome,
        textLength: result.textLength,
        classificationType: result.classificationType,
        classificationConfidence: result.classificationConfidence,
        method: result.method,
        ocrUsed: result.ocrUsed,
        pageCount: result.pageCount,
        vkbSaved: result.vkbSaved,
        errorMessage: result.errorMessage,
        processingMs: elapsedMs,
      });
      writeReport(outcomes);
      // eslint-disable-next-line no-console
      console.log(
        `[doc-corpus] ${entry.name} -> ${result.outcome} (${elapsedMs}ms, ${result.textLength} chars, type=${result.classificationType})`,
      );
    }

    const tally = await readVkbTally(page);
    writeFileSync(TALLY_PATH, JSON.stringify(tally, null, 2), "utf-8");

    const completedBeforeAssertions = outcomes.filter(
      (o) => o.outcome === "complete",
    ).length;
    const serviceAndTimeline = await readServiceAndTimelineState(page);
    writeFileSync(
      join(OUTPUT_DIR, "service-and-timeline.json"),
      JSON.stringify(serviceAndTimeline, null, 2),
      "utf-8",
    );
    expect(
      serviceAndTimeline.dd214DataPopulatedFields.length,
      "Service tab (getServiceHistory().dd214Data) should have at least one field populated by real extraction (sanitizer-default-only fields excluded) after a real DD214 import",
    ).toBeGreaterThan(0);
    expect(
      serviceAndTimeline.evidenceTimelineLength,
      "Timeline tab (vkb.evidenceTimeline) should have one entry per completed document",
    ).toBeGreaterThanOrEqual(completedBeforeAssertions);
    expect(
      new Set(serviceAndTimeline.awardNames).size,
      "Ribbon Rack (history.awards) should not contain the same award name twice, even when multiple source documents describe the same career",
    ).toBe(serviceAndTimeline.awardNames.length);
    expect(
      new Set(serviceAndTimeline.vkbAwardNames).size,
      "VKB (vkb.serviceHistory.awards) should not contain the same award name twice either — a separate store from history.awards with its own dedup",
    ).toBe(serviceAndTimeline.vkbAwardNames.length);

    const screenshotPaths = await screenshotMyPacketTabs(page);
    writeFileSync(
      join(OUTPUT_DIR, "screenshot-paths.json"),
      JSON.stringify(screenshotPaths, null, 2),
      "utf-8",
    );

    const completed = outcomes.filter((o) => o.outcome === "complete").length;
    expect(
      completed,
      "at least one real document should process end to end",
    ).toBeGreaterThan(0);
    expect(
      tally.total,
      "VKB document tally should reflect stored documents",
    ).toBeGreaterThanOrEqual(completed);
  });
});
