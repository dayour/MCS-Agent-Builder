/**
 * Wizard Chat Handler — Conversational Agent Brief Builder
 *
 * Powers the /api/wizard/chat SSE endpoint.
 * Uses Claude via CLI (authenticated session — supports Opus 4.6)
 * to guide business users through creating an agent brief via
 * natural language conversation.
 *
 * Architecture: Hybrid engine
 *   - Claude (CLI) for natural language extraction + follow-ups
 *   - Simulated SSE streaming (CLI returns full response, streamed to client)
 *   - Deterministic parsing for WIZARD_STATE JSON extraction
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const knowledgeResolver = require("./knowledge-resolver");

// Load knowledge index at module init (non-blocking — graceful if missing)
knowledgeResolver.load();

// ---------------------------------------------------------------------------
// Claude LLM access — Direct Anthropic API (fast streaming) with CLI fallback
// ---------------------------------------------------------------------------

// Opus 4.6 for everything — quality and speed over cost
const CLAUDE_MODEL = process.env.WIZARD_CHAT_MODEL || process.env.WIZARD_MODEL || "opus";

const anthropicApi = require("../../tools/lib/anthropic");
const openaiApi = require("../../tools/lib/openai");

/** Resolve the Claude Code cli.js path and API key for spawning (legacy fallback). */
function getClaudeConfig() {
  // Find cli.js — check npm global install location
  const npmGlobal = path.join(os.homedir(), "AppData", "Roaming", "npm",
    "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  const cliPath = fs.existsSync(npmGlobal) ? npmGlobal : null;

  // Read API key from ~/.claude/config.json
  let apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    try {
      const configPath = path.join(os.homedir(), ".claude", "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      apiKey = config.primaryApiKey || "";
    } catch { /* ignore */ }
  }

  return { cliPath, apiKey };
}

const _claudeConfig = getClaudeConfig();

function isConfigured() {
  // Direct API is primary; CLI is fallback
  return anthropicApi.isConfigured() || (!!_claudeConfig.cliPath && !!_claudeConfig.apiKey);
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const WIZARD_SYSTEM_PROMPT = `You are the MCS Agent Builder Wizard — a friendly, expert consultant who helps business users create a Microsoft Copilot Studio agent brief through conversation.

## Your Job
Guide the user through defining their agent. Extract structured information from their natural language and organize it into 8 sections. Be warm, concise, and never use technical jargon.

## Response Format
Every response MUST end with a WIZARD_STATE JSON block. The conversational text comes first, then the state block separated by the delimiter.

\`\`\`
[Your conversational response — 2-4 sentences, then your question]

---WIZARD_STATE---
{
  "sections": {
    "business": "not_started|in_progress|complete",
    "identity": "not_started|in_progress|complete",
    "capabilities": "not_started|in_progress|complete",
    "integrations": "not_started|in_progress|complete",
    "knowledge": "not_started|in_progress|complete",
    "boundaries": "not_started|in_progress|complete",
    "conversations": "not_started|in_progress|complete",
    "architecture": "not_started|in_progress|complete"
  },
  "draft": { ... },
  "suggestions": [
    {"label": "chip text", "value": "full message to send", "type": "text|example|skip"}
  ],
  "activeSection": "business|identity|capabilities|integrations|knowledge|boundaries|conversations|architecture|null",
  "readyToSave": false
}
\`\`\`

## Section Extraction Rules

### business
- \`useCase\`: One-line summary (e.g., "Internal HR support agent")
- \`problemStatement\`: 2-3 sentences about the pain point
- \`challenges\`: Array of business problems this solves
- \`benefits\`: Array of expected outcomes
- \`successCriteria\`: Array of measurable metrics

### identity
- \`name\`: Professional agent name (suggest 2-3 options if user is unsure)
- \`description\`: What it does + for whom (1 sentence)
- \`persona\`: Tone and personality (friendly, professional, expert, concierge)
- \`responseFormat\`: How it structures answers (bullet points, tables, cards)
- \`primaryUsers\`: Who uses it most
- \`secondaryUsers\`: Other users

### capabilities
Array of objects:
- \`name\`: Clear capability name (e.g., "Answer policy questions")
- \`description\`: What this capability does
- \`phase\`: "mvp" (must-have for launch) or "future" (nice-to-have later)

### integrations
Array of objects:
- \`name\`: System name (SharePoint, Salesforce, ServiceNow, etc.)
- \`type\`: "connector" | "mcp" | "flow" | "ai-tool" | "custom-connector" | "setting"
- \`purpose\`: What data or actions this provides

**Work IQ shortcut:** If the user mentions ANY M365 data (email, calendar, teams, sharepoint, files, people, org chart), suggest "We'll add Work IQ which covers all Microsoft 365 data in one step." Add integrations named "Work IQ Copilot" (type: "mcp") and "Work IQ User" (type: "mcp"). Do NOT suggest individual M365 connectors or servers.

### knowledge
Array of objects:
- \`name\`: Source name or URL
- \`type\`: "SharePoint" | "Uploaded files" | "Dataverse" | "Public websites" | "Graph connectors"
- \`purpose\`: What questions this source answers

**Note:** If knowledge lives in SharePoint, OneDrive, or other M365 locations, Work IQ Copilot (added via integrations) already searches these. Only add explicit knowledge sources for uploaded files, Dataverse tables, or public websites that Work IQ doesn't cover.

### boundaries
- \`handle\`: Array of topics the agent confidently handles
- \`decline\`: Array of {topic, redirect} — topics to politely redirect
- \`refuse\`: Array of {topic, reason} — hard stops the agent must never do

### conversations
Array of objects:
- \`name\`: Topic name (e.g., "Order Lookup")
- \`description\`: What this conversation flow does — mention "adaptive card" if it should display structured data
- \`triggerType\`: "agent-chooses" | "phrases" | "fallback" | "redirect" | "escalation"
- \`outputFormat\`: "adaptive-card" for topics that display structured data (comparisons, dashboards, checklists, summaries) or "text" for plain responses. Default to "adaptive-card" when the topic shows tabular, side-by-side, or structured information.

### architecture
- \`type\`: "single-agent" (default unless 3+ clearly separate domains) or "multi-agent"
- \`channels\`: Array of where users interact (e.g., ["Microsoft Teams", "Web chat"])
- \`triggers\`: Array of {type, description} (e.g., {type: "Conversational", description: "User starts a chat"})

## Conversation Rules

1. **Cumulative state**: ALWAYS include ALL previously extracted data in the draft. Never lose data between turns.
2. **Mark sections correctly**:
   - "complete" = enough useful information captured
   - "in_progress" = partial information
   - "not_started" = nothing captured yet
3. **Provide 2-4 suggestion chips** that help the user answer the current question. Include at least one "skip" type for optional sections.
4. **Be brief**: 2-4 sentences max, then ask ONE focused question.
5. **Default to single-agent** unless user describes clearly separate domains.
6. **Never invent data** — ask rather than assume. Use the user's own words.
7. **Business language only** — say "connect to" not "integrate with", say "trusted information" not "knowledge sources", say "sign in" not "OAuth".
8. **readyToSave = true** when business + identity + capabilities + boundaries all have status "complete".
9. **Rich first answer**: If user gives a detailed description upfront, extract as many fields as possible across all sections at once, then ask follow-ups only for gaps.
10. **"I don't know" handling**: Offer defaults and examples, never dead ends. Suggest common patterns.
`;

const INTERVIEW_MODE_ADDENDUM = `
## Mode: Interview
Walk through sections one at a time in this order:
1. Business — "What problem does this solve? Who experiences it?"
2. Identity — "What should we call this agent? What tone should it have?"
3. Capabilities — "What are the top 3-5 things it must do on day one?"
4. Integrations — "Does it need to connect to any systems?"
5. Knowledge — "Where does the trusted information live?"
6. Boundaries — "What should it never do? What should it hand off to a human?"
7. Conversations — "What are the main topics people will ask about?"
8. Architecture — "Where should people use this agent?"

Start each new section with a brief transition: "Great, let's talk about [next topic]."
Ask 1-2 focused questions per section before moving on.
`;

const FUZZY_MODE_ADDENDUM = `
## Mode: Fuzzy Create
The user may describe everything at once in a single message. Extract ALL available information across all sections simultaneously. Then identify gaps and ask follow-up questions only for missing critical sections (business, identity, capabilities, boundaries).

For optional sections with no info, mark as "not_started" and suggest the user can add them later.
`;

// ---------------------------------------------------------------------------
// WIZARD_STATE Parsing
// ---------------------------------------------------------------------------

/**
 * Parse WIZARD_STATE JSON from LLM response.
 * Tries delimiter first, then regex fallback.
 * @param {string} fullResponse
 * @returns {{ text: string, state: object|null }}
 */
function parseWizardResponse(fullResponse) {
  // Try delimiter-based split first
  const delimiterIdx = fullResponse.indexOf("---WIZARD_STATE---");
  if (delimiterIdx !== -1) {
    const text = fullResponse.substring(0, delimiterIdx).trim();
    const jsonStr = fullResponse.substring(delimiterIdx + "---WIZARD_STATE---".length).trim();
    const state = safeParseJSON(jsonStr);
    return { text, state };
  }

  // Fallback: regex for JSON block with "sections" key
  const match = fullResponse.match(/\{[\s\S]*"sections"[\s\S]*"draft"[\s\S]*\}/);
  if (match) {
    const jsonStr = match[0];
    const text = fullResponse.replace(jsonStr, "").trim();
    const state = safeParseJSON(jsonStr);
    return { text, state };
  }

  // No state found — return full text as conversation
  return { text: fullResponse.trim(), state: null };
}

/**
 * Safely parse JSON with repair for common LLM output issues.
 */
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    // Try to repair: remove trailing commas, fix unescaped quotes
    try {
      const repaired = str
        .replace(/,\s*([}\]])/g, "$1")           // trailing commas
        .replace(/```json?\s*/g, "")               // code fence start
        .replace(/```\s*/g, "")                    // code fence end
        .replace(/[\x00-\x1F\x7F]/g, " ");        // control characters
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * Merge LLM draft with existing draft (union, LLM wins on conflicts).
 * Prevents data loss if LLM forgets previously extracted fields.
 */
/**
 * Merge parsed wizard state with current state — shared by chat and prefetch handlers.
 */
function mergeWizardState(currentState, parsedState) {
  if (!parsedState) return currentState || parsedState;
  if (!currentState) return parsedState;
  return {
    sections: { ...(currentState.sections || {}), ...(parsedState.sections || {}) },
    draft: mergeDrafts(currentState.draft || {}, parsedState.draft || {}),
    suggestions: parsedState.suggestions || currentState.suggestions || [],
    activeSection: parsedState.activeSection ?? currentState.activeSection,
    readyToSave: parsedState.readyToSave ?? currentState.readyToSave ?? false,
  };
}

function mergeDrafts(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const merged = JSON.parse(JSON.stringify(existing));

  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      // For arrays: use incoming if non-empty, keep existing otherwise
      if (val.length > 0) merged[key] = val;
    } else if (typeof val === "object") {
      // For objects: deep merge
      merged[key] = mergeDrafts(merged[key] || {}, val);
    } else {
      // Primitives: LLM wins
      merged[key] = val;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Draft → Brief.json Conversion
// ---------------------------------------------------------------------------

/**
 * Convert WizardDraft to standard ApiBrief format for writing to brief.json.
 */
function draftToBrief(draft, agentName) {
  const d = draft || {};
  const biz = d.business || {};
  const id = d.identity || {};
  const caps = d.capabilities || [];
  const integ = d.integrations || [];
  const know = d.knowledge || [];
  const bounds = d.boundaries || {};
  const convos = d.conversations || [];
  const arch = d.architecture || {};

  return {
    _schema: "2.0",
    workflow: {
      phase: "preview",
      previewConfirmed: false,
      decisionsConfirmed: false,
      previewGeneratedAt: new Date().toISOString(),
      researchCompletedAt: null,
      evalStubsGeneratedAt: null,
    },
    business: {
      useCase: biz.useCase || "",
      problemStatement: biz.problemStatement || "",
      challenges: (biz.challenges || []).map((c) =>
        typeof c === "string" ? { challenge: c, impact: "medium" } : c
      ),
      benefits: (biz.benefits || []).map((b) =>
        typeof b === "string" ? { benefit: b, type: "experience" } : b
      ),
      successCriteria: (biz.successCriteria || []).map((s) =>
        typeof s === "string" ? { metric: s, target: "", measurementMethod: "" } : s
      ),
      stakeholders: { sponsor: "", owner: "", users: id.primaryUsers || "" },
      licensing: {
        m365Copilot: "yes",
        copilotStudio: "yes",
        frontierProgram: "yes",
        anthropicSubprocessor: "yes",
        powerPlatformPremium: "yes",
        dynamicsLicense: "other",
        notes: "Assumed max licensing",
      },
    },
    agent: {
      name: id.name || agentName || "New Agent",
      description: id.description || "",
      persona: id.persona || "",
      responseFormat: id.responseFormat || "",
      primaryUsers: id.primaryUsers || "",
      secondaryUsers: id.secondaryUsers || "",
    },
    capabilities: caps.map((c) => {
      // Use resolver to suggest implementation type if available
      const resolved = knowledgeResolver.isHealthy()
        ? knowledgeResolver.resolveCapabilities([c])[0]
        : null;
      return {
        name: c.name || "",
        description: c.description || "",
        phase: c.phase || "mvp",
        implementationType: resolved?.suggestedType || "prompt",
        source: "wizard",
        status: "not_started",
        ...(resolved?.matchedPattern ? { _patternMatch: resolved.matchedPattern.id } : {}),
      };
    }),
    integrations: (() => {
      // Resolve integrations and auto-inject Work IQ for any M365 data
      const mapped = integ.map((i) => {
        const resolved = knowledgeResolver.isHealthy()
          ? knowledgeResolver.resolveIntegrations([i])[0]
          : null;
        const topMatch = resolved?.resolved?.[0];
        return {
          name: i.name || "",
          type: resolved?.suggestedType || i.type || "connector",
          purpose: i.purpose || "",
          dataProvided: "",
          authMethod: "",
          status: "needs-setup",
          phase: "mvp",
          ...(topMatch ? { _resolvedTo: topMatch.name, _resolvedType: topMatch.type } : {}),
          ...(resolved?.workiqRecommended ? { _workiq: resolved.workiqRecommended } : {}),
        };
      });

      // Auto-add Work IQ Copilot + Work IQ User if any M365 integration detected
      const hasM365 = mapped.some((i) => i._workiq);
      if (hasM365) {
        const hasWorkIQCopilot = mapped.some((i) => i.name.toLowerCase().includes("work iq copilot"));
        const hasWorkIQUser = mapped.some((i) => i.name.toLowerCase().includes("work iq user"));
        if (!hasWorkIQCopilot) {
          mapped.push({
            name: "Work IQ Copilot",
            type: "mcp",
            purpose: "Cross-M365 search and actions (mail, calendar, teams, sharepoint, files)",
            dataProvided: "All M365 data",
            authMethod: "OAuth (M365 Copilot license)",
            status: "needs-setup",
            phase: "mvp",
            _resolvedTo: "Work IQ Copilot",
            _resolvedType: "mcp",
            _autoAdded: true,
          });
        }
        if (!hasWorkIQUser) {
          mapped.push({
            name: "Work IQ User",
            type: "mcp",
            purpose: "People, org chart, manager, direct reports, user location",
            dataProvided: "User profiles and org structure",
            authMethod: "OAuth (M365 Copilot license)",
            status: "needs-setup",
            phase: "mvp",
            _resolvedTo: "Work IQ User",
            _resolvedType: "mcp",
            _autoAdded: true,
          });
        }
      }
      return mapped;
    })(),
    knowledge: know.map((k) => {
      const resolved = knowledgeResolver.isHealthy()
        ? knowledgeResolver.resolveKnowledge([k])[0]
        : null;
      return {
        name: k.name || "",
        type: resolved?.suggestedType || k.type || "SharePoint",
        purpose: k.purpose || "",
        scope: "",
        status: "needs-setup",
        phase: "mvp",
      };
    }),
    conversations: {
      topics: convos.map((t) => {
        // Detect adaptive card topics from description keywords
        const desc = (t.description || "").toLowerCase();
        const hasCard = desc.includes("adaptive card") || desc.includes("card") ||
          desc.includes("dashboard") || desc.includes("side-by-side") ||
          desc.includes("checklist") || desc.includes("summary card") ||
          t.outputFormat === "adaptive-card";
        return {
          name: t.name || "",
          schemaName: "",
          description: t.description || "",
          triggerType: t.triggerType || "agent-chooses",
          triggerPhrases: [],
          topicType: "generative",
          phase: "mvp",
          implements: [],
          variables: [],
          connectedIntegrations: [],
          outputFormat: hasCard ? "adaptive-card" : "text",
        };
      }),
      starters: [],
    },
    boundaries: {
      handle: bounds.handle || [],
      decline: (bounds.decline || []).map((d) => ({
        topic: d.topic || d,
        redirect: d.redirect || "",
        source: "wizard",
      })),
      refuse: (bounds.refuse || []).map((r) => ({
        topic: r.topic || r,
        reason: r.reason || "",
        source: "wizard",
      })),
    },
    architecture: (() => {
      // Use resolver for build path and channel suggestions
      const buildPathResult = knowledgeResolver.isHealthy()
        ? knowledgeResolver.suggestBuildPath(d)
        : null;
      const channelSuggestions = knowledgeResolver.isHealthy() && id.primaryUsers
        ? knowledgeResolver.suggestChannels(id.primaryUsers)
        : null;
      const existingChannels = (arch.channels || []).map((ch) =>
        typeof ch === "string" ? { name: ch, reason: "" } : ch
      );
      return {
        solutionType: "agent",
        solutionTypeScore: null,
        solutionTypeFactors: null,
        solutionTypeReason: "Wizard-generated — enrichment will run full analysis",
        buildPath: buildPathResult?.buildPath || "custom-agent",
        buildPathReason: buildPathResult?.reason || "",
        type: arch.type || "single-agent",
        reason: "",
        factors: null,
        score: null,
        channels: existingChannels.length > 0
          ? existingChannels
          : (channelSuggestions || [{ name: "Microsoft Teams", reason: "Default" }]).map((ch) => ({
              name: ch.name, reason: ch.reason || "",
            })),
        triggers: arch.triggers || [
          { type: "Conversational", description: "User-initiated chat" },
        ],
        children: [],
      };
    })(),
    evalSets: [],
    evalConfig: {
      targetPassRate: 85,
      mode: "reference-templates",
    },
    decisions: [],
    openQuestions: [],
    instructions: "",
    recommendations: [],
    notes: {},
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// SSE Helpers
// ---------------------------------------------------------------------------

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Route model call to the appropriate provider (Claude API, GPT, or CLI fallback).
 *
 * Direct API: ~2-6s total (real streaming, TTFT ~0.6-2.4s depending on model)
 * CLI fallback: ~30s total (fake streaming after full response)
 *
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} res - Express response (SSE)
 * @returns {Promise<string>} Full response text
 */
async function streamModelResponse(systemPrompt, messages, res, effectiveModel) {
  // GPT-5.4 path: route through openai.js (non-streaming)
  if (effectiveModel === "gpt-5.4") {
    return streamGPTResponse(systemPrompt, messages, res);
  }

  // Primary path: Direct Anthropic API with real streaming
  if (anthropicApi.isConfigured()) {
    return streamClaudeResponseDirect(systemPrompt, messages, effectiveModel, res);
  }

  // Fallback: CLI subprocess (legacy path)
  return streamClaudeResponseCLI(systemPrompt, messages, res);
}

/**
 * Direct Anthropic API streaming — real token-by-token SSE delivery.
 */
async function streamClaudeResponseDirect(systemPrompt, messages, effectiveModel, res) {
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  let fullText = "";

  for await (const event of anthropicApi.streamCompletion(apiMessages, {
    model: effectiveModel || CLAUDE_MODEL,
    maxTokens: 16384,
    timeout: 180000,
    cacheSystem: true, // Cache the system prompt (wizard prompt is large + stable)
  })) {
    if (event.type === "fallback") {
      console.log(`[wizard] Model fallback: ${event.message} (${CLAUDE_MODEL} not accessible)`);
    }
    if (event.type === "text") {
      fullText += event.text;
      // Only stream conversational text (before ---WIZARD_STATE---) to the client
      if (!fullText.includes("---WIZARD_STATE---")) {
        sendSSE(res, { type: "token", text: event.text });
      }
    }
  }

  return fullText;
}

/**
 * Legacy CLI subprocess fallback — fake streaming after full response.
 */
function streamClaudeResponseCLI(systemPrompt, messages, res) {
  return new Promise((resolve, reject) => {
    const { cliPath, apiKey } = _claudeConfig;
    if (!cliPath || !apiKey) {
      return reject(new Error("Claude not configured — ensure Claude Code is logged in"));
    }

    // Build the user prompt from conversation messages
    const formattedMessages = messages.map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      return `${role}: ${m.content}`;
    }).join("\n\n");

    const args = [
      cliPath,
      "-p", formattedMessages,
      "--model", CLAUDE_MODEL,
      "--system-prompt", systemPrompt,
      "--no-session-persistence",
      "--bare",
    ];

    const child = spawn(process.execPath, args, {
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
    });
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`claude CLI exit ${code}: ${stderr.substring(0, 300)}`));
      }

      const fullText = stdout.trim();

      // Simulate token streaming for the conversational part
      const delimIdx = fullText.indexOf("---WIZARD_STATE---");
      const conversationalText = delimIdx !== -1
        ? fullText.substring(0, delimIdx).trim()
        : fullText;

      // Stream in word-sized chunks for responsive UX
      const chunks = conversationalText.match(/.{1,8}/gs) || [];
      for (const chunk of chunks) {
        sendSSE(res, { type: "token", text: chunk });
      }

      resolve(fullText);
    });

    child.on("error", (err) => {
      reject(new Error(`claude CLI spawn error: ${err.message}`));
    });
  });
}

