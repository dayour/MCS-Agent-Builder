"use strict";

const Module = require("module");
const path = require("path");

const VENDOR = path.resolve(__dirname, "..", "..", "..", "tools", "vendor", "ajv-runtime");
const AJV_ROOT = path.join(VENDOR, "ajv");

/**
 * Ajv's published build requires its runtime dependencies by package name.
 * Those packages live next to ajv under tools/vendor/ajv-runtime/ (not inside
 * a node_modules directory, which this repo gitignores). Prepend that
 * directory only while the first load resolves those packages, then restore
 * Node's resolver so the process-wide path list is unchanged.
 */
function loadAjv2020() {
  const original = Module._nodeModulePaths;
  Module._nodeModulePaths = function resolveVendor(from) {
    const paths = original.call(this, from);
    const normalized = String(from).split(path.sep).join("/");
    if (normalized.includes("/tools/vendor/ajv-runtime/")) paths.unshift(VENDOR);
    return paths;
  };
  try {
    return require(path.join(AJV_ROOT, "dist", "2020.js"));
  } finally {
    Module._nodeModulePaths = original;
  }
}

module.exports = { loadAjv2020, VENDOR, AJV_ROOT };
