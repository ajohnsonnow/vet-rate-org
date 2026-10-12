/* eslint-disable max-lines-per-function -- one sampler with two child processes sharing state */
/* eslint-disable sonarjs/no-os-command-from-path -- dev-workstation tool: nvidia-smi, powershell and taskkill are resolved from the system PATH on purpose */
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;

export function nvidiaMemory(index) {
  const out = execFileSync(
    "nvidia-smi",
    [
      "-i",
      String(index),
      "--query-gpu=memory.used,memory.free,memory.total",
      "--format=csv,noheader,nounits",
    ],
    { encoding: "utf8" },
  );
  const [usedMiB, freeMiB, totalMiB] = out.trim().split(",").map(Number);
  return { usedMiB, freeMiB, totalMiB };
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } catch {
    child.kill();
  }
}

/**
 * Samples GPU memory for one adapter until stop(). Windows "GPU Adapter Memory"
 * counters (about 1 s resolution) give dedicated and shared usage for any
 * adapter; for NVIDIA, nvidia-smi (about 0.3 s) gives the dedicated figure.
 * Values are adapter-wide, so the caller subtracts a baseline.
 */
export function startWindowsSampler(adapter) {
  const sampler = startSampler(adapter);
  return {
    preLoad() {
      return {
        usedMiB: sampler.last(
          adapter.isNvidia ? "smiUsed" : "counterDedicated",
        ),
        freeMiB: adapter.isNvidia ? sampler.last("smiFree") : null,
      };
    },
    summarize: (base, from, to) =>
      summarizeMemory(sampler, adapter, base, from, to),
    stop: () => sampler.stop(),
  };
}

export function startSampler(adapter) {
  const samples = {
    counterDedicated: [],
    counterShared: [],
    smiUsed: [],
    smiFree: [],
  };
  const children = [];
  const luidRe =
    /luid_(0x[0-9a-f]+)_(0x[0-9a-f]+)_phys_0\)\\(dedicated|shared) usage\|(\d+)/i;
  const wantLuid = adapter.luidHex.toLowerCase();

  const counters = spawn(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(here, "counters.ps1"),
      adapter.luidHex,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  children.push(counters);
  createInterface({ input: counters.stdout }).on("line", (line) => {
    const m = luidRe.exec(line);
    if (!m || `${m[1]}_${m[2]}`.toLowerCase() !== wantLuid) return;
    const point = { t: Date.now(), mib: Number(m[4]) / MIB };
    (m[3].toLowerCase() === "dedicated"
      ? samples.counterDedicated
      : samples.counterShared
    ).push(point);
  });

  if (adapter.isNvidia && adapter.nvidiaIndex !== null) {
    const smi = spawn(
      "nvidia-smi",
      [
        "-i",
        String(adapter.nvidiaIndex),
        "--query-gpu=memory.used,memory.free",
        "--format=csv,noheader,nounits",
        "-lms",
        "300",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    children.push(smi);
    createInterface({ input: smi.stdout }).on("line", (line) => {
      const [used, free] = line.split(",").map(Number);
      if (!Number.isFinite(used)) return;
      const t = Date.now();
      samples.smiUsed.push({ t, mib: used });
      samples.smiFree.push({ t, mib: free });
    });
  }

  const inWindow = (series, from, to) =>
    series.filter((p) => p.t >= from && p.t <= (to ?? Infinity));

  return {
    samples,
    last(name) {
      const s = samples[name];
      return s.length ? s[s.length - 1].mib : null;
    },
    median(name, from, to) {
      const v = inWindow(samples[name], from, to)
        .map((p) => p.mib)
        .sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : null;
    },
    peak(name, from, to) {
      const v = inWindow(samples[name], from, to).map((p) => p.mib);
      return v.length ? Math.max(...v) : null;
    },
    min(name, from, to) {
      const v = inWindow(samples[name], from, to).map((p) => p.mib);
      return v.length ? Math.min(...v) : null;
    },
    stop() {
      for (const c of children) killTree(c);
    },
  };
}

/**
 * Peak dedicated and shared MiB between from and to, as the delta over the
 * baseline window, plus the raw peaks. NVIDIA uses nvidia-smi for dedicated.
 */
export function summarizeMemory(sampler, adapter, base, from, to) {
  const dedicatedSeries =
    adapter.isNvidia && sampler.samples.smiUsed.length
      ? "smiUsed"
      : "counterDedicated";
  const dedicatedSource =
    dedicatedSeries === "smiUsed" ? "nvidia-smi" : "windows-counter";
  const baseDedicated = sampler.median(dedicatedSeries, base.from, base.to);
  const baseShared = sampler.median("counterShared", base.from, base.to);
  const peakDedicated = sampler.peak(dedicatedSeries, from, to);
  const peakShared = sampler.peak("counterShared", from, to);
  const r = (n) => (n === null ? null : Math.round(n));
  return {
    dedicatedSource,
    baselineDedicatedMiB: r(baseDedicated),
    baselineSharedMiB: r(baseShared),
    peakDedicatedMiB: r(peakDedicated),
    peakSharedMiB: r(peakShared),
    peakDedicatedDeltaMiB:
      peakDedicated === null || baseDedicated === null
        ? null
        : r(peakDedicated - baseDedicated),
    peakSharedDeltaMiB:
      peakShared === null || baseShared === null
        ? null
        : r(peakShared - baseShared),
    minFreeMiB: adapter.isNvidia ? r(sampler.min("smiFree", from, to)) : null,
    counterSamples: sampler.samples.counterDedicated.length,
  };
}
