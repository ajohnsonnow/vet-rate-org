import { defineConfig, devices } from "@playwright/test";

/**
 * WS-1 stress harness config — dev-hardware only, never wired into CI.
 * Driven by scripts/stress/run-cfile-stress.mjs (sets STRESS=1 / STRESS_MODE),
 * or directly: STRESS=1 npx playwright test -c playwright.stress.config.ts
 */
export default defineConfig({
  testDir: "./tests/stress",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  // 30 min per test; muster-call-batch.spec.ts raises its own budget.
  timeout: 1_800_000,
  reporter: [
    ["list"],
    // The stress runner parses this fixed path after every invocation.
    ["json", { outputFile: "audit/stress-results/last-run.json" }],
  ],

  use: {
    baseURL: "http://localhost:5197",
    // Trace/video over a 30-minute multi-GB-heap AI run produces unusable
    // artifacts; telemetry comes from the CDP sampler in tests/stress/helpers.ts.
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium-stress",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Same WebGPU flags as scripts/launch-chrome-dev.ps1 — Dawn/Vulkan
          // unlock the Warrant Council swarm on the dev GPU.
          args: [
            "--enable-dawn-features=allow_unsafe_apis,use_dxc",
            "--enable-features=Vulkan,UseSkiaRenderer",
            "--enable-unsafe-webgpu",
            "--enable-webgpu-developer-features",
          ],
        },
      },
    },
  ],

  // Mirrors playwright.config.ts: port 5197 avoids the normal dev server, and
  // reuseExistingServer stays false so a foreign server can never be tested.
  webServer: {
    command: "npm run dev -- --port 5197",
    url: "http://localhost:5197",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
