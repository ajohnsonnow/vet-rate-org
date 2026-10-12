/* eslint-disable sonarjs/no-os-command-from-path -- dev-workstation tool: ssh is resolved from the system PATH on purpose */
import { execFileSync } from "node:child_process";
import { PROBE_PORT } from "./constants.mjs";
import {
  MAC_SCRATCH,
  macHost,
  sshRun,
  startMacSampler,
} from "./targets/mac.mjs";

const BASE = `http://localhost:${PROBE_PORT}/tools/device-lab/gpu/probe`;
const LOCAL = `http://127.0.0.1:${PROBE_PORT}/__device-lab/result`;

async function fetchRun(runId) {
  const res = await fetch(`${LOCAL}?run=${encodeURIComponent(runId)}`);
  return res.json();
}

async function waitForDone(runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await fetchRun(runId);
    if (r.done) return { ...r, timedOut: false };
    if (Date.now() > deadline) return { ...r, timedOut: true };
    await new Promise((res) => setTimeout(res, 2000));
  }
}

function surveyUrl(runId, model) {
  const suffix = model ? "&model=" + encodeURIComponent(model) : "";
  return `${BASE}/survey.html?run=${runId}${suffix}`;
}

export async function surveyDesktopSafari({ model, timeoutMs }) {
  const runId = `safari-desktop-${Date.now()}`;
  const wasRunning = sshRun("pgrep -x Safari || true").trim() !== "";
  try {
    sshRun(`open -a Safari '${surveyUrl(runId, model)}'`);
    const survey = await waitForDone(runId, timeoutMs);
    const layoutId = `${runId}-layout`;
    sshRun(`open -a Safari '${BASE}/layout.html?run=${layoutId}'`);
    const layout = await waitForDone(layoutId, 90_000);
    return {
      target: "Safari on macOS",
      survey,
      layout,
      safariWasRunning: wasRunning,
    };
  } finally {
    // Only a Safari this run started is closed; a Safari the user had open is left alone.
    if (!wasRunning) sshRun("pkill -x Safari || true");
  }
}

function simctl(args, timeout = 120_000) {
  return sshRun(`xcrun simctl ${args}`, { timeout });
}

function openUrlWithRetry(udid, url) {
  for (let i = 0; ; i++) {
    try {
      return simctl(`openurl ${udid} '${url}'`);
    } catch (err) {
      if (i >= 3) throw err;
      sshRun("sleep 15");
    }
  }
}

export function findSimulator(namePattern) {
  const list = JSON.parse(simctl("list devices available -j"));
  for (const [runtime, devices] of Object.entries(list.devices)) {
    if (!runtime.includes("iOS")) continue;
    const hit = devices.find((d) => namePattern.test(d.name));
    if (hit) return { ...hit, runtime };
  }
  throw new Error(`no available iOS simulator matches ${namePattern}`);
}

export async function surveySimulator({
  name,
  pattern,
  model,
  timeoutMs,
  screenshotDir,
}) {
  const sim = findSimulator(pattern);
  const wasBooted = sim.state === "Booted";
  if (!wasBooted) simctl(`boot ${sim.udid}`);
  const out = {
    target: `iOS Simulator: ${sim.name} (${sim.runtime})`,
    name,
  };
  try {
    simctl(`bootstatus ${sim.udid}`, 240_000);
    const runId = `sim-${name}-${Date.now()}`;
    openUrlWithRetry(sim.udid, surveyUrl(runId, model));
    out.survey = await waitForDone(runId, timeoutMs);
    const layoutId = `${runId}-layout`;
    openUrlWithRetry(sim.udid, `${BASE}/layout.html?run=${layoutId}`);
    out.layout = await waitForDone(layoutId, 90_000);
    const remote = `${MAC_SCRATCH}/${name}.png`;
    simctl(`io ${sim.udid} screenshot "${remote}"`);
    if (screenshotDir) {
      execFileSync("scp", [
        "-o",
        "BatchMode=yes",
        `${macHost()}:device-lab-scratch/${name}.png`,
        `${screenshotDir}/${name}.png`,
      ]);
    }
    return out;
  } finally {
    if (!wasBooted) {
      try {
        simctl(`shutdown ${sim.udid}`);
      } catch {
        // already down
      }
    }
  }
}

export { startMacSampler };
