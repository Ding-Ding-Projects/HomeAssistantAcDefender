@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "SILENT_MODE=%SILENT%"
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if /I "%SILENT_MODE%"=="1" set "SILENT=1"

set "DOTNET_SDK_VERSION=10.0.301"
set "DOTNET_RUNTIME_VERSION=10.0.11"
set "NODE_VERSION=24.19.0"
set "DOTNET_USER_ROOT=%LOCALAPPDATA%\Programs\dotnet"
set "DOTNET_USER_EXE=%DOTNET_USER_ROOT%\dotnet.exe"
set "NODE_USER_ROOT=%LOCALAPPDATA%\Programs\nodejs"
set "NODE_USER_EXE=%NODE_USER_ROOT%\node.exe"
set "DOTNET_SDK_URL=https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.301/dotnet-sdk-10.0.301-win-x64.zip"
set "DOTNET_SDK_SHA256=38456e992c4df0ff0ac9fc5f28ff09a88543c0fc4e4deedffda9c4ebaf852c4519addacf28814ea77ea42ce2d37db812fae5ba1fe25f06364ca5a6027036387f"
set "DOTNET_SDK_HASH_ALGORITHM=SHA512"
set "DOTNET_RUNTIME_URL=https://builds.dotnet.microsoft.com/dotnet/Runtime/10.0.11/dotnet-runtime-10.0.11-win-x64.zip"
set "DOTNET_RUNTIME_SHA256=d9ab9c0d9916b8fa3585b5f403057f594ffffb8364dac09e0007dd8ac671c86754935b980d8fb5da83cb1b82ac3cd57cc407c969e6d837aaa2fae21047cb7448"
set "DOTNET_RUNTIME_HASH_ALGORITHM=SHA512"
set "NODE_URL=https://nodejs.org/download/release/v24.19.0/node-v24.19.0-win-x64.zip"
set "NODE_SHA256=57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73"
set "NODE_HASH_ALGORITHM=SHA256"

if "%SILENT%"=="0" echo [deps] Checking pinned .NET SDK/runtime 10 and Node.js %NODE_VERSION%...
call :refresh_path
call :ensure_dotnet_sdk
if errorlevel 1 exit /b 1
call :ensure_dotnet_runtime
if errorlevel 1 exit /b 1
call :ensure_node
if errorlevel 1 exit /b 1

if "%SILENT%"=="0" echo [deps] Verified .NET SDK %DOTNET_SDK_VERSION%, .NET runtime %DOTNET_RUNTIME_VERSION%, and Node.js v%NODE_VERSION%; installing locked npm dependencies...
pushd "%~dp0desktop-electron" || exit /b 1
call npm ci --ignore-scripts
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: npm ci failed from desktop-electron/package-lock.json. 1>&2
  exit /b 1
)
call node -e "const p=require('./node_modules/electron/package.json'); if(p.version==='43.4.1') process.exit(0); process.exit(1)"
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: Electron 43.4.1 was not installed. 1>&2
  exit /b 1
)
call node node_modules/electron/install.js
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: reviewed Electron 43.4.1 install step failed. 1>&2
  exit /b 1
)
call node -e "const p=require('./node_modules/esbuild/package.json'); if(p.version==='0.28.1') process.exit(0); process.exit(1)"
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: esbuild 0.28.1 was not installed. 1>&2
  exit /b 1
)
call node node_modules/esbuild/install.js
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: reviewed esbuild 0.28.1 install step failed. 1>&2
  exit /b 1
)
call node -e "const p=require('./node_modules/electron-winstaller/package.json'); if(p.version==='5.4.0') process.exit(0); process.exit(1)"
if errorlevel 1 (
  popd
  echo [deps] BLOCKED: electron-winstaller 5.4.0 was not installed. 1>&2
  exit /b 1
)
rem electron-winstaller 5.4.0 is a transitive packaging library whose install hook expects
rem project-local vendor/7z-* binaries that this Squirrel.Windows builder does not own; keep
rem npm lifecycle disabled and verify its exact package version without invoking that hook.
popd
if "%SILENT%"=="0" echo [deps] Dependency bootstrap complete.
exit /b 0

