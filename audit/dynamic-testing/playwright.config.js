// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * VetRate Autonomous Audit — Playwright Configuration
 * 
 * This config spins up the Vite dev server automatically before running tests,
 * waits for it to be ready, then runs the full browser-based audit suite.
 * 
 * Key design decisions:
 *   - Uses Chromium only (matches 85%+ user base)
 *   - Traces enabled on first retry (for debugging failures)
 *   - Screenshots on failure (visual evidence of bugs)
 *   - Videos retained on failure (full replay capability)
 *   - Network interception ready (for API mocking)
 */
export default defineConfig({
  testDir: './tests',
  
  // Run tests sequentially within files for predictable state
  fullyParallel: false,
  
  // Retry once on failure (and capture trace on retry)
  retries: 1,
  
  // Single worker (state-dependent UI tests)
  workers: 1,
  
  // 60 second timeout per test (some components load AI models)
  timeout: 60_000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10_000
  },

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: '../reports/playwright-html', open: 'never' }],
    ['json', { outputFile: '../reports/playwright-results.json' }],
    ['list']  // Console output during CI
  ],

  use: {
    // Base URL set by webServer below
    baseURL: 'http://localhost:5173',
    
    // Trace on first retry (captures DOM snapshots, network, console)
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Viewport (standard desktop)
    viewport: { width: 1280, height: 720 },
    
    // Reduce animation noise
    reducedMotion: 'reduce',
    
    // Capture console logs
    javaScriptEnabled: true,
    
    // By default, accept the disclaimer/TOS
    storageState: undefined
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],

  // Automatically start the Vite dev server before tests
  webServer: {
    command: 'npx vite --port 5173',
    cwd: '../../',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
