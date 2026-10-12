import { defineConfig, devices } from "@playwright/test";

const PORT = 5232;

// Runs inside the container, from /app. These three specs build their own
// synthetic input (a generated text file, a generated PDF, a synthetic canvas
// and an in-page PDF) and read nothing from docs/test-data.
const IMPORT_SPECS = [
  /cfile-segmentation-latency\.spec\.ts$/,
  /dkb-import-latency\.spec\.ts$/,
  /advanced-ocr-perf\.spec\.ts$/,
];

// These specs add their own 4x CPU throttle (CDP) on top of the container's
// CPU cap, so a failure there measures the harness, not the container. The
// main run leaves them out so its pass/fail reflects the container limits
// only; container-run.mjs then runs just these, reported as a separate
// "double-throttled, not a device result" group.
const SELF_THROTTLED = /CPU throttle/;
const DOUBLE_THROTTLED = process.env.DOCKER_DOUBLE_THROTTLED === "1";

export default defineConfig({
  testDir: "../../../tests/e2e",
  testMatch: IMPORT_SPECS,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  expect: { timeout: 15_000 },
  grep: DOUBLE_THROTTLED ? SELF_THROTTLED : undefined,
  grepInvert: DOUBLE_THROTTLED ? undefined : SELF_THROTTLED,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: DOUBLE_THROTTLED
          ? "/out/playwright-report-double-throttled.json"
          : "/out/playwright-report.json",
      },
    ],
  ],
  outputDir: "/tmp/pw-output",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: { downloadsPath: "/tmp/pw-downloads" },
  },
  projects: [{ name: "chromium-container" }],
  webServer: {
    command: `npx vite preview --config tools/device-lab/docker/vite.docker.config.js --mode e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: "/app",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
