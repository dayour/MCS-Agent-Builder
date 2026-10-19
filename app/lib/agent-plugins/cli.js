"use strict";

const fs = require("fs");
const path = require("path");
const { emitPlugin, pluginNameFromAgent } = require("./generate");
const { importPlugin } = require("./import-plugin");
const { validatePluginDir, formatViolation } = require("./validate");

function readSpec(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    const error = new Error(`cannot read agentspec ${file}: ${err.message}`);
    error.code = "SPEC_READ";
    throw error;
  }
  return parsed;
}

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || index === argv.length - 1) return null;
  return argv[index + 1];
}

function emitCommand(argv) {
  const specPath = argValue(argv, "--spec");
  const outParent = argValue(argv, "--out");
  if (!specPath || !outParent) {
    console.error("usage: manifest emit --spec <agentspec.json> --out <parent-dir>");
    process.exit(1);
  }
  const spec = readSpec(path.resolve(specPath));
  const name = pluginNameFromAgent(spec.agent && spec.agent.name);
  const emitted = emitPlugin(spec, path.join(path.resolve(outParent), name));
  console.log(`emitted ${emitted.outDir}`);
  if (emitted.omitted.length) {
    for (const item of emitted.omitted) console.log(`omitted ${item.name}: ${item.reason}`);
  }
  console.log("manifest: valid");
}

function importCommand(argv) {
  const pluginDir = argValue(argv, "--dir");
  const outFile = argValue(argv, "--out");
  const force = argv.includes("--force");
  if (!pluginDir || !outFile) {
    console.error("usage: manifest import --dir <plugin-dir> --out <agentspec.json> [--force]");
    process.exit(1);
  }
  const imported = importPlugin(path.resolve(pluginDir));
  if (!imported.validation.ok && !force) {
    for (const item of imported.validation.violations) console.error(formatViolation(item));
    console.error("import refused because the plugin is invalid; pass --force to write the agentspec anyway");
    process.exit(1);
  }
  const dest = path.resolve(outFile);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(imported.spec, null, 2)}\n`);
  console.log(`imported ${dest}`);
  console.log(imported.validation.ok ? "manifest: valid" : "manifest: invalid (--force)");
}

function validateCommand(argv) {
  const dirs = argv.filter((arg) => !arg.startsWith("--"));
  if (dirs.length === 0) {
    console.error("usage: manifest validate <plugin-dir>...");
    process.exit(1);
  }
  let failed = false;
  for (const dir of dirs) {
    const result = validatePluginDir(path.resolve(dir));
    if (result.ok) console.log(`valid ${dir}`);
    else {
      failed = true;
      console.error(`invalid ${dir}`);
      for (const item of result.violations) console.error(`  ${formatViolation(item)}`);
    }
  }
  if (failed) process.exit(1);
}

function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === "emit") emitCommand(rest);
    else if (command === "import") importCommand(rest);
    else if (command === "validate") validateCommand(rest);
    else {
      console.error("usage: manifest <emit|import|validate> ...");
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { main };
