/**
 * Server-side SVG chart generation using Observable Plot + JSDOM.
 * Each function returns an SVG string (or HTML fallback for no-data).
 */
const { JSDOM } = require("jsdom");

let _plot = null;
async function getPlot() {
  if (!_plot) _plot = await import("@observablehq/plot");
  return _plot;
}

function createDocument() {
  return new JSDOM("<!DOCTYPE html><html><body></body></html>").window.document;
}

// ── Colors (matching report.css palette) ────────────────────────

const COLORS = {
  primary: "#3B82F6", green: "#16A34A", amber: "#D97706", red: "#DC2626",
  muted: "#94A3B8", border: "#E2E8F0", surface: "#F8FAFC",
  primaryLight: "#DBEAFE", greenLight: "#DCFCE7", amberLight: "#FEF3C7", redLight: "#FEE2E2",
};

// ── Readiness Gauge (SVG donut ring) ────────────────────────────

function renderReadinessGauge(readiness) {
  if (readiness == null) return noData("Readiness");
  const pct = Math.max(0, Math.min(100, readiness));
  const r = 40, cx = 50, cy = 50, stroke = 8;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const color = pct >= 80 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red;

  return `<svg width="120" height="120" viewBox="0 0 100 100" class="chart-gauge">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLORS.border}" stroke-width="${stroke}" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})" />
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" font-weight="700" fill="${color}">${pct}%</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="8" fill="${COLORS.muted}">Readiness</text>
  </svg>`;
}

// ── Capabilities Phase Chart (horizontal bars) ──────────────────

async function renderCapabilitiesChart(capabilities) {
  if (!capabilities?.length) return noData("Capabilities");
  const Plot = await getPlot();
  const document = createDocument();

  const mvp = capabilities.filter(c => c.phase === "MVP").length;
  const future = capabilities.filter(c => c.phase === "Future").length;
  const data = [
    { phase: "MVP", count: mvp },
    { phase: "Future", count: future },
  ].filter(d => d.count > 0);

  if (data.length === 0) return noData("Capabilities");

  const chart = Plot.plot({
    document,
    width: 320, height: 100,
    marginLeft: 60, marginRight: 40, marginTop: 10, marginBottom: 20,
    x: { label: null, grid: true },
    y: { label: null, domain: data.map(d => d.phase) },
    color: { domain: ["MVP", "Future"], range: [COLORS.primary, COLORS.muted] },
    marks: [
      Plot.barX(data, { x: "count", y: "phase", fill: "phase", rx: 4 }),
      Plot.text(data, { x: "count", y: "phase", text: d => String(d.count), dx: 14, fontSize: 12, fontWeight: 600 }),
    ],
  });
  return chart.outerHTML;
}

// ── Eval Pass Rate Chart (bars per set) ─────────────────────────

async function renderEvalChart(evalSets) {
  if (!evalSets?.length) return noData("Evaluation");
  const Plot = await getPlot();
  const document = createDocument();

  const data = evalSets
    .filter(s => s.tests?.length > 0)
    .map(s => {
      const tested = s.tests.filter(t => t.lastResult != null);
      const passed = tested.filter(t => t.lastResult?.pass).length;
      const rate = tested.length > 0 ? Math.round((passed / tested.length) * 100) : null;
      return { name: s.name, passRate: rate, threshold: s.passThreshold, total: s.tests.length, tested: tested.length };
    });

  if (data.length === 0 || data.every(d => d.passRate == null)) return noData("Evaluation");

  const barData = data.filter(d => d.passRate != null);

  const chart = Plot.plot({
    document,
    width: 400, height: 40 + barData.length * 50,
    marginLeft: 90, marginRight: 60, marginTop: 10, marginBottom: 30,
    x: { label: "Pass rate %", domain: [0, 100], grid: true },
    y: { label: null, domain: barData.map(d => d.name) },
    marks: [
      // Threshold markers
      Plot.ruleX(barData, { x: "threshold", y: "name", stroke: COLORS.muted, strokeDasharray: "4,3", strokeWidth: 1.5 }),
      // Bars
      Plot.barX(barData, {
        x: "passRate", y: "name", rx: 4,
        fill: d => d.passRate >= d.threshold ? COLORS.green : d.passRate >= d.threshold * 0.7 ? COLORS.amber : COLORS.red,
      }),
      // Labels
      Plot.text(barData, { x: "passRate", y: "name", text: d => `${d.passRate}%`, dx: 16, fontSize: 11, fontWeight: 600 }),
    ],
  });
  return chart.outerHTML;
}

// ── Integration Auth Chart (horizontal bars) ────────────────────

async function renderAuthChart(integrations) {
  if (!integrations?.length) return noData("Integrations");
  const Plot = await getPlot();
  const document = createDocument();

  const authCounts = {};
  for (const i of integrations) {
    const auth = i.auth || "None";
    authCounts[auth] = (authCounts[auth] || 0) + 1;
  }
  const data = Object.entries(authCounts).map(([auth, count]) => ({ auth, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) return noData("Integrations");

  const chart = Plot.plot({
    document,
    width: 320, height: 30 + data.length * 30,
    marginLeft: 100, marginRight: 40, marginTop: 10, marginBottom: 20,
    x: { label: null, grid: true },
    y: { label: null, domain: data.map(d => d.auth) },
    marks: [
      Plot.barX(data, { x: "count", y: "auth", fill: COLORS.primary, rx: 4 }),
      Plot.text(data, { x: "count", y: "auth", text: d => String(d.count), dx: 12, fontSize: 11, fontWeight: 600 }),
    ],
  });
  return chart.outerHTML;
}

// ── Generate all charts for a report ────────────────────────────

async function generateCharts(reportData, type) {
  const charts = {};

  charts.readiness_gauge = renderReadinessGauge(reportData.metrics.readiness);

  try { charts.capabilities_phase = await renderCapabilitiesChart(reportData.capabilities); }
  catch { charts.capabilities_phase = noData("Capabilities"); }

  try { charts.eval_pass_rate = await renderEvalChart(reportData.evalSets); }
  catch { charts.eval_pass_rate = noData("Evaluation"); }

  if (type === "brief" || type === "deployment") {
    try { charts.integration_auth = await renderAuthChart(reportData.integrations); }
    catch { charts.integration_auth = noData("Integrations"); }
  }

  return charts;
}

function noData(label) {
  return `<div class="chart-empty"><span>No ${label.toLowerCase()} data available</span></div>`;
}

module.exports = { generateCharts, renderReadinessGauge, renderCapabilitiesChart, renderEvalChart, renderAuthChart };
