# Focused control-flow checks: Docker is mocked; no service or climate endpoint is contacted.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'host.ps1')
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$prefix = 'ghcr.io/ding-ding-projects/homeassistantacdefender'
Assert (Test-ImmutableImage "$prefix@sha256:$(('a' * 64))") 'Digest rejected'
Assert (Test-ImmutableImage "${prefix}:sha-$(('a' * 40))") 'Commit reference rejected'
foreach ($bad in @("${prefix}:latest", "${prefix}:sha-abc", "$prefix@sha256:$(('a' * 63))", "other.example/app@sha256:$(('a' * 64))", "$prefix@sha256:$(('a' * 64))`nextra")) {
    Assert (-not (Test-ImmutableImage $bad)) 'Unsafe image reference accepted'
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('hosting-check-' + [guid]::NewGuid())
$priorImage = $env:AC_DEFENDER_IMAGE
try {
    New-Item -ItemType Directory -Path $temporary | Out-Null
    Set-Content -LiteralPath (Join-Path $temporary '.env') -Value '# Test fixture contains no credentials.'
    $root = $temporary
    $composeFile = Join-Path $root 'docker-compose.yml'
    $env:AC_DEFENDER_IMAGE = "$prefix@sha256:$(('a' * 64))"
    $script:calls = [Collections.Generic.List[string]]::new()
    $script:dockerExit = 0
    $script:menus = 0
    function docker {
        $script:calls.Add(($args -join ' '))
        $global:LASTEXITCODE = $script:dockerExit
        if ($args[0] -eq 'info') { 'linux' }
    }
    function Get-Health { return $true }
    function Show-Status { $script:calls.Add('status') }
    function Show-Menu { $script:menus++ }
    function Read-Host { return $script:confirmation }
    $Arguments = @('--detached')
    Main
    Assert ($menus -eq 0) 'Detached startup opened interactive console'
    Assert (@($calls | Where-Object { $_ -match 'up --detach --no-build --wait --wait-timeout 120 ac-defender$' }).Count -eq 1) 'Detached startup did not wait for scoped service health'
    Assert (@($calls | Where-Object { $_ -match 'pull ac-defender$' }).Count -eq 1) 'Published image was not pulled'
    $calls.Clear()
    $Arguments = @('--logs')
    Main
    Assert ($menus -eq 1) 'Logs mode did not enter keyboard console'
    Assert (@($calls | Where-Object { $_ -match 'logs --tail 60 --no-color ac-defender$' }).Count -eq 1) 'Log snapshot missing'
    Assert (@($calls | Where-Object { $_ -match ' (up|pull|stop|down) ' }).Count -eq 0) 'Logs mode changed service state'
    $calls.Clear()
    $Arguments = @('--stop')
    $script:confirmation = 'cancel'
    Main
    Assert (@($calls | Where-Object { $_ -match 'stop ac-defender$' }).Count -eq 0) 'Unconfirmed stop executed'
    $script:confirmation = 'STOP'
    Main
    Assert (@($calls | Where-Object { $_ -match 'stop ac-defender$' }).Count -eq 1) 'Confirmed scoped stop missing'
    $script:dockerExit = 17
    $failed = $false
    try { Invoke-Compose @('pull', 'ac-defender') } catch { $failed = $true }
    Assert $failed 'Docker failure was swallowed'
    $script:dockerExit = 0
    $Arguments = @('--invalid')
    $failed = $false
    try { Main } catch { $failed = $true }
    Assert $failed 'Invalid command accepted'
    Write-Host 'Hosting control-flow checks passed.'
} finally {
    $env:AC_DEFENDER_IMAGE = $priorImage
    Remove-Item -LiteralPath $temporary -Recurse -Force
}
