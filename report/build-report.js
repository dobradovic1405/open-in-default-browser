#!/usr/bin/env node
/**
 * Stakeholder report: one page that shows the state of quality at a glance.
 *
 * Reads the outputs of the test runs and writes a single self-contained HTML file.
 * No external libraries, no network access. Charts are inline SVG.
 *
 * Inputs (paths relative to the project root, all optional with these defaults):
 *   --playwright   .vscode-test/playwright-results.json   (Playwright JSON reporter)
 *   --mocha        .vscode-test/mocha-results.json        (written by tests/integration/host-index.js)
 *   --unit         .vscode-test/unit-results.json         (written by tests/unit/run-unit.js)
 *   --mutation     tests/mutation/results.json            (npm run test:mutation)
 *   --traceability tests/traceability.md                  (requirement status table)
 *   --plan         tests/manual/test-plan.md              (manual results matrix)
 *   --workflow     .github/workflows/tests.yml            (CI configuration)
 *   --out          report/out/report.html
 *
 * When GITHUB_STEP_SUMMARY is set (GitHub Actions), a short summary is appended to it.
 *
 * Usage: node report/build-report.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.REPORT_ROOT ? path.resolve(process.env.REPORT_ROOT) : path.resolve(__dirname, '..');

function argValue(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const inputs = {
  playwright: path.resolve(ROOT, argValue('playwright', '.vscode-test/playwright-results.json')),
  mocha: path.resolve(ROOT, argValue('mocha', '.vscode-test/mocha-results.json')),
  unit: path.resolve(ROOT, argValue('unit', '.vscode-test/unit-results.json')),
  mutation: path.resolve(ROOT, argValue('mutation', 'tests/mutation/results.json')),
  traceability: path.resolve(ROOT, argValue('traceability', 'tests/traceability.md')),
  plan: path.resolve(ROOT, argValue('plan', 'tests/manual/test-plan.md')),
  workflow: path.resolve(ROOT, argValue('workflow', '.github/workflows/tests.yml')),
};
const outFile = path.resolve(ROOT, argValue('out', 'report/out/report.html'));

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
const readText = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (part, whole) => (whole ? Math.round((100 * part) / whole) : 0);

// ---------- collect: automated tests ----------

function collectPlaywright(json) {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const duration = (t.results || []).reduce((sum, r) => sum + (r.duration || 0), 0);
        tests.push({ layer: 'Daten', title: spec.title, status: t.status, duration });
      }
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of json?.suites || []) walk(suite);
  // Playwright: "expected" = passed, "unexpected" = failed, "flaky" = passed on retry, "skipped".
  return tests.map((t) => ({
    ...t,
    status: t.status === 'expected' || t.status === 'flaky' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed',
  }));
}

function collectUnit(json) {
  return (json?.results || []).map((r) => ({
    layer: 'Unit',
    title: r.title,
    status: r.status,
    duration: r.duration,
    smoke: false,
    regression: /@regression/.test(r.title),
  }));
}

function collectMocha(json) {
  return (json?.results || []).map((r) => ({
    layer: r.folder === 'e2e' ? 'End-to-End' : 'Integration',
    title: r.title,
    status: r.status,
    duration: r.duration,
    smoke: /@smoke/.test(r.title),
    regression: /@regression/.test(r.title),
  }));
}

// ---------- collect: requirements (traceability.md) ----------

function collectRequirements(text) {
  if (!text) return [];
  const rows = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    // | ID | Requirement | Source | Automated | Manual | Status |
    if (cells.length >= 8 && /^R\d{2}$/.test(cells[1])) {
      rows.push({ id: cells[1], requirement: cells[2], status: cells[6] });
    }
  }
  return rows;
}

function categorize(status) {
  const s = status.toLowerCase();
  if (s.startsWith('automated +')) return 'auto+manual';
  if (s === 'automated') return 'automated';
  if (s === 'partial') return 'partial';
  if (s === 'manual only') return 'manual';
  return 'none';
}

// ---------- collect: manual results (test-plan.md results matrix) ----------

function collectManual(text) {
  if (!text) return { total: 0, done: 0, failed: 0 };
  const matrix = text.split('## Results matrix')[1]?.split('## Notes')[0] || '';
  let total = 0;
  let done = 0;
  let failed = 0;
  for (const line of matrix.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length >= 5 && /^M-\d{2}$/.test(cells[1])) {
      for (const value of cells.slice(2, 5)) {
        total += 1;
        if (value) done += 1;
        if (value === 'F') failed += 1;
      }
    }
  }
  return { total, done, failed };
}

// ---------- maturity model ----------

const MATURITY = [
  { level: 1, name: 'Manuell', rule: 'Testfälle existieren als Plan (manuell ausführbar)' },
  { level: 2, name: 'Smoke automatisiert', rule: 'Smoke-Tests laufen automatisch und bestehen' },
  { level: 3, name: 'Regression und Integration', rule: 'Integrationstests, Regressionstests und mindestens 50 % Anforderungsabdeckung' },
  { level: 4, name: 'Verifiziert', rule: 'End-to-End im echten Browser, Mutationsscore ab 80 % und die CI-Pipeline lief' },
];

function maturity(facts) {
  const checks = [
    facts.manualPlanExists,
    facts.smokePass,
    facts.integrationAndRegression && facts.coverage >= 50,
    facts.e2e && facts.mutationScore >= 80 && facts.ci,
  ];
  let level = 0;
  for (const ok of checks) {
    if (!ok) break;
    level += 1;
  }
  return { level, checks };
}

// ---------- build data ----------

const pkg = readJson(path.join(ROOT, 'package.json')) || {};
const pw = collectPlaywright(readJson(inputs.playwright));
const mocha = collectMocha(readJson(inputs.mocha));
const unit = collectUnit(readJson(inputs.unit));
const automated = [...pw, ...mocha, ...unit];
const requirements = collectRequirements(readText(inputs.traceability));
const manual = collectManual(readText(inputs.plan));
const mutation = readJson(inputs.mutation) || { killed: 0, total: 0, score: 0, results: [] };
// CI counts only when this report was built inside GitHub Actions, i.e. the pipeline has actually run.
const ci = process.env.GITHUB_ACTIONS === 'true';
const ciConfigured = fs.existsSync(inputs.workflow);

const passed = automated.filter((t) => t.status === 'passed').length;
const failed = automated.filter((t) => t.status === 'failed').length;
const skipped = automated.filter((t) => t.status === 'skipped').length;
const duration = Math.round(automated.reduce((s, t) => s + (t.duration || 0), 0) / 1000);

const reqCount = { 'auto+manual': 0, automated: 0, partial: 0, manual: 0, none: 0 };
for (const r of requirements) reqCount[categorize(r.status)] += 1;
const reqTotal = requirements.length;
const covered = reqCount['auto+manual'] + reqCount.automated + reqCount.partial;
const autoCovered = reqCount['auto+manual'] + reqCount.automated;
const coverage = pct(autoCovered, reqTotal);

const layers = ['Unit', 'Daten', 'Integration', 'End-to-End'].map((name) => {
  const items = automated.filter((t) => t.layer === name);
  return { name, total: items.length, passed: items.filter((t) => t.status === 'passed').length };
});
const smokeTests = automated.filter((t) => t.smoke);
const smokePass = smokeTests.length > 0 && smokeTests.every((t) => t.status === 'passed');
const regressionCount = automated.filter((t) => t.regression).length;

const facts = {
  manualPlanExists: manual.total > 0,
  smokePass,
  integrationAndRegression: layers[2].total > 0 && regressionCount > 0,
  coverage,
  e2e: layers[3].total > 0,
  mutationScore: mutation.score,
  ci,
};
const mat = maturity(facts);

const gaps = requirements.filter((r) => ['partial', 'manual', 'none'].includes(categorize(r.status)));
const survivors = (mutation.results || []).filter((m) => m.status === 'survived');

// Overall status: red = failing tests; yellow = gaps or manual cases open; green otherwise.
const overall =
  failed > 0 ? { key: 'red', text: 'Nicht freigabefähig: automatisierte Tests schlagen fehl' }
  : manual.done < manual.total || gaps.length > 0 || survivors.length > 0
    ? { key: 'yellow', text: 'Automatisierte Tests grün. Offene Punkte vor Freigabe prüfen' }
    : { key: 'green', text: 'Grün: alle Tests bestanden, keine offenen Punkte' };

// ---------- SVG charts ----------

function donut(parts, total) {
  const colors = { 'auto+manual': '#15803d', automated: '#4ade80', partial: '#facc15', manual: '#60a5fa', none: '#ef4444' };
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = Object.entries(parts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const len = (n / total) * c;
      const arc = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${colors[key]}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset += len;
      return arc;
    })
    .join('');
  return `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Anforderungsstatus">
    <circle r="${r}" cx="70" cy="70" fill="none" stroke="#e5e7eb" stroke-width="22"/>${arcs}
    <text x="70" y="66" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">${coverage}%</text>
    <text x="70" y="86" text-anchor="middle" font-size="11" fill="#6b7280">automatisiert</text></svg>`;
}

function bar(label, value, max, color, caption) {
  const width = max ? pct(value, max) : 0;
  return `<div class="bar"><div class="bar-label">${esc(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
    <div class="bar-value">${esc(caption)}</div></div>`;
}

// ---------- HTML ----------

const legend = [
  ['auto+manual', 'Automatisiert + manuell', '#15803d', reqCount['auto+manual']],
  ['automated', 'Automatisiert', '#4ade80', reqCount.automated],
  ['partial', 'Teilweise', '#facc15', reqCount.partial],
  ['manual', 'Nur manuell', '#60a5fa', reqCount.manual],
  ['none', 'Ungeprüft', '#ef4444', reqCount.none],
]
  .map(([, label, color, n]) => `<li><span class="dot" style="background:${color}"></span>${label}: <b>${n}</b></li>`)
  .join('');

const maturityRows = MATURITY.map((m, i) => {
  const reached = i < mat.level;
  return `<li class="${reached ? 'reached' : ''}"><span class="lvl">${m.level}</span>
    <b>${esc(m.name)}</b> <span class="rule">${esc(m.rule)}</span>
    <span class="mark">${reached ? '✔' : '○'}</span></li>`;
}).join('');

const gapRows = gaps
  .map((g) => `<tr><td>${esc(g.id)}</td><td>${esc(g.requirement)}</td><td>${esc(g.status)}</td></tr>`)
  .join('') || '<tr><td colspan="3">Keine offenen Lücken</td></tr>';

const kpi = (value, label, note) =>
  `<div class="kpi"><div class="kpi-value">${value}</div><div class="kpi-label">${esc(label)}</div><div class="kpi-note">${esc(note)}</div></div>`;

const today = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qualitätsbericht ${esc(pkg.displayName || pkg.name || '')}</title>
<style>
  :root { --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --bg:#f9fafb; --card:#ffffff; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --ink:#f3f4f6; --muted:#9ca3af; --line:#374151; --bg:#111827; --card:#1f2937; }
  }
  :root[data-theme="dark"] { --ink:#f3f4f6; --muted:#9ca3af; --line:#374151; --bg:#111827; --card:#1f2937; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 12px; }
  .meta { color: var(--muted); font-size: 13px; }
  .status { margin: 16px 0; padding: 14px 16px; border-radius: 10px; font-weight: 600; color: #fff; }
  .status.green { background:#15803d; } .status.yellow { background:#b45309; } .status.red { background:#b91c1c; }
  .kpis { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:12px; margin-bottom:16px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; }
  .kpi-value { font-size: 26px; font-weight: 700; }
  .kpi-label { font-size: 13px; font-weight: 600; }
  .kpi-note { font-size: 12px; color: var(--muted); }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .chart { display:flex; gap:16px; align-items:center; }
  ul.legend, ul.ladder { list-style:none; padding:0; margin:0; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
  .bar { display:grid; grid-template-columns: 110px 1fr 90px; gap:8px; align-items:center; margin: 8px 0; font-size:13px; }
  .bar-track { background:var(--line); border-radius:6px; height:12px; overflow:hidden; }
  .bar-fill { height:100%; }
  .bar-value { text-align:right; color:var(--muted); }
  ul.ladder li { display:grid; grid-template-columns: 28px 1fr 22px; gap:8px; padding:6px 0; border-bottom:1px solid var(--line); opacity:.55; }
  ul.ladder li.reached { opacity:1; }
  .lvl { font-weight:700; } .rule { display:block; color:var(--muted); font-size:12px; grid-column: 2; }
  .mark { color:#15803d; font-weight:700; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:6px 4px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; }
  .foot { margin-top:16px; color:var(--muted); font-size:12px; }
  code { font-size: 12px; }
</style>
</head>
<body>
<main>
  <h1>Qualitätsbericht: ${esc(pkg.displayName || pkg.name || 'Projekt')}</h1>
  <div class="meta">Version ${esc(pkg.version || '?')} · Stand ${today} · Reifegrad ${mat.level} von 4</div>

  <div class="status ${overall.key}">${esc(overall.text)}</div>

  <div class="kpis">
    ${kpi(`${passed} / ${automated.length}`, 'Automatisierte Tests bestanden', `${failed} fehlgeschlagen, ${skipped} übersprungen, ${duration} s`)}
    ${kpi(`${coverage} %`, 'Anforderungen automatisch geprüft', `${autoCovered} von ${reqTotal} Anforderungen`)}
    ${kpi(`${mutation.score} %`, 'Fehler gefunden (Mutationstests)', `${mutation.killed} von ${mutation.total} absichtlichen Fehlern`)}
    ${kpi(`${manual.done} / ${manual.total}`, 'Manuelle Prüfungen eingetragen', `${manual.failed} Fehler gemeldet`)}
    ${kpi(`${gaps.length}`, 'Offene Lücken', 'teilweise, nur manuell oder ungeprüft')}
    ${kpi(`${mat.level} / 4`, 'Reifegrad der Automatisierung', MATURITY[mat.level - 1]?.name || 'noch nicht erreicht')}
  </div>

  <div class="grid">
    <section class="card">
      <h2>Anforderungen nach Prüfart</h2>
      <div class="chart">${donut(reqCount, reqTotal || 1)}<ul class="legend">${legend}</ul></div>
    </section>
    <section class="card">
      <h2>Automatisierte Tests nach Ebene</h2>
      ${layers.map((l) => bar(l.name, l.passed, l.total || 1, '#15803d', `${l.passed} / ${l.total}`)).join('')}
      ${bar('Smoke', smokeTests.filter((t) => t.status === 'passed').length, smokeTests.length || 1, '#2563eb', `${smokeTests.filter((t) => t.status === 'passed').length} / ${smokeTests.length}`)}
      ${bar('Regression', automated.filter((t) => t.regression && t.status === 'passed').length, regressionCount || 1, '#7c3aed', `${automated.filter((t) => t.regression && t.status === 'passed').length} / ${regressionCount}`)}
      ${bar('Fehler gefunden', mutation.killed, mutation.total || 1, '#0d9488', `${mutation.killed} / ${mutation.total}`)}
      ${bar('Manuell eingetragen', manual.done, manual.total || 1, '#60a5fa', `${manual.done} / ${manual.total}`)}
    </section>
    <section class="card">
      <h2>Reifegrad der Automatisierung</h2>
      <ul class="ladder">${maturityRows}</ul>
      <p class="meta">Die Stufen sind eine Einschätzung auf Basis der oben genannten Kennzahlen, kein Industriestandard.</p>
    </section>
    <section class="card">
      <h2>Offene Lücken</h2>
      <table><thead><tr><th>ID</th><th>Anforderung</th><th>Status</th></tr></thead><tbody>${gapRows}</tbody></table>
    </section>
  </div>

  <p class="foot">
    Quellen: Playwright- und Mocha-Ergebnisse der letzten Läufe, Mutationsergebnisse (<code>tests/mutation/results.json</code>),
    Anforderungsmatrix (<code>tests/traceability.md</code>), manueller Testplan (<code>tests/manual/test-plan.md</code>).
    CI: ${ci ? 'lief in GitHub Actions' : ciConfigured ? 'konfiguriert, Lauf auf GitHub nicht geprüft' : 'nicht konfiguriert'}.
    Erzeugt mit <code>report/build-report.js</code>.
  </p>
</main>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`Report written: ${outFile}`);

// ---------- GitHub Actions summary ----------

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = `## Qualitätsbericht

**${overall.text}**

| Kennzahl | Wert |
| --- | --- |
| Automatisierte Tests bestanden | ${passed} / ${automated.length} |
| Anforderungen automatisch geprüft | ${coverage} % (${autoCovered} / ${reqTotal}) |
| Fehler gefunden (Mutationstests) | ${mutation.score} % |
| Manuelle Prüfungen eingetragen | ${manual.done} / ${manual.total} |
| Offene Lücken | ${gaps.length} |
| Reifegrad | ${mat.level} / 4 |
`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
