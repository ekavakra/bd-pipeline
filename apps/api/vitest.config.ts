import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/index.ts', 'src/worker.ts'],
      thresholds: {
        // Enforce minimum coverage
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
