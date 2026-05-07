#!/usr/bin/env node
/**
 * flow-build — CLI to execute the flows[] section of an agentspec.
 *
 * Reads the spec, runs the orchestrator, writes the spec back with updated
 * id/status/lastSyncedAt fields. Designed for both human use and skill invocation.
 *
 * Usage:
 *   node tools/flow-build.js plan  --spec <path>                     # dry-run, no API calls
 *   node tools/flow-build.js run   --spec <path> --org <orgUrl>      # build all flows
 *   node tools/flow-build.js run   --spec <path> --org <orgUrl> --only <flowName>
 *   node tools/flow-build.js validate --spec <path>                  # schema-only check
 *   node tools/flow-build.js verify  --org <orgUrl> --flow <flowId>  # confirm published+activated
 *   node tools/flow-build.js unpack  --org <orgUrl> --flow <flowId>  # live → flows[] entry
 *
 * Auth: az account get-access-token --resource <orgUrl>
 *
 * Exit codes:
 *   0 — all flows succeeded (or planned cleanly)
 *   1 — at least one flow failed
 *   2 — invalid arguments / spec not found / validation error
 */

const fs = require("fs");
const path = require("path");

const flowManager = require("./flow-manager");
const composer = require("./lib/flow-composer");
const { runFlowsBuild } = require("../app/lib/flow-build-runner");
const { validateFlows } = require("../app/lib/flow-spec");

function argVal(args, name, def) {
    const i = args.indexOf(name);
    return i > -1 ? args[i + 1] : def;
}

function parseArgs(argv) {
    const args = argv.slice(2);
    const cmd = args[0];
    return {
        cmd,
        spec: argVal(args, "--spec"),
        org: argVal(args, "--org"),
        only: argVal(args, "--only"),
        flow: argVal(args, "--flow"),
        envId: argVal(args, "--env-id"),
        actionsDir: argVal(args, "--actions-dir"),
        dryRun: args.includes("--dry-run"),
        json: args.includes("--json"),
    };
}

function ppUrlFromEnvId(envId) {
    const noHyphens = envId.replace(/-/g, "");
    if (noHyphens.length !== 32) return null;
    return `https://${noHyphens.slice(0, 30)}.${noHyphens.slice(30)}.environment.api.powerplatform.com`;
}

/**
 * Look up env GUID by Dataverse org URL in tools/session-config.json.
 * The Dataverse `organizations` entity does not expose the Power Platform env
 * GUID as a queryable field — the maker UI gets it from the BAP API or local
 * config. session-config.json caches it per (account, env).
 */
function envIdFromSessionConfig(orgUrl) {
    try {
        const fs = require("fs");
        const path = require("path");
        const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "session-config.json"), "utf8"));
        const normalize = (u) => String(u || "").replace(/\/$/, "").toLowerCase();
        const target = normalize(orgUrl);
        for (const a of cfg.accounts || []) {
            for (const e of a.environments || []) {
                if (normalize(e.dataverseUrl) === target && e.environmentId) {
                    // Strip "Default-" prefix if present (some envs are stored as "Default-<guid>")
                    return String(e.environmentId).replace(/^Default-/, "");
                }
            }
        }
    } catch { /* ignore */ }
    return null;
}

function usage() {
    const help = fs.readFileSync(__filename, "utf8").split("\n");
    const end = help.findIndex((l) => l.trim() === "*/");
    console.log(help.slice(1, end >= 0 ? end : 30).join("\n").replace(/^ \* ?/gm, ""));
}

