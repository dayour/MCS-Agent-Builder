@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "NODE_CMD=node"
set "NODE_VERSION="
set "NODE_MAJOR="
set "NODE_DIR="

for /f "usebackq delims=" %%V in (`node -p "process.versions.node" 2^>nul`) do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%A in ("%NODE_VERSION%") do set "NODE_MAJOR=%%A"

set "NEEDS_SUPPORTED_NODE="
if not defined NODE_MAJOR set "NEEDS_SUPPORTED_NODE=1"
if defined NODE_MAJOR if !NODE_MAJOR! LSS 20 set "NEEDS_SUPPORTED_NODE=1"
if defined NODE_MAJOR if !NODE_MAJOR! GEQ 25 set "NEEDS_SUPPORTED_NODE=1"

if defined NEEDS_SUPPORTED_NODE (
  if not defined NVM_HOME goto unsupported_node

  for /d %%D in ("%NVM_HOME%\v24.*") do if exist "%%~fD\node.exe" if exist "%%~fD\npm.cmd" set "NODE_DIR=%%~fD"
  if not defined NODE_DIR for /d %%D in ("%NVM_HOME%\v22.*") do if exist "%%~fD\node.exe" if exist "%%~fD\npm.cmd" set "NODE_DIR=%%~fD"
  if not defined NODE_DIR for /d %%D in ("%NVM_HOME%\v20.*") do if exist "%%~fD\node.exe" if exist "%%~fD\npm.cmd" set "NODE_DIR=%%~fD"

  if not defined NODE_DIR goto unsupported_node

  set "PATH=!NODE_DIR!;%PATH%"
  set "NODE_CMD=!NODE_DIR!\node.exe"
)

set "ACTIVE_NODE_MAJOR="
for /f "usebackq delims=" %%A in (`node -p "process.versions.node.split('.')[0]" 2^>nul`) do set "ACTIVE_NODE_MAJOR=%%A"
if not defined ACTIVE_NODE_MAJOR goto unsupported_node
if !ACTIVE_NODE_MAJOR! LSS 20 goto unsupported_node
if !ACTIVE_NODE_MAJOR! GEQ 25 goto unsupported_node

pushd "%SCRIPT_DIR%"
"%NODE_CMD%" "%SCRIPT_DIR%start.js"
set "EXIT_CODE=%ERRORLEVEL%"
popd

exit /b %EXIT_CODE%

:unsupported_node
echo This project needs Node.js 20-24.
if defined NODE_VERSION (
  echo Current Node.js: %NODE_VERSION%
) else (
  echo Node.js was not found on PATH.
)
echo Install a supported Node.js version or add one to nvm, then run this launcher again.
exit /b 1