:ensure_dotnet_sdk
call :has_dotnet_sdk
if not errorlevel 1 exit /b 0
if "%SILENT%"=="0" echo [deps] Installing pinned Microsoft.DotNet.SDK.10 version %DOTNET_SDK_VERSION%...
call :try_winget Microsoft.DotNet.SDK.10 %DOTNET_SDK_VERSION%
call :refresh_path
call :has_dotnet_sdk
if not errorlevel 1 exit /b 0
call :download_and_extract "%DOTNET_SDK_URL%" "%DOTNET_SDK_SHA256%" "%DOTNET_SDK_HASH_ALGORITHM%" "dotnet-sdk-%DOTNET_SDK_VERSION%-win-x64.zip" "%DOTNET_USER_ROOT%"
if errorlevel 1 (
  echo [deps] BLOCKED: pinned .NET SDK %DOTNET_SDK_VERSION% could not be installed from winget or its verified Microsoft portable ZIP fallback. 1>&2
  exit /b 1
)
call :refresh_path
call :has_dotnet_sdk
if errorlevel 1 (
  echo [deps] BLOCKED: pinned .NET SDK %DOTNET_SDK_VERSION% is still unavailable after portable installation. 1>&2
  exit /b 1
)
exit /b 0

:has_dotnet_sdk
if exist "%DOTNET_USER_EXE%" (
  "%DOTNET_USER_EXE%" --list-sdks 2>nul | findstr /R /C:"^%DOTNET_SDK_VERSION% " >nul
) else (
  where dotnet >nul 2>nul || exit /b 1
  dotnet --list-sdks 2>nul | findstr /R /C:"^%DOTNET_SDK_VERSION% " >nul
)
exit /b %errorlevel%

:ensure_dotnet_runtime
call :has_dotnet_runtime
if not errorlevel 1 exit /b 0
if "%SILENT%"=="0" echo [deps] Installing pinned Microsoft.NETCore.App runtime %DOTNET_RUNTIME_VERSION%...
call :try_winget Microsoft.DotNet.Runtime.10 %DOTNET_RUNTIME_VERSION%
call :refresh_path
call :has_dotnet_runtime
if not errorlevel 1 exit /b 0
call :download_and_extract "%DOTNET_RUNTIME_URL%" "%DOTNET_RUNTIME_SHA256%" "%DOTNET_RUNTIME_HASH_ALGORITHM%" "dotnet-runtime-%DOTNET_RUNTIME_VERSION%-win-x64.zip" "%DOTNET_USER_ROOT%"
if errorlevel 1 (
  echo [deps] BLOCKED: pinned .NET runtime %DOTNET_RUNTIME_VERSION% could not be installed from winget or its verified Microsoft portable ZIP fallback. 1>&2
  exit /b 1
)
call :refresh_path
call :has_dotnet_runtime
if errorlevel 1 (
  echo [deps] BLOCKED: Microsoft.NETCore.App %DOTNET_RUNTIME_VERSION% is still unavailable after portable installation. 1>&2
  exit /b 1
)
exit /b 0

:has_dotnet_runtime
if exist "%DOTNET_USER_EXE%" (
  "%DOTNET_USER_EXE%" --list-runtimes 2>nul | findstr /R /C:"^Microsoft\.NETCore\.App %DOTNET_RUNTIME_VERSION% " >nul
) else (
  where dotnet >nul 2>nul || exit /b 1
  dotnet --list-runtimes 2>nul | findstr /R /C:"^Microsoft\.NETCore\.App %DOTNET_RUNTIME_VERSION% " >nul
)
exit /b %errorlevel%

