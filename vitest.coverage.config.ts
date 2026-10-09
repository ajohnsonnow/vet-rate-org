import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text','json','lcov','html'],
      thresholds: { branches: 75, functions: 80, lines: 80, statements: 80 },
      exclude: ['**/*.d.ts','**/node_modules/**','**/coverage/**','**/dist/**','**/*.test.ts','**/*.spec.ts','**/tests/**','**/__tests__/**','**/*.config.*'],
      reportsDirectory: './coverage',
    },
    reporter: process.env.CI ? ['verbose','json'] : ['verbose'],
    environment: 'node',
  },
})
