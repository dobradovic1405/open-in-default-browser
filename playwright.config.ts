import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the "Open in Default Browser" extension.
 *
 * Test layout:
 *   tests/unit/         Mocha in plain Node: pure helpers in lib/ (npm run test:unit)
 *   tests/fixtures/     Playwright: checks the sample files in testdata/ (npm run test:fixtures)
 *   tests/integration/  Mocha inside VS Code: extension behaviour (npm run test:extension)
 *   tests/e2e/          Mocha inside VS Code + Chromium/Edge: pages in a real browser (npm run test:extension)
 *   tests/manual/       Manual test plan for behaviour that needs VS Code (not automated)
 *   tests/mutation/     Mutation tests: deliberate bugs that the suites must catch
 *   tests/testdata/     Sample files used by the tests
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/fixtures',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // The JSON file feeds the stakeholder report (report/build-report.js).
  reporter: [['html'], ['json', { outputFile: '.vscode-test/playwright-results.json' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
