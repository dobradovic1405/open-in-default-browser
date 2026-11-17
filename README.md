# Open in Default Browser

Open HTML files in your default browser straight from VS Code, with optional live reload whenever you save.

## Features

- Open any `.html` or `.htm` file in the system's default browser.
- Choose how HTML files open: externally, externally with the text kept open, or in the editor only.
- Live reload: the page refreshes automatically when files in its folder change.
- Works from the Explorer, the editor context menu, the editor title bar, and the Command Palette.

## Usage

### Open a file

- Right-click an HTML file in the Explorer and select **Open in Default Browser**.
- Or open a supported file and press `Ctrl+Alt+B` (`Cmd+Alt+B` on macOS).
- Or run **Open in Default Browser** from the Command Palette (`Ctrl+Shift+P`).

### Choose an open mode

Run **Choose Open Mode** from the Command Palette, or change `openInDefaultBrowser.mode` in the settings.

| Mode | Behavior |
| --- | --- |
| `external` (default) | Opens the file in the browser and closes the text tab. |
| `both` | Opens the file in the browser and keeps the text open in the editor. |
| `editor` | Only opens the file in the editor. Nothing opens automatically. |

The automatic modes open a file the first time it is shown in the editor. Switching between tabs does not reopen the browser.

### Live reload

With live reload enabled, the file's folder is served on `http://127.0.0.1:<port>`. The page refreshes whenever a web file in that folder changes, for example after you save in VS Code, or when a tool regenerates a report.

Live reload only works for pages opened through this extension. Pages that were opened directly with a `file://` address will not refresh.

Notes:
- The port changes each time VS Code starts. A browser tab opened in a previous session needs to be reopened.
- Only the most recently opened HTML file's folder is served. Opening a file from another folder switches the served folder.
- Changes that are not saved to disk do not reach the browser. Enable Auto Save (`files.autoSave`) to refresh automatically while you type.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `openInDefaultBrowser.mode` | `external` | How HTML files open: `external`, `both`, or `editor`. |
| `openInDefaultBrowser.liveReload` | `true` | Reload the page in the browser when files in its folder change. |

## Requirements

- VS Code 1.75 or newer.
- A default browser set in your operating system.

## Known Issues

- Live reload does not detect changes made outside VS Code until the file system watcher reports them. Most editors and tools trigger this reliably.
- Closing browser tabs of opened pages (on a mode change or when a file is deleted) only works on Windows. It uses PowerShell and sends keys to Chrome, Edge, Brave, or Firefox, and it moves those windows to the foreground while it runs. On macOS and Linux, the pages stay open and must be closed manually.
- Opening files in the default browser is tested on Windows only. macOS and Linux use `open` and `xdg-open`, which have not been verified.

## Release Notes

See CHANGELOG.md.

## License

MIT License. See [LICENSE](LICENSE).
