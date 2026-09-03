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
  //   7. Cross-test interference - state or resources accumulating across
  //      tests that share a browser and dev server. No: running each spec file
  //      on its own, with a fresh browser AND a fresh dev server, gave exactly
  //      the same 4 failures / 84 as the mixed run at workers=1.
  //   8. openTool fires its CustomEvent once and cannot recover if that
  //      dispatch does not take, unlike dialog-contract which re-dispatches
  //      inside expect.poll. Making it re-dispatch did NOT help and actively
  //      hurt: the count stayed at 2/69 but moved onto "Tactical Calculator
  //      shows at least one condition from the fixture", which had been
  //      passing and then failed 2 runs out of 3. Reverted. Do not reapply.
  //
  // Where it actually lives, measured per-file in isolation (repeat-each=2,
  // retries=0, workers=1):
  //
  //     tool-with-packet     3 failed / 46
  //     dialog-contract      1 failed / 12
  //     error-boundary       0 / 8       tactical-calculator  0 / 6
  //     duty-station-map     0 / 6       simulators-a11y      0 / 6
  //
  // Four of six are perfectly clean on their own, so this is not a suite-wide
  // or environmental property - it is intrinsic to those two files. Both drive
  // React.lazy tool modals behind <Suspense fallback={null}>, where nothing is
  // in the DOM between the event firing and the chunk resolving. But a
  // targeted loop opening the two implicated tools 20 times reproduced nothing
  // (0/20), so the trigger needs the long sequence of tests in a real file
  // run, not the tool in isolation. That is the open thread.
  //
  //
  // Measurement rig - reproduces a ~6% failure rate in ~3 minutes, which is
  // far denser than the ~1% you get from a full-suite run:
  //
  //   npx playwright test --project=chromium --repeat-each=3 --retries=0 --workers=6 --reporter=list tests/e2e/tool-with-packet.spec.ts tests/e2e/error-boundary.spec.ts tests/e2e/dialog-contract.spec.ts tests/e2e/tactical-calculator.spec.ts tests/e2e/duty-station-map.spec.ts tests/e2e/simulators-a11y.spec.ts
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
