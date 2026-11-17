const vscode = require('vscode');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { isInside, safeDecode, folderId } = require('./lib/paths');
const { withReload, withTitle, wrapPage, bodyFor } = require('./lib/html');

const DEFAULT_EXTENSIONS = ['html', 'htm', 'xhtml', 'svg', 'pdf', 'md', 'xml', 'xsd', 'json'];
// Files that are already HTML (served with the reload script injected).
const HTML_EXTENSIONS = ['.html', '.htm', '.xhtml'];
// Files that are wrapped in an HTML page so the browser can show them (and reload them).
const WRAPPED_EXTENSIONS = ['.md', '.json', '.xml', '.xsd', '.svg', '.pdf'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.xhtml': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.xsd': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Only web-relevant files trigger a reload, so large report artifacts (traces, zips) are ignored.
const RELOAD_GLOB = '**/*.{html,htm,xhtml,css,js,mjs,json,xml,xsd,md,svg,pdf,png,jpg,jpeg,gif,webp,woff,woff2,ttf}';
const RELOAD_DEBOUNCE_MS = 150;

// Live reload state
let server = null;
let serverPort = 0;
let reloadTimer = null;
// Served folders: folder id -> absolute folder path, and one file watcher per folder.
const roots = new Map();
const watchers = new Map();
// Open pages: page path (e.g. "/index.html") -> last poll time and a counter for forced reloads.
const openPages = new Map();
// Increased whenever a file in the served folder changes.
let changeVersion = 0;
// A page counts as open if it polled within this time.
const PAGE_TIMEOUT_MS = 3000;

// Cache of generated pages, keyed by path and live-reload flag, validated by mtime and size.
const pageCache = new Map();

// Page titles of the files opened in the browser during this session (used to find their windows).
const openedTitles = new Set();
// Window title per opened file path, so a deleted file's browser tab can be found.
const titleByPath = new Map();

// Editor tabs that were already handled, so the browser is not reopened on every tab switch.
const handled = new Set();

function config() {
  return vscode.workspace.getConfiguration('openInDefaultBrowser');
}

function liveReloadEnabled() {
  return config().get('liveReload', true);
}

function supportedExtensions() {
  return config()
    .get('fileExtensions', DEFAULT_EXTENSIONS)
    .map((ext) => String(ext).replace(/^\./, '').toLowerCase());
}

function isSupportedFile(uri) {
  if (!uri || uri.scheme !== 'file') {
    return false;
  }
  const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
  return supportedExtensions().includes(ext);
}

/** Returns the HTML page for a file, cached until the file changes. */
async function buildPage(filePath, ext, stat) {
  const reload = liveReloadEnabled();
  const cacheKey = `${filePath}|${reload}`;
  const cached = pageCache.get(cacheKey);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.html;
  }

  let html;
  if (HTML_EXTENSIONS.includes(ext)) {
    const source = await fs.promises.readFile(filePath, 'utf8');
    html = withReload(withTitle(source, path.basename(filePath)), reload);
  } else {
    const name = path.basename(filePath);
    const rawUrl = `${encodeURIComponent(name)}?raw=1`;
    const text = ext === '.pdf' || ext === '.svg' ? '' : await fs.promises.readFile(filePath, 'utf8');
    html = withReload(wrapPage(name, bodyFor(ext, name, rawUrl, text)), reload);
  }

  pageCache.set(cacheKey, { mtimeMs: stat.mtimeMs, size: stat.size, html });
  return html;
}

