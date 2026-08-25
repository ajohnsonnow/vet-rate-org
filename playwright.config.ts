import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Local runs share one Vite dev server, which compiles each lazily-loaded
  // tool chunk on first request. A handful of tests miss their render budget
  // under that contention and pass on retry. Two fixes were tried and
  // measured, and neither worked:
  //
  //   1. Raising the assertion budget. All four flakes in the 2026-08-25 run
  //      already carried explicit 15s waits and still lost. More waiting buys
  //      nothing when 15s was already not enough.
  //   2. Dropping workers 6 -> 3. Flaky count went 4 -> 3 while wall clock
  //      went 5.7m -> 8.3m, and the two runs shared exactly one flaky test
  //      between them - the 3-worker run flaked on two specs that were fine
  //      at 6. A rotating set with near-zero overlap is machine-level noise,
  //      not worker-count contention.
  //
  // Retries are the right mechanism for that, and they do not mask a real
  // break: a genuine regression fails all three attempts, and the flake set
  // would repeat rather than rotate. Local matches CI's retry count rather
  // than getting a weaker budget than the serial environment that needs it
  // less.
  //
  // The structural fix is to serve a built bundle (vite build + preview) so
  // no chunk is ever compiled on demand. Not done here: it changes what the
  // suite exercises, and several specs filter dev-only React warnings.
  retries: 2,
  workers: process.env.CI ? 1 : 6,

  // Aligns the default with the 15s waits already written into individual
  // specs, so a new assertion gets the same budget without repeating it.
  // A tool that never renders still fails - 15s later rather than 5s.
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "html",

  use: {
    // Use 127.0.0.1 (not "localhost"): Playwright's Firefox resolves localhost
    // to IPv6 ::1, but Vite binds IPv4 only, so every page.goto hangs to timeout
    // under the firefox project. Forcing IPv4 fixes the 12 firefox E2E timeouts.
    baseURL: "http://127.0.0.1:5197",
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
    command: "npm run dev -- --port 5197 --host 127.0.0.1",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
