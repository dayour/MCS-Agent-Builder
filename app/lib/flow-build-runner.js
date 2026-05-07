/**
 * flow-build-runner — orchestrates Power Automate flow creation/update/publish
 * for every entry in agentspec.json `flows[]`.
 *
 * Pure orchestration logic — all I/O lives in injected dependencies (flowManager,
 * composer, log). This makes it trivially testable with mocks and reusable from
 * both the build-pipeline step and a standalone CLI.
 *
 * Contract:
 *   1. Validates flows[] (delegates to flow-spec).
 *   2. Topologically sorts: ai-tools first, then agent-flows.
 *   3. For each flow, in order:
 *      - Resolve cross-refs (aiFlowRef → id from previously-built flows).
 *      - Compose the wire payload (composer.composeAIFlow / composeFlow).
 *      - Create the Dataverse workflow if no id; publish via PublishComponent.
 *      - On failure: mark status='failed', record error, continue with next flow.
 *   4. Returns { results: [...per-flow...], modifiedSpec }. Caller persists.
 *
 * Idempotency (Phase 5):
 *   - no id                                                         → create + publish
 *   - id present + status='published' + hash matches lastSyncedHash → skip (no drift)
 *   - id present + status='published' + hash differs                → save (PATCH new clientdata) + publish
 *   - id present + status≠'published'                               → save + publish
 *
 * Note: agent-side tool registration (InvokeFlowTaskAction YAML + LSP push)
 * is NOT in this runner. It belongs to the agent-component sync step that
 * already exists; this runner just produces the flow IDs that registration
 * binds to.
 */

const { validateFlows, topoSortFlows, computeFlowSpecHash } = require("./flow-spec");
const { generateInvokeFlowActionYaml } = require("./flow-action-yaml");

/**
 * Build all flows for an agent.
 *
 * @param {object} spec - agentspec.json content. Mutated copy returned, not input.
 * @param {object} deps
 * @param {object} deps.flowManager - tools/flow-manager.js exports (createFlow, createAIFlow, publishFlow, getFlow)
 * @param {object} deps.composer    - tools/lib/flow-composer.js exports (composeFlow, composeAIFlow, ...)
 * @param {string} deps.orgUrl      - Dataverse org URL
 * @param {string} deps.token       - Dataverse access token
 * @param {Function} [deps.log]     - log(message). Defaults to no-op.
 * @param {boolean}  [deps.dryRun]  - If true, plan only; no Dataverse calls.
 * @param {string}   [deps.only]    - If set, run only this flow name (skip the rest)
 * @returns {Promise<{results: Array, modifiedSpec: object}>}
 */
async function runFlowsBuild(spec, deps) {
    const log = deps.log || (() => {});
    const dryRun = !!deps.dryRun;

    // Validate first — fast-fail on schema issues
    const v = validateFlows(spec.flows);
    if (!v.valid) {
        return {
            results: [{ name: "_validation", status: "failed", error: v.errors.join("; ") }],
            modifiedSpec: spec,
        };
    }

    if (!Array.isArray(spec.flows) || spec.flows.length === 0) {
        log("No flows[] to build — skipping.");
        return { results: [], modifiedSpec: spec };
    }

    // Topo-sort: ai-tools first so agent-flows can resolve aiFlowRefs to ids.
    let order;
    try {
        order = topoSortFlows(spec.flows);
    } catch (e) {
        return {
            results: [{ name: "_topo", status: "failed", error: e.message }],
            modifiedSpec: spec,
        };
    }

    // Deep clone so we don't mutate caller's spec mid-flight.
    const out = JSON.parse(JSON.stringify(spec));
    const flowsByName = new Map();
    for (const f of out.flows) {
        if (f && f.name) flowsByName.set(f.name, f);
    }

    const results = [];
    const generatedActions = [];
    for (const name of order) {
        const flow = flowsByName.get(name);
        if (!flow) continue;
        if (deps.only && deps.only !== name) {
            results.push({ name, status: flow.status || "draft", skipped: "filter" });
            continue;
        }

        const start = Date.now();
        try {
            if (dryRun) {
                const plan = planFlow(flow, flowsByName);
                results.push({ name, status: "planned", action: plan.action, durationMs: 0, plan });
                continue;
            }
            const r = await runOneFlow(flow, flowsByName, deps);
            flow.lastSyncedAt = new Date().toISOString();
            flow.lastBuildError = null;
            const skipped = r && r.synced === false;
            const result = { name, status: flow.status, id: flow.id, durationMs: Date.now() - start };
            if (skipped) result.skipped = r.reason || "no-drift";
            results.push(result);
            log(`flow ${name}: ${flow.status} (${flow.id || "no-id"})${skipped ? ` [skipped — ${r.reason}]` : ""}`);

            // Auto-register the flow as an agent-invokable tool by emitting topic YAML.
            // Only on the synced path (created or save+publish drifted) — skipped
            // flows leave the existing YAML file alone.
            if (!skipped && flow.id && flow.status === "published") {
                try {
                    const yaml = generateInvokeFlowActionYaml(flow);
                    if (yaml) {
                        generatedActions.push({ flowName: flow.name, ...yaml });
                        // Track on the flow itself for round-trip awareness
                        flow.actionYamlFile = yaml.filename;
                    }
                } catch (yamlErr) {
                    log(`flow ${name}: action YAML generation skipped — ${yamlErr.message}`);
                }
            }
        } catch (e) {
            flow.status = "failed";
            flow.lastBuildError = e.message;
            results.push({ name, status: "failed", error: e.message, durationMs: Date.now() - start });
            log(`flow ${name}: FAILED — ${e.message}`);
        }
    }

    return { results, modifiedSpec: out, generatedActions };
}

