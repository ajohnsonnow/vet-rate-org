/**
 * D16-7: DKB (Diamond Knowledge Base) relevance scoring during a large
 * C-File import must never block the panic key or Quick Exit.
 *
 * Root cause (measured live against the real corpus, public/data/
 * diamond_knowledge.json, 7,988 entries, before this fix): musterCallProcessor.js's
 * analyzeCFileWithAI hands unifiedAIService.js's generateAI a ~15,000-
 * character raw C-File excerpt as the prompt. That flows straight through
 * to aiSystemPrompts.js's searchDKB as the search "query" - thousands of
 * query terms, scored against every DKB entry with a plain substring scan,
 * entirely synchronously, on the main thread, once per document import.
 * That single call measured 3.4-4.0s against the real corpus - long enough
 * to make the panic key (triple-Escape) and Quick Exit visibly unresponsive
 * for the duration.
 *
 * This spec drives the real production pipeline
 * (processFormationDocument, from musterCallProcessor.js - the same
 * function CFileAnalyzer.jsx/Muster Call's UI calls) against a synthetic,
 * PII-free, ~520-"page" C-File-shaped text document, large enough to
 * classify as C_FILE_MEDICAL and take the segmented-C-File path
 * (buildSegmentedCFileResult -> analyzeCFileWithAI) - see
 * CFILE_SEGMENTATION_MIN_PAGES/CONSOLIDATED_FILE_MIN_PAGES in
 * musterCallProcessor.js/documentClassifier.js. Classification verified
 * live before writing this spec (Node import of documentClassifier.js
 * against this exact fixture: C_FILE_MEDICAL, confidence 84).
 *
 * The AI backend is the deterministic e2e fake (tests/e2e/fakes/web-llm.fake.js,
 * aliased in under `--mode e2e` - see playwright.config.ts), loaded via the
 * same real "Load AI" button muster-call-ai-panic.spec.ts uses, so
 * isAnyAIAvailable() is genuinely true and analyzeCFileWithAI does not
 * short-circuit. The import itself runs on a bare <input type="file">
 * (document-corpus-import-report.spec.ts's technique) rather than through
 * the Muster Call dialog, so what's being measured is the panic key's
 * global handler, not the dialog's own Escape-closes-dialog behavior.
 *
 * Fire-and-forget, like advanced-ocr-perf.spec.ts's background-preprocessing
 * tests: the page navigates away before processFormationDocument ever
 * resolves in the passing case, so nothing here waits for the import to
 * finish.
 */
import { readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const MUSTER_CALL_DIALOG_SELECTOR = '[aria-labelledby="muster-call-title"]';
const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

// See this file's doc comment: measured 3.4-4.0s on base for the DKB call
// alone, vs. D16-7's own target of 500ms/1000ms. Both triggers sit well
// below "still broken" and well above "fixed", so this fails loudly on base
// and passes with margin after the fix - not a coin-flip threshold.
const PANIC_KEY_LATENCY_TRIGGER_1X_MS = 500;
const PANIC_KEY_LATENCY_TRIGGER_4X_MS = 1000;

const SYNTHETIC_WORDS = [
  "service",
  "connection",
  "ptsd",
  "tinnitus",
  "knee",
  "pain",
  "examination",
  "diagnosis",
  "rating",
  "veteran",
  "disability",
  "claim",
  "medical",
  "record",
  "treatment",
  "chronic",
  "condition",
  "nexus",
  "opinion",
  "evidence",
  "deployment",
  "combat",
  "exposure",
  "hearing",
  "loss",
  "back",
  "shoulder",
  "anxiety",
  "depression",
  "sleep",
  "apnea",
  "migraine",
  "headache",
  "doctor",
  "physician",
  "clinic",
  "hospital",
  "notes",
  "findings",
  "history",
  "symptom",
  "injury",
  "surgery",
];

// Deterministic pseudo-random paragraph generator - no Math.random, so the
// fixture (and its classification) is reproducible across runs. Same shape
// as the pattern already used in advanced-ocr-perf.spec.ts's synthetic
// canvas builder.
function buildSyntheticCFileText(pages: number): string {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const paragraph = () => {
    const wordCount = 60 + Math.floor(rand() * 40);
    let text = "";
    for (let i = 0; i < wordCount; i++) {
      text +=
        SYNTHETIC_WORDS[Math.floor(rand() * SYNTHETIC_WORDS.length)] + " ";
    }
    return text;
  };

  let text = "";
  for (let page = 1; page <= pages; page++) {
    text += `--- PAGE ${page} of ${pages} ---\n`;
    text += `VA MEDICAL CENTER\nPROGRESS NOTE\nCHIEF COMPLAINT: ${paragraph()}\n`;
    text += `PHYSICAL EXAMINATION: ${paragraph()}\n`;
    text += `ASSESSMENT AND PLAN: ${paragraph()}\n\n`;
  }
  return text;
}

// test-results/ is already gitignored (see playwright.config.ts's
// downloadsPath comment) - the fixture is generated here rather than
// committed so a ~1MB synthetic file never lands in the repo.
function writeFixtureFile(): string {
  const dir = join(process.cwd(), "test-results", "dkb-import-latency");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "synthetic-large-cfile.txt");
  writeFileSync(filePath, buildSyntheticCFileText(520));
  return filePath;
}

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