async function sendFile(res, filePath, stat, raw) {
  const ext = path.extname(filePath).toLowerCase();

  if (!raw && (HTML_EXTENSIONS.includes(ext) || WRAPPED_EXTENSIONS.includes(ext))) {
    try {
      const html = await buildPage(filePath, ext, stat);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('The file could not be rendered.');
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const urlPath = safeDecode(url.pathname);

  if (urlPath === '/__poll') {
    const page = safeDecode(url.searchParams.get('page') || '');
    const entry = openPages.get(page) || { seen: 0, force: 0 };
    entry.seen = Date.now();
    openPages.set(page, entry);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ version: changeVersion, force: entry.force }));
    return;
  }

  // Files are served from /f/<folder id>/<file name>.
  const match = urlPath.match(/^\/f\/([0-9a-f]{12})\/(.*)$/);
  const dir = match ? roots.get(match[1]) : undefined;
  if (!dir) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const requested = path.resolve(dir, './' + match[2]);
  if (!isInside(requested, dir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const raw = url.searchParams.get('raw') === '1';

  fs.stat(requested, (statErr, stat) => {
    if (statErr) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (stat.isDirectory()) {
      const indexPath = path.join(requested, 'index.html');
      fs.stat(indexPath, (indexErr, indexStat) => {
        if (indexErr) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        sendFile(res, indexPath, indexStat, false);
      });
      return;
    }

    sendFile(res, requested, stat, raw);
  });
}

function ensureServer() {
  if (server) {
    return Promise.resolve(serverPort);
  }
  return new Promise((resolve, reject) => {
    server = http.createServer(handleRequest);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
  });
}

function broadcastReload() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    changeVersion++;
  }, RELOAD_DEBOUNCE_MS);
}

/** True if an open page is showing the given page path. */
function isPageConnected(pageName) {
  const entry = openPages.get(pageName);
  return Boolean(entry && Date.now() - entry.seen < PAGE_TIMEOUT_MS);
}

/** Reloads the open page that shows the given page path. */
function reloadPage(pageName) {
  const entry = openPages.get(pageName);
  if (entry) {
    entry.force++;
  }
}

/** Registers a folder for serving and starts watching it for changes (once per folder). */
function registerRoot(id, dir) {
  if (roots.has(id)) {
    return;
  }
  roots.set(id, dir);
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, RELOAD_GLOB));
  watcher.onDidChange(broadcastReload);
  watcher.onDidCreate(broadcastReload);
  // No reload on delete: the page would turn into a 404 page and its window title would no longer match.
  watcher.onDidDelete((uri) => {
    queueDeleted(uri.fsPath);
  });
  watchers.set(id, watcher);
}

/**
 * Remembers the window title the browser will show for a file, so its window can be found later.
 * HTML files use their <title>, all other files use their file name.
 */
function rememberTitle(filePath) {
  let title = path.basename(filePath);
  if (HTML_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(64 * 1024);
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);
      const match = buffer.toString('utf8', 0, bytes).match(/<title[^>]*>([^<]*)<\/title>/i);
      if (match && match[1].trim()) {
        title = match[1].trim();
      }
    } catch {
      // Unreadable file: keep the file name as title.
    }
  }
  openedTitles.add(title);
  titleByPath.set(filePath, title);
}

/**
 * Opens a file in the default browser.
 * The file is served over localhost, so Markdown, JSON, XML, SVG and PDF files are shown rendered
 * and the page reloads when files in its folder change.
 */
async function openFile(uri) {
  rememberTitle(uri.fsPath);

  const dir = path.dirname(uri.fsPath);
  const name = path.basename(uri.fsPath);
  const id = folderId(dir);
  registerRoot(id, dir);
  const pageName = `/f/${id}/${name}`;

  // The page is already open: reload it instead of opening a second tab.
  if (isPageConnected(pageName)) {
    reloadPage(pageName);
    return true;
  }

  const port = await ensureServer();
  const url = `http://127.0.0.1:${port}/f/${id}/${encodeURIComponent(name)}`;
  return openInBrowser(url);
}

/**
 * Starts the operating system's default browser directly.
 * This ignores the VS Code setting "workbench.externalBrowser".
 */
