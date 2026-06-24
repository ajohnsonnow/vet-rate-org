#!/usr/bin/env node
/**
 * GPU telemetry sampler for the WS-1 stress harness.
 * Usage: node scripts/stress/gpu-sampler.mjs <output.jsonl>
 *
 * Spawns `nvidia-smi -l 5` and appends one JSONL record per GPU per sample:
 *   {"ts":"2026-06-09T...","gpu":0,"memMB":1234,"util":56}
 *
 * Shutdown contract: the runner closes our stdin. SIGTERM handlers never fire
 * on Windows (kill() is an unconditional terminate that would orphan the
 * nvidia-smi child), so stdin EOF is the cross-platform stop signal;
 * SIGTERM/SIGINT are also handled for POSIX shells. Exits 0 quietly when
 * nvidia-smi is missing — GPU telemetry is best-effort.
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const outPath = process.argv[2];
if (!outPath) {
  console.error("usage: node scripts/stress/gpu-sampler.mjs <output.jsonl>");
  process.exit(2);
}
mkdirSync(dirname(outPath), { recursive: true });

const smi = spawn(
  "nvidia-smi",
  [
    "--query-gpu=index,memory.used,utilization.gpu",
    "--format=csv,noheader",
    "-l",
    "5",
  ],
  { stdio: ["ignore", "pipe", "ignore"] },
);

smi.on("error", () => {
  console.warn("gpu-sampler: nvidia-smi not found — skipping GPU telemetry");
  process.exit(0);
});

let buffer = "";
smi.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const [gpu, mem, util] = line.split(",").map((s) => s.trim());
    if (gpu === undefined || mem === undefined || util === undefined) continue;
    const record = {
      ts: new Date().toISOString(),
      gpu: Number.parseInt(gpu, 10),
      memMB: Number.parseInt(mem, 10), // "1234 MiB" -> 1234
      util: Number.parseInt(util, 10), // "56 %" -> 56
    };
    if (Number.isNaN(record.gpu)) continue;
    appendFileSync(outPath, JSON.stringify(record) + "\n");
  }
});

function shutdown() {
  try {
    smi.kill();
  } catch {
    // already gone
  }
  process.exit(0);
}

process.stdin.resume();
process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
smi.on("exit", () => process.exit(0));
