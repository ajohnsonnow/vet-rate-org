import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, chromium, expect, type Page } from "@playwright/test";
import { bootStressPage } from "../stress/helpers";
import {
  loadGoldenSet,
  selectCases,
} from "../../scripts/eval/lib/goldenSet.js";
import {
  buildMetaRecord,
  fingerprintPersonas,
} from "../../scripts/eval/lib/goldenRecord.js";
import { assembleCaseRecord } from "../../scripts/eval/lib/caseRecord.js";
import { recordAllCases } from "../../scripts/eval/lib/caseLoop.js";

/**
 * Golden-set evaluation of the on-device AI. Boots the real app (headed
 * Chromium with WebGPU, see playwright.eval.config.ts), forces ONE WebLLM
 * model id, then sends each golden-set case through the production generateAI
 * path with the case's toolId, so persona selection, knowledge-base context
 * injection and calculator grounding behave as they do for a user.
 *
 * Driven by scripts/eval/run-golden-set.mjs, which sets the EVAL_* variables,
 * claims the transcript file, and grades the transcript afterwards. This spec
 * only records.
 */

const GOLDEN_PATH = "src/__tests__/agentic/golden-set.jsonl";
const NODE_SIDE_GRACE_MS = 60_000;

interface CapturedRequest {
  messages: { role: string; content: unknown }[];
  max_tokens?: number;
  temperature?: number;
  extra_body?: { enable_thinking?: boolean };
}

interface CalculatorReplacement {
  reason?: string;
  draft?: string;
}

interface EvalWindow {
  __evalCaptured: CapturedRequest[];
  __evalMods?: {
    dc: {
      detectDeviceCapabilities(): Promise<Record<string, unknown>>;
    };
    swarm: {
      initializeSwarm(agent: string): Promise<boolean>;
      reloadSwarmEngine(): Promise<boolean>;
      getSwarmStatus(): { model: string | null };
      getLastSwarmGeneration(): {
        raw: string;
        outputCleanup?: unknown;
      } | null;
      clearLastSwarmGeneration(): void;
      SWARM_AGENTS: Record<string, { id: string; systemPrompt: string }>;
    };
    ai: {
      generateAI(
        prompt: string,
        options: Record<string, unknown>,
      ): Promise<
        | string
        | {
            text?: string;
            validationErrors?: unknown;
            validationWarnings?: unknown;
            calculatorReplacement?: CalculatorReplacement;
            citationsUnverified?: unknown;
          }
      >;
      resetAICircuitBreaker(): void;
      isDiamondSwarmReady(): boolean;
    };
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is not set; run via scripts/eval/run-golden-set.mjs`,
    );
  return value;
}

/**
 * Record the chat request the engine receives, without touching production
 * code: WebLLM runs in a Worker, so every request crosses
 * Worker.prototype.postMessage as structured-clone data. Any posted object
 * holding a `messages` array of role/content items is a chat request.
 */
async function installEngineRequestTap(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as EvalWindow;
    w.__evalCaptured = [];
    const isMessage = (m: unknown): boolean =>
      typeof m === "object" && m !== null && "role" in m && "content" in m;
    const find = (value: unknown, depth: number): CapturedRequest | null => {
      if (!value || typeof value !== "object" || depth > 4) return null;
      const obj = value as Record<string, unknown>;
      if (
        Array.isArray(obj.messages) &&
        obj.messages.length > 0 &&
        obj.messages.every(isMessage)
      ) {
        return obj as unknown as CapturedRequest;
      }
      for (const key of Object.keys(obj)) {
        const hit = find(obj[key], depth + 1);
        if (hit) return hit;
      }
      return null;
    };
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      this: Worker,
      ...args: Parameters<Worker["postMessage"]>
    ) {
      try {
        const request = find(args[0], 0);
        if (request) {
          w.__evalCaptured.push({
            messages: JSON.parse(JSON.stringify(request.messages)),
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            extra_body: request.extra_body,
          });
        }
      } catch {
        // capture is best-effort; the app's own message must still go through
      }
      return original.apply(this, args);
    } as Worker["postMessage"];
  });
}

async function exposeAppModules(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as dc from "/src/utils/deviceCapabilityDetector.js";
      import * as swarm from "/src/utils/diamondSwarm.js";
      import * as ai from "/src/utils/unifiedAIService.js";
      window.__evalMods = { dc, swarm, ai };
    `,
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as EvalWindow).__evalMods),
    null,
    { timeout: 60_000 },
  );
}

/**
 * Force exactly one model id. detectDeviceCapabilities() returns the one
 * cached profile object and initializeSwarm() reads recommendedModels from it
 * (pinned by src/__tests__/agentic/eval/deviceProfileOverride.test.js), so a
 * single-entry list means no silent fallback to a different model.
 */
