param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments = @())
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$composeFile = Join-Path $root 'docker-compose.yml'
$script:expectedRevision = $null
$script:expectedVersion = $null

function Invoke-Compose([string[]]$ComposeArguments) {
    & docker compose --project-directory $root --file $composeFile @ComposeArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed (exit $LASTEXITCODE)." }
}
function Test-ImmutableImage([string]$Reference) {
    return $Reference -cmatch '^ghcr\.io/ding-ding-projects/homeassistantacdefender(?:@sha256:[a-f0-9]{64}|:sha-[a-f0-9]{40})$'
}
function Set-ReleaseImage {
    # An explicit process setting wins; an existing .env setting is preserved.
    $candidate = $env:AC_DEFENDER_IMAGE
    if (-not $candidate) {
        $line = Get-Content -LiteralPath (Join-Path $root '.env') | Where-Object { $_ -match '^AC_DEFENDER_IMAGE=' } | Select-Object -Last 1
        if ($line) { $candidate = ($line -replace '^AC_DEFENDER_IMAGE=', '').Trim().Trim('"').Trim("'") }
    }
    if (-not $candidate) {
        Write-Host 'Resolving the published release image over HTTPS...'
        $candidate = (Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Ding-Ding-Projects/HomeAssistantAcDefender/releases/latest/download/image-reference.txt' -TimeoutSec 30).Content.Trim()
    }
    if (-not (Test-ImmutableImage $candidate)) { throw 'The image must be the published repository digest or full sha-commit tag. Floating/local image references are refused.' }
    $env:AC_DEFENDER_IMAGE = $candidate
}
function Read-ImageMetadata {
    $labelsJson = & docker image inspect --format '{{json .Config.Labels}}' $env:AC_DEFENDER_IMAGE
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the selected local image; pull the published image first.' }
    $labels = $labelsJson | ConvertFrom-Json
    $revision = $labels.'org.opencontainers.image.revision'
    $version = $labels.'org.opencontainers.image.version'
    if ($revision -cnotmatch '^[a-f0-9]{40}$' -or $version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') { throw 'The selected image has missing or invalid release metadata.' }
    $script:expectedRevision = $revision
    $script:expectedVersion = $version
}
function Get-Health {
    try {
        if (-not $script:expectedRevision -or -not $script:expectedVersion) { return $false }
        $result = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8888/healthz' -TimeoutSec 3
        $body = $result.Content | ConvertFrom-Json
        return ($result.StatusCode -eq 200 -and $body.status -ceq 'ok' -and
            $body.revision -ceq $script:expectedRevision -and $body.version -ceq $script:expectedVersion)
    } catch { return $false }
}
function Show-Status {
    Invoke-Compose @('ps', 'ac-defender')
    $healthy = Get-Health
    Write-Host ("HTTP release health: {0}" -f $(if ($healthy) { 'healthy' } else { 'not ready / unavailable / release mismatch' }))
    Write-Host 'Local URL: http://localhost:8888'
    $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.|0\.)' -and $_.AddressState -eq 'Preferred' })
    foreach ($address in $addresses) { Write-Host ("LAN candidate URL: http://{0}:8888" -f $address.IPAddress) }
    Write-Host 'LAN candidates depend on routing and firewall rules; confirm access from the other device.'
}
function Start-Hosting {
    Invoke-Compose @('pull', 'ac-defender')
    Read-ImageMetadata
    Invoke-Compose @('up', '--detach', '--no-build', '--wait', '--wait-timeout', '120', 'ac-defender')
    Show-Status
    if (-not (Get-Health)) { throw 'The container started but host health did not report status ok and the selected image revision/version.' }
}
function Show-Logs {
    # Repeated bounded reads follow output without a blocking child log process.
    Invoke-Compose @('logs', '--tail', '60', '--no-color', 'ac-defender')
}
function Test-ConsoleInteractive { return -not [Console]::IsInputRedirected }
function Get-ConsoleKey {
    if ([Console]::KeyAvailable) { return [Console]::ReadKey($true).Key.ToString() }
    return $null
}
function Get-RefreshTime { return [DateTime]::UtcNow }
function Wait-ConsoleTick { Start-Sleep -Milliseconds 100 }
function Show-ConsoleFrame([string]$View, [bool]$Follow) {
    Clear-Host
    Write-Host 'AC DEFENDER | DOCKER HOSTING' -ForegroundColor Cyan
    Write-Host ("Live refresh: {0} | {1:u}" -f $(if ($Follow) { 'following every 2 seconds' } else { 'paused' }), (Get-RefreshTime))
    Write-Host ('=' * 72)
    Show-Status
    if ($View -eq 'logs') { Show-Logs }
    Write-Host ('=' * 72)
    Write-Host '[S] status [L] logs [Space/P] follow/pause [R] refresh [O] browser [T] stop [Q/Esc] exit' -ForegroundColor Cyan
    Write-Host 'Exiting this console leaves the service running.'
}
function Show-Menu([string]$InitialView = 'status') {
    if (-not (Test-ConsoleInteractive)) { throw 'The keyboard console requires an interactive terminal. Use --detached for unattended startup.' }
    $view = $InitialView
    $follow = $true
    $refresh = $true
    $nextRefresh = [DateTime]::MinValue
    while ($true) {
        $now = Get-RefreshTime
        if ($refresh -or ($follow -and $now -ge $nextRefresh)) {
            Show-ConsoleFrame $view $follow
            $nextRefresh = (Get-RefreshTime).AddSeconds(2)
            $refresh = $false
        }
        # Polling, rather than a blocking ReadKey, keeps automatic refresh alive.
        switch (Get-ConsoleKey) {
            'S' { $view = 'status'; $refresh = $true }
            'L' { $view = 'logs'; $refresh = $true }
            'Spacebar' { $follow = -not $follow; $refresh = $true }
            'P' { $follow = -not $follow; $refresh = $true }
            'R' { $refresh = $true }
            'O' { Start-Process 'http://localhost:8888' }
            'T' {
                Write-Host 'Type STOP to stop only the AC Defender service (data is retained):'
                if ((Read-Host) -ceq 'STOP') { Invoke-Compose @('stop', 'ac-defender') } else { Write-Host 'Stop canceled.' }
                $view = 'status'
                $refresh = $true
            }
            'Q' { return }
            'Escape' { return }
        }
        Wait-ConsoleTick
    }
}
function Main {
    $mode = if (@($Arguments).Count -eq 0) { '--interactive' } else { $Arguments[0] }
    if (@($Arguments).Count -gt 1 -or $mode -notin @('--interactive', '--detached', '--logs', '--status', '--stop')) { throw 'Usage: host.bat [--detached | --logs | --status | --stop]' }
    if (-not (Test-Path -LiteralPath (Join-Path $root '.env'))) { throw 'Missing .env. Copy .env.example to .env and configure real Home Assistant credentials and proxy trust locally before hosting. Existing credentials are never generated or overwritten.' }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop with Linux containers and Compose v2 is required. Install/start Docker Desktop, then retry.' }
    $osType = & docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable. Start Docker Desktop with Linux containers and retry.' }
    if ($osType -ne 'linux') { throw 'Switch Docker Desktop to Linux containers, then retry.' }
    Set-ReleaseImage
    # Validate before any pull or service change; do not print the expanded secret configuration.
    Invoke-Compose @('config', '--quiet')
    switch ($mode) {
        '--detached' { Start-Hosting }
        '--status' { Read-ImageMetadata; Show-Status }
        '--stop' {
            Write-Host 'Type STOP to stop only the AC Defender service (data is retained):'
            if ((Read-Host) -ceq 'STOP') { Invoke-Compose @('stop', 'ac-defender') } else { Write-Host 'Stop canceled.' }
        }
        '--logs' { Read-ImageMetadata; Show-Menu 'logs' }
        default { Start-Hosting; Show-Menu }
    }
}
if ($MyInvocation.InvocationName -ne '.') {
    try { Main; exit 0 } catch { Write-Error $_ -ErrorAction Continue; exit 1 }
}
