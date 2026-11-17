const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const vscode = require('vscode');

const EXTENSION_ID = 'denis-obradovic.open-in-default-browser';
// tests/integration -> tests/testdata
const TESTDATA = path.resolve(__dirname, '..', 'testdata');
const SAMPLE_EXTENSIONS = ['html', 'htm', 'xhtml', 'svg', 'pdf', 'md', 'xml', 'xsd', 'json'];

let api;
let launched = [];

/** Replaces the browser start: records the URL instead of opening a browser. */
function fakeLauncher(url) {
  launched.push(url);
  return Promise.resolve(true);
}

function config() {
  return vscode.workspace.getConfiguration('openInDefaultBrowser');
}

function sample(folder, ext) {
  return vscode.Uri.file(path.join(TESTDATA, folder, `sample.${ext}`));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Changes the open mode and waits until the extension's mode-change handler has finished.
 * That handler closes browser windows and editor tabs (on Windows via PowerShell), so a file
 * opened before it finishes could be closed by it.
 */
async function setMode(mode) {
  await config().update('mode', mode, vscode.ConfigurationTarget.Global);
  await sleep(4000);
}

async function waitFor(check, label, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

function httpGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: requestPath }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

/** Opens a file through the command and returns the URL the browser would have received. */
async function openWithCommand(uri) {
  const before = launched.length;
  await vscode.commands.executeCommand('openInDefaultBrowser.open', uri);
  await waitFor(() => launched.length > before, `browser launch for ${path.basename(uri.fsPath)}`);
  return launched[launched.length - 1];
}

/** True when a text or custom editor tab for the file is open. */
function hasTab(uri) {
  const key = uri.toString();
  return vscode.window.tabGroups.all.some((group) =>
    group.tabs.some((tab) => {
      const input = tab.input;
      return (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) && input.uri.toString() === key;
    })
  );
}

describe('Open in Default Browser', function () {
  this.timeout(30000);

  before(async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test host`);
    api = await extension.activate();
    api._test.setBrowserLauncher(fakeLauncher);
  });

  beforeEach(async () => {
    launched = [];
    // Only a changed mode triggers the mode-change handler. Its server stop runs seconds later, so
    // wait for it with setMode. A plain update would let it land in the middle of the next test.
    if (config().inspect('mode').globalValue !== undefined) {
      await setMode(undefined);
    }
    await config().update('liveReload', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  after(async () => {
    api._test.setBrowserLauncher(null);
    // Resetting the mode runs the mode-change handler, which stops the server a few seconds later.
    // setMode waits for it, so the next test file (end-to-end) does not lose its server mid-test.
    await setMode(undefined);
  });

  describe('activation and contributions', () => {
    it('is active after activation @smoke', () => {
      assert.strictEqual(vscode.extensions.getExtension(EXTENSION_ID).isActive, true);
    });

    it('registers both commands @smoke', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('openInDefaultBrowser.open'));
      assert.ok(commands.includes('openInDefaultBrowser.chooseMode'));
    });

    it('contributes the menu entries, shortcut and command palette entry', () => {
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const command = 'openInDefaultBrowser.open';
      for (const place of ['explorer/context', 'editor/context', 'editor/title', 'commandPalette']) {
        const entries = manifest.contributes.menus[place] || [];
        assert.ok(entries.some((entry) => entry.command === command), `menu "${place}" has ${command}`);
      }
      const keys = manifest.contributes.keybindings.filter((binding) => binding.command === command);
      assert.ok(keys.some((binding) => binding.key === 'ctrl+alt+b'), 'Ctrl+Alt+B is bound');
    });

    it('menu and shortcut conditions match exactly the default file extensions', () => {
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const defaults = manifest.contributes.configuration.properties['openInDefaultBrowser.fileExtensions'].default;

      // Every "when" clause ends with: resourceExtname =~ /^\.(ext1|ext2|...)$/
      const conditions = [];
      for (const entries of Object.values(manifest.contributes.menus)) {
        for (const entry of entries) {
          if (entry.when && entry.when.includes('resourceExtname')) {
            conditions.push(entry.when);
          }
        }
      }
      for (const binding of manifest.contributes.keybindings) {
        conditions.push(binding.when);
      }
      assert.ok(conditions.length > 0, 'found menu and keybinding conditions');

      for (const when of conditions) {
        const match = when.match(/=~\s*\/(.+)\/\s*$/);
        assert.ok(match, `condition has a regex: ${when}`);
        const regex = new RegExp(match[1]);
        for (const ext of defaults) {
          assert.ok(regex.test(`.${ext}`), `".${ext}" matches: ${when}`);
        }
        assert.ok(!regex.test('.txt'), `".txt" does not match: ${when}`);
        assert.ok(!regex.test('.js'), `".js" does not match: ${when}`);
      }
    });

    it('binds Ctrl+Alt+B only once and only for the open command', () => {
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const bindings = manifest.contributes.keybindings.filter((binding) => binding.key === 'ctrl+alt+b');
      assert.strictEqual(bindings.length, 1, 'one binding for Ctrl+Alt+B');
      assert.strictEqual(bindings[0].command, 'openInDefaultBrowser.open');
      assert.strictEqual(bindings[0].mac, 'cmd+alt+b');
    });

    it('every contributed menu entry refers to a declared command', () => {
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const declared = new Set(manifest.contributes.commands.map((c) => c.command));
      for (const entries of Object.values(manifest.contributes.menus)) {
        for (const entry of entries) {
          assert.ok(declared.has(entry.command), `${entry.command} is declared`);
        }
      }
    });

    it('has the documented default settings', () => {
      assert.strictEqual(config().get('mode'), 'external');
      assert.strictEqual(config().get('liveReload'), true);
      assert.deepStrictEqual(config().get('fileExtensions'), SAMPLE_EXTENSIONS);
    });
  });

  describe('opening files', () => {
    it('the command opens the file in the browser with a localhost URL @smoke', async () => {
      const url = await openWithCommand(sample('root', 'html'));
      assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/f\/[0-9a-f]{12}\/sample\.html$/);

      const port = new URL(url).port;
      const response = await httpGet(port, new URL(url).pathname);
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.includes('Testdatei HTML'), 'served page has the expected content');
    });

    for (const ext of SAMPLE_EXTENSIONS) {
      it(`serves sample.${ext} with status 200`, async () => {
        const url = await openWithCommand(sample('root', ext));
        const response = await httpGet(new URL(url).port, new URL(url).pathname);
        assert.strictEqual(response.status, 200);
        assert.ok(response.body.length > 0, 'response body is not empty');
      });
    }

    it('returns 404 for a file that does not exist in an opened folder', async () => {
      const url = await openWithCommand(sample('root', 'html'));
      const missing = new URL(url);
      missing.pathname = missing.pathname.replace('sample.html', 'missing.html');
      const response = await httpGet(missing.port, missing.pathname);
      assert.strictEqual(response.status, 404);
    });

    it('refuses to serve files outside the opened folder @regression', async () => {
      const url = await openWithCommand(sample('root', 'html'));
      const parsed = new URL(url);
      const traversal = `/f/${parsed.pathname.split('/')[2]}/..%2F..%2Fpackage.json`;
      const response = await httpGet(parsed.port, traversal);
      assert.strictEqual(response.status, 403);
      assert.ok(!response.body.includes('open-in-default-browser'), 'no file content leaked');
    });

    it('answers the live-reload poll with a version and force value', async () => {
      const url = await openWithCommand(sample('root', 'html'));
      const parsed = new URL(url);
      const page = encodeURIComponent(parsed.pathname);
      const response = await httpGet(parsed.port, `/__poll?page=${page}`);
      assert.strictEqual(response.status, 200);
      const data = JSON.parse(response.body);
      assert.strictEqual(typeof data.version, 'number');
      assert.strictEqual(typeof data.force, 'number');
    });
  });

  describe('live reload', () => {
    it('bumps the reload version when a file in the opened folder changes', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-reload-'));
      try {
        const file = path.join(dir, 'page.html');
        fs.writeFileSync(file, '<!doctype html><html><head><title>v1</title></head><body>v1</body></html>');
        const url = await openWithCommand(vscode.Uri.file(file));
        const parsed = new URL(url);
        const poll = async () => JSON.parse((await httpGet(parsed.port, `/__poll?page=${encodeURIComponent(parsed.pathname)}`)).body);

        const before = (await poll()).version;
        // The file watcher starts asynchronously, so one save can happen before it is ready.
        // Save again every second until the reload version changes.
        let saves = 0;
        await waitFor(async () => {
          saves += 1;
          const title = `v${saves + 1}`;
          fs.writeFileSync(file, `<!doctype html><html><head><title>${title}</title></head><body>${title}</body></html>`);
          await sleep(1000);
          return (await poll()).version !== before;
        }, 'reload version change after save', 30000);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('open modes', () => {
    it('mode "external": a file shown in the editor opens in the browser and its tab closes @smoke', async () => {
      await setMode('external');
      const uri = sample('root', 'md');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));

      await waitFor(() => launched.some((u) => u.endsWith('/sample.md')), 'automatic browser launch');
      await waitFor(() => !hasTab(uri), 'text tab to close');
    });

    it('mode "both": a file shown in the editor opens in the browser and its tab stays open', async () => {
      await setMode('both');
      const uri = sample('root', 'json');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));

      await waitFor(() => launched.some((u) => u.endsWith('/sample.json')), 'automatic browser launch');
      await sleep(1000);
      assert.ok(hasTab(uri), 'text tab is still open');
    });

    it('mode "editor": opening a file does not start the browser', async () => {
      await setMode('editor');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(sample('root', 'xml')));

      await sleep(2000);
      assert.strictEqual(launched.length, 0);
    });

    it('switching between open tabs does not open the browser again', async () => {
      await setMode('both');
      const md = sample('root', 'md');
      const json = sample('root', 'json');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(md), { preview: false });
      await waitFor(() => launched.some((u) => u.endsWith('/sample.md')), 'first automatic launch');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(json), { preview: false });
      await waitFor(() => launched.some((u) => u.endsWith('/sample.json')), 'second automatic launch');
      await sleep(1000);
      const launchCount = launched.length;

      // Switch back and forth between the two open tabs several times.
      for (let i = 0; i < 3; i++) {
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(md), { preview: false });
        await sleep(300);
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(json), { preview: false });
        await sleep(300);
      }
      await sleep(1000);

      assert.strictEqual(launched.length, launchCount, 'no new browser launch while switching tabs');
    });

    it('chooseMode writes the selected mode to settings', async () => {
      const original = vscode.window.showQuickPick;
      vscode.window.showQuickPick = async (items) => items.find((item) => item.value === 'both');
      try {
        await vscode.commands.executeCommand('openInDefaultBrowser.chooseMode');
      } finally {
        vscode.window.showQuickPick = original;
      }
      await waitFor(() => config().get('mode') === 'both', 'mode to be saved as "both"');
    });
  });

  describe('mode change', () => {
    it('closes the text tabs and stops the live-reload server', async () => {
      await setMode('both');
      const uri = sample('root', 'xml');
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
      await waitFor(() => launched.some((u) => u.endsWith('/sample.xml')), 'browser launch before mode change');
      const old = new URL(launched.find((u) => u.endsWith('/sample.xml')));

      await setMode('editor');

      assert.strictEqual(hasTab(uri), false, 'text tab is closed');
      await assert.rejects(httpGet(old.port, old.pathname), 'the old server no longer answers');
    });
  });

  describe('live reload setting', () => {
    it('injects the reload script only while liveReload is on', async () => {
      const on = await openWithCommand(sample('root', 'html'));
      const onBody = (await httpGet(new URL(on).port, new URL(on).pathname)).body;
      assert.ok(onBody.includes('/__poll'), 'script is present with liveReload on');

      await config().update('liveReload', false, vscode.ConfigurationTarget.Global);
      const off = await openWithCommand(sample('tests', 'html'));
      const offBody = (await httpGet(new URL(off).port, new URL(off).pathname)).body;
      assert.ok(!offBody.includes('/__poll'), 'script is absent with liveReload off');
    });
  });

  describe('several folders', () => {
    it('serves files from two folders at the same time under separate addresses @regression', async () => {
      const first = await openWithCommand(sample('root', 'html'));
      const second = await openWithCommand(sample('tests2/testchild', 'html'));

      const firstId = new URL(first).pathname.split('/')[2];
      const secondId = new URL(second).pathname.split('/')[2];
      assert.notStrictEqual(firstId, secondId, 'each folder has its own id');

      const a = await httpGet(new URL(first).port, new URL(first).pathname);
      const b = await httpGet(new URL(second).port, new URL(second).pathname);
      assert.strictEqual(a.status, 200, 'first folder still served');
      assert.strictEqual(b.status, 200, 'second folder served');
    });
  });

  describe('already open pages', () => {
    it('reloads a page that is already open instead of opening a second tab @regression', async () => {
      const uri = sample('tests', 'md');
      const url = await openWithCommand(uri);
      const parsed = new URL(url);
      const page = encodeURIComponent(parsed.pathname);
      const poll = async () => JSON.parse((await httpGet(parsed.port, `/__poll?page=${page}`)).body);

      await poll(); // the page reports that it is open
      const before = (await poll()).force;
      const launchCount = launched.length;

      await vscode.commands.executeCommand('openInDefaultBrowser.open', uri);
      await sleep(1000);

      assert.strictEqual(launched.length, launchCount, 'no second browser launch');
      assert.strictEqual((await poll()).force, before + 1, 'the open page was told to reload');
    });
  });

  describe('browser fallback', () => {
    it('opens the page in VS Code when the browser cannot be started', async () => {
      const originalOpenExternal = vscode.env.openExternal;
      const opened = [];
      api._test.setBrowserLauncher(async () => false);
      vscode.env.openExternal = async (uri) => {
        opened.push(uri.toString());
        return true;
      };
      try {
        await vscode.commands.executeCommand('openInDefaultBrowser.open', sample('root', 'svg'));
        await waitFor(() => opened.length > 0, 'fallback to vscode.env.openExternal');
        assert.match(opened[0], /^http:\/\/127\.0\.0\.1:\d+\/f\/[0-9a-f]{12}\/sample\.svg$/);
      } finally {
        vscode.env.openExternal = originalOpenExternal;
        api._test.setBrowserLauncher(fakeLauncher);
      }
    });
  });

  describe('deleting files', () => {
    it('does not reload the open page when its file is deleted @regression', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-delete-'));
      try {
        const file = path.join(dir, 'page.html');
        fs.writeFileSync(file, '<!doctype html><html><head><title>del</title></head><body>del</body></html>');
        const url = await openWithCommand(vscode.Uri.file(file));
        const parsed = new URL(url);
        const poll = async () => JSON.parse((await httpGet(parsed.port, `/__poll?page=${encodeURIComponent(parsed.pathname)}`)).body);

        // The file watcher starts asynchronously. Until it reacts to a save, a deletion would go unseen,
        // so the test first waits for a save to be picked up.
        const start = (await poll()).version;
        let saves = 0;
        await waitFor(async () => {
          saves += 1;
          fs.writeFileSync(file, `<!doctype html><html><head><title>del${saves}</title></head><body>del</body></html>`);
          await sleep(1000);
          return (await poll()).version !== start;
        }, 'watcher to be ready', 30000);
        await sleep(1000); // let the reload from the saves settle

        const before = (await poll()).version;
        fs.rmSync(file);
        await sleep(3000);
        assert.strictEqual((await poll()).version, before, 'no reload after deletion');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('closes the editor tabs of files that were deleted @regression', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-tabs-'));
      try {
        const a = path.join(dir, 'a.md');
        const b = path.join(dir, 'b.md');
        fs.writeFileSync(a, '# a');
        fs.writeFileSync(b, '# b');
        // A mode change stops the server and its watchers, so change the mode first.
        // Opening a file afterwards registers the folder, so its deletions are watched.
        await setMode('editor');
        await openWithCommand(vscode.Uri.file(a));
        for (const file of [a, b]) {
          await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)), { preview: false });
        }
        assert.ok(hasTab(vscode.Uri.file(a)) && hasTab(vscode.Uri.file(b)), 'both tabs are open before deleting');

        const batchesBefore = api._test.getDeleteBatches();
        // Two deletions in a row fall within the batch window (500 ms), so they count as one batch.
        fs.rmSync(a);
        fs.rmSync(b);
        await waitFor(() => !hasTab(vscode.Uri.file(a)) && !hasTab(vscode.Uri.file(b)), 'both tabs to close', 15000);
        assert.strictEqual(api._test.getDeleteBatches() - batchesBefore, 1, 'both deletions were handled as one batch');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
