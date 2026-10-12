import { defineConfig } from "vite";
import baseConfig from "../../../vite.config.js";

import { PROBE_PORT } from "./lib/constants.mjs";

// Browsers that cannot be driven (Safari, the iOS Simulator) post their own
// measurements here; run.mjs polls GET /__device-lab/result?run=<id>.
function collectorPlugin() {
  const runs = new Map();
  const ERROR_STAGES = /-failed$|^script-error$|^unhandled-rejection$/;
  return {
    name: "device-lab-collector",
    configureServer(server) {
      server.middlewares.use("/__device-lab/result", (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.method === "GET") {
          const id = new URL(req.url, "http://localhost").searchParams.get(
            "run",
          );
          return send(200, runs.get(id) ?? {});
        }
        if (req.method !== "POST") return send(405, { error: "method" });
        let raw = "";
        req.on("data", (d) => {
          raw += d;
          if (raw.length > 200_000) req.destroy();
        });
        req.on("end", () => {
          try {
            const {
              runId,
              stage,
              errors: _e,
              stages: _s,
              ...fields
            } = JSON.parse(raw);
            if (typeof runId !== "string") return send(400, { error: "runId" });
            const run = runs.get(runId) ?? { errors: [], stages: [] };
            run.stages.push(stage);
            if (ERROR_STAGES.test(stage)) run.errors.push({ stage, ...fields });
            else Object.assign(run, fields);
            if (stage === "done") run.done = true;
            runs.set(runId, run);
            send(200, { ok: true });
          } catch {
            send(400, { error: "json" });
          }
        });
      });
    },
  };
}

// The app-path cross-check (lib/appCheck.mjs) runs the real app, whose inference
// worker the probe cannot wrap. This prepends the probe's requestDevice hook to
// that worker on the lab's dev server only, so a lost device is reported over
// the same BroadcastChannel; it observes and changes nothing, and src/ is not edited.
function appWorkerHookPlugin() {
  return {
    name: "device-lab-app-worker-hook",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0].replaceAll("\\", "/");
      if (!path.endsWith("/src/workers/webllm-swarm-worker.js")) return null;
      return {
        code: `import "/tools/device-lab/gpu/probe/device-hook.js";\n${code}`,
        map: null,
      };
    },
  };
}

export default defineConfig((env) => {
  const base = typeof baseConfig === "function" ? baseConfig(env) : baseConfig;
  return {
    ...base,
    plugins: [
      ...(base.plugins ?? []),
      collectorPlugin(),
      appWorkerHookPlugin(),
    ],
    server: {
      ...base.server,
      port: PROBE_PORT,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  };
});
