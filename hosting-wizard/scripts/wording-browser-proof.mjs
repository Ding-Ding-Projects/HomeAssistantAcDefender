import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const endpoint='http://127.0.0.1:9338';
const expected=pathToFileURL(path.resolve('renderer/index.html')).href;
const targets=await(await fetch(`${endpoint}/json/list`)).json();
if(targets.length!==1||targets[0].url!==expected||targets[0].title!=='AC Defender Setup')throw new Error('Exact owned Electron target required');
const browser=await chromium.connectOverCDP(endpoint,{timeout:10000});
try{
 const pages=browser.contexts().flatMap(c=>c.pages());if(pages.length!==1||pages[0].url()!==expected)throw new Error('Unexpected connected target');
 const page=pages[0];page.setDefaultTimeout(5000);const errors=[];const requests=[];page.on('pageerror',()=>errors.push('rendererException'));page.on('request',request=>requests.push(new URL(request.url()).protocol));
 await page.locator('#wordingUpload').waitFor({state:'visible'});const original=await page.locator('h1').textContent();const provenance=await page.locator('.provenance').textContent();
 const replacement='Personal setup heading';
 await page.locator('#wordingFile').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,entries:{[original]:replacement,Version:'Changed label'}}))});
 await page.waitForFunction(value=>document.querySelector('h1').textContent===value,replacement);
 if(await page.locator('.provenance').textContent()!==provenance)throw new Error('Factual provenance changed');
 const persisted=await page.evaluate(()=>Boolean(localStorage.getItem('ac-defender-setup.personal-wording.v1')));if(!persisted)throw new Error('Validated cache missing');
 await page.locator('#wordingFile').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
 await page.waitForFunction(()=>document.querySelector('#wordingStatus').textContent.startsWith('File rejected.'));
 if(await page.locator('h1').textContent()!==replacement)throw new Error('Invalid import replaced last valid wording');
 await page.locator('#wordingClear').click();await page.waitForFunction(value=>document.querySelector('h1').textContent===value,original);
 if(await page.evaluate(()=>localStorage.getItem('ac-defender-setup.personal-wording.v1')!==null))throw new Error('Clear did not purge private cache');
 if(errors.length||requests.length)throw new Error('Import caused a runtime error or network request');
 const screenshot=await page.screenshot({type:'png'});const output='../design/hosting-wizard/evidence';await fs.writeFile(`${output}/wording-cleared-window.png`,screenshot);
 const receipt={schemaVersion:1,route:'linux-isolated-xorg-electron-cdp',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rendererSha256:crypto.createHash('sha256').update(await fs.readFile('renderer/app.js')).digest('hex'),checks:{visibleUpload:true,validImport:true,localPersistence:true,invalidPreservesLastValid:true,factualProvenanceUnchanged:true,clearRestoresOriginal:true,clearPurgesCache:true,noNetworkRequests:true,noRendererErrors:true},screenshot:{file:'wording-cleared-window.png',sha256:crypto.createHash('sha256').update(screenshot).digest('hex')},privacy:'Capture was taken only after clearing the synthetic test wording; no imported payload or file metadata is recorded.',nativeWindowsProof:false};await fs.writeFile(`${output}/wording-interaction.json`,JSON.stringify(receipt,null,2));console.log('Real Electron personal-wording import, invalid replacement and clear checks passed.');
}finally{await browser.close();}
