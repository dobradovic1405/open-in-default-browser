/**
 * Runs the whole test suite in the order and with the parallelism described in docs/DECISIONS.md:
 *
 *   1. Smoke gate (VS Code): @smoke tests run first. If one fails, the rest of the VS Code tests are skipped.
 *   2. Rest (VS Code): all other integration and end-to-end tests. Runs only if the smoke gate passed.
 *   3. Fixtures (Playwright) and unit (Mocha in Node): run in parallel with steps 1 and 2. They share no state with VS Code.
 *
 * The exit code is non-zero if any part failed. The merged Mocha results go to
 * .vscode-test/mocha-results.json for the quality report.
 *
 * Usage: node tests/run-all.js
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const resultsDir = path.join(root, '.vscode-test');
const mochaResults = path.join(resultsDir, 'mocha-results.json');
fs.mkdirSync(resultsDir, { recursive: true });

function run(label, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`[${label}] start`);
    const child = spawn(args[0], args.slice(1), {
      cwd: root,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      const seconds = Math.round((Date.now() - started) / 1000);
      console.log(`[${label}] ${code === 0 ? 'passed' : `FAILED (exit ${code})`} after ${seconds} s`);
      resolve(code ?? 1);
    });
  });
}

const readResults = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).results || [] : []);

(async () => {
  const started = Date.now();

  // Fixture checks run in parallel with the VS Code tests (separate processes, no shared state).
  const fixturesPromise = run('fixtures (Playwright)', ['npx', 'playwright', 'test']);
  const unitPromise = run('unit (Mocha, Node)', ['node', 'tests/unit/run-unit.js']);

  // 1. Smoke gate.
  const smokeCode = await run('smoke gate (VS Code)', ['node', 'tests/integration/runTests.js', '--grep', '@smoke']);
  const smokeResults = readResults(mochaResults);
  let restCode = null;
  let restResults = [];

  // 2. Rest, only if the gate passed.
  if (smokeCode === 0) {
    // Remove the smoke file first, so a crashed rest run cannot leave smoke results to be counted twice.
    fs.rmSync(mochaResults, { force: true });
    restCode = await run('rest (VS Code)', ['node', 'tests/integration/runTests.js', '--exclude', '@smoke']);
    restResults = readResults(mochaResults);
  } else {
    console.log('[rest (VS Code)] skipped: the smoke gate failed');
  }

  const fixturesCode = await fixturesPromise;
  const unitCode = await unitPromise;

  // Merged results: smoke and rest together (the second run overwrites the file, so combine them here).
  const merged = [...smokeResults, ...(restCode === null ? [] : restResults)];
  fs.writeFileSync(mochaResults, JSON.stringify({ results: merged, finished: new Date().toISOString() }, null, 2));

  const failed = [fixturesCode, unitCode, smokeCode, restCode].some((c) => c !== null && c !== 0);
  console.log(`\nTotal: ${failed ? 'FAILED' : 'passed'} in ${Math.round((Date.now() - started) / 1000)} s`);
  process.exit(failed ? 1 : 0);
})();