/**
 * Decide what action a flow needs without performing it. Used for --dry-run
 * and for surfacing a build plan to the user before any writes happen.
 */
function planFlow(flow, flowsByName) {
    const currentHash = computeFlowSpecHash(flow);
    if (flow.id && flow.status === "published" && flow.lastSyncedSpecHash === currentHash) {
        return { action: "skip", reason: "no drift — lastSyncedSpecHash matches current" };
    }
    if (flow.id && flow.status === "published") {
        return { action: "save+publish", reason: "drift detected — spec hash changed since last publish" };
    }
    if (flow.id) {
        return { action: "save+publish", reason: `id present (${flow.id}); status=${flow.status}` };
    }
    if (flow.kind === "ai-tool") {
        return { action: "create+publish", reason: "no id; will create as category=7 AI flow" };
    }
    if (flow.kind === "agent-flow") {
        const refs = (flow.agentFlowSpec?.actions || []).filter((a) => a.aiFlowRef).map((a) => a.aiFlowRef);
        const unresolved = refs.filter((r) => {
            const t = flowsByName.get(r);
            return !t || (!t.id && t.status !== "published");
        });
        if (unresolved.length > 0) {
            return { action: "blocked", reason: `unresolved aiFlowRef(s): ${unresolved.join(", ")}` };
        }
        return { action: "create+publish", reason: "no id; will create as category=5 agent flow" };
    }
    return { action: "skip", reason: `unknown kind: ${flow.kind}` };
}

async function runOneFlow(flow, flowsByName, deps) {
    const currentHash = computeFlowSpecHash(flow);

    // Drift detection: if id+published+hash match, nothing to do.
    if (flow.id && flow.status === "published" && flow.lastSyncedSpecHash === currentHash) {
        return { synced: false, reason: "no-drift" };
    }

    if (flow.kind === "ai-tool") {
        await runAiToolFlow(flow, deps);
    } else if (flow.kind === "agent-flow") {
        await runAgentFlow(flow, flowsByName, deps);
    } else {
        throw new Error(`Unknown flow kind: ${flow.kind}`);
    }

    // Stamp the hash now that the flow has been successfully synced (created or saved + published).
    flow.lastSyncedSpecHash = currentHash;
    return { synced: true };
}

