/** Neutral local-wording schema. No vocabulary mappings are bundled. */
export function validateVocabulary(text: string): Record<string, string> {
  if (new TextEncoder().encode(text).length > 262144) throw new Error('invalid');
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  let offset = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[offset] || '\0')) offset++; };
  function string(): string {
    const start = offset++;
    while (offset < text.length) {
      const character = text[offset++];
      if (character === '\\') offset++;
      else if (character === '"') return JSON.parse(text.slice(start, offset)) as string;
    }
    throw new Error('invalid');
  }
  function value(depth: number): unknown {
    if (depth > 8) throw new Error('invalid');
    whitespace();
    if (text[offset] === '"') return string();
    if (text[offset] === '{') {
      offset++; whitespace();
      const result: Record<string, unknown> = Object.create(null);
      if (text[offset] === '}') { offset++; return result; }
      while (offset < text.length) {
        whitespace();
        if (text[offset] !== '"') throw new Error('invalid');
        const key = string(); whitespace();
        if (forbidden.has(key) || Object.hasOwn(result, key) || text[offset++] !== ':') throw new Error('invalid');
        result[key] = value(depth + 1); whitespace();
        const end = text[offset++];
        if (end === '}') return result;
        if (end !== ',') throw new Error('invalid');
      }
    } else {
      const token = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(offset));
      if (token) { offset += token[0].length; return JSON.parse(token[0]); }
    }
    throw new Error('invalid');
  }
  const parsed = value(0); whitespace();
  if (offset !== text.length || !parsed || typeof parsed !== 'object') throw new Error('invalid');
  const data = parsed as Record<string, unknown>;
  if (Object.keys(data).length !== 2 || data.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') throw new Error('invalid');
  for (const [key, replacement] of Object.entries(data.entries)) {
    if (!key.length || [...key].length > 160 || typeof replacement !== 'string' || [...replacement].length > 1000) throw new Error('invalid');
  }
  return data.entries as Record<string, string>;
}

export function decodeVocabulary(bytes: ArrayBuffer): { text: string; entries: Record<string, string> } {
  if (bytes.byteLength > 262144) throw new Error('invalid');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { text, entries: validateVocabulary(text) };
}
