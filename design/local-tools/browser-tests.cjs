// Run with: node design/local-tools/browser-tests.cjs
// Real Chromium executes production JS against a deliberately small DOM fixture.
// This is functional adapter evidence, not a production Razor/layout capture.
const { chromium }=require('playwright'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('wwwroot/js/local-tools.js');
const html=`<!doctype html><html><body><div data-local-logo>Original</div>
<div id="tools" data-language="en"><input type="file"><select data-encoding><option>utf-8</option></select><p data-status></p><a data-download hidden></a><pre data-preview></pre><ol data-history></ol></div>
<div id="logo" data-language="en"><input type="file"><select data-fit><option>contain</option><option>cover</option></select><input data-x value="50"><input data-y value="50"><input data-background value="#ffffff"><input data-transparent type="checkbox" checked><p data-status></p><span data-logo-preview></span></div>
<script src="/local-tools.js"></script></body></html>`;
(async()=>{
    const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/local-tools.js'?'text/javascript':'text/html');res.end(req.url==='/local-tools.js'?js:html);});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    try {
        const page=await browser.newPage(),requests=[];page.on('request',r=>requests.push(r.url()));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.evaluate(()=>{localTools.init('tools');return localTools.initLogo('logo');});
        assert.deepEqual(await page.evaluate(()=>localTools.capabilities()),{worker:true,images:true,png:true,jpeg:true,webp:true,gzip:true});
        const baseline=requests.filter(u=>/^https?:/.test(u)).length;
        await page.locator('#tools input').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('one\r\ntwo\rthree')});
        await page.waitForFunction(()=>document.querySelector('#tools [data-status]').textContent.includes('bytes'));
        await page.evaluate(()=>localTools.convert('tools','lf'));
        assert.equal(await page.locator('[data-preview]').textContent(),'one\ntwo\nthree');
        assert.equal(await page.locator('[data-download]').getAttribute('download'),'test.txt');
        const output=await page.evaluate(async()=>{const a=document.querySelector('[data-download]');const b=await(await fetch(a.href)).blob();return {type:b.type,text:await b.text()};});
        assert.deepEqual(output,{type:'text/plain;charset=utf-8',text:'one\ntwo\nthree'});
        // Fetch of a generated blob is local; no HTTP upload/network request is made by the product.
        assert.equal(requests.filter(u=>/^https?:/.test(u)).length,baseline);
        const png=await page.evaluate(async()=>{const c=new OffscreenCanvas(20,10),x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,10,10);x.fillStyle='#0000ff';x.fillRect(10,0,10,10);return Array.from(new Uint8Array(await(await c.convertToBlob({type:'image/png'})).arrayBuffer()));});
        await page.locator('#tools input').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png)});
        await page.waitForFunction(()=>document.querySelector('#tools [data-status]').textContent.includes('image/png'));
        for(const format of ['png','jpeg','webp']){
            await page.evaluate(format=>localTools.convert('tools',format),format);
            const raster=await page.evaluate(async()=>{const blob=await(await fetch(document.querySelector('[data-download]').href)).blob();const image=await createImageBitmap(blob);const result={type:blob.type,width:image.width,height:image.height};image.close();return result;});
            assert.deepEqual(raster,{type:`image/${format}`,width:20,height:10});
        }
        await page.locator('#logo input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png)});
        await page.evaluate(()=>localTools.previewLogo('logo'));
        assert.equal(await page.evaluate(()=>localStorage.getItem('ac-defender-local-logo-v1')),null);
        await page.evaluate(()=>localTools.saveLogo('logo','custom'));
        const saved=await page.evaluate(()=>localStorage.getItem('ac-defender-local-logo-v1'));
        assert.equal(JSON.parse(saved).preset,'custom');
        assert.equal(await page.locator('[data-local-logo] img').count(),1);
        await page.reload();await page.evaluate(()=>localTools.initLogo('logo'));
        assert.equal(await page.locator('[data-local-logo] img').count(),1);
        await page.locator('#logo input[type=file]').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});
        await page.evaluate(()=>localTools.previewLogo('logo'));
        assert.equal(await page.evaluate(()=>localStorage.getItem('ac-defender-local-logo-v1')),saved);
        assert.match(await page.locator('#logo [data-status]').textContent(),/signature-verified/);
        await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};return localTools.saveLogo('logo','snow');});
        assert.equal(await page.evaluate(()=>localStorage.getItem('ac-defender-local-logo-v1')),saved);
        await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;localTools.resetLogo('logo');});
        assert.equal(await page.locator('[data-local-logo]').textContent(),'Original');
        assert.equal(await page.evaluate(()=>localStorage.getItem('ac-defender-local-logo-v1')),null);
        console.log('PASS: real Chromium native adapter probes, local text download, no HTTP file transfer, logo preview/apply/reload, malformed-image rollback, quota rollback and reset.');
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
