import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validateVocabulary, decodeVocabulary } from '../app/vocabulary.js';
import { accepted, rejected } from './vocabulary-fixtures.js';
const document = {
  documentElement: { lang: 'en', dataset: {}, classList: { toggle() {} } },
  body: {}, querySelectorAll: () => [], querySelector: () => null,
  getElementById: () => null, addEventListener() {}
};
const context = { document, window: { addEventListener() {} }, TextEncoder, TextDecoder,
  MutationObserver: class { observe() {} disconnect() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout, clearTimeout, queueMicrotask, Intl
};
vm.createContext(context);
vm.runInContext(await readFile('../wwwroot/js/presentation-preferences.js', 'utf8'), context);
const webValidate = context.window.acPresentation.validate;
test('reader and web wording validators accept the same shared neutral fixtures', () => {
  for (const entries of accepted) {
    const text = JSON.stringify({ schemaVersion: 1, entries });
    assert.equal(JSON.stringify(validateVocabulary(text)), JSON.stringify(webValidate(text)));
    assert.equal(Object.keys(validateVocabulary(text)).length, Object.keys(entries).length);
  }
});
test('both wording validators reject duplicates, unsafe keys, depth, size and schema violations', () => {
  for (const text of rejected) {
    assert.throws(() => validateVocabulary(text));
    assert.throws(() => webValidate(text));
  }
});
test('file decoding rejects malformed UTF-8 and enforces byte limit', () => {
  assert.throws(() => decodeVocabulary(new Uint8Array([0xc3, 0x28]).buffer));
  assert.throws(() => decodeVocabulary(new Uint8Array(262145).buffer));
  const bytes = new TextEncoder().encode('{"schemaVersion":1,"entries":{}}');
  assert.equal(Object.keys(decodeVocabulary(bytes.buffer).entries).length, 0);
});