/**
 * GPT-5.4 response via openai.js — non-streaming (chatCompletion returns full response).
 * Simulates streaming by chunking the response into SSE tokens.
 */
async function streamGPTResponse(systemPrompt, messages, res) {
  if (!openaiApi.isConfigured()) {
    throw new Error("GPT-5.4 not configured. Run: gh auth login && gh auth refresh --scopes copilot");
  }

  const gptMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const result = await openaiApi.chatCompletion(gptMessages, {
    maxTokens: 16384,
    timeout: 180000,
  });

  const fullText = result.content || "";

  // Simulate streaming — chunk conversational text to SSE client
  const delimiterIdx = fullText.indexOf("---WIZARD_STATE---");
  const conversationalText = delimiterIdx >= 0 ? fullText.slice(0, delimiterIdx) : fullText;
  const chunks = conversationalText.match(/.{1,12}/gs) || [];
  for (const chunk of chunks) {
    sendSSE(res, { type: "token", text: chunk });
  }

  return fullText;
}

// ---------------------------------------------------------------------------
// Conversation History Truncation
// ---------------------------------------------------------------------------

/**
 * Keep last N messages + summarize earlier ones as system context.
 */
// In-memory rolling summary cache (keyed by message count to refresh periodically)
const _rollingSummaryCache = new Map();

