/**
 * build-knowledge-index.js — Compiles all knowledge cache files, frameworks,
 * patterns, and eval scenarios into a single structured JSON index.
 *
 * Usage:  node tools/build-knowledge-index.js [--output <path>]
 * Output: knowledge/index.json (default)
 *
 * Run manually when cache files change. Surfaces drift through /mcs-sync.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
const CACHE_DIR = path.join(KNOWLEDGE_DIR, "cache");
const FRAMEWORKS_DIR = path.join(KNOWLEDGE_DIR, "frameworks");
const PATTERNS_DIR = path.join(KNOWLEDGE_DIR, "patterns");
const DEFAULT_OUTPUT = path.join(KNOWLEDGE_DIR, "index.json");

// ---------------------------------------------------------------------------
// Generic Markdown Helpers
// ---------------------------------------------------------------------------

/** Parse metadata from HTML comment header: <!-- CACHE METADATA ... --> */
function parseCacheMetadata(content) {
  const match = content.match(/<!--\s*CACHE METADATA\s*([\s\S]*?)-->/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w_]*):\s*(.+)/);
    if (kv) {
      let val = kv[2].trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val.slice(1, -1).split(",").map((s) => s.trim());
      }
      meta[kv[1]] = val;
    }
  }
  return meta;
}

/** Parse markdown tables into arrays of objects. */
function parseMdTables(content) {
  const tables = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Detect table header row
    if (line.startsWith("|") && line.endsWith("|") && i + 1 < lines.length) {
      const nextLine = (lines[i + 1] || "").trim();
      if (nextLine.match(/^\|[\s:-]+\|/)) {
        // Parse header
        const headers = line
          .split("|")
          .slice(1, -1)
          .map((h) => h.trim().replace(/\*\*/g, ""));
        // Skip separator
        i += 2;
        const rows = [];
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine.startsWith("|") || !rowLine.endsWith("|")) break;
          const cells = rowLine
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim().replace(/\*\*/g, ""));
          if (cells.length >= headers.length) {
            const row = {};
            headers.forEach((h, idx) => {
              row[h] = cells[idx] || "";
            });
            rows.push(row);
          }
          i++;
        }
        if (rows.length > 0) {
          tables.push({ headers, rows });
        }
        continue;
      }
    }
    i++;
  }
  return tables;
}

/** Read a cache file and return { content, metadata }. */
function readCacheFile(filename) {
  const filepath = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  const content = fs.readFileSync(filepath, "utf-8");
  return { content, metadata: parseCacheMetadata(content) };
}

// ---------------------------------------------------------------------------
// Extractors — one per knowledge domain
// ---------------------------------------------------------------------------

