import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const port=Number(process.env.SETUP_CAPTURE_PORT||9337);
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const expected=pathToFileURL(path.resolve('renderer/index.html')).href;
if(targets.length!==1||targets[0].url!==expected||targets[0].title!=='AC Defender Setup')throw new Error('Exact owned application target required');
const ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();const errors=[];ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(new Error(data.error.message)):task.resolve(data.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
await send('Runtime.enable');await send('Page.enable');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output='../design/hosting-wizard/evidence';await fs.mkdir(output,{recursive:true});
const receipt={version:1,route:'linux-isolated-xorg-electron-cdp',sourceStartCommit:commit,sourceEndCommit:commit,artifact:{path:'hosting-wizard/renderer/app.js',sha256:sha(await fs.readFile('renderer/app.js'))},buildMetadata:JSON.parse(await fs.readFile('resources/build.json','utf8')),privacy:{visibleDesktopUntouched:true,taskOwnedProfile:true,unrelatedTargetsObserved:false},ownership:{exactTargetCount:1,expectedTitle:'AC Defender Setup',targetVerified:true},runtimeExceptions:errors,captures:[],limitations:['Linux Electron evidence only; Windows portable launch and native installation unverified.','Only the real initial prerequisite screen is captured. Other screen states and display scales remain pending.']};
for(const width of [1120,720])for(const language of ['en','yue','both'])for(const theme of ['light','dark']){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width===1120?820:640,deviceScaleFactor:1,mobile:false});
 await evaluate(`(()=>{for(let i=0;i<3;i++){document.querySelector('#language').click();if(localStorage.getItem('setup-language')===${JSON.stringify(language)})break;}if(document.body.classList.contains('dark')!==${theme==='dark'})document.querySelector('#theme').click();return true;})()`);
 for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,100));if(await evaluate("Boolean(document.querySelector('main .panel'))"))break;}
 await evaluate('document.fonts.ready.then(()=>true)');
 const actual=await evaluate(`({language:localStorage.getItem('setup-language'),theme:document.body.classList.contains('dark')?'dark':'light',title:document.querySelector('h1').textContent})`);if(actual.language!==language||actual.theme!==theme)throw new Error('Rendered tuple mismatch');
 const geometry=await evaluate(`({viewport:{width:innerWidth,height:innerHeight,scale:devicePixelRatio},overflow:document.documentElement.scrollWidth>innerWidth,elements:['main','.panel','header','h1'].map(selector=>{const nodes=document.querySelectorAll(selector);const el=nodes[0];const s=getComputedStyle(el);return {selector,matchedCount:nodes.length,rect:el.getBoundingClientRect().toJSON(),computed:Object.fromEntries(['display','position','boxSizing','width','height','overflowX','overflowY','fontSize','lineHeight','gap','gridTemplateColumns'].map(k=>[k,s[k]]))}})})`);
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const image=Buffer.from(screenshot.data,'base64');const filename=`prerequisites-${language}-${theme}-${width}.png`;await fs.writeFile(path.join(output,filename),image);receipt.captures.push({screen:'prerequisites',state:'unchecked',language,theme,...geometry,screenshot:{path:filename,sha256:sha(image)}});
}
receipt.sourceEndCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(receipt.sourceEndCommit!==commit)throw new Error('Source changed during capture');await fs.writeFile(path.join(output,'linux-receipt.json'),JSON.stringify(receipt,null,2));ws.close();if(receipt.captures.some(c=>c.overflow)||errors.length)throw new Error('Layout or runtime failure');console.log(`Captured ${receipt.captures.length} real initial-screen tuples without horizontal overflow.`);
