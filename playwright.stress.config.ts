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
  // 12h ceiling: 284 AI chunks (document-boundary chunking, down from 304)
  // × ~100 s/chunk observed (p50 varies: ~64 s/chunk for military records,
  // ~120 s/chunk for dense medical records) + ~45 min first-run warmup
  // (WebGPU shader JIT + model download) = ~9.2h expected. 12h gives 2.8h margin.
  // History: br7dlofgw timed out under the old 4h ceiling with ~5K-char chunks at
  // ~55 s/chunk; feat/3d7f3f4 expanded chunks to 28K; b7qly4srg timed out at the
  // old 8h ceiling at ~283/284 chunks (medical records section ran ~120 s/chunk).
  timeout: 43_200_000,
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
          // New headless mode (--headless=new) has no physical display output,
          // so there's no DWM cross-adapter copy. That makes it safe to force
          // the GPU process onto the 4080 SUPER (--force-high-performance-gpu)
          // without the GPU timeline stalls that killed inference speed in
          // headed mode when the display was on a different adapter (5060 Ti).
          // Note: old --headless exposed no WebGPU adapter on Windows; the new
          // headless path (Playwright 1.44+ default) uses the full GPU stack.
          // Headed is required: headless Chrome on Windows does not expose a
          // WebGPU hardware adapter (navigator.gpu.requestAdapter() returns
          // null), making the Warrant Council unavailable and the Analyze
          // button permanently disabled.  The display adapter (RTX 5060 Ti)
          // is also the WebGPU inference adapter — Chrome's GPU process and
          // display are co-located on it, so there is no cross-adapter copy
          // overhead.  AI compute and display rendering run on separate GPU
          // engine partitions and do not contend.
          headless: false,
          args: [
            "--enable-dawn-features=allow_unsafe_apis,use_dxc",
            "--enable-features=Vulkan,UseSkiaRenderer",
            "--enable-unsafe-webgpu",
            "--enable-webgpu-developer-features",
            // 4080 SUPER is now the primary display adapter — force-high-performance-gpu
            // selects it for the GPU process with no cross-adapter copy penalty.
            "--force-high-performance-gpu",
          ],
        },
      },
    },
  ],

  webServer: {
    command: "npm run dev -- --port 5197",
    url: "http://localhost:5197",
    // Allow reusing a manually-started Vite dev server (e.g. started via
    // scripts/launch-chrome-dev.ps1 or nohup npm run dev); the test code
    // validates the server is serving the expected app via page.goto assertions.
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
