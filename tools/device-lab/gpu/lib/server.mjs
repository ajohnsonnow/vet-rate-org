/* eslint-disable sonarjs/no-os-command-from-path -- dev-workstation tool: nvidia-smi, powershell and taskkill are resolved from the system PATH on purpose */
import { execFileSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROBE_PORT } from "./constants.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "../../../..");

function portInUse(port) {
  return new Promise((done) => {
    const s = createConnection({ port, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      done(true);
    });
    s.once("error", () => done(false));
  });
}

export async function startDevServer() {
  if (await portInUse(PROBE_PORT)) {
    throw new Error(
      `port ${PROBE_PORT} is already in use; stop whatever holds it (a leftover probe server) and run again`,
    );
  }
  // nosemgrep: local.detect-child-process-strict,javascript.lang.security.detect-child-process.detect-child-process
  const child = spawn(
    process.execPath,
    [
      resolve(REPO_ROOT, "node_modules/vite/bin/vite.js"),
      "--config",
      resolve(here, "../vite.config.mjs"),
    ],
    { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const url = `http://localhost:${PROBE_PORT}/tools/device-lab/gpu/probe/probe.html`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(
        `vite exited early (code ${child.exitCode}):\n${log.slice(-1500)}`,
      );
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline)
      throw new Error(
        `vite did not serve ${url} within 90 s:\n${log.slice(-1500)}`,
      );
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    url,
    stop() {
      if (child.exitCode !== null) return;
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } catch {
        child.kill();
      }
    },
  };
}
