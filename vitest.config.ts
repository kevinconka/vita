import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // lcov for Codecov, text for the terminal, json-summary for the badge.
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        // Thin command layer: argument parsing and console.log, exercised
        // end-to-end by the `vita build ml-lead` step in CI instead.
        'src/cli.ts',
      ],
      // Set just under the current numbers: high enough to catch a real
      // regression, loose enough not to fail on a one-line refactor.
      // `renderPdf`/`renderScreenshot` are the main uncovered block — they
      // drive a real browser, and CI's `vita build ml-lead` step covers them.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 82,
        statements: 88,
      },
    },
  },
});
