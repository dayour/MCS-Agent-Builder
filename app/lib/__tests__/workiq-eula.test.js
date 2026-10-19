'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyWorkIQResult, isEulaGate, workIQShouldRetry } = require('../workiq');

const EULA_BANNER = [
  'In order to use this tool you must accept the End User License Agreement (EULA).',
  'To accept EULA, please execute: workiq accept-eula',
].join('\n');

test('isEulaGate matches the WorkIQ 1.0.0 accept banner', () => {
  assert.equal(isEulaGate(EULA_BANNER), true);
  assert.equal(isEulaGate('customer mentioned a license in an email'), false);
  assert.equal(isEulaGate(''), false);
});

test('exit 0 with the EULA banner is an error, not context', () => {
  const result = classifyWorkIQResult(0, EULA_BANNER, '');
  assert.equal(result.content, '');
  assert.match(result.error, /workiq accept-eula/);
});

test('a normal exit 0 answer is still content', () => {
  const result = classifyWorkIQResult(0, 'Meeting notes from Monday.', '');
  assert.equal(result.content, 'Meeting notes from Monday.');
  assert.equal(result.error, null);
});

test('a real answer that mentions the EULA text is kept', () => {
  const answer = [
    'Please accept the end user license before the vendor call.',
    'notes '.repeat(120),
    'Someone also pasted workiq accept-eula in the thread.',
  ].join('\n');
  assert.equal(isEulaGate(answer), false);
  const result = classifyWorkIQResult(0, answer, '');
  assert.equal(result.error, null);
  assert.match(result.content, /accept the end user license/);
});

test('an EULA acceptance error is not retried', () => {
  const gated = classifyWorkIQResult(0, EULA_BANNER, '');
  assert.equal(workIQShouldRetry(gated, 0, 2), false);
  assert.equal(workIQShouldRetry({ error: 'socket hang up' }, 0, 2), true);
  assert.equal(workIQShouldRetry({ error: null, content: 'ok' }, 0, 2), false);
});

test('auth failures stay auth failures', () => {
  const result = classifyWorkIQResult(1, '', 'WorkIQ not authenticated');
  assert.match(result.error, /not authenticated/i);
  assert.equal(result.content, '');
});
