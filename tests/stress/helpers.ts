import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { test, expect, Page, BrowserContext, TestInfo } from "@playwright/test";
import { dismissDisclaimer } from "../e2e/helpers";

export const CORPUS_DIR = "E:/Williams_C-FIle";
export const CFILE_PDF = join(CORPUS_DIR, "WILLIAMS 1234 .pdf");

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

  page.on("pageerror", (err) => report.pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });
  page.on("crash", () => {
    report.crashed = true;
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
