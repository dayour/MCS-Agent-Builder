/**
 * build-pipeline.js — MCS agent build pipeline using the exact API sequence
 * from HAR analysis of MCS Studio (2026-04-15).
 *
 * 3 API surfaces, zero CLI:
 *   1. Dataverse API  — POST /bots (create with full BotConfiguration)
 *   2. PVA Direct API — POST /powervirtualagents/bots/{id}/api/botcomponents (materialize)
 *   3. Island Gateway — PUT content/botcomponents (update GptComponent)
 *
 * Sequence: Auth → Create (full config) → Materialize → Configure → Publish → Verify
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const islandClient = require("../../tools/island-client");
const { httpRequestWithRetry, getToken, getTenantId } = require("../../tools/lib/http");
const { recordBuildStats } = require("../../tools/typed-adoption-stats");
const dev = require("./dev-logger");
const specStore = require("./chat/spec-store");

// ---------------------------------------------------------------------------
// Job Management (unchanged — same pattern as analyze-pipeline.js)
// ---------------------------------------------------------------------------

const _jobs = new Map();

const DEFAULT_STEPS = [
  { id: "auth", label: "Verifying credentials", status: "pending", detail: null },
  { id: "create", label: "Creating agent", status: "pending", detail: null },
  { id: "configure", label: "Configuring agent", status: "pending", detail: null },
  { id: "components", label: "Adding components", status: "pending", detail: null },
  { id: "flows", label: "Building Power Automate flows", status: "pending", detail: null },
  { id: "publish", label: "Publishing (internal)", status: "pending", detail: null },
  { id: "verify", label: "Verifying build", status: "pending", detail: null },
  { id: "eval-gate", label: "Eval gate (promote to UAT)", status: "pending", detail: null },
];

function createJob(projectId, agentId) {
  const id = `skill-build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job = {
    id, skillType: "build",
    command: `API-direct /mcs-build ${projectId} ${agentId}`,
    projectId, agentId,
    status: "running",
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    errors: [], rawLog: "", listeners: [],
    startedAt: new Date().toISOString(),
    completedAt: null, authPrompt: null,
  };
  _jobs.set(id, job);
  return job;
}

function notifyListeners(job, event) {
  const dead = [];
  for (let i = 0; i < job.listeners.length; i++) {
    try { job.listeners[i](event); } catch { dead.push(i); }
  }
  for (let i = dead.length - 1; i >= 0; i--) job.listeners.splice(dead[i], 1);
}

function updateStep(job, stepId, status, detail) {
  const step = job.steps.find((s) => s.id === stepId);
  if (step) { step.status = status; if (detail !== undefined) step.detail = detail; }
  notifyListeners(job, { type: "step", step: stepId, status, detail: detail ?? null, steps: job.steps });
}

function completeJob(job, success, summary) {
  if (job.status === "completed" || job.status === "failed") return;
  job.status = success ? "completed" : "failed";
  job.completedAt = new Date().toISOString();
  for (const step of job.steps) {
    if (step.status === "running") step.status = success ? "completed" : "failed";
    else if (step.status === "pending") step.status = success ? "skipped" : "pending";
  }
  notifyListeners(job, { type: "done", status: job.status, summary, errors: job.errors, steps: job.steps });
  dev.info("build-pipeline", `Job ${job.id} ${job.status}: ${summary || ""}`);
}

function log(job, msg) {
  // Append to job.rawLog (consumed by SSE listeners + getJobLog) and emit a
  // structured dev-logger event so the test loop can pick it up by category.
  job.rawLog += `[build-pipeline] ${msg}\n`;
  dev.info("build-pipeline", msg);
}

function resolveSpecPath(agentDir) {
  const agentspec = path.join(agentDir, "agentspec.json");
  return fs.existsSync(agentspec) ? agentspec : path.join(agentDir, "brief.json");
}

function readBrief(agentDir) {
  const p = resolveSpecPath(agentDir);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

/**
 * writeBrief — async spec write that participates in the shared spec-store
 * mutex (via withSpecLock) AND uses atomic temp+rename to avoid partial
 * writes on crash. Serializes pipeline writes against chat-router patches
 * and concurrent enrichment / research writes targeting the same agentDir.
 *
 * Residual risk: the brief argument is the pipeline's in-memory copy from
 * the start of its step. A chat patch landing during the step's HTTP calls
 * is preserved on disk until this write fires, then overwritten by the
 * pipeline's stale view. Eliminating this fully requires per-step
 * field-level merges (rewriting each step to read-mutate-write inside the
 * lock). Tracked in cleanup-pass-2026-05-04.md.
 */
async function writeBrief(agentDir, brief) {
  await specStore.withSpecLock(agentDir, () => specStore.writeSpec(agentDir, brief));
}

/**
 * Load session-config.json to auto-resolve environment.
 */
function loadSessionConfig() {
  const configPaths = [
    path.join(__dirname, "..", "..", "tools", "session-config.json"),
    path.join(process.cwd(), "tools", "session-config.json"),
  ];
  for (const p of configPaths) {
    try {
      const cfg = JSON.parse(fs.readFileSync(p, "utf-8"));
      const defaults = cfg.sessionDefaults || {};
      const account = (cfg.accounts || []).find(a => a.label === defaults.lastAccount || a.id === defaults.lastAccount);
      if (!account) continue;
      const env = (account.environments || []).find(e => e.name === defaults.lastEnvironment) || account.environments?.[0];
      if (!env) continue;
      return { account, env, tenantId: account.tenantId };
    } catch { continue; }
  }
  return null;
}

const DV_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
});

// ---------------------------------------------------------------------------
// Step 1: Auth + Environment Resolution
// ---------------------------------------------------------------------------

async function stepAuth(job, brief) {
  updateStep(job, "auth", "running", "Resolving environment and credentials");

  // Auto-resolve from session-config if not in spec
  let bs = brief.buildStatus || {};
  if (!bs.dataverseUrl || !bs.environmentId) {
    const session = loadSessionConfig();
    if (session) {
      bs = {
        ...bs,
        dataverseUrl: bs.dataverseUrl || session.env.dataverseUrl,
        environmentId: bs.environmentId || session.env.environmentId,
        environment: bs.environment || session.env.name,
        gatewayUrl: bs.gatewayUrl || session.env.gatewayUrl,
        account: bs.account || session.account.label,
        azTenantId: bs.azTenantId || session.tenantId,
      };
      brief.buildStatus = bs;
      log(job, `Resolved env from session-config: ${bs.environment} (${bs.dataverseUrl})`);
    }
  }

  const envUrl = bs.dataverseUrl;
  if (!envUrl) throw new Error("No Dataverse URL — configure environment in session-config.json");
  if (!bs.environmentId) throw new Error("No environment ID — configure in session-config.json");

  // Get Dataverse token
  let dvToken;
  try {
    dvToken = execSync(`az account get-access-token --resource "${envUrl}" --query accessToken -o tsv`, {
      encoding: "utf8", timeout: 15000,
    }).trim();
  } catch (err) {
    throw new Error(`Azure CLI auth failed: ${err.message}. Run: az login`);
  }
  if (!dvToken || dvToken.length < 20) throw new Error("Invalid Dataverse token");

  // Get PVA token for Island Gateway
  let pvaToken;
  try {
    pvaToken = execSync('az account get-access-token --resource "96ff4394-9197-43aa-b393-6a41652e21f8" --query accessToken -o tsv', {
      encoding: "utf8", timeout: 15000,
    }).trim();
  } catch {
    log(job, "PVA token failed — Island Gateway updates will use Dataverse fallback");
  }

  // Verify Dataverse reachable
  const resp = await httpRequestWithRetry("GET", `${envUrl}/api/data/v9.2/bots?$top=1`, DV_HEADERS(dvToken));
  if (resp.status >= 400) throw new Error(`Dataverse unreachable: ${resp.status}`);

  updateStep(job, "auth", "completed", `${bs.environment} (${envUrl})`);

  return {
    dvToken, pvaToken, envUrl,
    envId: bs.environmentId,
    gatewayUrl: bs.gatewayUrl || islandClient.loadGatewayFromConfig(),
    tenantId: bs.azTenantId || getTenantId(),
  };
}

