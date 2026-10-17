import {test} from 'node:test';
import assert from 'node:assert/strict';
import {posix, win32} from 'node:path';
import {articleUrl} from '../scripts/catalog-path.mjs';

test('Windows filesystem article paths become the same searchable reader URLs as POSIX', () => {
  for (const relative of ['wiki/Accessibility.html', 'wiki/Local-Tools.html', 'wiki/nested/Article.html']) {
    const expected = 'site/' + relative;
    const windows = articleUrl('C:\\build\\app\\site', win32.join('C:\\build\\app\\site', relative), win32);
    assert.equal(windows, expected);
    assert.equal(articleUrl('/build/app/site', posix.join('/build/app/site', relative), posix), expected);
    assert.equal(new URL(windows, 'docs://reader/').pathname, '/' + expected);
    assert(!windows.includes('\\'));
  }
});

test('Windows image HTML and non-article paths stay outside the catalog', () => {
  const root = 'C:\\build\\app\\site';
  for (const relative of ['wiki/images/preview.html', 'assets/preview.html', 'index.html', '../wiki/Outside.html', 'wiki/Source.md']) {
    assert.equal(articleUrl(root, win32.join(root, relative), win32), null);
  }
});
