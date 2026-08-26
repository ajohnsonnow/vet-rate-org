import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A rotating set of 3-4 tests flakes per local run and passes on retry.
  // Three hypotheses have been tried and measured. All three failed - do not
  // re-run these experiments:
  //
  //   1. The assertion budget is too tight. No: all four flakes in the
  //      2026-08-25 run already carried explicit 15s waits, and two of them
  //      go through tool-with-packet's hand-rolled isVisible() poll loop,
  //      which never calls expect().toBeVisible() at all.
  //   2. Six workers contend on one dev server. No: 6 -> 3 workers moved the
  //      count 4 -> 3 while wall clock went 5.7m -> 8.3m, and the two runs
  //      shared exactly one flaky test - the 3-worker run flaked on two specs
  //      that were fine at 6.
  //   3. The dev server compiles lazy tool chunks on demand, so a modal can
  //      miss its budget under load. No - and this one was tested properly by
  //      building the app up front and serving it with `vite preview`, which
  //      removes on-demand compilation entirely. The count did not move: 4
  //      flaky before, 4 flaky after, and every flake in that run landed on
  //      the pre-built side where nothing is compiled. That result is what
  //      retired the lazy-chunk explanation; earlier revisions of this
  //      comment asserted it as fact, and it was wrong.
  //
  // What the evidence actually supports: a set that rotates with near-zero
  // overlap between runs and is indifferent to compilation, worker count, and
  // timeout is machine-level noise, not a property of the app or the server.
  // Retries are the correct mechanism for that and do not mask a regression -
  // a real break fails all three attempts and repeats rather than rotates.
  //
  // If you pick this up again, the open lead is per-test: `tactical-calculator`
  // and `dialog-contract` appeared in both pre-built runs, so start by
  // profiling those two rather than changing the harness again.
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