:ensure_node
call :has_node_exact
if not errorlevel 1 goto node_npm
if "%SILENT%"=="0" echo [deps] Installing pinned OpenJS.NodeJS.LTS version %NODE_VERSION%...
call :try_winget OpenJS.NodeJS.LTS %NODE_VERSION%
call :refresh_path
call :has_node_exact
if not errorlevel 1 goto node_npm
call :download_and_extract "%NODE_URL%" "%NODE_SHA256%" "%NODE_HASH_ALGORITHM%" "node-v%NODE_VERSION%-win-x64.zip" "%NODE_USER_ROOT%"
if errorlevel 1 (
  echo [deps] BLOCKED: pinned Node.js v%NODE_VERSION% could not be installed from winget or its verified Node.js portable ZIP fallback. 1>&2
  exit /b 1
)
call :refresh_path
call :has_node_exact
if errorlevel 1 (
  echo [deps] BLOCKED: Node.js v%NODE_VERSION% is still unavailable after portable installation. 1>&2
  exit /b 1
)

:node_npm
where npm >nul 2>nul || (
  echo [deps] BLOCKED: npm is unavailable beside Node.js v%NODE_VERSION%. 1>&2
  exit /b 1
)
exit /b 0

:has_node_exact
set "FOUND_NODE_VERSION="
if exist "%NODE_USER_EXE%" (
  for /f "delims=" %%V in ('"%NODE_USER_EXE%" --version 2^>nul') do set "FOUND_NODE_VERSION=%%V"
) else (
  where node >nul 2>nul || exit /b 1
  for /f "delims=" %%V in ('node --version 2^>nul') do set "FOUND_NODE_VERSION=%%V"
)
if /I "!FOUND_NODE_VERSION!"=="v%NODE_VERSION%" exit /b 0
exit /b 1

:try_winget
where winget >nul 2>nul || exit /b 1
winget install --id %~1 --version %~2 --exact --source winget --scope user --silent --disable-interactivity --accept-source-agreements --accept-package-agreements >nul 2>nul
exit /b 0

:download_and_extract
set "DOWNLOAD_URL=%~1"
set "DOWNLOAD_SHA256=%~2"
set "DOWNLOAD_ALGORITHM=%~3"
set "DOWNLOAD_NAME=%~4"
set "DOWNLOAD_DEST=%~5"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$ErrorActionPreference='Stop'; $url=$env:DOWNLOAD_URL; $hash=$env:DOWNLOAD_SHA256; $algorithm=$env:DOWNLOAD_ALGORITHM; $name=$env:DOWNLOAD_NAME; $destination=$env:DOWNLOAD_DEST; $archive=Join-Path $env:TEMP $name; $extract=Join-Path $env:TEMP ($name + '.extract'); try { $curl=Get-Command curl.exe -ErrorAction SilentlyContinue; if ($null -ne $curl) { & $curl.Source '--fail' '--location' '--silent' '--show-error' '--retry' '3' '--retry-delay' '2' '--connect-timeout' '20' '--max-time' '600' '--output' $archive $url; if ($LASTEXITCODE -ne 0) { throw 'curl download failed' } } else { Invoke-WebRequest -UseBasicParsing -TimeoutSec 600 -Uri $url -OutFile $archive }; $stream=[IO.File]::OpenRead($archive); try { $hasher=[Security.Cryptography.HashAlgorithm]::Create($algorithm); if ($null -eq $hasher) { throw ('unsupported digest algorithm ' + $algorithm) }; try { $actualHash=([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() } } finally { $stream.Dispose() }; if ($actualHash -ne $hash) { throw ('download digest mismatch for ' + $name) }; Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force -Path $extract | Out-Null; Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force; $source=if (Test-Path -LiteralPath (Join-Path $extract 'dotnet.exe')) { $extract } elseif (Test-Path -LiteralPath (Join-Path $extract 'node.exe')) { $extract } else { $child=Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1; if ($null -eq $child) { throw 'Portable archive has no root directory.' }; $child.FullName }; New-Item -ItemType Directory -Force -Path $destination | Out-Null; Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force; exit 0 } catch { [Console]::Error.WriteLine('[deps] portable fallback failed for ' + $name + ': ' + $_.Exception.Message); exit 1 } finally { Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue }"
exit /b %errorlevel%

:refresh_path
set "PATH=%LOCALAPPDATA%\Programs\dotnet;%LOCALAPPDATA%\Programs\nodejs;%ProgramFiles%\dotnet;%ProgramFiles(x86)%\dotnet;%ProgramFiles%\nodejs;%PATH%"
exit /b 0
