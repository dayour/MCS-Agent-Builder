/**
 * Unit tests for the spec-store mutex unification.
 *
 * Covers:
 *   - writeSpec is atomic (temp + rename) — no half-written state
 *   - withSpecLock serializes by agentDir
 *   - withProjectSpecLock + withSpecLock share the same lock when the
 *     agentDir derived from projectId matches
 *   - Lock survives a rejected fn (next caller still runs)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const specStore = require("../chat/spec-store");

function tmpAgentDir(label) {
  const dir = path.join(os.tmpdir(), `spec-store-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test.after(() => {
  // Tests use os.tmpdir() — let the OS clean up. Best effort cleanup of
  // anything still under our prefix.
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith("spec-store-test-")) {
        fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
      }
    }
  } catch { /* ignore */ }
});

test("writeSpec writes atomically (no .tmp left after success)", () => {
  const dir = tmpAgentDir("atomic");
  specStore.writeSpec(dir, { agent: { name: "Test" } });
  const written = JSON.parse(fs.readFileSync(path.join(dir, "agentspec.json"), "utf-8"));
  assert.equal(written.agent.name, "Test");
  // No .tmp-* leftover
  const leftovers = fs.readdirSync(dir).filter((n) => n.includes(".tmp-"));
  assert.deepEqual(leftovers, [], "no tmp file left over after atomic write");
});

test("writeSpec stamps updated_at", () => {
  const dir = tmpAgentDir("updated_at");
  specStore.writeSpec(dir, { agent: { name: "T" } });
  const written = JSON.parse(fs.readFileSync(path.join(dir, "agentspec.json"), "utf-8"));
  assert.match(written.updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("withSpecLock serializes concurrent writers on the same agentDir", async () => {
  const dir = tmpAgentDir("lock-same");
  let inFlight = 0;
  let maxInFlight = 0;

  async function critical() {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
  }

  await Promise.all([
    specStore.withSpecLock(dir, critical),
    specStore.withSpecLock(dir, critical),
    specStore.withSpecLock(dir, critical),
    specStore.withSpecLock(dir, critical),
  ]);

  assert.equal(maxInFlight, 1, "at most one critical section runs at a time");
});

test("withSpecLock allows different agentDirs to run concurrently", async () => {
  const a = tmpAgentDir("lock-a");
  const b = tmpAgentDir("lock-b");
  let active = new Set();
  let maxActive = 0;

  async function critical(label) {
    active.add(label);
    maxActive = Math.max(maxActive, active.size);
    await new Promise((r) => setTimeout(r, 10));
    active.delete(label);
  }

  await Promise.all([
    specStore.withSpecLock(a, () => critical("a")),
    specStore.withSpecLock(b, () => critical("b")),
  ]);

  assert.equal(maxActive, 2, "different agentDirs run in parallel");
});

test("withSpecLock survives a rejected fn — next caller still runs", async () => {
  const dir = tmpAgentDir("lock-reject");
  let secondRan = false;

  // First task throws
  const first = specStore.withSpecLock(dir, async () => { throw new Error("boom"); });
  await first.catch(() => {}); // swallow

  // Second task should still run
  await specStore.withSpecLock(dir, async () => { secondRan = true; });

  assert.equal(secondRan, true);
});

test("writeSpecLocked combines lock + atomic write", async () => {
  const dir = tmpAgentDir("locked-write");
  await Promise.all([
    specStore.writeSpecLocked(dir, { agent: { name: "First" } }),
    specStore.writeSpecLocked(dir, { agent: { name: "Second" } }),
    specStore.writeSpecLocked(dir, { agent: { name: "Third" } }),
  ]);
  // The last write to land determines the final state, but the file is
  // never partially written between concurrent writers.
  const written = JSON.parse(fs.readFileSync(path.join(dir, "agentspec.json"), "utf-8"));
  assert.ok(["First", "Second", "Third"].includes(written.agent.name));
  // Verify no partial-write artifacts
  const leftovers = fs.readdirSync(dir).filter((n) => n.includes(".tmp-"));
  assert.deepEqual(leftovers, []);
});

test("withProjectSpecLock derives agentDir and shares the lock map", async () => {
  // Pre-create a project under BUILD_GUIDES so sessionPaths resolves.
  const projectId = `mutex-test-${Date.now()}`;
  const paths = specStore.sessionPaths(projectId);
  fs.mkdirSync(paths.agentDir, { recursive: true });

  let inFlight = 0;
  let maxInFlight = 0;
  async function critical() {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
  }

  // One caller uses withProjectSpecLock, the other withSpecLock(agentDir).
  // They MUST share the same lock so the critical sections don't overlap.
  await Promise.all([
    specStore.withProjectSpecLock(projectId, critical),
    specStore.withSpecLock(paths.agentDir, critical),
    specStore.withProjectSpecLock(projectId, critical),
  ]);

  assert.equal(maxInFlight, 1, "withProjectSpecLock and withSpecLock share the same key");

  // Cleanup
  try { fs.rmSync(paths.folder, { recursive: true, force: true }); } catch { /* ignore */ }
});
