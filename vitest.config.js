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
        // Large portions of src/ (WebLLM, OCR workers, 150+ React components) require
        // real browser/GPU — unit testing them in jsdom is not meaningful.
        // Raise these incrementally as new unit tests are added.
        lines: 35,
        functions: 28,
        branches: 25,
        statements: 35,
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
