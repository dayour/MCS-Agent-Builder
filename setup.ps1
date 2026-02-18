#Requires -Version 5.1
<#
.SYNOPSIS
    MCS Agent Builder — Zero-prereq bootstrap.
    Installs all dependencies via winget/npm/pip, then launches the dashboard.
    Safe to re-run: upgrades existing tools, installs missing ones, skips current.

.NOTES
    Run via setup.cmd (double-click) or: powershell -ExecutionPolicy Bypass -File setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'
$script:ExitCode = 0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step  { param([string]$msg) Write-Host "  [setup] " -ForegroundColor Cyan -NoNewline; Write-Host $msg }
function Write-Ok    { param([string]$msg) Write-Host "  [  ok ] " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Warn  { param([string]$msg) Write-Host "  [ warn] " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err   { param([string]$msg) Write-Host "  [error] " -ForegroundColor Red -NoNewline; Write-Host $msg }

function Test-Cmd {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Refresh-Path {
    # Reload PATH from registry so newly-installed tools are immediately available
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Install-Winget {
    param(
        [string]$PackageId,
        [string]$DisplayName,
        [switch]$Optional
    )

    Write-Step "Checking $DisplayName..."

    # Check if winget is available
    if (-not (Test-Cmd 'winget')) {
        if ($Optional) {
            Write-Warn "winget not available — skipping $DisplayName (optional)"
            return
        }
        Write-Err "winget not available — cannot install $DisplayName"
        Write-Err "Install winget from the Microsoft Store (App Installer) and re-run setup.cmd"
        $script:ExitCode = 1
        return
    }

    # Check if already installed
    $listOutput = & winget list --id $PackageId --accept-source-agreements 2>&1 | Out-String
    if ($listOutput -match [regex]::Escape($PackageId)) {
        # Already installed — try upgrade (no-ops if current)
        Write-Step "  $DisplayName found — checking for updates..."
        $upgradeOutput = & winget upgrade --id $PackageId --accept-package-agreements --accept-source-agreements 2>&1 | Out-String
        if ($upgradeOutput -match 'No applicable update found' -or $upgradeOutput -match 'No installed package found') {
            Write-Ok "$DisplayName is up to date"
        } elseif ($LASTEXITCODE -eq 0) {
            Refresh-Path
            Write-Ok "$DisplayName updated"
        } else {
            Write-Warn "$DisplayName upgrade returned non-zero — may already be current"
        }
    } else {
        # Not installed — install fresh
        Write-Step "  Installing $DisplayName..."
        $installArgs = @('install', '--id', $PackageId, '--accept-package-agreements', '--accept-source-agreements')

        # Use --scope user when possible (no admin needed), except for packages that require machine scope
        $machineOnly = @('Microsoft.DotNet.SDK.8')
        if ($PackageId -notin $machineOnly) {
            $installArgs += '--scope'
            $installArgs += 'user'
        }

        & winget @installArgs 2>&1 | Out-String | Write-Host
        if ($LASTEXITCODE -ne 0) {
            if ($Optional) {
                Write-Warn "Could not install $DisplayName (optional) — continuing"
                return
            }
            Write-Err "Failed to install $DisplayName"
            $script:ExitCode = 1
            return
        }
        Refresh-Path
        Write-Ok "$DisplayName installed"
    }
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  MCS Agent Builder — Setup" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Phase 1: Core tools via winget (dependency order)
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  Phase 1: Core tools" -ForegroundColor Cyan
Write-Host "  -------------------"

Install-Winget -PackageId 'Git.Git'            -DisplayName 'Git'
Install-Winget -PackageId 'OpenJS.NodeJS.LTS'  -DisplayName 'Node.js LTS'
Install-Winget -PackageId 'Python.Python.3.12' -DisplayName 'Python 3.12'

# Refresh PATH after Phase 1 to pick up node/python/git
Refresh-Path

# Verify critical tools are now available
$criticalMissing = @()
if (-not (Test-Cmd 'node'))   { $criticalMissing += 'Node.js' }
if (-not (Test-Cmd 'python')) { $criticalMissing += 'Python' }
if (-not (Test-Cmd 'git'))    { $criticalMissing += 'Git' }

if ($criticalMissing.Count -gt 0) {
    Write-Err "The following critical tools are not available after install: $($criticalMissing -join ', ')"
    Write-Err "You may need to close and re-open this terminal, then run setup.cmd again."
    Read-Host "Press Enter to exit"
    exit 1
}

# ---------------------------------------------------------------------------
# Phase 2: Claude Code via npm
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  Phase 2: Claude Code" -ForegroundColor Cyan
Write-Host "  --------------------"

Write-Step "Checking Claude Code..."
$claudeInstalled = $false

# Check native installation
$claudeCliDir = Join-Path $env:USERPROFILE '.claude-cli'
if (Test-Path $claudeCliDir) {
    $versions = Get-ChildItem $claudeCliDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name
    if ($versions) {
        $latest = $versions[-1]
        if (Test-Path (Join-Path $latest.FullName 'claude.exe')) {
            $claudeInstalled = $true
            Write-Ok "Claude Code found (native: $($latest.Name))"
        }
    }
}

# Check npm global installation
if (-not $claudeInstalled) {
    $npmCli = Join-Path $env:USERPROFILE 'AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js'
    if (Test-Path $npmCli) {
        $claudeInstalled = $true
        Write-Ok "Claude Code found (npm global)"
    }
}

# Check PATH
if (-not $claudeInstalled -and (Test-Cmd 'claude')) {
    $claudeInstalled = $true
    Write-Ok "Claude Code found (PATH)"
}

if (-not $claudeInstalled) {
    Write-Step "Installing Claude Code via npm..."
    & npm install -g @anthropic-ai/claude-code 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -eq 0) {
        Refresh-Path
        Write-Ok "Claude Code installed"
    } else {
        Write-Warn "Claude Code install failed — dashboard will work but the embedded terminal won't."
        Write-Warn "Install manually: npm install -g @anthropic-ai/claude-code"
    }
} else {
    # Try updating
    Write-Step "Checking for Claude Code updates..."
    & npm update -g @anthropic-ai/claude-code 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Claude Code is up to date"
    }
}

# ---------------------------------------------------------------------------
# Phase 3: Python packages via pip
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  Phase 3: Python packages" -ForegroundColor Cyan
Write-Host "  ------------------------"

Write-Step "Checking Python packages..."
$pipPackages = 'fastapi', 'uvicorn', 'multipart', 'markitdown'
$missing = @()
foreach ($pkg in $pipPackages) {
    try {
        & python -c "import $pkg" 2>$null
        if ($LASTEXITCODE -ne 0) { $missing += $pkg }
    } catch {
        $missing += $pkg
    }
}

if ($missing.Count -eq 0) {
    Write-Ok "All Python packages present"
} else {
    Write-Step "Installing Python packages..."
    & pip install fastapi uvicorn python-multipart "markitdown[all]" 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Python packages installed"
    } else {
        Write-Err "pip install failed. Run manually: pip install fastapi uvicorn python-multipart `"markitdown[all]`""
        $script:ExitCode = 1
    }
}

# ---------------------------------------------------------------------------
# Phase 4: Optional tools
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  Phase 4: Optional tools" -ForegroundColor Cyan
Write-Host "  -----------------------"

Install-Winget -PackageId 'Microsoft.AzureCLI'     -DisplayName 'Azure CLI'     -Optional
Install-Winget -PackageId 'Microsoft.DotNet.SDK.8'  -DisplayName '.NET SDK 8'    -Optional

# ---------------------------------------------------------------------------
# npm install (project dependencies)
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  Phase 5: Project dependencies" -ForegroundColor Cyan
Write-Host "  -----------------------------"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Step "Installing npm packages..."
Push-Location $scriptDir
try {
    & npm install 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "npm packages installed"
    } else {
        Write-Warn "npm install had issues — dashboard may still work"
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# Summary & Launch
# ---------------------------------------------------------------------------

Write-Host ""
if ($script:ExitCode -ne 0) {
    Write-Err "Setup completed with errors — check messages above."
    Read-Host "Press Enter to exit"
    exit $script:ExitCode
}

Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Step "Launching MCS Agent Builder..."
Write-Host ""

Push-Location $scriptDir
try {
    & npm start
} finally {
    Pop-Location
}
