#!/usr/bin/env node
/**
 * Golden-set evaluation runner for the on-device AI.
 *
 *   node scripts/eval/run-golden-set.mjs --model <WebLLM model id> [--cases a01,a11] [--temperature 0] [--max-tokens 1024] [--thinking on|off]
 *   node scripts/eval/run-golden-set.mjs --dry-run
 *
 * Real mode drives the app in a headed Chromium with WebGPU (Playwright spec
 * tests/eval/golden-set.spec.ts), sends every golden-set case through
 * generateAI, and records a JSONL transcript. Dry-run mode replaces the
 * browser and engine with canned responses and exercises the same record,
 * check and report code; it needs no browser, GPU or dev server.
 *
 * Either way the run ends by grading the transcript with the automated
 * checks and writing a Markdown summary next to it. Existing run files are
 * never overwritten.
 */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runnerImport } from "vite";
import {
  DRY_RUN_EXPECTATIONS,
  DRY_RUN_LEGAL_SECTIONS,
  DRY_RUN_MODEL_ID,
  assertDryRunExpectations,
  buildDryRunTranscript,
} from "./lib/dryRun.js";
import { loadGoldenSet, selectCases } from "./lib/goldenSet.js";
import { USAGE, parseArgs } from "./lib/cliArgs.js";
import { loadLegalSections } from "./lib/legalSections.js";
import {
  appendTranscript,
  claimRunFiles,
  finalizeRun,
} from "./lib/runArtifacts.js";
import { captureRunStart } from "./lib/runStart.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const GOLDEN_PATH = join(REPO_ROOT, "src/__tests__/agentic/golden-set.jsonl");
const RESULTS_DIR = join(REPO_ROOT, "llm-compiler/logs/golden-set-results");
const DRY_RUN_DIR = join(REPO_ROOT, "test-results/golden-set-dry-run");

async function loadFromSrc(relativePath) {
  const { module } = await runnerImport(join(REPO_ROOT, relativePath), {
    root: REPO_ROOT,
    configFile: false,
    logLevel: "error",
  });
  return module;
}

function legalContext(opts) {
  if (opts.dryRun) {
    return {
      legalSections: DRY_RUN_LEGAL_SECTIONS,
      legalIndexNote: "dry-run fixture, not the real index",
    };
  }
  const path =
    opts.legalChunks ??
    join(REPO_ROOT, "public/legal-index/v0.1.0/chunks/ecfr.jsonl");
  const { sections, reason } = loadLegalSections(path);
  if (sections) {
    return {
      legalSections: sections,
      legalIndexNote: `${sections.size} sections from ${path}`,
    };
  }
  return { legalSections: null, legalIndexNote: `unavailable: ${reason}` };
}

async function writeDryRunTranscript(
  files,
  cases,
  settings,
  calculateVARating,
) {
  const { SWARM_AGENTS } = await loadFromSrc("src/utils/diamondSwarm.js");
  const { resolveAgentForTool } = await loadFromSrc(
    "src/utils/agentBoundaries.js",
  );
  const personaPrompts = Object.fromEntries(
    Object.values(SWARM_AGENTS).map((agent) => [agent.id, agent.systemPrompt]),
  );
  appendTranscript(
    files.transcriptPath,
    buildDryRunTranscript({
      cases,
      personaPrompts,
      resolveAgentForTool,
      calculateVARating,
      settings,
    }),
  );
}

function runPlaywright(opts, files) {
  const env = {
    ...process.env,
    STRESS_MODE: "webgpu",
    EVAL: "1",
    EVAL_MODEL_ID: opts.model,
    EVAL_TRANSCRIPT: files.transcriptPath,
    EVAL_CASE_IDS: opts.cases.join(","),
    EVAL_TEMPERATURE: String(opts.temperature),
    EVAL_MAX_TOKENS: String(opts.maxTokens),
    EVAL_THINKING: opts.thinking ? "on" : "off",
    EVAL_TIMEOUT_MS: String(opts.timeoutMs),
    EVAL_FLAGS: opts.flags.join(","),
    ...(opts.contextWindow
      ? { EVAL_CONTEXT_WINDOW: String(opts.contextWindow) }
      : {}),
  };
  return spawnSync(
    "npx playwright test -c playwright.eval.config.ts tests/eval/golden-set.spec.ts",
    { shell: true, stdio: "inherit", env, cwd: REPO_ROOT },
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (!opts.dryRun && !opts.model) {
    console.error(`--model is required for a real run\n\n${USAGE}`);
    return 2;
  }

  const start = captureRunStart({ cwd: REPO_ROOT });
  const modelId = opts.dryRun ? DRY_RUN_MODEL_ID : opts.model;
  const goldenCases = selectCases(loadGoldenSet(GOLDEN_PATH), opts.cases);
  const { calculateVARating } = await loadFromSrc("src/utils/vaCalculator.js");
  const outDir = opts.outDir ?? (opts.dryRun ? DRY_RUN_DIR : RESULTS_DIR);
  const files = claimRunFiles(outDir, modelId, start.startedAt);
  const settings = {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    thinking: opts.thinking,
    timeoutMs: opts.timeoutMs,
    flags: opts.flags,
  };

  let exitCode = 0;
  if (opts.dryRun) {
    await writeDryRunTranscript(
      files,
      goldenCases,
      settings,
      calculateVARating,
    );
  } else {
    exitCode = runPlaywrightStep(opts, files);
  }

  const legal = legalContext(opts);
  const { meta, cases, grades } = finalizeRun({
    transcriptPath: files.transcriptPath,
    summaryPath: files.summaryPath,
    goldenCases,
    ctx: { calculateVARating, ...legal },
    runInfo: {
      modelId,
      date: start.date,
      transcriptFile: `${files.name}.jsonl`,
      legalIndexNote: legal.legalIndexNote,
      gitCommit: start.gitCommit,
      gitDirty: start.gitDirty,
    },
  });

  console.log(`transcript: ${files.transcriptPath}`);
  console.log(`summary:    ${files.summaryPath}`);
  console.log(`cases recorded: ${cases.length} of ${goldenCases.length}`);

  const verdict = opts.dryRun
    ? checkDryRun(grades, goldenCases)
    : checkLoadedModel(meta, modelId);
  return exitCode || verdict;
}

function runPlaywrightStep(opts, files) {
  const playwright = runPlaywright(opts, files);
  if (playwright.status === 0) return 0;
  console.error(
    `playwright exited with status ${playwright.status}; grading the partial transcript`,
  );
  return 1;
}

function checkLoadedModel(meta, modelId) {
  if (meta?.modelIdLoaded === modelId) return 0;
  console.error(
    `model loaded (${meta?.modelIdLoaded ?? "none"}) is not the model requested (${modelId})`,
  );
  return 1;
}

function checkDryRun(grades, goldenCases) {
  const present = new Set(goldenCases.map((c) => c.id));
  const expectations = Object.fromEntries(
    Object.entries(DRY_RUN_EXPECTATIONS).filter(([id]) => present.has(id)),
  );
  const problems = assertDryRunExpectations(grades, expectations);
  if (problems.length === 0) {
    console.log("DRY RUN PASSED: every canned failure was caught by its check");
    return 0;
  }
  console.error(`DRY RUN FAILED: ${problems.length} expectation(s) not met`);
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
}
