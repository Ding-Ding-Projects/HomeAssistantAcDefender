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
  await stopAndVerify();
  await removeOwnedFiles();
  return {complete: true, graceful};
}

async function powershell(script, variables) {
  const binary = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const {stdout} = await execute(binary, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    env: {...process.env, ...variables}, windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024
  });
  return stdout.trim();
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

export async function stopOwnedProcesses({identities, launchedAt, profile}) {
  await powershell(`$ErrorActionPreference='Stop'
$identities=@(ConvertFrom-Json $env:DOCS_PROOF_IDENTITIES)
foreach($identity in $identities){
 $entry=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$identity.pid) -ErrorAction SilentlyContinue
 if($null -eq $entry){continue}
 if($entry.ExecutablePath -ne $identity.executable){throw 'process identity changed'}
 if($identity.created -and $entry.CreationDate.ToUniversalTime().ToString('o') -ne $identity.created){throw 'process creation changed'}
 if($entry.CreationDate.ToUniversalTime() -lt [DateTime]::Parse($env:DOCS_PROOF_STARTED).ToUniversalTime().AddSeconds(-2)){throw 'process predates launch'}
 & "$env:SystemRoot\\System32\\taskkill.exe" /PID ([string]$identity.pid) /T /F 2>$null | Out-Null
}
for($attempt=0;$attempt -lt 20;$attempt++){
 $remaining=$false
 foreach($identity in $identities){
  $entry=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$identity.pid) -ErrorAction SilentlyContinue
  if($entry){$remaining=$true}
 }
 $profileProcesses=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:DOCS_PROOF_PROFILE) })
 if(-not $remaining -and $profileProcesses.Count -eq 0){Write-Output 'closed';exit 0}
 Start-Sleep -Milliseconds 100
}
throw 'owned process still running'`, {
    DOCS_PROOF_IDENTITIES: JSON.stringify(identities), DOCS_PROOF_STARTED: new Date(launchedAt).toISOString(), DOCS_PROOF_PROFILE: profile
  });
}