async function getAzToken(resource) {
    // Use execSync (shell-based) so Windows resolves az.cmd via PATHEXT.
    const { execSync } = require("child_process");
    try {
        const out = execSync(
            `az account get-access-token --resource "${resource}" --query accessToken -o tsv`,
            { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
        );
        const tok = out.trim();
        if (!tok || tok.length < 100) throw new Error("Token returned was empty or too short");
        return tok;
    } catch (e) {
        const msg = e.stderr ? String(e.stderr).trim() : e.message;
        throw new Error(`Failed to obtain token for ${resource} via az: ${msg}`);
    }
}

async function getDataverseToken(orgUrl) {
    return getAzToken(orgUrl);
}

/**
 * Try each candidate audience by issuing a sentinel verifyPlan call to the env API.
 * Returns the first token whose audience the API accepts (no InvalidAudience).
 *
 * The sentinel: POST {envUrl}/copilotflows/flows/_aud_probe_/verifyPlan?api-version=1
 * with body {} — we don't care about the response body or 404 for unknown flowId,
 * we just care whether the auth check passes (anything except 401 InvalidAudience).
 */
async function pickWorkingPowerPlatformToken(envUrl, log) {
    const { httpRequest } = require("./lib/http");
    const candidates = [
        "https://api.powerplatform.com",
        envUrl,
        "https://service.flow.microsoft.com",
        "https://api.flow.microsoft.com",
        "https://service.powerapps.com",
        "96ff4394-9197-43aa-b393-6a41652e21f8",
    ].filter(Boolean);

    let lastDetail = "";
    for (const resource of candidates) {
        let tok;
        try {
            tok = await getAzToken(resource);
        } catch (e) {
            lastDetail = `${resource}: ${e.message}`;
            continue;
        }
        // Probe the env API with this token. We use a bogus flowId — any non-401-InvalidAudience
        // response (including 404 "flow not found" or 400 "invalid id") tells us the auth
        // check passed and the audience is correct.
        const probe = await httpRequest("POST",
            `${envUrl}/copilotflows/flows/00000000-0000-0000-0000-000000000000/verifyPlan?api-version=1`,
            { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
            {});
        const text = JSON.stringify(probe.data || "").slice(0, 200);
        const isInvalidAudience = probe.status === 401 && /InvalidAudience/i.test(text);
        if (!isInvalidAudience) {
            log(`Audience accepted: ${resource} (probe status ${probe.status})`);
            return tok;
        }
        lastDetail = `${resource}: 401 InvalidAudience`;
        log(`  audience rejected: ${resource}`);
    }
    throw new Error(`No accepted Power Platform audience. Tried: ${candidates.join(", ")}. Last error: ${lastDetail}`);
}

async function getPowerPlatformToken(envUrl) {
    // The Power Platform Environment API (verifyPlan / checkFlowErrors / mcp tool
    // discovery) is auth-fussy. Try a list of candidate audiences in order; return
    // the first that yields a token. The actual audience-mismatch error surfaces
    // at call time, not token-fetch time, so we may need fallback at the call site too.
    const candidates = [
        // Most likely (unified Power Platform; error mentioned "Unified: InvalidAudience"):
        "https://api.powerplatform.com",
        // The env URL itself (per-environment tokens are sometimes accepted):
        envUrl,
        // Other Power Platform audiences:
        "https://service.flow.microsoft.com",
        "https://api.flow.microsoft.com",
        "https://service.powerapps.com",
    ].filter(Boolean);

    let lastErr;
    for (const resource of candidates) {
        try {
            const tok = await getAzToken(resource);
            return { token: tok, audience: resource };
        } catch (e) {
            lastErr = e;
        }
    }
    throw new Error(`Could not obtain Power Platform token for any audience: ${lastErr?.message}`);
}

async function cmdValidate(opts) {
    const spec = JSON.parse(fs.readFileSync(opts.spec, "utf8"));
    const r = validateFlows(spec.flows);
    if (opts.json) {
        console.log(JSON.stringify(r, null, 2));
    } else {
        console.log(`Validation: ${r.valid ? "PASS" : "FAIL"}`);
        for (const e of r.errors) console.log(`  ERROR: ${e}`);
        for (const w of r.warnings) console.log(`  WARN:  ${w}`);
    }
    return r.valid ? 0 : 2;
}

async function cmdPlan(opts) {
    const spec = JSON.parse(fs.readFileSync(opts.spec, "utf8"));
    const { results } = await runFlowsBuild(spec, {
        flowManager, composer,
        orgUrl: opts.org || "https://dryrun.invalid",
        token: "dryrun",
        dryRun: true,
        only: opts.only,
        log: (m) => process.stderr.write(`[plan] ${m}\n`),
    });
    if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        console.log(`Plan (${results.length} flows):`);
        for (const r of results) {
            const action = r.plan?.action || r.status;
            const reason = r.plan?.reason ? ` — ${r.plan.reason}` : (r.error ? ` — ${r.error}` : "");
            console.log(`  ${action.padEnd(18)} ${r.name}${reason}`);
        }
    }
    return 0;
}

async function cmdRun(opts) {
    if (!opts.org) {
        console.error("--org <orgUrl> required for run");
        return 2;
    }
    const spec = JSON.parse(fs.readFileSync(opts.spec, "utf8"));
    const log = (m) => process.stderr.write(`[flow-build] ${m}\n`);

    const token = await getDataverseToken(opts.org);

    // Fetch Power Platform token + env URL only if there's at least one AI flow
    // (which needs verifyPlan). Otherwise we save a token round-trip.
    const hasAiTool = (spec.flows || []).some((f) => f && f.kind === "ai-tool");
    let pvaToken = null;
    let ppUrl = null;
    if (hasAiTool) {
        // Resolution chain (each step falls through to next on failure):
        //   1. --env-id <guid>           explicit override
        //   2. session-config.json       cached env GUIDs by Dataverse org URL
        //   3. derivePowerPlatformUrl    Dataverse-based derive (currently broken — env
        //                                GUID not exposed on `organizations` entity)
        let envIdResolved = null;
        let envIdSource = null;

        if (opts.envId) {
            envIdResolved = opts.envId;
            envIdSource = "--env-id flag";
        } else {
            envIdResolved = envIdFromSessionConfig(opts.org);
            if (envIdResolved) envIdSource = "tools/session-config.json";
        }

        if (envIdResolved) {
            ppUrl = ppUrlFromEnvId(envIdResolved);
            if (!ppUrl) throw new Error(`Resolved env-id '${envIdResolved}' is not a 32-hex GUID (source: ${envIdSource})`);
        } else {
            // Last resort — try the Dataverse-based path (currently no-op for most envs)
            ppUrl = await flowManager.derivePowerPlatformUrl(opts.org, token);
            if (!ppUrl) {
                throw new Error(
                    `Could not resolve Power Platform env GUID for ${opts.org}.\n` +
                    `Add the env to tools/session-config.json under the appropriate account, ` +
                    `or pass --env-id <guid> explicitly.`
                );
            }
            envIdSource = "Dataverse derive";
        }
        log(`Power Platform env URL: ${ppUrl} (source: ${envIdSource})`);
        log("Fetching Power Platform token (audience https://api.powerplatform.com — verified)");
        if (process.env.FLOW_BUILD_PROBE_AUDIENCES) {
            pvaToken = await pickWorkingPowerPlatformToken(ppUrl, log);
        } else {
            pvaToken = await getAzToken("https://api.powerplatform.com");
        }
    }

    log(`Building ${spec.flows?.length || 0} flow(s) against ${opts.org}`);

    const { results, modifiedSpec, generatedActions = [] } = await runFlowsBuild(spec, {
        flowManager, composer,
        orgUrl: opts.org,
        token,
        pvaToken,
        ppUrl,
        only: opts.only,
        log,
    });

    // Persist the updated spec
    fs.writeFileSync(opts.spec, JSON.stringify(modifiedSpec, null, 2), "utf8");
    log(`Spec persisted: ${opts.spec}`);

    // Write any generated agent-action YAMLs (InvokeFlowTaskAction registrations).
    // Default location: <spec-dir>/actions/. Override via --actions-dir.
    if (generatedActions.length > 0) {
        const actionsDir = opts.actionsDir || path.join(path.dirname(opts.spec), "actions");
        if (!fs.existsSync(actionsDir)) fs.mkdirSync(actionsDir, { recursive: true });
        for (const a of generatedActions) {
            const target = path.join(actionsDir, a.filename);
            fs.writeFileSync(target, a.content, "utf8");
            log(`action YAML: ${target}`);
        }
        log(`Wrote ${generatedActions.length} agent-action YAML file(s) to ${actionsDir}`);
        log(`Push them to MCS via: node tools/mcs-lsp.js push --workspace <agent-workspace>`);
    }

    if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        console.log(`\n=== Flow build results ===`);
        for (const r of results) {
            const tag = r.skipped              ? "·"
                       : r.status === "failed" ? "✗"
                       : r.status === "published" ? "✓"
                       : "?";
            const id = r.id ? ` (${r.id})` : "";
            const err = r.error ? ` — ${r.error}` : "";
            const skipNote = r.skipped ? ` [skipped — ${r.skipped}]` : "";
            console.log(`  ${tag} ${r.name}: ${r.status}${skipNote}${id}${err}`);
        }
    }

    const failed = results.filter((r) => r.status === "failed");
    return failed.length > 0 ? 1 : 0;
}

