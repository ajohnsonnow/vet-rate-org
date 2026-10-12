/* eslint-disable sonarjs/no-os-command-from-path -- dev-workstation tool: ssh is resolved from the system PATH on purpose */
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { chromium } from "@playwright/test";
import { attachEvents } from "../browser.mjs";
import { PROBE_PORT } from "../constants.mjs";

const MAC_SSH_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._@:-]*$/;

/**
 * The ssh destination of the Mac, from DEVICE_LAB_MAC_SSH (or --mac-ssh,
 * which sets it). There is no default on purpose: a user name and an address
 * do not belong in a public repository.
 */
export function macHost() {
  const value = process.env.DEVICE_LAB_MAC_SSH;
  if (!value) {
    throw new Error(
      "The Mac target needs an ssh destination. Set DEVICE_LAB_MAC_SSH=user@host " +
        "(or pass --mac-ssh user@host); key-based ssh must already work.",
    );
  }
  if (!MAC_SSH_PATTERN.test(value)) {
    throw new Error(
      "DEVICE_LAB_MAC_SSH must look like user@host (letters, digits, . _ - : @ only, no leading dash)",
    );
  }
  return value;
}
export const MAC_SCRATCH = "$HOME/device-lab-scratch";
const CDP_PORT = 9333;
const SSH_OPTS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15"];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BREW = "export PATH=/opt/homebrew/bin:$PATH";

export function sshRun(command, { timeout = 60_000 } = {}) {
  return execFileSync("ssh", [...SSH_OPTS, macHost(), `${BREW}; ${command}`], {
    encoding: "utf8",
    timeout,
  });
}

