export const accepted = [
  {},
  { Review: 'Inspect' },
  { ['a'.repeat(160)]: 'b'.repeat(1000) },
  { ['😀'.repeat(160)]: '😀'.repeat(1000) },
  Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`key${index}`, 'value']))
];
export const rejected = [
  '{"schemaVersion":1,"schemaVersion":1,"entries":{}}',
  '{"schemaVersion":1,"entries":{"a":"b","a":"c"}}',
  '{"schemaVersion":1,"entries":{"\\u0061":"b","a":"c"}}',
  '{"schemaVersion":1,"entries":{"__proto__":"x"}}',
  '{"schemaVersion":1,"entries":{"constructor":"x"}}',
  '{"schemaVersion":1,"entries":{"prototype":"x"}}',
  '{"schemaVersion":2,"entries":{}}',
  '{"schemaVersion":1,"entries":{},"extra":true}',
  '{"schemaVersion":1,"entries":{"a":false}}',
  '{"schemaVersion":1,"entries":{"a":{}}}',
  '{"schemaVersion":1,"entries":[]}', 'null', '{',
  '{"schemaVersion":1,"entries":{"a":"bad\nstring"}}',
  JSON.stringify({ schemaVersion: 1, entries: { ['a'.repeat(161)]: 'b' } }),
  JSON.stringify({ schemaVersion: 1, entries: { a: 'b'.repeat(1001) } }),
  ' '.repeat(262145),
  '{"schemaVersion":1,"entries":{"a":' + '{"nested":'.repeat(9) + '0' + '}'.repeat(9) + '}}'
];
