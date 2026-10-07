import { defineConfig } from "vite";
import stressConfig from "./vite.stress.config.js";

/**
 * Dev-server variant for the golden-set evaluation only: the stress config
 * (HMR off, so an edit elsewhere cannot reload the page mid-run) on port
 * 5199 instead of 5198. Never used by the app, the e2e suite, or CI.
 */
export default defineConfig((env) => {
  const resolved =
    typeof stressConfig === "function" ? stressConfig(env) : stressConfig;
  return {
    ...resolved,
    server: { ...resolved.server, port: 5199 },
  };
});
