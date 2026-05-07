/**
 * MCS Pipeline Test Loop — Fix Map (classification -> patch planner)
 *
 * Pure planner. Given a classification ID, returns either:
 *   { type: 'auto', actions: [...], learningRef: 'bm-026' }   - safe to apply
 *   { type: 'escalate', reason: '...', learningRef: '...' }   - surface to user
 *
 * Each `action` is a descriptor consumed by the runner's executor:
 *   { tool: 'mcs-lsp', fn: 'push', args: { workspacePath } }
 *
 * The runner dispatches on `tool` -> module + `fn` -> function name. This
 * keeps the map data-only and the executor in one place.
 *
 * Auto-confirmation gate: hardcoded per classification. The plan's "auto
 * when learnings/index.json[id].confirmed >= 2" gate is replaced by this
 * static map because the index does not track per-entry confirmations.
 * Tightening this gate later (e.g. by reading per-entry confirmed counts
 * from the markdown files) is a follow-up.
 */

'use strict';

const { getClassification } = require('./pipeline-classifications');

const FIX_MAP = Object.freeze({
    // --- Auto-fix entries (smoke phase: only topic-not-rendered) ---
    'topic-not-rendered': {
        type: 'auto',
        learningRef: 'bm-026',
        rationale: 'mcs-lsp push() auto-strips comment headers from DialogComponent.data via stripTopicCommentHeaders. Re-running push remediates orphaned topic records that were created without the strip pass.',
        actions: [
            { tool: 'mcs-lsp', fn: 'push', args: { workspacePath: '$ctx.workspacePath' } },
        ],
    },

    'lsp-zero-change': {
        type: 'auto',
        learningRef: 'bm-021b',
        rationale: 'mcs-lsp push() runs verifyAndPatchBody as a fallback that PATCHes GptComponent.data via Dataverse when the LSP wire reports 0 changes.',
        actions: [
            { tool: 'mcs-lsp', fn: 'push', args: { workspacePath: '$ctx.workspacePath' } },
        ],
    },

    'metadata-not-patched': {
        type: 'auto',
        learningRef: 'bm-017',
        rationale: 'mcs-lsp.patchMetadata reads the local agent.mcs.yml comment headers (or mcs.metadata block) and PATCHes both the GptComponent data field and the botcomponent.description column.',
        actions: [
            { tool: 'mcs-lsp', fn: 'patchMetadata', args: { workspacePath: '$ctx.workspacePath' } },
        ],
    },

    // --- Escalate-only entries (need human judgment or unimplemented executor) ---
    'lsp-push-strips-metadata': {
        type: 'escalate',
        learningRef: 'bm-LSP-001',
        reason: 'Reconstructing agent.mcs.yml is destructive — prompt user to confirm before rewriting from spec.',
    },
    'publish-silent-fail': {
        type: 'escalate',
        learningRef: 'bm-018',
        reason: 'PvaPublish re-issue executor not yet implemented. Manual: POST bots(<id>)/Microsoft.Dynamics.CRM.PvaPublish with empty body, then poll synchronizationstatus.',
    },
    'publish-pending': {
        type: 'escalate',
        learningRef: 'bm-018',
        reason: 'Publish still synchronizing. Wait and re-run; if persistent, inspect synchronizationstatus for explicit error.',
    },
    'recognizer-missing': {
        type: 'escalate',
        learningRef: 'bm-021',
        reason: 'Recognizer-merge executor not yet implemented. Manual: PATCH bot.configuration to add `recognizer.$kind: GenerativeAIRecognizer`.',
    },
    'operationid-mismatch': {
        type: 'escalate',
        learningRef: 'tt-004',
        reason: 'Action YAML regeneration executor not yet implemented. Manual: rerun add-tool.js createActionYaml against connector schema, then mcs-lsp push.',
    },
    'operationid-silent-rename': {
        type: 'escalate',
        learningRef: 'tt-004',
        reason: 'Connector schema drift — needs spec update. Surface diff to user.',
    },
    'topic-missing': {
        type: 'escalate',
        learningRef: 'bm-026',
        reason: 'Topic creation must use Gateway BotComponentInsert (island-client createTopic). Executor not yet implemented in this harness.',
    },
    'card-format-ignored': {
        type: 'escalate',
        learningRef: 'bm-029',
        reason: 'YAML node patch executor not yet implemented. Manual: edit topic YAML to add `outputFormat: AdaptiveCard` to owning Question/Message node, then push.',
    },
    'card-powerfx-scope': {
        type: 'escalate',
        learningRef: 'bm-LSP-002',
        reason: 'Spec-level fix required: mirror Topic.foo -> Global.foo at topic end. User must confirm change.',
    },
    'settings-not-synced': {
        type: 'escalate',
        learningRef: 'bm-010',
        reason: 'Dataverse PATCH on bot.configuration not yet implemented. Manual: PATCH bots(<id>) configuration with merged JSON.',
    },
    'starters-missing-title': {
        type: 'escalate',
        learningRef: 'bm-016',
        reason: 'GptComponentMetadata enrichment executor not yet implemented. Manual: edit agent.mcs.yml conversationStarters to ensure each item has both title and text.',
    },
    'knowledge-record-only': {
        type: 'escalate',
        learningRef: 'bm-023b',
        reason: 'File re-upload executor not yet implemented. Manual: re-upload via MCS UI; verify HEAD on storage URL returns 200.',
    },
    'knowledge-no-endpoint': {
        type: 'escalate',
        learningRef: 'bm-023b',
        reason: 'No automated path — Dataverse file upload endpoint not available. Manual: add file via MCS UI Knowledge tab.',
    },
    'trigger-orphan': {
        type: 'escalate',
        learningRef: null,
        reason: 'Trigger-flow re-bind executor not yet implemented. Manual: verify flow exists via flow-manager.js list and re-create binding.',
    },
    'direct-line-missing': {
        type: 'escalate',
        learningRef: null,
        reason: 'Direct Line provisioning is a UI-only step today. Manual: enable channel in MCS portal.',
    },
});

/**
 * Look up the patch plan for a classification.
 * @param {string} classificationId
 * @returns {{type: 'auto'|'escalate', learningRef: string|null, ...} | null}
 */
function planFor(classificationId) {
    const entry = FIX_MAP[classificationId];
    if (!entry) return null;
    const meta = getClassification(classificationId);
    return {
        ...entry,
        classification: classificationId,
        component: meta?.component || null,
        severity: meta?.severity || 99,
    };
}

/**
 * Resolve action arg placeholders ($ctx.workspacePath, etc.) against a context.
 * Returns a deep clone with literal values.
 */
function resolveAction(action, ctx) {
    const args = {};
    for (const [k, v] of Object.entries(action.args || {})) {
        if (typeof v === 'string' && v.startsWith('$ctx.')) {
            const key = v.slice('$ctx.'.length);
            args[k] = ctx[key];
        } else {
            args[k] = v;
        }
    }
    return { tool: action.tool, fn: action.fn, args };
}

module.exports = { FIX_MAP, planFor, resolveAction };
