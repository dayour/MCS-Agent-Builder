/**
 * Contract tests for app/lib/generators/instructions.js
 *
 * Run: npm run test:unit
 *
 * These lock the adapter shape so both enrichment.js enrichInstructions() and
 * the /mcs-research Phase C PE teammate produce equivalent output.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { SOURCES } = require("../provenance");
const {
  generateInstructions,
  buildUserMessage,
  DEFAULT_SYSTEM_PROMPT,
} = require("../generators/instructions");

/** Minimal realistic brief fixture. */
function makeBrief(overrides = {}) {
  return {
    agent: {
      name: "HR Policy Assistant",
      description: "Answers policy questions for employees",
      persona: "friendly and knowledgeable",
      primaryUsers: "Employees",
      responseFormat: "bullet points when listing, prose otherwise",
    },
    capabilities: [
      { name: "Answer policy questions", description: "Look up HR policies", phase: "mvp" },
      { name: "Escalate complex cases",  description: "Route to HR partner",  phase: "mvp" },
      { name: "Future reporting",        description: "Not yet",               phase: "future" },
    ],
    boundaries: {
      handle:  ["HR policy"],
      decline: [{ topic: "legal advice" }],
      refuse:  [{ topic: "individual compensation decisions" }],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildUserMessage — pure, deterministic
// ---------------------------------------------------------------------------

test("buildUserMessage includes MVP capabilities only", () => {
  const msg = buildUserMessage(makeBrief());
  assert.ok(msg.includes("Answer policy questions"));
  assert.ok(msg.includes("Escalate complex cases"));
  assert.ok(!msg.includes("Future reporting"), "future-phase caps must be excluded");
});

test("buildUserMessage handles object-form boundary entries", () => {
  const msg = buildUserMessage(makeBrief());
  assert.ok(msg.includes("legal advice"));
  assert.ok(msg.includes("individual compensation decisions"));
});

test("buildUserMessage handles string-form boundary entries", () => {
  const brief = makeBrief({
    boundaries: { handle: ["a"], decline: ["b"], refuse: ["c"] },
  });
  const msg = buildUserMessage(brief);
  assert.ok(msg.includes("- Handle: a"));
  assert.ok(msg.includes("- Decline: b"));
  assert.ok(msg.includes("- Refuse: c"));
});

test("buildUserMessage provides 'Not specified' for missing fields", () => {
  const msg = buildUserMessage({ agent: { name: "X" } });
  assert.ok(msg.includes("Agent: \"X\""));
  assert.ok(msg.includes("Description: Not specified"));
  assert.ok(msg.includes("Users: Not specified"));
  assert.ok(msg.includes("- Handle: Not specified"));
});

test("buildUserMessage is deterministic for the same input", () => {
  const b = makeBrief();
  assert.equal(buildUserMessage(b), buildUserMessage(b));
});

// ---------------------------------------------------------------------------
// generateInstructions — adapter contract
// ---------------------------------------------------------------------------

test("generateInstructions returns text + meta + provenance", async () => {
  const callLLM = async () => "# Identity\nYou are helpful.\n";
  const result = await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.ENRICHMENT,
    callLLM,
  });
  assert.equal(result.text, "# Identity\nYou are helpful.\n");
  assert.equal(result.meta.charCount, result.text.length);
  assert.equal(result.provenance.lastSetBy, "enrichment");
  assert.ok(result.provenance.lastSetAt);
  assert.deepEqual(result.provenance.sourceFiles, []);
});

test("generateInstructions propagates sourceFiles and reason to provenance", async () => {
  const callLLM = async () => "text";
  const result = await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.RESEARCH,
    sourceFiles: ["sdr.md", "transcript.md"],
    reason: "Generated from SDR section 3",
    callLLM,
  });
  assert.deepEqual(result.provenance.sourceFiles, ["sdr.md", "transcript.md"]);
  assert.equal(result.provenance.reason, "Generated from SDR section 3");
});

test("generateInstructions filters non-string sourceFiles", async () => {
  const callLLM = async () => "text";
  const result = await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.RESEARCH,
    sourceFiles: ["good.md", null, 42, "also-good.md"],
    callLLM,
  });
  assert.deepEqual(result.provenance.sourceFiles, ["good.md", "also-good.md"]);
});

