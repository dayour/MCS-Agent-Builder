/**
 * MCS Pipeline Test Loop — Component Verifier Library
 *
 * Per-component API read-back. Reads MCS state via Dataverse + Gateway and
 * compares against the agentspec. Returns a uniform VerifyResult shape for
 * the runner to dispatch on.
 *
 * Design split:
 *   - "classify*" pure functions take observed + expected and return VerifyResult.
 *     Testable offline. The smoke test feeds these synthetic inputs.
 *   - "verify*" live functions read MCS state (paired Dataverse + Gateway)
 *     and call the classifier.
 *
 * Smoke phase (this file): only verifyTopic + classifyTopicData are
 * implemented. Other component verifiers return status='skipped' with
 * `notImplemented: true` so the runner can log without crashing.
 *
 * Reuses:
 *   - tools/mcs-lsp.js   readConnJson(workspacePath)
 *   - tools/lib/http.js  httpRequestWithRetry, getToken
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { readConnJson } = require('./mcs-lsp');
const { httpRequestWithRetry, getToken } = require('./lib/http');

// --- VerifyResult factory ---

/**
 * @returns {{
 *   component: string, id: string, status: 'match'|'partial'|'failed'|'blocked'|'skipped',
 *   observed: object, expected: object, diff: Array, classification: string|null,
 *   evidence: object
 * }}
 */
function makeResult({ component, id, status, observed = null, expected = null,
                       diff = [], classification = null, evidence = {} }) {
    return { component, id, status, observed, expected, diff, classification, evidence };
}

// --- Context loader ---

/**
 * Load verifier context from a workspace path. Reads conn.json for IDs/URLs
 * and acquires a Dataverse token. Throws if workspace is not a cloned MCS
 * agent.
 *
 * @param {string} workspacePath
 * @returns {{ dvUrl: string, agentId: string, envId: string, dvToken: string, workspacePath: string }}
 */
function loadContext(workspacePath) {
    const conn = readConnJson(workspacePath);
    const dvUrl = conn.DataverseEndpoint.replace(/\/$/, '');
    const dvToken = getToken(dvUrl);
    return {
        dvUrl,
        agentId: conn.AgentId,
        envId: conn.EnvironmentId,
        dvToken,
        workspacePath,
    };
}

// --- Pure classifiers (testable without MCS) ---

/**
 * Classify a topic's observed Dataverse `data` field against the spec.
 *
 * Detects:
 *   - topic-not-rendered: data starts with `# ` (comment header leak — bm-026)
 *   - topic-missing:      observed === null (no DialogComponent at all)
 *   - match:              data starts with `kind: AdaptiveDialog`
 *
 * @param {{data: string|null, botcomponentid?: string, name?: string}|null} observed
 * @param {{name: string}} expected
 * @returns VerifyResult
 */
function classifyTopicData(observed, expected) {
    const id = expected.name;

    if (observed === null || observed === undefined) {
        return makeResult({
            component: 'topic',
            id,
            status: 'failed',
            observed: null,
            expected,
            diff: [{ path: 'exists', expected: true, actual: false }],
            classification: 'topic-missing',
            evidence: { reason: 'No DialogComponent found for this topic name' },
        });
    }

    const data = observed.data || '';

    if (data.startsWith('# ') || /^#\s*Name:/i.test(data)) {
        const firstLine = data.split('\n', 1)[0];
        return makeResult({
            component: 'topic',
            id,
            status: 'failed',
            observed: { dataPreview: data.slice(0, 80), name: observed.name },
            expected,
            diff: [{ path: 'data[0:6]', expected: 'kind: ', actual: firstLine.slice(0, 32) }],
            classification: 'topic-not-rendered',
            evidence: { firstLine: firstLine.slice(0, 200) },
        });
    }

    if (!data.startsWith('kind:')) {
        return makeResult({
            component: 'topic',
            id,
            status: 'partial',
            observed: { dataPreview: data.slice(0, 80) },
            expected,
            diff: [{ path: 'data[0:5]', expected: 'kind:', actual: data.slice(0, 32) }],
            classification: null,
            evidence: { firstLine: data.split('\n', 1)[0].slice(0, 200), note: 'data field does not begin with `kind:` and not detected as a comment header' },
        });
    }

    return makeResult({
        component: 'topic',
        id,
        status: 'match',
        observed: { dataPreview: data.slice(0, 80), name: observed.name },
        expected,
        evidence: { firstLine: data.split('\n', 1)[0].slice(0, 200) },
    });
}

// --- Live verifiers ---

/**
 * Read all DialogComponents (componenttype=9) for an agent via Dataverse FetchXML.
 * Returns array of { botcomponentid, name, data }.
 */
