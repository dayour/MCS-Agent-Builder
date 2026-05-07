/**
 * Integration: projects.js scanAgents + listProjects should surface buildStatusRaw +
 * filtered evalGate to the client, NOT the raw brief.
 *
 * Run: node --test app/lib/__tests__/projects-evalgate-filter.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Isolate flag file for tests
const TMP_FLAGS = path.join(os.tmpdir(), `projects-evalgate-flags-${Date.now()}.json`);
process.env.EVAL_GATE_FLAGS = TMP_FLAGS;

const { listProjects } = require("../projects");

// Build a minimal throwaway Build-Guides fixture
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bg-test-"));
  const agentDir = path.join(root, "SampleProj", "agents", "ta1");
  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(path.join(agentDir, "agentspec.json"), JSON.stringify({
    agent: { name: "Tester" },
    buildStatus: { status: "published-uat" },
    evalGate: {
      override: true,
      overrideApprovedBy: "Jane Doe",
      overrideReason: "demo reason",
      overrideTicketRef: "gh-1",
      overrideSpecHash: "abc123",
      verdict: "SHIP",
      provenance: { buildSha: "deadbeef", specHash: "abc123" },
    },
  }));
  return root;
}

test("listProjects surfaces buildStatusRaw to client", () => {
  const root = makeFixture();
  const projects = listProjects(root);
  const agent = projects[0].agents[0];
  assert.equal(agent.buildStatusRaw, "published-uat");
  assert.equal(agent._brief, undefined, "raw brief must be stripped");
});

test("listProjects respects 'admin' visibility — hides override details from maker", () => {
  fs.writeFileSync(TMP_FLAGS, JSON.stringify({ visibility: "admin" }));
  const root = makeFixture();
  listProjects.__viewerRole = "maker";
  try {
    const projects = listProjects(root);
    const gate = projects[0].agents[0].evalGate;
    assert.equal(gate.override, true, "override flag preserved (non-sensitive)");
    assert.equal(gate.verdict, "SHIP");
    assert.equal(gate.overrideApprovedBy, undefined, "admin-tier visibility hides approver from maker");
    assert.equal(gate.overrideReason, undefined);
    assert.equal(gate.overrideTicketRef, undefined);
    assert.equal(gate.provenance, undefined, "provenance hidden from non-admin under admin visibility");
  } finally {
    listProjects.__viewerRole = undefined;
  }
});

test("listProjects respects 'admin' visibility — full detail for admin", () => {
  fs.writeFileSync(TMP_FLAGS, JSON.stringify({ visibility: "admin" }));
  const root = makeFixture();
  listProjects.__viewerRole = "admin";
  try {
    const projects = listProjects(root);
    const gate = projects[0].agents[0].evalGate;
    assert.equal(gate.overrideApprovedBy, "Jane Doe");
    assert.ok(gate.provenance);
  } finally {
    listProjects.__viewerRole = undefined;
  }
});

test("default 'maker' visibility shows full gate to maker role (current behavior)", () => {
  try { fs.unlinkSync(TMP_FLAGS); } catch {}
  // No flag file → DEFAULT_FLAGS visibility='maker'
  const root = makeFixture();
  const projects = listProjects(root);
  const gate = projects[0].agents[0].evalGate;
  assert.equal(gate.overrideApprovedBy, "Jane Doe");
  assert.equal(gate.verdict, "SHIP");
});
