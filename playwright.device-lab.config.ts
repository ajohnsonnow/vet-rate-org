import { defineConfig } from "@playwright/test";
import { projectsFor, type DeviceLabOptions } from "./tools/device-lab";

const PORT = 5231;

// One project per hardware profile in tools/device-lab/profiles. The app runs
// as `vite --mode e2e` so @mlc-ai/web-llm is the fake in tests/e2e/fakes and
// no model is ever downloaded. A profile spoofs what the page is told
// (navigator fields, the WebGPU adapter); it does not make any model load or
// run like that hardware. reuseExistingServer is false for the same reason as
// playwright.config.ts: a foreign server on the port would test another app.
export default defineConfig<DeviceLabOptions>({
  testDir: "./tests/device-lab",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: "./test-results/device-lab",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The dev server serves hundreds of unbundled modules; at the phone
    // profiles' 1.6 Mbps page.goto does not finish inside 90 s. Network
    // conditions are exercised by tools/device-lab/selftest.
    applyNetwork: false,
  },
  projects: projectsFor(),
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1 --mode e2e`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
