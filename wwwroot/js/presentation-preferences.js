(() => {
    'use strict';
    const wordingKey = 'ac-defender.personal-wording.v1';
    const preferencesKey = 'ac-defender.presentation.v1';
    const progressKey = 'ac-defender.setup.v1';
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
    let entries = Object.create(null), preferences = { focus: false, reducedMotion: false };
    let wordingState = 'empty', celebrationTimer, pending = false, importSequence = 0;
    const originals = new WeakMap();
    const copy = (en, yue) => document.documentElement.lang.startsWith('zh') || document.documentElement.lang.startsWith('yue')
        ? yue : document.documentElement.dataset.presentationLanguage === 'both' ? `${en} · ${yue}` : en;
    function validate(text) {
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
    function status(state) {
        wordingState = state;
        const messages = {
            empty: copy('No personal wording loaded.', '未載入個人用語。'),
            loaded: copy('Personal wording is active in this browser.', '個人用語已喺呢個瀏覽器啟用。'),
            invalid: copy('File rejected. Use schemaVersion 1 and string entries, up to 256 KiB. Previous wording is unchanged.', '檔案唔合規格。請用 schemaVersion 1 同文字 entries，上限 256 KiB。原有用語保持不變。'),
            storage: copy('Browser storage is unavailable. Nothing was applied.', '瀏覽器儲存空間無法使用，未套用任何更改。'),
            corrupt: copy('Saved wording could not be validated. Original wording is shown.', '已儲存用語未能通過驗證，現時顯示原有文字。')
        };
        document.querySelectorAll('[data-wording-status]').forEach(el => { el.textContent = messages[state]; });
        if (['invalid', 'storage'].includes(state) && !document.querySelector('[data-wording-status]')) {
            let notice = document.getElementById('presentation-status');
            if (!notice) { notice = document.createElement('div'); notice.id = 'presentation-status'; notice.setAttribute('role', 'status'); document.body.append(notice); }
            if (notice.textContent !== messages[state]) notice.textContent = messages[state];
        } else document.getElementById('presentation-status')?.remove();
    }
    function replace(original) {
        // Exact text boundaries preserve identifiers, URLs, numbers and external records.
        const trimmed = original.trim();
        return Object.hasOwn(entries, trimmed) ? original.replace(trimmed, entries[trimmed]) : original;
    }
    function transform(node, property, key) {
        let records = originals.get(node);
        if (!records) { records = {}; originals.set(node, records); }
        const current = node[property];
        if (!records[key] || records[key].rendered !== current) records[key] = { original: current };
        const rendered = replace(records[key].original);
        records[key].rendered = rendered;
        if (current !== rendered) node[property] = rendered;
    }
    function refresh() {
        observer.disconnect();
        document.documentElement.classList.toggle('presentation-focus', preferences.focus);
        document.documentElement.classList.toggle('presentation-reduced-motion', preferences.reducedMotion);
        document.querySelectorAll('[data-personal-wording]').forEach(root => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (!node.parentElement.closest('script,style,code,pre,input,textarea,[data-factual],[data-external-record],[data-wording-status],[data-build-provenance]')) transform(node, 'nodeValue', 'text');
            }
            [...(root.matches('[aria-label]') ? [root] : []), ...root.querySelectorAll('[aria-label]')].forEach(el => {
                if (!el.closest('[data-factual],[data-external-record],input,textarea')) transform(el, 'ariaLabel', 'aria');
            });
        });
        document.querySelectorAll('[data-build-time]').forEach(el => {
            const date = new Date(el.dataset.buildTime);
            if (!Number.isNaN(date.getTime())) el.textContent = new Intl.DateTimeFormat(undefined,
                { dateStyle: 'medium', timeStyle: 'long' }).format(date);
        });
        document.querySelectorAll('[data-presentation-focus]').forEach(el => { el.checked = preferences.focus; });
        document.querySelectorAll('[data-presentation-motion]').forEach(el => { el.checked = preferences.reducedMotion; });
        status(wordingState);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    const observer = new MutationObserver(() => {
        if (!pending) { pending = true; queueMicrotask(() => { pending = false; refresh(); }); }
    });
    function celebrate() {
        document.getElementById('presentation-celebration')?.remove();
        clearTimeout(celebrationTimer);
        const notice = document.createElement('div');
        notice.id = 'presentation-celebration'; notice.className = 'presentation-celebration';
        notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
        notice.textContent = entries['private vocabulary'] || copy('Personal wording applied', '已套用個人用語');
        document.body.append(notice);
        celebrationTimer = setTimeout(() => notice.remove(), 3400);
    }
    async function importFile(file) {
        const sequence = ++importSequence;
        try {
            if (!file || file.size > 262144 || !file.name.toLowerCase().endsWith('.json')) throw new Error('invalid');
            const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
            const next = validate(text);
            if (sequence !== importSequence) return;
            try { localStorage.setItem(wordingKey, text); } catch { status('storage'); return; }
            entries = next; status('loaded'); refresh(); celebrate();
        } catch { if (sequence === importSequence) status('invalid'); }
    }
    function clear() {
        importSequence++;
        try { localStorage.removeItem(wordingKey); } catch { status('storage'); return; }
        entries = Object.create(null); status('empty');
        document.getElementById('presentation-celebration')?.remove(); refresh();
    }
    function load() {
        try {
            const raw = localStorage.getItem(wordingKey);
            entries = raw ? validate(raw) : Object.create(null); wordingState = raw ? 'loaded' : 'empty';
        } catch { entries = Object.create(null); wordingState = 'corrupt'; }
        try {
            const raw = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
            preferences = { focus: raw.focus === true, reducedMotion: raw.reducedMotion === true };
        } catch { preferences = { focus: false, reducedMotion: false }; }
        refresh();
    }
    document.addEventListener('change', event => {
        if (event.target.matches('[data-wording-upload]')) {
            importFile(event.target.files[0]); event.target.value = '';
        }
        if (event.target.matches('[data-presentation-focus],[data-presentation-motion]')) {
            const next = { ...preferences };
            next[event.target.matches('[data-presentation-focus]') ? 'focus' : 'reducedMotion'] = event.target.checked;
            try { localStorage.setItem(preferencesKey, JSON.stringify(next)); preferences = next; refresh(); }
            catch { event.target.checked = !event.target.checked; status('storage'); }
        }
    });
    document.addEventListener('click', event => { if (event.target.closest('[data-wording-clear]')) clear(); });
    document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
    document.addEventListener('drop', event => {
        if (!event.dataTransfer?.files.length) return;
        event.preventDefault();
        if (event.dataTransfer.files.length !== 1) { status('invalid'); return; }
        importFile(event.dataTransfer.files[0]);
    });
    window.addEventListener('storage', event => { if ([wordingKey, preferencesKey].includes(event.key)) load(); });
    window.acPresentation = {
        validate,
        loadProgress() { try { const value = JSON.parse(localStorage.getItem(progressKey) || '0'); return Number.isInteger(value) && value >= 0 && value <= 2 ? value : 0; } catch { return 0; } },
        saveProgress(step) { try { localStorage.setItem(progressKey, JSON.stringify(step)); return true; } catch { return false; } },
        language(mode) { document.documentElement.dataset.presentationLanguage = mode; refresh(); }
    };
    load();
})();
