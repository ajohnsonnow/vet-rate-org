// Runs inside the container (cwd /app). Starts a memory sampler, runs the
// Playwright import specs (or the over-allocation probes), and writes
// /out/result.json. If the container itself is killed the result file is
// never written; the host falls back to /out/memory.csv.
import { spawn } from "node:child_process";
import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";

const OUT = "/out";
const CG = "/sys/fs/cgroup";
const mode = process.argv[2] ?? "specs";

mkdirSync(OUT, { recursive: true });

const readNum = (file) => {
  try {
    const v = readFileSync(`${CG}/${file}`, "utf-8").trim();
    return v === "max" ? null : Number(v);
  } catch {
    return null;
  }
};

const readStat = (key) => {
  try {
    const line = readFileSync(`${CG}/memory.stat`, "utf-8")
      .split("\n")
      .find((l) => l.startsWith(`${key} `));
    return line ? Number(line.split(" ")[1]) : 0;
  } catch {
    return 0;
  }
};

const readEvents = () => {
  const events = {};
  try {
    for (const line of readFileSync(`${CG}/memory.events`, "utf-8").split(
      "\n",
    )) {
      const [k, v] = line.split(" ");
      if (k) events[k] = Number(v);
    }
  } catch {
    /* cgroup v1: no memory.events */
  }
  return events;
};

writeFileSync(
  `${OUT}/memory.csv`,
  "elapsed_s,current_bytes,working_set_bytes,peak_bytes,anon_bytes,oom_kill\n",
);
const started = Date.now();
let maxWorkingSet = 0;
const sample = () => {
  const current = readNum("memory.current") ?? 0;
  const workingSet = current - readStat("inactive_file");
  maxWorkingSet = Math.max(maxWorkingSet, workingSet);
  appendFileSync(
    `${OUT}/memory.csv`,
    [
      ((Date.now() - started) / 1000).toFixed(1),
      current,
      workingSet,
      readNum("memory.peak") ?? 0,
      readStat("anon"),
      readEvents().oom_kill ?? 0,
    ].join(",") + "\n",
  );
};
const timer = setInterval(sample, 500);
sample();

const run = (cmd, args, logFile, env = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    const log = (chunk) => {
      process.stdout.write(chunk);
      appendFileSync(`${OUT}/${logFile}`, chunk);
    };
    child.stdout.on("data", log);
    child.stderr.on("data", log);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });

let child;
let doubleThrottledChild = null;
if (mode === "overalloc") {
  const node = await run(
    "node",
    ["tools/device-lab/docker/overalloc-node.mjs"],
    "overalloc-node.log",
  );
  const tab = await run(
    "node",
    ["tools/device-lab/docker/overalloc-tab.mjs"],
    "overalloc-tab.log",
  );
  child = { node, tab };
} else {
  const playwrightArgs = [
    "playwright",
    "test",
    "-c",
    "tools/device-lab/docker/playwright.docker.config.ts",
  ];
  child = await run("npx", playwrightArgs, "playwright.log");
  doubleThrottledChild = await run(
    "npx",
    playwrightArgs,
    "playwright-double-throttled.log",
    { DOCKER_DOUBLE_THROTTLED: "1" },
  );
}

clearInterval(timer);
sample();

function readCounts(file) {
  try {
    const report = JSON.parse(readFileSync(`${OUT}/${file}`, "utf-8"));
    const counts = { ...report.stats, tests: [] };
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const last = t.results.at(-1);
          counts.tests.push({
            file: spec.file,
            title: spec.title,
            status: t.status,
            durationMs: last?.duration ?? null,
            error: last?.error?.message?.split("\n")[0] ?? null,
          });
        }
      }
      for (const s of suite.suites ?? []) walk(s);
    };
    for (const s of report.suites ?? []) walk(s);
    return counts;
  } catch {
    return null; /* report missing: run did not reach the reporter */
  }
}

const counts = readCounts("playwright-report.json");
const doubleThrottled =
  mode === "overalloc"
    ? null
    : readCounts("playwright-report-double-throttled.json");

writeFileSync(
  `${OUT}/result.json`,
  JSON.stringify(
    {
      mode,
      durationMs: Date.now() - started,
      child,
      doubleThrottledChild,
      memoryMaxBytes: readNum("memory.max"),
      memoryPeakBytes: readNum("memory.peak"),
      workingSetPeakSampledBytes: maxWorkingSet,
      memoryEvents: readEvents(),
      playwright: counts,
      doubleThrottled,
    },
    null,
    2,
  ),
);
