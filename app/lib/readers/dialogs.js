/**
 * Dialog reader — bridges the typed Phase 1 adapters (tools/island-client.js)
 * into the app/lib/ layer.
 *
 * Follows the generator-adapter pattern introduced in c66dc78c:
 *   - A single module per concern.
 *   - Adapter shape that callers can consume without knowing transport details.
 *   - Explicit shadow-mode parity helper for safe migration from the
 *     HAR-reverse-engineered readComponents() path to the typed
 *     /api/botauthoring/v1/dialogs contract.
 *
 * Mode selection (via process.env.MCS_DIALOGS_MODE):
 *   "typed"   - use only the upstream-typed listDialogs() adapter (default)
 *   "legacy"  - use only readComponents() + client-side DialogComponent filter
 *   "shadow"  - call both; log diffs; return the typed result
 *
 * No explicit env var = typed path, which is the green path proven against
 * real MCS during the Phase 1 live smoke.
 */

const island = require("../../../tools/island-client");

const MODE_TYPED = "typed";
const MODE_LEGACY = "legacy";
const MODE_SHADOW = "shadow";
const VALID_MODES = new Set([MODE_TYPED, MODE_LEGACY, MODE_SHADOW]);

/** @typedef {{ id?: string, schemaName?: string, displayName?: string, triggerKind?: string, description?: string, state?: string, type?: string, $kind?: string }} NormalizedDialog */

/**
 * Normalize a legacy DialogComponent (from readComponents) to the same
 * shape we return for typed dialogs.
 */
function normalizeLegacy(change) {
    const comp = change?.component || {};
    const trigger = comp.dialog?.beginDialog;
    return {
        id: comp.id || comp.schemaName,
        schemaName: comp.schemaName || "",
        displayName: comp.displayName || comp.schemaName || "",
        triggerKind: trigger ? trigger["$kind"] : "unknown",
        description: comp.description || "",
        state: comp.state || "",
        $kind: "DialogComponent",
    };
}

/**
 * Normalize a typed Dialog (from listDialogs) to the same shape we
 * return for legacy DialogComponents. The typed response shape is
 * richer but we project to a stable subset.
 */
function normalizeTyped(dialog) {
    return {
        id: dialog.id || dialog.schemaName,
        schemaName: dialog.schemaName || dialog.name || "",
        displayName: dialog.displayName || dialog.name || "",
        triggerKind: dialog.triggerKind || dialog.$kind || dialog.type || "unknown",
        description: dialog.description || "",
        state: dialog.state || "",
        type: dialog.type,
        $kind: "DialogComponent",
    };
}

async function listViaTyped(gatewayUrl, envId, botId, headers) {
    const page = await island.listDialogs(gatewayUrl, envId, botId, headers, {});
    const items = page.items || page.value || [];
    return items.map(normalizeTyped);
}

async function listViaLegacy(gatewayUrl, envId, botId, headers) {
    const result = await island.readComponents(gatewayUrl, envId, botId, headers);
    const changes = result?.botComponentChanges || [];
    return changes
        .filter((c) => c.component && c.component["$kind"] === "DialogComponent")
        .map(normalizeLegacy);
}

function diffDialogLists(typed, legacy) {
    const typedIds = new Set(typed.map((d) => d.id || d.schemaName).filter(Boolean));
    const legacyIds = new Set(legacy.map((d) => d.id || d.schemaName).filter(Boolean));
    const onlyInTyped = [...typedIds].filter((id) => !legacyIds.has(id));
    const onlyInLegacy = [...legacyIds].filter((id) => !typedIds.has(id));
    return {
        typedCount: typed.length,
        legacyCount: legacy.length,
        onlyInTyped,
        onlyInLegacy,
        equalCount: typed.length === legacy.length,
        equalIds: onlyInTyped.length === 0 && onlyInLegacy.length === 0,
    };
}

/**
 * List dialogs for a bot. Mode is selected from process.env.MCS_DIALOGS_MODE,
 * defaulting to typed. Callers that want to force a mode can pass opts.mode.
 *
 * @param {string} gatewayUrl
 * @param {string} envId
 * @param {string} botId
 * @param {object} headers
 * @param {object} [opts]
 * @param {"typed"|"legacy"|"shadow"} [opts.mode]
 * @param {(info: object) => void} [opts.onShadowDiff] - invoked in shadow mode with the diff report
 * @returns {Promise<NormalizedDialog[]>}
 */
async function listDialogs(gatewayUrl, envId, botId, headers, opts = {}) {
    const envMode = (process.env.MCS_DIALOGS_MODE || "").toLowerCase();
    const mode = opts.mode || (VALID_MODES.has(envMode) ? envMode : MODE_TYPED);

    if (mode === MODE_LEGACY) {
        return listViaLegacy(gatewayUrl, envId, botId, headers);
    }
    if (mode === MODE_TYPED) {
        return listViaTyped(gatewayUrl, envId, botId, headers);
    }
    // shadow — call both, compare, return typed.
    const [typed, legacy] = await Promise.all([
        listViaTyped(gatewayUrl, envId, botId, headers),
        listViaLegacy(gatewayUrl, envId, botId, headers),
    ]);
    const diff = diffDialogLists(typed, legacy);
    if (typeof opts.onShadowDiff === "function") {
        opts.onShadowDiff(diff);
    } else if (!diff.equalIds) {
        // Default: log a compact summary to stderr so CI surfaces it.
        console.error(
            `[dialogs-reader:shadow] parity MISMATCH typed=${diff.typedCount} ` +
                `legacy=${diff.legacyCount} onlyInTyped=${diff.onlyInTyped.length} ` +
                `onlyInLegacy=${diff.onlyInLegacy.length}`
        );
    }
    return typed;
}

async function listSystemDialogs(gatewayUrl, envId, botId, headers) {
    const items = await island.getSystemDialogs(gatewayUrl, envId, botId, headers);
    return items.map(normalizeTyped);
}

module.exports = {
    listDialogs,
    listSystemDialogs,
    MODE_TYPED,
    MODE_LEGACY,
    MODE_SHADOW,
    _internal: { normalizeTyped, normalizeLegacy, diffDialogLists, listViaTyped, listViaLegacy },
};
