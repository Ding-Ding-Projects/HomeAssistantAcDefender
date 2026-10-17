import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';

const execute = promisify(execFile);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function expectedMetadata(env) {
  const value={version:env.AC_DEFENDER_VERSION,revision:env.AC_DEFENDER_REVISION,buildTime:env.AC_DEFENDER_BUILD_TIME};
  if(!/^\d+\.\d+\.\d+$/.test(value.version||'')||! /^[a-f0-9]{40}$/.test(value.revision||'')||!value.buildTime||!Number.isFinite(Date.parse(value.buildTime)))throw new Error('invalidExpectedProvenance');
  return value;
}
export function validateOwnership(snapshot,{launcherPid,launchedAt,profile,port}) {
  if(!snapshot||!Array.isArray(snapshot.chain)||!snapshot.chain.length||snapshot.chain.length>64||!snapshot.addresses?.length||snapshot.addresses.some(a=>!['127.0.0.1','::1'].includes(a)))throw new Error('invalidListenerOwnership');
  const first=snapshot.chain[0];
  if(first.pid!==snapshot.listenerPid||!snapshot.chain.some(p=>p.pid===launcherPid)||!first.executable||path.win32.basename(first.executable)!=='AC Defender Setup.exe')throw new Error('invalidListenerOwnership');
  for(let i=0;i<snapshot.chain.length;i++){
    const p=snapshot.chain[i];if(!Number.isInteger(p.pid)||!Number.isFinite(Date.parse(p.created))||Date.parse(p.created)<launchedAt-2000)throw new Error('invalidProcessIdentity');
    if(i+1<snapshot.chain.length&&p.parent!==snapshot.chain[i+1].pid)throw new Error('invalidProcessAncestry');
  }
  if(snapshot.chain.at(-1).pid!==launcherPid||!first.commandLine?.includes(`--remote-debugging-port=${port}`)||!first.commandLine.includes(`--user-data-dir=${profile}`))throw new Error('invalidLaunchArguments');
  return first;
}
export function selectTarget(targets,expectedUrl) {
  if(!Array.isArray(targets)||targets.length!==1||targets[0].type!=='page'||targets[0].title!=='AC Defender Setup'||targets[0].url!==expectedUrl)throw new Error('unexpectedDebugTarget');
  return targets[0];
}
export async function bounded(task,milliseconds,code='proofTimeout') {
  let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(code)),milliseconds);})]);}finally{clearTimeout(timer);}
}
const inspectScript=`$ErrorActionPreference='Stop'
$portNumber=[int]$env:SETUP_PROOF_PORT
$rootId=[int]$env:SETUP_PROOF_ROOT_PID
$listeners=@(Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue)
if($listeners.Count -eq 0){Write-Output '{}';exit 0}
$owners=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
if($owners.Count -ne 1){throw 'ambiguous listener'}
$all=@(Get-CimInstance Win32_Process)
$chain=@();$currentId=[int]$owners[0]
for($i=0;$i -lt 64;$i++){
 $entry=$all | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
 if($null -eq $entry){throw 'missing process'}
 $chain+=@{pid=[int]$entry.ProcessId;parent=[int]$entry.ParentProcessId;executable=$entry.ExecutablePath;created=$entry.CreationDate.ToUniversalTime().ToString('o');commandLine=$entry.CommandLine}
 if($currentId -eq $rootId){break};$currentId=[int]$entry.ParentProcessId
}
@{listenerPid=[int]$owners[0];addresses=@($listeners | Select-Object -ExpandProperty LocalAddress -Unique);chain=@($chain)} | ConvertTo-Json -Depth 5 -Compress`;
const cleanupScript=`$ErrorActionPreference='Stop'
$identities=@(ConvertFrom-Json $env:SETUP_PROOF_IDENTITIES)
foreach($identity in $identities){
 $entry=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$identity.pid) -ErrorAction SilentlyContinue
 if($null -eq $entry){continue}
 if($entry.ExecutablePath -ne $identity.executable){throw 'process identity changed'}
 if($identity.created -and $entry.CreationDate.ToUniversalTime().ToString('o') -ne $identity.created){throw 'process creation changed'}
 if($entry.CreationDate.ToUniversalTime() -lt [DateTime]::Parse($env:SETUP_PROOF_STARTED).ToUniversalTime().AddSeconds(-2)){throw 'process predates launch'}
 & "$env:SystemRoot\\System32\\taskkill.exe" /PID ([string]$identity.pid) /T /F 2>$null | Out-Null
}
foreach($identity in $identities){
 $entry=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$identity.pid) -ErrorAction SilentlyContinue
 if($entry -and $entry.ExecutablePath -eq $identity.executable){throw 'owned process still running'}
}
Write-Output 'closed'`;
async function powershell(script,env,timeout=10000){
  const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const {stdout}=await execute(executable,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...process.env,...env},windowsHide:true,timeout,maxBuffer:1024*1024});return stdout.trim();
}
async function unusedPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(r=>server.close(r));return port;}