async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

// Same DB pre-creation workaround as cfile-canonical-dataflow.spec.ts and
// document-corpus-import-report.spec.ts: opening a NEW IndexedDB database
// while a DKB/VKB bulk write runs was observed to stall indefinitely.
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
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function loadFakeAI(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openMusterCall")),
  );
  await page
    .locator(MUSTER_CALL_DIALOG_SELECTOR)
    .waitFor({ state: "visible", timeout: 10000 });

  await page.getByRole("button", { name: /load ai/i }).click();
  await page
    .getByText(/CW5 Auditor ready/i)
    .waitFor({ state: "visible", timeout: 20000 });

  // First Escape closes the Muster Call dialog (not a panic-key press) -
  // see muster-call-ai-panic.spec.ts's own "Owner decision C" comment.
  await page.keyboard.press("Escape");
  await page
    .locator(MUSTER_CALL_DIALOG_SELECTOR)
    .waitFor({ state: "hidden", timeout: 5000 });
}

async function injectMusterCallProcessor(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as musterMod from "/src/utils/musterCallProcessor.js";
      import * as aiPrompts from "/src/utils/aiSystemPrompts.js";
      window.__dkbLatencyMods = { musterMod, aiPrompts };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__dkbLatencyMods), null, {
    timeout: 60_000,
  });
}

// Without this, the DKB fetch (public/data/diamond_knowledge.json, ~8MB) is
// still in flight - genuine async I/O, which DOES yield the main thread -
// when Escape/Quick Exit get pressed, so they succeed for an uninteresting
// reason (nothing is blocking yet) on BOTH base and fixed code, regardless
// of whether the scoring bug this spec targets is fixed. Verified live:
// without this prime, the "1x" tests below measure ~50-90ms on base too -
// a false pass. Priming first (and awaiting it fully) means the cache is
// warm by the time analyzeCFileWithAI's own searchDKB call runs, so its
// `await loadDKB()` resolves via microtask (not a real fetch yield) and the
// scoring that follows runs immediately - on base, synchronously and
// unyielded for several seconds; on fixed code, chunked/indexed and fast.
// This also matches real usage: DKB is realistically already warm by the
// time a veteran runs a large import, from any earlier AI-backed action.
async function primeDKBCache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__dkbLatencyMods.aiPrompts.searchDKB("priming query", 1);
  });
}

async function createFileInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "__dkb_latency_file_input";
    input.style.position = "fixed";
    input.style.top = "-9999px";
    document.body.appendChild(input);
  });
}

// Real signal, not a guessed delay: analyzeCFileWithAI (musterCallProcessor.js)
// logs this exact line immediately before calling generateAI, the call that
// reaches searchDKB. Waiting for the console message (a real, observable
// event - not a fixed timeout) means Escape/Quick Exit get pressed right as
// that call is about to start, on both base and fixed code, without a
// guess at how long extraction/classification/segmentation take first.
const AI_ANALYSIS_STARTING_LOG = "Starting AI-enhanced C-File analysis";

