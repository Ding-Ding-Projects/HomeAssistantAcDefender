import {identityOperations} from './native-identity.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join, win32} from 'node:path';
const execute = promisify(execFile);

export async function boundedClose(operation, milliseconds = 3000) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('gracefulCloseTimeout')), milliseconds); })
    ]);
    return {acknowledged: true};
  } catch { return {acknowledged: false}; }
  finally { clearTimeout(timer); }
}

export async function finishOwnedCleanup({browser, stopAndVerify, removeOwnedFiles, timeout = 3000}) {
  const graceful = browser ? {
    cdp: await boundedClose(async () => {
      const session = await browser.newBrowserCDPSession();
      await session.send('Browser.close');
    }, timeout),
    transport: await boundedClose(() => browser.close(), timeout)
  } : null;
  // Graceful acknowledgements never replace proof that the exact owned processes are gone.
  await cleanupStage('process-exit-verification', stopAndVerify, 25000);
  await cleanupStage('owned-file-removal', removeOwnedFiles, 25000);
  return {complete: true, graceful};
}

async function powershell(script, variables, timeout = 12000) {
  const binary = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const guarded = `$ErrorActionPreference='Stop'\ntry {\n${script}\n} catch {\n@{nativeFailure=$true;exceptionType=$_.Exception.GetType().FullName;errorId=$_.FullyQualifiedErrorId;hresult=$_.Exception.HResult} | ConvertTo-Json -Compress\n}`;
  const {stdout} = await execute(binary, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(guarded, 'utf16le').toString('base64')], {
    env: {...process.env, ...variables}, windowsHide: true, timeout, maxBuffer: 1024 * 1024
  });
  const text=stdout.trim();
  let diagnostic;try{diagnostic=JSON.parse(text);}catch{}
  if(diagnostic?.nativeFailure){const error=new Error('WindowsOperationFailed');error.nativeDiagnostic=sanitizeWindowsDiagnostic(diagnostic);throw error;}
  return text;
}

export async function inspectOwnedListener({port, launcherPid, launchedAt, profile}) {
  const snapshot = JSON.parse(await powershell(`$ErrorActionPreference='Stop'
$listeners=@(Get-NetTCPConnection -LocalPort ([int]$env:DOCS_PROOF_PORT) -State Listen)
$owners=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
if($owners.Count -ne 1){throw 'ambiguous listener'}
$all=@(Get-CimInstance Win32_Process);$chain=@();$currentId=[int]$owners[0]
for($i=0;$i -lt 64;$i++){
 $entry=$all | Where-Object { $_.ProcessId -eq $currentId } | Select-Object -First 1
 if($null -eq $entry){throw 'missing process'}
 $chain+=@{pid=[int]$entry.ProcessId;parent=[int]$entry.ParentProcessId;executable=$entry.ExecutablePath;created=$entry.CreationDate.ToUniversalTime().ToString('o');commandLine=$entry.CommandLine}
 if($currentId -eq [int]$env:DOCS_PROOF_ROOT_PID){break};$currentId=[int]$entry.ParentProcessId
}
@{addresses=@($listeners | Select-Object -ExpandProperty LocalAddress -Unique);chain=@($chain)} | ConvertTo-Json -Depth 5 -Compress`, {
    DOCS_PROOF_PORT: String(port), DOCS_PROOF_ROOT_PID: String(launcherPid)
  }));
  const chain = snapshot.chain;
  if (!Array.isArray(chain) || !chain.length || chain.at(-1).pid !== launcherPid || !snapshot.addresses?.length || snapshot.addresses.some(address => !['127.0.0.1', '::1'].includes(address))) throw new Error('invalidOwnedListener');
  const main = chain[0];
  if (win32.basename(main.executable || '') !== 'AC Defender Documentation.exe' || !main.commandLine?.includes(`--user-data-dir=${profile}`) || !main.commandLine.includes(`--remote-debugging-port=${port}`)) throw new Error('invalidOwnedProcess');
  for (let index = 0; index < chain.length; index++) {
    const entry = chain[index];
    if (!Number.isInteger(entry.pid) || !Number.isFinite(Date.parse(entry.created)) || Date.parse(entry.created) < launchedAt - 2000 || (index + 1 < chain.length && entry.parent !== chain[index + 1].pid)) throw new Error('invalidOwnedAncestry');
  }
  return chain.map(({pid, executable, created}) => ({pid, executable, created}));
}