async function cmdVerify(opts) {
    if (!opts.org || !opts.flow) {
        console.error("--org <orgUrl> and --flow <flowId> required for verify");
        return 2;
    }
    const token = await getDataverseToken(opts.org);
    const { record } = await flowManager.getFlow(opts.org, token, opts.flow, { full: true });
    // Per HAR readback shape:
    //   componentstate: 0 = Published, 1 = Unpublished, 2 = Deleted Unpublished
    //   statecode: 0 = Draft, 1 = Activated
    //   statuscode: varies — 1 (Draft), 2 (Activated)
    const result = {
        flowId: opts.flow,
        name: record.name,
        category: record.category,
        modernflowtype: record.modernflowtype,
        primaryentity: record.primaryentity,
        componentstate: record.componentstate,
        statecode: record.statecode,
        statuscode: record.statuscode,
        published: record.componentstate === 0,
        activated: record.statecode === 1,
        ismanaged: record.ismanaged,
        modifiedon: record.modifiedon,
    };
    result.verdict = (result.published && result.activated) ? "OK"
                    : (!result.published && result.activated) ? "RUNTIME-ON-BUT-UNPUBLISHED"
                    : (result.published && !result.activated) ? "PUBLISHED-BUT-DEACTIVATED"
                    : "DRAFT";
    if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`Flow ${opts.flow}: ${result.verdict}`);
        console.log(`  name           ${result.name}`);
        console.log(`  category       ${result.category} (${result.category === 5 ? "agent-flow" : result.category === 7 ? "ai-tool" : "other"})`);
        console.log(`  componentstate ${result.componentstate} (${result.published ? "Published" : "Unpublished"})`);
        console.log(`  statecode      ${result.statecode} (${result.activated ? "Activated" : "Draft"})`);
        console.log(`  statuscode     ${result.statuscode}`);
        console.log(`  ismanaged      ${result.ismanaged}`);
    }
    return result.verdict === "OK" ? 0 : 1;
}

