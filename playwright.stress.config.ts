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
  // 8h per test: the full 313MB pipeline is generation-bound (measured
  // ~50s/chunk x 304 chunks ≈ 4.5-5h on an RTX 5060 Ti) — the budget must
  // comfortably outlast the slowest honest run, not race it.
  timeout: 28_800_000,
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
          // Headed: default headless Chromium exposes no WebGPU adapter on
          // Windows ("No available adapters"), which silently keeps the
          // Warrant Council from loading and the Analyze button disabled.
          headless: false,
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
