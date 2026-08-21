@echo off
setlocal EnableExtensions
set "SILENT_MODE=%SILENT%"
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if "%SILENT_MODE%"=="1" set "SILENT=1"
if "%SILENT%"=="0" echo [build] Bootstrapping dependencies and building the real Release server...
call "%~dp0download-dependencies.bat" /s
if errorlevel 1 exit /b 1
set "PATH=%LOCALAPPDATA%\Programs\dotnet;%LOCALAPPDATA%\Programs\nodejs;%ProgramFiles%\dotnet;%ProgramFiles(x86)%\dotnet;%ProgramFiles%\nodejs;%PATH%"
dotnet restore "%~dp0HomeAssistantAcDefender.csproj"
if errorlevel 1 exit /b 1
dotnet build "%~dp0HomeAssistantAcDefender.csproj" --configuration Release --no-restore
if errorlevel 1 exit /b 1
if not exist "%~dp0bin\Release\net10.0\HomeAssistantAcDefender.dll" (
  echo [build] BLOCKED: Release server output HomeAssistantAcDefender.dll is missing. 1>&2
  exit /b 1
)
pushd "%~dp0desktop-electron" || exit /b 1
call npm run build
if errorlevel 1 (
  popd
  echo [build] BLOCKED: the Windows controller build failed. 1>&2
  exit /b 1
)
if not exist "%CD%\dist\index.html" (
  popd
  echo [build] BLOCKED: Windows controller output dist\index.html is missing. 1>&2
  exit /b 1
)
popd
if "%SILENT%"=="1" exit /b 0
choice /C YN /N /M "[build] Launch the Release server on http://127.0.0.1:8888? [Y/N] "
if errorlevel 2 exit /b 0
dotnet run --project "%~dp0HomeAssistantAcDefender.csproj" --configuration Release --no-build --urls http://127.0.0.1:8888