export function safeCleanupDiagnostic(error, stage) {
  return error?.cleanupDiagnostic || {stage, ...sanitizeWindowsDiagnostic(error?.nativeDiagnostic), code:error?.killed ? 'PROCESS_COMMAND_TIMEOUT' :/^[A-Z][A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : 'CleanupOperationFailed'};
}

export async function cleanupStage(stage, operation, timeout = 10000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => { const error = new Error('CleanupStageTimeout'); error.code = 'CLEANUP_TIMEOUT'; reject(error); }, timeout);
    })]);
  } catch (error) {
    error.cleanupDiagnostic = safeCleanupDiagnostic(error, stage);
    throw error;
  } finally { clearTimeout(timer); }
}

export function verifyCleanupResponse(result) {
  if (!result?.complete || result.goneVerified !== true) {
    const error = new Error('OwnedCleanupIncomplete');
    error.cleanupDiagnostic = {
      stage: /^[a-z-]{1,60}$/.test(result?.stage || '') ? result.stage : 'process-cleanup',
      ...sanitizeWindowsDiagnostic(result),
      code: /^[A-Za-z]{1,60}$/.test(result?.code || '') ? result.code : 'OwnedCleanupIncomplete',
      killExitCodes: Array.isArray(result?.killResults) ? result.killResults.slice(0,128).map(item=>Number.isInteger(item.exitCode)?item.exitCode:null) : [],
      remainingOwnedPids: Array.isArray(result?.remainingOwnedPids) ? result.remainingOwnedPids.filter(Number.isInteger).slice(0,128) : [],
      remainingProfileProcessCount: Number.isInteger(result?.remainingProfileProcessCount) ? result.remainingProfileProcessCount : null
    };
    throw error;
  }
  return result;
}

export async function captureOwnedDescendants({identities, launchedAt}) {
  const raw = await powershell(`$ErrorActionPreference='Stop'
${identityOperations}
$known=@(Read-OwnedIdentities $env:DOCS_PROOF_IDENTITIES);$all=@(Get-CimInstance Win32_Process);$owned=@{}
$started=Get-CreationUtc $env:DOCS_PROOF_STARTED
foreach($identity in $known){
 $entry=Find-OwnedProcess $all ([int]$identity.pid)
 if($null -eq $entry){continue}
 Assert-OwnedIdentity $entry $identity $started
 $owned[[int]$entry.ProcessId]=$entry
}
for($depth=0;$depth -lt 64;$depth++){
 $added=$false
 foreach($entry in $all){
  if($owned.ContainsKey([int]$entry.ProcessId) -or -not $owned.ContainsKey([int]$entry.ParentProcessId)){continue}
  $parent=$owned[[int]$entry.ParentProcessId]
  if(-not $entry.ExecutablePath -or $entry.CreationDate.ToUniversalTime() -lt $parent.CreationDate.ToUniversalTime()){throw 'invalid descendant identity'}
  $owned[[int]$entry.ProcessId]=$entry;$added=$true
 }
 if(-not $added){break}
 if($depth -eq 63){throw 'descendant depth exceeded'}
}
$result=@($owned.Values | ForEach-Object { @{pid=[int]$_.ProcessId;executable=$_.ExecutablePath;created=$_.CreationDate.ToUniversalTime().ToString('o')} })
ConvertTo-Json -InputObject $result -Depth 4 -Compress`, {
    DOCS_PROOF_IDENTITIES:JSON.stringify(identities), DOCS_PROOF_STARTED:new Date(launchedAt).toISOString()
  });
  const descendants = JSON.parse(raw);
  if (!Array.isArray(descendants)) throw new Error('InvalidOwnedDescendants');
  const merged = new Map(identities.map(identity => [identity.pid, identity]));
  for (const identity of descendants) {
    if (!Number.isInteger(identity.pid) || !identity.executable || !Number.isFinite(Date.parse(identity.created))) throw new Error('InvalidOwnedDescendantIdentity');
    merged.set(identity.pid, identity);
  }
  return [...merged.values()];
}

