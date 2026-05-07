/**
 * Tests for app/lib/flow-action-yaml.js — InvokeFlowTaskAction topic YAML generator.
 *
 * Run: node --test app/lib/__tests__/flow-action-yaml.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateInvokeFlowActionYaml, generateAllInvokeFlowActions, isAgentInvokable, _internal } = require("../flow-action-yaml");

// --- isAgentInvokable: scope decisions ---

test("isAgentInvokable: agent-flow with manual trigger → true (default)", () => {
    assert.equal(isAgentInvokable({
        kind: "agent-flow",
        agentFlowSpec: { trigger: { type: "manual" } },
    }), true);
});

test("isAgentInvokable: agent-flow with recurrence trigger → false (default)", () => {
    assert.equal(isAgentInvokable({
        kind: "agent-flow",
        agentFlowSpec: { trigger: { type: "recurrence" } },
    }), false);
});

test("isAgentInvokable: explicit agentInvokable=true overrides trigger heuristic", () => {
    assert.equal(isAgentInvokable({
        kind: "agent-flow",
        agentInvokable: true,
        agentFlowSpec: { trigger: { type: "recurrence" } },
    }), true);
});

test("isAgentInvokable: explicit agentInvokable=false suppresses even for manual", () => {
    assert.equal(isAgentInvokable({
        kind: "agent-flow",
        agentInvokable: false,
        agentFlowSpec: { trigger: { type: "manual" } },
    }), false);
});

test("isAgentInvokable: ai-tool flows are NEVER agent-invokable directly", () => {
    assert.equal(isAgentInvokable({ kind: "ai-tool", agentInvokable: true }), false,
        "ai-tools are wrapped INSIDE agent flows; they don't get their own InvokeFlowTaskAction");
});

test("isAgentInvokable: missing trigger.type → false (no heuristic match)", () => {
    assert.equal(isAgentInvokable({ kind: "agent-flow", agentFlowSpec: {} }), false);
});

// --- generateInvokeFlowActionYaml: output shape ---

test("generateInvokeFlowActionYaml: simple agent flow → CDW/MNP-style YAML", () => {
    const flow = {
        name: "research-orchestrator",
        displayName: "Research Orchestrator",
        kind: "agent-flow",
        id: "abc-123-def",
        description: "Orchestrates research across M365 and the research agent.",
        agentFlowSpec: { trigger: { type: "manual" } },
    };
    const result = generateInvokeFlowActionYaml(flow);
    assert.ok(result, "should produce YAML for invokable agent flow");
    assert.equal(result.filename, "researchOrchestrator.mcs.yml");
    assert.match(result.content, /kind: TaskDialog/);
    assert.match(result.content, /modelDisplayName:/);
    assert.match(result.content, /modelDescription:/);
    assert.match(result.content, /kind: InvokeFlowTaskAction/);
    assert.match(result.content, /flowId: abc-123-def/);
    assert.match(result.content, /componentName:/);
});

test("generateInvokeFlowActionYaml: ai-tool returns null", () => {
    const flow = {
        name: "search-tool",
        displayName: "Search",
        kind: "ai-tool",
        id: "abc",
    };
    assert.equal(generateInvokeFlowActionYaml(flow), null);
});

test("generateInvokeFlowActionYaml: throws when flow has no id", () => {
    const flow = {
        name: "x",
        displayName: "X",
        kind: "agent-flow",
        id: null,
        agentFlowSpec: { trigger: { type: "manual" } },
    };
    assert.throws(() => generateInvokeFlowActionYaml(flow), /flow.id is not set/);
});

test("generateInvokeFlowActionYaml: respects agentInvokable=false (returns null)", () => {
    const flow = {
        name: "scheduled",
        displayName: "Scheduled Flow",
        kind: "agent-flow",
        id: "abc",
        agentInvokable: false,
        agentFlowSpec: { trigger: { type: "manual" } },
    };
    assert.equal(generateInvokeFlowActionYaml(flow), null);
});

// --- YAML escaping ---

test("yamlScalar: simple strings unquoted", () => {
    assert.equal(_internal.yamlScalar("simpleValue"), "simpleValue");
    assert.equal(_internal.yamlScalar("Hello world"), "Hello world");
});

test("yamlScalar: strings with colons / brackets / hashes get quoted", () => {
    assert.match(_internal.yamlScalar("key: value"), /^['"]/);
    assert.match(_internal.yamlScalar("hello # comment"), /^['"]/);
    assert.match(_internal.yamlScalar("array[0]"), /^['"]/);
});

test("yamlScalar: strings with apostrophes use double-quotes", () => {
    const out = _internal.yamlScalar("it's a test: 1");
    assert.match(out, /^"/);
    assert.match(out, /it's a test/, "apostrophe preserved");
});

test("yamlScalar: empty/null produce empty quoted string", () => {
    assert.equal(_internal.yamlScalar(""), '""');
    assert.equal(_internal.yamlScalar(null), '""');
});

test("yamlScalar: boolean-looking strings get quoted", () => {
    assert.match(_internal.yamlScalar("true"), /^['"]/);
    assert.match(_internal.yamlScalar("false"), /^['"]/);
    assert.match(_internal.yamlScalar("null"), /^['"]/);
});

test("generateInvokeFlowActionYaml: descriptions with colons render correctly", () => {
    const flow = {
        name: "x",
        displayName: "Lookup Tool",
        kind: "agent-flow",
        id: "abc",
        description: "Searches Salesforce for a specific company by name. Use when: user asks about an account.",
        agentFlowSpec: { trigger: { type: "manual" } },
    };
    const r = generateInvokeFlowActionYaml(flow);
    assert.ok(r);
    // The colon in the description must be inside quoted scalar — re-parse loosely
    const lines = r.content.split("\n");
    const descLine = lines.find((l) => l.startsWith("modelDescription:"));
    // Should not break the YAML (colon inside quoted value is fine)
    assert.match(descLine, /^modelDescription: ['"]/);
});

// --- toCamelCase ---

test("toCamelCase: kebab → camel", () => {
    assert.equal(_internal.toCamelCase("research-orchestrator"), "researchOrchestrator");
    assert.equal(_internal.toCamelCase("daily-briefing-flow"), "dailyBriefingFlow");
    assert.equal(_internal.toCamelCase("simple"), "simple");
    assert.equal(_internal.toCamelCase("with spaces and-dashes"), "withSpacesAndDashes");
});

// --- generateAllInvokeFlowActions ---

test("generateAllInvokeFlowActions: returns YAML only for eligible flows", () => {
    const flows = [
        { name: "tool-a", kind: "ai-tool", id: "1" },                                                        // skip (ai-tool)
        { name: "agent-a", displayName: "Agent A", kind: "agent-flow", id: "2", agentFlowSpec: { trigger: { type: "manual" } } }, // emit
        { name: "agent-b", displayName: "Agent B", kind: "agent-flow", id: null, agentFlowSpec: { trigger: { type: "manual" } } }, // skip (no id)
        { name: "agent-c", displayName: "Agent C", kind: "agent-flow", id: "3", agentInvokable: false, agentFlowSpec: { trigger: { type: "manual" } } }, // skip (opt-out)
        { name: "agent-d", displayName: "Agent D", kind: "agent-flow", id: "4", agentFlowSpec: { trigger: { type: "recurrence" } } }, // skip (recurrence default)
    ];
    const out = generateAllInvokeFlowActions(flows);
    assert.equal(out.length, 1);
    assert.equal(out[0].flowName, "agent-a");
});
