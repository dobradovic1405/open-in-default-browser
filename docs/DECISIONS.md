# Decisions

Every decision made for the extension's tests, repository, CI and reporting, with the reason and the
alternatives that were rejected. Status: **decided** (in effect), **open** (still to decide or to do).

Last updated: 2026-11-16.

## 1. Repository and legal

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D01 | License is MIT, copyright holder "Denis Obradovic" | Standard for VS Code extensions. Permissive, one page, no copyleft obligations | GPL-3.0 (would force derivatives to be open source too) | decided |
| D02 | Publisher ID is `denis-obradovic` | Must match the publisher ID created on the Marketplace. Changed from `local` | keep `local` (cannot be published) | decided. The Marketplace ID still has to be created and matched |
| D03 | `repository` field in `package.json` points to the GitHub repository | Required by `vsce package` (warning otherwise). Links from the Marketplace page | leave empty (packaging fails) | decided |
| D04 | Repository visibility: public | You asked for private, then public again. Public repos get free GitHub Actions minutes | private | decided (you can change it any time) |
| D05 | Sponsor link: not yet decided. Marketplace supports `sponsor.url` in `package.json` (checked in the vsce source) | Option list: GitHub Sponsors, Ko-fi, Buy Me a Coffee, PayPal.me | none chosen. No account has been created | open |

## 2. Extension behaviour and code

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D06 | `.js` files are not added to `fileExtensions` | A browser shows JavaScript as plain text, which the editor does better. Live reload already covers `js`/`mjs` changes next to a page | adding `js` (would open every script in the browser, and the Dev-Host trap applies) | decided |
| D07 | README command name corrected to "Choose Open Mode" (was "Choose HTML Open Mode") | Must match the command in `package.json` | keep the old name | decided |
| D08 | Test seam: `activate()` returns `{ _test: ... }` (launcher replacement, server port, batch counter). Not a public API | Tests must not open a real browser. VS Code exposes `activate()`'s return value, not `module.exports` | export from module (VS Code does not share module state with tests); mock `child_process` (fragile) | decided |
| D09 | Windows: window titles with a zero-width space (U+200B, Edge) are normalised before matching | Found by the M-16 desktop test. Edge put U+200B before "Edge", so the window check failed and pages stayed open | ignore the case (the bug is real for Edge users) | decided. In CHANGELOG under "Unreleased" |
| D10 | Deletion batches are counted (`getDeleteBatches`) and tested | Requirement R28 needed a check that two deletions form one batch | test only the tab closing (did not prove batching) | decided |

## 3. Manual tests

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D11 | Manual cases M-01 to M-19 keep their IDs. Each case runs in all three modes (`external`, `both`, `editor`) with a results matrix | Modes behave differently, so one run per case hides differences. Stable IDs keep the link to the automation | one run per case (too few); new IDs (breaks references) | decided |
| D12 | Expected results are written per mode in the case table | The tester should not have to derive them | one generic expectation (wrong for two of three modes) | decided |
| D13 | The plan must not be opened in the Extension Development Host (Dev-Host trap) | In mode `external`, the extension sends `.md` files to the browser, including the plan itself | none. Documented at the top of the plan and in `manual/README.md` | decided |
| D14 | Cases covered by automation are marked "automated: mechanics, manual: visual check" (M-05, M-08, M-09, M-11) | Automation checks the mechanics (URLs, settings, server), not what the user sees | remove them from the manual plan (would leave the visual check untested) | decided |
| D15 | Manual results are still empty. The tester fills them in | Only the person at the screen can see the browser | none | open |

