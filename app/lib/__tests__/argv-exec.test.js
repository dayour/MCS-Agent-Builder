"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  assertGitRevision,
  assertSolutionName,
  exportPacSolution,
  openInBrowser,
  runNpm,
  runNpx,
  runPowerShellFile,
  runWin32Shim,
} = require("../argv-exec");

function stubSpawn(capture, stdout = "") {
  return (command, args, options) => {
    capture.calls.push({ command, args, options });
    return { status: 0, stdout, stderr: "" };
  };
}

test("assertSolutionName rejects quotes, slashes, and parent segments", () => {
  assert.equal(assertSolutionName("Contoso_Agent"), "Contoso_Agent");
  for (const name of ['bad"name', "a/b", "..", "../x", "has space", "name;calc", ""]) {
    assert.throws(() => assertSolutionName(name), (err) => err.code === "SOLUTION_NAME");
  }
});

test("linux pac export uses an argument array and shell false", () => {
  const capture = { calls: [] };
  exportPacSolution("Contoso_Agent", "/tmp/Contoso_Agent.zip", {
    platform: "linux",
    spawnSync: stubSpawn(capture),
  });
  assert.equal(capture.calls[0].command, "pac");
  assert.deepEqual(capture.calls[0].args, [
    "solution", "export", "--name", "Contoso_Agent", "--path", "/tmp/Contoso_Agent.zip",
    "--managed", "--overwrite",
  ]);
  assert.equal(capture.calls[0].options.shell, false);
  assert.equal(capture.calls[0].options.windowsVerbatimArguments, false);
});

test("win32 pac export runs pac.cmd through cmd.exe after the allowlist", () => {
  const capture = { calls: [] };
  exportPacSolution("Contoso_Agent", "C:\\temp\\Contoso_Agent.zip", {
    platform: "win32",
    spawnSync: stubSpawn(capture),
  });
  assert.equal(capture.calls[0].command, "cmd.exe");
  assert.deepEqual(capture.calls[0].args, [
    "/d", "/s", "/c", "pac.cmd",
    "solution", "export", "--name", "Contoso_Agent", "--path", "C:/temp/Contoso_Agent.zip",
    "--managed", "--overwrite",
  ]);
  assert.equal(capture.calls[0].options.shell, false);
  assert.equal(capture.calls[0].options.windowsVerbatimArguments, true);
});

test("a quoted solution name or a win32 path outside the allowlist does not spawn", () => {
  let spawned = false;
  const spawnSync = () => {
    spawned = true;
    return { status: 0, stdout: "" };
  };
  assert.throws(() => exportPacSolution('Contoso" & calc', "/tmp/x.zip", { platform: "linux", spawnSync }));
  assert.throws(() => exportPacSolution("Contoso_Agent", "C:/Users/A B/x.zip", { platform: "win32", spawnSync }));
  assert.equal(spawned, false);
});

test("linux pac export keeps a path that contains spaces as one argument", () => {
  const capture = { calls: [] };
  exportPacSolution("Contoso_Agent", "/tmp/My Solutions/Contoso_Agent.zip", {
    platform: "linux",
    spawnSync: stubSpawn(capture),
  });
  assert.equal(capture.calls[0].args[5], "/tmp/My Solutions/Contoso_Agent.zip");
  assert.equal(capture.calls[0].options.shell, false);
});

test("npm specs go through npm.cmd on win32 and shell metacharacters do not spawn", () => {
  const capture = { calls: [] };
  runNpm(["install", "-g", "@microsoft/workiq@latest"], {
    platform: "win32",
    spawnSync: stubSpawn(capture),
  });
  assert.equal(capture.calls[0].command, "cmd.exe");
  assert.deepEqual(capture.calls[0].args, [
    "/d", "/s", "/c", "npm.cmd", "install", "-g", "@microsoft/workiq@latest",
  ]);
  assert.equal(capture.calls[0].options.shell, false);

  let spawned = false;
  assert.throws(() => runNpm(["install", "-g", "pkg;calc"], {
    platform: "linux",
    spawnSync() {
      spawned = true;
      return { status: 0, stdout: "" };
    },
  }), (err) => err.code === "NPM_ARG");
  assert.equal(spawned, false);
});