export async function stopOwnedProcesses({identities, launchedAt, profile}) {
  const raw = await powershell(`$ErrorActionPreference='Stop'
${identityOperations}
$stage='identity-decoding';$killResults=@();$remaining=@();$profileProcesses=@()
try {
 $identities=@(Read-OwnedIdentities $env:DOCS_PROOF_IDENTITIES)
 $started=Get-CreationUtc $env:DOCS_PROOF_STARTED
 foreach($identity in $identities){
  $stage='identity-snapshot'
  $snapshot=@(Get-CimInstance Win32_Process -ErrorAction Stop)
  $stage='identity-selection'
  $entry=Find-OwnedProcess $snapshot ([int]$identity.pid)
  if($null -eq $entry){continue}
  $stage='identity-verification'
  Assert-OwnedIdentity $entry $identity $started
  $stage='taskkill'
  $start=New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName="$env:SystemRoot\\System32\\taskkill.exe"
  $start.Arguments='/PID '+[string]$identity.pid+' /T /F'
  $start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $killer=New-Object System.Diagnostics.Process;$killer.StartInfo=$start
  try {
   if(-not $killer.Start()){throw 'TaskkillLaunchFailed'}
   $stdout=$killer.StandardOutput.ReadToEndAsync();$stderr=$killer.StandardError.ReadToEndAsync()
   $exited=$killer.WaitForExit(2000)
   if(-not $exited){$killer.Kill();if(-not $killer.WaitForExit(1000)){throw 'TaskkillDidNotExit'}}
   $exitCode=$null;if($exited){$exitCode=$killer.ExitCode}
   $killResults+=@{pid=[int]$identity.pid;exitCode=$exitCode;timedOut=(-not $exited)}
  } finally {$killer.Dispose()}
 }
 $stage='process-exit-verification';$deadline=[DateTime]::UtcNow.AddSeconds(5)
 do {
  $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
  $remaining=@($all | Where-Object { $identities.pid -contains [int]$_.ProcessId })
  $profileProcesses=@($all | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:DOCS_PROOF_PROFILE) })
  if($remaining.Count -eq 0 -and $profileProcesses.Count -eq 0){
   @{complete=$true;goneVerified=$true;stage=$stage;killResults=$killResults} | ConvertTo-Json -Depth 5 -Compress
   exit 0
  }
  Start-Sleep -Milliseconds 100
 } while([DateTime]::UtcNow -lt $deadline)
 throw 'OwnedProcessStillRunning'
} catch {
 $code='WindowsOperationFailed'
 if($_.Exception.Message -cmatch '^[A-Za-z]{1,60}$'){$code=$_.Exception.Message}
 @{complete=$false;goneVerified=$false;stage=$stage;code=$code;exceptionType=$_.Exception.GetType().FullName;errorId=$_.FullyQualifiedErrorId;hresult=$_.Exception.HResult;killResults=$killResults;remainingOwnedPids=@($remaining | Select-Object -ExpandProperty ProcessId);remainingProfileProcessCount=$profileProcesses.Count} | ConvertTo-Json -Depth 5 -Compress
}`, {
    DOCS_PROOF_IDENTITIES: JSON.stringify(identities), DOCS_PROOF_STARTED: new Date(launchedAt).toISOString(), DOCS_PROOF_PROFILE: profile
  }, 23000);
  return verifyCleanupResponse(JSON.parse(raw));
}

export function sanitizeWindowsDiagnostic(value) {
  const result={};
  if(/^[A-Za-z0-9_.]{1,160}$/.test(value?.exceptionType || ''))result.exceptionType=value.exceptionType;
  if(/^[A-Za-z0-9_.,-]{1,160}$/.test(value?.errorId || ''))result.errorId=value.errorId;
  if(Number.isInteger(value?.hresult))result.hresult=value.hresult;
  return result;
}
