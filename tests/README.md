# Tests

## Folders

Folders are sorted by **test level** (what is tested and how). **Purpose** (smoke, regression) is a tag
in the test title, because one test can have several purposes.

| Folder | Level | What it checks | Runs with | Command |
| --- | --- | --- | --- | --- |
| `fixtures/` | fixture check | The sample files in `testdata/` exist and have the right format. Not a test of the extension | Playwright | `npm run test:fixtures` |
| `unit/` | unit | Pure helpers in `lib/` (paths, HTML pages): no VS Code, no browser | Mocha in plain Node | `npm run test:unit` |
| `integration/` | integration | The extension inside VS Code: commands, HTTP server, file watching, open modes | Mocha in VS Code | `npm run test:extension` |
| `e2e/` | end to end | Pages that the extension serves, shown in a real browser (Chromium, Edge) | Mocha in VS Code + Playwright | `npm run test:extension` |
| `manual/` | manual | Cases that need a person (menus, UI, Windows dialogs) | by hand | see [manual/README.md](manual/README.md) |
| `mutation/` | quality of the tests | Deliberate bugs in `extension.js`; the suites must catch them | script | `npm run test:mutation` |
| `testdata/` | fixtures | Sample files used by the tests | | |
| `report/` (project root) | reporting | One-page quality report for stakeholders, see [../report/README.md](../report/README.md) | node | `npm run report` |
| `traceability.md` | traceability | Which test covers which requirement | | |

**Unit tests:** `tests/unit/` tests the pure helpers in `lib/paths.js` and `lib/html.js`. The rest of
`extension.js` (server, watchers, tabs) still needs VS Code and is covered by the integration tests.

**Test levels, with examples.** The same text is on the quality report (`report/out/report.html`).

| Level | Folder | What it checks | Example |
| --- | --- | --- | --- |
| Unit | `unit/` | One small function on its own. No VS Code, no browser | `isInside()` rejects `/work/site-old` when the folder is `/work/site` |
| Fixtures | `fixtures/` | The sample files the other tests use: they exist and are valid. Not a test of the extension | `sample.json` parses as JSON |
| Integration | `integration/` | Parts working together inside VS Code: commands, local server, file watching, modes | In mode `external` a file opens in the browser and its editor tab closes |
| System (end-to-end) | `e2e/` | The whole extension, driven as a user would in VS Code, result checked in a real browser | Saving an HTML file reloads the page in the browser |
| Manual (acceptance) | `manual/` | What a person must judge: menus, visual result, Windows dialogs | The menu entries and the shortcut are shown as documented |

- **System test:** there is no separate `system/` folder. The system level is `e2e/`, which runs the whole
  extension. It includes the Windows desktop test M-16, which is opt-in (`OPEN_IN_BROWSER_DESKTOP_TESTS=1`).
- **Smoke and regression are purposes, not levels.** A test can be both, and each can apply to any level.
- The manual cases are acceptance checks by a person. They are not automated and have their own folder.
- See D56 (levels) and D60 (glossary on the report) in [docs/DECISIONS.md](../docs/DECISIONS.md).

**Purpose tags:** Put `@smoke` or `@regression` in a test title.

| Tag | Meaning | Command |
| --- | --- | --- |
| `@smoke` | Fast check of the basic function: activation, commands, one page served, one mode | `npm run test:smoke` |
| `@regression` | Tests for earlier bugs and risky behaviour (see CHANGELOG) | `npm run test:regression` |

`npm test` runs everything in this order: smoke gate first (VS Code), then the rest (VS Code). The data tests (Playwright) and the unit tests run in parallel. If the smoke gate fails, the rest is skipped. See [docs/DECISIONS.md](../docs/DECISIONS.md) for the reasons.

## Requirements

| What | Version / note |
| --- | --- |
| Node.js | 20.19 or newer (`engines` in `package.json`, enforced by npm) |
| npm | comes with Node.js; the project uses the committed `package-lock.json` |
| Internet | first run of `test:extension` downloads VS Code 1.146.0 (about 384 MB) into `.vscode-test/` |
| Chromium | installed by `npx playwright install chromium` (about 150 MB) |
| Windows | needed for the Windows-specific parts (desktop test). Other systems run the rest |

The project is a Node.js project, so its requirements are defined in `package.json` and
`package-lock.json`, not in a `requirements.txt` (that file is for Python).

## Setup (once, per machine)

```
npm ci
npx playwright install chromium
```

`npm ci` installs the exact versions from `package-lock.json`. Use it instead of `npm install` when you only want to run the tests.
The first `npm run test:extension` then downloads VS Code into `.vscode-test/`.

Check before the first run:

```
node --version      # must be 20.19 or newer
npm test            # runs both groups
```

## Reports

- **Playwright** (`fixtures/`, `e2e/`): HTML report in `playwright-report/`. Open with `npm run test:report`.
- **Mocha** (`integration/`, `e2e/`): results in the console only.

## Mutation tests

`npm run test:mutation` changes `extension.js` on purpose (for example removes the path check) and
runs the suite each time. A mutant that makes a test fail is "killed". A mutant that no test notices
"survived", which means a gap. The results are in `mutation/results.json`. A run takes about 6 minutes,
because VS Code starts once per mutant. The file is always restored, also after a crash.

## Desktop test (Windows, opt-in)

`e2e/browser.test.js` contains one test for manual case M-16: deleting a file closes its page in the
installed Microsoft Edge. It is skipped unless you enable it:

```
OPEN_IN_BROWSER_DESKTOP_TESTS=1 npm run test:extension
```

The extension brings the browser window to the foreground and sends Ctrl+Tab and Ctrl+W to it.
Run it only when you are not using the computer. Do not run the suite while sample pages are open in
your own browser.

## Packaging check

The package contents are checked with the pinned version of `vsce` (not a dev dependency):

```
npx @vscode/vsce@3.9.2 ls            # list the files that would be packaged
npx @vscode/vsce@3.9.2 package       # build the .vsix
```

The CI workflow (`.github/workflows/tests.yml`) runs the packaging step on every push and pull request.

## What the tests cover

See [traceability.md](traceability.md) for the requirement-by-requirement mapping.

## Option not implemented: UI automation with Selenium

Menus, the editor title button, the command palette and the keyboard shortcut (`Ctrl+Alt+B`) can only
be tested by driving the VS Code window itself. The extension API cannot click menus or press keys.

**Proposal:** [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester)
(ExTester), which uses Selenium WebDriver and a ChromeDriver version matched to the VS Code version.

Steps if we decide to do it:
1. Add `vscode-extension-tester` as a dev dependency and set up `npx extest setup-and-run` for this repo.
2. Write tests that open the Explorer context menu on a sample file, click the editor title button, run
   the command from the palette, and press `Ctrl+Alt+B`.
3. Run them in CI on Windows, because the browser handling is Windows-specific.

**Costs:** A second toolchain (Selenium, ChromeDriver) that must match each VS Code release, tests that
depend on the layout of the VS Code interface, and noticeably slower runs.

**Benefit:** The actual clicks and key presses are tested. Today only the registration of these entries is
tested (`package.json` checks), and the command they call is tested directly.

**Decision (current):** Not worth it for this extension. The entries are configuration, and the
registration checks catch the likely mistakes. Revisit if menu wiring breaks more than once, or the
extension gets more UI.
