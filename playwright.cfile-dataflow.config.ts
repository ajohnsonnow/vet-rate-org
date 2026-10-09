// Dedicated config for the C-File → canonical VKB dataflow regression spec.
// Single chromium worker on its own Vite server (port 5199) so it never
// contends with the default e2e run (5197) or the local dev server (5173).
// The spec drives IndexedDB + AI-context builders only (no WebGPU), so
// headless Desktop Chrome is sufficient.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /cfile-canonical-dataflow\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5199",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: { downloadsPath: "./test-results/downloads" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5199",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
