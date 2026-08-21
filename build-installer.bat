@echo off
setlocal EnableExtensions
set "SILENT_MODE=%SILENT%"
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if "%SILENT_MODE%"=="1" set "SILENT=1"

rem Keep signing disabled for every child process, including the build phase.
set "CSC_LINK="
set "CSC_KEY_PASSWORD="
set "WIN_CSC_LINK="
set "WIN_CSC_KEY_PASSWORD="
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
for /f "delims=" %%R in ('git -C "%~dp0" rev-parse HEAD') do set "SOURCE_REVISION=%%R"
if not defined SOURCE_REVISION (
  echo [installer] BLOCKED: source revision could not be resolved before the build. 1>&2
  exit /b 1
)
powershell -NoProfile -Command "$root=(Resolve-Path -LiteralPath '%~dp0').Path; $allowed=@('bin/','obj/','desktop-electron/dist/','desktop-electron/node_modules/'); $dirty=@(git -C $root status --porcelain=v1 --untracked-files=all | ForEach-Object { $line=$_.Substring(3).Replace([char]92,'/'); if (-not ($allowed | Where-Object { $line.StartsWith($_,[StringComparison]::OrdinalIgnoreCase) })) { $line } }); if ($dirty.Count -gt 0) { $dirty | ForEach-Object { Write-Error ('Source tree is dirty: ' + $_) }; exit 1 }"
if errorlevel 1 (
  echo [installer] BLOCKED: build-installer requires a clean source tree; only declared build outputs may be dirty. 1>&2
  exit /b 1
)
pushd "%~dp0desktop-electron" || exit /b 1
set "DIST_ROOT=%CD%\dist"
for %%D in ("%DIST_ROOT%\squirrel-windows" "%DIST_ROOT%\win-unpacked") do if exist "%%~fD" rmdir /s /q "%%~fD"
popd
call "%~dp0build.bat" /s
if errorlevel 1 exit /b 1
set "PATH=%LOCALAPPDATA%\Programs\dotnet;%LOCALAPPDATA%\Programs\nodejs;%ProgramFiles%\dotnet;%ProgramFiles(x86)%\dotnet;%ProgramFiles%\nodejs;%PATH%"
pushd "%~dp0desktop-electron" || exit /b 1
if "%SILENT%"=="0" echo [installer] Building the unsigned Squirrel.Windows package; code signing is disabled by policy.
call npm run dist
if errorlevel 1 (
  popd
  echo [installer] BLOCKED: npm run dist failed. 1>&2
  exit /b 1
)
set "ARTIFACT_ROOT=%CD%\dist\squirrel-windows"
if not exist "%ARTIFACT_ROOT%\RELEASES" (
  popd
  echo [installer] BLOCKED: RELEASES was not produced. 1>&2
  exit /b 1
)
for %%F in ("%ARTIFACT_ROOT%\*Setup*.exe") do set "SETUP=%%~fF"
if not defined SETUP (
  popd
  echo [installer] BLOCKED: Setup.exe was not produced. 1>&2
  exit /b 1
)
for %%F in ("%ARTIFACT_ROOT%\*.nupkg") do set "NUPKG=%%~fF"
if not defined NUPKG (
  popd
  echo [installer] BLOCKED: the full .nupkg package was not produced. 1>&2
  exit /b 1
)
for /f "delims=" %%R in ('git -C "%~dp0" rev-parse HEAD') do set "AFTER_BUILD_REVISION=%%R"
if /I not "%AFTER_BUILD_REVISION%"=="%SOURCE_REVISION%" (
  popd
  echo [installer] BLOCKED: source HEAD changed during the build; provenance is not stable. 1>&2
  exit /b 1
)
popd
powershell -NoProfile -Command "$root=(Resolve-Path -LiteralPath '%~dp0').Path; $allowed=@('bin/','obj/','desktop-electron/dist/','desktop-electron/node_modules/'); $dirty=@(git -C $root status --porcelain=v1 --untracked-files=all | ForEach-Object { $line=$_.Substring(3).Replace([char]92,'/'); if (-not ($allowed | Where-Object { $line.StartsWith($_,[StringComparison]::OrdinalIgnoreCase) })) { $line } }); if ($dirty.Count -gt 0) { $dirty | ForEach-Object { Write-Error ('Source tree changed during build: ' + $_) }; exit 1 }"
if errorlevel 1 (
  echo [installer] BLOCKED: source files changed during the build; provenance is not stable. 1>&2
  exit /b 1
)
pushd "%~dp0desktop-electron" || exit /b 1
for %%F in ("%SETUP%" "%NUPKG%") do powershell -NoProfile -Command "$sig = Get-AuthenticodeSignature -LiteralPath '%%~fF'; if ($sig.Status -ne 'NotSigned') { exit 1 }"
if errorlevel 1 (
  popd
  echo [installer] BLOCKED: an installer asset is not explicitly NotSigned. 1>&2
  exit /b 1
)
set "ARTIFACT_METADATA=%ARTIFACT_ROOT%\release-artifact-metadata.json"
powershell -NoProfile -Command "$files=@($env:SETUP,$env:NUPKG,(Join-Path $env:ARTIFACT_ROOT 'RELEASES')); if ($files | Where-Object { -not (Test-Path -LiteralPath $_) -or (Get-Item -LiteralPath $_).Length -le 0 }) { exit 1 }; $meta=[ordered]@{schemaVersion=1; sourceRevision=$env:SOURCE_REVISION; unsigned=$true; setup=(Split-Path -Leaf $files[0]); package=(Split-Path -Leaf $files[1]); releases='RELEASES'; sha256=@{setup=(Get-FileHash -Algorithm SHA256 -LiteralPath $files[0]).Hash.ToLowerInvariant(); package=(Get-FileHash -Algorithm SHA256 -LiteralPath $files[1]).Hash.ToLowerInvariant(); releases=(Get-FileHash -Algorithm SHA256 -LiteralPath $files[2]).Hash.ToLowerInvariant()}}; $meta | ConvertTo-Json -Depth 4 -Compress | Set-Content -LiteralPath $env:ARTIFACT_METADATA -Encoding utf8 -NoNewline; Write-Output ('sourceRevision=' + $env:SOURCE_REVISION); Write-Output ('setupSha256=' + $meta.sha256.setup); Write-Output ('packageSha256=' + $meta.sha256.package); Write-Output ('releasesSha256=' + $meta.sha256.releases)"
if errorlevel 1 (
  popd
  echo [installer] BLOCKED: artifact metadata/hash provenance could not be written. 1>&2
  exit /b 1
)
for %%F in ("%SETUP%" "%NUPKG%" "%ARTIFACT_ROOT%\RELEASES") do certutil -hashfile "%%~fF" SHA256 | findstr /R /I "^[0-9A-F][0-9A-F]" >nul || exit /b 1
if "%SILENT%"=="0" echo [installer] Unsigned Squirrel assets verified under %ARTIFACT_ROOT%.
popd
exit /b 0
