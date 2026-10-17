import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {identityOperations} from '../scripts/native-identity.mjs';
import {safeCleanupDiagnostic, sanitizeWindowsDiagnostic} from '../scripts/native-cleanup.mjs';

test('Windows PowerShell 5.1 decodes individual identities and rejects identity changes', {skip:process.platform !== 'win32' ? 'Requires native Windows PowerShell 5.1' : false}, () => {
  const script = `$ErrorActionPreference='Stop'
${identityOperations}
function Require($Condition,[string]$Code){if(-not $Condition){throw $Code}}
function Require-Rejection($Operation,[string]$Code){
 $rejected=$false
 try { & $Operation } catch { $rejected=$true }
 Require $rejected $Code
}
Require ($PSVersionTable.PSVersion.Major -eq 5) 'ExpectedWindowsPowerShell5'
$records=@(Read-OwnedIdentities '[{"pid":4101,"executable":"fixture-one.exe","created":"2026-10-17T12:00:00.1234567Z"},{"pid":4102,"executable":"fixture-two.exe","created":"2026-10-17T12:00:00.2234567Z"}]')
Require ($records.Count -eq 2) 'TwoIndividualRecordsRequired'
Require ($records[0].pid -isnot [Array] -and $records[0].pid -eq 4101 -and $records[1].pid -eq 4102) 'ScalarPidsRequired'
$single=@(Read-OwnedIdentities '[{"pid":4101,"executable":"fixture-one.exe"}]')
Require ($single.Count -eq 1 -and $single[0].pid -eq 4101) 'SingleRecordRequired'
$created=Get-CreationUtc '2026-10-17T12:00:00.1234567Z'
$started=Get-CreationUtc '2026-10-17T12:00:00Z'
$entry=[pscustomobject]@{ProcessId=4101;ExecutablePath='fixture-one.exe';CreationDate=$created}
Assert-OwnedIdentity $entry $records[0] $started
$entry.CreationDate='2026-10-17T14:00:00.1234567+02:00'
Assert-OwnedIdentity $entry $records[0] $started
$entry.CreationDate=$created.AddTicks(1)
Require-Rejection {Assert-OwnedIdentity $entry $records[0] $started} 'ChangedCreationMustFail'
$entry.CreationDate=$created;$entry.ExecutablePath='changed.exe'
Require-Rejection {Assert-OwnedIdentity $entry $records[0] $started} 'ChangedExecutableMustFail'
$entry.ExecutablePath='fixture-one.exe'
Require-Rejection {Assert-OwnedIdentity $entry $records[0] $started.AddSeconds(3)} 'PredatingProcessMustFail'
Require ($null -eq (Find-OwnedProcess @($entry) 9999)) 'ExitedProcessReturnsNoObject'
Require ((Find-OwnedProcess @($entry) 4101).ProcessId -eq 4101) 'ExistingProcessSelected'
Require-Rejection {Find-OwnedProcess @($entry,$entry) 4101} 'AmbiguousPidMustFail'
Require-Rejection {Read-OwnedIdentities '[{"pid":[4101,4102],"executable":"fixture.exe"}]'} 'ArrayPidMustFail'
'identity-fixtures-passed'
`;
  const binary=join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const output=execFileSync(binary,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(output.trim(),'identity-fixtures-passed');
});

test('snapshot diagnostics retain only bounded Windows error identifiers', () => {
  const safe={exceptionType:'System.Management.Automation.RuntimeException',errorId:'InvalidCastFromJson,Microsoft.PowerShell.Commands.ConvertFromJsonCommand',hresult:-2146233087};
  assert.deepEqual(safeCleanupDiagnostic({nativeDiagnostic:safe},'descendant-snapshot'),{stage:'descendant-snapshot',...safe,code:'CleanupOperationFailed'});
  assert.deepEqual(sanitizeWindowsDiagnostic({exceptionType:'C:\\private\\file',errorId:'raw secret / path',hresult:'secret',message:'private'}),{});
});
