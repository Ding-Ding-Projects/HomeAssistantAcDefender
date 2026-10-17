/* Browser-local utilities. Selected file bytes never cross Blazor interop. */
(() => {
    'use strict';
    const LIMIT = 8 * 1024 * 1024;
    const LOGO_KEY = 'ac-defender-local-logo-v1';
    const sessions = new Map();
    const presets = { shield: '◆', snow: '❄', ring: '◉' };

    // Serialized into an isolated worker. No imports, network access or script evaluation.
    function workerMain() {
        'use strict';
        const LIMIT = 8 * 1024 * 1024;
        const fail = message => { const error = new Error(message); error.safe = true; throw error; };
        const bounded = bytes => { if (bytes.byteLength > LIMIT) fail('Output exceeds the 8 MiB limit.'); return bytes; };
        function signature(b) {
            if (b.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) return 'image/png';
            if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
            if (b.length >= 12 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP') return 'image/webp';
            if (b[0] === 31 && b[1] === 139) return 'application/gzip';
            if (String.fromCharCode(...b.slice(0,5)) === '%PDF-') return 'application/pdf';
            return 'application/octet-stream';
        }
        function dimensions(b, mime) {
            const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
            let w=0,h=0;
            if (mime === 'image/png') {
                if (b.length < 33) fail('Invalid PNG header.');
                w=v.getUint32(16); h=v.getUint32(20);
                for (let p=8;p+12<=b.length;) { const n=v.getUint32(p); const t=String.fromCharCode(...b.slice(p+4,p+8)); if (t==='acTL') fail('Animated PNG is unsupported.'); if (n > b.length-p-12) fail('Invalid PNG chunk.'); p+=12+n; }
            } else if (mime === 'image/jpeg') {
                let p=2;
                while(p+4<=b.length) {
                    if(b[p++]!==255) fail('Invalid JPEG marker.');
                    while(b[p]===255) p++;
                    const marker=b[p++]; if(marker===217 || marker===218) break;
                    if(marker===1 || (marker>=208&&marker<=215)) continue;
                    const n=v.getUint16(p); if(n<2 || p+n>b.length) fail('Invalid JPEG segment.');
                    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) { if(n<7) fail('Invalid JPEG dimensions.'); h=v.getUint16(p+3);w=v.getUint16(p+5);break; } p+=n;
                }
            } else if(mime==='image/webp') {
                if(v.getUint32(4,true)+8!==b.length) fail('Invalid WebP length.');
                for(let p=12;p+8<=b.length;) {
                    const t=String.fromCharCode(...b.slice(p,p+4)),n=v.getUint32(p+4,true),q=p+8;
                    if(n>b.length-q) fail('Invalid WebP chunk.');
                    if(t==='ANIM'||t==='ANMF'||(t==='VP8X'&&(b[q]&2))) fail('Animated WebP is unsupported.');
                    if(t==='VP8X'&&n>=10){w=1+b[q+4]+(b[q+5]<<8)+(b[q+6]<<16);h=1+b[q+7]+(b[q+8]<<8)+(b[q+9]<<16);}
                    if(!w&&t==='VP8 '&&n>=10){w=v.getUint16(q+6,true)&16383;h=v.getUint16(q+8,true)&16383;}
                    if(!w&&t==='VP8L'&&n>=5&&b[q]===47){const bits=v.getUint32(q+1,true);w=(bits&16383)+1;h=((bits>>>14)&16383)+1;}
                    p=q+n+(n%2);
                }
            }
            if(!w||!h||w>4096||h>4096||w*h>8000000) fail('Image exceeds 4096 pixels per axis or 8 million pixels, or has invalid dimensions.');
            return {w,h};
        }
        function decode(b, encoding) {
            try { return new TextDecoder(encoding || 'utf-8',{fatal:true}).decode(b); }
            catch { fail('Source is not valid in the selected text encoding.'); }
        }
        function parseJson(text) {
            let depth=0, quoted=false, escaped=false;
            for(const char of text) {
                if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}
                else if(char==='"')quoted=true;
                else if(char==='{'||char==='['){if(++depth>64)fail('JSON nesting exceeds 64 levels.');}
                else if(char==='}'||char===']')depth--;
            }
            try{return JSON.parse(text);}catch{fail('Input is not valid JSON.');}
        }
        async function stream(bytes, decompress) {
            if(decompress && signature(bytes)!=='application/gzip') fail('Source is not a gzip stream.');
            const stream = new Blob([bytes]).stream().pipeThrough(decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
            const reader=stream.getReader(), chunks=[];let total=0;
            try { while(true) {const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMIT){await reader.cancel();fail('Expanded output exceeds the 8 MiB limit.');}chunks.push(value);} }
            finally {reader.releaseLock();}
            const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
        }
        async function raster(bytes, target, options) {
            const mime=signature(bytes); if(!['image/png','image/jpeg','image/webp'].includes(mime)) fail('Only signature-verified PNG, JPEG and WebP raster images are supported.');
            dimensions(bytes,mime);
            if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function') fail('This browser has no isolated raster canvas adapter.');
            const bitmap=await createImageBitmap(new Blob([bytes],{type:mime}));
            try {
                if(bitmap.width>4096||bitmap.height>4096||bitmap.width*bitmap.height>8000000) fail('Decoded image exceeds the pixel limit.');
                const logo=options?.logo, size=logo?128:null;
                const canvas=new OffscreenCanvas(size||bitmap.width,size||bitmap.height), c=canvas.getContext('2d');
                if(!c) fail('Canvas unavailable.');
                if(target==='image/jpeg'||(logo&&options.background!=='transparent')) {c.fillStyle=logo?options.background:'#ffffff';c.fillRect(0,0,canvas.width,canvas.height);}
                if(logo) {
                    const scale=options.fit==='cover'?Math.max(size/bitmap.width,size/bitmap.height):Math.min(size/bitmap.width,size/bitmap.height);
                    const w=bitmap.width*scale,h=bitmap.height*scale;
                    c.drawImage(bitmap,(size-w)*options.x/100,(size-h)*options.y/100,w,h);
                } else c.drawImage(bitmap,0,0);
                const blob=await canvas.convertToBlob({type:target,quality:0.9});
                if(blob.type!==target) fail('This browser does not encode the requested image format.');
                const out=bounded(new Uint8Array(await blob.arrayBuffer()));
                if(signature(out)!==target) fail('Image output signature validation failed.');
                const check=await createImageBitmap(blob);try{if(check.width!==canvas.width||check.height!==canvas.height)fail('Image round-trip dimensions differ.');}finally{check.close();}
                return out;
            } finally {bitmap.close();}
        }
        self.onmessage=async ({data})=>{
            try {
                const bytes=bounded(new Uint8Array(data.bytes)), id=data.id;
                let out,mime='text/plain;charset=utf-8',extension='txt',preview='';
                if(id==='inspect') {const type=signature(bytes); let text='';if(type==='application/octet-stream'){try{text=decode(bytes).slice(0,2000);}catch{}}self.postMessage({ok:true,type,preview:text});return;}
                if(id==='gzip'||id==='gunzip'){out=await stream(bytes,id==='gunzip');mime=id==='gzip'?'application/gzip':'application/octet-stream';extension=id==='gzip'?'gz':'bin';if(id==='gzip'){const check=await stream(out,true);if(check.length!==bytes.length||check.some((v,i)=>v!==bytes[i]))fail('Gzip round-trip validation failed.');}}
                else if(['png','jpeg','webp','logo'].includes(id)){mime=id==='logo'?'image/png':`image/${id}`;out=await raster(bytes,mime,data.options);extension=id==='logo'?'png':id;}
                else if(id==='base64'){if(bytes.length>6*1024*1024)fail('Base64 output would exceed 8 MiB.');let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));out=new TextEncoder().encode(btoa(s));extension='base64';}
                else if(id==='hex'){if(bytes.length>LIMIT/2)fail('Hex output would exceed 8 MiB.');const outBytes=new Uint8Array(bytes.length*2),alphabet='0123456789abcdef';for(let i=0;i<bytes.length;i++){outBytes[i*2]=alphabet.charCodeAt(bytes[i]>>>4);outBytes[i*2+1]=alphabet.charCodeAt(bytes[i]&15);}out=outBytes;extension='hex';}
                else if(id==='unbase64'){const s=decode(bytes).replace(/\s/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail('Invalid canonical base64 input.');const raw=atob(s);if(btoa(raw)!==s)fail('Invalid base64 padding bits.');out=Uint8Array.from(raw,c=>c.charCodeAt(0));mime='application/octet-stream';extension='bin';}
                else if(id==='unhex'){const s=decode(bytes).replace(/\s/g,'');if(s.length%2||!/^[0-9a-f]*$/i.test(s))fail('Hex requires pairs of hexadecimal digits.');out=new Uint8Array(s.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(s.slice(i*2,i*2+2),16);mime='application/octet-stream';extension='bin';}
                else {
                    if(['json','jsoncsv'].includes(id)&&bytes.length>512*1024)fail('JSON adapters accept at most 512 KiB to bound structural expansion.');
                    let text=decode(bytes,data.options?.encoding);
                    if(id==='lf')text=text.replace(/\r\n|\r/g,'\n');
                    else if(id==='crlf')text=text.replace(/\r\n|\r|\n/g,'\n').replace(/\n/g,'\r\n');
                    else if(id==='utf8') { /* TextDecoder validates the chosen source encoding. */ }
                    else if(id==='json'){text=JSON.stringify(parseJson(text),null,2);mime='application/json';extension='json';}
                    else if(id==='jsoncsv') {
                        const rows=parseJson(text);
                        if(!Array.isArray(rows)||rows.length>100000||rows.some(r=>!r||Array.isArray(r)||typeof r!=='object'))fail('CSV requires an array of at most 100,000 flat objects.');
                        const keys=[...new Set(rows.flatMap(Object.keys))];if(keys.length>256)fail('CSV is limited to 256 columns.');
                        const cell=v=>{if(v!==null&&typeof v==='object')fail('Nested JSON cannot be flattened safely.');const s=v==null?'':String(v);if(/^[\s]*[=+\-@]/.test(s))fail('Spreadsheet formula-like cells are rejected.');return '"'+s.replace(/"/g,'""')+'"';};
                        text=[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');mime='text/csv;charset=utf-8';extension='csv';
                    } else fail('Unknown or unavailable adapter.');
                    out=new TextEncoder().encode(text);preview=text.slice(0,2000);
                }
                bounded(out);self.postMessage({ok:true,bytes:out.buffer,mime,extension,preview},[out.buffer]);
            } catch(error) { self.postMessage({ok:false,error:error.safe?error.message:'Conversion refused: malformed input or unavailable browser decoder.'}); }
        };
    }
    function job(id, bytes, options, session) {
        return new Promise((resolve,reject)=>{
            const url=URL.createObjectURL(new Blob([`(${workerMain.toString()})()`],{type:'text/javascript'}));
            const worker=new Worker(url);URL.revokeObjectURL(url);
            const finish=(error,result)=>{clearTimeout(timer);worker.terminate();if(session?.cancel===cancel)session.cancel=null;error?reject(error):resolve(result);};
            const cancel=()=>finish(new Error('Cancelled.'));
            const timer=setTimeout(()=>finish(new Error('Processing exceeded the 10 second limit.')),10000);
            if(session)session.cancel=cancel;
            worker.onmessage=e=>e.data.ok?finish(null,e.data):finish(new Error(e.data.error));
            worker.onerror=()=>finish(new Error('The isolated browser worker failed.'));
            worker.postMessage({id,bytes,options},[bytes]);
        });
    }
    function status(root,text) { const el=root.querySelector('[data-status]');if(el)el.textContent=text; }
    function localized(root,en,zh) {const language=root.dataset.language||'both';return language==='en'?en:language==='yue'?zh:`${en} / ${zh}`;}
    function safeName(name,ext) {return (name.replace(/\.[^.]*$/,'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)||'converted')+'.'+ext;}
    function revoke(session) {if(session.url){URL.revokeObjectURL(session.url);session.url=null;}}
    async function capabilities(){
        const result={worker:false,images:false,png:false,jpeg:false,webp:false,gzip:false};
        if(typeof Worker!=='function')return result;
        try{await job('inspect',new ArrayBuffer(0));result.worker=true;}catch{return result;}
        if(typeof OffscreenCanvas==='function'&&typeof createImageBitmap==='function'){
            for(const format of ['png','jpeg','webp']){try{const canvas=new OffscreenCanvas(1,1);canvas.getContext('2d').fillRect(0,0,1,1);const blob=await canvas.convertToBlob({type:`image/${format}`});result[format]=blob.type===`image/${format}`;}catch{}}
            result.images=result.png||result.jpeg||result.webp;
        }
        if(typeof CompressionStream==='function'&&typeof DecompressionStream==='function'){try{await job('gzip',new Uint8Array([0,1,2]).buffer);result.gzip=true;}catch{}}
        return result;
    }
    function init(id) {
        const root=document.getElementById(id);if(!root||sessions.has(id))return;
        const session={root,file:null,cancel:null,url:null,generation:0,phase:null};sessions.set(id,session);
        root.querySelector('input[type=file]').addEventListener('change',async e=>{
            session.generation++;session.cancel?.();session.phase=null;root.removeAttribute('aria-busy');revoke(session);const generation=session.generation;
            root.querySelector('[data-download]').hidden=true;root.querySelector('[data-preview]').textContent='';
            session.file=e.target.files?.[0]||null;
            if(!session.file){status(root,localized(root,'Choose one file to begin.','揀一個檔案開始啦。'));return;}
            if(session.file.size>LIMIT){session.file=null;status(root,localized(root,'Input exceeds the 8 MiB limit.','檔案超過 8 MiB 上限。'));return;}
            session.phase='inspect';
            status(root,localized(root,'Inspecting locally…','喺瀏覽器檢查緊…'));
            try {const bytes=await session.file.arrayBuffer();if(generation!==session.generation)return;const result=await job('inspect',bytes,null,session);if(generation!==session.generation)return;root.querySelector('[data-preview]').textContent=result.preview;status(root,`${session.file.name} · ${session.file.size} bytes · ${result.type}`);}
            catch(error){if(generation===session.generation)status(root,error.message);}
            finally{if(generation===session.generation)session.phase=null;}
        });
    }
    async function convert(id,adapter) {
        const s=sessions.get(id);if(!s)return;
        if(!s.file){status(s.root,localized(s.root,'Choose a file first.','請先揀檔案。'));return;}
        if(s.phase==='convert'){status(s.root,localized(s.root,'Cancel the current operation first.','請先取消而家嘅工作。'));return;}
        const generation=++s.generation;s.cancel?.();s.phase='convert';revoke(s);s.root.querySelector('[data-download]').hidden=true;
        status(s.root,localized(s.root,'Converting locally…','喺瀏覽器轉換緊…'));s.root.setAttribute('aria-busy','true');
        try {
            const bytes=await s.file.arrayBuffer();if(generation!==s.generation)return;
            const result=await job(adapter,bytes,{encoding:s.root.querySelector('[data-encoding]').value},s);
            if(generation!==s.generation)return;
            s.url=URL.createObjectURL(new Blob([result.bytes],{type:result.mime}));
            const link=s.root.querySelector('[data-download]');link.href=s.url;link.download=safeName(s.file.name,result.extension);link.hidden=false;
            s.root.querySelector('[data-preview]').textContent=result.preview||localized(s.root,'Binary output validated. Download to inspect in a suitable application.','二進制輸出已驗證，下載後可用合適程式檢視。');
            status(s.root,localized(s.root,`Ready: ${result.bytes.byteLength} bytes · ${result.mime}`,`完成：${result.bytes.byteLength} bytes · ${result.mime}`));
            const li=document.createElement('li');li.textContent=`${adapter} · ${result.bytes.byteLength} bytes · ${new Date().toLocaleTimeString()}`;const history=s.root.querySelector('[data-history]');history.prepend(li);while(history.children.length>10)history.lastChild.remove();
        } catch(error){if(generation===s.generation)status(s.root,error.message);}
        finally {if(generation===s.generation){s.phase=null;s.root.removeAttribute('aria-busy');}}
    }
    function cancel(id){const s=sessions.get(id);if(s){s.generation++;s.cancel?.();s.phase=null;s.root.removeAttribute('aria-busy');status(s.root,localized(s.root,'Cancelled.','已取消。'));}}
    function dispose(id){const s=sessions.get(id);if(s){s.generation++;s.cancel?.();revoke(s);sessions.delete(id);}}
    function validLogo(value){
        if(!value||value.version!==1||!['shield','snow','ring','custom'].includes(value.preset))return false;
        if(value.preset!=='custom')return !value.image;
        const o=value.options;
        return typeof value.image==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value.image)&&value.image.length<150000&&o&&['contain','cover'].includes(o.fit)&&[o.x,o.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)&&(o.background==='transparent'||/^#[0-9a-f]{6}$/i.test(o.background));
    }
    let cachedLogo;
    let logoRevision=0;
    async function readLogo(){
        try{
            const value=JSON.parse(localStorage.getItem(LOGO_KEY));if(!validLogo(value))return null;
            if(value.preset==='custom'){
                const bytes=Uint8Array.from(atob(value.image.split(',')[1]),c=>c.charCodeAt(0));
                const v=new DataView(bytes.buffer);if(bytes.length<33||v.getUint32(16)!==128||v.getUint32(20)!==128)return null;
                await job('png',bytes.buffer,null,null);
            }
            return value;
        }catch{return null;}
    }
    async function applyLogo(value){
        const revision=logoRevision;
        if(value===undefined){if(cachedLogo===undefined){const loaded=await readLogo();if(revision!==logoRevision)return;cachedLogo=loaded;}value=cachedLogo;}
        if(revision!==logoRevision)return;
        document.querySelectorAll('[data-local-logo]').forEach(el=>{
            if(!el.dataset.originalLogo)el.dataset.originalLogo=el.innerHTML;
            el.replaceChildren();
            if(value?.preset==='custom'&&value.image){const img=document.createElement('img');img.src=value.image;img.alt='';img.width=40;img.height=40;el.append(img);}
            else if(value&&presets[value.preset])el.textContent=presets[value.preset];
            else el.innerHTML=el.dataset.originalLogo;
        });
    }
    function updatePreviews(root,value){root.querySelectorAll('[data-logo-preview]').forEach(el=>{el.replaceChildren();if(value?.image&&value.preset==='custom'){const image=document.createElement('img');image.src=value.image;image.alt='';el.append(image);}else if(value?.preset)el.textContent=presets[value.preset];else{const label=document.createElement('span');label.style.fontSize='0.35em';label.textContent='SCP';el.append(label);}});}
    async function initLogo(id){
        const root=document.getElementById(id);if(!root||sessions.has(id))return;const s={root,file:null,cancel:null,generation:0};sessions.set(id,s);const saved=await readLogo();if(!sessions.has(id))return;cachedLogo=saved;updatePreviews(root,saved);applyLogo(saved);if(saved?.options){root.querySelector('[data-fit]').value=saved.options.fit;root.querySelector('[data-x]').value=saved.options.x;root.querySelector('[data-y]').value=saved.options.y;root.querySelector('[data-transparent]').checked=saved.options.background==='transparent';if(saved.options.background!=='transparent')root.querySelector('[data-background]').value=saved.options.background;}
        root.querySelector('input[type=file]').addEventListener('change',e=>{s.cancel?.();s.generation++;s.pending=null;s.file=e.target.files?.[0]||null;if(s.file?.size>4*1024*1024){s.file=null;status(root,localized(root,'Logo input exceeds 4 MiB.','標誌檔案超過 4 MiB。'));}else status(root,localized(root,s.file?'Ready to create a local preview.':'No custom image selected.',s.file?'可以建立本機預覽。':'未揀自訂圖片。'));});
    }
    async function saveLogo(id,preset,preview=false){
        const s=sessions.get(id);if(!s)return;if(s.cancel)return;const generation=++s.generation;
        try {
            let value={version:1,preset};
            if(preset==='custom'&&!preview){if(!s.pending)throw new Error(localized(s.root,'Create a preview before saving.','請先建立預覽再儲存。'));value=s.pending;}
            if(preset==='custom'&&preview){
                if(!s.file)throw new Error(localized(s.root,'Choose a PNG, JPEG or WebP file first.','請先揀 PNG、JPEG 或 WebP 圖片。'));
                const options={logo:true,fit:s.root.querySelector('[data-fit]').value,x:Number(s.root.querySelector('[data-x]').value),y:Number(s.root.querySelector('[data-y]').value),background:s.root.querySelector('[data-transparent]').checked?'transparent':s.root.querySelector('[data-background]').value};
                if(!['contain','cover'].includes(options.fit)||![options.x,options.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||!(options.background==='transparent'||/^#[0-9a-f]{6}$/i.test(options.background)))throw new Error('Invalid logo rendering options.');
                status(s.root,localized(s.root,'Validating and rasterizing locally…','喺本機驗證同處理圖片…'));
                const bytes=await s.file.arrayBuffer();if(generation!==s.generation)return;const result=await job('logo',bytes,options,s);if(generation!==s.generation)return;
                let raw='';for(const byte of new Uint8Array(result.bytes))raw+=String.fromCharCode(byte);value.image='data:image/png;base64,'+btoa(raw);value.options=options;
            }
            if(!validLogo(value))throw new Error('Derived logo exceeds the local storage limit.');
            if(preview){s.pending=value;updatePreviews(s.root,value);status(s.root,localized(s.root,'Unsaved preview ready. Apply preview to save this exact rendering.','未儲存預覽已完成。套用預覽即可儲存呢個效果。'));return;}
            localStorage.setItem(LOGO_KEY,JSON.stringify(value));logoRevision++;cachedLogo=value;s.pending=null;updatePreviews(s.root,value);applyLogo(value);status(s.root,localized(s.root,'Logo saved in this browser.','標誌已儲存喺呢個瀏覽器。'));
        }catch(error){status(s.root,error.message);}
    }
    function resetLogo(id){const s=sessions.get(id);if(!s)return;s.generation++;s.cancel?.();try{localStorage.removeItem(LOGO_KEY);logoRevision++;cachedLogo=null;s.pending=null;s.file=null;s.root.querySelector('input[type=file]').value='';s.root.querySelector('[data-fit]').value='contain';s.root.querySelector('[data-x]').value='50';s.root.querySelector('[data-y]').value='50';s.root.querySelector('[data-background]').value='#ffffff';s.root.querySelector('[data-transparent]').checked=true;updatePreviews(s.root,null);applyLogo(null);status(s.root,localized(s.root,'Shipped logo restored; custom image removed.','已還原原裝標誌，並移除自訂圖片。'));}catch{status(s.root,'Browser storage is unavailable; prior logo retained.');}}
    window.localTools={init,convert,cancel,dispose,capabilities,initLogo,saveLogo,previewLogo:(id)=>saveLogo(id,'custom',true),resetLogo,applyLogo};
    window.addEventListener('pagehide',()=>{for(const id of sessions.keys())dispose(id);});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>applyLogo());else applyLogo();
    // Pure worker export permits browser-independent validation without application state.
    if(typeof module!=='undefined'&&module.exports)module.exports={workerMain,safeName,validLogo};
})();
