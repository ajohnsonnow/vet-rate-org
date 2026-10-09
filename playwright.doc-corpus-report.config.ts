// Dedicated config for the real document-corpus ingestion report spec.
// Single chromium worker on its own Vite server (port 5198) so it never
// contends with the default e2e run (5197) or the C-File dataflow run (5199).
// Drives real extraction/classification/storage via injected production
// modules (no WebGPU/AI required — verified headless Chromium has no
// navigator.gpu, so the app's own AI-gated paths self-skip).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /document-corpus-import-report\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5198",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: { downloadsPath: "./test-results/downloads" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5198",
    url: "http://localhost:5198",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
