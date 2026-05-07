/**
 * flow-spec — pure helpers for the agentspec.json `flows[]` array.
 *
 * Schema (templates/agentspec.json `flows[]`):
 *   - name           (kebab-case, unique within flows[]) — used for cross-refs
 *   - displayName
 *   - kind           ('ai-tool' | 'agent-flow')
 *   - phase          ('mvp' | 'future')
 *   - status         ('draft' | 'created' | 'published' | 'failed')
 *   - id             Dataverse workflowid (populated after create)
 *   - implements[]   capability names this flow implements
 *   - connectionRefs map of connector apiName → connection reference logical name
 *   - aiToolSpec     required when kind='ai-tool'  (plan, connectors[], outputSchema)
 *   - agentFlowSpec  required when kind='agent-flow' (trigger, actions[])
 *   - lastSyncedAt   ISO timestamp set by build pipeline after Dataverse confirms state
 *   - lastBuildError last error string, if status='failed'
 *
 * This module is pure — no I/O, no token, no Dataverse calls. Used by
 *   - /mcs-research enrichment to seed flows[] from documents
 *   - /mcs-build pipeline to topo-sort and execute creates in dependency order
 *   - /mcs-fix to surface schema issues
 */

const crypto = require("node:crypto");

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const VALID_KINDS = new Set(["ai-tool", "agent-flow"]);
const VALID_PHASES = new Set(["mvp", "future"]);
const VALID_STATUSES = new Set(["draft", "created", "published", "failed"]);
const VALID_TRIGGER_TYPES = new Set([
  "manual", "recurrence", "http", "skills", "event",
]);