function extractTriggers() {
  const file = readCacheFile("triggers.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const triggers = [];

  for (const table of tables) {
    // Main trigger table
    if (table.headers.some((h) => h.toLowerCase().includes("yaml") && h.toLowerCase().includes("kind"))) {
      for (const row of table.rows) {
        const kind = row[table.headers[0]] || "";
        if (!kind || kind.startsWith("~")) continue;
        triggers.push({
          kind: kind.replace(/`/g, ""),
          uiName: (row[table.headers[1]] || "").replace(/`/g, ""),
          firesWhen: row[table.headers[2]] || "",
          needsUserInput: (row[table.headers[3]] || "").toLowerCase().includes("yes"),
          category: kind.includes("Event") || kind.includes("Invoke") ? "event" : "conversation",
        });
      }
    }
    // Event trigger table
    if (table.headers.some((h) => h.toLowerCase() === "feature") && table.rows.some((r) => (r.Feature || r.feature || "").includes("event"))) {
      for (const row of table.rows) {
        const feature = row.Feature || row.feature || "";
        if (!feature) continue;
        triggers.push({
          kind: "EventTrigger",
          uiName: feature,
          firesWhen: row.Details || row.details || "",
          needsUserInput: false,
          category: "autonomous",
          status: row.Status || row.status || "",
        });
      }
    }
  }
  return triggers;
}

function extractConnectors() {
  const file = readCacheFile("connectors.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const connectors = [];
  let currentCategory = "other";

  // Parse section headers to determine category
  const lines = file.content.split("\n");
  const sectionMap = {};
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      const title = h3[1].toLowerCase();
      if (title.includes("m365") || title.includes("productivity")) currentCategory = "m365";
      else if (title.includes("data") || title.includes("integration")) currentCategory = "data";
      else if (title.includes("third-party") || title.includes("third party")) currentCategory = "thirdParty";
      else if (title.includes("search") || title.includes("news")) currentCategory = "search";
      else if (title.includes("ai") || title.includes("automation")) currentCategory = "ai";
      else if (title.includes("new") || title.includes("notable")) currentCategory = "notable";
    }
  }

  for (const table of tables) {
    if (!table.headers.some((h) => h.toLowerCase().includes("connector"))) continue;
    for (const row of table.rows) {
      const name = row.Connector || row[table.headers[0]] || "";
      if (!name || name.includes("Deprecated")) continue;
      const mcpAlt = row["MCP Alternative?"] || row["MCP Alternative"] || "";
      const notes = row.Notes || row.notes || "";
      const tier = notes.toLowerCase().includes("premium") ? "premium" :
                   notes.toLowerCase().includes("custom") ? "custom" : "standard";
      connectors.push({
        name: name.replace(/\*\*/g, ""),
        category: inferConnectorCategory(name),
        tier,
        keyActions: row["Key Actions"] || "",
        mcpAlternative: mcpAlt.toLowerCase().includes("yes") || mcpAlt.toLowerCase().includes("prefer"),
        mcpNote: mcpAlt,
        notes,
      });
    }
  }
  return connectors;
}

function inferConnectorCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("sharepoint") || n.includes("outlook") || n.includes("teams") || n.includes("onedrive") || n.includes("planner") || n.includes("excel")) return "m365";
  if (n.includes("dataverse") || n.includes("sql") || n.includes("http") || n.includes("blob")) return "data";
  if (n.includes("salesforce") || n.includes("servicenow") || n.includes("jira") || n.includes("confluence") || n.includes("zendesk") || n.includes("snowflake") || n.includes("oracle") || n.includes("sap")) return "thirdParty";
  if (n.includes("bing") || n.includes("search")) return "search";
  if (n.includes("ai builder") || n.includes("power automate") || n.includes("openai")) return "ai";
  return "other";
}