## 4. Test structure

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D16 | Folders by test **level**: `data/` (Playwright), `integration/`, `e2e/`, `manual/`, `mutation/`, `testdata/` | Level says what is tested and how. Standard approach (test pyramid, ISTQB levels) | folders for smoke and regression (a test can be both, so it would sit in two folders) | decided |
| D17 | Purpose as tag in the title: `@smoke` (5 tests), `@regression` (7 tests). Run with `--grep` / `--exclude` | Tags can overlap. Playwright and Mocha both support title filters | separate folders per purpose (overlap problem) | decided |
| D18 | No `unit/` folder yet | No exported functions. Unit tests need the logic moved into modules first | create an empty folder (misleading) | superseded by D57 |
| D19 | Playwright's `testMatch` is `*.spec.ts`; Mocha loads `*.test.js` | Keeps the two frameworks apart in the same folder tree | default matching (would pick up Mocha files) | decided |
| D20 | Playwright tests migrated from the separate `playwright-ts-portfolio` repo: only the sample-file tests. `sample copy.xsd` dropped. `login.spec.ts` (saucedemo) and `example.spec.ts` (playwright.dev) stay in the portfolio repo | Only the sample-file tests belong to this extension. The other two are unrelated demos | move everything (would mix unrelated projects) | decided |
| D21 | Test data stays in `tests/testdata/` (root, tests, tests2, tests2/testchild) | Existing fixtures. Renaming would change file contents that tests check | rename folders (not worth the churn) | decided |

## 5. Test coverage and quality

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D22 | Traceability table `tests/traceability.md` is the source of truth for requirements. Status categories: automated + manual, automated, partial, manual only, none | Shows gaps on one page. Used by the report | no mapping (gaps stay invisible) | decided |
| D23 | UI automation (ExTester, Selenium) for menus, shortcut and palette is **not** implemented | Menus and shortcut are configuration, and `package.json` checks catch likely mistakes. UI tests would depend on VS Code's layout and need a second toolchain (ChromeDriver per VS Code version) | implement now (high cost, brittle). Re-evaluate if menu wiring breaks more than once | decided |
| D24 | Desktop test for M-16 (Edge window closes on delete) is **opt-in** with `OPEN_IN_BROWSER_DESKTOP_TESTS=1`. Not in CI | The test takes focus and sends key presses. It needs a desktop that is not in use | always run (would disturb the user); never run (leaves the Windows-specific path untested) | decided |
| D25 | Mutation testing with 6 deliberate bugs (`tests/mutation/run-mutants.js`). Score 100 % | Shows whether the tests catch real bugs, not just run. Found one weak test (R29), which was then fixed | none. Coverage tools do not measure this | decided |
| D26 | Mutation tests are **not** run in CI | About 6 minutes (VS Code starts once per mutant) | run in CI (slows every push) | decided. Run before releases |
| D27 | Desktop-only mutant (Edge zero-width space) is not part of the mutation run | It needs the opt-in desktop test | add it anyway (would disturb the desktop) | decided |

## 6. Test fixes made (not product changes)

| # | Problem | Fix |
| --- | --- | --- |
| D28 | Live-reload and deletion tests raced with the file watcher, which starts asynchronously | Tests save again every second until the watcher reacts (`waitFor`). The deletion test waits for that first |
| D29 | Mode-change handler closes tabs (on Windows via PowerShell), so a file opened right after a mode change could be closed | `setMode()` waits 4 s after changing the mode |
| D30 | The mode-reset in the `after` hook stopped the server during the next test file (end-to-end) | `after` also uses `setMode()` and waits |
| D31 | Browser pages count as "open" for 3 s after their last poll, so the next test got no browser launch | End-to-end tests wait 3.5 s at the end |
| D32 | SVG is shown as `<img>`, not inline `<svg>` | Test checks the loaded image, not an SVG element |
| D33 | `ELECTRON_RUN_AS_NODE=1` in some shells makes VS Code run as plain Node | The runner deletes the variable before starting VS Code |

