import { defineConfig } from "@playwright/test";
import stressConfig from "./playwright.stress.config";

/**
 * Golden-set evaluation config: dev-hardware only, never wired into CI, and
 * not part of the default `playwright test` (testDir ./tests/e2e) or any
 * stress run. Driven by scripts/eval/run-golden-set.mjs, which sets EVAL=1.
 *
 * Reuses the stress config's headed WebGPU Chromium launch arguments, so the
 * evaluation runs on the same GPU path the stress harness proves out, but on
 * its own port (5199) so it cannot collide with a stress run (5198) or the
 * normal dev server (5173). reuseExistingServer is false: silently reusing a
 * foreign server would evaluate the wrong source tree.
 */
export default defineConfig({
  ...stressConfig,
  testDir: "./tests/eval",
  outputDir: "test-results/golden-set-eval",
  timeout: 21_600_000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/golden-set-eval-report.json" }],
  ],
  use: {
    ...stressConfig.use,
    baseURL: "http://localhost:5199",
  },
  webServer: {
    command: "npx vite --config vite.eval.config.js",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
