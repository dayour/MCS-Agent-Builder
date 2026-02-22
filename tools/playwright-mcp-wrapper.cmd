@echo off
REM Playwright MCP Wrapper — closes stale playwright-mcp-edge Edge instances
REM before launching the MCP server. Only kills Edge processes using the
REM playwright-mcp-edge profile; regular Edge windows are never touched.
REM
REM Used by: .claude/settings.json and .mcp.json (playwright MCP server config)

REM Surgical cleanup: find Edge processes with playwright-mcp-edge in command line
REM Uses PowerShell Get-CimInstance for reliable command-line filtering
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" -ErrorAction SilentlyContinue | " ^
  "Where-Object { $_.CommandLine -like '*playwright-mcp-edge*' } | " ^
  "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^
  2>nul

REM Brief pause to release profile lock if processes were killed
timeout /t 1 /nobreak >nul 2>&1

REM Launch Playwright MCP server with all original arguments
npx -y @playwright/mcp@latest --browser msedge --user-data-dir "C:\Users\kimdennis\.playwright-mcp-edge"
