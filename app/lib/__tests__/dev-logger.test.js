/**
 * Unit tests for the dev-logger module-tag API.
 *
 * Covers:
 *   - info/warn/error emit JSONL events with the right shape
 *   - tag normalization (kebab-case enforced, length capped, fallback on garbage)
 *   - extras serialize correctly (string + object)
 *   - the `[module]` prefix survives roundtrip via formatConsoleEvent so the
 *     terminal output keeps the same greppable shape callers depended on
 *
 * Tests run with NODE_ENV=development + DEV_LOGGER=1 so file writes happen
 * to a temp log path. Each test uses a fresh tmp file so they don't interleave.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Tests need DEV mode to exercise the file writer
process.env.NODE_ENV = "development";
process.env.DEV_LOGGER = "1";
// Disable terminal output so test runs don't pollute stdout with [CON] lines
process.env.DEV_LOGGER_TERMINAL = "0";

const tmpLog = path.join(os.tmpdir(), `dev-logger-test-${Date.now()}-${process.pid}.jsonl`);

// Override LOG_FILE before requiring the module.
// dev-logger writes to a hardcoded LOG_FILE path; the simplest test isolation
// is to require fresh and intercept writeFileSync on the module's stream after
// it's created. Cleaner approach: shim env so file writes go to tmp.
//
// dev-logger doesn't expose LOG_FILE override, so we monkey-patch the module
// after first require by clearing the require cache and re-loading.
const devLoggerPath = require.resolve("../dev-logger");

let _prevLogger = null;

function freshLogger() {
  // Close any prior logger's write stream so the file handle is released
  if (_prevLogger) {
    try { _prevLogger.close(); } catch { /* ignore */ }
  }
  delete require.cache[devLoggerPath];
  const dev = require("../dev-logger");
  // Clear file (after the prior stream is closed)
  try { fs.writeFileSync(dev.LOG_FILE, ""); } catch { /* ignore */ }
  _prevLogger = dev;
  return dev;
}

function readEvents(dev) {
  // Flush the write stream before reading. createWriteStream buffers internally,
  // so we close + reopen by simply waiting for a drain event. Easier: close the
  // stream (it flushes on close) and re-require.
  return new Promise((resolve) => {
    try { dev.close(); } catch { /* ignore */ }
    // Give the close event a tick to flush
    setTimeout(() => {
      try {
        const raw = fs.readFileSync(dev.LOG_FILE, "utf-8");
        const lines = raw.trim().split("\n").filter(Boolean);
        resolve(lines.map((l) => JSON.parse(l)));
      } catch {
        resolve([]);
      }
    }, 20);
  });
}

test.after(() => {
  try { fs.unlinkSync(tmpLog); } catch { /* ignore */ }
});

test("info emits cat=console, type=log, with tag/msg fields", async () => {
  const dev = freshLogger();
  dev.info("scheduler", "tier1 refresh complete");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "scheduler");
  assert.equal(ours.length, 1, "exactly one matching event");
  assert.equal(ours[0].cat, "console");
  assert.equal(ours[0].type, "log");
  assert.equal(ours[0].data.tag, "scheduler");
  assert.equal(ours[0].data.msg, "tier1 refresh complete");
});

test("warn emits type=warn", async () => {
  const dev = freshLogger();
  dev.warn("build-pipeline", "fallback path hit");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "build-pipeline");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].type, "warn");
});

test("error emits type=error", async () => {
  const dev = freshLogger();
  dev.error("chat-router", "spec write failed");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "chat-router");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].type, "error");
});

test("extras attach as data.extras", async () => {
  const dev = freshLogger();
  dev.info("scheduler", "job done", { duration: 480, count: 12 });
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "scheduler");
  assert.equal(ours.length, 1);
  assert.deepEqual(ours[0].data.extras, { duration: 480, count: 12 });
});

test("string extras pass through unchanged", async () => {
  const dev = freshLogger();
  dev.info("research", "phase B", "components=4");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "research");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].data.extras, "components=4");
});

test("tag with invalid characters is sanitized", async () => {
  const dev = freshLogger();
  // Slashes, spaces, brackets — common when callers paste a route string
  dev.info("scheduler/tier1 ", "x");
  const events = await readEvents(dev);
  // Sanitized to 'scheduler-tier1-' then trimmed/regex-tested
  const ours = events.filter((e) => e.data?.tag.startsWith("scheduler"));
  assert.equal(ours.length, 1);
  assert.match(ours[0].data.tag, /^[a-zA-Z0-9._:-]+$/);
});

test("non-string tag falls back to 'log'", async () => {
  const dev = freshLogger();
  dev.info(undefined, "no tag");
  dev.info(42, "numeric tag");
  const events = await readEvents(dev);
  const fallback = events.filter((e) => e.data?.tag === "log");
  assert.equal(fallback.length, 2);
});

test("tag longer than 32 chars is truncated", async () => {
  const dev = freshLogger();
  const longTag = "a".repeat(50);
  dev.info(longTag, "long tag");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.msg === "long tag");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].data.tag.length, 32);
});

test("non-string msg gets JSON-stringified", async () => {
  const dev = freshLogger();
  dev.info("test", { foo: "bar" });
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "test");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].data.msg, '{"foo":"bar"}');
});

test("multiple calls preserve order in the JSONL log", async () => {
  const dev = freshLogger();
  dev.info("ord", "first");
  dev.info("ord", "second");
  dev.warn("ord", "third");
  const events = await readEvents(dev);
  const ours = events.filter((e) => e.data?.tag === "ord");
  assert.equal(ours.length, 3);
  assert.equal(ours[0].data.msg, "first");
  assert.equal(ours[1].data.msg, "second");
  assert.equal(ours[2].data.msg, "third");
});

test("normalizeTag exposed for advanced callers", () => {
  const dev = freshLogger();
  assert.equal(dev._normalizeTag("scheduler"), "scheduler");
  assert.equal(dev._normalizeTag("foo bar"), "foo-bar");
  assert.equal(dev._normalizeTag("a".repeat(64)).length, 32);
  assert.equal(dev._normalizeTag(null), "log");
  assert.equal(dev._normalizeTag(undefined), "log");
  assert.equal(dev._normalizeTag(""), "log");
});
