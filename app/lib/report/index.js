/**
 * HTML Report Generator — Public API.
 *
 * renderReport(briefPath, type, opts) -> Promise<string>
 *
 * Generates a self-contained HTML report from an agentspec.json file.
 * All CSS, JS, and SVG charts are inlined into a single HTML document.
 */
const fs = require("fs");
const path = require("path");
const { env } = require("./engine");
const { loadAndTransform } = require("./data");
const { generateCharts } = require("./charts");

const STATIC_DIR = path.join(__dirname, "static");

// Cache static assets after first read (they don't change at runtime)
let _css = null;
let _js = null;

function readCss() {
  if (!_css) _css = fs.readFileSync(path.join(STATIC_DIR, "report.css"), "utf-8");
  return _css;
}

function readJs() {
  if (!_js) _js = fs.readFileSync(path.join(STATIC_DIR, "report.js"), "utf-8");
  return _js;
}

/**
 * Render a self-contained HTML export from an agentspec.json file.
 * Single combined report with tabs: Agent Spec, Evaluations, How-To Guide.
 *
 * @param {string} briefPath - Absolute path to agentspec.json (or brief.json)
 * @param {object} opts - Optional metadata: { agentName, projectId, agentId }
 * @returns {Promise<string>} Complete HTML string
 */
async function renderReport(briefPath, opts = {}) {
  if (!fs.existsSync(briefPath)) {
    throw new Error(`Agent spec file not found: ${briefPath}`);
  }

  // 1. Load and transform brief data
  const reportData = loadAndTransform(briefPath);

  // 2. Generate SVG charts (all chart types for combined export)
  const charts = await generateCharts(reportData, "brief");

  // 3. Read static assets (cached)
  const css = readCss();
  const js = readJs();

  // 4. Render combined export template
  const context = {
    ...reportData,
    charts,
    css,
    js,
  };

  return new Promise((resolve, reject) => {
    env.render("export.njk", context, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports = { renderReport };