// ---------------------------------------------------------------------------
// Step 2: Create Agent (full BotConfiguration from HAR)
// ---------------------------------------------------------------------------

/**
 * Build the BotConfiguration JSON that MCS sends at POST /bots time.
 * This embeds the GptComponent seed (instructions, description, AI settings)
 * so MCS creates the full component structure on creation.
 */
function buildBotConfiguration(brief) {
  const instructions = brief.instructions || "";
  const description = brief.agent?.description || "";
  const name = brief.agent?.name || "Agent";
  const starters = brief.conversationStarters || [];

  return {
    categories: [],
    channels: [],
    settings: {
      GenerativeActionsEnabled: true,
      "default-2.1.0": {
        spec: { connectors: [] },
        content: {
          displayName: name,
          description,
          instructions,
          conversationStarters: starters,
          capabilities: {
            diagnostics: [],
            webBrowsing: true,
            $kind: "GptCapabilities",
          },
        },
      },
    },
    diagnostics: [],
    $kind: "BotConfiguration",
    isAgentConnectable: true,
    aISettings: {
      diagnostics: [],
      $kind: "AISettings",
      useModelKnowledge: true,
      isSemanticSearchEnabled: true,
      isFileAnalysisEnabled: true,
      optInUseLatestModels: false,
    },
  };
}

/**
 * Search MCS for an existing agent by name. Returns botid if found, null otherwise.
 */
async function findExistingAgent(envUrl, token, agentName) {
  try {
    const filter = encodeURIComponent(`name eq '${agentName.replace(/'/g, "''")}'`);
    const resp = await httpRequestWithRetry("GET",
      `${envUrl}/api/data/v9.2/bots?$filter=${filter}&$select=botid,name,statuscode`,
      DV_HEADERS(token));
    const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    if (data?.value?.length > 0) return data.value[0];
  } catch { /* ignore search failures */ }
  return null;
}

async function stepCreate(job, brief, agentDir, auth) {
  updateStep(job, "create", "running", "Checking for existing agent...");

  const bs = brief.buildStatus || {};
  const agentName = brief.agent?.name || "New Agent";

  // 1. Validate existing mcsAgentId (check it still exists in Dataverse)
  if (bs.mcsAgentId) {
    log(job, `Checking linked agent: ${bs.mcsAgentId}`);
    try {
      const checkResp = await httpRequestWithRetry("GET",
        `${auth.envUrl}/api/data/v9.2/bots(${bs.mcsAgentId})`,
        DV_HEADERS(auth.dvToken));
      if (checkResp.status < 400) {
        log(job, `Agent exists in MCS: ${bs.mcsAgentId}`);
        updateStep(job, "create", "completed", `Existing agent ${bs.mcsAgentId}`);
        return bs.mcsAgentId;
      }
    } catch { /* agent not found */ }
    log(job, `Stale mcsAgentId ${bs.mcsAgentId} — agent not found in Dataverse, will search or create`);
    delete bs.mcsAgentId;
    brief.buildStatus = bs;
  }

  // 2. Search MCS for an existing agent with the same name
  const existing = await findExistingAgent(auth.envUrl, auth.dvToken, agentName);
  if (existing) {
    const botId = existing.botid;
    log(job, `Found existing agent in MCS: "${existing.name}" (${botId})`);
    brief.buildStatus = { ...bs, mcsAgentId: botId, status: "existing", linkedAt: new Date().toISOString() };
    await writeBrief(agentDir, brief);
    updateStep(job, "create", "completed", `Linked to existing: ${existing.name} (${botId})`);
    return botId;
  }

  // 3. Create new agent with full BotConfiguration (HAR-proven)
  const config = buildBotConfiguration(brief);
  const body = { name: agentName, configuration: JSON.stringify(config) };

  log(job, `Creating new agent: ${agentName}`);
  log(job, `POST /bots — config has instructions: ${(brief.instructions || "").length} chars`);

  const resp = await httpRequestWithRetry("POST",
    `${auth.envUrl}/api/data/v9.2/bots?$select=botid`,
    DV_HEADERS(auth.dvToken), JSON.stringify(body));

  log(job, `POST /bots response: ${resp.status}`);
  if (resp.status >= 400) {
    const errBody = typeof resp.data === "string" ? resp.data.substring(0, 300) : JSON.stringify(resp.data).substring(0, 300);
    throw new Error(`Create failed: ${resp.status} ${errBody}`);
  }

  const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
  const botId = data?.botid;
  const location = resp.headers?.location || resp.headers?.Location || "";
  const locMatch = location.match(/bots\(([^)]+)\)/);
  const finalBotId = botId || (locMatch ? locMatch[1] : null);
  if (!finalBotId) throw new Error("Agent created but could not extract bot ID");

  log(job, `Bot created: ${finalBotId}`);

  // 4. Materialize components via PVA Direct API (HAR step 2)
  updateStep(job, "create", "running", "Materializing components...");
  try {
    // Use the MCS frontend URL for PVA Direct API
    const pvaBase = "https://copilotstudio.preview.microsoft.com";
    const materializeUrl = `${pvaBase}/powervirtualagents/bots/${finalBotId}/api/botcomponents?api-version=2022-03-01-preview`;
    const pvaHeaders = auth.pvaToken
      ? { Authorization: `Bearer ${auth.pvaToken}`, "Content-Type": "application/json" }
      : DV_HEADERS(auth.dvToken);

    const matResp = await httpRequestWithRetry("POST", materializeUrl, pvaHeaders,
      JSON.stringify({ Kind: ["BotEntity"] }));
    log(job, `PVA materialize: ${matResp.status}`);
  } catch (matErr) {
    log(job, `PVA materialize failed: ${matErr.message} — will try Island Gateway instead`);
  }

  // 5. Wait for components to be ready, then read via Island Gateway
  await new Promise(r => setTimeout(r, 3000));
  if (auth.pvaToken && auth.gatewayUrl && auth.envId) {
    try {
      const headers = islandClient.buildHeaders(auth.pvaToken, auth.tenantId, auth.envId, finalBotId);
      const components = await islandClient.readComponents(auth.gatewayUrl, auth.envId, finalBotId, headers);
      const gpt = islandClient.findGptComponent(components);
      log(job, `Island Gateway readComponents: ${(components?.botComponentChanges || []).length} components, GptComponent: ${gpt ? "found" : "not found"}`);
    } catch (readErr) {
      log(job, `Island Gateway readComponents: ${readErr.message}`);
    }
  }

  brief.buildStatus = { ...bs, mcsAgentId: finalBotId, status: "created", createdAt: new Date().toISOString() };
  await writeBrief(agentDir, brief);

  updateStep(job, "create", "completed", `Created ${agentName} (${finalBotId})`);
  return finalBotId;
}

// ---------------------------------------------------------------------------
// Step 3: Configure (instructions, model, description via Island Gateway)
// ---------------------------------------------------------------------------