## 7. Tooling and dependencies

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D34 | No `requirements.txt`. Requirements are in `package.json` (`engines.node >= 20.19.0`) and `package-lock.json`, documented in `tests/README.md` | This is a Node.js project. `requirements.txt` is for Python | create one anyway (wrong ecosystem) | decided |
| D35 | Installs with `npm ci` in CI and for test runs | Exact versions from the lock file | `npm install` (can change versions) | decided |
| D36 | Mocha 12 (was 10). Dev dependency only | Newest version without the vulnerable `diff` and `glob` versions | stay on 10 (vulnerable transitive dependencies) | decided |
| D37 | `overrides` in `package.json` for `serialize-javascript`, `glob`, `minimatch` (fixed versions) | `npm audit` reported 4–5 findings, all in dev dependencies | `npm audit fix --force` (breaking changes) | decided. `npm audit` shows 0 findings. The shipped extension does not depend on these packages (`npm audit --omit=dev` shows 0) |
| D38 | `@vscode/vsce` is not a dev dependency. CI and docs use `npx @vscode/vsce@3.9.2` | Keeps the dev tree small. The version is pinned so packaging is reproducible | dev dependency (pulled in vulnerable packages) | decided |
| D39 | `.vscodeignore` excludes tests, CI, reports, and all of `marked` except `lib/marked.esm.js` | Smaller package. The extension loads the ESM build (`exports` in marked's `package.json`) | keep everything (tests and maps in the `.vsix`) | decided. Checked with `vsce ls` |
| D40 | Playwright reporters: HTML (for people) and JSON (for the report) | One run produces both | HTML only (report cannot read it) | decided |
| D41 | VS Code test version is whatever `@vscode/test-electron` downloads as "stable" at first run (1.146.0 here) | Tests the current release | pin a fixed version (more maintenance) | open. Decide whether to pin |

## 8. Continuous integration

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D42 | CI is GitHub Actions (`.github/workflows/tests.yml`), not GitLab | Repository is on GitHub. Free for public repositories | GitLab (would need a second repository or a mirror) | decided |
| D43 | Triggers: every push to every branch, and every pull request | Problems show up on the branch before a merge | only `main` (what it was before) | decided |
| D44 | Runner: `windows-latest`, Node 20.19 | The extension's browser handling is Windows-specific, and the test host is VS Code | Ubuntu (misses the Windows path, and VS Code would need a virtual display) | decided |
| D45 | Order: smoke gate first, then the rest. Data tests run in parallel. Implemented in `tests/run-all.js` | If the smoke tests fail, the other VS Code tests are skipped (fast feedback). The data tests do not share state with VS Code | a single run (no early feedback) | decided |
| D46 | No parallel VS Code instances yet | Only worth it above about 5 minutes. Today the run takes about 85 s | work-stealing pool with priorities (overengineering for 78 tests) | decided. Next step when the suite is slow: split the VS Code tests by file across instances, each with its own `--user-data-dir` |
| D47 | Packaging check runs in CI | Catches broken packages (missing files, bad manifest) before a release | only check locally (easy to forget) | decided |
| D48 | Quality report built in CI and uploaded as artifact `quality-report`, plus a summary on the run page | Stakeholders see the result without running anything | none | decided |
| D49 | Report step runs `if: !cancelled()` | A failed test should still produce a report | run only on success (no report when it matters most) | decided |

## 9. Reporting

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D50 | Own one-page report in `report/` (Node only, single HTML file, no libraries) | Stakeholders need a page they grasp in a glance. No off-the-shelf tool gives this. The folder can become its own repository | Allure (detailed, no one-pager without paid TestOps), mochawesome (detail only) | decided. Allure can add the detail level later |
| D51 | Report labels are in German | The stakeholders are German-speaking | English (the test docs are English) | superseded by D59 |
| D52 | Coverage KPI = requirements checked automatically (automated + automated and manual) divided by all requirements. Partial does not count | Partial is not a check. Counting it would overstate the coverage | count partial (overstates) | decided |
| D53 | Overall status: red if an automated test fails; yellow if manual cases are open, gaps exist, or a mutant survived; green otherwise | Simple rule a stakeholder can follow | more colours or weights (harder to read) | decided |
| D54 | Maturity model with four levels: manual plan; smoke automated; regression and integration with at least 50 % coverage; verified (end-to-end, mutation score at least 80 %, and **the CI pipeline has run**) | Gives a clear next step. The rules are an internal model, not an industry standard, and the report says so | ISTQB or TMMi (too heavy for one extension) | decided. Level 4 needs `GITHUB_ACTIONS=true`, so a local run cannot reach it |
| D55 | The report shows only the current run. No history yet | History needs stored results from earlier runs | build history now (not needed yet) | open |

## 10. Unit tests, layers and stability

| # | Decision | Reason | Rejected alternatives | Status |
| --- | --- | --- | --- | --- |
| D56 | No `system/` folder. The system level is `e2e/`: the whole extension runs in VS Code and its pages are checked in a real browser, including the opt-in desktop test M-16. Manual cases are a separate acceptance level (checks by a person), not part of `e2e/` | Folders follow the test level (D16). `e2e` names the level we test. A rename would only change the label and break the links in the docs | rename `e2e/` to `system/` (label change, many links); empty `system/` folder (misleading, see D18); count manual cases as system level (they are acceptance checks) | decided. Corrected: the first version put manual cases in the same level |
| D57 | Unit tests in `tests/unit/`, run with Mocha in plain Node (`npm run test:unit`, part of `npm test`). Pure helpers moved to `lib/paths.js` and `lib/html.js`, which `extension.js` imports. Results go to `.vscode-test/unit-results.json` and into the report as layer "Unit" | Pure functions run in milliseconds without VS Code. Mocha matches the other suites. `lib/` ships in the package, because `.vscodeignore` excludes only `tests` and `report` | export helpers from `extension.js` (D08: no public API, and module state is shared with VS Code); move all code at once (large and risky, and the mutation tests depend on exact code anchors) | decided. Server, watchers and tabs are still in `extension.js` (O7) |
| D58 | Two flaky tests were fixed. (a) The `beforeEach` of the VS Code tests waits for the mode-change handler when the mode was changed, using `setMode`. The handler stops the server seconds later, and that landed in the next test. (b) The Chromium reload test counts a destroyed page context during the check as the reload it waits for, and then checks the marker again | Both causes were found in logs before the fix. Three full runs in a row were green after the fix (before: two of three failed) | retry the tests (hides the cause); longer fixed sleeps (slower and still racy) | decided |
| D59 | The quality report and its text are in English. Supersedes D51 | The owner asked for one language on the report. The repository and its docs are English | German labels with English content (mixed, as before) | decided on 2026-11-18 |
| D60 | The report and `tests/README.md` explain each test level in one line with one example. Smoke and regression are shown as purposes, not levels | Readers of the one-page report need the meaning of each bar. The README keeps the full folder mapping | only the README (stakeholders do not open it); only the report (developers need the folder mapping); a separate glossary page (one more thing to maintain) | decided |
| D61 | Test folder `data/` renamed to `fixtures/`. It checks the sample files used by the other tests, not the extension. The layer is called "Fixtures" in the report | "data" suggested data tests, and in the Mocha sense "unit" (module tests). The new name says what is checked. The sample files stay in `testdata/` | rename `testdata/` as well (more churn; D21 keeps the fixtures in place); keep `data/` (misleading) | decided. Supersedes the folder name in D16 |
| D62 | Repository layout: cross-cutting documents in `docs/` (decisions, project notes). They are excluded from the extension package (`.vscodeignore`). Test docs stay in `tests/`. Reports stay in `report/` | The internal notes were in the project root and in the package. Their German text does not belong on the Marketplace | keep them in the root (shipped with the extension); move everything into `tests/` (decisions are not only about tests) | decided |

## Open items

| # | Item | Owner |
| --- | --- | --- |
| O1 | Fill in the manual results matrix (`tests/manual/test-plan.md`) | tester |
| O2 | Choose the sponsor platform and create the account (D05) | you |
| O3 | Create the Marketplace publisher with the ID `denis-obradovic` (D02) | you |
| O4 | Decide whether to pin the VS Code test version (D41) | you |
| O5 | Commit and push, so CI runs on GitHub for the first time (D42 to D49) | done: commit `b2d4aa1` on `main` |
| O6 | Store report history for trends (D55) | later |
| O7 | Refactor `extension.js` further: server, watchers and tabs into modules (D57). Helpers and unit tests are done | later |