/**
 * Build a rolling summary of earlier messages using a lightweight LLM call,
 * keeping the last few messages in full. Falls back to naive truncation
 * if the summary call fails or isn't available.
 */
async function truncateHistory(messages, maxMessages = 16) {
  if (messages.length <= maxMessages) return messages;

  const recentCount = Math.min(6, maxMessages);
  const early = messages.slice(0, messages.length - recentCount);
  const recent = messages.slice(messages.length - recentCount);

  // Check cache — keyed by content hash of early messages to avoid cross-request collisions
  const crypto = require("crypto");
  const cacheKey = crypto.createHash("md5")
    .update(early.map((m) => `${m.role}:${m.content.substring(0, 100)}`).join("|"))
    .digest("hex")
    .substring(0, 12);
  const cached = _rollingSummaryCache.get(cacheKey);
  if (cached) {
    return [{ role: "system", content: cached }, ...recent];
  }

  // Attempt LLM-powered summary using Haiku (fast + cheap)
  try {
    if (anthropicApi.isConfigured()) {
      const conversationText = early
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 300)}`)
        .join("\n\n");

      const result = await anthropicApi.chatCompletion(
        [
          { role: "system", content: "Summarize this wizard conversation into a concise brief (max 400 words). Focus on: decisions made, data extracted, sections discussed, and what the user wants to build." },
          { role: "user", content: conversationText },
        ],
        { model: "haiku", maxTokens: 1024, timeout: 15000 }
      );

      const summary = `[Conversation Summary — ${early.length} earlier messages]\n${result.content}`;
      _rollingSummaryCache.set(cacheKey, summary);
      // Keep cache small — only last 5 entries
      if (_rollingSummaryCache.size > 5) {
        const oldest = _rollingSummaryCache.keys().next().value;
        _rollingSummaryCache.delete(oldest);
      }
      return [{ role: "system", content: summary }, ...recent];
    }
  } catch (e) {
    console.warn("[wizard] Rolling summary failed, using naive truncation:", e.message);
  }

  // Fallback: naive truncation
  const summaryParts = early
    .filter((m) => m.role === "user")
    .map((m) => `User said: ${m.content.substring(0, 200)}`);
  return [
    { role: "system", content: `[Earlier conversation summary]\n${summaryParts.join("\n")}` },
    ...recent,
  ];
}

// ---------------------------------------------------------------------------
// Document Context — reads uploaded docs for the wizard to reference
// ---------------------------------------------------------------------------

const { extractContent } = require("./documents");

/** Max total characters of doc content injected into the prompt. */
const MAX_DOC_CONTEXT_CHARS = 30_000;

/**
 * Read uploaded documents for a project and build a context string.
 * Skips binary files (images, PDFs) — only includes text-extractable content.
 * Truncates to MAX_DOC_CONTEXT_CHARS to avoid blowing up the prompt.
 */
async function buildDocContext(projectId) {
  // Validate projectId — alphanumeric, hyphens, underscores only (no path traversal)
  if (!projectId || !/^[\w-]+$/.test(projectId)) return "";

  const BUILD_GUIDES = path.join(path.resolve(__dirname, ".."), "Build-Guides");
  const docsDir = path.join(BUILD_GUIDES, projectId, "docs");

  // Path containment check
  if (!path.resolve(docsDir).startsWith(path.resolve(BUILD_GUIDES))) return "";

  if (!fs.existsSync(docsDir)) return "";

  let files;
  try {
    files = fs.readdirSync(docsDir).filter((f) => {
      const stat = fs.statSync(path.join(docsDir, f));
      return stat.isFile();
    });
  } catch {
    return "";
  }

  if (files.length === 0) return "";

  // Skip pure binary types — images, PDFs can't be usefully injected as text
  const SKIP_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".pdf"]);

  const docSections = [];
  let totalChars = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) {
      docSections.push(`### ${file}\n*(Binary file — not included in text context)*`);
      continue;
    }

    try {
      const result = await extractContent(path.join(docsDir, file));
      if (result.content) {
        const remaining = MAX_DOC_CONTEXT_CHARS - totalChars;
        if (remaining <= 0) {
          docSections.push(`### ${file}\n*(Truncated — document context limit reached)*`);
          continue;
        }
        const content = result.content.length > remaining
          ? result.content.slice(0, remaining) + "\n...(truncated)"
          : result.content;
        totalChars += content.length;
        docSections.push(`### ${file}\n\`\`\`\n${content}\n\`\`\``);
      }
    } catch {
      docSections.push(`### ${file}\n*(Could not extract content)*`);
    }
  }

  if (docSections.length === 0) return "";

  return `\n\n## Uploaded Documents\nThe user has uploaded ${files.length} file(s). Reference these when the user asks about their files, or use them to inform the agent brief. Summarize relevant content — don't regurgitate entire files.\n\n${docSections.join("\n\n")}\n`;
}