async function fetchDialogComponents(ctx) {
    const fetchXml = '<fetch top="50">' +
        '<entity name="botcomponent">' +
        '<attribute name="botcomponentid"/>' +
        '<attribute name="name"/>' +
        '<attribute name="data"/>' +
        '<filter>' +
        `<condition attribute="parentbotid" operator="eq" value="${ctx.agentId}"/>` +
        '<condition attribute="componenttype" operator="eq" value="9"/>' +
        '</filter>' +
        '</entity>' +
        '</fetch>';

    const url = `${ctx.dvUrl}/api/data/v9.2/botcomponents?fetchXml=${encodeURIComponent(fetchXml)}`;
    const res = await httpRequestWithRetry('GET', url,
        { Authorization: `Bearer ${ctx.dvToken}` }, null);

    if (res.status !== 200) {
        throw new Error(`fetchDialogComponents HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
    }
    return Array.isArray(res.data?.value) ? res.data.value : [];
}

/**
 * Verify a single topic by name. Reads DialogComponent and classifies.
 *
 * @param {object} ctx
 * @param {{name: string}} expected
 * @returns VerifyResult
 */
async function verifyTopic(ctx, expected) {
    const components = await fetchDialogComponents(ctx);
    const observed = components.find(c => (c.name || '').toLowerCase() === expected.name.toLowerCase()) || null;

    const result = classifyTopicData(observed, expected);
    result.evidence.api = 'Dataverse';
    result.evidence.query = `botcomponents (componenttype=9, name="${expected.name}")`;
    return result;
}

/**
 * Verify all topics in spec by reading DialogComponents once and classifying
 * each. Returns one VerifyResult per spec topic.
 *
 * @param {object} ctx
 * @param {{topics: Array<{name: string}>}} spec
 */
async function verifyAllTopics(ctx, spec) {
    const components = await fetchDialogComponents(ctx);
    const byName = new Map(components.map(c => [(c.name || '').toLowerCase(), c]));

    return (spec.topics || []).map(topicSpec => {
        const observed = byName.get(topicSpec.name.toLowerCase()) || null;
        const result = classifyTopicData(observed, topicSpec);
        result.evidence.api = 'Dataverse';
        result.evidence.query = `botcomponents (componenttype=9, name="${topicSpec.name}")`;
        return result;
    });
}

// --- Stub verifiers (smoke phase: skipped, not failed) ---

function makeSkipped(component, id, reason) {
    return makeResult({
        component, id, status: 'skipped',
        evidence: { notImplemented: true, reason },
    });
}

async function verifyInstructions(ctx, spec) { return makeSkipped('instructions', 'instructions', 'verifier not yet implemented'); }
async function verifyModel(ctx, spec)        { return makeSkipped('model', 'model', 'verifier not yet implemented'); }
async function verifyStarters(ctx, spec)     { return makeSkipped('starters', 'starters', 'verifier not yet implemented'); }
async function verifyTool(ctx, spec)         { return makeSkipped('tool', spec?.name || 'tool', 'verifier not yet implemented'); }
async function verifyKnowledge(ctx, spec)    { return makeSkipped('knowledge', spec?.name || 'knowledge', 'verifier not yet implemented'); }
async function verifySettings(ctx, spec)     { return makeSkipped('settings', 'settings', 'verifier not yet implemented'); }
async function verifyTrigger(ctx, spec)      { return makeSkipped('trigger', spec?.name || 'trigger', 'verifier not yet implemented'); }
async function verifyRecognizer(ctx, spec)   { return makeSkipped('recognizer', 'recognizer', 'verifier not yet implemented'); }
async function verifyPublish(ctx, spec)      { return makeSkipped('publish', 'publish', 'verifier not yet implemented'); }
async function verifyDirectLine(ctx, spec)   { return makeSkipped('directLine', 'directLine', 'verifier not yet implemented'); }
async function verifyAdaptiveCard(ctx, topic, cardId, spec) { return makeSkipped('card', cardId || 'card', 'verifier not yet implemented'); }

// --- Top-level dispatch ---

/**
 * Verify every component class found in the spec. Runs verifiers in parallel.
 * Returns a flat array of VerifyResult.
 *
 * @param {object} ctx
 * @param {object} spec  agentspec.json
 */
async function verifyAll(ctx, spec) {
    const tasks = [];

    tasks.push(verifyInstructions(ctx, spec));
    tasks.push(verifyModel(ctx, spec));
    tasks.push(verifyStarters(ctx, spec));
    tasks.push(verifyRecognizer(ctx, spec));
    tasks.push(verifySettings(ctx, spec));
    tasks.push(verifyPublish(ctx, spec));
    tasks.push(verifyDirectLine(ctx, spec));

    if (Array.isArray(spec.tools))         for (const t of spec.tools)         tasks.push(verifyTool(ctx, t));
    if (Array.isArray(spec.integrations))  for (const t of spec.integrations)  tasks.push(verifyTool(ctx, t));
    if (Array.isArray(spec.knowledge))     for (const k of spec.knowledge)     tasks.push(verifyKnowledge(ctx, k));
    if (Array.isArray(spec.triggers))      for (const t of spec.triggers)      tasks.push(verifyTrigger(ctx, t));
    if (Array.isArray(spec.architecture?.triggers)) for (const t of spec.architecture.triggers) tasks.push(verifyTrigger(ctx, t));

    const topics = spec.conversations?.topics || spec.topics || [];
    if (Array.isArray(topics) && topics.length > 0) {
        tasks.push(verifyAllTopics(ctx, { topics }));
    }

    const settled = await Promise.all(tasks);
    return settled.flat();
}

module.exports = {
    makeResult,
    loadContext,
    classifyTopicData,
    fetchDialogComponents,
    verifyTopic,
    verifyAllTopics,
    verifyInstructions,
    verifyModel,
    verifyStarters,
    verifyTool,
    verifyKnowledge,
    verifySettings,
    verifyTrigger,
    verifyRecognizer,
    verifyPublish,
    verifyDirectLine,
    verifyAdaptiveCard,
    verifyAll,
};