async function loadForcedModel(
  page: Page,
  modelId: string,
  contextWindow: number | null,
) {
  return page.evaluate(
    async ({ modelId, contextWindow }) => {
      const mods = (window as unknown as EvalWindow).__evalMods!;
      const profile = await mods.dc.detectDeviceCapabilities();
      profile.recommendedModels = [modelId];
      if (contextWindow) profile.contextWindowSize = contextWindow;

      const loaded = await mods.swarm.initializeSwarm("auditor");
      const adapter = await navigator.gpu?.requestAdapter();
      const info = adapter?.info;
      return {
        loaded,
        ready: mods.ai.isDiamondSwarmReady(),
        modelIdLoaded: mods.swarm.getSwarmStatus().model,
        device: {
          tier: profile.tier,
          gpuDescription: profile.gpuDescription,
          systemRAM: profile.systemRAM,
          cpuCores: profile.cpuCores,
          contextWindowSize: profile.contextWindowSize,
          userAgent: navigator.userAgent,
          adapter: info
            ? {
                vendor: info.vendor,
                architecture: info.architecture,
                device: info.device,
                description: info.description,
              }
            : null,
        },
        personaPrompts: Object.fromEntries(
          Object.values(mods.swarm.SWARM_AGENTS).map((a) => [
            a.id,
            a.systemPrompt,
          ]),
        ),
      };
    },
    { modelId, contextWindow },
  );
}

interface CaseOutcome {
  ok: boolean;
  text?: string;
  error?: string;
  latencyMs: number;
  validationErrors?: unknown;
  validationWarnings?: unknown;
  calculatorReplacement?: CalculatorReplacement;
  citationsUnverified?: unknown;
  rawResponse?: string;
  outputCleanup?: unknown;
  captured: CapturedRequest[];
}

function runCase(
  page: Page,
  args: {
    input: string;
    toolId: string;
    conditions: unknown;
    temperature: number;
    maxTokens: number;
    thinking: boolean;
    timeoutMs: number;
  },
): Promise<CaseOutcome> {
  return page.evaluate(async (a) => {
    const w = window as unknown as EvalWindow;
    const mods = w.__evalMods!;
    w.__evalCaptured.length = 0;
    mods.swarm.clearLastSwarmGeneration();
    mods.ai.resetAICircuitBreaker();
    const started = performance.now();
    const options: Record<string, unknown> = {
      toolId: a.toolId,
      dataClass: "context",
      temperature: a.temperature,
      maxTokens: a.maxTokens,
      thinking: a.thinking,
      timeout: a.timeoutMs,
    };
    if (a.conditions) options.conditions = a.conditions;
    try {
      const result = await mods.ai.generateAI(a.input, options);
      const text = typeof result === "string" ? result : (result?.text ?? "");
      return {
        ok: true,
        text,
        rawResponse: mods.swarm.getLastSwarmGeneration()?.raw,
        outputCleanup:
          mods.swarm.getLastSwarmGeneration()?.outputCleanup ?? undefined,
        calculatorReplacement:
          typeof result === "string"
            ? undefined
            : result?.calculatorReplacement,
        citationsUnverified:
          typeof result === "string" ? undefined : result?.citationsUnverified,
        latencyMs: performance.now() - started,
        validationErrors:
          typeof result === "string" ? undefined : result?.validationErrors,
        validationWarnings:
          typeof result === "string" ? undefined : result?.validationWarnings,
        captured: [...w.__evalCaptured],
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        rawResponse: mods.swarm.getLastSwarmGeneration()?.raw,
        outputCleanup:
          mods.swarm.getLastSwarmGeneration()?.outputCleanup ?? undefined,
        latencyMs: performance.now() - started,
        captured: [...w.__evalCaptured],
      };
    }
  }, args);
}

function withNodeTimeout<T>(
  work: Promise<T>,
  ms: number,
): Promise<T | "timeout"> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

interface RunSettings {
  temperature: number;
  maxTokens: number;
  thinking: boolean;
  timeoutMs: number;
  flags: string[];
}

function readSettings(): RunSettings {
  return {
    temperature: Number(process.env.EVAL_TEMPERATURE ?? 0),
    maxTokens: Number(process.env.EVAL_MAX_TOKENS ?? 1024),
    thinking: process.env.EVAL_THINKING === "on",
    timeoutMs: Number(process.env.EVAL_TIMEOUT_MS ?? 300_000),
    flags: (process.env.EVAL_FLAGS ?? "").split(",").filter(Boolean),
  };
}

type GoldenCase = ReturnType<typeof loadGoldenSet>[number];

const ENGINE_RESET_TIMEOUT_MS = 330_000;

/**
 * Bring the engine back to a clean idle state after a failed case: the app's
 * own rebuild path (worker terminate and respawn, see reloadSwarmEngine), then
 * confirm the swarm is ready and the forced model id is the one loaded.
 */
async function resetEngine(page: Page, modelId: string): Promise<void> {
  const status = await withNodeTimeout(
    page.evaluate(async () => {
      const mods = (window as unknown as EvalWindow).__evalMods!;
      await mods.swarm.reloadSwarmEngine();
      return {
        ready: mods.ai.isDiamondSwarmReady(),
        model: mods.swarm.getSwarmStatus().model,
      };
    }),
    ENGINE_RESET_TIMEOUT_MS,
  );
  if (status === "timeout") {
    throw new Error(`reset did not finish in ${ENGINE_RESET_TIMEOUT_MS} ms`);
  }
  if (!status.ready || status.model !== modelId) {
    throw new Error(
      `after reset ready=${status.ready} model=${status.model}, wanted ${modelId}`,
    );
  }
}