async function runAiToolFlow(flow, deps) {
    const { flowManager, composer, orgUrl, token, pvaToken, ppUrl } = deps;
    const aiSpec = flow.aiToolSpec;
    if (!aiSpec) throw new Error("aiToolSpec missing");

    if (!flow.id) {
        const rec = await flowManager.createAIFlow(orgUrl, token, {
            name: flow.displayName || flow.name,
            description: flow.description,
            plan: aiSpec.plan || "",
            connectors: aiSpec.connectors,
            connectionReferences: flow.connectionRefs || {},
            outputSchema: aiSpec.outputSchema,
            // We publish explicitly below so the same code path covers re-publish too.
            publish: false,
        });
        flow.id = rec.workflowid;
        flow.status = "created";
        if (!flow.id) throw new Error("createAIFlow did not return workflowid");
    } else {
        // Drift path — re-save with current spec content. Same Dataverse row,
        // same id; just an updated clientdata column + outputs + name (so the
        // workflow row's name column tracks displayName changes too — without
        // this, drift updates clientdata.displayName but the row.name stays stale).
        const composed = composer.composeAIFlow({
            plan: aiSpec.plan || "",
            connectors: aiSpec.connectors,
            connectionReferences: flow.connectionRefs || {},
        });
        await flowManager.saveFlow(orgUrl, token, flow.id, composed, {
            name: flow.displayName || flow.name,
            description: flow.description,
            outputs: aiSpec.outputSchema ? { schema: aiSpec.outputSchema } : undefined,
        });
        flow.status = "created"; // saved-but-not-yet-published, until publishFlow below
    }

    // AI flows REQUIRE a verifyPlan call before publishFlow — Dataverse rejects
    // the publish otherwise with "Cannot publish a generative action without
    // verifying the plan first". Needs the Power Platform token + env URL.
    if (!pvaToken || !ppUrl) {
        throw new Error("AI flows require pvaToken + ppUrl in runner deps for verifyPlan. Use the CLI which obtains both, or pass them explicitly.");
    }
    await flowManager.verifyPlan(ppUrl, pvaToken, flow.id);

    await flowManager.publishFlow(orgUrl, token, flow.id);
    flow.status = "published";
}

async function runAgentFlow(flow, flowsByName, deps) {
    const { flowManager, composer, orgUrl, token } = deps;
    const afSpec = flow.agentFlowSpec;
    if (!afSpec) throw new Error("agentFlowSpec missing");

    // Resolve aiFlowRef → aiFlowId for each runAIFlow action
    const resolvedActions = afSpec.actions.map((a) => {
        if (a.type === "runAIFlow" && a.aiFlowRef) {
            const target = flowsByName.get(a.aiFlowRef);
            if (!target) {
                throw new Error(`aiFlowRef '${a.aiFlowRef}' not found in flows[]`);
            }
            if (!target.id) {
                throw new Error(`aiFlowRef '${a.aiFlowRef}' has no id — was the ai-tool flow built first?`);
            }
            // Strip the ref, replace with literal id (composer's runAIFlow case expects aiFlowId)
            const { aiFlowRef, ...rest } = a;
            return { ...rest, aiFlowId: target.id };
        }
        return a;
    });

    const composerSpec = {
        trigger: afSpec.trigger,
        actions: resolvedActions,
        connectionReferences: flow.connectionRefs || {},
    };
    const composed = composer.composeFlow(composerSpec);

    if (!flow.id) {
        const rec = await flowManager.createFlow(orgUrl, token, {
            name: flow.displayName || flow.name,
            description: flow.description,
            displayName: flow.displayName || "",
            definition: composed,
        });
        flow.id = rec.workflowid;
        flow.status = "created";
        if (!flow.id) throw new Error("createFlow did not return workflowid");
    } else {
        // Drift path — wrap composer output into the maker-UI clientdata envelope
        // and PATCH it onto the existing row. Also update the row.name column so
        // the maker UI list reflects displayName changes.
        const envGuid = await flowManager.deriveEnvironmentId(orgUrl, token);
        const wrapped = flowManager.wrapAgentFlowClientdata(composed, {
            envGuid,
            displayName: flow.displayName || "",
        });
        await flowManager.saveFlow(orgUrl, token, flow.id, wrapped, {
            name: flow.displayName || flow.name,
            description: flow.description,
        });
        flow.status = "created";
    }

    await flowManager.publishFlow(orgUrl, token, flow.id);
    flow.status = "published";
}

module.exports = {
    runFlowsBuild,
    planFlow,
    _internal: { runOneFlow, runAiToolFlow, runAgentFlow },
};