async function stepConfigure(job, brief, auth) {
  updateStep(job, "configure", "running", "Configuring agent");

  const botId = brief.buildStatus?.mcsAgentId;
  if (!botId) throw new Error("No agent ID — create step must run first");

  const configured = [];
  const instructions = brief.instructions || "";
  const description = brief.agent?.description || "";
  const agentName = brief.agent?.name || "Agent";
  const model = brief.architecture?.model;

  // Step A: Always update bot.configuration via Dataverse (guaranteed to persist)
  if (instructions || description) {
    updateStep(job, "configure", "running", "Updating bot configuration...");
    try {
      const botResp = await httpRequestWithRetry("GET",
        `${auth.envUrl}/api/data/v9.2/bots(${botId})`,
        DV_HEADERS(auth.dvToken));
      const botData = typeof botResp.data === "string" ? JSON.parse(botResp.data) : botResp.data;
      let config = {};
      try { config = JSON.parse(botData?.configuration || "{}"); } catch { config = {}; }

      // Ensure full BotConfiguration structure
      if (!config.$kind) config.$kind = "BotConfiguration";
      if (!config.settings) config.settings = {};
      if (!config.settings["default-2.1.0"]) {
        config.settings["default-2.1.0"] = { spec: { connectors: [] }, content: {} };
      }
      config.settings.GenerativeActionsEnabled = true;
      config.isAgentConnectable = true;
      if (!config.aISettings) {
        config.aISettings = { $kind: "AISettings", useModelKnowledge: true, isSemanticSearchEnabled: true, isFileAnalysisEnabled: true };
      }
      config.settings["default-2.1.0"].content = {
        ...config.settings["default-2.1.0"].content,
        displayName: agentName,
        description,
        instructions,
        capabilities: config.settings["default-2.1.0"].content?.capabilities || { $kind: "GptCapabilities", webBrowsing: true, diagnostics: [] },
      };

      await httpRequestWithRetry("PATCH",
        `${auth.envUrl}/api/data/v9.2/bots(${botId})`,
        DV_HEADERS(auth.dvToken),
        JSON.stringify({ name: agentName, configuration: JSON.stringify(config) }));

      configured.push(`bot.configuration (instructions: ${instructions.length}, description: ${description.length})`);
      log(job, `bot.configuration updated: instructions=${instructions.length} chars, description=${description.length} chars`);
    } catch (dvErr) {
      log(job, `Dataverse config update failed: ${dvErr.message}`);
      job.errors.push(`Configure: ${dvErr.message}`);
    }
  }

  // Step B: Create or update GptComponent via Island Gateway (this is what MCS Studio reads)
  if (auth.pvaToken && auth.gatewayUrl && auth.envId) {
    try {
      const headers = islandClient.buildHeaders(auth.pvaToken, auth.tenantId, auth.envId, botId);

      updateStep(job, "configure", "running", "Configuring GptComponent via Gateway...");
      const gptResult = await islandClient.configureGptComponent(
        auth.gatewayUrl, auth.envId, botId, headers,
        { instructions, description, displayName: agentName }
      );

      if (gptResult.created) {
        configured.push(`GptComponent created (instructions: ${instructions.length}, description: ${description.length})`);
        log(job, `GptComponent CREATED: instructions=${instructions.length} chars, description=${description.length} chars`);
      } else {
        configured.push(`GptComponent updated (instructions: ${instructions.length}, description: ${description.length})`);
        log(job, `GptComponent UPDATED: instructions=${instructions.length} chars, description=${description.length} chars`);
      }

      if (model) {
        try {
          await islandClient.setModel(auth.gatewayUrl, auth.envId, botId, headers, model);
          configured.push(`model (${model})`);
          log(job, `Model set: ${model}`);
        } catch (modelErr) {
          log(job, `Model set failed: ${modelErr.message}`);
        }
      }
    } catch (gwErr) {
      log(job, `Island Gateway GptComponent configure failed: ${gwErr.message}`);
      job.errors.push(`GptComponent: ${gwErr.message}`);
    }
  } else {
    log(job, "WARNING: No PVA token or gateway URL — cannot create GptComponent. Agent will appear empty in MCS.");
    job.errors.push("No PVA token — GptComponent not configured (agent will be empty in MCS)");
  }

  // Log knowledge/tools status
  const knowledge = (brief.knowledge || []).filter(k => k.phase === "mvp");
  const tools = (brief.integrations || []).filter(i => i.phase === "mvp" && i.type !== "setting");
  const kPending = knowledge.filter(k => k.status !== "available").map(k => k.name);
  const tPending = tools.filter(i => i.status !== "available" && !i._autoAdded).map(i => i.name);
  if (kPending.length > 0) log(job, `Knowledge needing setup: ${kPending.join(", ")}`);
  if (tPending.length > 0) log(job, `Tools needing setup: ${tPending.join(", ")}`);

  const detail = configured.length > 0
    ? `Configured: ${configured.join(", ")}`
    : "No configuration changes applied";
  updateStep(job, "configure", "completed", detail);
}

// ---------------------------------------------------------------------------
// Step 3b: Components (knowledge, tools, topics, evals)
// ---------------------------------------------------------------------------

