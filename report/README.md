# Quality report

One page for stakeholders: test results, requirement coverage, mutation score, manual status and
an automation maturity level, in a single HTML file.

This folder is self-contained (Node.js only, no npm packages, no network). It can be moved to its own
repository. Point it at the test outputs of any project with the same layout.

## Usage

```
npm run report                       # uses the default paths of this project
node report/build-report.js --out my-report.html
```

Input files (defaults, relative to the project root):

| Option | Default | Produced by |
| --- | --- | --- |
| `--playwright` | `.vscode-test/playwright-results.json` | Playwright, JSON reporter (`playwright.config.ts`) |
| `--mocha` | `.vscode-test/mocha-results.json` | `tests/integration/host-index.js` |
| `--unit` | `.vscode-test/unit-results.json` | `tests/unit/run-unit.js` |
| `--mutation` | `tests/mutation/results.json` | `npm run test:mutation` |
| `--traceability` | `tests/traceability.md` | hand-maintained requirement table |
| `--plan` | `tests/manual/test-plan.md` | manual results matrix |
| `--workflow` | `.github/workflows/tests.yml` | CI configuration |

Set `REPORT_ROOT` to use another project root. Missing inputs are shown as zero or "nicht geprüft",
not as errors.

## What is on the page

- **Overall status:** red if automated tests fail, yellow if gaps or manual cases are open, green otherwise.
- **KPI tiles:** tests passed, requirements checked automatically, bugs found by mutation tests, manual cases
  entered, open gaps, maturity level.
- **Charts:** requirement status (donut), results per test level and purpose (bars). Levels: Unit, Daten (data), Integration, End-to-End.
- **Maturity ladder:** four levels, each with a rule. The rules are an internal model, not a standard.
- **Open gaps:** requirements that are partial, manual only or not checked at all.

## Maturity model

| Level | Name | Rule |
| --- | --- | --- |
| 1 | Manuell | A manual test plan exists |
| 2 | Smoke automatisiert | Smoke tests run automatically and pass |
| 3 | Regression und Integration | Integration and regression tests exist and at least 50 % of requirements are checked automatically |
| 4 | Verifiziert | End-to-end tests in a real browser, mutation score of at least 80 %, and the CI pipeline has run |

Level 4 requires `GITHUB_ACTIONS=true`, so a local run never reaches it. This is deliberate.

## CI

The workflow `.github/workflows/tests.yml` builds the report on every run and uploads it as the
`quality-report` artifact. It also appends a summary table to the run page.

## Known limits

- No history: each report shows only the current run. A trend needs stored results from earlier runs.
- The mutation score is taken from the last `npm run test:mutation`, not from the CI run (a full mutation
  run takes about 6 minutes and is not part of CI).
- The requirement table is maintained by hand and must match the tests.