function startSystemBrowser(url) {
  return new Promise((resolve) => {
    let command;
    let args;
    if (process.platform === 'win32') {
      // explorer.exe receives the URL as a plain argument, so no shell interprets characters like & or %.
      command = 'explorer.exe';
      args = [url];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [url];
    } else {
      command = 'xdg-open';
      args = [url];
    }

    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

// Test seam: the automated tests replace the browser launch so no real browser opens.
let browserLauncher = null;

/**
 * Opens a URL in the system's default browser, falling back to VS Code if that fails.
 */
async function openInBrowser(url) {
  const launch = browserLauncher || startSystemBrowser;
  if (await launch(url)) {
    return true;
  }

  const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
  if (!opened) {
    vscode.window.showErrorMessage('The file could not be opened in the default browser.');
  }
  return opened;
}

/** Finds the editor tab for a file (text or custom editor such as the PDF viewer). */
function findTab(key) {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if ((input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) && input.uri.toString() === key) {
        return tab;
      }
    }
  }
  return undefined;
}

/** Handles a supported file that was shown in the editor, according to the open mode. */
async function handleOpened(uri) {
  const mode = config().get('mode', 'external');
  if (mode === 'editor' || !isSupportedFile(uri)) {
    return;
  }

  const key = uri.toString();
  if (handled.has(key)) {
    return;
  }
  handled.add(key);

  const opened = await openFile(uri);
  if (!opened || mode !== 'external') {
    return;
  }

  const tab = findTab(key);
  if (tab) {
    await vscode.window.tabGroups.close(tab);
  }
}

/** Closes all editor tabs that show a supported file. */
async function closeOpenedTabs() {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      return (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) && isSupportedFile(input.uri);
    });
  for (const tab of tabs) {
    await vscode.window.tabGroups.close(tab);
  }
}

/**
 * Closes the browser tabs of the opened pages (Windows only).
 * For each running browser, it cycles through the tabs with Ctrl+Tab, reads the window title
 * and closes every tab whose title matches an opened page with Ctrl+W.
 * Note: this moves the browser window to the foreground and switches tabs visibly.
 */
function closeBrowserWindows(titles = [...openedTitles]) {
  if (process.platform !== 'win32' || titles.length === 0) {
    return Promise.resolve();
  }

  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    '$ws = New-Object -ComObject WScript.Shell',
    'Add-Type @"',
    'using System;',
    'using System.Text;',
    'using System.Runtime.InteropServices;',
    'public class OidbWin {',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '}',
    '"@',
    '$targets = @($env:OIDB_TITLES -split "`n" | Where-Object { $_ })',
    'function Get-FgTitle {',
    '  $sb = New-Object System.Text.StringBuilder 512',
    '  [void][OidbWin]::GetWindowText([OidbWin]::GetForegroundWindow(), $sb, 512)',
    '  # Edge puts a zero-width space (U+200B) before "Edge" in its title; remove such characters before matching.',
    '  $sb.ToString() -replace "[\\u200B-\\u200D\\uFEFF]", ""',
    '}',
    'function Is-Target([string]$t) {',
    '  foreach ($x in $targets) { if ($t.StartsWith($x)) { return $true } }',
    '  return $false',
    '}',
    '$procs = Get-Process -Name chrome,msedge,brave,firefox | Where-Object { $_.MainWindowHandle -ne 0 }',
    'foreach ($p in $procs) {',
    '  if (-not $ws.AppActivate($p.Id)) { continue }',
    '  Start-Sleep -Milliseconds 250',
    '  $start = $null; $first = $false; $steps = 0',
    '  while ($steps -lt 80) {',
    '    $steps++',
    '    $t = Get-FgTitle',
    '    $isMain = { param($x) $x -match "(Google Chrome|Microsoft Edge|Brave|Mozilla Firefox)$" }',
    '    if (-not (& $isMain $t)) {',
    '      # Popups (e.g. the translate bubble) have no title with a dash: close them with Esc.',
    '      # Dialogs (e.g. the print dialog, title with a dash) are left alone, so no keys reach them.',
    '      if ($t -notmatch "[-–—]") { $ws.SendKeys("{ESC}"); Start-Sleep -Milliseconds 300; $t = Get-FgTitle }',
    '      if (-not (& $isMain $t)) { break }',
    '    }',
    '    if ($null -eq $start) { $start = $t; $first = $true }',
    '    if (Is-Target $t) { $ws.SendKeys("^w"); Start-Sleep -Milliseconds 300; $start = $null; continue }',
    '    if (-not $first -and $t -eq $start) { break }',
    '    $first = $false',
    '    $ws.SendKeys("^{TAB}"); Start-Sleep -Milliseconds 150',
    '  }',
    '}',
  ].join('\n');

  // EncodedCommand avoids quoting problems with the multi-line script.
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  return new Promise((resolve) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, OIDB_TITLES: titles.join('\n') },
      }
    );
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
}