async function cmdUnpack(opts) {
    if (!opts.org || !opts.flow) {
        console.error("--org <orgUrl> and --flow <flowId> required for unpack");
        return 2;
    }
    const token = await getDataverseToken(opts.org);
    const { record, definition } = await flowManager.getFlow(opts.org, token, opts.flow, { full: true });
    const entry = unpackToFlowsEntry(record, definition);
    if (opts.spec) {
        // Append/merge into the spec's flows[]
        const spec = JSON.parse(fs.readFileSync(opts.spec, "utf8"));
        spec.flows = spec.flows || [];
        const existing = spec.flows.findIndex((f) => f && f.id === entry.id);
        if (existing >= 0) spec.flows[existing] = entry;
        else spec.flows.push(entry);
        fs.writeFileSync(opts.spec, JSON.stringify(spec, null, 2), "utf8");
        console.log(`Unpacked flow ${opts.flow} → ${opts.spec} (${existing >= 0 ? "updated" : "appended"})`);
    } else {
        console.log(JSON.stringify(entry, null, 2));
    }
    return 0;
}

function unpackToFlowsEntry(record, definition) {
    const isAiTool = record.category === 7;
    const isAgentFlow = record.category === 5;
    const slug = String(record.name || "unnamed-flow")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unpacked-flow";
    const entry = {
        name: slug,
        displayName: record.name,
        kind: isAiTool ? "ai-tool" : isAgentFlow ? "agent-flow" : "unknown",
        phase: "mvp",
        status: record.componentstate === 0 ? "published" : "draft",
        id: record.workflowid,
        description: record.description || "",
        implements: [],
        connectionRefs: {},
        lastSyncedAt: new Date().toISOString(),
        lastBuildError: null,
        _unpacked: { from: record.workflowid, at: new Date().toISOString() },
    };
    if (isAiTool && definition) {
        // AI flow clientdata: { definition: { plan, actions: { connectors: [] } }, connectionReferences? }
        const connectorsRaw = definition.definition?.actions?.connectors || [];
        entry.aiToolSpec = {
            plan: definition.definition?.plan || "",
            connectors: connectorsRaw.map((c) => ({
                apiName: c.api?.name,
                operationId: c.operationsList?.[0]?.operationId,
                displayName: c.operationsList?.[0]?.displayName,
                isSuggested: c.operationsList?.[0]?.["x-ms-isSuggested"],
                connectionReference: c.connectionReference,
            })),
            outputSchema: record.outputs ? safeJsonParse(record.outputs)?.schema || {} : {},
        };
        if (definition.connectionReferences) entry.connectionRefs = definition.connectionReferences;
    } else if (isAgentFlow && definition) {
        // agent flow: clientdata = { properties: { connectionReferences, definition: <WDL>, displayName, environment } }
        const props = definition.properties || definition;
        const wdl = props.definition || {};
        entry.connectionRefs = props.connectionReferences || {};
        entry.agentFlowSpec = {
            trigger: extractTriggerFromWdl(wdl),
            actions: extractActionsFromWdl(wdl),
            _wdlPreview: { triggerNames: Object.keys(wdl.triggers || {}), actionNames: Object.keys(wdl.actions || {}) },
        };
    }
    return entry;
}

