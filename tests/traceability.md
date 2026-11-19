# Test traceability

Maps each requirement of the extension to the tests that check it.

- **Source:** where the requirement is written (README, `package.json`, CHANGELOG version, or code).
- **Automated:** test names in `tests/integration/`, `tests/e2e/` (Mocha in VS Code), `tests/unit/` (Mocha in Node) and `tests/fixtures/` (Playwright). Tags: `@smoke` and `@regression` in the titles.
- **Manual:** case IDs in [manual/test-plan.md](manual/test-plan.md).
- **Status:**
  - *Automated + manual* = the mechanics are checked automatically, the user-visible result is checked by hand.
  - *Automated* = fully covered by automated tests.
  - *Partial* = only some aspects are checked.
  - *Manual only* = no automated check.
  - *None* = not checked at all.

| ID | Requirement | Source | Automated | Manual | Status |
| --- | --- | --- | --- | --- | --- |
| R01 | Open a file from the Explorer context menu | README *Usage* | "the command opens the file..." (command only, not the menu entry) | M-01 | Partial |
| R02 | Open with `Ctrl+Alt+B` | `package.json` keybindings | "contributes the menu entries, shortcut and command palette entry" (binding registered, key not pressed) | M-02 | Partial |
| R03 | Open from the Command Palette | `package.json` commands | "registers both commands" (registration only) | M-03 | Partial |
| R04 | Open from the editor title button | `package.json` menus | "contributes the menu entries ..." (entry registered, button not clicked) | M-04 | Partial |
| R05 | Mode `external`: browser opens, text tab closes | README *Choose an open mode* | "mode 'external': ..." | M-05 | Automated + manual |
| R06 | Mode `both`: browser opens, text tab stays | README *Choose an open mode* | "mode 'both': ..." | M-05 | Automated + manual |
| R07 | Mode `editor`: no browser | README *Choose an open mode* | "mode 'editor': ..." | M-05 | Automated + manual |
| R08 | Switching tabs does not reopen the browser | README *Choose an open mode* | none | M-06 | Manual only |
| R09 | Choose Open Mode writes the setting | README, `package.json` | "chooseMode writes the selected mode to settings" | M-08 | Automated + manual |
| R10 | Mode change closes browser pages and tabs and stops the server | `extension.js` (`onDidChangeConfiguration`) | "closes the text tabs and stops the live-reload server" | M-07 | Automated + manual |
| R11 | All nine file types are served | `package.json`, CHANGELOG 1.10.0 | "serves sample.X with status 200" (9 types); "renders an HTML sample ..." and "renders an SVG sample ..." (Chromium) | M-09 | Automated + manual |
| R12 | Unsupported file types are not opened | `extension.js` (`isSupportedFile`) | none | M-10 | Manual only |
| R13 | Live reload on: page reloads after saving | README *Live reload* | "bumps the reload version ..." and "reloads the page in Chromium after the file is saved" | M-11 | Automated + manual |
| R14 | Live reload off: no reload | `liveReload` setting, `extension.js` (`liveReloadEnabled`) | "injects the reload script only while liveReload is on" | M-12 | Automated + manual |
| R15 | Port changes on each VS Code start | README *Notes* | none (`getServerPort` exists but is not used) | M-13 | Manual only |
| R16 | Each folder gets its own address (`/f/<id>/`) | README, CHANGELOG 1.9.3 | "serves files from two folders at the same time ..." | M-14 | Automated + manual |
| R17 | Page without `<title>` uses the file name | CHANGELOG 1.9.7 | "uses the file name as title when an HTML file has no <title>" (Chromium) | M-15 | Automated + manual |
| R18 | Deleted file: its page and tab close (Windows) | CHANGELOG 1.9.5, 1.9.6 | "closes the Edge window of a page whose file is deleted (M-16)" (Windows, opt-in with `OPEN_IN_BROWSER_DESKTOP_TESTS=1`); tab close: "closes the editor tabs of files that were deleted" | M-16 | Automated + manual |
| R19 | No keys sent into a dialog in front of the browser (Windows) | CHANGELOG 1.9.4 | none | M-17 | Manual only |
| R20 | Non-Windows: browser pages stay open (documented limitation) | README *Known Issues* | none | M-18 | Manual only |
| R21 | Restored tab after restart is handled per mode | not specified | none | M-19 | Manual only |
| R22 | Files outside the opened folder are not served (403) | `extension.js` (`handleRequest`) | "refuses to serve files outside the opened folder" | none | Automated |
| R23 | Missing file returns 404 | `extension.js` (`handleRequest`) | "returns 404 for a file that does not exist ..." | none | Automated |
| R24 | Live-reload poll returns version and force value | `extension.js` (`__poll`) | "answers the live-reload poll ..." | none | Automated |
| R25 | Page already open is reloaded instead of opening a second tab | `extension.js` (`openFile`, `isPageConnected`) | "reloads a page that is already open instead of opening a second tab" | none | Automated |
| R26 | Fallback to VS Code if the browser cannot be started | `extension.js` (`openInBrowser`) | "opens the page in VS Code when the browser cannot be started" | none | Automated |
| R27 | Settings and commands are registered with the documented defaults | `package.json` | "has the documented default settings", "registers both commands" | none | Automated |
| R28 | Several deletions are handled as one batch | CHANGELOG 1.9.5 | "closes the editor tabs of files that were deleted" (checks with `getDeleteBatches()` that two deletions count as one batch) | none | Automated |
| R29 | Deleting a file does not reload the open pages | CHANGELOG 1.9.6 | "does not reload the open page when its file is deleted" | none | Automated |
| R30 | XSD files are supported | CHANGELOG 1.10.0 | "serves sample.xsd with status 200"; "shows an XSD file as its source text in the page" (Chromium) | M-09 | Automated + manual |
| R31 | Sample fixtures are complete and valid | `tests/testdata/` | 40 Playwright tests (fixtures only, not the extension) | none | Automated |

## Summary

| Status | Count | IDs |
| --- | --- | --- |
| Automated + manual | 12 | R05, R06, R07, R09, R10, R11, R13, R14, R16, R17, R18, R30 |
| Automated | 9 | R22, R23, R24, R25, R26, R27, R28, R29, R31 |
| Partial | 4 | R01, R02, R03, R04 |
| Manual only | 6 | R08, R12, R15, R19, R20, R21 |
| None | 0 | |

## Remaining gaps

1. **R01 to R04 (menu, shortcut, palette, title button):** The tests check that the entries are registered in `package.json`, but no test clicks or presses them. Clicking needs a UI driver in the Extension Development Host.
2. **R08 (tab switch without reopening):** Manual only. It could be automated by switching the active editor in the test host.

## Test infrastructure

- `tests/e2e/browser.test.js` uses headless Chromium from `playwright`. Run `npx playwright install chromium` once before the first run.
- The browser tests wait 3.5 seconds at the end. The extension counts a page as open for 3 seconds after its last poll, and the next test file needs a fresh launch.

## Note on the Electron tests

On Windows, the mode-change and deletion tests send real key presses to browser windows whose title matches a sample page (`closeBrowserWindows`). Do not run the suite while sample pages are open in your own browser.
