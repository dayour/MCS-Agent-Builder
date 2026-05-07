/**
 * MCS Pipeline Test Loop — Failure Classifications
 *
 * Frozen set of classification IDs the verifier library produces and the
 * fix-map maps to remediation actions. Each ID corresponds to a documented
 * MCS push quirk; the `learning` ref points to knowledge/learnings/ for
 * background.
 *
 * Severity drives "one fix per iteration" ordering — the runner picks the
 * highest-severity unresolved classification each iteration. A tie within
 * a severity tier is broken by ID order.
 */

const CLASSIFICATIONS = Object.freeze({
    // --- LSP layer (highest severity — gates everything downstream) ---
    'lsp-zero-change': {
        component: 'instructions',
        severity: 1,
        learning: 'bm-021b',
        summary: 'LSP push reports 0 changes on new agent; remote body did not receive update.',
    },
    'lsp-push-strips-metadata': {
        component: 'instructions',
        severity: 1,
        learning: 'bm-LSP-001',
        summary: 'LSP push interpreted missing agent.mcs.yml as deletion; GptComponentMetadata stripped.',
    },

    // --- Publish layer (must succeed for agent to function) ---
    'publish-silent-fail': {
        component: 'publish',
        severity: 2,
        learning: 'bm-018',
        summary: 'PvaPublish returned HTTP 200 but synchronizationstatus is Failed.',
    },
    'publish-pending': {
        component: 'publish',
        severity: 2,
        learning: 'bm-018',
        summary: 'Publish still Synchronizing past the 60s poll deadline.',
    },
    'recognizer-missing': {
        component: 'recognizer',
        severity: 2,
        learning: 'bm-021',
        summary: 'bot.configuration is missing GenerativeAIRecognizer; orchestration will silent-fail.',
    },

    // --- Tool / connector layer ---
    'operationid-mismatch': {
        component: 'tool',
        severity: 3,
        learning: 'tt-004',
        summary: 'Action YAML operationId does not match connector schema; runtime will infinite-spin.',
    },
    'operationid-silent-rename': {
        component: 'tool',
        severity: 3,
        learning: 'tt-004',
        summary: 'Connector renamed an operation without bumping version; spec is stale.',
    },

    // --- Topic layer ---
    'topic-not-rendered': {
        component: 'topic',
        severity: 4,
        learning: 'bm-026',
        summary: 'DialogComponent.data starts with `# Name:` comment header; visual editor will fail to render.',
    },
    'topic-missing': {
        component: 'topic',
        severity: 4,
        learning: 'bm-026',
        summary: 'Spec defines topic but no DialogComponent exists in MCS.',
    },

    // --- Adaptive card layer ---
    'card-format-ignored': {
        component: 'card',
        severity: 5,
        learning: 'bm-029',
        summary: 'Spec sets outputFormat: AdaptiveCard but owning node lacks the field; build emits plain text.',
    },
    'card-powerfx-scope': {
        component: 'card',
        severity: 5,
        learning: 'bm-LSP-002',
        summary: 'AdaptiveCardTemplate cardContent references Global.* which does not resolve in card scope.',
    },

    // --- Settings + metadata layer ---
    'settings-not-synced': {
        component: 'settings',
        severity: 6,
        learning: 'bm-010',
        summary: 'settings.mcs.yml diverges from bot.configuration; LSP did not push settings.',
    },
    'metadata-not-patched': {
        component: 'instructions',
        severity: 6,
        learning: 'bm-017',
        summary: 'Agent name/description not present in Dataverse botcomponent.description column.',
    },
    'starters-missing-title': {
        component: 'starters',
        severity: 6,
        learning: 'bm-016',
        summary: 'Conversation starter has text but no title; publish will silent-fail.',
    },

    // --- Knowledge layer ---
    'knowledge-record-only': {
        component: 'knowledge',
        severity: 7,
        learning: 'bm-023b',
        summary: 'botcomponent record exists but the underlying file/blob is unreachable (HEAD != 200).',
    },
    'knowledge-no-endpoint': {
        component: 'knowledge',
        severity: 7,
        learning: 'bm-023b',
        summary: 'Spec requires file upload but no working Dataverse endpoint exists; manual UI step required.',
    },

    // --- Trigger layer ---
    'trigger-orphan': {
        component: 'trigger',
        severity: 8,
        learning: null,
        summary: 'Trigger component exists but no matching flow is registered.',
    },

    // --- Channel layer ---
    'direct-line-missing': {
        component: 'directLine',
        severity: 9,
        learning: null,
        summary: 'Spec sets directLineEnabled: true but channel paths are not provisioned.',
    },
});

const SEVERITY_ORDER = Object.entries(CLASSIFICATIONS)
    .sort(([aId, a], [bId, b]) => a.severity - b.severity || aId.localeCompare(bId))
    .map(([id]) => id);

function getClassification(id) {
    return CLASSIFICATIONS[id] || null;
}

function getSeverityRank(id) {
    return CLASSIFICATIONS[id]?.severity ?? 99;
}

module.exports = { CLASSIFICATIONS, SEVERITY_ORDER, getClassification, getSeverityRank };
