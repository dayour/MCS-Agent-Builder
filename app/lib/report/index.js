/**
 * HTML Report Generator — Public API.
 *
 * renderReport(briefPath, type, opts) -> Promise<string>
 *
 * Generates a self-contained HTML report from a brief.json file.
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

const VALID_TYPES = ["brief", "build", "customer", "deployment"];

/**
 * Render a self-contained HTML report from a brief.json file.
 *
 * @param {string} briefPath - Absolute path to brief.json
 * @param {string} type - Report type: brief | build | customer | deployment
 * @param {object} opts - Optional metadata: { agentName, projectId, agentId }
 * @returns {Promise<string>} Complete HTML string
 */
async function renderReport(briefPath, type = "brief", opts = {}) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid report type '${type}'. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  if (!fs.existsSync(briefPath)) {
    throw new Error(`Brief file not found: ${briefPath}`);
  }

  // 1. Load and transform brief data
  const reportData = loadAndTransform(briefPath, type);

  // 2. Generate SVG charts
  const charts = await generateCharts(reportData, type);

  // 3. Read static assets (cached)
  const css = readCss();
  const js = readJs();

  // 4. Render Nunjucks template
  const templateFile = `${type}.njk`;
  const context = {
    ...reportData,
    charts,
    css,
    js,
  };

  return new Promise((resolve, reject) => {
    env.render(templateFile, context, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports = { renderReport, VALID_TYPES };
