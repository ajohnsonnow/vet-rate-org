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
        lines: 38,
        functions: 45,
        branches: 24,
        statements: 37,
      },
      exclude: [
        "src/_deprecated/**",
        "src/examples/**",
        "src/debug/**",
        "src/workers/**", // WebWorkers — require real browser
        "src/contexts/**", // React contexts — require component tree
        "src/components/**", // 150+ UI components — E2E tested via Playwright
        "src/**/*.test.{js,jsx}",
        "src/test/**",
        "src/__tests__/**",
      ],
    },
  },
});
