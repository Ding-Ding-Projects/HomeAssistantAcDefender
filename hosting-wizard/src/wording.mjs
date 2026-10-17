const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function validateWording(text) {
        if (new TextEncoder().encode(text).length > 262144) throw new Error('invalid');
        let offset = 0;
        const whitespace = () => { while (/[\x20\t\r\n]/.test(text[offset] || '\0')) offset++; };
        function string() {
            const start = offset++;
            while (offset < text.length) {
                const c = text[offset++];
                if (c === '\\') offset++;
                else if (c === '"') return JSON.parse(text.slice(start, offset));
            }
            throw new Error('invalid');
        }
        function value(depth) {
            if (depth > 8) throw new Error('invalid');
            whitespace();
            if (text[offset] === '"') return string();
            if (text[offset] === '{') {
                offset++; whitespace();
                const result = Object.create(null);
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
        const data = value(0); whitespace();
        if (offset !== text.length || !data || typeof data !== 'object'
            || Object.keys(data).length !== 2 || data.schemaVersion !== 1
            || !data.entries || typeof data.entries !== 'object') throw new Error('invalid');
        for (const [key, replacement] of Object.entries(data.entries)) {
            if (!key.length || [...key].length > 160 || typeof replacement !== 'string' || [...replacement].length > 1000)
                throw new Error('invalid');
        }
        return data.entries;
    }

export function createWordingStore(storage) {
  const key='ac-defender-setup.personal-wording.v1';
  let entries=Object.create(null),status='empty',hasFile=false,sequence=0;
  const snapshot=()=>({status,hasFile});
  function load(){try{const text=storage.getItem(key);entries=text?validateWording(text):Object.create(null);hasFile=!!text;status=text?'loaded':'empty';}catch{entries=Object.create(null);hasFile=false;status='corrupt';}return snapshot();}
  async function importFile(file){const current=++sequence;try{if(!file||file.size>262144||!file.name.toLowerCase().endsWith('.json'))throw new Error('invalid');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());const next=validateWording(text);if(current!==sequence)return snapshot();try{storage.setItem(key,text);}catch{status='storage';return snapshot();}entries=next;hasFile=true;status='loaded';}catch{if(current===sequence)status='invalid';}return snapshot();}
  function clear(){sequence++;try{storage.removeItem(key);}catch{status='storage';return snapshot();}entries=Object.create(null);hasFile=false;status='empty';return snapshot();}
  function replace(text){return Object.hasOwn(entries,text)?entries[text]:text;}
  load();return {snapshot,load,importFile,clear,replace};
}
