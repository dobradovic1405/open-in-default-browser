/**
 * Runs the unit tests (tests/unit/*.test.js) with Mocha in plain Node and writes the results for
 * the quality report (report/build-report.js). Usage: node tests/unit/run-unit.js
 *
 * The file mirrors the integration runner (tests/integration/host-index.js): same result format,
 * but no VS Code is started, so it takes about a second.
 */
const fs = require('fs');
const path = require('path');
const { Mocha } = require('mocha');

const root = path.resolve(__dirname, '..', '..');
const resultsFile = path.join(root, '.vscode-test', 'unit-results.json');
const results = [];

const mocha = new Mocha({ ui: 'bdd', timeout: 5000, reporter: 'spec' });
for (const file of fs.readdirSync(__dirname)) {
  if (file.endsWith('.test.js')) {
    mocha.addFile(path.join(__dirname, file));
  }
}

const record = (status) => (test) => {
  results.push({
    title: test.fullTitle(),
    file: path.basename(test.file || ''),
    folder: 'unit',
    status,
    duration: test.duration || 0,
    error: test.err ? String(test.err.message || test.err).slice(0, 300) : undefined,
  });
};

mocha.loadFiles();
const runner = mocha.run((failures) => {
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.writeFileSync(resultsFile, JSON.stringify({ results, finished: new Date().toISOString() }, null, 2));
  process.exitCode = failures > 0 ? 1 : 0;
});
runner.on('pass', record('passed'));
runner.on('fail', record('failed'));
runner.on('pending', record('skipped'));
