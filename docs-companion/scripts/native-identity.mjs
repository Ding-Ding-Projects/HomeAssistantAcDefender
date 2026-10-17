// Shared by the real Windows proof and its PowerShell 5.1 regression fixtures.
export const identityOperations = `
function Read-OwnedIdentities([string]$Json) {
 # Assignment preserves the decoded JSON array without nesting a PS5 pipeline array.
 $decoded = ConvertFrom-Json -InputObject $Json
 foreach($identity in $decoded) {
  if($identity -is [Array] -or $null -eq $identity.pid -or $identity.pid -is [Array] -or $identity.executable -isnot [string]){throw 'InvalidIdentityRecord'}
  $number=[long]$identity.pid
  if($number -le 0 -or $number -gt [int]::MaxValue){throw 'InvalidIdentityPid'}
  $identity
 }
}
function Find-OwnedProcess($Snapshot,[int]$ProcessNumber) {
 $matches=@($Snapshot | Where-Object { $_.ProcessId -eq $ProcessNumber })
 if($matches.Count -gt 1){throw 'AmbiguousProcessIdentity'}
 if($matches.Count -eq 1){$matches[0]}
}
function Get-CreationUtc($Value) {
 if($null -eq $Value){throw 'MissingProcessCreationDate'}
 if($Value -is [DateTime]){return $Value.ToUniversalTime()}
 if($Value -isnot [string]){throw 'InvalidProcessCreationDate'}
 return [DateTime]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
}
function Assert-OwnedIdentity($Entry,$Identity,[DateTime]$Started) {
 if($Entry.ExecutablePath -ne $Identity.executable){throw 'ProcessIdentityChanged'}
 $actual=Get-CreationUtc $Entry.CreationDate
 if($Identity.created){
  $expected=Get-CreationUtc $Identity.created
  if($actual.Ticks -ne $expected.Ticks){throw 'ProcessCreationChanged'}
 }
 if($actual -lt $Started.ToUniversalTime().AddSeconds(-2)){throw 'ProcessPredatesLaunch'}
}
`;
