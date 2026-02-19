#Requires -Version 5.1
<#
.SYNOPSIS
    Auto-update om-cli binary from the ObjectModel source repo.
    Pulls latest, rebuilds, and stages changes in FDE repo.

.DESCRIPTION
    Called automatically by the pre-push git hook, or run manually:
      powershell -ExecutionPolicy Bypass -File tools/update-om-cli.ps1

    First run clones the ObjectModel repo. Subsequent runs pull latest.
    Only rebuilds if the source has changed since the last build.

.NOTES
    Requires: .NET 10 SDK, git access to msazure.visualstudio.com/CCI/_git/ObjectModel
#>

param(
    [switch]$Force,        # Rebuild even if no source changes
    [switch]$SkipStage     # Don't git-add the result
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
# Check multiple locations for ObjectModel source
$omSourceCandidates = @(
    (Join-Path $env:USERPROFILE 'Source\ObjectModel'),
    (Join-Path $env:USERPROFILE 'Downloads\ObjectModel')
)
# Pick first candidate that has the CLI project file
$omSourceDir = $omSourceCandidates | Where-Object { Test-Path (Join-Path $_ $cliProject) } | Select-Object -First 1
if (-not $omSourceDir) { $omSourceDir = $omSourceCandidates[0] }  # Default to Source\ for clone
$omCliOutput = Join-Path $repoRoot 'tools\om-cli'
$hashFile = Join-Path $omCliOutput '.source-hash'
$omRepoUrl = 'https://msazure.visualstudio.com/CCI/_git/ObjectModel'
$cliProject = 'src\Cli\ObjectModel.Cli\ObjectModel.Cli.csproj'

function Write-Status($msg) { Write-Host "  [om-cli] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "  [om-cli] $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "  [om-cli] $msg" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# Step 1: Find ObjectModel source
# ---------------------------------------------------------------------------

if (-not (Test-Path $omSourceDir)) {
    # Try to clone if git access is available
    Write-Status "ObjectModel source not found locally. Attempting clone..."
    try {
        git clone $omRepoUrl $omSourceDir 2>&1 | Out-String | Write-Host
        if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
        Write-Ok "Cloned ObjectModel to $omSourceDir"
    } catch {
        Write-Warn "No ObjectModel source found at any of:"
        foreach ($c in $omSourceCandidates) { Write-Warn "  $c" }
        Write-Warn "om-cli binary in repo is still usable (just not updated)."
        Write-Warn "To enable auto-updates: clone or extract ObjectModel source to one of the above paths."
        exit 0
    }
}

Write-Status "Using ObjectModel source at $omSourceDir"

# ---------------------------------------------------------------------------
# Step 2: Pull latest (only if it's a git repo)
# ---------------------------------------------------------------------------

$isGitRepo = Test-Path (Join-Path $omSourceDir '.git')
if ($isGitRepo) {
    Write-Status "Pulling latest ObjectModel..."
    Push-Location $omSourceDir
    try {
        git fetch --quiet 2>$null
        $behind = (git rev-list --count 'HEAD..@{upstream}' 2>$null | Out-String).Trim()
        if ($behind -and $behind -ne '0') {
            git pull --ff-only --quiet 2>&1 | Out-String | Write-Host
            Write-Ok "Pulled $behind new commit(s)"
        } else {
            Write-Status "ObjectModel source already up to date"
        }
    } catch {
        Write-Warn "Could not pull ObjectModel - using existing source"
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Step 3: Check if rebuild needed
# ---------------------------------------------------------------------------

# Get current source fingerprint (git hash or file timestamp)
$currentHash = ''
if ($isGitRepo) {
    try {
        Push-Location $omSourceDir
        $currentHash = (git rev-parse HEAD 2>$null | Out-String).Trim()
    } catch { }
    finally { Pop-Location }
}
if (-not $currentHash) {
    # Not a git repo — use newest .cs/.csproj file's timestamp as change fingerprint
    $newestFile = Get-ChildItem $omSourceDir -Recurse -File -Include '*.cs','*.csproj' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newestFile) {
        $currentHash = $newestFile.LastWriteTime.ToString('yyyyMMddHHmmss')
    } else {
        $currentHash = 'unknown'
    }
}

$lastHash = ''
if (Test-Path $hashFile) {
    $lastHash = (Get-Content $hashFile -Raw).Trim()
}

if (-not $Force -and $currentHash -eq $lastHash -and $lastHash -ne '') {
    Write-Ok "om-cli is current (source: $($currentHash.Substring(0, [Math]::Min(12, $currentHash.Length))))"
    exit 0
}

$lastShort = if ($lastHash.Length -ge 8) { $lastHash.Substring(0,8) } else { $lastHash }
$currShort = if ($currentHash.Length -ge 8) { $currentHash.Substring(0,8) } else { $currentHash }
if ($lastShort) {
    Write-Status "Source changed ($lastShort -> $currShort) - rebuilding..."
} else {
    Write-Status "First build from source ($currShort) - building..."
}

# ---------------------------------------------------------------------------
# Step 4: Build
# ---------------------------------------------------------------------------

$projectPath = Join-Path $omSourceDir $cliProject
if (-not (Test-Path $projectPath)) {
    Write-Warn "CLI project not found at $projectPath"
    Write-Warn "ObjectModel repo structure may have changed. Skipping rebuild."
    exit 0
}

Write-Status "Publishing om-cli..."
try {
    dotnet publish $projectPath `
        --configuration Release `
        --no-self-contained `
        --runtime win-x64 `
        -p:DebugSymbols=false `
        -p:DebugType=None `
        -p:SatelliteResourceLanguages=en `
        --output $omCliOutput 2>&1 | Out-String | Write-Host

    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
} catch {
    Write-Warn "Build failed - om-cli binary in repo is still the previous version."
    exit 0
}

# Write source hash for next comparison
$currentHash | Out-File -FilePath $hashFile -NoNewline -Encoding ascii
Write-Ok "om-cli rebuilt from $($currentHash.Substring(0,8))"

# ---------------------------------------------------------------------------
# Step 5: Stage changes (unless --SkipStage)
# ---------------------------------------------------------------------------

if (-not $SkipStage) {
    Push-Location $repoRoot
    $changes = (git diff --name-only -- tools/om-cli/ 2>$null | Out-String).Trim()
    $untracked = (git ls-files --others --exclude-standard -- tools/om-cli/ 2>$null | Out-String).Trim()

    if ($changes -or $untracked) {
        git add tools/om-cli/ 2>$null
        Write-Ok "Staged om-cli changes (commit with your next push)"
    } else {
        Write-Ok "No binary changes after rebuild"
    }
    Pop-Location
}