async function stepComponents(job, brief, agentDir, auth) {
  updateStep(job, "components", "running", "Adding components");

  const botId = brief.buildStatus?.mcsAgentId;
  if (!botId) { updateStep(job, "components", "skipped", "No agent"); return; }

  const crypto = require("crypto");
  const added = [];
  const schemaBase = "new_bot_" + botId.replace(/-/g, "");

  // Helper: create a Dataverse botcomponent
  async function createComponent(type, name, data, opts = {}) {
    const safeName = (opts.schemaSuffix || name).replace(/[^a-zA-Z0-9]/g, "").substring(0, 25);
    const suffix = crypto.randomBytes(4).toString("hex");
    const schemaName = (schemaBase + "." + (opts.schemaPrefix || "topic") + "." + safeName + "_" + suffix).substring(0, 100);

    const body = {
      name: name.substring(0, 100),
      componenttype: type,
      schemaname: schemaName,
      data,
      "parentbotid@odata.bind": `/bots(${botId})`,
    };
    if (opts.description) body.description = opts.description.substring(0, 200);
    if (opts.category) body.category = opts.category;

    const headers = { ...DV_HEADERS(auth.dvToken), "Prefer": "return=representation" };
    const resp = await httpRequestWithRetry("POST",
      `${auth.envUrl}/api/data/v9.2/botcomponents`,
      headers, JSON.stringify(body));

    if (resp.status >= 400) {
      const err = typeof resp.data === "string" ? resp.data.substring(0, 200) : JSON.stringify(resp.data).substring(0, 200);
      log(job, `  Component failed [${name}]: ${err}`);
      return null;
    }

    // With Prefer: return=representation, resp.data is the created record object
    const parsed = typeof resp.data === "object" ? resp.data : (typeof resp.data === "string" ? (() => { try { return JSON.parse(resp.data); } catch { return null; } })() : null);
    if (parsed?.botcomponentid) return parsed.botcomponentid;

    // Fallback: OData-EntityId or Location header
    const entityId = resp.headers?.["odata-entityid"] || resp.headers?.["OData-EntityId"] ||
                     resp.headers?.location || resp.headers?.Location || "";
    const hdrMatch = entityId.match(/botcomponents\(([^)]+)\)/);
    if (hdrMatch?.[1]) return hdrMatch[1];

    return true; // Created but couldn't extract ID
  }

  // Helper: associate component with connection reference
  async function associateCR(compId, crId) {
    if (!compId || !crId) return;
    const url = `${auth.envUrl}/api/data/v9.2/botcomponents(${compId})/botcomponent_connectionreference/$ref`;
    await httpRequestWithRetry("POST", url, DV_HEADERS(auth.dvToken),
      JSON.stringify({ "@odata.id": `${auth.envUrl}/api/data/v9.2/connectionreferences(${crId})` }));
  }

  // Helper: create or find connection reference
  async function ensureConnectionRef(connectorId, connectionId, displayName) {
    const logicalName = (schemaBase + "." + connectorId.split("/").pop() + "." + connectionId).substring(0, 100);
    const filter = encodeURIComponent(`connectionreferencelogicalname eq '${logicalName}'`);
    const checkResp = await httpRequestWithRetry("GET",
      `${auth.envUrl}/api/data/v9.2/connectionreferences?$filter=${filter}`,
      DV_HEADERS(auth.dvToken));
    const checkData = typeof checkResp.data === "string" ? JSON.parse(checkResp.data) : checkResp.data;
    if (checkData?.value?.length > 0) return checkData.value[0].connectionreferenceid;

    const body = {
      connectionreferencelogicalname: logicalName,
      connectionreferencedisplayname: displayName,
      connectorid: connectorId,
      connectionid: connectionId,
    };
    const resp = await httpRequestWithRetry("POST",
      `${auth.envUrl}/api/data/v9.2/connectionreferences`,
      DV_HEADERS(auth.dvToken), JSON.stringify(body));
    if (resp.status >= 400) return null;
    const loc = resp.headers?.location || resp.headers?.Location || "";
    const m = loc.match(/connectionreferences\(([^)]+)\)/);
    return m?.[1] || null;
  }

  // --- A. Knowledge Sources (componenttype: 16) ---
  const knowledgeSources = (brief.knowledge || []).filter(k => k.phase === "mvp" || !k.phase);
  if (knowledgeSources.length > 0) {
    updateStep(job, "components", "running", `Adding ${knowledgeSources.length} knowledge source(s)...`);
    for (const k of knowledgeSources) {
      const kind = k.kind || "SharePointSearchSource";
      let yaml;
      if (kind === "PublicSiteSearchSource") {
        yaml = `kind: KnowledgeSourceConfiguration\nsource:\n  kind: PublicSiteSearchSource\n  site: ${k.site || "https://www.example.com"}`;
      } else if (kind === "DataverseStructuredSearchSource") {
        const skillId = (k.name || "data").replace(/[^a-zA-Z0-9]/g, "") + "_" + crypto.randomBytes(5).toString("hex");
        yaml = `kind: KnowledgeSourceConfiguration\nsource:\n  kind: DataverseStructuredSearchSource\n  skillConfiguration: ${skillId}`;
      } else {
        yaml = `kind: KnowledgeSourceConfiguration\nsource:\n  kind: SharePointSearchSource\n  site: ${k.site || "https://m365cpi15209943.sharepoint.com"}`;
      }
      const id = await createComponent(16, k.name, yaml, { description: k.description });
      if (id) added.push(`knowledge:${k.name}`);
    }
    log(job, `Knowledge: ${added.filter(a => a.startsWith("knowledge:")).length}/${knowledgeSources.length} created`);
  }

  // --- B. Tools (componenttype: 9 + connection references) ---
  const TOOL_MAP = {
    "Work IQ Copilot": {
      connectorId: "/providers/Microsoft.PowerApps/apis/shared_a365copilotchatmcp",
      connectionId: "shared-a365copilotch-6ec7d2f2-ba52-4d04-9185-5130bd2d7547",
      operationId: "mcp_m365copilot",
    },
    "Work IQ User": {
      connectorId: "/providers/Microsoft.PowerApps/apis/shared_a365memcp",
      connectionId: "shared-a365memcp-f6f809e9-edc8-4caf-a84b-e78ec72c405c",
      operationId: "mcp_MeServer",
    },
    "Dataverse MCP": {
      connectorId: "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      connectionId: "shared-commondataser-57a2e6f4-d7b0-46de-abde-4e5874c425de",
      operationId: "InvokeMCP",
    },
  };

  const toolIntegrations = (brief.integrations || []).filter(i => i.phase === "mvp" && i.type === "mcp");
  if (toolIntegrations.length > 0) {
    updateStep(job, "components", "running", `Adding ${toolIntegrations.length} tool(s)...`);
    for (const tool of toolIntegrations) {
      // Match to known tool
      const toolKey = Object.keys(TOOL_MAP).find(k => tool.name.toLowerCase().includes(k.toLowerCase()));
      const mapped = toolKey ? TOOL_MAP[toolKey] : (tool.name.toLowerCase().includes("dataverse") ? TOOL_MAP["Dataverse MCP"] : null);
      if (!mapped) { log(job, `  Tool skipped (no mapping): ${tool.name}`); continue; }

      const crLogical = (schemaBase + "." + mapped.connectorId.split("/").pop() + "." + mapped.connectionId).substring(0, 100);
      const yaml = [
        "kind: TaskDialog",
        `modelDisplayName: ${tool.name}`,
        tool.description ? `modelDescription: ${tool.description.substring(0, 200)}` : "",
        "action:",
        "  kind: InvokeExternalAgentTaskAction",
        `  connectionReference: ${crLogical}`,
        "  connectionProperties:",
        "    mode: Invoker",
        "  operationDetails:",
        "    kind: ModelContextProtocolMetadata",
        `    operationId: ${mapped.operationId}`,
      ].filter(Boolean).join("\n");

      const crId = await ensureConnectionRef(mapped.connectorId, mapped.connectionId, tool.name);
      const compId = await createComponent(9, tool.name, yaml, { schemaPrefix: "action", description: tool.description });
      if (compId && crId) await associateCR(compId, crId);
      if (compId) added.push(`tool:${tool.name}`);
    }
    log(job, `Tools: ${added.filter(a => a.startsWith("tool:")).length}/${toolIntegrations.length} created`);
  }

  // --- C. Custom Topics (componenttype: 9 from topics/ directory) ---
  // Pre-push validation: check for known-bad expressions before creating records.
  function validateTopicYaml(yaml, fileName) {
    const errors = [];
    // Invalid MCS identifiers (Bot Framework legacy vars not available in PowerFx)
    const invalidIds = [
      { pattern: /System\.Activity\.Id/g, fix: "Remove or replace with a topic variable" },
      { pattern: /System\.Activity\.Text/g, fix: "Use Activity.Text or a topic variable" },
      { pattern: /System\.Activity\.From/g, fix: "Use System.User.FirstName or System.User.DisplayName" },
      { pattern: /Turn\.Activity/g, fix: "Use topic variables instead of Turn context" },
    ];
    for (const check of invalidIds) {
      if (check.pattern.test(yaml)) {
        errors.push(`Invalid identifier: ${check.pattern.source} — ${check.fix}`);
      }
    }
    // Empty braces in text (MCS parses as PowerFx)
    if (/\{\s*\}/.test(yaml)) {
      errors.push("Empty braces {} in text — MCS interprets as PowerFx expression");
    }
    // Very long text segments (>4000 chars in a single text field)
    const longText = yaml.match(/text:\s*"([^"]{4000,})"/);
    if (longText) {
      errors.push("Text segment exceeds 4000 chars — MCS may truncate");
    }
    return errors;
  }

  const topicsDir = path.join(agentDir, "topics");
  if (fs.existsSync(topicsDir) && auth.pvaToken && auth.gatewayUrl && auth.envId) {
    const yamlFiles = fs.readdirSync(topicsDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
    if (yamlFiles.length > 0) {
      updateStep(job, "components", "running", `Adding ${yamlFiles.length} custom topic(s) via Gateway...`);

      const gwHeaders = islandClient.buildHeaders(auth.pvaToken, auth.tenantId, auth.envId, botId);

      for (const file of yamlFiles) {
        try {
          const yaml = fs.readFileSync(path.join(topicsDir, file), "utf-8");
          const cleanYaml = yaml.split("\n").filter(l => !l.startsWith("#")).join("\n").trim();
          const dnMatch = yaml.match(/displayName:\s*(.+)/);
          const displayName = dnMatch ? dnMatch[1].trim().replace(/["']/g, "") : file.replace(/\.ya?ml$/, "").replace(/-/g, " ");
          const descMatch = yaml.match(/modelDescription:\s*"?([^"\n]+)/);
          const description = descMatch ? descMatch[1].trim() : "";

          // Read current changeToken
          const readResult = await islandClient.readComponents(auth.gatewayUrl, auth.envId, botId, gwHeaders);
          const changeToken = readResult.changeToken;

          // Build the topic component
          const safeName = file.replace(/\.ya?ml$/, "").replace(/[^a-zA-Z0-9-]/g, "").substring(0, 30);
          const topicSchema = `${schemaBase}.topic.${safeName}_${crypto.randomBytes(4).toString("hex")}`.substring(0, 100);

          const component = {
            $kind: "DialogComponent",
            id: "00000000-0000-0000-0000-000000000000",
            schemaName: topicSchema,
            displayName: displayName.substring(0, 100),
            description: description.substring(0, 200),
          };

          // Parse YAML to inject dialog content — the YAML IS the ObjectModel data
          // The Gateway expects the component JSON structure wrapping the YAML content.
          // For topics with YAML data, we pass them as Dataverse records (componenttype 9)
          // and use the Gateway to register them via a subsequent component read+write cycle.

          // Actually, the simplest approach: create via Dataverse THEN trigger Gateway
          // sync by reading components. But the correct Gateway approach requires
          // ObjectModel JSON (not YAML). Use Dataverse POST for the record + publish.
          // Validate before pushing
          const validationErrors = validateTopicYaml(cleanYaml, file);
          if (validationErrors.length > 0) {
            log(job, `  Topic VALIDATION ERRORS [${file}]:`);
            validationErrors.forEach(e => log(job, `    - ${e}`));
            job.errors.push(`Topic "${displayName}" has validation errors: ${validationErrors.join("; ")}`);
            continue; // Skip this topic
          }

          const compId = await createComponent(9, displayName, cleanYaml, { description });
          if (compId) {
            added.push(`topic:${displayName}`);
            log(job, `  Topic created: ${displayName}`);
          }
        } catch (topicErr) {
          log(job, `  Topic failed [${file}]: ${topicErr.message}`);
        }
      }
      log(job, `Topics: ${added.filter(a => a.startsWith("topic:")).length}/${yamlFiles.length} created`);
    }
  } else if (fs.existsSync(topicsDir)) {
    const yamlFiles = fs.readdirSync(topicsDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
    if (yamlFiles.length > 0) {
      updateStep(job, "components", "running", `Adding ${yamlFiles.length} custom topic(s) via Dataverse...`);
      for (const file of yamlFiles) {
        const yaml = fs.readFileSync(path.join(topicsDir, file), "utf-8");
        const cleanYaml = yaml.split("\n").filter(l => !l.startsWith("#")).join("\n").trim();
        const dnMatch = yaml.match(/displayName:\s*(.+)/);
        const displayName = dnMatch ? dnMatch[1].trim().replace(/["']/g, "") : file.replace(/\.ya?ml$/, "").replace(/-/g, " ");
        const descMatch = yaml.match(/modelDescription:\s*"?([^"\n]+)/);
        const description = descMatch ? descMatch[1].trim() : "";
        const id = await createComponent(9, displayName, cleanYaml, { description });
        if (id) added.push(`topic:${displayName}`);
      }
      log(job, `Topics: ${added.filter(a => a.startsWith("topic:")).length}/${yamlFiles.length} created`);
    }
  }

  // --- D. Evals (componenttype: 19) ---
  // EvaluationSet = parent bucket, EvaluationData = test case linked via parentbotcomponentid.
  // Primary path: typed makerEvalUpdateTestComponents adapter (Phase 3 — WRITE proven 2026-04-17
  // after HAR capture revealed the $kind wrappers + category/state requirements).
  // Fallback: reverse-engineered Dataverse POST via createComponent(19, ...). Kept because typed
  // path may 500 under conditions we haven't characterized; we prefer degradation over build failure.
  const evalSets = brief.evalSets || [];
  if (evalSets.length > 0) {
    updateStep(job, "components", "running", `Adding ${evalSets.length} eval set(s)...`);
    const canUseTyped = !!(auth.pvaToken && auth.gatewayUrl && auth.envId);
    const gwHeaders = canUseTyped ? islandClient.buildHeaders(auth.pvaToken, auth.tenantId, auth.envId, botId) : null;
    const typedPath = canUseTyped ? "typed" : "legacy";
    log(job, `Evals: using ${typedPath} write path${canUseTyped ? "" : " (no pvaToken/gatewayUrl; falling back to Dataverse)"}`);

    // Metrics for typed/legacy path adoption (tools/typed-adoption-stats.js).
    const stats = { typed_sets: 0, legacy_sets: 0, typed_tests: 0, legacy_tests: 0, fallback_reasons: [] };
    let totalTests = 0;
    for (const es of evalSets) {
      const setName = es.name || "unnamed";
      const setSchema = `mspva_${crypto.randomUUID()}`;
      let setId = null;
      let usedFallback = false;

      // Try typed path for the parent EvaluationSet.
      if (canUseTyped) {
        try {
          const parentReq = {
            testComponents: [
              {
                component: {
                  schemaName: setSchema,
                  definition: {
                    $kind: "EvaluationSet",
                    graders: [{ $kind: "GeneralQualityGrader", diagnostics: [] }],
                    diagnostics: [],
                  },
                  displayName: setName,
                  description: setName,
                  category: "Testing",
                  state: "Active",
                },
                operationType: "Add",
              },
            ],
          };
          const res = await islandClient.makerEvalUpdateTestComponents(
            auth.gatewayUrl, auth.envId, botId, gwHeaders, parentReq, { applyV2Migration: true }
          );
          setId = res.addedComponentsIdsBySchemaName?.[setSchema] || null;
          if (setId) {
            log(job, `  Eval set "${setName}" (typed): ${setId}`);
            stats.typed_sets++;
          }
        } catch (err) {
          log(job, `  Eval set "${setName}" typed write failed: ${err.message} — falling back to Dataverse`);
          usedFallback = true;
          stats.fallback_reasons.push(`set: ${err.message}`);
        }
      }

      // Fallback: reverse-engineered Dataverse createComponent.
      if (!setId) {
        const setYaml = "kind: EvaluationSet\ngraders:\n  - kind: GeneralQualityGrader\n\n  - kind: GeneralQualityGrader";
        setId = await createComponent(19, setName, setYaml, {
          schemaPrefix: "mspva",
          category: "Testing",
          description: setName,
        });
        if (setId && typeof setId === "string") stats.legacy_sets++;
        if (setId && typeof setId === "string" && !usedFallback) usedFallback = true;
        log(job, `  Eval set "${setName}" (legacy): ${typeof setId === "string" ? setId : "(failed)"}`);
      }

      // Only count as success when we have a real string ID. createComponent can
      // return truthy sentinel values (e.g. `true`) when POST succeeded but we
      // couldn't extract an ID — in that case child linking will fail, so skip
      // the child loop entirely rather than creating orphaned rows. (GPT review
      // flagged this: orphaned children + miscounted :typed tag.)
      const setCreated = typeof setId === "string";
      if (setCreated) added.push(`evalSet:${setName}${usedFallback ? ":legacy" : ":typed"}`);
      else {
        log(job, `  Eval set "${setName}" parent creation did not return a usable ID — skipping ${(es.tests || []).length} test(s)`);
        continue; // move to next evalSet
      }

      // Create test cases and link to eval set (only reached when setCreated === true).
      for (let ti = 0; ti < (es.tests || []).length; ti++) {
        const test = es.tests[ti];
        const question = test.question || test.input || "";
        const expected = test.expected || test.expectedOutput || "";
        let testCompId = null;

        // Prefer typed path for children when we have a typed parent id.
        if (canUseTyped && typeof setId === "string" && !usedFallback) {
          try {
            const childSchema = `mspva_${crypto.randomUUID()}`;
            const childReq = {
              testComponents: [
                {
                  component: {
                    schemaName: childSchema,
                    definition: {
                      $kind: "EvaluationData",
                      rows: [
                        {
                          $kind: "SimpleEvaluationCase",
                          input: question,
                          expectedOutput: expected,
                          source: "Imported",
                          diagnostics: [],
                        },
                      ],
                      diagnostics: [],
                      extensionData: { displayOrder: String(Date.now() + ti) },
                    },
                    parentBotComponentId: setId,
                    displayName: question.substring(0, 100),
                    description: question.substring(0, 200),
                    category: "Testing",
                    state: "Active",
                  },
                  operationType: "Add",
                },
              ],
            };
            const res = await islandClient.makerEvalUpdateTestComponents(
              auth.gatewayUrl, auth.envId, botId, gwHeaders, childReq, { applyV2Migration: true }
            );
            testCompId = res.addedComponentsIdsBySchemaName?.[childSchema] || null;
            if (testCompId) stats.typed_tests++;
          } catch (err) {
            log(job, `  Test case typed write failed: ${err.message} — falling back`);
            stats.fallback_reasons.push(`test: ${err.message}`);
          }
        }

        // Legacy fallback: Dataverse create + PATCH to link to parent.
        if (!testCompId) {
          const testYaml = [
            "kind: EvaluationData",
            "rows:",
            "  - source: Imported",
            `    expectedOutput: ${expected.replace(/\n/g, " ")}`,
            `    input: ${question.replace(/\n/g, " ")}`,
            "",
            "extensionData:",
            `  displayOrder: "${Date.now() + ti}"`,
          ].join("\n");
          testCompId = await createComponent(19, question.substring(0, 100), testYaml, {
            schemaPrefix: "mspva",
            category: "Testing",
            description: question.substring(0, 200),
          });
          if (testCompId && typeof testCompId === "string" && typeof setId === "string") {
            const patchResp = await httpRequestWithRetry("PATCH",
              `${auth.envUrl}/api/data/v9.2/botcomponents(${testCompId})`,
              DV_HEADERS(auth.dvToken),
              JSON.stringify({ "ParentBotComponentId@odata.bind": `/botcomponents(${setId})` }));
            if (patchResp.status >= 400) log(job, `  Eval PATCH link failed: ${patchResp.status}`);
          } else if (!testCompId) {
            log(job, `  Eval link skip: testId=${typeof testCompId}(${testCompId}), setId=${typeof setId}(${setId})`);
          }
          if (testCompId && typeof testCompId === "string") stats.legacy_tests++;
        }

        if (testCompId) totalTests++;
      }
    }
    log(job, `Evals: ${added.filter(a => a.startsWith("evalSet:")).length} sets, ${totalTests} tests (${typedPath} primary path)`);

    // Persist stats for the observability CLI (tools/typed-adoption-stats.js).
    // Belt-and-braces: the emitter itself swallows errors, but wrap here too
    // so a surprise at the call site can't fail the build step.
    try {
      recordBuildStats({
        envId: auth.envId,
        botId,
        typed_sets: stats.typed_sets,
        legacy_sets: stats.legacy_sets,
        typed_tests: stats.typed_tests,
        legacy_tests: stats.legacy_tests,
        fallback_reasons: stats.fallback_reasons,
      });
    } catch (statsErr) {
      log(job, `  (stats emitter error, continuing build: ${statsErr.message})`);
    }
  }

  const detail = added.length > 0
    ? `Added ${added.length} components (${added.filter(a => a.startsWith("knowledge:")).length} knowledge, ${added.filter(a => a.startsWith("tool:")).length} tools, ${added.filter(a => a.startsWith("topic:")).length} topics, ${added.filter(a => a.startsWith("evalSet:")).length} eval sets)`
    : "No additional components to add";
  updateStep(job, "components", "completed", detail);
}

// ---------------------------------------------------------------------------
// Step 4: Publish
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step: Build Power Automate flows from agentspec.flows[]
// ---------------------------------------------------------------------------

async function stepFlows(job, brief, agentDir, auth) {
  if (!Array.isArray(brief.flows) || brief.flows.length === 0) {
    updateStep(job, "flows", "skipped", "No flows[] in spec");
    return;
  }

  updateStep(job, "flows", "running", `Building ${brief.flows.length} flow(s)`);
  let runFlowsBuild, flowManager, composer;
  try {
    ({ runFlowsBuild } = require("./flow-build-runner"));
    flowManager = require("../../tools/flow-manager");
    composer = require("../../tools/lib/flow-composer");
  } catch (e) {
    log(job, `Cannot load flow-build modules: ${e.message}`);
    updateStep(job, "flows", "failed", e.message);
    job.errors.push(`flows: ${e.message}`);
    return;
  }

  try {
    // Optionally fetch Power Platform token for AI flows that need verifyPlan
    let pvaToken = null;
    let ppUrl = null;
    const hasAiTool = brief.flows.some((f) => f && f.kind === "ai-tool");
    if (hasAiTool) {
      try {
        pvaToken = execSync(`az account get-access-token --resource "https://api.powerplatform.com" --query accessToken -o tsv`, { encoding: "utf8", timeout: 15000 }).trim();
      } catch (e) {
        throw new Error(`Could not obtain Power Platform token (needed for AI flow verifyPlan): ${e.message}`);
      }
      // Use envId from auth (already resolved at stepAuth)
      if (auth.envId) {
        const noHy = String(auth.envId).replace(/-/g, "");
        if (noHy.length === 32) ppUrl = `https://${noHy.slice(0,30)}.${noHy.slice(30)}.environment.api.powerplatform.com`;
      }
    }

    const { results, modifiedSpec, generatedActions = [] } = await runFlowsBuild(brief, {
      flowManager, composer,
      orgUrl: auth.envUrl,
      token: auth.dvToken,
      pvaToken,
      ppUrl,
      log: (m) => log(job, `[flows] ${m}`),
    });

    // Merge updated flows[] back into brief in-place so the writeBrief at the
    // end of runPipeline persists them.
    brief.flows = modifiedSpec.flows;

    // Write any generated agent-action YAMLs to <agentDir>/actions/. The
    // existing component sync (stepComponents) already pushed before this step,
    // so we re-push just the new files via mcs-lsp afterward (TODO — for now,
    // log the manual push command).
    if (generatedActions.length > 0) {
      const actionsDir = path.join(agentDir, "actions");
      if (!fs.existsSync(actionsDir)) fs.mkdirSync(actionsDir, { recursive: true });
      for (const a of generatedActions) {
        const target = path.join(actionsDir, a.filename);
        fs.writeFileSync(target, a.content, "utf8");
        log(job, `[flows] action YAML: ${target}`);
      }
      log(job, `[flows] Wrote ${generatedActions.length} action YAML(s). Push to MCS via: node tools/mcs-lsp.js push --workspace ${agentDir}`);
    }

    const failed = results.filter((r) => r.status === "failed");
    const summary = `${results.length - failed.length}/${results.length} succeeded`;
    if (failed.length > 0) {
      const detail = `${summary} — failed: ${failed.map((f) => f.name).join(", ")}`;
      updateStep(job, "flows", "failed", detail);
      job.errors.push(`flows: ${detail}`);
    } else {
      updateStep(job, "flows", "completed", summary);
    }
  } catch (e) {
    log(job, `flow build crashed: ${e.message}`);
    updateStep(job, "flows", "failed", e.message);
    job.errors.push(`flows: ${e.message}`);
  }
}

async function stepPublish(job, brief, auth) {
  updateStep(job, "publish", "running", "Publishing agent");

  const botId = brief.buildStatus?.mcsAgentId;
  if (!botId) { updateStep(job, "publish", "skipped", "No agent"); return; }

  // Retry PvaPublish up to 4 times with increasing delay — freshly created agents need time
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const delay = attempt === 0 ? 5000 : attempt * 5000; // 5s, 5s, 10s, 15s
      if (attempt === 0) log(job, "Waiting 5s for agent provisioning...");
      else log(job, `Publish retry ${attempt + 1}/4 after ${delay / 1000}s delay`);
      await new Promise(r => setTimeout(r, delay));

      const resp = await httpRequestWithRetry("POST",
        `${auth.envUrl}/api/data/v9.2/bots(${botId})/Microsoft.Dynamics.CRM.PvaPublish`,
        DV_HEADERS(auth.dvToken), JSON.stringify({}));

      if (resp.status >= 400) throw new Error(`PvaPublish: ${resp.status}`);

      brief.buildStatus.publishedAt = new Date().toISOString();
      // "published-internal" — deployed to MCS but not user-visible. Eval gate
      // promotes to "published-uat" only after eval verdict = SHIP.
      brief.buildStatus.status = "published-internal";
      log(job, "Published (internal — pending eval gate)");
      updateStep(job, "publish", "completed", "Deployed (internal, not user-visible)");
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  log(job, `Publish failed after 4 attempts: ${lastErr.message}`);
  job.errors.push(`Publish: ${lastErr.message}`);
  updateStep(job, "publish", "failed", lastErr.message);
}

// ---------------------------------------------------------------------------
// Step 5: Verify
// ---------------------------------------------------------------------------

async function stepVerify(job, brief, agentDir, auth) {
  updateStep(job, "verify", "running", "Verifying");

  const botId = brief.buildStatus?.mcsAgentId;
  if (!botId) { updateStep(job, "verify", "skipped", "No agent"); return; }

  try {
    const resp = await httpRequestWithRetry("GET",
      `${auth.envUrl}/api/data/v9.2/bots(${botId})`,
      DV_HEADERS(auth.dvToken));

    if (resp.status >= 400) throw new Error(`Dataverse: ${resp.status}`);

    const bot = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;

    // Check if configuration has our instructions
    let hasInstructions = false;
    try {
      const config = JSON.parse(bot.configuration || "{}");
      const content = config?.settings?.["default-2.1.0"]?.content;
      hasInstructions = !!(content?.instructions);
    } catch { /* */ }

    brief.buildStatus.verifiedAt = new Date().toISOString();
    brief.buildStatus.verifiedName = bot.name;
    await writeBrief(agentDir, brief);

    const detail = `${bot.name}${hasInstructions ? " (instructions confirmed)" : " (check instructions in MCS)"}`;
    log(job, `Verified: ${detail}`);
    updateStep(job, "verify", "completed", detail);
  } catch (err) {
    log(job, `Verify: ${err.message}`);
    updateStep(job, "verify", "failed", `Could not verify: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Step 6: Eval gate — promote published-internal → published-uat on SHIP
// ---------------------------------------------------------------------------

/**
 * Runs evals against the freshly published agent and gates UAT promotion on
 * the verdict. Honors brief.evalConfig.skipGate for explicit POC override
 * (logged loudly, recorded in evalGate.override for audit).
 *
 * State transitions managed here:
 *   "published-internal"  →  default after PvaPublish; not user-visible
 *   "published-uat"       →  set when verdict = SHIP (or skipGate=true)
 *   stays "published-internal" on BLOCK/ITERATE; user sees flagged failures
 */
async function stepEvalGate(job, brief, agentDir) {
  const cfg = brief.evalConfig || {};
  const { validateOverrideFields, appendOverrideEvent, specHash } = require("./eval-gate-audit");
  const { captureProvenance } = require("./artifact-provenance");
  const { shouldEnforce } = require("./eval-gate-flags");
  // Capture provenance ONCE at gate entry. Any field change between here and
  // promotion is a bug (builds must be deterministic mid-step).
  const gateEntryProvenance = captureProvenance(brief, agentDir);

  // Feature-flag rollout check — honor per-tenant/env/tier disables before
  // running anything. Disabled = BLOCK stays (no promotion), not SHIP.
  const flagCheck = shouldEnforce({
    tenantId: brief.buildStatus?.azTenantId || brief.buildStatus?.tenantId,
    envId: brief.buildStatus?.environmentId || brief.buildStatus?.mcsEnvironmentId,
    riskTier: cfg.riskTier,
  });
  if (!flagCheck.enforce) {
    log(job, `[eval-gate] FLAG-DISABLED — gate not enforced: ${flagCheck.reason}`);
    brief.evalGate = {
      flagDisabled: true,
      flagReason: flagCheck.reason,
      verdict: "BLOCK",
      reason: `Eval gate disabled via feature flag — agent stays at published-internal until flag is enabled. (${flagCheck.reason})`,
      evaluatedAt: new Date().toISOString(),
      promotedTo: null,
      provenance: gateEntryProvenance,
    };
    await writeBrief(agentDir, brief);
    updateStep(job, "eval-gate", "skipped", `Flag disabled: ${flagCheck.reason}`);
    return;
  }

  // Override path — requires approvedBy + reason + ticketRef. Missing any → BLOCK.
  // Audit entry goes into knowledge/learnings/eval-gate-overrides.jsonl (hash-chained).
  if (cfg.skipGate === true) {
    const validation = validateOverrideFields(cfg);
    if (!validation.ok) {
      log(job, `[eval-gate] OVERRIDE REJECTED — skipGate=true but missing required approval fields:`);
      for (const m of validation.missing) log(job, `  - ${m}`);
      brief.evalGate = {
        override: false,
        verdict: "BLOCK",
        reason: `skipGate requested but approval fields missing: ${validation.missing.join("; ")}`,
        blockedAt: new Date().toISOString(),
        promotedTo: null,
      };
      await writeBrief(agentDir, brief);
      updateStep(job, "eval-gate", "failed", `Override rejected — ${validation.missing.length} required field(s) missing`);
      return;
    }
    const audit = appendOverrideEvent({
      projectId: job.projectId,
      agentId: job.agentId,
      brief,
      approvedBy: String(cfg.skipGateApprovedBy).trim(),
      reason: String(cfg.skipGateReason).trim(),
      ticketRef: String(cfg.skipGateTicketRef).trim(),
    });
    log(job, `[eval-gate] OVERRIDE APPROVED by ${audit.approvedBy} (ticket ${audit.ticketRef}) — audit chain entry ${audit.entryHash.slice(0, 12)}`);
    brief.buildStatus.status = "published-uat";
    brief.evalGate = {
      override: true,
      overrideApprovedBy: audit.approvedBy,
      overrideReason: audit.reason,
      overrideTicketRef: audit.ticketRef,
      overrideSpecHash: audit.specHash,
      overrideEntryHash: audit.entryHash,
      overrideAt: audit.timestamp,
      promotedTo: "published-uat",
      provenance: gateEntryProvenance,
    };
    await writeBrief(agentDir, brief);
    updateStep(job, "eval-gate", "completed", `OVERRIDE → published-uat (by ${audit.approvedBy}, ticket ${audit.ticketRef})`);
    return;
  }

  // No tests defined → block UAT, don't waste time running anything
  const totalTests = (brief.evalSets || []).reduce((s, e) => s + (e.tests || []).length, 0);
  if (totalTests === 0) {
    log(job, `[eval-gate] BLOCKED — no eval tests defined; agent stays at published-internal`);
    brief.evalGate = {
      override: false,
      verdict: "BLOCK",
      reason: "No eval tests defined",
      blockedAt: new Date().toISOString(),
      promotedTo: null,
    };
    await writeBrief(agentDir, brief);
    updateStep(job, "eval-gate", "failed", "No eval tests — UAT blocked");
    return;
  }

  // Run evals via shared eval-pipeline. The eval pipeline writes per-test
  // lastResult + evalConfig.lastVerdict to the agentspec on disk. We must
  // re-read after it completes — our in-memory `brief` is stale.
  updateStep(job, "eval-gate", "running", `Running ${totalTests} eval tests`);
  let verdict, evalJobId, evalErr;
  try {
    const baseDir = path.resolve(agentDir, "..", "..", "..", "..");
    const evalPipeline = require("./eval-pipeline");
    const result = await evalPipeline.runEvalForBuild(job.projectId, job.agentId, baseDir, {
      riskTier: cfg.riskTier,        // "demo" | "internal" | "production"
      thresholds: cfg.thresholds,    // explicit override wins over riskTier
    });
    verdict = result.verdict;
    evalJobId = result.jobId;
    evalErr = result.error;
    // CRITICAL: re-read the brief from disk so we pick up lastResult writes
    // from eval-pipeline. Without this, the final writeBrief() below clobbers
    // per-test results. Preserve our captured provenance and evalConfig carry-forward.
    const fresh = readBrief(agentDir);
    if (fresh) {
      // Replace the caller's brief reference fields we care about
      brief.evalSets = fresh.evalSets;
      brief.evalConfig = fresh.evalConfig;
    }
  } catch (err) {
    log(job, `[eval-gate] Eval pipeline failed: ${err.message}`);
    brief.evalGate = {
      override: false,
      verdict: "BLOCK",
      reason: `Eval execution failed: ${err.message}`,
      blockedAt: new Date().toISOString(),
      promotedTo: null,
    };
    await writeBrief(agentDir, brief);
    updateStep(job, "eval-gate", "failed", `Eval failed: ${err.message}`);
    return;
  }

  if (!verdict) {
    log(job, `[eval-gate] No verdict produced (eval err: ${evalErr || "unknown"})`);
    brief.evalGate = {
      override: false,
      verdict: "BLOCK",
      reason: `No verdict (${evalErr || "unknown"})`,
      blockedAt: new Date().toISOString(),
      promotedTo: null,
    };
    await writeBrief(agentDir, brief);
    updateStep(job, "eval-gate", "failed", "No verdict produced");
    return;
  }

  // Decision time
  const passed = verdict.verdict === "SHIP";
  brief.evalGate = {
    override: false,
    verdict: verdict.verdict,
    reason: verdict.reason,
    overallRate: verdict.overallRate,
    perSet: verdict.perSet,
    thresholds: verdict.thresholds,
    evaluatedAt: new Date().toISOString(),
    evalJobId,
    promotedTo: passed ? "published-uat" : null,
    provenance: gateEntryProvenance,
  };

  if (passed) {
    brief.buildStatus.status = "published-uat";
    log(job, `[eval-gate] SHIP — promoted to published-uat (${verdict.overallRate}%)`);
    updateStep(job, "eval-gate", "completed", `SHIP → published-uat (${verdict.overallRate}%)`);
  } else {
    log(job, `[eval-gate] ${verdict.verdict} — agent stays at published-internal: ${verdict.reason}`);
    updateStep(job, "eval-gate", "failed", `${verdict.verdict} — ${verdict.reason}`);
  }
  await writeBrief(agentDir, brief);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function runPipeline(job, agentDir) {
  try {
    const brief = readBrief(agentDir);
    if (!brief) throw new Error("agentspec.json not found");

    if (!brief.agent?.name) throw new Error("Missing agent name (agent.name)");

    const auth = await stepAuth(job, brief);
    await stepCreate(job, brief, agentDir, auth);
    await stepConfigure(job, brief, auth);
    await stepComponents(job, brief, agentDir, auth);
    await stepFlows(job, brief, agentDir, auth);
    await stepPublish(job, brief, auth);
    await stepVerify(job, brief, agentDir, auth);

    // Only attempt eval gate if publish actually succeeded — no point evaluating
    // a deploy that didn't reach MCS
    if (brief.buildStatus?.status === "published-internal") {
      await stepEvalGate(job, brief, agentDir);
    } else {
      updateStep(job, "eval-gate", "skipped", "Publish did not complete");
    }

    await writeBrief(agentDir, brief);
    const hasFailedSteps = job.steps.some(s => s.status === "failed");
    const success = !hasFailedSteps && job.errors.length === 0;
    completeJob(job, success, success
      ? `Build complete — ${brief.buildStatus?.status || "done"}`
      : `Build finished with errors: ${job.errors.join("; ")}`);
  } catch (err) {
    log(job, `Build failed: ${err.message}`);
    job.errors.push(err.message);
    completeJob(job, false, err.message);
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

function startBuildPipeline(projectId, agentId, baseDir) {
  if (!agentId) throw new Error("agentId required for build");

  // Dedup: return existing running job for same agent
  for (const [, existing] of _jobs) {
    if (existing.projectId === projectId && existing.agentId === agentId && existing.status === "running") {
      dev.info("build-pipeline", `Returning existing job ${existing.id}`);
      return existing;
    }
  }

  const agentDir = path.join(baseDir, "Build-Guides", projectId, "agents", agentId);
  if (!fs.existsSync(path.join(agentDir, "agentspec.json")) && !fs.existsSync(path.join(agentDir, "brief.json"))) {
    throw new Error("agentspec.json not found");
  }

  const job = createJob(projectId, agentId);
  dev.info("build-pipeline", `Starting job ${job.id}: build ${projectId}/${agentId}`);

  runPipeline(job, agentDir).catch((err) => {
    completeJob(job, false, err.message);
  });

  return job;
}

function getJob(jobId) { return _jobs.get(jobId) || null; }
function getJobLog(jobId) { const j = _jobs.get(jobId); return j ? j.rawLog : null; }
function listJobs() { return Array.from(_jobs.values()); }

module.exports = {
  startBuildPipeline,
  getJob,
  getJobLog,
  listJobs,
  // _testables: internal steps exposed for fixture-based integration tests only
  _testables: { stepEvalGate },
};