test("npx arguments stay an array", () => {
  const capture = { calls: [] };
  runNpx(["playwright", "test", "--grep", "build"], {
    platform: "linux",
    spawnSync: stubSpawn(capture, "ok"),
  });
  assert.equal(capture.calls[0].command, "npx");
  assert.deepEqual(capture.calls[0].args, ["playwright", "test", "--grep", "build"]);
  assert.equal(capture.calls[0].options.shell, false);
});

test("PowerShell receives the file path as an argument, not script text", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "argv-ps-"));
  const filePath = "C:\\evil'$(calc).xml";
  let seen;
  try {
    runPowerShellFile("param([string]$Path)\nGet-Content -LiteralPath $Path\n", ["-Path", filePath], {
      tmpDir: dir,
      platform: "win32",
      encoding: "utf8",
      execFileSync(command, args, options) {
        seen = { command, args, options, script: fs.readFileSync(args[4], "utf8") };
        return "<xml/>";
      },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(seen.command, "powershell.exe");
  assert.equal(seen.options.shell, false);
  assert.deepEqual(seen.args.slice(0, 4), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]);
  assert.equal(seen.args[5], "-Path");
  assert.equal(seen.args[6], filePath);
  assert.equal(seen.script.includes("calc"), false);
  assert.equal(fs.existsSync(seen.args[4]), false);
});

test("win32 shim quotes a path that contains spaces and rejects metacharacters", () => {
  let seen;
  runWin32Shim("C:\\Users\\A B\\AppData\\Roaming\\npm\\workiq.cmd", ["--version"], {
    execFileSync(command, args, options) {
      seen = { command, args, options };
    },
  });
  assert.equal(seen.command, "cmd.exe");
  assert.deepEqual(seen.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(seen.args[3], '""C:\\Users\\A B\\AppData\\Roaming\\npm\\workiq.cmd"" --version');
  assert.equal(seen.options.shell, false);
  assert.equal(seen.options.windowsVerbatimArguments, true);

  let spawned = false;
  assert.throws(() => runWin32Shim("C:\\temp\\workiq.cmd & calc", ["--version"], {
    execFileSync() { spawned = true; },
  }), (err) => err.code === "CMD_PATH");
  assert.equal(spawned, false);
});

test("openInBrowser passes an https URL as one argument", () => {
  const url = "https://login.microsoftonline.com/common/oauth2?x=1&y=2";
  let seen;
  openInBrowser(url, {
    platform: "win32",
    execFileSync(command, args, options) {
      seen = { command, args, options };
    },
  });
  assert.equal(seen.command, "explorer.exe");
  assert.deepEqual(seen.args, [url]);
  assert.equal(seen.options.shell, false);

  let quoted;
  openInBrowser('https://example.test/a" & calc', {
    platform: "linux",
    execFileSync(command, args, options) {
      quoted = { command, args, options };
    },
  });
  assert.equal(quoted.command, "xdg-open");
  assert.deepEqual(quoted.args, ['https://example.test/a" & calc']);
  assert.equal(quoted.options.shell, false);

  let spawned = false;
  assert.throws(() => openInBrowser("http://example.test/a", {
    platform: "linux",
    execFileSync() { spawned = true; },
  }), (err) => err.code === "BROWSER_URL");
  assert.equal(spawned, false);
});

test("git revisions reject shell metacharacters", () => {
  assert.equal(assertGitRevision("origin/main"), "origin/main");
  assert.throws(() => assertGitRevision("main;id"), (err) => err.code === "GIT_REV");
  assert.throws(() => assertGitRevision("main && id"), (err) => err.code === "GIT_REV");
});