function extractMcpServers() {
  const file = readCacheFile("mcp-servers.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const servers = [];

  // Detect category from section headers before each table
  const lines = file.content.split("\n");
  let currentCategory = "other";

  for (const table of tables) {
    if (!table.headers.some((h) => h.toLowerCase().includes("mcp server") || h.toLowerCase().includes("server"))) continue;
    for (const row of table.rows) {
      const name = row["MCP Server"] || row["MCP Server (New Name)"] || row[table.headers[0]] || "";
      if (!name || name.startsWith("~")) continue;
      const status = row.Status || row.status || "";
      const desc = row.Description || row.description || "";
      servers.push({
        name: name.replace(/\*\*/g, "").replace(/`/g, ""),
        description: desc,
        status: status.replace(/\*\*/g, ""),
        category: inferMcpCategory(name),
        connectorName: row["Connector Name in Catalog"] || "",
        oldName: row["Old Name"] || "",
      });
    }
  }
  return servers;
}

function inferMcpCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("dataverse")) return "dataverse";
  if (n.includes("dynamics") || n.includes("d365")) return "dynamics365";
  if (n.includes("fabric")) return "fabric";
  if (n.includes("outlook") || n.includes("mail") || n.includes("calendar") || n.includes("meeting")) return "outlook";
  if (n.includes("work iq") || n.includes("workiq")) return "workiq";
  if (n.includes("teams")) return "workiq";
  if (n.includes("sharepoint") || n.includes("onedrive")) return "workiq";
  if (n.includes("word") || n.includes("copilot")) return "workiq";
  if (n.includes("sentinel") || n.includes("icm") || n.includes("security")) return "security";
  if (n.includes("github")) return "devtools";
  if (n.includes("power apps")) return "powerplatform";
  if (n.includes("learn docs")) return "reference";
  if (n.includes("process mining")) return "analytics";
  return "thirdParty";
}

function extractModels() {
  const file = readCacheFile("models.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const models = [];

  for (const table of tables) {
    if (!table.headers.some((h) => h.toLowerCase() === "model")) continue;
    for (const row of table.rows) {
      const name = row.Model || row[table.headers[0]] || "";
      if (!name || name.includes("RETIRED")) continue;
      models.push({
        name: name.replace(/\*\*/g, ""),
        category: (row.Category || "").replace(/\*\*/g, "").toLowerCase() || "general",
        status: (row.Status || "").replace(/\*\*/g, ""),
        availability: row.Availability || row.Notes || "",
        notes: row.Notes || row.notes || "",
      });
    }
  }
  return models;
}

function extractChannels() {
  const file = readCacheFile("channels.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const channels = [];

  for (const table of tables) {
    if (!table.headers.some((h) => h.toLowerCase() === "channel")) continue;
    for (const row of table.rows) {
      const name = row.Channel || row[table.headers[0]] || "";
      if (!name || name.includes("Deprecated")) continue;
      channels.push({
        name: name.replace(/\*\*/g, ""),
        status: (row.Status || "").replace(/\*\*/g, ""),
        setupComplexity: (row["Setup Complexity"] || "").toLowerCase(),
        notes: row.Notes || "",
        requiresRelayBot: (row.Notes || "").toLowerCase().includes("relay bot") ||
                          (row.Notes || "").toLowerCase().includes("azure bot service"),
      });
    }
  }
  return channels;
}

function extractKnowledgeSources() {
  const file = readCacheFile("knowledge-sources.md");
  if (!file) return [];
  const tables = parseMdTables(file.content);
  const sources = [];

  for (const table of tables) {
    if (!table.headers.some((h) => h.toLowerCase() === "type" || h.toLowerCase().includes("connector"))) continue;
    for (const row of table.rows) {
      const type = row.Type || row.Connector || row[table.headers[0]] || "";
      if (!type) continue;
      sources.push({
        type: type.replace(/\*\*/g, ""),
        description: row.Description || row.description || "",
        setup: row.Setup || "",
        limits: row["Gen Orchestration Limit"] || row.Limits || row.limits || "",
        notes: row.Notes || "",
      });
    }
  }
  return sources;
}

function extractFirstPartyAgents() {
  const file = readCacheFile("first-party-agents.md");
  if (!file) return [];
  const agents = [];
  const content = file.content;

  // Parse agent sections (### AgentName)
  const sections = content.split(/^### /gm).slice(1);
  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim();
    if (!name) continue;

    const agent = { name, tier: "unknown", status: "", license: "", capabilities: [], matchPatterns: [], cantDo: [], whenToBuildCA: "" };

    for (const line of lines) {
      if (line.startsWith("- **Status:**")) agent.status = line.replace("- **Status:**", "").trim().replace(/\*\*/g, "");
      if (line.startsWith("- **License:**")) agent.license = line.replace("- **License:**", "").trim().replace(/\*\*/g, "");
      if (line.startsWith("- **Capability match patterns:**")) {
        // Collect following lines
        const idx = lines.indexOf(line);
        for (let j = idx + 1; j < lines.length; j++) {
          const pl = lines[j].trim();
          if (pl.startsWith("- ")) {
            agent.matchPatterns.push(pl.replace(/^-\s*/, "").replace(/["\u201C\u201D]/g, "").trim());
          } else if (!pl.startsWith("-")) break;
        }
      }
      if (line.startsWith("- **What it CANNOT do:**")) agent.cantDo = line.replace("- **What it CANNOT do:**", "").trim().split(",").map((s) => s.trim());
      if (line.startsWith("- **When to build CA instead:**")) agent.whenToBuildCA = line.replace("- **When to build CA instead:**", "").trim();
    }

    // Determine tier from context
    if (content.indexOf("## Tier 1") < content.indexOf(section) && content.indexOf("## Tier 2") > content.indexOf(section)) agent.tier = 1;
    else if (content.indexOf("## Tier 2") < content.indexOf(section) && content.indexOf("## Tier 3") > content.indexOf(section)) agent.tier = 2;
    else agent.tier = 3;

    agents.push(agent);
  }
  return agents;
}

// ---------------------------------------------------------------------------
// Solution Patterns Extractor
// ---------------------------------------------------------------------------

function extractSolutionPatterns() {
  const filepath = path.join(PATTERNS_DIR, "solution-patterns.md");
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, "utf-8");
  const patterns = [];

  // Split by ## sp-NNN
  const sections = content.split(/^## (sp-\d{3}): /gm);
  for (let i = 1; i < sections.length; i += 2) {
    const id = sections[i];
    const body = sections[i + 1] || "";
    const lines = body.split("\n");
    const name = lines[0].trim();

    // Extract key fields
    const naive = extractField(body, "Naive approach:");
    const whyFails = extractBulletSummary(body, "Why it fails:");
    const proven = extractField(body, "Proven pattern:");
    const matchKeywords = extractBullets(body, "When to match:");
    const tags = extractField(body, "Tags:")
      .replace(/`/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Count tiers from implementation table
    const tierTable = parseMdTables(body);
    const tierCount = tierTable.length > 0 ? tierTable[0].rows.length : 0;

    patterns.push({
      id,
      name,
      naive: naive.substring(0, 200),
      proven: proven.substring(0, 300),
      matchKeywords,
      tags,
      tierCount: tierCount || 1,
    });
  }
  return patterns;
}

function extractField(text, label) {
  const regex = new RegExp(`\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s*(.+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function extractBullets(text, label) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.includes(label));
  if (start < 0) return [];
  const bullets = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("- ")) bullets.push(l.replace(/^-\s*/, "").replace(/"/g, "").trim());
    else if (!l) continue;
    else break;
  }
  return bullets;
}

function extractBulletSummary(text, label) {
  return extractBullets(text, label).slice(0, 3).join("; ");
}

// ---------------------------------------------------------------------------
// Scoring Frameworks (static — hard-coded from framework files)
// ---------------------------------------------------------------------------

function buildScoringFramework() {
  return {
    solutionType: {
      factors: [
        { id: 1, name: "Conversational Need", agent: "Users need dialogue, explanation, back-and-forth", simpler: "Data moved/transformed/displayed — dashboard or form suffices" },
        { id: 2, name: "Interaction Pattern", agent: "Reactive with AI judgment, 40%+ need interpretation", simpler: "Procedural: event → pipeline of deterministic steps" },
        { id: 3, name: "Capability Distribution", agent: "50%+ are prompt/topic/knowledge", simpler: "50%+ are flow/tool with deterministic I/O" },
        { id: 4, name: "User Value of Natural Language", agent: "Ambiguous queries, contextual follow-ups, broad audience", simpler: "Structured UI (form, button, list) works equally well" },
        { id: 5, name: "MCS Feasibility", agent: "Response <30s, data within limits, connectors exist", simpler: "Sub-second, bulk records, multi-system transactions, batch" },
      ],
      thresholds: { agent: "4-5", hybrid: "3", flow: "1-2", notRecommended: "0" },
    },
    architecture: {
      factors: [
        { id: 1, name: "Domain", single: "All tasks same domain", multi: "Truly separate domains" },
        { id: 2, name: "Data sources", single: "Shared data across capabilities", multi: "Different systems per capability" },
        { id: 3, name: "Team ownership", single: "Same team owns everything", multi: "Different teams own parts" },
        { id: 4, name: "Reusability", single: "One-off agent", multi: "Specialists reusable by other orchestrators" },
        { id: 5, name: "Instruction size", single: "Fits in 8000 chars", multi: "Would exceed 8000 chars" },
        { id: 6, name: "Knowledge isolation", single: "Same knowledge base", multi: "Each needs own deep knowledge" },
      ],
      thresholds: { single: "0-2", multi: "3+" },
    },
    componentPriority: [
      { tier: 1, source: "MCS Built-In", examples: "MCP servers, native knowledge, generative orchestration", research: "cache only" },
      { tier: 2, source: "Power Platform", examples: "Power Automate, Dataverse, custom connectors", research: "cache only" },
      { tier: 3, source: "Azure Services", examples: "Functions, AI, Storage", research: "cache + quick verify" },
      { tier: 4, source: "M365 Connectors", examples: "SharePoint, Outlook, Teams (standard)", research: "cache only" },
      { tier: 5, source: "Certified Premium", examples: "Dynamics 365, ServiceNow, Salesforce", research: "cache + verify" },
      { tier: 6, source: "Third-Party/Custom", examples: "Custom MCP, HTTP, community tools", research: "full live research" },
    ],
    buildPath: {
      rules: [
        { path: "first-party-only", condition: "All capabilities matched by Tier 1-2 first-party agents (100% coverage)" },
        { path: "custom-agent", condition: "Solution type score 4-5: strong conversational need, AI judgment, NL value" },
        { path: "hybrid", condition: "Solution type score 3: CA for conversational + Power Automate for automation" },
        { path: "flow", condition: "Solution type score 1-2: deterministic pipeline, limited conversation need" },
        { path: "not-recommended", condition: "Solution type score 0: outside MCS capabilities" },
      ],
      solutionTypeFactors: [
        "conversationalNeed: users need dialogue vs data moved/displayed",
        "interactionPattern: AI judgment needed vs deterministic flowchart",
        "capabilityDistribution: 50%+ conversational (prompt/topic/knowledge) vs automation (flow/tool)",
        "userValueOfNL: broad non-technical audience vs structured UI suffices",
        "mcsFeasibility: fits MCS limits vs requires batch/sub-second/heavy compute",
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Eval Scenarios
// ---------------------------------------------------------------------------

function loadEvalScenarios() {
  const filepath = path.join(FRAMEWORKS_DIR, "eval-scenarios", "index.json");
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (err) {
    console.warn(`WARNING: Failed to parse ${filepath}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cheat Sheet Generator — condensed ~3K token summary for wizard prompt
// ---------------------------------------------------------------------------

function generateCheatSheet(index) {
  const lines = [];
  lines.push("# MCS Component Quick Reference (for wizard context)");
  lines.push("");

  // Triggers summary
  lines.push("## Triggers");
  lines.push("Conversational: OnConversationStart, OnRecognizedIntent, OnUnknownIntent, OnMessageActivity, OnSystemRedirect");
  lines.push("Event (autonomous): SharePoint, OneDrive, Dataverse, Recurrence, Planner, Email, Custom connectors");
  lines.push("Advanced: OnPlanComplete, OnGeneratedResponse, OnKnowledgeRequested (custom knowledge)");
  lines.push("Agent flow composition: Agent Node in Agent Flows (GA Mar 2026) — call a Copilot Studio agent inline from a flow step, agent reasons over data + uses tools + optional human-in-the-loop escalation. See knowledge/cache/power-automate-integration.md.");
  lines.push("");

  // Channels summary
  lines.push("## Channels");
  const chNames = index.components.channels.map((c) => c.name).slice(0, 12).join(", ");
  lines.push(`Available: ${chNames}`);
  lines.push("Default for internal: Teams + M365 Copilot. External: Custom website/WhatsApp.");
  lines.push("");

  // MCP servers summary — data-driven, grouped by status AND Microsoft-vs-third-party
  lines.push("## MCP Servers (prefer over connectors)");
  const allMcp = index.components.mcpServers || [];
  const isMicrosoftBuilt = (s) => /^(Microsoft |Dynamics |Fabric|Fin|GitHub$|ICM|Process Mining|Power Apps|Work IQ|Dataverse|Office 365)/i.test(s.name);
  const gaMicrosoft = allMcp.filter((s) => /GA/i.test(s.status) && isMicrosoftBuilt(s)).map((s) => s.name);
  const gaThirdParty = allMcp.filter((s) => /GA/i.test(s.status) && !isMicrosoftBuilt(s)).map((s) => s.name);
  const previewMicrosoft = allMcp.filter((s) => /Preview/i.test(s.status) && isMicrosoftBuilt(s)).map((s) => s.name);
  const previewThirdParty = allMcp.filter((s) => /Preview/i.test(s.status) && !isMicrosoftBuilt(s)).map((s) => s.name);
  if (gaMicrosoft.length) lines.push(`GA (Microsoft-built): ${gaMicrosoft.slice(0, 15).join(", ")}`);
  if (previewMicrosoft.length) lines.push(`Preview (Microsoft-built): ${previewMicrosoft.slice(0, 15).join(", ")}`);
  if (gaThirdParty.length) lines.push(`GA (third-party): ${gaThirdParty.slice(0, 10).join(", ")}`);
  if (previewThirdParty.length) lines.push(`Preview (third-party): ${previewThirdParty.slice(0, 12).join(", ")}`);
  lines.push(`Work IQ (Priority 1a): single server set — adds cross-M365 coverage. Use for any M365 data access.`);
  lines.push("");

  // Connectors summary — data-driven from cache
  lines.push("## Key Connectors");
  const allConn = index.components.connectors || [];
  const connStandardM365 = allConn.filter((c) => /Standard/i.test(c.tier || c.license || "") || /m365|office/i.test(c.name) || /SharePoint|Outlook|Teams|OneDrive|Planner|Excel/.test(c.name));
  const connPremiumData = allConn.filter((c) => /Premium/i.test(c.tier || c.license || "") && /SQL|HTTP|Azure|Blob|Dataverse/i.test(c.name));
  const connThirdParty = allConn.filter((c) => /Premium/i.test(c.tier || c.license || "") && !/SQL|HTTP|Azure|Blob|Dataverse/i.test(c.name));
  const connNames = (list) => list.map((c) => c.name + (c.mcpAlternative ? " (MCP alt)" : "")).slice(0, 8).join(", ");
  if (connStandardM365.length) lines.push(`M365 Standard: ${connNames(connStandardM365)}`);
  if (connPremiumData.length) lines.push(`Data (Premium): ${connNames(connPremiumData)}`);
  if (connThirdParty.length) lines.push(`Third-party (Premium): ${connNames(connThirdParty)}`);
  lines.push(`Rule: if a connector has "(MCP alt)", prefer the MCP server over the connector. Total catalog: ${allConn.length} connectors indexed, 1400+ in Power Platform catalog.`);
  lines.push("");

  // Knowledge sources
  lines.push("## Knowledge Sources");
  lines.push("Core: Public websites (25 URLs), Uploaded files (unlimited), SharePoint (25 URLs), Dataverse (unlimited), Enterprise data/Copilot connectors, Azure AI Search, Custom (OnKnowledgeRequested)");
  lines.push("Unstructured: Salesforce, ServiceNow, Confluence, Zendesk (sync every 4-6h)");
  lines.push("Real-time (preview): Salesforce, ServiceNow, Azure SQL, Snowflake, Databricks, Oracle, SAP, Google Sheets");
  lines.push("Limits: 500 knowledge objects/agent, 25 source limit for gen orchestration (uploaded files exempt), 5 source types max");
  lines.push("");

  // Models — data-driven from cache (so fresh refreshes propagate to wizard prompt)
  lines.push("## Models");
  const models = index.components.models || [];
  const formatModels = (filter) => models
    .filter(filter)
    .map((m) => `${m.name}${m.category ? ` [${m.category}]` : ""}`)
    .join(", ");
  const gaModels = formatModels((m) => /GA/i.test(m.status) && !/Retired/i.test(m.status));
  const previewModels = formatModels((m) => /Preview/i.test(m.status) && !/Experimental/i.test(m.status));
  const experimentalModels = formatModels((m) => /Experimental/i.test(m.status));
  const retiredModels = formatModels((m) => /Retired/i.test(m.status));
  lines.push(`GA: ${gaModels || "(none in index)"}`);
  if (previewModels) lines.push(`Preview: ${previewModels}`);
  if (experimentalModels) lines.push(`Experimental (US early-access, not for prod): ${experimentalModels}`);
  if (retiredModels) lines.push(`Retired: ${retiredModels}`);
  lines.push("Default: GPT-4.1 (GA, all regions). Preview/Experimental require admin enablement (preview + external-models + cross-geo).");
  lines.push("");

  // Recent capability changes (from cache front-matter apr_2026_update fields)
  const recentUpdates = (index._meta.recentUpdates || []).filter((u) => u && u.trim());
  if (recentUpdates.length > 0) {
    lines.push("## Recent Capability Updates (last refresh)");
    for (const update of recentUpdates.slice(0, 8)) {
      lines.push(`- ${update}`);
    }
    lines.push("");
  }

  // First-party agents
  lines.push("## First-Party Agents (recommend before building)");
  for (const agent of (index.firstPartyAgents || []).slice(0, 8)) {
    lines.push(`- ${agent.name} (Tier ${agent.tier}, ${agent.status}): ${agent.matchPatterns.slice(0, 2).join("; ")}`);
  }
  lines.push("");

  // Solution patterns
  lines.push("## Solution Patterns (avoid naive approaches)");
  for (const p of (index.patterns || []).slice(0, 8)) {
    lines.push(`- ${p.id} ${p.name}: ${p.proven.substring(0, 80)}`);
  }
  lines.push("");

  // Priority ladder — data-driven from resolver-maps.json (single source of truth)
  const resolverMapsPath = path.join(__dirname, "..", "knowledge", "resolver-maps.json");
  try {
    if (fs.existsSync(resolverMapsPath)) {
      const rm = JSON.parse(fs.readFileSync(resolverMapsPath, "utf-8"));
      const tiers = rm.priorityLadder?.tiers || [];
      if (tiers.length > 0) {
        lines.push("## Component Priority Ladder (Microsoft-first)");
        for (const t of tiers) {
          lines.push(`Priority ${t.priority}: ${t.source} — ${t.examples}${t.research ? ` [${t.research}]` : ""}`);
        }
        lines.push("");
      }
    }
  } catch {}

  // Scoring quick reference
  lines.push("## Architecture Decisions");
  lines.push("Solution type: 5-factor score (0=not-recommended, 1-2=flow, 3=hybrid, 4-5=agent)");
  lines.push("Architecture: 6-factor score (0-2=single-agent, 3+=multi-agent)");
  lines.push("Build path: first-party-only → declarative-agent → custom-agent");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

function buildIndex() {
  console.log("Building knowledge index...");
  const startTime = Date.now();
  const sourceFiles = [];

  // Track what we read
  const cacheFiles = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".md"));
  sourceFiles.push(...cacheFiles.map((f) => `knowledge/cache/${f}`));

  // Extract per-file recent-update notes from cache frontmatter so they flow
  // into the cheat sheet (which the wizard's system prompt embeds verbatim).
  // Cache files use a dated field like `apr_2026_update` in the metadata block.
  const recentUpdates = [];
  for (const file of cacheFiles) {
    try {
      const content = fs.readFileSync(path.join(CACHE_DIR, file), "utf-8");
      const meta = parseCacheMetadata(content);
      // Pick up any *_update field (forward-compatible: next refresh adds a new key)
      for (const [key, val] of Object.entries(meta)) {
        if (/_update$/.test(key) && typeof val === "string" && val.trim()) {
          recentUpdates.push(`${file.replace(".md", "")}: ${val.trim()}`);
        }
      }
    } catch {}
  }

  // Extract components
  console.log("  Extracting triggers...");
  const triggers = extractTriggers();

  console.log("  Extracting connectors...");
  const connectors = extractConnectors();

  console.log("  Extracting MCP servers...");
  const mcpServers = extractMcpServers();

  console.log("  Extracting models...");
  const models = extractModels();

  console.log("  Extracting channels...");
  const channels = extractChannels();

  console.log("  Extracting knowledge sources...");
  const knowledgeSources = extractKnowledgeSources();

  console.log("  Extracting first-party agents...");
  const firstPartyAgents = extractFirstPartyAgents();

  console.log("  Extracting solution patterns...");
  const patterns = extractSolutionPatterns();
  sourceFiles.push("knowledge/patterns/solution-patterns.md");

  console.log("  Loading eval scenarios...");
  const evalScenarios = loadEvalScenarios();
  sourceFiles.push("knowledge/frameworks/eval-scenarios/index.json");

  console.log("  Building scoring framework...");
  const scoring = buildScoringFramework();
  sourceFiles.push("knowledge/frameworks/solution-type-scoring.md", "knowledge/frameworks/architecture-scoring.md", "knowledge/frameworks/component-selection.md");

  // Build the index
  const index = {
    _meta: {
      version: "1.0",
      builtAt: new Date().toISOString(),
      sourceFiles,
      stats: {
        triggers: triggers.length,
        connectors: connectors.length,
        mcpServers: mcpServers.length,
        models: models.length,
        channels: channels.length,
        knowledgeSources: knowledgeSources.length,
        firstPartyAgents: firstPartyAgents.length,
        patterns: patterns.length,
        evalScenarios: Array.isArray(evalScenarios?.scenarios) ? evalScenarios.scenarios.length : 0,
      },
      recentUpdates,
    },
    components: {
      triggers,
      connectors,
      mcpServers,
      models,
      channels,
      knowledgeSources,
    },
    firstPartyAgents,
    patterns,
    scoring,
    evalScenarios: evalScenarios || { scenarios: [], categories: [] },
    cheatSheet: "", // Placeholder — generated after index is built
  };

  // Generate cheat sheet
  console.log("  Generating cheat sheet...");
  index.cheatSheet = generateCheatSheet(index);

  // Validate
  const totalComponents = Object.values(index._meta.stats).reduce((a, b) => a + b, 0);
  if (totalComponents < 10) {
    console.warn("WARNING: Very few components extracted. Check cache files.");
  }

  return index;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : DEFAULT_OUTPUT;

  const cliStart = Date.now();
  const index = buildIndex();

  // Write output
  if (!outputPath) {
    console.error("ERROR: --output requires a path argument");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  const elapsed = ((Date.now() - cliStart) / 1000).toFixed(1);
  const stats = index._meta.stats;
  console.log(`\nKnowledge index built → ${outputPath}`);
  console.log(`  ${stats.triggers} triggers, ${stats.connectors} connectors, ${stats.mcpServers} MCP servers`);
  console.log(`  ${stats.models} models, ${stats.channels} channels, ${stats.knowledgeSources} knowledge sources`);
  console.log(`  ${stats.firstPartyAgents} first-party agents, ${stats.patterns} solution patterns`);
  console.log(`  ${stats.evalScenarios} eval scenarios`);
  console.log(`  Cheat sheet: ${index.cheatSheet.length} chars`);
}

main();
