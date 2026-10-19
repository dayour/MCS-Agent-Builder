#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { validatePluginDir, formatViolation, REPO_ROOT } = require("../app/lib/agent-plugins/validate");

function listPluginDirs(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs.readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name))
    .sort();
}

function report(dir, result) {
  const label = path.relative(REPO_ROOT, dir) || dir;
  if (result.ok) {
    console.log(`valid ${label}`);
    return;
  }
  console.error(`invalid ${label}`);
  for (const item of result.violations) console.error(`  ${formatViolation(item)}`);
}

function main(argv) {
  const args = argv.slice(2);
  const expectFail = args.includes("--expect-fail");
  const gate = args.includes("--gate") || args.filter((arg) => !arg.startsWith("--")).length === 0;
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (gate && paths.length === 0) {
    const validRoot = path.join(REPO_ROOT, "schema", "fixtures", "valid");
    const invalidRoot = path.join(REPO_ROOT, "schema", "fixtures", "invalid");
    const validDirs = listPluginDirs(validRoot);
    const invalidDirs = listPluginDirs(invalidRoot);
    if (validDirs.length === 0 || invalidDirs.length === 0) {
      console.error("validate:manifests gate requires schema/fixtures/valid and schema/fixtures/invalid");
      process.exit(1);
    }
    let failed = false;
    for (const dir of validDirs) {
      const result = validatePluginDir(dir);
      report(dir, result);
      if (!result.ok) failed = true;
    }
    for (const dir of invalidDirs) {
      const result = validatePluginDir(dir);
      if (result.ok) {
        console.error(`invalid fixture passed: ${path.relative(REPO_ROOT, dir)}`);
        failed = true;
      } else {
        console.log(`rejected ${path.relative(REPO_ROOT, dir)} (${result.violations.map((item) => item.rule).join(", ")})`);
      }
    }
    if (failed) process.exit(1);
    console.log(`manifests: ${validDirs.length} valid, ${invalidDirs.length} invalid rejected`);
    return;
  }
  if (paths.length === 0) {
    console.error("usage: node tools/validate-manifests.js [--gate] [--expect-fail] <plugin-dir>...");
    process.exit(1);
  }
  let failed = false;
  for (const raw of paths) {
    const dir = path.resolve(raw);
    const result = validatePluginDir(dir);
    report(dir, result);
    const bad = expectFail ? result.ok : !result.ok;
    if (bad) failed = true;
  }
  if (failed) process.exit(1);
}

if (require.main === module) main(process.argv);

module.exports = { main };
