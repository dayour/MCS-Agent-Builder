"use strict";

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { assertCliArg } = require("./az-token");

const SOLUTION_NAME = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;
const GIT_REV = /^[A-Za-z0-9._/-]+$/;
const NPM_SPEC = /^@?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?(?:@[A-Za-z0-9._+-]+)?$/;

function assertSolutionName(value) {
  if (typeof value !== "string" || !SOLUTION_NAME.test(value)) {
    const error = new Error("solutionName must be a single identifier of letters, digits, and underscores");
    error.code = "SOLUTION_NAME";
    throw error;
  }
  return value;
}

function assertGitRevision(value) {
  if (typeof value !== "string" || !GIT_REV.test(value)) {
    const error = new Error("git revision contains a forbidden character");
    error.code = "GIT_REV";
    throw error;
  }
  return value;
}

function assertNpmArg(value) {
  if (typeof value === "string" && (assertCliArgSafe(value) || NPM_SPEC.test(value))) return value;
  const error = new Error("npm argument contains a forbidden character");
  error.code = "NPM_ARG";
  throw error;
}

function assertCliArgSafe(value) {
  try {
    assertCliArg(value);
    return true;
  } catch {
    return false;
  }
}

function spawnChecked(command, args, options, windowsVerbatimArguments) {
  const spawn = (options && options.spawnSync) || spawnSync;
  const result = spawn(command, args, {
    cwd: options && options.cwd,
    encoding: (options && options.encoding) || "utf8",
    timeout: options && options.timeout,
    stdio: (options && options.stdio) || "pipe",
    env: options && options.env,
    shell: false,
    windowsVerbatimArguments: Boolean(windowsVerbatimArguments),
  });
  if (result.error) {
    result.error.stdout = result.stdout;
    result.error.stderr = result.stderr;
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim() || `${command} exited ${result.status}`;
    const error = new Error(detail);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result.stdout;
}

function runDirect(command, args, options) {
  return spawnChecked(command, args, options, false);
}

function runCmdShim(name, args, options) {
  const platform = (options && options.platform) || process.platform;
  const safeArgs = args.map(assertCliArg);
  if (platform === "win32") {
    return spawnChecked("cmd.exe", ["/d", "/s", "/c", `${name}.cmd`, ...safeArgs], options, true);
  }
  return spawnChecked(name, safeArgs, options, false);
}

function assertPacZipPath(zipPath) {
  if (typeof zipPath !== "string" || zipPath.length === 0 || /["%!\^\0\r\n]/.test(zipPath)) {
    const error = new Error("pac solution export path contains a forbidden character");
    error.code = "SOLUTION_PATH";
    throw error;
  }
  return zipPath;
}

function assertPid(value) {
  const text = String(value == null ? "" : value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    const error = new Error("pid must be a positive integer");
    error.code = "PID";
    throw error;
  }
  return text;
}

function assertPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error("port must be an integer from 1 to 65535");
    error.code = "PORT";
    throw error;
  }
  return port;
}

function exportPacSolution(solutionName, zipPath, options) {
  const name = assertSolutionName(solutionName);
  const zip = assertPacZipPath(zipPath);
  const platform = (options && options.platform) || process.platform;
  if (platform === "win32") {
    const commandLine = [
      "pac.cmd", "solution", "export", "--name", name, "--path", `"${zip}"`, "--managed", "--overwrite",
    ].join(" ");
    return spawnChecked("cmd.exe", ["/d", "/s", "/c", commandLine], options, true);
  }
  return runDirect("pac", ["solution", "export", "--name", name, "--path", zip, "--managed", "--overwrite"], options);
}

function runNpm(args, options) {
  const platform = (options && options.platform) || process.platform;
  const safeArgs = args.map(assertNpmArg);
  if (platform === "win32") {
    return spawnChecked("cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...safeArgs], options, true);
  }
  return spawnChecked("npm", safeArgs, options, false);
}

function runNpx(args, options) {
  return runCmdShim("npx", args, options);
}

function powershellExecutable(platform) {
  return platform === "win32" ? "powershell.exe" : "powershell";
}

function runPowerShellFile(scriptBody, scriptArgs, options) {
  const execFile = (options && options.execFileSync) || execFileSync;
  const platform = (options && options.platform) || process.platform;
  const dir = (options && options.tmpDir) || os.tmpdir();
  const psTempFile = path.join(dir, `mcs-ps-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`);
  fs.writeFileSync(psTempFile, scriptBody, "utf8");
  try {
    return execFile(powershellExecutable(platform), [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", psTempFile,
      ...(scriptArgs || []),
    ], {
      encoding: options && options.encoding,
      stdio: (options && options.stdio) || ["pipe", "pipe", "pipe"],
      timeout: (options && options.timeout) || 30000,
      shell: false,
      env: options && options.env,
    });
  } finally {
    try { fs.unlinkSync(psTempFile); } catch { /* best effort */ }
  }
}

function runWin32Shim(cmdPath, args, options) {
  if (typeof cmdPath !== "string" || cmdPath.length === 0 || /["&|<>^%!\r\n]/.test(cmdPath)) {
    const error = new Error("command path contains a forbidden character");
    error.code = "CMD_PATH";
    throw error;
  }
  const safeArgs = (args || []).map(assertCliArg);
  const commandLine = `""${cmdPath}""${safeArgs.length ? ` ${safeArgs.join(" ")}` : ""}`;
  const execFile = (options && options.execFileSync) || execFileSync;
  return execFile("cmd.exe", ["/d", "/s", "/c", commandLine], {
    encoding: options && options.encoding,
    stdio: (options && options.stdio) || "ignore",
    timeout: (options && options.timeout) || 5000,
    shell: false,
    windowsVerbatimArguments: true,
  });
}

function openInBrowser(url, options) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url) || /[\0\r\n]/.test(url)) {
    const error = new Error("browser URL must be https");
    error.code = "BROWSER_URL";
    throw error;
  }
  const platform = (options && options.platform) || process.platform;
  const command = platform === "win32" ? "explorer.exe" : platform === "darwin" ? "open" : "xdg-open";
  const execFile = (options && options.execFileSync) || execFileSync;
  try {
    return execFile(command, [url], {
      stdio: "ignore",
      timeout: 15000,
      shell: false,
    });
  } catch (err) {
    if (command === "explorer.exe" && err && err.status === 1) return "";
    throw err;
  }
}

module.exports = {
  assertGitRevision,
  assertNpmArg,
  assertPacZipPath,
  assertPid,
  assertPort,
  assertSolutionName,
  exportPacSolution,
  openInBrowser,
  runNpm,
  runNpx,
  runPowerShellFile,
  runWin32Shim,
};
