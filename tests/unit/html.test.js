/**
 * Unit tests for lib/html.js. Plain Node + Mocha, no VS Code.
 * Run: npm run test:unit
 */
const assert = require('assert');
const { RELOAD_SNIPPET, escapeHtml, withReload, withTitle, wrapPage, prettyJson, bodyFor } = require('../../lib/html');

describe('lib/html', () => {
  describe('escapeHtml', () => {
    it('escapes &, <, > and double quotes', () => {
      assert.strictEqual(escapeHtml('a & <b> "c"'), 'a &amp; &lt;b&gt; &quot;c&quot;');
    });

    it('escapes & first, so existing entities are not double-decoded', () => {
      assert.strictEqual(escapeHtml('&lt;'), '&amp;lt;');
    });

    it('converts non-string input to text', () => {
      assert.strictEqual(escapeHtml(42), '42');
    });
  });

  describe('withReload', () => {
    it('inserts the reload script before </body>', () => {
      const out = withReload('<html><body>x</body></html>', true);
      assert.ok(out.includes(RELOAD_SNIPPET + '</body>'));
    });

    it('appends the script when there is no </body>', () => {
      assert.strictEqual(withReload('<p>x</p>', true), '<p>x</p>' + RELOAD_SNIPPET);
    });

    it('returns the HTML unchanged when reload is off', () => {
      const html = '<html><body>x</body></html>';
      assert.strictEqual(withReload(html, false), html);
    });
  });

  describe('withTitle', () => {
    it('keeps an existing title', () => {
      const html = '<html><head><title>Mine</title></head></html>';
      assert.strictEqual(withTitle(html, 'file.html'), html);
    });

    it('detects a title with attributes or in upper case', () => {
      const html = '<HTML><HEAD><TITLE lang="en">Mine</TITLE></HEAD></HTML>';
      assert.strictEqual(withTitle(html, 'file.html'), html);
    });

    it('adds the title inside <head> when there is one', () => {
      const out = withTitle('<html><head><meta charset="utf-8"></head></html>', 'page.html');
      assert.ok(out.includes('<head><title>page.html</title><meta charset="utf-8">'), out);
    });

    it('puts the title first when there is no <head>', () => {
      assert.strictEqual(withTitle('<p>hi</p>', 'page.html'), '<title>page.html</title><p>hi</p>');
    });

    it('escapes the file name', () => {
      const out = withTitle('<p>hi</p>', 'a<b>.html');
      assert.ok(out.startsWith('<title>a&lt;b&gt;.html</title>'), out);
    });
  });

  describe('wrapPage', () => {
    it('puts the body inside a complete HTML document', () => {
      const out = wrapPage('notes.md', '<p>body</p>');
      assert.ok(out.startsWith('<!doctype html>'));
      assert.ok(out.includes('<body>\n<p>body</p>\n</body>'));
    });

    it('escapes the title', () => {
      assert.ok(wrapPage('<x>', '').includes('<title>&lt;x&gt;</title>'));
    });
  });

  describe('prettyJson', () => {
    it('indents valid JSON with two spaces', () => {
      assert.strictEqual(prettyJson('{"a":1,"b":[2]}'), '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
    });

    it('returns invalid JSON unchanged', () => {
      assert.strictEqual(prettyJson('{not json'), '{not json');
    });
  });

  describe('bodyFor', () => {
    it('renders Markdown as HTML inside an article', () => {
      const out = bodyFor('.md', 'a.md', '/raw/a.md', '# Title');
      assert.ok(out.startsWith('<article class="markdown">'));
      assert.ok(out.includes('<h1>Title</h1>'));
    });

    it('shows JSON formatted and escaped', () => {
      assert.strictEqual(bodyFor('.json', 'a.json', '/raw', '{"x":"<y>"}'), '<pre>{\n  &quot;x&quot;: &quot;&lt;y&gt;&quot;\n}</pre>');
    });

    it('shows XML and XSD escaped, without reformatting', () => {
      assert.strictEqual(bodyFor('.xml', 'a.xml', '/raw', '<a>&</a>'), '<pre>&lt;a&gt;&amp;&lt;/a&gt;</pre>');
      assert.strictEqual(bodyFor('.xsd', 'a.xsd', '/raw', '<s/>'), '<pre>&lt;s/&gt;</pre>');
    });

    it('embeds an SVG as a fitted image pointing at the raw URL', () => {
      assert.strictEqual(bodyFor('.svg', 'pic.svg', '/raw/pic.svg', ''), '<img class="fit" src="/raw/pic.svg" alt="pic.svg">');
    });

    it('embeds a PDF with the raw URL', () => {
      assert.strictEqual(bodyFor('.pdf', 'd.pdf', '/raw/d.pdf', ''), '<embed class="full" src="/raw/d.pdf" type="application/pdf">');
    });

    it('shows unknown types as escaped text', () => {
      assert.strictEqual(bodyFor('.txt', 'a.txt', '/raw', '<b>'), '<pre>&lt;b&gt;</pre>');
    });
  });
});