/**
 * Send each case through generateAI and append its record the moment it
 * finishes, so a killed or wedged run still leaves a readable transcript.
 * After a case that timed out or errored the engine is reset before the next
 * case (see recordAllCases). Returns how many cases were recorded; the run
 * stops early if the engine cannot be reset.
 */
async function recordCases(
  page: Page,
  cases: GoldenCase[],
  ctx: {
    transcript: string;
    settings: RunSettings;
    run: Record<string, unknown>;
    personaPrompts: Record<string, string>;
    modelId: string;
  },
): Promise<number> {
  const { settings, run, personaPrompts, modelId } = ctx;
  const pageTimeoutMs = settings.timeoutMs + NODE_SIDE_GRACE_MS;
  const { recorded, stopped } = await recordAllCases({
    cases,
    pageTimeoutMs,
    attempt: (caseDef: GoldenCase) =>
      withNodeTimeout(
        runCase(page, {
          input: caseDef.input,
          toolId: caseDef.toolId,
          conditions: caseDef.conditions ?? null,
          ...settings,
        }),
        pageTimeoutMs,
      ),
    recover: () => resetEngine(page, modelId),
    toRecord: (caseDef: GoldenCase, outcome: CaseOutcome) =>
      assembleCaseRecord({ caseDef, run, personaPrompts, outcome }),
    write: (record: unknown) =>
      appendFileSync(ctx.transcript, JSON.stringify(record) + "\n"),
  });
  if (stopped) {
    // eslint-disable-next-line no-console -- forensic
    console.log(`[run stopped] ${stopped}`);
  }
  return recorded;
}

/*
 * A persistent browser profile instead of Playwright's default in-memory
 * context: the in-memory one caps Cache Storage well below a 4B-class model
 * download (Cache.add fails with "Unexpected internal error"), and it would
 * re-download every model on every run.
 */
const PROFILE_DIR =
  process.env.EVAL_PROFILE_DIR ?? join(tmpdir(), "vetrate-eval-profile");

const test = base.extend({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here
  context: async ({}, use, testInfo) => {
    mkdirSync(PROFILE_DIR, { recursive: true });
    const projectUse = testInfo.project.use;
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      ...projectUse.launchOptions,
      baseURL: projectUse.baseURL,
      viewport: projectUse.viewport ?? null,
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

test.describe("golden-set evaluation", () => {
  // eslint-disable-next-line sonarjs/no-skipped-tests -- opt-in harness: only the launcher sets EVAL=1
  test.skip(
    process.env.EVAL !== "1",
    "golden-set evaluation: run via scripts/eval/run-golden-set.mjs",
  );

  test("every golden-set case through generateAI", async ({ page }) => {
    const modelId = requiredEnv("EVAL_MODEL_ID");
    const transcript = requiredEnv("EVAL_TRANSCRIPT");
    const settings = readSettings();
    const contextWindow = process.env.EVAL_CONTEXT_WINDOW
      ? Number(process.env.EVAL_CONTEXT_WINDOW)
      : null;
    const caseIds = (process.env.EVAL_CASE_IDS ?? "")
      .split(",")
      .filter(Boolean);
    const cases = selectCases(loadGoldenSet(GOLDEN_PATH), caseIds);

    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console -- forensic
      console.log(`[pageerror] ${err.message}`);
    });
    page.context().on("requestfailed", (req) => {
      // eslint-disable-next-line no-console -- forensic
      console.log(
        `[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ""}`,
      );
    });
    await page.addInitScript((keys) => {
      for (const key of keys) localStorage.setItem(key, "true");
    }, settings.flags);
    await installEngineRequestTap(page);
    await bootStressPage(page);
    await exposeAppModules(page);

    const load = await loadForcedModel(page, modelId, contextWindow);
    expect(load.loaded, `initializeSwarm failed for ${modelId}`).toBe(true);
    expect(load.modelIdLoaded, "model actually loaded").toBe(modelId);
    expect(load.ready, "generateAI sees the swarm as ready").toBe(true);

    const personaPrompts = load.personaPrompts as Record<string, string>;
    appendFileSync(
      transcript,
      JSON.stringify(
        buildMetaRecord({
          engine: "WebLLM (WebGPU) through generateAI",
          modelIdRequested: modelId,
          modelIdLoaded: load.modelIdLoaded,
          device: load.device,
          settings,
          personaFingerprints: fingerprintPersonas(personaPrompts),
        }),
      ) + "\n",
    );

    const recorded = await recordCases(page, cases, {
      transcript,
      settings,
      personaPrompts,
      modelId,
      run: {
        modelIdRequested: modelId,
        modelIdLoaded: load.modelIdLoaded,
        ...settings,
      },
    });
    expect(recorded, "cases recorded").toBe(cases.length);
  });
});
