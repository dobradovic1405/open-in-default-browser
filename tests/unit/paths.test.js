/**
 * Unit tests for lib/paths.js. Plain Node + Mocha, no VS Code.
 * Run: npm run test:unit
 */
const assert = require('assert');
const path = require('path');
const { isInside, safeDecode, folderId } = require('../../lib/paths');

describe('lib/paths', () => {
  describe('isInside', () => {
    it('is true for the folder itself', () => {
      const dir = path.join('/work', 'site');
      assert.strictEqual(isInside(dir, dir), true);
    });

    it('is true for a file inside the folder', () => {
      const dir = path.join('/work', 'site');
      assert.strictEqual(isInside(path.join(dir, 'page.html'), dir), true);
    });

    it('is true for a file in a sub-folder', () => {
      const dir = path.join('/work', 'site');
      assert.strictEqual(isInside(path.join(dir, 'a', 'b', 'page.html'), dir), true);
    });

    it('is false for a sibling folder whose name starts with the same text', () => {
      // "/work/site-old" starts with "/work/site" but is not inside it.
      const dir = path.join('/work', 'site');
      assert.strictEqual(isInside(path.join('/work', 'site-old', 'page.html'), dir), false);
    });

    it('is false for a parent folder', () => {
      const dir = path.join('/work', 'site');
      assert.strictEqual(isInside(path.join('/work', 'page.html'), dir), false);
    });

    it('is false for a path that climbs out with ".."', () => {
      const dir = path.join('/work', 'site');
      // Requests are checked with the resolved path, so a plain ".." segment must not pass.
      const escaped = path.resolve(dir, '..', 'secret.txt');
      assert.strictEqual(isInside(escaped, dir), false);
    });
  });

  describe('safeDecode', () => {
    it('decodes percent-encoded text', () => {
      assert.strictEqual(safeDecode('my%20file.html'), 'my file.html');
    });

    it('leaves plain text unchanged', () => {
      assert.strictEqual(safeDecode('plain.html'), 'plain.html');
    });

    it('returns the input unchanged when it is not valid percent-encoding', () => {
      assert.strictEqual(safeDecode('%E0%A4%A'), '%E0%A4%A');
    });
  });

  describe('folderId', () => {
    it('returns 12 lowercase hex characters', () => {
      assert.match(folderId(path.join('/work', 'site')), /^[0-9a-f]{12}$/);
    });

    it('is the same for the same folder', () => {
      const dir = path.join('/work', 'site');
      assert.strictEqual(folderId(dir), folderId(dir));
    });

    it('differs between folders', () => {
      assert.notStrictEqual(folderId(path.join('/work', 'a')), folderId(path.join('/work', 'b')));
    });
  });
});
