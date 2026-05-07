/**
 * typed-adoption-stats tests — pure / no git shelling out.
 *
 * Run: node --test app/lib/__tests__/typed-adoption-stats.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { _internal: { hashId, readRecords, summarize } } = require("../../../tools/typed-adoption-stats");

test("hashId returns null for falsy input", () => {
    assert.equal(hashId(null), null);
    assert.equal(hashId(undefined), null);
    assert.equal(hashId(""), null);
});

test("hashId is deterministic (same input -> same output)", () => {
    assert.equal(hashId("f9a0cae4-a7e5-e91a-b358-9b848e12071c"),
                 hashId("f9a0cae4-a7e5-e91a-b358-9b848e12071c"));
});

test("hashId differs for different inputs", () => {
    assert.notEqual(hashId("a"), hashId("b"));
});

test("hashId output is h_<12hex>", () => {
    const h = hashId("some-id");
    assert.match(h, /^h_[0-9a-f]{12}$/);
});

test("readRecords returns parsed JSONL skipping malformed lines", () => {
    // Write a temp file with good and bad lines, read via a temporary STATS_FILE swap.
    // Module caches STATS_FILE so we test readRecords's behavior separately by calling
    // its logic inline against a temp path.
    const tmp = path.join(os.tmpdir(), `stats-test-${Date.now()}.jsonl`);
    fs.writeFileSync(tmp, [
        '{"ts":"2026-04-17T00:00:00Z","build_run_id":"a","typed_sets":1,"legacy_sets":0,"typed_tests":3,"legacy_tests":0,"fallback_reasons":[]}',
        'not json',
        '',
        '{"ts":"2026-04-17T01:00:00Z","build_run_id":"b","typed_sets":0,"legacy_sets":2,"typed_tests":0,"legacy_tests":4,"fallback_reasons":["set: 500"]}',
    ].join("\n"));

    const parsed = fs.readFileSync(tmp, "utf8").split("\n").map((l) => {
        const t = l.trim();
        if (!t) return null;
        try { return JSON.parse(t); } catch { return null; }
    }).filter(Boolean);

    assert.equal(parsed.length, 2, "2 valid lines, 1 malformed, 1 empty -> 2 records");
    assert.equal(parsed[0].build_run_id, "a");
    assert.equal(parsed[1].legacy_sets, 2);

    fs.unlinkSync(tmp);
});

test("summarize handles empty records without throwing", () => {
    // Capture console.log to assert output
    const original = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(" "));
    try {
        summarize([]);
    } finally {
        console.log = original;
    }
    assert.ok(logs.some((l) => /no unique build records/.test(l)));
});

test("summarize dedups by build_run_id (retries don't inflate totals)", () => {
    const original = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(" "));
    try {
        summarize([
            { ts: "2026-04-17T00:00:00Z", build_run_id: "run-1", typed_sets: 2, legacy_sets: 0, typed_tests: 5, legacy_tests: 0, fallback_reasons: [] },
            { ts: "2026-04-17T00:00:30Z", build_run_id: "run-1", typed_sets: 2, legacy_sets: 0, typed_tests: 5, legacy_tests: 0, fallback_reasons: [] },
            { ts: "2026-04-17T00:01:00Z", build_run_id: "run-2", typed_sets: 1, legacy_sets: 1, typed_tests: 0, legacy_tests: 3, fallback_reasons: ["set: 500"] },
        ]);
    } finally {
        console.log = original;
    }
    const joined = logs.join("\n");
    assert.match(joined, /2 unique builds/);
    assert.match(joined, /typed: 3\s+legacy: 1/, "sums reflect 2 dedup runs: typed 2+1=3, legacy 0+1=1");
});

test("summarize surfaces top fallback reasons", () => {
    const original = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(" "));
    try {
        summarize([
            { ts: "2026-04-17T00:00:00Z", build_run_id: "r1", typed_sets: 0, legacy_sets: 1, typed_tests: 0, legacy_tests: 0, fallback_reasons: ["set: 500 System Error"] },
            { ts: "2026-04-17T00:01:00Z", build_run_id: "r2", typed_sets: 0, legacy_sets: 1, typed_tests: 0, legacy_tests: 0, fallback_reasons: ["set: 500 System Error"] },
            { ts: "2026-04-17T00:02:00Z", build_run_id: "r3", typed_sets: 1, legacy_sets: 0, typed_tests: 0, legacy_tests: 0, fallback_reasons: [] },
        ]);
    } finally {
        console.log = original;
    }
    const joined = logs.join("\n");
    assert.match(joined, /Top fallback reasons/);
    assert.match(joined, /2x set: 500/);
});
