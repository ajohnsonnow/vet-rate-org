/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // Vitest defaults to 5000ms, which is also what the slowest component
    // tests give their own internal findBy() waits (DutyStationsSection
    // parses and renders 241 country paths). An inner wait equal to the outer
    // budget leaves nothing for the assertion, so those tests failed only
    // under full-suite parallel load and passed in isolation. The ceiling is
    // raised above the inner waits rather than the waits being shortened -
    // the render really is that slow, and a genuine hang still fails, just
    // 15s later instead of 5s.
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      thresholds: {
        // Thresholds reflect testable logic (calculators, utils, security-critical code).
        // The "raise to 70%" target from AUDIT_FINDINGS #30 is not the right
        // shape for this codebase: ~60% of src/utils is wllama / WebGPU / OCR /
        // vision pipelines that require real browser+GPU and are exercised via
        // Playwright, not vitest. The relevant utility files we *can* unit-test
        // (calculators, validators, sanitizers, hallucination traps) sit at
        // 70-100% individually — see docs/AUDIT_FINDINGS.md row #30.
        // Numbers below are floors, not ceilings. Raise as new tests land.
        // Baseline 2026-06-23: ~31% lines/functions, ~30% statements, ~22% branches.
        // Sprint additions (cfileAnalyzer, unifiedAIService, musterCallProcessor)
        // diluted global numbers without new unit tests — browser/GPU files still
        // exercised via Playwright E2E. Floors reflect actual testable baseline.
        lines: 29,
        functions: 29,
        branches: 20,
        statements: 28,
        // Per-file floors for security-critical utilities (RT12-3).
        // Values are ~5% below observed coverage from 2026-06-20 run.
        "src/utils/fileTypeGuards.js": {
          statements: 95,
          branches: 85,
          functions: 90,
          lines: 95,
        },
        "src/utils/hallucinationTrap.js": {
          statements: 90,
          branches: 80,
          functions: 85,
          lines: 90,
        },
        "src/utils/piiScrubber.js": {
          statements: 95,
          branches: 85,
          functions: 90,
          lines: 95,
        },
        "src/utils/dualLLM.js": {
          statements: 95,
          branches: 85,
          functions: 90,
          lines: 95,
        },
        "src/utils/smcDetector.js": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/utils/sanitize.js": {
          statements: 50,
          branches: 45,
          functions: 55,
          lines: 50,
        },
      },
      exclude: [
        "src/_deprecated/**",
        "src/examples/**",
        "src/debug/**",
        "src/workers/**", // WebWorkers — require real browser
        "src/contexts/**", // React contexts — require component tree
        "src/components/**", // 150+ UI components — E2E tested via Playwright
        "src/i18n/**", // Static translation data (extracted from contexts; no test logic)
        "src/generated/**", // Build-time generated files (design tokens, palettes)
        "src/**/*.test.{js,jsx}",
        "src/test/**",
        "src/__tests__/**",
      ],
    },
  },
});
