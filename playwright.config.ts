import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 6,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "html",

  use: {
    // Use 127.0.0.1 (not "localhost"): Playwright's Firefox resolves localhost
    // to IPv6 ::1, but Vite binds IPv4 only, so every page.goto hangs to timeout
    // under the firefox project. Forcing IPv4 fixes the 12 firefox E2E timeouts.
    baseURL: "http://127.0.0.1:5197",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
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
