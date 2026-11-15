# Change Log

All notable changes to this extension are documented in this file.

## [1.10.0]

- XSD files (`.xsd`) are supported. They are shown like XML files (formatted as text) and get live reload. `xsd` is part of the default `openInDefaultBrowser.fileExtensions` list and the right-click, editor title and keybinding entries.

## [1.9.7]

- HTML files without a `<title>` get the file name as title, so their browser tab can be matched and closed.

## [1.9.6]

- Fixed: deleting a file no longer reloads the open pages. The reload turned the deleted file's page into a 404 page, so its tab could not be matched and was not closed.

## [1.9.5]

- When a file is deleted in a folder that was opened, its browser page (Windows only) and editor tab are closed. Several deletions are handled as one batch.

## [1.9.4]

- Windows: when a dialog (for example the print dialog) is in front of the browser, no keys are sent to it. Popups without a title are still closed with `Esc`.

## [1.9.3]

- Fixed: opening a file from another folder made the server switch folders, so files from the previous folder were opened a second time. Each folder now has its own address (`/f/<id>/...`), and open pages are recognized across folders.

## [1.9.2]

- Fixed: opening a file again could open a new tab that kept loading. The live-reload connection used a permanent connection per page, and browsers allow only about six per host. Pages now poll the server once per second with short requests instead.

## [1.9.1]

- Closing browser tabs on a mode change: a browser popup (for example the Google Translate bubble) no longer stops the process. `Esc` closes it and the search continues.

## [1.9.0]

- More file types: `html`, `htm`, `xhtml`, `svg`, `pdf`, `md`, `xml`, `json`. The list is set in `openInDefaultBrowser.fileExtensions`.
- Markdown files are rendered with `marked` (bundled dependency).
- JSON and XML are shown formatted. SVG and PDF are shown in the browser.
- All file types support live reload.

## [1.8.0]

- On a mode change, browser tabs of the opened pages are closed by cycling through the tabs (Windows only).

## [1.7.0]

- A page that is already open is reloaded instead of opening a second tab.

## [1.6.0]

- A mode change closes the browser window of the opened page (Windows only, best effort).

## [1.5.2]

- Windows: the browser is started with `explorer.exe <url>` instead of `cmd /c start`. File names with characters like `&` or `%` now open correctly, and consecutive opens each open a tab.

## [1.5.1]

- The browser is now started directly from the operating system (`start` on Windows, `open` on macOS, `xdg-open` on Linux). The VS Code setting `workbench.externalBrowser` no longer affects this extension. VS Code is used as a fallback.

## [1.5.0]

- All UI text, settings and documentation are now in English.
- Added keywords for better discoverability.

## [1.4.0]

- Performance: the local server starts when VS Code starts instead of on the first click.
- Performance: served HTML pages are cached and only rebuilt when the file changes.
- Performance: the file watcher only observes web files (HTML, CSS, JS, images, fonts), so trace and zip files in the report folder are ignored.
- Reload events are bundled, so several file changes in a short time trigger only one reload.

## [1.3.0]

- Three open modes: `external`, `both`, `editor` (setting `openInDefaultBrowser.mode`).
- New command **Choose HTML Open Mode** to switch modes from the command palette.
- Live reload: HTML files are served over `localhost` and the page reloads when files in its folder change (setting `openInDefaultBrowser.liveReload`).

## [1.2.0]

- Extension activates on startup, so automatic opening works without running a command first.
- Added command **Toggle Auto-Open HTML in Default Browser**.

## [1.1.0]

- Automatic mode: HTML files shown in the editor open in the default browser and their text tab is closed.
- Setting `openInDefaultBrowser.autoOpen`.

## [1.0.0]

- Initial release: open HTML files in the default browser from the explorer, editor, title bar, command palette, or with `Ctrl+Alt+B`.
