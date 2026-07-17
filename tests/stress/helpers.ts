import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { test, expect, Page, BrowserContext, TestInfo } from "@playwright/test";
import { dismissDisclaimer } from "../e2e/helpers";

export const CORPUS_DIR = "E:/Johnson_C-FIle";
export const CFILE_PDF = join(CORPUS_DIR, "JOHNSON 5706 .pdf");

export type StressMode = "webgpu" | "wasm" | "extract";

export const STRESS_MODE: StressMode = (() => {
  const raw = process.env.STRESS_MODE ?? "webgpu";
  if (raw !== "webgpu" && raw !== "wasm" && raw !== "extract") {
    throw new Error(
      `Unknown STRESS_MODE "${raw}" — expected webgpu | wasm | extract`,
    );
  }
  return raw;
})();

/** Generous: first runs download multi-GB models (swarm, wllama, Florence-2). */
export const AI_LOAD_TIMEOUT = 900_000;

export const HEAP_LIMIT_BYTES = 1.5 * 1024 * 1024 * 1024;
export const DOM_NODE_LIMIT = 100_000;
const SAMPLE_INTERVAL_MS = 5_000;

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/** Gate every stress test: explicit opt-in plus the real corpus on disk. */
export function skipUnlessStress(): void {
  test.skip(process.env.STRESS !== "1", "stress harness — run with STRESS=1");
  test.skip(!existsSync(CFILE_PDF), `corpus not found: ${CFILE_PDF}`);
}

/**
 * Returning-user boot fixture (same keys as tests/e2e/axe.spec.ts) plus
 * stress-specific seeding of the AI mode for the production routing in
 * unifiedAIService (webgpu → swarm, wasm → wllama).
 */
export async function bootStressPage(page: Page): Promise<void> {
  await page.addInitScript(
    ({ appVersion, mode }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      // Belt-and-braces: a leftover formation ledger from a previous run sets
      // hasRestoredDocs, which disables Begin Formation and would pollute the
      // final ledger assertion in muster-call-batch.spec.ts.
      localStorage.removeItem("vetrate_formation_state");
      if (mode === "webgpu") localStorage.setItem("vet_rate_ai_mode", "swarm");
      if (mode === "wasm") localStorage.setItem("vet_rate_ai_mode", "wllama");
    },
    { appVersion: APP_VERSION, mode: STRESS_MODE },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * Dispatch a tool-open window event until a dialog appears, re-firing on every
 * poll tick: the owning feature clusters are lazy-loaded, so a single dispatch
 * sent before the listener attaches is silently lost. Same pattern as
 * openModalByEvent in tests/e2e/axe.spec.ts.
 */
export async function openToolByEvent(
  page: Page,
  event: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, event);
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });
}

/**
 * No production UI initializes wllama for the C-File Analyzer. In Vite dev the
 * page shares module instances with this dynamic import, so initializing here
 * flips isAnyAIAvailable() for the unmodified production gates. The string
 * form keeps the dynamic import() out of Playwright's spec transpile. Known
 * risk: if wllama fails to initialize, the Analyze gate stays disabled and the
 * test fails loudly — acceptable for a dev-only harness.
 */
export async function initWllamaViaDevServer(page: Page): Promise<void> {
  await page.evaluate(
    `import("/src/utils/unifiedAIService.js").then((m) => m.initializeWllama("auditor"))`,
  );
}

export interface VkbSnapshot {
  medicalConditionsCurrent: number;
  evidenceTimeline: number;
  cFiles: number;
  missingEvidence: number;
  environmental: number;
  legacyClaims: number;
  conditionNames: string[];
}

/**
 * Inject the VKB + My Packet modules into the running app page so a spec can
 * read persisted state through the app's OWN loaders. In Vite dev the injected
 * module resolves to the same URL the app imports, so it shares the module
 * singletons (one IndexedDB connection). Mirrors cfile-canonical-dataflow.spec.
 */
export async function injectStressMods(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as vkbMod from "/src/utils/veteranKnowledgeBase.js";
      import * as pktMod from "/src/utils/myPacketManager.js";
      window.__stressMods = { vkbMod, pktMod };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__stressMods), null, {
    timeout: 60_000,
  });
}

/** Read canonical-schema counts + condition names through the app's loadVKB. */
export async function readVkbSnapshot(page: Page): Promise<VkbSnapshot> {
  return page.evaluate(async () => {
    const v: Record<string, unknown> =
      await window.__stressMods.vkbMod.loadVKB();
    const len = (a: unknown): number => (Array.isArray(a) ? a.length : 0);
    const mc = v?.medicalConditions as { current?: unknown } | undefined;
    const current = Array.isArray(mc?.current) ? mc.current : [];
    const doc = v?.documentation as { cFiles?: unknown } | undefined;
    const ins = v?.aiInsights as { missingEvidence?: unknown } | undefined;
    const exp = v?.exposures as { environmental?: unknown } | undefined;
    return {
      medicalConditionsCurrent: current.length,
      evidenceTimeline: len(v?.evidenceTimeline),
      cFiles: len(doc?.cFiles),
      missingEvidence: len(ins?.missingEvidence),
      environmental: len(exp?.environmental),
      legacyClaims: len(v?.claims),
      conditionNames: current
        .map((c) => (c as { name?: unknown })?.name)
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.toLowerCase()),
    };
  });
}

/**
 * Poll the VKB until the analyzed C-File has been archived
 * (documentation.cFiles >= 1), tolerating the brief gap between the analyzer
 * showing "Analysis Complete" and the awaited save settling to IndexedDB.
 */