// ---------------------------------------------------------------------------
// Shared System Prompt Builder (used by chat + prefetch)
// ---------------------------------------------------------------------------

async function buildSystemPrompt(mode, currentState, projectId) {
  const modeAddendum = mode === "fuzzy" ? FUZZY_MODE_ADDENDUM : INTERVIEW_MODE_ADDENDUM;

  let stateContext = "";
  if (currentState && currentState.draft) {
    stateContext = `\n\n## Current Brief State\nThe user has already provided the following information. Include ALL of this in your draft (cumulative — never lose data):\n\`\`\`json\n${JSON.stringify(currentState.draft, null, 2)}\n\`\`\`\n\nSection statuses: ${JSON.stringify(currentState.sections)}\n`;
  }

  let docContext = "";
  if (projectId) {
    docContext = await buildDocContext(projectId);
  }

  const cheatSheet = knowledgeResolver.isHealthy()
    ? `\n\n## MCS Component Knowledge\nUse this reference to suggest specific components when the user describes capabilities or integrations. For ANY M365 data need (email, calendar, teams, sharepoint, files, people, org chart), recommend adding Work IQ from the agent overview page — this gives 2 MCP servers that cover everything: Work IQ Copilot (all M365 data) and Work IQ User (people and org). Don't suggest individual M365 servers or connectors. For non-M365 systems (Salesforce, ServiceNow, Dynamics 365, etc.), mention specific connectors or MCP servers. Don't dump the full list — only reference what's relevant to the current question.\n\n${knowledgeResolver.getCheatSheet()}\n`
    : "";

  // Static content first for cache hits, dynamic stateContext last
  return WIZARD_SYSTEM_PROMPT + modeAddendum + cheatSheet + docContext + stateContext;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/wizard/chat — SSE streaming wizard conversation
 */
async function handleWizardChat(req, res) {
  // Validate Claude availability
  if (!isConfigured()) {
    return res.status(503).json({
      detail:
        "Claude not configured. Install Claude Code and run: claude auth login",
    });
  }

  const { mode = "interview", messages = [], currentState, projectId, model } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res
      .status(400)
      .json({ detail: "messages array required with at least one message" });
  }

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  sendSSE(res, { type: "started" });

  try {
    // Build system prompt (shared helper — also used by prefetch)
    const systemPrompt = await buildSystemPrompt(mode, currentState, projectId);

    // Prepare messages — filter to user/assistant only, truncate history
    const truncated = await truncateHistory(
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }))
    );

    // Call LLM (Claude or GPT), stream tokens to SSE client
    const effectiveModel = model || CLAUDE_MODEL;
    const fullResponse = await streamModelResponse(systemPrompt, truncated, res, effectiveModel);

    // Parse the complete response for WIZARD_STATE
    // (conversational text already streamed via SSE — only state is needed here)
    const { state } = parseWizardResponse(fullResponse);

    // Merge state to prevent data loss
    let mergedState = mergeWizardState(currentState, state);

    // Run knowledge resolver on the draft for inline component resolution
    if (mergedState && mergedState.draft && knowledgeResolver.isHealthy()) {
      const resolution = knowledgeResolver.resolveDraft(mergedState.draft);
      mergedState._resolution = resolution;
    }

    // Send the parsed state
    if (mergedState) {
      sendSSE(res, { type: "state", wizardState: mergedState });
    }

    sendSSE(res, { type: "done" });
  } catch (err) {
    console.error("[wizard] Chat error:", err.message);
    sendSSE(res, { type: "error", detail: err.message });
  }

  res.end();
}