test("generateInstructions uses DEFAULT_SYSTEM_PROMPT when no override given", async () => {
  let receivedSystem = null;
  const callLLM = async (sys) => { receivedSystem = sys; return "x"; };
  await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.ENRICHMENT,
    callLLM,
  });
  assert.equal(receivedSystem, DEFAULT_SYSTEM_PROMPT);
});

test("generateInstructions accepts custom systemPrompt", async () => {
  let receivedSystem = null;
  const callLLM = async (sys) => { receivedSystem = sys; return "x"; };
  await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.RESEARCH,
    systemPrompt: "Custom research prompt",
    callLLM,
  });
  assert.equal(receivedSystem, "Custom research prompt");
});

test("generateInstructions passes brief-derived user message to callLLM", async () => {
  let receivedUser = null;
  const callLLM = async (_sys, user) => { receivedUser = user; return "x"; };
  await generateInstructions({
    brief: makeBrief(),
    setBy: SOURCES.ENRICHMENT,
    callLLM,
  });
  assert.ok(receivedUser.includes("HR Policy Assistant"));
  assert.ok(receivedUser.includes("Answer policy questions"));
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

test("generateInstructions rejects missing brief", async () => {
  await assert.rejects(
    generateInstructions({ setBy: SOURCES.ENRICHMENT, callLLM: async () => "x" }),
    /brief must be an object/,
  );
});

test("generateInstructions rejects unknown setBy", async () => {
  await assert.rejects(
    generateInstructions({ brief: makeBrief(), setBy: "bogus", callLLM: async () => "x" }),
    /unknown setBy/,
  );
});

test("generateInstructions rejects missing callLLM", async () => {
  await assert.rejects(
    generateInstructions({ brief: makeBrief(), setBy: SOURCES.ENRICHMENT }),
    /callLLM function is required/,
  );
});

test("generateInstructions rejects callLLM returning non-string", async () => {
  await assert.rejects(
    generateInstructions({
      brief: makeBrief(),
      setBy: SOURCES.ENRICHMENT,
      callLLM: async () => ({ not: "a string" }),
    }),
    /must return a string/,
  );
});

test("generateInstructions rejects empty/whitespace LLM output", async () => {
  await assert.rejects(
    generateInstructions({
      brief: makeBrief(),
      setBy: SOURCES.ENRICHMENT,
      callLLM: async () => "   \n\n   ",
    }),
    /empty output/,
  );
});

test("buildUserMessage survives malformed capabilities and boundaries", () => {
  const brief = {
    agent: { name: "Weird Agent" },
    capabilities: [
      null,
      "not-an-object",
      { name: "Good", phase: "mvp", description: "fine" },
      { noName: true, phase: "mvp" },
    ],
    boundaries: {
      handle: ["ok", 42, null],
      decline: [{ topic: "legal" }, "free-form string", null],
      refuse: "not-an-array",
    },
  };
  const msg = buildUserMessage(brief);
  assert.ok(msg.includes("Good"), "valid capability renders");
  assert.ok(!msg.includes("not-an-object"), "string capability entries filtered");
  assert.ok(msg.includes("- Handle: ok"),  "only string handle entries render");
  assert.ok(msg.includes("legal"));
  assert.ok(msg.includes("free-form string"));
  assert.ok(msg.includes("- Refuse: Not specified"), "malformed array falls back");
});

// ---------------------------------------------------------------------------
// Cross-path parity — same brief, different setBy, identical text
// ---------------------------------------------------------------------------

test("parity: enrichment and research paths produce the same text from the same brief", async () => {
  const brief = makeBrief();
  let enrichCalls = 0;
  let researchCalls = 0;

  const callLLM = async (sys, user) => {
    // Deterministic stub keyed on input — proves both paths get identical prompts
    return `SYS:${sys.length}|USER:${user.length}`;
  };

  const enriched = await generateInstructions({
    brief, setBy: SOURCES.ENRICHMENT, callLLM: async (...a) => { enrichCalls++; return callLLM(...a); },
  });
  const researched = await generateInstructions({
    brief, setBy: SOURCES.RESEARCH,   callLLM: async (...a) => { researchCalls++; return callLLM(...a); },
  });

  assert.equal(enriched.text, researched.text, "both paths must receive identical prompts");
  assert.equal(enriched.provenance.lastSetBy, "enrichment");
  assert.equal(researched.provenance.lastSetBy, "research");
  assert.equal(enrichCalls, 1);
  assert.equal(researchCalls, 1);
});