// The console signal proves we're past extraction/classification/
// segmentation (the variable-duration part), but analyzeCFileWithAI's log
// line fires a few steps before its generateAI call actually reaches
// searchDKB (circuit-breaker/feature-flag/crisis-scan checks, mode
// resolution, system-prompt assembly - all fast and bounded, measured
// under 50ms combined at 1x). Verified live: without this buffer, Escape/
// Quick Exit sometimes still won the race against that short remainder on
// base code too, an intermittent false pass. bufferMs bridges that known,
// bounded gap - scaled by cpuRate since CPU throttling slows it too.
async function startBackgroundImport(
  page: Page,
  filePath: string,
  cpuRate: number,
): Promise<void> {
  const aiCallStarting = page.waitForEvent("console", {
    predicate: (msg) => msg.text().includes(AI_ANALYSIS_STARTING_LOG),
    timeout: 30_000,
  });

  await page.locator("#__dkb_latency_file_input").setInputFiles(filePath);
  await page.evaluate(() => {
    const input = document.getElementById(
      "__dkb_latency_file_input",
    ) as HTMLInputElement;
    const file = input.files?.[0];
    const mods = window.__dkbLatencyMods;
    if (!file || !mods) return;
    mods.musterMod.processFormationDocument(file).catch(() => {});
  });

  await aiCallStarting;
  await page.waitForTimeout(150 * cpuRate);
}

async function measureKeydownToNavigation(page: Page): Promise<number> {
  const start = Date.now();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return Date.now() - start;
}

async function measureClickToNavigation(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const start = Date.now();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return Date.now() - start;
}

// shimFakeGpuAdapter's addInitScript must be registered before the FIRST
// navigation of the page's lifetime to apply to every document it creates
// (Playwright's addInitScript only affects navigations after it was added) -
// so this must run before seedReturningUser/precreateDatabases's own gotos,
// not just before the final "/" load.
async function prepareImportReadyPage(page: Page): Promise<void> {
  await shimFakeGpuAdapter(page);
  await seedReturningUser(page);
  await precreateDatabases(page);
  await loadFakeAI(page);
  await injectMusterCallProcessor(page);
  await createFileInput(page);
  await primeDKBCache(page);
}

test.describe("D16-7: DKB scoring during a large C-File import never blocks the panic key", () => {
  test.skip(
    ({ isMobile }) => !!isMobile,
    "Warrant Council AI (fake or real) is desktop/laptop-only by device-tier design - see muster-call-ai-panic.spec.ts",
  );

  test("triple-Escape still redirects promptly while a large C-File import is actively running (1x)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixturePath = writeFixtureFile();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    await startBackgroundImport(page, fixturePath, 1);
    const latencyMs = await measureKeydownToNavigation(page);
    // eslint-disable-next-line no-console
    console.log(`[dkb-latency] triple-Escape during import: ${latencyMs}ms`);

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_1X_MS);
  });

  test("Quick Exit still redirects promptly while a large C-File import is actively running (1x)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixturePath = writeFixtureFile();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    await startBackgroundImport(page, fixturePath, 1);
    const latencyMs = await measureClickToNavigation(page, box);
    // eslint-disable-next-line no-console
    console.log(`[dkb-latency] Quick Exit during import: ${latencyMs}ms`);

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_1X_MS);
  });

  test("triple-Escape still redirects within budget under a 4x CPU throttle", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "CPU throttling is a Chromium CDP feature (Emulation.setCPUThrottlingRate).",
    );
    test.setTimeout(120_000);
    const fixturePath = writeFixtureFile();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await startBackgroundImport(page, fixturePath, 4);
    const latencyMs = await measureKeydownToNavigation(page);
    // eslint-disable-next-line no-console
    console.log(
      `[dkb-latency] triple-Escape during import (4x): ${latencyMs}ms`,
    );

    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_4X_MS);
  });
});
