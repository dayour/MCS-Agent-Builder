#!/usr/bin/env node
/**
 * diagnose-direct-line.js — report bot.configuration structure WITHOUT dumping
 * sensitive values. Helps pick between GPT's H1/H2/H3 for the missing
 * Direct Line token endpoint without exposing live bot config to the
 * conversation transcript.
 *
 * What it prints:
 *   - total number of top-level configuration keys
 *   - sensitive-looking keys masked
 *   - every path/key containing 'direct', 'line', 'token', 'endpoint', or 'channel'
 *     (case-insensitive) — WITH TYPE, NOT VALUE
 *   - value TYPE + length for each matched path (so we see "exists but string",
 *     "array with 3 items", etc.) but NOT the string content
 *
 * Usage:
 *   node tools/diagnose-direct-line.js --project <p> --agent <a>
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { httpRequestWithRetry } = require("./lib/http");

const REPO_ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function argVal(n) { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; }
const PROJECT = argVal("--project");
const AGENT = argVal("--agent");

if (!PROJECT || !AGENT) {
  console.error("Usage: diagnose-direct-line.js --project <name> --agent <name>");
  process.exit(2);
}

const specPath = path.join(REPO_ROOT, "Build-Guides", PROJECT, "agents", AGENT, "agentspec.json");
if (!fs.existsSync(specPath)) { console.error(`agentspec not found: ${specPath}`); process.exit(1); }
const brief = JSON.parse(fs.readFileSync(specPath, "utf8"));
const botId = brief.buildStatus?.mcsAgentId;
const envUrl = brief.buildStatus?.dataverseUrl || brief.buildStatus?.orgUrl;
if (!botId || !envUrl) { console.error("brief.buildStatus missing mcsAgentId or dataverseUrl"); process.exit(1); }

async function main() {
  console.log(`[diagnose] Target: bot ${botId} on ${envUrl}`);

  // Acquire Dataverse token via az (no live config dumped to stdout)
  const token = execSync(`az account get-access-token --resource "${envUrl}" --query accessToken -o tsv`, { encoding: "utf8", timeout: 15000 }).trim();

  const resp = await httpRequestWithRetry("GET",
    `${envUrl}/api/data/v9.2/bots(${botId})`,
    { Authorization: `Bearer ${token}`, "OData-MaxVersion": "4.0", "OData-Version": "4.0" });
  const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;

  console.log(`[diagnose] Response HTTP ${resp.status}`);
  if (resp.status !== 200) { console.error(data); process.exit(1); }

  const config = typeof data.configuration === "string" ? JSON.parse(data.configuration) : (data.configuration || {});

  // Top-level shape — keys only
  const topKeys = Object.keys(config).sort();
  console.log(`\n[diagnose] Top-level configuration keys (${topKeys.length}):`);
  topKeys.forEach((k) => {
    const v = config[k];
    const type = Array.isArray(v) ? `array[${v.length}]` : typeof v === "object" && v ? `object{${Object.keys(v).length}}` : typeof v;
    console.log(`  ${k.padEnd(40)} ${type}`);
  });

  // Scan ALL bot row columns for anything direct-line-related (column names only, values masked)
  const dlCols = Object.keys(data).filter((k) => /direct|line|token|endpoint|channel/i.test(k));
  console.log(`\n[diagnose] bot row columns matching direct/line/token/endpoint/channel (${dlCols.length}):`);
  dlCols.forEach((k) => {
    const v = data[k];
    const desc = v == null ? "<null>" : typeof v === "string" ? `string len=${v.length}` : typeof v;
    console.log(`  ${k.padEnd(40)} ${desc}`);
  });

  // Deep search for direct/line/token/endpoint/channel keys — paths only, values masked
  console.log(`\n[diagnose] Deep key search (paths containing direct|line|token|endpoint|channel, case-insensitive):`);
  const hits = [];
  function walk(node, pathStr = "$") {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${pathStr}[${i}]`));
      return;
    }
    if (typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      const lower = k.toLowerCase();
      if (/direct|line|token|endpoint|channel/.test(lower)) {
        const v = node[k];
        const type = Array.isArray(v) ? `array[${v.length}]` : typeof v === "object" && v ? `object{keys=${Object.keys(v).slice(0, 5).join(",")}}` : typeof v;
        const valueHint = typeof v === "string" ? `len=${v.length}, starts='${v.slice(0, 8).replace(/./g, "_")}...'` : "";
        hits.push({ path: `${pathStr}.${k}`, type, valueHint });
      }
      walk(node[k], `${pathStr}.${k}`);
    }
  }
  walk(config);
  if (hits.length === 0) {
    console.log("  (no matches — Direct Line likely not provisioned, per GPT hypothesis H1)");
  } else {
    hits.forEach((h) => console.log(`  ${h.path.padEnd(60)} ${h.type} ${h.valueHint}`));
  }

  // Try the PvaGetDirectLineEndpoint bound action (what the PowerShell helper uses)
  console.log(`\n[diagnose] Testing PvaGetDirectLineEndpoint bound action...`);
  try {
    const boundResp = await httpRequestWithRetry("POST",
      `${envUrl}/api/data/v9.2/bots(${botId})/Microsoft.Dynamics.CRM.PvaGetDirectLineEndpoint`,
      { Authorization: `Bearer ${token}`, "OData-MaxVersion": "4.0", "OData-Version": "4.0", "Content-Type": "application/json" },
      "{}");
    console.log(`  HTTP ${boundResp.status}`);
    const bd = typeof boundResp.data === "string" ? JSON.parse(boundResp.data) : (boundResp.data || {});
    const keys = Object.keys(bd);
    console.log(`  Response keys: ${keys.join(", ")}`);
    keys.forEach((k) => {
      const v = bd[k];
      const desc = v == null ? "<null>" : typeof v === "string" ? `string len=${v.length}` : typeof v === "object" ? `object{${Object.keys(v).length}}` : typeof v;
      console.log(`    ${k.padEnd(30)} ${desc}`);
    });
    if (boundResp.status === 200 && (bd.endpointUrl || bd.EndpointUrl || bd.tokenEndpoint || bd.TokenEndpoint)) {
      console.log(`\n[diagnose] CONCLUSION: PvaGetDirectLineEndpoint works. Fix eval-pipeline.js to call this bound action when the PowerShell helper falls through. Channel IS provisioned.`);
    } else if (boundResp.status === 200) {
      console.log(`\n[diagnose] CONCLUSION: Bound action returns 200 but unknown shape. Inspect response keys above and update eval-pipeline to read the right field.`);
    } else {
      console.log(`\n[diagnose] CONCLUSION: Bound action returned ${boundResp.status} — channel likely not provisioned.`);
    }
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(`\n[diagnose] CONCLUSION: Bound action failed. Likely H1 — Direct Line channel not provisioned. Need to HAR-capture the MCS UI enable-channel action.`);
  }

  // Conclusion
  console.log(`\n[diagnose] Top-level interpretation:`);
  const hasChannels = "channels" in config;
  const channelsArr = Array.isArray(config.channels) ? config.channels : [];
  console.log(`  configuration.channels: ${hasChannels ? `present (array[${channelsArr.length}])` : "absent"}`);
  const hasDirectLineHit = hits.some((h) => /direct/i.test(h.path));
  console.log(`  direct-line references: ${hasDirectLineHit ? "FOUND (H2: path mismatch — see paths above)" : "ABSENT (H1: channel not provisioned)"}`);
  console.log(`  additionaltokenendpointurl column: ${data.additionaltokenendpointurl ? "SET (Dataverse-level token endpoint — worth trying)" : "null"}`);
}

main().catch((err) => { console.error("[diagnose]", err.message); process.exit(1); });
