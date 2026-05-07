/**
 * Pipeline harness smoke tests — pure-function coverage.
 *
 * Tests classifyTopicData, pickHighestSeverity, computeTrend, and
 * planFor without hitting MCS. Run with:
 *   node --test tools/__tests__/pipeline-smoke.test.js
 *
 * If these pass, the library wiring is correct; live verification
 * is a separate concern (auth + dktest reachability).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const verify = require('../verify-component');
const fixMap = require('../pipeline-fix-map');
const { SEVERITY_ORDER, getClassification } = require('../pipeline-classifications');
const { pickHighestSeverity, computeTrend } = require('../pipeline-test-loop');

// --- classifyTopicData ---

test('classifyTopicData: missing observed returns topic-missing', () => {
    const r = verify.classifyTopicData(null, { name: 'Greeting' });
    assert.equal(r.status, 'failed');
    assert.equal(r.classification, 'topic-missing');
    assert.equal(r.component, 'topic');
    assert.equal(r.id, 'Greeting');
});

test('classifyTopicData: undefined observed returns topic-missing', () => {
    const r = verify.classifyTopicData(undefined, { name: 'Greeting' });
    assert.equal(r.classification, 'topic-missing');
});

test('classifyTopicData: comment-header data returns topic-not-rendered', () => {
    const data = '# Name: Greeting\n# Description: Says hello\nkind: AdaptiveDialog\n';
    const r = verify.classifyTopicData({ data, name: 'Greeting' }, { name: 'Greeting' });
    assert.equal(r.status, 'failed');
    assert.equal(r.classification, 'topic-not-rendered');
    assert.ok(Array.isArray(r.diff) && r.diff.length === 1);
    assert.equal(r.diff[0].path, 'data[0:6]');
    assert.equal(r.diff[0].expected, 'kind: ');
});

test('classifyTopicData: leading "# " (any comment) is topic-not-rendered', () => {
    const data = '# Plain comment\nkind: AdaptiveDialog';
    const r = verify.classifyTopicData({ data, name: 'X' }, { name: 'X' });
    assert.equal(r.classification, 'topic-not-rendered');
});

test('classifyTopicData: clean kind: header returns match', () => {
    const data = 'kind: AdaptiveDialog\nbeginDialog:\n  kind: OnRecognizedIntent';
    const r = verify.classifyTopicData({ data, name: 'Greeting' }, { name: 'Greeting' });
    assert.equal(r.status, 'match');
    assert.equal(r.classification, null);
    assert.deepEqual(r.diff, []);
});

test('classifyTopicData: data field starts with neither # nor kind: returns partial (no classification)', () => {
    const data = 'someUnexpectedLeader: true\n';
    const r = verify.classifyTopicData({ data, name: 'X' }, { name: 'X' });
    assert.equal(r.status, 'partial');
    assert.equal(r.classification, null);
});

test('classifyTopicData: empty data field returns partial', () => {
    const r = verify.classifyTopicData({ data: '', name: 'X' }, { name: 'X' });
    assert.equal(r.status, 'partial');
});

// --- pickHighestSeverity ---

test('pickHighestSeverity: returns null when no failures', () => {
    const results = [{ status: 'match', classification: null }];
    assert.equal(pickHighestSeverity(results), null);
});

test('pickHighestSeverity: picks lower severity number first (publish before topic)', () => {
    const results = [
        { status: 'failed', classification: 'topic-not-rendered', id: 't' },
        { status: 'failed', classification: 'publish-silent-fail', id: 'p' },
    ];
    const top = pickHighestSeverity(results);
    assert.equal(top.classification, 'publish-silent-fail');
});

test('pickHighestSeverity: ignores partial/skipped, picks failed only', () => {
    const results = [
        { status: 'partial', classification: null },
        { status: 'skipped' },
        { status: 'failed', classification: 'topic-not-rendered', id: 't' },
    ];
    const top = pickHighestSeverity(results);
    assert.equal(top.classification, 'topic-not-rendered');
});

// --- computeTrend ---

test('computeTrend: first run returns "first-run"', () => {
    assert.equal(computeTrend([], ['topic-not-rendered']), 'first-run');
});

test('computeTrend: empty current means green', () => {
    assert.equal(computeTrend([{ classifications: ['x'] }], []), 'green');
});

test('computeTrend: same set repeated 3 times returns stalled', () => {
    const log = [
        { classifications: ['topic-not-rendered'] },
        { classifications: ['topic-not-rendered'] },
    ];
    assert.equal(computeTrend(log, ['topic-not-rendered']), 'stalled');
});

test('computeTrend: same set twice returns flat (not yet stalled)', () => {
    const log = [{ classifications: ['topic-not-rendered'] }];
    assert.equal(computeTrend(log, ['topic-not-rendered']), 'flat');
});

test('computeTrend: shrinking set returns improving', () => {
    const log = [{ classifications: ['a', 'b', 'c'] }];
    assert.equal(computeTrend(log, ['a']), 'improving');
});

test('computeTrend: growing set returns regressing', () => {
    const log = [{ classifications: ['a'] }];
    assert.equal(computeTrend(log, ['a', 'b']), 'regressing');
});

test('computeTrend: previously green, now failures returns regressing', () => {
    const log = [{ classifications: [] }];
    assert.equal(computeTrend(log, ['a']), 'regressing');
});

// --- fix-map planner ---

test('planFor: topic-not-rendered returns auto plan with mcs-lsp push action', () => {
    const plan = fixMap.planFor('topic-not-rendered');
    assert.equal(plan.type, 'auto');
    assert.equal(plan.classification, 'topic-not-rendered');
    assert.equal(plan.learningRef, 'bm-026');
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].tool, 'mcs-lsp');
    assert.equal(plan.actions[0].fn, 'push');
});

test('planFor: card-powerfx-scope returns escalate (destructive spec change)', () => {
    const plan = fixMap.planFor('card-powerfx-scope');
    assert.equal(plan.type, 'escalate');
    assert.ok(plan.reason && plan.reason.length > 10);
});

test('planFor: unknown classification returns null', () => {
    assert.equal(fixMap.planFor('not-a-real-classification'), null);
});

test('resolveAction: replaces $ctx.workspacePath with the literal value', () => {
    const action = { tool: 'mcs-lsp', fn: 'push', args: { workspacePath: '$ctx.workspacePath' } };
    const ctx = { workspacePath: '/tmp/foo' };
    const resolved = fixMap.resolveAction(action, ctx);
    assert.equal(resolved.args.workspacePath, '/tmp/foo');
});

// --- classifications module ---

test('SEVERITY_ORDER: publish-silent-fail comes before topic-not-rendered', () => {
    const pubIdx = SEVERITY_ORDER.indexOf('publish-silent-fail');
    const topicIdx = SEVERITY_ORDER.indexOf('topic-not-rendered');
    assert.ok(pubIdx >= 0 && topicIdx >= 0);
    assert.ok(pubIdx < topicIdx, 'publish should rank before topic');
});

test('getClassification: returns null for unknown id', () => {
    assert.equal(getClassification('not-real'), null);
});

test('getClassification: returns metadata for known id', () => {
    const meta = getClassification('topic-not-rendered');
    assert.equal(meta.component, 'topic');
    assert.ok(meta.severity > 0);
    assert.equal(meta.learning, 'bm-026');
});
