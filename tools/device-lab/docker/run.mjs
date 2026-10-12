// Host-side runner: node tools/device-lab/docker/run.mjs <preset> [--overalloc] [--skip-build]
// Presets are in presets.json. Output goes to test-results/device-lab-ram/<preset>[-overalloc]/.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = (line) =>
  process.stdout.write(`${line}
`);
const fail = (line) =>
  process.stderr.write(`${line}
`);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const IMAGE = "device-lab-ram";
const presets = JSON.parse(
  readFileSync(path.join(here, "presets.json"), "utf-8"),
);

const args = process.argv.slice(2);
const presetName = args.find((a) => !a.startsWith("--"));
const overalloc = args.includes("--overalloc");
const skipBuild = args.includes("--skip-build");

if (!presetName || !Object.hasOwn(presets, presetName)) {
  fail(
    `usage: run.mjs <${Object.keys(presets).join("|")}> [--overalloc] [--skip-build]`,
  );
  process.exit(2);
}
const preset = presets[presetName];

const docker = (dockerArgs, options = {}) =>
  spawnSync("docker", dockerArgs, { encoding: "utf-8", ...options });

if (!skipBuild) {
  out(`building ${IMAGE} (cached layers are reused)`);
  const build = docker(
    ["build", "-t", IMAGE, "-f", path.join(here, "Dockerfile"), root],
    { stdio: "inherit" },
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const label = overalloc ? `${presetName}-overalloc` : presetName;
const outDir = path.join(root, "test-results", "device-lab-ram", label);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const limitArgs = [
  "--memory",
  preset.memory,
  "--memory-swap",
  preset.memory,
  "--cpus",
  String(preset.cpus),
];

function runContainer(name, command) {
  docker(["rm", "-f", name]);
  const started = Date.now();
  const run = docker(
    [
      "run",
      "--name",
      name,
      ...limitArgs,
      "-v",
      `${outDir}:/out`,
      IMAGE,
      ...command,
    ],
    { stdio: "inherit" },
  );
  const inspect = docker([
    "inspect",
    "-f",
    "{{.State.OOMKilled}} {{.State.ExitCode}}",
    name,
  ]).stdout.trim();
  docker(["rm", "-f", name]);
  const [oomKilled, exitCode] = inspect.split(" ");
  return {
    wallSeconds: Math.round((Date.now() - started) / 1000),
    dockerOOMKilled: oomKilled === "true",
    exitCode: Number(exitCode),
    dockerRunStatus: run.status,
  };
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : null;
}

function csvPeak() {
  const file = path.join(outDir, "memory.csv");
  if (!existsSync(file)) return null;
  let peak = 0;
  for (const line of readFileSync(file, "utf-8").split("\n").slice(1)) {
    const cols = line.split(",");
    peak = Math.max(peak, Number(cols[3]) || 0, Number(cols[1]) || 0);
  }
  return peak;
}

const gb = (bytes) =>
  bytes == null ? "n/a" : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
const stamp = Date.now();
const summary = {
  preset: presetName,
  ...preset,
  mode: overalloc ? "overalloc" : "specs",
};

if (overalloc) {
  summary.containerProbes = runContainer(`devlab-${label}-${stamp}`, [
    "node",
    "tools/device-lab/docker/container-run.mjs",
    "overalloc",
  ]);
  const result = readJson(path.join(outDir, "result.json"));
  summary.result = result;
  summary.peakContainerMemory = gb(result?.memoryPeakBytes ?? csvPeak());

  summary.pid1Allocator = runContainer(`devlab-${label}-pid1-${stamp}`, [
    "node",
    "tools/device-lab/docker/overalloc-node.mjs",
  ]);
} else {
  summary.container = runContainer(`devlab-${label}-${stamp}`, [
    "node",
    "tools/device-lab/docker/container-run.mjs",
    "specs",
  ]);
  const result = readJson(path.join(outDir, "result.json"));
  summary.result = result;
  summary.peakContainerMemory = gb(result?.memoryPeakBytes ?? csvPeak());
  summary.peakWorkingSet = gb(result?.workingSetPeakSampledBytes ?? null);
  const stats = result?.playwright;
  summary.passed = stats ? stats.unexpected === 0 && stats.expected > 0 : false;
}

writeFileSync(
  path.join(outDir, "summary.json"),
  JSON.stringify(summary, null, 2),
);

const r = summary.result;
out("\n=== device-lab RAM job ===");
out(
  `preset:               ${presetName} (${preset.memory}, ${preset.cpus} cpus)`,
);
out(
  `peak container mem:   ${summary.peakContainerMemory} (cgroup memory.peak, includes page cache)`,
);
if (!overalloc) {
  const s = r?.playwright;
  out(
    `peak working set:     ${summary.peakWorkingSet} (sampled every 0.5 s, minus inactive file cache)`,
  );
  out(`duration:             ${summary.container.wallSeconds} s wall`);
  out(
    s
      ? `tests:                ${s.expected} passed, ${s.unexpected} failed, ${s.skipped} skipped, ${s.flaky} flaky`
      : "tests:                no Playwright report written",
  );
  const d = r?.doubleThrottled;
  out(
    d
      ? `double-throttled:      ${d.expected} passed, ${d.unexpected} failed, ${d.skipped} skipped (own 4x CPU throttle on top of the cap; not a device result, not in the result below)`
      : "double-throttled:      no report written (not counted either way)",
  );
  out(
    `container OOM-killed: ${summary.container.dockerOOMKilled} (exit ${summary.container.exitCode})`,
  );
  out(`cgroup oom_kill:      ${r?.memoryEvents?.oom_kill ?? "n/a"}`);
  out(
    `result:                ${summary.passed && !summary.container.dockerOOMKilled ? "PASS" : "FAIL"}`,
  );
  process.exit(summary.passed && !summary.container.dockerOOMKilled ? 0 : 1);
}
out(`node allocator:       exit ${JSON.stringify(r?.child?.node)}`);
out(`tab allocator:        exit ${JSON.stringify(r?.child?.tab)}`);
out(`cgroup oom_kill:      ${r?.memoryEvents?.oom_kill ?? "n/a"}`);
out(
  `pid1 allocator:       OOMKilled=${summary.pid1Allocator.dockerOOMKilled}, exit ${summary.pid1Allocator.exitCode}`,
);