/**
 * POST /api/wizard/save — Create project + agent + write brief.json
 */
function handleWizardSave(req, res, buildGuidesDir) {
  const { projectName, agentName, draft } = req.body;

  if (!projectName || !projectName.trim()) {
    return res.status(400).json({ detail: "projectName required" });
  }
  if (!agentName || !agentName.trim()) {
    return res.status(400).json({ detail: "agentName required" });
  }

  // Validate minimum brief content
  const d = draft || {};
  if (!d.identity?.name && !agentName) {
    return res.status(400).json({ detail: "Agent name is required" });
  }
  if (!d.business?.useCase) {
    return res
      .status(400)
      .json({ detail: "Use case is required — tell us what the agent does" });
  }

  try {
    // Create project folder
    const projectSlug = projectName
      .trim()
      .replace(/ /g, "-")
      .replace(/[^\w-]/g, "");
    if (!projectSlug) {
      return res.status(400).json({ detail: "Project name produces empty slug" });
    }
    const projectDir = path.join(buildGuidesDir, projectSlug);
    fs.mkdirSync(path.join(projectDir, "docs"), { recursive: true });

    // Create agent folder
    const agentSlug = agentName
      .trim()
      .replace(/ /g, "-")
      .replace(/[^\w-]/g, "");
    if (!agentSlug) {
      return res.status(400).json({ detail: "Agent name produces empty slug" });
    }
    const agentDir = path.join(projectDir, "agents", agentSlug);
    fs.mkdirSync(agentDir, { recursive: true });

    // Convert draft to brief.json format
    const brief = draftToBrief(draft, agentName.trim());

    // Write brief.json
    const briefPath = path.join(agentDir, "brief.json");
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2), "utf-8");

    res.json({
      projectId: projectSlug,
      agentId: agentSlug,
      projectName: projectName.trim(),
      agentName: agentName.trim(),
      briefPath: `Build-Guides/${projectSlug}/agents/${agentSlug}/brief.json`,
    });
  } catch (err) {
    console.error("[wizard] Save error:", err.message);
    res.status(500).json({ detail: `Save failed: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// Prefetch — Speculative next-question generation
// ---------------------------------------------------------------------------

/**
 * POST /api/wizard/prefetch — Non-streaming JSON response.
 * Generates the likely next wizard question in the background so the
 * client can serve it instantly when the user responds.
 *
 * Returns: { text, state, prefetchKey }
 * prefetchKey = hash of activeSection + section statuses, used to validate cache hits.
 */
async function handleWizardPrefetch(req, res) {
  const { mode, messages, currentState, projectId, model } = req.body || {};

  if (!messages || !messages.length) {
    return res.status(400).json({ detail: "messages array required" });
  }

  // Build a prefetch key from section state — invalidated when sections change
  const crypto = require("crypto");
  const keySource = JSON.stringify({
    active: currentState?.activeSection,
    sections: currentState?.sections,
  });
  const prefetchKey = crypto.createHash("md5").update(keySource).digest("hex").substring(0, 16);

  try {
    const systemPrompt = await buildSystemPrompt(mode || "interview", currentState || {}, projectId);

    // Add a speculative "continue" user message to prompt the next question
    const truncated = await truncateHistory(
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }))
    );
    truncated.push({
      role: "user",
      content: "Continue to the next question or topic.",
    });

    const effectiveModel = model || CLAUDE_MODEL;

    // Use the prefetch model setting or fall back to Haiku for speed/cost
    const prefetchModel = effectiveModel === "gpt-5.4" ? effectiveModel : "haiku";

    let fullText;
    if (prefetchModel === "gpt-5.4" && openaiApi.isConfigured()) {
      const gptMessages = [
        { role: "system", content: systemPrompt },
        ...truncated,
      ];
      const result = await openaiApi.chatCompletion(gptMessages, {
        maxTokens: 8192,
        timeout: 60000,
      });
      fullText = result.content || "";
    } else if (anthropicApi.isConfigured()) {
      const result = await anthropicApi.chatCompletion(
        [{ role: "system", content: systemPrompt }, ...truncated],
        { model: prefetchModel, maxTokens: 8192, timeout: 60000 }
      );
      fullText = result.content || "";
    } else {
      return res.status(503).json({ detail: "No LLM configured for prefetch" });
    }

    const { text, state } = parseWizardResponse(fullText);

    // Merge state using shared helper
    const mergedState = mergeWizardState(currentState, state);

    res.json({ text, state: mergedState, prefetchKey });
  } catch (err) {
    console.error("[wizard] Prefetch error:", err.message);
    res.status(500).json({ detail: err.message });
  }
}

module.exports = {
  handleWizardChat,
  handleWizardSave,
  handleWizardPrefetch,
  draftToBrief,
  parseWizardResponse,
  mergeDrafts,
};
