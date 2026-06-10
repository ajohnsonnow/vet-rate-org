#!/usr/bin/env node
/**
 * WS-1 stress runner — dev-hardware only, never wired into CI.
 *
 * node scripts/stress/run-cfile-stress.mjs [--runs N] [--modes webgpu,wasm,extract] [--spec cfile|muster|both]
 *
 * For each mode x run: starts the GPU sampler, invokes Playwright with the
 * stress config (STRESS=1, STRESS_MODE=<mode>), stops the sampler, parses the
 * JSON report, and appends a summary line to
 * audit/stress-results/stress-<date>.jsonl. Exits non-zero unless every run
 * is green.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { basename, join } from "node:path";

const RESULTS_DIR = "audit/stress-results";
// Written by the json reporter in playwright.stress.config.ts.
const REPORT_PATH = join(RESULTS_DIR, "last-run.json");

const SPEC_FILES = {
  cfile: ["tests/stress/cfile-313mb.spec.ts"],
  muster: ["tests/stress/muster-call-batch.spec.ts"],
  both: [
    "tests/stress/cfile-313mb.spec.ts",
    "tests/stress/muster-call-batch.spec.ts",
  ],
};
const ALL_MODES = ["webgpu", "wasm", "extract"];

function printUsage() {
  console.log(
    "usage: node scripts/stress/run-cfile-stress.mjs [--runs N=10] [--modes webgpu,wasm,extract] [--spec cfile|muster|both]",
  );
}

function parseArgs(argv) {
  const opts = { runs: 10, modes: [...ALL_MODES], spec: "cfile" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") {
      opts.runs = Number.parseInt(argv[++i], 10);
    } else if (arg === "--modes") {
      opts.modes = (argv[++i] ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    } else if (arg === "--spec") {
      opts.spec = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!Number.isInteger(opts.runs) || opts.runs < 1) {
    console.error("--runs must be a positive integer");
    process.exit(2);
  }
  if (
    opts.modes.length === 0 ||
    opts.modes.some((m) => !ALL_MODES.includes(m))
  ) {
    console.error(`--modes must be a comma list from: ${ALL_MODES.join(",")}`);
    process.exit(2);
  }
  if (!SPEC_FILES[opts.spec]) {
    console.error("--spec must be cfile | muster | both");
    process.exit(2);
  }
  return opts;
}

function stopSampler(sampler) {
  return new Promise((resolve) => {
    if (sampler.exitCode !== null) return resolve();
    const force = setTimeout(() => {
      try {
        sampler.kill();
      } catch {
        // already gone
      }
      resolve();
    }, 3000);
    sampler.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    // Closing stdin is the cross-platform stop signal (see gpu-sampler.mjs);
    // the timeout above is the kill fallback.
    try {
      sampler.stdin.end();
    } catch {
      // stream already closed; the timeout handles it
    }
  });
}

function parseReport() {
  if (!existsSync(REPORT_PATH)) return null;
  try {
    const stats = JSON.parse(readFileSync(REPORT_PATH, "utf-8")).stats ?? {};
    return {
      passed: stats.expected ?? 0,
      failed: stats.unexpected ?? 0,
      flaky: stats.flaky ?? 0,
      skipped: stats.skipped ?? 0,
      durationMs: Math.round(stats.duration ?? 0),
    };
  } catch {
    return null;
  }
}

const opts = parseArgs(process.argv.slice(2));
mkdirSync(RESULTS_DIR, { recursive: true });

const dateStamp = new Date().toISOString().slice(0, 10);
const summaryPath = join(RESULTS_DIR, `stress-${dateStamp}.jsonl`);

const rows = [];
let allGreen = true;

for (const mode of opts.modes) {
  for (let run = 1; run <= opts.runs; run++) {
    const stamp = Date.now();
    const gpuLogPath = join(
      RESULTS_DIR,
      `gpu-${opts.spec}-${mode}-run${run}-${stamp}.jsonl`,
    );
    console.log(
      `\n=== spec=${opts.spec} mode=${mode} run=${run}/${opts.runs} ===`,
    );

    const sampler = spawn(
      process.execPath,
      ["scripts/stress/gpu-sampler.mjs", gpuLogPath],
      { stdio: ["pipe", "inherit", "inherit"] },
    );

    rmSync(REPORT_PATH, { force: true });
    const result = spawnSync(
      "npx playwright test -c playwright.stress.config.ts " +
        SPEC_FILES[opts.spec].join(" "),
      {
        shell: true,
        stdio: "inherit",
        env: { ...process.env, STRESS: "1", STRESS_MODE: mode },
      },
    );

    await stopSampler(sampler);

    const stats = parseReport();
    // Keep the raw playwright JSON per run — it carries the CDP telemetry
    // attachments (heap/node samples) that last-run.json would overwrite.
    const rawReportPath = join(
      RESULTS_DIR,
      `playwright-${opts.spec}-${mode}-run${run}-${stamp}.json`,
    );
    if (existsSync(REPORT_PATH)) copyFileSync(REPORT_PATH, rawReportPath);

    const green = result.status === 0 && stats !== null && stats.failed === 0;
    allGreen &&= green;

    const summary = {
      ts: new Date().toISOString(),
      spec: opts.spec,
      mode,
      run,
      exitCode: result.status,
      ...(stats ?? {
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
        durationMs: 0,
      }),
      green,
      gpuLog: basename(gpuLogPath),
      report: existsSync(rawReportPath) ? basename(rawReportPath) : null,
    };
    appendFileSync(summaryPath, JSON.stringify(summary) + "\n");

    rows.push({
      spec: opts.spec,
      mode,
      run,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      minutes: +(summary.durationMs / 60000).toFixed(1),
      verdict: green ? "GREEN" : "RED",
    });
  }
}

console.log("");
console.table(rows);
console.log(
  allGreen
    ? `PASS — all ${rows.length} runs green (${summaryPath})`
    : `FAIL — one or more runs red, see ${summaryPath}`,
);
process.exitCode = allGreen ? 0 : 1;