export async function waitForCFilePersisted(
  page: Page,
  timeoutMs = 30_000,
): Promise<VkbSnapshot> {
  let snap: VkbSnapshot = {
    medicalConditionsCurrent: 0,
    evidenceTimeline: 0,
    cFiles: 0,
    missingEvidence: 0,
    environmental: 0,
    legacyClaims: 0,
    conditionNames: [],
  };
  await expect
    .poll(
      async () => {
        snap = await readVkbSnapshot(page);
        return snap.cFiles;
      },
      { timeout: timeoutMs },
    )
    .toBeGreaterThanOrEqual(1);
  return snap;
}

export interface TelemetrySample {
  ts: number;
  heapBytes: number;
  nodes: number;
  documents: number;
}

export interface TelemetryReport {
  mode: StressMode;
  samples: TelemetrySample[];
  peakHeapBytes: number;
  peakNodes: number;
  pageErrors: string[];
  consoleErrors: string[];
  crashed: boolean;
}

export interface TelemetryHandle {
  stop(testInfo: TestInfo): Promise<TelemetryReport>;
}

/**
 * CDP telemetry: Performance.getMetrics every 5s (JSHeapUsedSize, Nodes,
 * Documents) plus pageerror / console-error / crash listeners. The verdict
 * (assertTelemetryVerdict) gates only heap, nodes, and crash per the WS-1 pass
 * bar; errors are recorded in the attachment for forensics.
 */
export async function startTelemetry(
  context: BrowserContext,
  page: Page,
): Promise<TelemetryHandle> {
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");

  const report: TelemetryReport = {
    mode: STRESS_MODE,
    samples: [],
    peakHeapBytes: 0,
    peakNodes: 0,
    pageErrors: [],
    consoleErrors: [],
    crashed: false,
  };

  // Live error stream: a hung/killed run never reaches stop(), so every
  // error is appended to disk the moment it happens — readable mid-run.
  const RESULTS_DIR = "audit/stress-results";
  mkdirSync(RESULTS_DIR, { recursive: true });
  const liveLog = join(
    RESULTS_DIR,
    `console-${STRESS_MODE}-${Date.now()}.jsonl`,
  );
  const stream = (kind: string, text: string) => {
    try {
      appendFileSync(
        liveLog,
        JSON.stringify({ ts: new Date().toISOString(), kind, text }) + "\n",
      );
    } catch {
      // disk hiccups must never break the run under test
    }
  };

  page.on("pageerror", (err) => {
    report.pageErrors.push(err.message);
    stream("pageerror", err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.consoleErrors.push(msg.text());
      stream("console.error", msg.text());
    }
  });
  page.on("crash", () => {
    report.crashed = true;
    stream("crash", "page crashed");
  });

  const timer = setInterval(async () => {
    try {
      const { metrics } = await session.send("Performance.getMetrics");
      const metric = (name: string) =>
        metrics.find((m) => m.name === name)?.value ?? 0;
      const sample: TelemetrySample = {
        ts: Date.now(),
        heapBytes: metric("JSHeapUsedSize"),
        nodes: metric("Nodes"),
        documents: metric("Documents"),
      };
      report.samples.push(sample);
      report.peakHeapBytes = Math.max(report.peakHeapBytes, sample.heapBytes);
      report.peakNodes = Math.max(report.peakNodes, sample.nodes);
    } catch {
      // Sampling races page teardown/crash; the crash listener is the verdict.
    }
  }, SAMPLE_INTERVAL_MS);

  return {
    async stop(testInfo: TestInfo): Promise<TelemetryReport> {
      clearInterval(timer);
      // Detach throws if the target already crashed/closed — not a finding.
      await session.detach().catch(() => {});
      await testInfo.attach("stress-telemetry", {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      try {
        writeFileSync(
          join(RESULTS_DIR, `telemetry-${STRESS_MODE}-${Date.now()}.json`),
          JSON.stringify(report, null, 2),
        );
      } catch {
        // attachment above still carries the data
      }
      return report;
    },
  };
}

export function assertTelemetryVerdict(report: TelemetryReport): void {
  expect(report.crashed, "page crashed during stress run").toBe(false);
  expect(
    report.peakHeapBytes,
    `peak JS heap ${(report.peakHeapBytes / 1024 ** 3).toFixed(2)} GB must stay under 1.5 GB`,
  ).toBeLessThan(HEAP_LIMIT_BYTES);
  expect(
    report.peakNodes,
    `peak DOM node count ${report.peakNodes} must stay under 100k`,
  ).toBeLessThan(DOM_NODE_LIMIT);
}

const MUSTER_ACCEPTED_EXTS = new Set([".pdf", ".docx", ".doc", ".txt", ".rtf"]);
const CFILE_BASENAME = basename(CFILE_PDF);

/**
 * Muster Call batch = every accepted-extension file in the corpus except the
 * 313MB C-File, which is exercised end-to-end by cfile-313mb.spec.ts. The
 * vet-rate-packet JSON falls out via the extension filter (Muster Call accepts
 * only .pdf/.docx/.doc/.txt/.rtf). File names only — contents are never read.
 */
export function listMusterCorpus(): string[] {
  return readdirSync(CORPUS_DIR)
    .filter((name) => MUSTER_ACCEPTED_EXTS.has(extname(name).toLowerCase()))
    .filter((name) => name !== CFILE_BASENAME)
    .map((name) => join(CORPUS_DIR, name));
}

/** Fisher–Yates; randomized submission order is part of the WS-1 spec. */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