/**
 * Validate the flows[] array.
 *
 * @param {Array} flows - The flows array (may be undefined; treated as empty)
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateFlows(flows) {
  const errors = [];
  const warnings = [];
  if (flows === undefined || flows === null) return { valid: true, errors, warnings };
  if (!Array.isArray(flows)) {
    return { valid: false, errors: ["flows must be an array"], warnings };
  }

  // Build a name → flow index for cross-ref validation. Skip the template stub
  // (whose name is the placeholder description) so it doesn't pollute the index.
  const namedFlows = flows.filter((f, i) => isRealFlow(f, i));
  const nameIndex = new Map();
  for (const f of namedFlows) {
    if (nameIndex.has(f.name)) {
      errors.push(`Duplicate flow name '${f.name}' — names must be unique within flows[]`);
    } else {
      nameIndex.set(f.name, f);
    }
  }

  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    if (!isRealFlow(f, i)) continue; // Skip template stubs

    const where = `flows[${i}] (${f.name || "unnamed"})`;

    if (typeof f.name !== "string" || !KEBAB_CASE.test(f.name)) {
      errors.push(`${where}: name must be kebab-case (got: ${JSON.stringify(f.name)})`);
    }
    if (!VALID_KINDS.has(f.kind)) {
      errors.push(`${where}: kind must be 'ai-tool' or 'agent-flow' (got: ${JSON.stringify(f.kind)})`);
    }
    if (f.phase !== undefined && !VALID_PHASES.has(f.phase)) {
      errors.push(`${where}: phase must be 'mvp' or 'future' (got: ${JSON.stringify(f.phase)})`);
    }
    if (f.status !== undefined && !VALID_STATUSES.has(f.status)) {
      errors.push(`${where}: status must be one of ${[...VALID_STATUSES].join(", ")}`);
    }
    if (f.id !== undefined && f.id !== null && typeof f.id !== "string") {
      errors.push(`${where}: id must be a string (Dataverse workflowid) or null`);
    }

    // Kind-specific validation
    if (f.kind === "ai-tool") {
      validateAiToolSpec(f, where, errors, warnings);
    } else if (f.kind === "agent-flow") {
      validateAgentFlowSpec(f, where, errors, warnings, nameIndex);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function isRealFlow(f, idx) {
  // Treat the template-stub entry as ignorable: its name still contains placeholder
  // descriptors like "Unique kebab-case slug ..." with spaces. A real flow entry
  // will have a kebab-case name AND a recognized kind.
  if (!f || typeof f !== "object") return false;
  if (typeof f.name !== "string") return false;
  if (!KEBAB_CASE.test(f.name)) return false;
  if (!VALID_KINDS.has(f.kind)) return false;
  return true;
}

function validateAiToolSpec(f, where, errors, warnings) {
  const s = f.aiToolSpec;
  if (!s || typeof s !== "object") {
    errors.push(`${where}: aiToolSpec required when kind='ai-tool'`);
    return;
  }
  if (!Array.isArray(s.connectors) || s.connectors.length === 0) {
    errors.push(`${where}: aiToolSpec.connectors[] must have at least one connector`);
    return;
  }
  s.connectors.forEach((c, ci) => {
    if (!c.apiName || typeof c.apiName !== "string") {
      errors.push(`${where}: aiToolSpec.connectors[${ci}].apiName required`);
    }
    if (!c.operationId || typeof c.operationId !== "string") {
      errors.push(`${where}: aiToolSpec.connectors[${ci}].operationId required`);
    }
  });
  if (s.outputSchema !== undefined && typeof s.outputSchema !== "object") {
    errors.push(`${where}: aiToolSpec.outputSchema must be a JSON Schema object`);
  } else if (!s.outputSchema) {
    warnings.push(`${where}: aiToolSpec.outputSchema missing — consumers won't know the response shape`);
  }
}

function validateAgentFlowSpec(f, where, errors, warnings, nameIndex) {
  const s = f.agentFlowSpec;
  if (!s || typeof s !== "object") {
    errors.push(`${where}: agentFlowSpec required when kind='agent-flow'`);
    return;
  }
  if (!s.trigger || typeof s.trigger !== "object") {
    errors.push(`${where}: agentFlowSpec.trigger required`);
  } else if (!VALID_TRIGGER_TYPES.has(s.trigger.type)) {
    errors.push(`${where}: agentFlowSpec.trigger.type must be one of ${[...VALID_TRIGGER_TYPES].join(", ")}`);
  }
  if (!Array.isArray(s.actions) || s.actions.length === 0) {
    errors.push(`${where}: agentFlowSpec.actions[] must have at least one action`);
    return;
  }
  s.actions.forEach((a, ai) => {
    const aWhere = `${where}.actions[${ai}]`;
    if (!a.type) errors.push(`${aWhere}: type required`);
    if (!a.name) errors.push(`${aWhere}: name required`);
    if (a.type === "runAIFlow") {
      if (!a.aiFlowRef && !a.aiFlowId) {
        errors.push(`${aWhere}: type='runAIFlow' needs aiFlowRef (cross-ref to flows[].name) or aiFlowId (literal GUID)`);
      } else if (a.aiFlowRef) {
        const target = nameIndex.get(a.aiFlowRef);
        if (!target) {
          errors.push(`${aWhere}: aiFlowRef='${a.aiFlowRef}' does not match any flow in flows[]`);
        } else if (target.kind !== "ai-tool") {
          errors.push(`${aWhere}: aiFlowRef='${a.aiFlowRef}' points to a ${target.kind} — must be 'ai-tool'`);
        }
      }
    }
    if (a.type === "runAnAgent") {
      if (!a.agentLogicalName && !a.agentRef) {
        errors.push(`${aWhere}: type='runAnAgent' needs agentLogicalName (e.g., 'new_bot_<32hex>') or agentRef`);
      }
      if (!a.prompt) {
        warnings.push(`${aWhere}: type='runAnAgent' has no prompt`);
      }
    }
  });
}

/**
 * Topologically sort flows so that dependency order is preserved:
 *   - all ai-tool flows come first (they have no upstream deps in this schema)
 *   - then agent-flow flows in declaration order (they reference ai-tools by name)
 *
 * Within each group, ordering is stable on the original index.
 *
 * @param {Array} flows
 * @returns {string[]} flow names in build order. Throws if a cycle is detected.
 */
function topoSortFlows(flows) {
  if (!Array.isArray(flows)) return [];
  const real = flows.filter((f, i) => isRealFlow(f, i));
  const aiTools = real.filter((f) => f.kind === "ai-tool").map((f) => f.name);
  const agentFlows = real.filter((f) => f.kind === "agent-flow").map((f) => f.name);

  // Detect cycles within agent-flow refs. Today the schema only allows agent-flow → ai-tool
  // (one-way), but be defensive: if a future spec adds workflow-action sub-flow refs,
  // this catches mistakes before they hit Dataverse.
  const adj = new Map(); // name → Set of names it depends on
  for (const f of real) {
    const deps = new Set();
    if (f.kind === "agent-flow" && f.agentFlowSpec?.actions) {
      for (const a of f.agentFlowSpec.actions) {
        if (a.aiFlowRef) deps.add(a.aiFlowRef);
        if (a.workflowRef) deps.add(a.workflowRef); // future-proof
      }
    }
    adj.set(f.name, deps);
  }

  const visited = new Set();
  const inStack = new Set();
  function dfs(node) {
    if (inStack.has(node)) throw new Error(`Cycle detected involving flow '${node}'`);
    if (visited.has(node)) return;
    inStack.add(node);
    for (const dep of adj.get(node) || []) {
      if (!adj.has(dep)) continue; // ref to a literal aiFlowId, not a name; ignore
      dfs(dep);
    }
    inStack.delete(node);
    visited.add(node);
  }
  for (const f of real) dfs(f.name);

  return [...aiTools, ...agentFlows.filter((n) => !aiTools.includes(n))];
}