function extractTriggerFromWdl(wdl) {
    const triggers = wdl.triggers || {};
    const [name, def] = Object.entries(triggers)[0] || [null, null];
    if (!def) return { type: "unknown" };
    if (def.type === "Recurrence") return { type: "recurrence", config: def.recurrence || {} };
    if (def.type === "Request") {
        if (def.kind === "Button") return { type: "manual", schema: def.inputs?.schema };
        if (def.kind === "Skills") return { type: "skills", inputSchema: def.inputs?.schema };
        if (def.kind === "Http") return { type: "http", method: def.inputs?.method, schema: def.inputs?.schema };
    }
    return { type: "unknown", _raw: { name, kind: def.kind, opType: def.type } };
}

function extractActionsFromWdl(wdl) {
    const out = [];
    for (const [name, def] of Object.entries(wdl.actions || {})) {
        const op = def.inputs?.host?.operationId;
        const conn = def.inputs?.host?.connectionName;
        if (conn === "shared_agentnode" && op === "InvokeAgent") {
            out.push({
                type: "runAnAgent",
                name,
                agentLogicalName: def.inputs?.parameters?.["body/agentId"],
                prompt: def.inputs?.parameters?.["body/prompt"],
                isHitlEscalationEnabled: def.inputs?.parameters?.["body/isHitlEscalationEnabled"],
                outputSchema: def.inputs?.parameters?.["body/outputSchema"],
            });
        } else if (conn === "shared_aisteps" && op === "RunAIFlow") {
            out.push({
                type: "runAIFlow",
                name,
                aiFlowId: def.inputs?.parameters?.flowId,
                metadataOverride: def.metadata?.operationInfoForMetadataOverride,
            });
        } else {
            out.push({ type: "connector", name, connector: conn, operationId: op, params: def.inputs?.parameters });
        }
    }
    return out;
}

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

async function main() {
    const opts = parseArgs(process.argv);
    if (!opts.cmd || opts.cmd === "--help" || opts.cmd === "-h") {
        usage();
        return 0;
    }
    // Verify and unpack don't need a spec — only --org and --flow
    const requiresSpec = ["validate", "plan", "run"];
    if (requiresSpec.includes(opts.cmd)) {
        if (!opts.spec) { console.error("--spec <path> required"); return 2; }
        if (!fs.existsSync(opts.spec)) { console.error(`Spec not found: ${opts.spec}`); return 2; }
    }

    switch (opts.cmd) {
        case "validate": return cmdValidate(opts);
        case "plan":     return cmdPlan(opts);
        case "run":      return cmdRun(opts);
        case "verify":   return cmdVerify(opts);
        case "unpack":   return cmdUnpack(opts);
        default:
            console.error(`Unknown command: ${opts.cmd}`);
            usage();
            return 2;
    }
}

if (require.main === module) {
    main().then((code) => process.exit(code)).catch((e) => {
        console.error(`Fatal: ${e.message}`);
        process.exit(1);
    });
}

module.exports = { parseArgs, cmdValidate, cmdPlan, cmdRun, cmdVerify, cmdUnpack, unpackToFlowsEntry, extractTriggerFromWdl, extractActionsFromWdl };