// Deleted files waiting to be closed. Deletions are collected, so several deletions run as one batch.
let deletedQueue = [];
let deletedTimer = null;

function queueDeleted(filePath) {
  deletedQueue.push(filePath);
  if (deletedTimer) {
    clearTimeout(deletedTimer);
  }
  deletedTimer = setTimeout(() => {
    deletedTimer = null;
    const batch = deletedQueue;
    deletedQueue = [];
    deleteBatches += 1;
    closeDeletedFiles(batch);
  }, 500);
}

// Number of deletion batches handled. Only read by the automated tests.
let deleteBatches = 0;

/** Closes the browser pages and editor tabs of deleted files. */
async function closeDeletedFiles(filePaths) {
  const titles = [];
  for (const filePath of filePaths) {
    const title = titleByPath.get(filePath);
    if (title) {
      titles.push(title);
    }
    titleByPath.delete(filePath);
    openPages.delete(`/f/${folderId(path.dirname(filePath))}/${path.basename(filePath)}`);
  }

  if (titles.length > 0) {
    await closeBrowserWindows(titles);
  }

  for (const filePath of filePaths) {
    const key = vscode.Uri.file(filePath).toString();
    const tab = findTab(key);
    if (tab) {
      await vscode.window.tabGroups.close(tab);
    }
    handled.delete(key);
  }
}

function stopServer() {
  for (const watcher of watchers.values()) {
    watcher.dispose();
  }
  watchers.clear();
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  openPages.clear();
  if (server) {
    server.close();
    server = null;
  }
  roots.clear();
  pageCache.clear();
}

function activate(context) {
  // Start the local server in advance, so the first click does not wait for it.
  ensureServer().catch(() => {});

  // Manual command: explorer/context menu, editor, keybinding, command palette.
  context.subscriptions.push(
    vscode.commands.registerCommand('openInDefaultBrowser.open', async (resource) => {
      let uri = resource instanceof vscode.Uri ? resource : undefined;
      if (!uri) {
        uri = vscode.window.activeTextEditor?.document.uri;
      }
      if (!uri || uri.scheme !== 'file') {
        vscode.window.showWarningMessage('Open in Default Browser: please select a local file.');
        return;
      }
      await openFile(uri);
    })
  );

  // Choose how supported files open: external, both, or editor only.
  context.subscriptions.push(
    vscode.commands.registerCommand('openInDefaultBrowser.chooseMode', async () => {
      const items = [
        { label: 'Open externally (close the text tab)', value: 'external' },
        { label: 'Open externally and keep the text in the editor', value: 'both' },
        { label: 'Text in the editor only', value: 'editor' },
      ];
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'How should supported files be opened?',
      });
      if (pick) {
        await config().update('mode', pick.value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Open mode: ${pick.label}`);
      }
    })
  );

  // When the mode changes, close the browser pages and the editor tabs, and stop the live-reload server.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration('openInDefaultBrowser.mode')) {
        return;
      }
      await closeBrowserWindows();
      await closeOpenedTabs();
      stopServer();
      openedTitles.clear();
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        handleOpened(editor.document.uri);
      }
    }),
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      for (const tab of event.opened) {
        if (tab.input instanceof vscode.TabInputCustom) {
          handleOpened(tab.input.uri);
        }
      }
      for (const tab of event.closed) {
        const input = tab.input;
        if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) {
          handled.delete(input.uri.toString());
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      handled.delete(doc.uri.toString());
    }),
    { dispose: () => stopServer() }
  );

  // VS Code hands this object to the automated tests (tests/integration, tests/e2e). Not a public API.
  return {
    _test: {
      setBrowserLauncher(fn) {
        browserLauncher = fn;
      },
      getServerPort() {
        return serverPort;
      },
      getDeleteBatches() {
        return deleteBatches;
      },
    },
  };
}

function deactivate() {
  stopServer();
}

module.exports = { activate, deactivate };
