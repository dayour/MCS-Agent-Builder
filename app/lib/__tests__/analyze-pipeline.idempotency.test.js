/**
 * Idempotency tests for app/lib/analyze-pipeline.js findRunningJobIn.
 *
 * Exercises the pure lookup that backs startAnalyzePipeline's dedup gate:
 * double-click, multi-tab, and refresh races should all resolve to the
 * existing running job instead of spawning a duplicate.
 *
 * Run: npm run test:unit
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { findRunningJobIn } = require("../analyze-pipeline");

function makeJob(overrides) {
  return {
    id: `j-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "demo",
    agentId: "default",
    status: "running",
    ...overrides,
  };
}

test("findRunningJobIn returns null on empty iterable", () => {
  assert.equal(findRunningJobIn([], "demo", "default"), null);
});

test("findRunningJobIn returns the matching running job", () => {
  const jobs = [
    makeJob({ id: "j1", status: "completed" }),
    makeJob({ id: "j2", status: "running", projectId: "demo", agentId: "default" }),
    makeJob({ id: "j3", status: "running", projectId: "other", agentId: "default" }),
  ];
  const found = findRunningJobIn(jobs, "demo", "default");
  assert.equal(found?.id, "j2");
});

test("findRunningJobIn ignores completed and failed jobs", () => {
  const jobs = [
    makeJob({ status: "completed", projectId: "demo", agentId: "default" }),
    makeJob({ status: "failed",    projectId: "demo", agentId: "default" }),
  ];
  assert.equal(findRunningJobIn(jobs, "demo", "default"), null);
});

test("findRunningJobIn treats missing agentId as empty string", () => {
  const jobs = [makeJob({ status: "running", projectId: "demo", agentId: "" })];
  assert.equal(findRunningJobIn(jobs, "demo", undefined)?.agentId, "");
  assert.equal(findRunningJobIn(jobs, "demo", null)?.agentId, "");
  assert.equal(findRunningJobIn(jobs, "demo", "other"), null);
});

test("findRunningJobIn returns the first match when multiple exist", () => {
  const jobs = [
    makeJob({ id: "j-first",  status: "running", projectId: "demo", agentId: "a" }),
    makeJob({ id: "j-second", status: "running", projectId: "demo", agentId: "a" }),
  ];
  const found = findRunningJobIn(jobs, "demo", "a");
  assert.equal(found.id, "j-first");
});

test("findRunningJobIn scopes by both projectId and agentId", () => {
  const jobs = [
    makeJob({ status: "running", projectId: "p1", agentId: "a1" }),
    makeJob({ status: "running", projectId: "p1", agentId: "a2" }),
    makeJob({ status: "running", projectId: "p2", agentId: "a1" }),
  ];
  assert.equal(findRunningJobIn(jobs, "p1", "a1")?.agentId, "a1");
  assert.equal(findRunningJobIn(jobs, "p1", "a2")?.agentId, "a2");
  assert.equal(findRunningJobIn(jobs, "p2", "a1")?.projectId, "p2");
  assert.equal(findRunningJobIn(jobs, "p2", "a2"), null);
});

test("findRunningJobIn works with a Map's values iterator", () => {
  const m = new Map();
  m.set("j1", makeJob({ status: "running", projectId: "demo", agentId: "a" }));
  m.set("j2", makeJob({ status: "completed", projectId: "demo", agentId: "a" }));
  const found = findRunningJobIn(m.values(), "demo", "a");
  assert.equal(found?.status, "running");
});

// ---------------------------------------------------------------------------
// research-pipeline variant — same invariant, plus skillType scoping
// ---------------------------------------------------------------------------

const { findRunningJobIn: findResearchJob } = require("../research-pipeline");

test("research-pipeline findRunningJobIn scopes by skillType", () => {
  const jobs = [
    makeJob({ skillType: "research", status: "running", projectId: "demo", agentId: "a" }),
    makeJob({ skillType: "eval",     status: "running", projectId: "demo", agentId: "a" }),
    makeJob({ skillType: "fix",      status: "running", projectId: "demo", agentId: "a" }),
  ];
  assert.equal(findResearchJob(jobs, "research", "demo", "a")?.skillType, "research");
  assert.equal(findResearchJob(jobs, "eval",     "demo", "a")?.skillType, "eval");
  assert.equal(findResearchJob(jobs, "build",    "demo", "a"), null);
});

test("research-pipeline findRunningJobIn scopes by projectId and agentId", () => {
  const jobs = [
    makeJob({ skillType: "research", status: "running", projectId: "p1", agentId: "a1" }),
    makeJob({ skillType: "research", status: "running", projectId: "p1", agentId: "a2" }),
    makeJob({ skillType: "research", status: "completed", projectId: "p1", agentId: "a1" }),
  ];
  assert.equal(findResearchJob(jobs, "research", "p1", "a1")?.agentId, "a1");
  assert.equal(findResearchJob(jobs, "research", "p2", "a1"), null);
});
