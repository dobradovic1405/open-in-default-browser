/**
 * Mocha entry point. VS Code calls run() inside the extension host.
 * Loads every *.test.js in this folder (integration) and in ../e2e (end to end).
 * TEST_GREP (runTests.js --grep or --exclude) selects tests by title, e.g. "@smoke".
 * TEST_INVERT=1 (runTests.js --exclude) runs all tests whose title does NOT match.
 */
const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

const folders = [__dirname, path.join(__dirname, '..', 'e2e')];

exports.run = function run() {
  const results = [];
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 20000,
    grep: process.env.TEST_GREP || undefined,
    invert: process.env.TEST_INVERT === '1', // run everything EXCEPT the grep matches
  });
  for (const folder of folders) {
    for (const file of fs.readdirSync(folder)) {
      if (file.endsWith('.test.js')) {
        mocha.addFile(path.join(folder, file));
      }
    }
  }
  return new Promise((resolve, reject) => {
    const runner = mocha.run((failures) => {
      // Results for the report (report/build-report.js). Written before the promise settles.
      if (process.env.TEST_RESULTS_FILE) {
        fs.writeFileSync(process.env.TEST_RESULTS_FILE, JSON.stringify({ results, finished: new Date().toISOString() }, null, 2));
      }
      return failures > 0 ? reject(new Error(`${failures} test(s) failed`)) : resolve();
    });
    const record = (status) => (test) => {
      results.push({
        title: test.fullTitle(),
        file: path.basename(test.file || ''),
        folder: path.basename(path.dirname(test.file || '')),
        status,
        duration: test.duration || 0,
        error: test.err ? String(test.err.message || test.err).slice(0, 300) : undefined,
      });
    };
    runner.on('pass', record('passed'));
    runner.on('fail', record('failed'));
    runner.on('pending', record('skipped'));
  });
};
