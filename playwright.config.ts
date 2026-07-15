import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Local runs share one Vite dev server across 6 parallel workers — under
  // heavy contention a handful of tests can miss a tight render/timing budget
  // even though every one of them passes reliably in isolation (confirmed:
  // two consecutive full local runs produced two entirely different sets of
  // failures, zero overlap — non-deterministic contention, not a real bug).
  // 1 retry absorbs that without masking a genuine regression, matching why
  // CI already retries under its own (serial) execution model.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 6,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "html",

  use: {
    baseURL: "http://localhost:5197",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // PDF/export-triggering tests (e.g. jsPDF's doc.save()) fire a real
    // browser download; without an explicit target it lands in the repo root
    // (process cwd) and gets swept into the next `git add -A` release commit
    // — happened twice this cycle before this was added. test-results/ is
    // already gitignored.
    launchOptions: {
      downloadsPath: "./test-results/downloads",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      // axe page.evaluate() can be slow on large dialogs in Firefox — double the timeout.
      timeout: 60_000,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Spin up Vite dev server before tests. Port 5197 avoids collisions with the
  // normal dev server (5173) and any other long-running Vite processes.
  // reuseExistingServer is always false: silently reusing a foreign server (e.g.
  // a different project's dev server) produces axe results for the wrong app.
  webServer: {
    command: "npm run dev -- --port 5197",
    url: "http://localhost:5197",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