/**
 * Resolve a flow cross-reference (by name) within the spec.
 * @returns {object|null} The flow object, or null if not found.
 */
function resolveFlowRef(flows, ref) {
  if (!ref || !Array.isArray(flows)) return null;
  return flows.find((f, i) => isRealFlow(f, i) && f.name === ref) || null;
}

/**
 * Migrate legacy specs: when capabilities[].implementationType='flow' is the only
 * indicator of a needed flow, surface a stub in flows[] so build pipeline can pick it up.
 * Pure — returns a NEW spec object, does not mutate input.
 *
 * @param {object} spec - agentspec.json content
 * @returns {object} new spec with flows[] backfilled where possible
 */
function migrateLegacyCapabilities(spec) {
  if (!spec || typeof spec !== "object") return spec;
  const out = JSON.parse(JSON.stringify(spec));
  if (!Array.isArray(out.capabilities)) return out;

  const existingFlows = Array.isArray(out.flows) ? out.flows : [];
  const realFlows = existingFlows.filter((f, i) => isRealFlow(f, i));
  const claimedCapabilities = new Set();
  for (const f of realFlows) {
    for (const cap of (f.implements || [])) claimedCapabilities.add(cap);
  }

  const stubsToAdd = [];
  for (const cap of out.capabilities) {
    if (cap.implementationType !== "flow") continue;
    if (claimedCapabilities.has(cap.name)) continue;
    // Build a kebab-case slug from the capability name
    const slug = String(cap.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .replace(/--+/g, "-");
    if (!slug) continue;
    stubsToAdd.push({
      name: `${slug}-flow`,
      displayName: cap.name,
      kind: "agent-flow",
      phase: cap.phase || "mvp",
      status: "draft",
      id: null,
      description: cap.description || `Flow stub backfilled from capability '${cap.name}'`,
      implements: [cap.name],
      connectionRefs: {},
      agentFlowSpec: {
        trigger: { type: "manual", config: {} },
        // Placeholder so the stub passes validateFlows. Replace with real actions
        // before running flow-build (the validator will accept any single action
        // even if it's a no-op terminate). Marker name makes the TODO visible.
        actions: [
          {
            type: "terminate",
            name: "TODO_Replace_With_Real_Actions",
            status: "Succeeded",
            message: `Stub for capability '${cap.name}' — replace before build`,
          },
        ],
      },
      lastSyncedAt: null,
      lastBuildError: null,
      _migrated: { from: "capability", originalName: cap.name },
    });
  }

  if (stubsToAdd.length > 0) {
    out.flows = [...realFlows, ...stubsToAdd];
  } else if (!Array.isArray(out.flows)) {
    out.flows = [];
  }
  return out;
}

/**
 * Compute a deterministic SHA-256 hash of the content-meaningful fields of a flow.
 *
 * Used by the build runner to detect whether a flow's spec has changed since the
 * last successful publish. Build state (id, status, lastSyncedAt, lastBuildError,
 * lastSyncedSpecHash, _migrated) is INTENTIONALLY excluded so re-running build
 * on an unchanged spec hashes to the same value.
 *
 * @param {object} flow - A flows[] entry
 * @returns {string} 64-char hex SHA-256
 */
function computeFlowSpecHash(flow) {
  if (!flow || typeof flow !== "object") return "";
  // Whitelist of fields that, if changed, require a re-save+publish.
  const content = {
    name: flow.name,
    displayName: flow.displayName,
    kind: flow.kind,
    description: flow.description,
    implements: flow.implements || [],
    connectionRefs: flow.connectionRefs || {},
    aiToolSpec: flow.aiToolSpec || null,
    agentFlowSpec: flow.agentFlowSpec || null,
  };
  const stable = stableStringify(content);
  return crypto.createHash("sha256").update(stable).digest("hex");
}

/**
 * JSON.stringify with sorted object keys at every depth — required so
 * `{a:1,b:2}` and `{b:2,a:1}` hash identically.
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

module.exports = {
  validateFlows,
  topoSortFlows,
  resolveFlowRef,
  migrateLegacyCapabilities,
  computeFlowSpecHash,
  // exported for tests
  _internal: { isRealFlow, KEBAB_CASE, VALID_KINDS, VALID_TRIGGER_TYPES, stableStringify },
};
