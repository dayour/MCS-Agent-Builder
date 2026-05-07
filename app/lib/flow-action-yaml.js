/**
 * flow-action-yaml — generates the InvokeFlowTaskAction topic YAML that
 * registers a published agent flow as a callable tool on the MCS agent.
 *
 * Without this YAML, a flow exists in Dataverse and runs on its own (recurrence,
 * HTTP webhook, etc.) but the agent itself can't invoke it. The maker UI hides
 * this mechanism; the file convention is `<agentDir>/actions/<name>.mcs.yml`.
 *
 * Pattern (matches CDW/MNP existing actions):
 *
 *   mcs.metadata:
 *     componentName: <displayName>
 *     description: <description>
 *   kind: TaskDialog
 *   modelDisplayName: <displayName>
 *   modelDescription: <description — orchestrator routes on this>
 *
 *   action:
 *     kind: InvokeFlowTaskAction
 *     flowId: <guid>
 *
 * For flows requiring conversational input gathering (Question nodes, etc),
 * topic-engineer authors a richer AdaptiveDialog manually — auto-generation
 * stays in the simple-action lane.
 */

/**
 * @param {object} flow - flows[] entry
 * @returns {boolean}
 */
function isAgentInvokable(flow) {
    if (!flow || flow.kind !== "agent-flow") return false;
    if (flow.agentInvokable === true) return true;
    if (flow.agentInvokable === false) return false;
    // Default heuristic by trigger type
    const t = flow.agentFlowSpec?.trigger?.type;
    return t === "manual" || t === "http" || t === "skills";
}

/**
 * Convert a kebab-case slug to camelCase for filenames matching repo conventions
 * (see Build-Guides/CDW/.../actions/sfAccountLookup.mcs.yml).
 */
function toCamelCase(slug) {
    if (!slug) return "flow";
    return String(slug)
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join("");
}

/**
 * YAML-escape a scalar value. Uses single-quoted block when safe (no embedded
 * single quotes); otherwise double-quoted with `\"` escapes. Embedded newlines
 * → block-scalar `|-`.
 */
function yamlScalar(s) {
    const str = String(s == null ? "" : s);
    if (str === "") return '""';
    if (str.includes("\n")) {
        // Block scalar — preserve newlines, no trailing blank line
        return "|-\n    " + str.split("\n").join("\n    ");
    }
    // Detect special chars that need quoting in YAML scalars
    const needsQuoting = /[:#&*!|>%@`,\[\]\{\}]/.test(str) ||
                         /^[-?\s]/.test(str) ||
                         /\s$/.test(str) ||
                         ["true", "false", "null", "yes", "no"].includes(str.toLowerCase()) ||
                         /^\d/.test(str);
    if (!needsQuoting) return str;
    if (!str.includes("'")) return `'${str}'`;
    // Double-quote, escape backslash + double-quote
    return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/**
 * Generate the InvokeFlowTaskAction topic YAML for one flow.
 * Returns null if the flow is not eligible (wrong kind, no id, opted out).
 *
 * @param {object} flow - flows[] entry (must have id and displayName)
 * @returns {{filename: string, content: string, componentName: string}|null}
 */
function generateInvokeFlowActionYaml(flow) {
    if (!isAgentInvokable(flow)) return null;
    if (!flow.id) {
        // Caller should only invoke this after a successful publish
        throw new Error(`Cannot generate action YAML for '${flow.name}' — flow.id is not set (build flow first)`);
    }

    const displayName = flow.displayName || flow.name;
    const description = flow.description || displayName;
    const componentName = displayName;
    const filename = `${toCamelCase(flow.name)}.mcs.yml`;

    const lines = [
        `mcs.metadata:`,
        `  componentName: ${yamlScalar(componentName)}`,
        flow.description ? `  description: ${yamlScalar(flow.description)}` : null,
        `kind: TaskDialog`,
        `modelDisplayName: ${yamlScalar(displayName)}`,
        `modelDescription: ${yamlScalar(description)}`,
        ``,
        `action:`,
        `  kind: InvokeFlowTaskAction`,
        `  flowId: ${flow.id}`,
        ``,
    ].filter((line) => line !== null);

    return { filename, content: lines.join("\n"), componentName };
}

/**
 * Generate YAML for every eligible flow in a flows[] array.
 *
 * @param {Array} flows
 * @returns {Array<{flowName, filename, content, componentName}>}
 */
function generateAllInvokeFlowActions(flows) {
    if (!Array.isArray(flows)) return [];
    const out = [];
    for (const flow of flows) {
        try {
            const yaml = generateInvokeFlowActionYaml(flow);
            if (yaml) out.push({ flowName: flow.name, ...yaml });
        } catch {
            // Skip flows whose YAML can't be generated (no id, etc.)
        }
    }
    return out;
}

module.exports = {
    generateInvokeFlowActionYaml,
    generateAllInvokeFlowActions,
    isAgentInvokable,
    // exported for tests
    _internal: { toCamelCase, yamlScalar },
};
