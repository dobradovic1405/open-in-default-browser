/**
 * Mutation testing for extension.js.
 *
 * Each mutant is a small, deliberate bug. For each mutant the script changes extension.js,
 * runs the Electron test suite, and records whether the suite failed (the mutant "was killed").
 * A mutant that survives means no test noticed the bug.
 *
 * extension.js is always restored, also when a run crashes or is interrupted.
 *
 * Usage:  node tests/mutation/run-mutants.js
 * Takes several minutes: each mutant starts VS Code once.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const target = path.join(repoRoot, 'extension.js');
const resultsFile = path.join(__dirname, 'results.json');

/** Each mutant replaces exactly one occurrence of `from` with `to`. */
const MUTANTS = [
  {
    id: 'M1',
    behaviour: 'Mode "editor" no longer suppresses the automatic browser open',
    from: "if (mode === 'editor' || !isSupportedFile(uri)) {",
    to: 'if (!isSupportedFile(uri)) {',
  },
  {
    id: 'M2',
    behaviour: 'Path traversal check removed (files outside the folder can be served)',
    from: 'if (!isInside(requested, dir)) {',
    to: 'if (false) {',
  },
  {
    id: 'M3',
    behaviour: 'An open page is never seen as connected (second tab opens instead of reload)',
    from: 'return Boolean(entry && Date.now() - entry.seen < PAGE_TIMEOUT_MS);',
    to: 'return false;',
  },
  {
    id: 'M4',
    behaviour: 'liveReload setting ignored (reload script always injected)',
    from: 'const reload = liveReloadEnabled();',
    to: 'const reload = true;',
  },
  {
    id: 'M5',
    behaviour: 'Deleting a file reloads the open page (should not)',
    from: 'queueDeleted(uri.fsPath);',
    to: 'queueDeleted(uri.fsPath); broadcastReload();',
  },
  {
    id: 'M6',
    behaviour: 'Mode change no longer closes the editor tabs',
    from: 'await closeOpenedTabs();\n      stopServer();',
    to: 'stopServer();',
  },
];

function runSuite() {
  const started = Date.now();
  const result = spawnSync('npm', ['run', 'test:extension'], {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    timeout: 540000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  const failing = (output.match(/(\d+) failing/) || [])[1];
  return {
    exitCode: result.status,
    failing: failing ? Number(failing) : 0,
    failedTests: [...output.matchAll(/^\s+\d+\) (.+)$/gm)].map((m) => m[1].trim()).slice(0, 10),
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

function main() {
  const original = fs.readFileSync(target, 'utf8');
  // Second safety net: if the process is killed, extension.js can be restored from this copy.
  const backup = path.join(repoRoot, '.vscode-test', 'extension.js.backup');
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, original);
  const results = [];

  try {
    // Sanity check: the unmodified code must pass, otherwise the results mean nothing.
    console.log('Baseline (unmodified extension.js) ...');
    const baseline = runSuite();
    if (baseline.exitCode !== 0) {
      throw new Error(`Baseline fails, aborting: ${baseline.failedTests.join(', ')}`);
    }
    console.log(`Baseline passes (${baseline.seconds}s).`);

    // Optional: run only some mutants, e.g. "node run-mutants.js M5".
    const only = process.argv.slice(2);
    for (const mutant of MUTANTS.filter((m) => only.length === 0 || only.includes(m.id))) {
      const count = original.split(mutant.from).length - 1;
      if (count !== 1) {
        results.push({ ...mutant, status: 'invalid', note: `anchor found ${count} times` });
        console.log(`${mutant.id}: invalid (anchor found ${count} times)`);
        continue;
      }

      fs.writeFileSync(target, original.replace(mutant.from, mutant.to));
      console.log(`${mutant.id}: running ...`);
      let run;
      try {
        run = runSuite();
      } finally {
        fs.writeFileSync(target, original);
      }

      const killed = run.exitCode !== 0;
      results.push({
        id: mutant.id,
        behaviour: mutant.behaviour,
        status: killed ? 'killed' : 'survived',
        failing: run.failing,
        failedTests: run.failedTests,
        seconds: run.seconds,
      });
      console.log(`${mutant.id}: ${killed ? 'KILLED' : 'SURVIVED'} (${run.failing} failing, ${run.seconds}s)`);
    }
  } finally {
    // Always restore the original file.
    fs.writeFileSync(target, original);
  }

  // Keep results of mutants that were not run this time.
  let merged = results;
  if (fs.existsSync(resultsFile)) {
    const previous = JSON.parse(fs.readFileSync(resultsFile, 'utf8')).results || [];
    const rerun = new Set(results.map((r) => r.id));
    merged = [...previous.filter((r) => !rerun.has(r.id)), ...results].sort((a, b) => a.id.localeCompare(b.id));
  }
  const killed = merged.filter((r) => r.status === 'killed').length;
  const total = merged.filter((r) => r.status !== 'invalid').length;
  const summary = { killed, total, score: total ? Math.round((100 * killed) / total) : 0, results: merged };
  fs.writeFileSync(resultsFile, JSON.stringify(summary, null, 2) + '\n');
  console.log(`\nMutation score: ${summary.score}% (${killed} of ${total} killed). Details: ${resultsFile}`);
}

main();
