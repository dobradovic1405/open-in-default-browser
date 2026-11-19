import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates the sample files for the "Open in Default Browser" extension.
 *
 * Every supported file type is checked in every folder. This verifies the fixtures
 * themselves (they exist and have the right format). It does not drive the VS Code
 * file tree or check the extension's behaviour, because the extension only runs
 * inside VS Code.
 */

const TESTDATA = path.resolve(__dirname, '..', 'testdata');

const FOLDERS = ['root', 'tests', 'tests2', path.join('tests2', 'testchild')];

const EXTENSIONS = ['html', 'htm', 'xhtml', 'svg', 'pdf', 'md', 'xml', 'xsd', 'json'] as const;

type Ext = (typeof EXTENSIONS)[number];

/** Format check per extension. Returns an error message, or null if the file is valid. */
const CHECKS: Record<Ext, (text: string, folderLabel: string) => string | null> = {
  html: (t, label) => (/<html[\s>]/i.test(t) && /<title>/i.test(t) && t.includes(label) ? null : 'missing <html>, <title> or folder label'),
  htm: (t, label) => (/<html[\s>]/i.test(t) && /<title>/i.test(t) && t.includes(label) ? null : 'missing <html>, <title> or folder label'),
  xhtml: (t, label) =>
    t.startsWith('<?xml') && /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(t) && t.includes(label) ? null : 'missing XHTML namespace or folder label',
  svg: (t, label) => (t.includes('<svg') && t.includes(label) ? null : 'missing <svg> or folder label'),
  pdf: (t, label) => (t.startsWith('%PDF-') && t.trimEnd().endsWith('%%EOF') && t.includes(label) ? null : 'not a PDF or folder label missing'),
  md: (t, label) => (t.startsWith('# ') && t.includes(label) ? null : 'missing heading or folder label'),
  xml: (t, label) => (t.startsWith('<?xml') && t.includes('<note>') && t.includes(label) ? null : 'missing <note> or folder label'),
  xsd: (t, label) => (t.includes('<xs:schema') && t.includes(label) ? null : 'missing <xs:schema> or folder label'),
  json: (t, label) => {
    try {
      const parsed = JSON.parse(t);
      return parsed.folder === label ? null : 'JSON folder field does not match';
    } catch {
      return 'invalid JSON';
    }
  },
};

function folderLabel(folder: string): string {
  return folder.split(path.sep).join('/');
}

function samplePath(folder: string, ext: string): string {
  return path.join(TESTDATA, folder, `sample.${ext}`);
}

for (const folder of FOLDERS) {
  const label = folderLabel(folder);

  test.describe(`sample files in ${label}`, () => {
    for (const ext of EXTENSIONS) {
      test(`sample.${ext} exists and is valid`, () => {
        const file = samplePath(folder, ext);
        expect(fs.existsSync(file), `missing ${path.relative(TESTDATA, file)}`).toBe(true);

        const text = fs.readFileSync(file, ext === 'pdf' ? 'latin1' : 'utf8');
        expect(text.length, 'file is empty').toBeGreaterThan(0);

        const error = CHECKS[ext](text, label);
        expect(error, `${path.relative(TESTDATA, file)}: ${error}`).toBeNull();
      });
    }

    test('sample.xml is described by sample.xsd', () => {
      const xsd = fs.readFileSync(samplePath(folder, 'xsd'), 'utf8');
      const xml = fs.readFileSync(samplePath(folder, 'xml'), 'utf8');

      const declared = [...xsd.matchAll(/<xs:element name="([^"]+)"/g)].map((m) => m[1]);
      expect(declared.length).toBeGreaterThan(0);
      for (const element of declared) {
        expect(xml, `element <${element}> from the XSD is missing in the XML`).toContain(`<${element}>`);
      }
    });
  });
}
