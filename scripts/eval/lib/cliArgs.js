import { resolve } from "node:path";
import { validateModelId } from "./goldenRecord.js";

export const USAGE = `usage:
  node scripts/eval/run-golden-set.mjs --model <WebLLM model id> [options]
  node scripts/eval/run-golden-set.mjs --dry-run [options]

options:
  --model <id>           WebLLM model id to force (required unless --dry-run)
  --dry-run              stubbed engine, canned responses, no browser or GPU
  --cases <a01,a11,...>  run only these golden-set case ids
  --temperature <n>      sampling temperature (default 0)
  --max-tokens <n>       completion token cap (default 1024)
  --thinking on|off      let a thinking model reason before it answers
                         (default off); recorded in the run settings
  --timeout-ms <n>       per-case generation timeout (default 300000)
  --flag <key>           set localStorage[key]="true" in the app (repeatable)
  --context-window <n>   override the device profile's context window size
  --out-dir <path>       where run files go (default llm-compiler/logs/golden-set-results)
  --legal-chunks <path>  38 CFR chunk file for the citation check
                         (default public/legal-index/v0.1.0/chunks/ecfr.jsonl)`;

function toNumber(flag, raw, { integer = false, min = 0 } = {}) {
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value < min ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${flag} needs ${integer ? "an integer" : "a number"} >= ${min}, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

export function parseArgs(argv) {
  const opts = {
    dryRun: false,
    model: null,
    cases: [],
    temperature: 0,
    maxTokens: 1024,
    thinking: false,
    timeoutMs: 300_000,
    contextWindow: null,
    outDir: null,
    legalChunks: null,
    flags: [],
  };
  const valueFlags = new Set([
    "--model",
    "--cases",
    "--temperature",
    "--max-tokens",
    "--thinking",
    "--timeout-ms",
    "--context-window",
    "--out-dir",
    "--legal-chunks",
    "--flag",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") {
      opts.help = true;
    } else if (flag === "--dry-run") {
      opts.dryRun = true;
    } else if (valueFlags.has(flag)) {
      const raw = argv[++i];
      if (raw === undefined) throw new Error(`${flag} needs a value`);
      applyValue(opts, flag, raw);
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return opts;
}

function applyValue(opts, flag, raw) {
  switch (flag) {
    case "--model":
      opts.model = validateModelId(raw);
      break;
    case "--cases":
      opts.cases = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    case "--temperature":
      opts.temperature = toNumber(flag, raw);
      break;
    case "--max-tokens":
      opts.maxTokens = toNumber(flag, raw, { integer: true, min: 1 });
      break;
    case "--thinking":
      if (raw !== "on" && raw !== "off") {
        throw new Error(
          `--thinking needs on or off, got ${JSON.stringify(raw)}`,
        );
      }
      opts.thinking = raw === "on";
      break;
    case "--timeout-ms":
      opts.timeoutMs = toNumber(flag, raw, { integer: true, min: 1000 });
      break;
    case "--context-window":
      opts.contextWindow = toNumber(flag, raw, { integer: true, min: 512 });
      break;
    case "--out-dir":
      opts.outDir = resolve(raw);
      break;
    case "--flag":
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(raw)) {
        throw new Error(
          `--flag needs a plain localStorage key, got ${JSON.stringify(raw)}`,
        );
      }
      if (!opts.flags.includes(raw)) opts.flags.push(raw);
      break;
    default:
      opts.legalChunks = resolve(raw);
  }
}