export async function provePortable(executableArg,outputArg){
  const output=path.resolve(outputArg);await fs.mkdir(output,{recursive:true});
  const receipt={schemaVersion:1,status:'failed',route:'windows-ci-portable-electron',checks:{},cleanup:{complete:false},limitations:['Initial native window only. Docker installation, deployment, credentials, elevation, LAN access and operational cancellation are not exercised.']};
  let root,launcher,browser,identity,launchedAt,launchedExe,port;let failure='proofFailed';
  const hardStop=setTimeout(()=>{process.stderr.write('Native portable proof exceeded its outer deadline.\n');process.exit(1);},115000);
  try{
    if(process.platform!=='win32')throw new Error('windowsRequired');
    const expected=expectedMetadata(process.env);const executable=path.resolve(executableArg);
    if(path.basename(executable)!==`AC-Defender-Setup-${expected.version}-portable.exe`)throw new Error('unexpectedArtifactName');
    const bytes=await fs.readFile(executable);if(bytes.subarray(0,2).toString()!=='MZ')throw new Error('notWindowsExecutable');
    receipt.artifact={file:path.basename(executable),sha256:hash(bytes),bytes:bytes.length};receipt.expected=expected;
    root=await fs.mkdtemp(path.join(os.tmpdir(),'ac-defender-native-proof-'));const launchDir=path.join(root,'launch');const profile=path.join(root,'profile');await fs.mkdir(launchDir);await fs.mkdir(profile);
    launchedExe=path.join(launchDir,path.basename(executable));await fs.copyFile(executable,launchedExe);
    if(hash(await fs.readFile(launchedExe))!==receipt.artifact.sha256||(await fs.readdir(launchDir)).length!==1)throw new Error('isolatedArtifactMismatch');
    receipt.checks.byteIdenticalStandaloneArtifact=true;port=await unusedPort();launchedAt=Date.now();
    launcher=spawn(launchedExe,[`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`],{cwd:launchDir,windowsHide:false,stdio:'ignore',shell:false});
    const launchError=new Promise((_,reject)=>launcher.once('error',()=>reject(new Error('portableLaunchFailed'))));
    await bounded(Promise.race([launchError,(async()=>{
      let snapshot;const waitUntil=Date.now()+45000;
      while(Date.now()<waitUntil){
        try{snapshot=JSON.parse(await powershell(inspectScript,{SETUP_PROOF_PORT:String(port),SETUP_PROOF_ROOT_PID:String(launcher.pid)},5000));if(snapshot.listenerPid){identity=validateOwnership(snapshot,{launcherPid:launcher.pid,launchedAt,profile,port});break;}}catch(error){if(error.message.startsWith('invalid'))throw error;}
        await new Promise(r=>setTimeout(r,250));
      }
      if(!identity)throw new Error('ownedDebugListenerUnavailable');
      const expectedUrl=pathToFileURL(path.join(path.dirname(identity.executable),'resources','app.asar','renderer','index.html')).href;
      const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)})).json();selectTarget(targets,expectedUrl);
      receipt.checks.listenerOwnedByPortableProcessTree=true;receipt.checks.loopbackOnlyListener=true;receipt.checks.exactPackagedRendererTarget=true;
      const {chromium}=await import('playwright-core');browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:10000});
      const pages=browser.contexts().flatMap(context=>context.pages());if(pages.length!==1||pages[0].url()!==expectedUrl)throw new Error('unexpectedConnectedPage');
      const page=pages[0];const exceptions=[];page.on('pageerror',()=>exceptions.push('rendererException'));page.setDefaultTimeout(5000);
      await page.locator('h1').waitFor({state:'visible'});await page.locator('#check').waitFor({state:'visible'});
      const observed=await page.evaluate(async()=>{await document.fonts.ready;const state=await window.setup.snapshot();return {metadata:state.metadata,phase:state.phase,configEmpty:state.config===null,directoryEmpty:state.directory===null,busy:state.busy,ready:state.ready,created:!!state.created,title:document.querySelector('h1')?.textContent,provenance:document.querySelector('.provenance')?.textContent,formattedTime:new Date(state.metadata.buildTime).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}),controls:{check:!!document.querySelector('#check'),next:!!document.querySelector('#next'),nextDisabled:document.querySelector('#next')?.disabled,language:!!document.querySelector('#language'),theme:!!document.querySelector('#theme'),wordingUpload:!!document.querySelector('#wordingUpload'),wordingClear:!!document.querySelector('#wordingClear'),wordingClearDisabled:document.querySelector('#wordingClear')?.disabled,wordingPicker:document.querySelector('#wordingFile')?.type==='file'},overflow:document.documentElement.scrollWidth>innerWidth,viewport:{width:innerWidth,height:innerHeight},geometry:document.querySelector('.panel')?.getBoundingClientRect().toJSON()};});
      if(JSON.stringify(observed.metadata)!==JSON.stringify(expected))throw new Error('artifactProvenanceMismatch');
      if(observed.phase!=='prerequisites'||!observed.configEmpty||!observed.directoryEmpty||observed.busy||observed.ready||observed.created)throw new Error('initialStateNotIsolated');
      if(observed.title!=='Check this computer'||Object.values(observed.controls).some(value=>value!==true)||!observed.provenance.includes(expected.version)||!observed.provenance.includes(observed.formattedTime)||observed.overflow||!observed.geometry?.width||exceptions.length)throw new Error('initialUiVerificationFailed');
      receipt.checks.initialControlsVisible=true;receipt.checks.provenanceMatchesArtifact=true;receipt.checks.initialStateIsolated=true;receipt.checks.noHorizontalOverflow=true;receipt.checks.noSetupActions=true;receipt.observed=observed;
      const screenshot=await page.screenshot({type:'png',timeout:5000});await fs.writeFile(path.join(output,'initial-window.png'),screenshot,{flag:'wx'});receipt.screenshot={file:'initial-window.png',sha256:hash(screenshot),bytes:screenshot.length};
      const session=await browser.newBrowserCDPSession();await session.send('Browser.close').catch(()=>{});receipt.status='passed';
    })()]),85000);
  }catch(error){failure=/^[A-Za-z][A-Za-z0-9]{1,80}$/.test(error?.message||'')?error.message:'nativeProofOperationFailed';receipt.failure=failure;receipt.status='failed';}
  finally{
    try{
      if(launcher?.pid){
        const identities=[];if(identity)identities.push({pid:identity.pid,executable:identity.executable,created:identity.created});
        if(launcher.exitCode===null&&launcher.signalCode===null)identities.push({pid:launcher.pid,executable:launchedExe});
        if(identities.length)await powershell(cleanupScript,{SETUP_PROOF_IDENTITIES:JSON.stringify(identities),SETUP_PROOF_STARTED:new Date(launchedAt).toISOString()},12000);
      }
      if(browser)await bounded(browser.close().catch(()=>{}),3000,'disconnectTimeout');
      if(root)await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:150});receipt.cleanup.complete=true;
    }catch{receipt.status='failed';receipt.failure='ownedCleanupIncomplete';}
    clearTimeout(hardStop);await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
  }
  if(receipt.status!=='passed')throw new Error(receipt.failure||failure);return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4){process.stderr.write('Usage: node scripts/native-portable-proof.mjs <portable.exe> <output-directory>\n');process.exitCode=1;}
  else try{await provePortable(process.argv[2],process.argv[3]);process.stdout.write('Native portable initial-window proof passed.\n');}catch(error){process.stderr.write(`Native portable proof failed: ${error.message}\n`);process.exitCode=1;}
}
