const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
const { chromium } = require('playwright-core');

const EXTENSION_ID = 'denis-obradovic.open-in-default-browser';
// tests/e2e -> tests/testdata
const TESTDATA = path.resolve(__dirname, '..', 'testdata');

let api;
let browser;
let launched = [];

/** Replaces the browser start: records the URL, then Chromium (Playwright) opens it instead. */
function fakeLauncher(url) {
  launched.push(url);
  return Promise.resolve(true);
}

function sample(folder, ext) {
  return vscode.Uri.file(path.join(TESTDATA, folder, `sample.${ext}`));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) {
      return;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

/** Runs the open command and returns the URL the extension produced. */
async function openWithCommand(uri) {
  const before = launched.length;
  await vscode.commands.executeCommand('openInDefaultBrowser.open', uri);
  await waitFor(() => launched.length > before, `URL for ${path.basename(uri.fsPath)}`);
  return launched[launched.length - 1];
}

describe('Served pages in Chromium', function () {
  this.timeout(60000);

  before(async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test host`);
    api = await extension.activate();
    api._test.setBrowserLauncher(fakeLauncher);
    // Headless Chromium from Playwright; run `npx playwright install chromium` once beforehand.
    browser = await chromium.launch({ headless: true });
  });

  beforeEach(() => {
    launched = [];
  });

  after(async () => {
    api._test.setBrowserLauncher(null);
    if (browser) {
      await browser.close();
    }
    // The extension counts a page as open for 3 seconds after its last poll. Wait until these
    // pages are no longer "open", so the next test file gets a fresh browser launch.
    await sleep(3500);
  });

  it('renders an HTML sample with its title and content @smoke', async () => {
    const url = await openWithCommand(sample('root', 'html'));
    const page = await browser.newPage();
    try {
      const response = await page.goto(url);
      assert.strictEqual(response.status(), 200);
      assert.strictEqual(await page.title(), 'sample.html - root');
      assert.strictEqual((await page.locator('h1').textContent()).trim(), 'Testdatei HTML');
    } finally {
      await page.close();
    }
  });

  it('uses the file name as title when an HTML file has no <title> @regression', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-title-'));
    try {
      const file = path.join(dir, 'untitled.html');
      fs.writeFileSync(file, '<!doctype html><html><body><p>no title here</p></body></html>');
      const url = await openWithCommand(vscode.Uri.file(file));
      const page = await browser.newPage();
      try {
        await page.goto(url);
        assert.strictEqual(await page.title(), 'untitled.html');
      } finally {
        await page.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renders an SVG sample as a loaded image', async () => {
    // The extension wraps SVG files in <img class="fit">, so check that the image actually loaded.
    const url = await openWithCommand(sample('root', 'svg'));
    const page = await browser.newPage();
    try {
      await page.goto(url);
      await page.waitForFunction(() => {
        const img = document.querySelector('img.fit');
        return Boolean(img && img.complete && img.naturalWidth > 0);
      });
      const size = await page.locator('img.fit').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
      assert.ok(size.w > 0 && size.h > 0, `image has a size (${size.w}x${size.h})`);
    } finally {
      await page.close();
    }
  });

  it('shows an XSD file as its source text in the page @regression', async () => {
    // The extension wraps XSD files in <pre>. Check that the schema text is visible, not only the HTTP status.
    const url = await openWithCommand(sample('root', 'xsd'));
    const page = await browser.newPage();
    try {
      await page.goto(url);
      const shown = await page.locator('pre').textContent();
      assert.ok(shown.includes('<xs:schema'), 'the schema element is shown');
      assert.ok(shown.includes('<xs:element name="note">'), 'the note element is shown');
    } finally {
      await page.close();
    }
  });

  it('reloads the page in Chromium after the file is saved', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-chrome-reload-'));
    const page = await browser.newPage();
    try {
      const file = path.join(dir, 'live.html');
      fs.writeFileSync(file, '<!doctype html><html><head><title>live</title></head><body><p id="v">v1</p></body></html>');
      const url = await openWithCommand(vscode.Uri.file(file));
      await page.goto(url);
      // A value set on the window disappears after a real reload.
      await page.evaluate(() => {
        window.__beforeReload = true;
      });

      let saves = 0;
      await waitFor(async () => {
        saves += 1;
        fs.writeFileSync(file, `<!doctype html><html><head><title>live</title></head><body><p id="v">v${saves + 1}</p></body></html>`);
        await sleep(1000);
        try {
          return await page.evaluate(() => window.__beforeReload === undefined);
        } catch (error) {
          // The reload itself destroys the page's JavaScript context while we are checking.
          // That is the reload we are waiting for, so it counts as success.
          if (/Execution context was destroyed|navigation/.test(error.message)) {
            return true;
          }
          throw error;
        }
      }, 'Chromium page to reload after saving', 30000);

      await page.waitForLoadState('load');
      assert.strictEqual(await page.evaluate(() => window.__beforeReload), undefined, 'page was reloaded');
      assert.ok((await page.locator('#v').textContent()).startsWith('v'), 'page shows content again');
    } finally {
      await page.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Manual case M-16 (Windows): deleting a file closes its page in the real browser window.
 *
 * Desktop-intrusive: the extension brings the browser window to the foreground and sends
 * Ctrl+Tab and Ctrl+W to it. Run only on a machine where nothing else is in use:
 *   OPEN_IN_BROWSER_DESKTOP_TESTS=1 npm run test:extension
 * Uses the installed Microsoft Edge, because the extension recognises its window title suffix.
 */
const runDesktop = process.platform === 'win32' && process.env.OPEN_IN_BROWSER_DESKTOP_TESTS === '1';

(runDesktop ? describe : describe.skip)('Windows desktop: deleting closes the browser page', function () {
  this.timeout(120000);

  let api2;

  before(async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    await extension.activate();
    api2 = extension.exports;
    api2._test.setBrowserLauncher(fakeLauncher);
  });

  after(() => {
    api2._test.setBrowserLauncher(null);
  });

  it('closes the Edge window of a page whose file is deleted (M-16) @regression', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-browser-desktop-'));
    const title = `desktop-delete-${Date.now()}`;
    const file = path.join(dir, 'gone.html');
    fs.writeFileSync(file, `<!doctype html><html><head><title>${title}</title></head><body>x</body></html>`);

    let edge;
    try {
      const url = await openWithCommand(vscode.Uri.file(file));
      edge = await chromium.launch({ channel: 'msedge', headless: false });
      const page = await edge.newPage();
      await page.goto(url);
      // Give the page time to poll, so the extension knows it is open.
      await sleep(1500);

      fs.rmSync(file);
      await waitFor(() => page.isClosed(), 'Edge page to close after the file was deleted', 60000);
    } finally {
      if (edge) {
        await edge.close().catch(() => {});
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
