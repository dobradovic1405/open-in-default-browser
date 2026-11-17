/**
 * Starts VS Code (downloaded once into .vscode-test/) with this extension loaded
 * and runs the Mocha suites inside the extension host.
 *
 * Usage:
 *   node tests/integration/runTests.js               all extension tests
 *   node tests/integration/runTests.js --grep @smoke       only tests whose title contains @smoke
 *   node tests/integration/runTests.js --exclude @smoke    all tests except those with @smoke
 */
const fs = require('fs');
const path = require('path');
const { runTests } = require('@vscode/test-electron');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspace = path.join(repoRoot, 'tests', 'testdata');
// A fresh user-data folder keeps the tests away from the user's own VS Code settings.
const userData = path.join(repoRoot, '.vscode-test', 'user-data');

const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || '' : undefined;
};
const include = argValue('--grep');
const exclude = argValue('--exclude');
const grep = include ?? exclude ?? '';
const invert = exclude !== undefined;

(async () => {
  // Some shells set ELECTRON_RUN_AS_NODE=1, which makes VS Code run as plain Node and fail.
  delete process.env.ELECTRON_RUN_AS_NODE;
  fs.rmSync(userData, { recursive: true, force: true });
  await runTests({
    extensionDevelopmentPath: repoRoot,
    extensionTestsPath: path.join(__dirname, 'host-index.js'),
    extensionTestsEnv: {
      TEST_GREP: grep,
      TEST_INVERT: invert ? '1' : '0',
      TEST_RESULTS_FILE: path.join(repoRoot, '.vscode-test', 'mocha-results.json'),
    },
    launchArgs: [
      workspace,
      `--user-data-dir=${userData}`,
      '--disable-extensions',
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
    ],
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
