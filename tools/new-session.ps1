# new-session.ps1 — PowerShell variant of new-session.sh.
#
# Usage:
#   tools\new-session.ps1 <topic> [-Base main]
#
# Args:
#   Topic  Required. Branch name (`wt/<topic>`) and directory name.
#          Must match [a-zA-Z0-9_-]+.
#   -Base  Optional. Defaults to "main".

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Topic,
    [string]$Base = "main"
)

$ErrorActionPreference = "Stop"

if ($Topic -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-Error "topic must match [a-zA-Z0-9_-]+ (got: $Topic)"
    exit 2
}

$Branch = "wt/$Topic"

git rev-parse --verify $Base 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "base branch '$Base' not found"
    exit 3
}

git rev-parse --verify $Branch 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Error "branch '$Branch' already exists. Delete with: git branch -D $Branch"
    exit 4
}

$Root = (git rev-parse --show-toplevel).Trim()
$Parent = Split-Path $Root -Parent
$TreesDir = Join-Path $Parent "Copilot-2-trees"
$WtPath = Join-Path $TreesDir $Topic

if (Test-Path $WtPath) {
    Write-Error "target path already exists: $WtPath"
    exit 5
}

if (-not (Test-Path $TreesDir)) {
    New-Item -ItemType Directory -Path $TreesDir | Out-Null
}

git worktree add -b $Branch $WtPath $Base
if ($LASTEXITCODE -ne 0) {
    Write-Error "git worktree add failed"
    exit 6
}

Write-Host ""
Write-Host "Worktree created."
Write-Host "  path:   $WtPath"
Write-Host "  branch: $Branch"
Write-Host "  base:   $Base"
Write-Host ""
Write-Host "Open Claude in the new worktree:"
Write-Host "  cd `"$WtPath`"; claude"
Write-Host ""
Write-Host "List active worktrees: git worktree list"
Write-Host "Tear down when done:   tools\end-session.ps1 $Topic"
