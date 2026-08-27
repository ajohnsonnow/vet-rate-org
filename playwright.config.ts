import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A rotating set of tests flakes per local run and passes on retry. Six
  // hypotheses have been measured and ALL are dead. Do not re-run these:
  //
  //   1. Assertion budgets too tight. No - the flakes already carried explicit
  //      15s waits, and some go through hand-rolled isVisible() poll loops
  //      that never call expect() at all.
  //   2. Worker contention. No - and this is now measured properly rather than
  //      inferred from one full-suite run. See the rig below: 4.8% at
  //      workers=1, 9.5% at 2, 6.0% at 4, 6.6% at 6. Worker count does
  //      nothing; the band is flat.
  //   3. Dev server compiling lazy chunks on demand. No - building up front
  //      and serving with `vite preview` removes on-demand compilation
  //      entirely and the count did not move (4 flaky before, 4 after).
  //   4. useFocusTrap corrupting the focus-restore target. No - A/B under
  //      6-worker load passed 36/36 both with and without the bug. (The bug
  //      was real and is fixed separately; it was not this.)
  //   5. Animation/transition races. No - forcing `reducedMotion: "reduce"`
  //      (src/index.css already zeroes all durations) gave 23 failures/378 vs
  //      27/378 control. ~0.6 standard errors. Noise.
  //   6. Chrome backgrounding/timer throttling. No - the three
  //      --disable-*-backgrounding flags gave 7 failures/126 vs 6/126.
  //
  // What IS known: individual specs pass in isolation (duty-station-map is
  // 15/15 alone, serially) but the same specs fail ~5% inside a mixed run,
  // AT WORKERS=1. That rules out concurrency and points at cross-test
  // interference - state or resource accumulation across tests sharing a
  // browser and dev server. That is where to look next. It is not the
  // harness, and it is not the machine (16c/32t, 72GB free).
  //
  // Measurement rig - reproduces a ~6% failure rate in ~3 minutes, which is
  // far denser than the ~1% you get from a full-suite run:
  //
  //   npx playwright test --project=chromium   //     tests/e2e/{tool-with-packet,error-boundary,dialog-contract,  //     tactical-calculator,duty-station-map,simulators-a11y}.spec.ts   //     --repeat-each=3 --retries=0 --workers=6 --reporter=list
  //
  // Parse the summary with ANSI stripped. The `line` reporter prefixes it
  // with cursor codes, so an anchored grep like `^ *[0-9]+ failed` silently
  // matches nothing and a failing run reads as clean - that mistake produced
  // a confident and completely wrong "0 failures" curve once already:
  //
  //   ... | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' | grep -E "^ *[0-9]+ (failed|passed)"
  //
  // Retries stay as the mitigation. They do not mask a regression: a real
  // break fails all three attempts and repeats rather than rotates.
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
