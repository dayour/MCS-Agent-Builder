@echo off
REM MCS Agent Builder — Windows Setup & Start
REM Checks and installs prerequisites, then launches the dashboard.
REM Run this instead of "mcs start" on first install.

setlocal EnableDelayedExpansion

echo.
echo   MCS Agent Builder - Setup
echo   ========================
echo.

REM ---------------------------------------------------------------------------
REM 1. Check Node.js
REM ---------------------------------------------------------------------------

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [!] Node.js not found. Installing via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% neq 0 (
        echo   [X] Failed to install Node.js. Install manually: https://nodejs.org
        pause
        exit /b 1
    )
    echo   [OK] Node.js installed. Please restart this script in a new terminal.
    pause
    exit /b 0
)

for /f "tokens=1 delims=v" %%v in ('node -v') do set NODE_VER=%%v
echo   [OK] Node.js %NODE_VER%

REM ---------------------------------------------------------------------------
REM 2. Check Git
REM ---------------------------------------------------------------------------

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [!] Git not found. Installing via winget...
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% neq 0 (
        echo   [X] Failed to install Git. Install manually: https://git-scm.com
    ) else (
        echo   [OK] Git installed. Restart this script in a new terminal for PATH update.
        pause
        exit /b 0
    )
) else (
    echo   [OK] Git found
)

REM ---------------------------------------------------------------------------
REM 3. Check Python
REM ---------------------------------------------------------------------------

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [!] Python not found. Installing via winget...
    winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% neq 0 (
        echo   [~] Python install failed. Optional — YAML validation won't work.
    ) else (
        echo   [OK] Python installed
    )
) else (
    echo   [OK] Python found
)

REM ---------------------------------------------------------------------------
REM 4. Check Azure CLI
REM ---------------------------------------------------------------------------

where az >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [!] Azure CLI not found. Installing via winget...
    winget install Microsoft.AzureCLI --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% neq 0 (
        echo   [~] Azure CLI install failed. Required for building agents.
        echo       Install manually: https://aka.ms/installazurecliwindows
    ) else (
        echo   [OK] Azure CLI installed
    )
) else (
    echo   [OK] Azure CLI found
)

REM ---------------------------------------------------------------------------
REM 5. Check GitHub CLI (optional — for GPT-5.5 reviews)
REM ---------------------------------------------------------------------------

where gh >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [~] GitHub CLI not found. Optional — needed for GPT-5.5 dual reviews.
    echo       Install: winget install GitHub.cli
) else (
    echo   [OK] GitHub CLI found
)

REM ---------------------------------------------------------------------------
REM 6. Check Claude Code
REM ---------------------------------------------------------------------------

where claude >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%USERPROFILE%\.claude-cli" (
        echo   [OK] Claude Code found (native install)
    ) else (
        echo   [!] Claude Code not found. Installing...
        npm install -g @anthropic-ai/claude-code
        if %ERRORLEVEL% neq 0 (
            echo   [X] Claude Code install failed.
            echo       Install manually: npm install -g @anthropic-ai/claude-code
        ) else (
            echo   [OK] Claude Code installed
        )
    )
) else (
    echo   [OK] Claude Code found
)

REM ---------------------------------------------------------------------------
REM 7. Install npm dependencies
REM ---------------------------------------------------------------------------

if not exist "node_modules" (
    echo.
    echo   Installing dependencies...
    call npm install
)

REM ---------------------------------------------------------------------------
REM 8. Launch
REM ---------------------------------------------------------------------------

echo.
echo   Setup complete. Starting dashboard...
echo.

call npm start
