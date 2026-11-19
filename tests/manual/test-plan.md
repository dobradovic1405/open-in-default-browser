# Manual test plan

Version under test: ____  VS Code: ____  OS: ____  Browser: ____  Tester: ____  Date: ____

Every case is run in all three open modes (`external`, `both`, `editor`). The mode for a run is
set in the settings or with **Choose Open Mode**. The expected result differs per mode where the
column says so.

> **Before you start: Extension Development Host trap.** In the Extension Development Host
> window (F5), the extension is active. In mode `external`, every `.md`, `.html`, `.json`, ... file
> you open is sent to the browser automatically, including this plan if it is in that window.
> Open this plan in a separate VS Code window started with `code --disable-extensions`, or in
> another editor, and keep it open there.

Already covered by the automated tests (`npm run test:extension`): M-05 (auto-open in all three modes,
checked with `sample.md`, `sample.json` and `sample.xml`), M-08 (Choose Open Mode), M-09 (the server
returns every type, not the browser rendering), M-11 (reload on save, checked with a temporary file).
Everything else needs a real browser, the menus, the keyboard or the OS and stays manual.

## Cases

| ID | Area | Steps | Expected: `external` | Expected: `both` | Expected: `editor` |
| --- | --- | --- | --- | --- | --- |
| M-01 | Explorer menu | Right-click `testdata/root/sample.html`, choose **Open in Default Browser**. | Browser opens. No editor tab. | Same as `external`. | Same as `external` (the command ignores the mode). |
| M-02 | Shortcut `Ctrl+Alt+B` | Open `sample.md` as a text tab, press `Ctrl+Alt+B`. In `external` the tab closes when shown, so reopen it first. | Browser opens once. No second tab. | Browser opens once, text tab stays. | Browser opens once, text tab stays. |
| M-03 | Command Palette | With `sample.svg` open, run **Open in Default Browser** from `Ctrl+Shift+P`. | Browser opens once, no second tab. | Same as `external`. | Same as `external`. |
| M-04 | Editor title button | With `sample.pdf` open, click the title-bar button. | Browser opens once, no second tab. | Same as `external`. | Same as `external`. |
| M-05 | Auto-open when shown *(automated: mechanics. Manual: visual check)* | Open `sample.html` from the Explorer (single click, preview tab). | Browser opens, text tab closes. | Browser opens, text tab stays. | No browser. Text tab opens. |
| M-06 | Switch between tabs | Open `sample.md` and `sample.json` and switch between them several times. | No second browser tab opens. | No second browser tab opens. | No browser. |
| M-07 | Mode change with files open | Open `sample.html` and `sample.md` in the mode under test, then change the mode. | Browser pages and text tabs close, the server stops. | Same. | Same. |
| M-08 | Choose Open Mode *(automated: setting is written. Manual: menu and message)* | Run **Choose Open Mode**, pick the mode of this run, confirm the setting. | Setting shows `external`. | Setting shows `both`. | Setting shows `editor`. |
| M-09 | File types *(automated: server responds, Chromium renders HTML, SVG and the XSD text. Manual: layout and rendering of PDF, XML, XSD, JSON and Markdown)* | Open each of `htm, html, xhtml, svg, pdf, md, xml, xsd, json` (`testdata/root/`) in turn. | Each opens in the browser, text tab closes (PDF and SVG too). Rendering is correct. | Each opens in the browser, text tab stays. Rendering is correct. | No browser for any type. |
| M-10 | Unsupported type | Open a `.txt` file, right-click it. | No browser, no menu entry. | Same as `external`. | Same as `external`. |
| M-11 | Live reload on *(automated: reload in Chromium. Manual: check the page as a user)* | `liveReload` = true. Open `sample.html` with **Open in Default Browser**, edit and save. | Browser page reloads. | Same as `external`. | Same as `external` (the page was opened by the command). |
| M-12 | Live reload off | `liveReload` = false. Edit and save `sample.html`. | Page does not reload. | Same as `external`. | Same as `external`. |
| M-13 | Live reload port | Restart VS Code, open a file. | Page is served from a new `127.0.0.1:<port>`. | Same as `external`. | Same as `external`. |
| M-14 | Folder switch | Open a file from `testdata/root/`, then one from `testdata/tests2/testchild/`. | Served folder switches, both pages work. | Same as `external`. | Same as `external`. |
| M-15 | Title fallback | Open `testdata/root/sample.htm` (has `<title>`) and an HTML file without `<title>`. | Browser tab title is the file name where no title exists. | Same as `external`. | Same as `external`. |
| M-16 | Delete with open page (Windows) | Open a folder, open a file in the browser, delete the file. | Page and editor tab close. Other pages do not reload. | Same as `external`. | Same as `external`. |
| M-17 | Print dialog (Windows) | Open the print dialog in the browser page, then delete a file. | No keys are sent into the dialog. | Same as `external`. | Same as `external`. |
| M-18 | Non-Windows | macOS or Linux only: open a file, change the mode. | File opens. Browser pages stay open (documented limitation). | Same. | Same. |
| M-19 | Restart with tab open | Keep a supported file open in a text tab, restart VS Code. | Restored tab behaves as in M-05. If it differs, record what happens. | Same as `external`, with the tab kept. | Same as `external`. |

## Results matrix

Codes: **P** = pass, **F** = fail, **S** = skipped, **N/A** = not applicable on this OS.
Write the details of every F in the notes table below.

| ID | `external` | `both` | `editor` |
| --- | --- | --- | --- |
| M-01 | | | |
| M-02 | | | |
| M-03 | | | |
| M-04 | | | |
| M-05 | | | |
| M-06 | | | |
| M-07 | | | |
| M-08 | | | |
| M-09 | | | |
| M-10 | | | |
| M-11 | | | |
| M-12 | | | |
| M-13 | | | |
| M-14 | | | |
| M-15 | | | |
| M-16 | | | |
| M-17 | | | |
| M-18 | | | |
| M-19 | | | |

## Notes on failures

| ID | Mode | VS Code version | OS | Browser | What happened |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
