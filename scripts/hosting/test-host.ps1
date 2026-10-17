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
# A healthy response must identify the selected published release, not just return 200.
$script:expectedRevision = 'a' * 40
$script:expectedVersion = '0.1.123'
$script:response = @{ StatusCode = 200; Content = '{"status":"ok","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":"0.1.123"}' }
function Invoke-WebRequest { return $script:response }
Assert (Get-Health) 'Matching release health rejected'
$script:response.StatusCode = 503
Assert (-not (Get-Health)) 'Failed HTTP status accepted'
$script:response.StatusCode = 200
foreach ($body in @('{"status":"error","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":"0.1.123"}', '{"status":"ok","revision":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","version":"0.1.123"}', '{"status":"ok","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","version":"0.1.124"}', '<html>ok</html>', '{}')) {
    $script:response.Content = $body
    Assert (-not (Get-Health)) 'Incorrect release health accepted'
}

# Drive the actual event loop with a virtual clock and nonblocking keyboard.
$script:tick = 0
$script:frames = [Collections.Generic.List[object]]::new()
function Test-ConsoleInteractive { return $true }
function Get-RefreshTime { return ([DateTime]'2026-01-01T00:00:00Z').AddSeconds($script:tick) }
function Wait-ConsoleTick { $script:tick++; if ($script:tick -gt 12) { throw 'Console failed to exit' } }
function Get-ConsoleKey {
    switch ($script:tick) { 3 { return 'P' } 6 { return 'Spacebar' } 10 { return 'Q' } }
    return $null
}
function Show-ConsoleFrame([string]$View, [bool]$Follow) { $script:frames.Add(@{ Tick = $script:tick; View = $View; Follow = $Follow }) }
Show-Menu 'logs'
Assert (($frames.Tick -join ',') -eq '0,2,4,7,9') 'Timed refresh or pause/resume timing is incorrect'
Assert ($frames[0].View -eq 'logs') 'Logs mode lost its initial pane'
Assert (-not $frames[2].Follow -and $frames[3].Follow) 'Follow state did not pause and resume'

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
        if ($args[0] -eq 'image') { '{"org.opencontainers.image.revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","org.opencontainers.image.version":"0.1.123"}' }
    }
    function Get-Health { return $true }
    function Show-Status { $script:calls.Add('status') }
    function Show-Menu { $script:menus++; $script:initialView = $args[0] }
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
    Assert ($script:initialView -eq 'logs') 'Logs mode did not select live logs'
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