/** Reverse tunnel for the app (Mac localhost:5232 -> this machine) and a forward tunnel for CDP. */
export async function startMacTunnel() {
  const child = spawn(
    "ssh",
    [
      ...SSH_OPTS,
      "-N",
      "-o",
      "ExitOnForwardFailure=yes",
      "-R",
      `${PROBE_PORT}:127.0.0.1:${PROBE_PORT}`,
      "-L",
      `${CDP_PORT}:127.0.0.1:${CDP_PORT}`,
      macHost(),
    ],
    { stdio: "ignore" },
  );
  const url = `http://localhost:${PROBE_PORT}/tools/device-lab/gpu/probe/probe.html`;
  for (let i = 0; i < 30; i++) {
    if (child.exitCode !== null)
      throw new Error(
        `ssh tunnel exited early (code ${child.exitCode}); is port ${PROBE_PORT} or ${CDP_PORT} already bound on the Mac?`,
      );
    try {
      const code = sshRun(
        `curl -s -o /dev/null -w '%{http_code}' '${url}'`,
      ).trim();
      if (code === "200") return { stop: () => child.kill() };
    } catch {
      // tunnel not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error(
    "the Mac could not reach the app through the tunnel within 30 s",
  );
}

const SAMPLER_SCRIPT = String.raw`
while :; do
  lvl=$(sysctl -n kern.memorystatus_vm_pressure_level)
  free=$(memory_pressure | awk '/free percentage/ {gsub("%","",$NF); print $NF}')
  swap=$(sysctl -n vm.swapusage | awk '{gsub("M","",$6); print $6}')
  rss=$(ps -axo rss=,command= | awk '/device-lab-scratch\/chrome-profile/ && !/awk/ {s+=$1} END {print s+0}')
  gpu=$(ioreg -r -d 1 -w0 -c AGXAccelerator | grep -o '"Alloc system memory"=[0-9]*' | head -1 | cut -d= -f2)
  echo "S $lvl $free $swap $rss $gpu"
  sleep 1
done
`;

/**
 * Memory as macOS reports it. Unified memory: the GPU driver's allocation
 * ("Alloc system memory" on the AGX accelerator) stands in for dedicated
 * memory; the pressure level (1 normal, 2 warning, 4 critical), the system
 * free percentage and swap come from sysctl/memory_pressure.
 */
export function startMacSampler() {
  const series = { gpu: [], rss: [], free: [], swap: [], level: [] };
  const b64 = Buffer.from(SAMPLER_SCRIPT).toString("base64");
  const child = spawn(
    "ssh",
    [
      ...SSH_OPTS,
      macHost(),
      `sh -c "$(echo ${b64} | base64 -d)" device-lab-sampler`,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  createInterface({ input: child.stdout }).on("line", (line) => {
    const [tag, lvl, free, swap, rss, gpu] = line.trim().split(/\s+/);
    if (tag !== "S") return;
    const t = Date.now();
    const push = (name, v, scale = 1) => {
      if (Number.isFinite(Number(v)) && v !== "")
        series[name].push({ t, v: Number(v) / scale });
    };
    push("level", lvl);
    push("free", free);
    push("swap", swap);
    push("rss", rss, 1024);
    push("gpu", gpu, 1024 * 1024);
  });
  const win = (name, from, to) =>
    series[name]
      .filter((p) => p.t >= from && p.t <= (to ?? Infinity))
      .map((p) => p.v);
  const median = (v) =>
    v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : null;
  const r = (n) => (n === null || n === undefined ? null : Math.round(n));
  return {
    preLoad: () => ({ usedMiB: series.gpu.at(-1)?.v ?? null, freeMiB: null }),
    summarize(base, from, to) {
      const baseGpu = median(win("gpu", base.from, base.to));
      const baseSwap = median(win("swap", base.from, base.to));
      const baseRss = median(win("rss", base.from, base.to));
      const gpu = win("gpu", from, to);
      const swap = win("swap", from, to);
      const rss = win("rss", from, to);
      const free = win("free", from, to);
      const level = win("level", from, to);
      return {
        dedicatedSource: "macos-agx-alloc-system-memory (unified)",
        baselineDedicatedMiB: r(baseGpu),
        baselineSharedMiB: null,
        peakDedicatedMiB: r(gpu.length ? Math.max(...gpu) : null),
        peakSharedMiB: null,
        peakDedicatedDeltaMiB:
          baseGpu === null || !gpu.length
            ? null
            : r(Math.max(...gpu) - baseGpu),
        peakSharedDeltaMiB: null,
        minFreeMiB: null,
        mac: {
          peakBrowserRssMiB: r(rss.length ? Math.max(...rss) : null),
          baselineBrowserRssMiB: r(baseRss),
          minSystemFreePercent: free.length ? Math.min(...free) : null,
          maxPressureLevel: level.length ? Math.max(...level) : null,
          baselineSwapUsedMiB: r(baseSwap),
          peakSwapUsedMiB: r(swap.length ? Math.max(...swap) : null),
          samples: gpu.length,
        },
        counterSamples: gpu.length,
      };
    },
    stop() {
      child.kill();
      try {
        sshRun("pkill -f '[d]evice-lab-sampler' || true", { timeout: 15_000 });
      } catch {
        // best effort: the loop also dies on SIGPIPE at its next write
      }
    },
  };
}

function chromeCommand() {
  const flags = [
    "--headless=new",
    `--user-data-dir="${MAC_SCRATCH}/chrome-profile"`,
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--enable-unsafe-webgpu",
    "--enable-webgpu-developer-features",
    "--window-size=1920,1080",
  ].join(" ");
  return `mkdir -p "${MAC_SCRATCH}" && (nohup "${CHROME}" ${flags} about:blank > "${MAC_SCRATCH}/chrome.log" 2>&1 & echo $!)`;
}

export function macChromeTarget() {
  return {
    platform: "macos",
    label: "Apple M1 (Google Chrome, Metal)",
    cellInfo: { browser: "Google Chrome", host: "Mac mini, Apple M1, 16 GB" },
    // Apple Silicon on Metal. This does not prove which Mac or how much RAM
    // it has: the "Apple M1, 16 GB" in cellInfo is a label, and the adapter
    // description recorded in every row is the evidence.
    adapterMatches: (info) =>
      Boolean(info) &&
      /^apple$/i.test(info.vendor ?? "") &&
      /^metal/i.test(info.architecture ?? "") &&
      /^Apple M\d/.test(info.description ?? ""),
    async launch() {
      const pid = sshRun(chromeCommand()).trim();
      let browser = null;
      for (let i = 0; i < 40 && !browser; i++) {
        try {
          browser = await chromium.connectOverCDP(
            `http://127.0.0.1:${CDP_PORT}`,
          );
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      const stopChrome = () => {
        try {
          sshRun(
            `kill ${pid} 2>/dev/null; sleep 2; pkill -f 'device-lab-scratch/chrome-profile' || true`,
            { timeout: 30_000 },
          );
        } catch {
          // already gone
        }
      };
      if (!browser) {
        stopChrome();
        throw new Error("could not attach to Chrome on the Mac over CDP");
      }
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = await context.newPage();
      const events = attachEvents(page, context);
      return {
        context,
        page,
        events,
        async close() {
          await browser.close().catch(() => {});
          stopChrome();
        },
      };
    },
    startSampler: startMacSampler,
  };
}
