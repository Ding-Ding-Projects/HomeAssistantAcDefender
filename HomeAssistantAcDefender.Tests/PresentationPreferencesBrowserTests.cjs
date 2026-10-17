const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const storage = new Map();
const document = {
    documentElement: { lang: 'en', dataset: {}, classList: { toggle() {} } },
    body: {}, querySelectorAll: () => [], querySelector: () => null,
    getElementById: () => null, addEventListener() {}
};
const context = { document, window: { addEventListener() {} }, TextEncoder, TextDecoder,
    MutationObserver: class { observe() {} disconnect() {} },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    setTimeout, clearTimeout, queueMicrotask, Intl };
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../wwwroot/js/presentation-preferences.js'), 'utf8'), context);
const validate = context.window.acPresentation.validate;
const accepted = value => validate(JSON.stringify({ schemaVersion: 1, entries: value }));
accepted({});
assert.equal(accepted({ Review: 'Inspect' }).Review, 'Inspect');
accepted({ ['a'.repeat(160)]: 'b'.repeat(1000) });
accepted({ ['😀'.repeat(160)]: '😀'.repeat(1000) });
for (const text of [
    '{"schemaVersion":1,"schemaVersion":1,"entries":{}}',
    '{"schemaVersion":1,"entries":{"a":"b","a":"c"}}',
    '{"schemaVersion":1,"entries":{"\\u0061":"b","a":"c"}}',
    '{"schemaVersion":1,"entries":{"__proto__":"x"}}',
    '{"schemaVersion":1,"entries":{"constructor":"x"}}',
    '{"schemaVersion":2,"entries":{}}',
    '{"schemaVersion":1,"entries":{},"extra":true}',
    '{"schemaVersion":1,"entries":{"a":false}}',
    '{"schemaVersion":1,"entries":{"a":{}}}',
    '{"schemaVersion":1,"entries":[]}','null','{',
    '{"schemaVersion":1,"entries":{"a":"bad\nstring"}}'
]) assert.throws(() => validate(text));
assert.throws(() => accepted({ ['a'.repeat(161)]: 'b' }));
assert.throws(() => accepted({ a: 'b'.repeat(1001) }));
assert.throws(() => validate(' '.repeat(262145)));
const inventory = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`key${i}`, 'value']));
assert.equal(Object.keys(accepted(inventory)).length, 1000);
assert.equal(context.window.acPresentation.loadProgress(), 0);
context.window.acPresentation.saveProgress(2);
assert.equal(context.window.acPresentation.loadProgress(), 2);
storage.set('ac-defender.setup.v1', '999');
assert.equal(context.window.acPresentation.loadProgress(), 0);
console.log('Presentation schema and progress checks passed.');
