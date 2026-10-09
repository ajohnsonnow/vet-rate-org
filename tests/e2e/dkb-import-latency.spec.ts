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
import {
  armPanicGesture,
  armPanicTiming,
  measureClickToNavigation,
  measureKeydownToNavigation,
} from "./panic-latency-timing";

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

async function fireBackgroundImport(
  page: Page,
  filePath: string,
): Promise<void> {
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
}

// Real, observable signal (pod rule: "condition-based waits only in e2e" -
// a fixed `waitForTimeout` buffer here was flagged as a violation).
// aiSystemPrompts.js's searchDKB logs this exact line as its first
// statement. Warm-path anchor only - see startColdBackgroundImport for why
// this signal is unsafe to use before the DKB cache is primed.
const DKB_SEARCH_CALLED_LOG = "[DKB] 🔍 searchDKB called";

// With the DKB already primed (see primeDKBCache), loadDKBIndex resolves
// with no fetch/build in between - only a microtask, which does not yield
// to pending input - so scoring starts essentially synchronously right
// after this fires. Pressing keys right here means the race is against
// the scoring loops themselves, on both broken and fixed code.
async function startPrimedBackgroundImport(
  page: Page,
  filePath: string,
): Promise<void> {
  const searchStarting = page.waitForEvent("console", {
    predicate: (msg) => msg.text().includes(DKB_SEARCH_CALLED_LOG),
    timeout: 30_000,
  });
  await fireBackgroundImport(page, filePath);
  await searchStarting;
}

// Cold-cache path (D16-7 follow-up): DKB_SEARCH_CALLED_LOG fires before the
// ~8MB diamond_knowledge.json fetch even starts, and that fetch is genuine
// async I/O that DOES yield the main thread - pressing keys that early
// risks navigating away during the fetch's own idle gap regardless of
// whether buildDKBIndex's chunking is broken, the same false-pass failure
// mode primeDKBCache's doc comment describes for the original bug. Waiting
// for the fetch response instead (tried first - see this fix's commit)
// fires before the response body finishes arriving, so it bakes irrelevant
// network-transfer wall time into the same budget the primed tests use - a
// false FAILURE on correct code. dkbSearchIndex.js's buildDKBIndex logs
// DKB_INDEX_BUILDING_LOG as its first statement - by construction, that is
// after the fetch/JSON-parse (both already resolved) and before any of
// buildDKBIndex's own chunked work, so this anchor has neither problem.
const DKB_INDEX_BUILDING_LOG = "[DKB] 🔧 buildDKBIndex starting";

async function startColdBackgroundImport(
  page: Page,
  filePath: string,
): Promise<void> {
  const indexBuilding = page.waitForEvent("console", {
    predicate: (msg) => msg.text().includes(DKB_INDEX_BUILDING_LOG),
    timeout: 30_000,
  });
  await fireBackgroundImport(page, filePath);
  await indexBuilding;
}

// shimFakeGpuAdapter's addInitScript must be registered before the FIRST
// navigation of the page's lifetime to apply to every document it creates
// (Playwright's addInitScript only affects navigations after it was added) -
// so this must run before seedReturningUser/precreateDatabases's own gotos,
// not just before the final "/" load.
//
// primeCache defaults to true (matches D16-7's original scenario: DKB
// realistically already warm from an earlier AI-backed action). Passing
// false reproduces the OTHER realistic scenario - a veteran whose first
// AI-backed action in the session is the large import itself, so the DKB
// fetch and buildDKBIndex construction land inside the import - see
// startColdBackgroundImport.
async function prepareImportReadyPage(
  page: Page,
  { primeCache = true }: { primeCache?: boolean } = {},
): Promise<void> {
  await armPanicTiming(page);
  await shimFakeGpuAdapter(page);
  await seedReturningUser(page);
  await precreateDatabases(page);
  await loadFakeAI(page);
  await injectMusterCallProcessor(page);
  await createFileInput(page);
  if (primeCache) await primeDKBCache(page);
  await armPanicGesture(page);
}

async function withCPUThrottle(
  page: Page,
  rate: number,
  fn: () => Promise<void>,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate });
  try {
    await fn();
  } finally {
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
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

    await startPrimedBackgroundImport(page, fixturePath);
    const latencyMs = await measureKeydownToNavigation(page);
    process.stdout.write(
      `[dkb-latency] triple-Escape during import: ${latencyMs}ms\n`,
    );

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

    await startPrimedBackgroundImport(page, fixturePath);
    const latencyMs = await measureClickToNavigation(page, box);
    process.stdout.write(
      `[dkb-latency] Quick Exit during import: ${latencyMs}ms\n`,
    );

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

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startPrimedBackgroundImport(page, fixturePath);
      latencyMs = await measureKeydownToNavigation(page);
    });
    process.stdout.write(
      `[dkb-latency] triple-Escape during import (4x): ${latencyMs}ms\n`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_4X_MS);
  });

  test("Quick Exit still redirects within budget under a 4x CPU throttle", async ({
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

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startPrimedBackgroundImport(page, fixturePath);
      latencyMs = await measureClickToNavigation(page, box);
    });
    process.stdout.write(
      `[dkb-latency] Quick Exit during import (4x): ${latencyMs}ms\n`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_4X_MS);
  });
});

test.describe("D16-7 follow-up: DKB index construction on a COLD cache never blocks the panic key", () => {
  // Both tests below measure wall-clock time across the real ~1.1-1.5s
  // buildDKBIndex pass (cold cache, unlike the primed tests above, which
  // never run it during their measured window) - CPU-bound work that is
  // sensitive to contention from other tests' Chromium instances running
  // at the same time under this suite's `fullyParallel: true`. Measured
  // live: the same two tests that pass at 61-185ms under `--workers=1`
  // read up to 1,385ms when run alongside each other and the primed
  // describe block's tests. Serializing just this block (not a suite-wide
  // change) keeps the two CPU-heavy tests from ever overlapping each
  // other while leaving the lighter primed tests free to run in parallel.
  test.describe.configure({ mode: "serial" });

  test.skip(
    ({ isMobile }) => !!isMobile,
    "Warrant Council AI (fake or real) is desktop/laptop-only by device-tier design - see muster-call-ai-panic.spec.ts",
  );

  // Unlike the describe block above, this deliberately does NOT prime the
  // DKB cache first - see prepareImportReadyPage's doc comment. This is
  // the only coverage of buildDKBIndex's own chunking (dkbSearchIndex.js) -
  // the primed tests above never run it during their measured window.
  test("triple-Escape still redirects promptly on a cold DKB cache during a large C-File import (1x)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixturePath = writeFixtureFile();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page, { primeCache: false });

    await startColdBackgroundImport(page, fixturePath);
    const latencyMs = await measureKeydownToNavigation(page);
    process.stdout.write(
      `[dkb-latency] triple-Escape during a cold-cache import: ${latencyMs}ms\n`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_1X_MS);
  });

  test("Quick Exit still redirects promptly on a cold DKB cache during a large C-File import (1x)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const fixturePath = writeFixtureFile();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page, { primeCache: false });

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    await startColdBackgroundImport(page, fixturePath);
    const latencyMs = await measureClickToNavigation(page, box);
    process.stdout.write(
      `[dkb-latency] Quick Exit during a cold-cache import: ${latencyMs}ms\n`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_1X_MS);
  });
});
