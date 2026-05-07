/**
 * getSystemDialogs guard tests — pure / no network.
 *
 * Phase 1c adapter uses a different shape validator (isDialogArrayShape) because
 * Dialogs_GetSystemDialogs returns Dialog2[] directly, not a paged envelope.
 *
 * Run: node --test app/lib/__tests__/island-client.getSystemDialogs.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getSystemDialogs,
    RoutingMisconfiguredError,
    _internal: { isDialogArrayShape }
} = require('../../../tools/island-client.js');

test('getSystemDialogs is exported', () => {
    assert.equal(typeof getSystemDialogs, 'function');
});

test('isDialogArrayShape accepts empty array', () => {
    assert.equal(isDialogArrayShape([]), true);
});

test('isDialogArrayShape accepts array of dialog-like objects', () => {
    assert.equal(isDialogArrayShape([{ id: 'sys-greeting', name: 'Greeting' }]), true);
});

test('isDialogArrayShape rejects object with items (that is the Paged shape)', () => {
    assert.equal(isDialogArrayShape({ items: [] }), false);
});

test('isDialogArrayShape rejects array of primitives', () => {
    assert.equal(isDialogArrayShape(['greeting', 'escalate']), false);
});

test('isDialogArrayShape rejects array of arrays', () => {
    assert.equal(isDialogArrayShape([[1], [2]]), false);
});

test('isDialogArrayShape rejects null and undefined', () => {
    assert.equal(isDialogArrayShape(null), false);
    assert.equal(isDialogArrayShape(undefined), false);
});

test('isDialogArrayShape rejects string body', () => {
    assert.equal(isDialogArrayShape('<html>...</html>'), false);
});

test('getSystemDialogs fails fast on non-HTTPS gateway (inherits guard)', async () => {
    await assert.rejects(
        () => getSystemDialogs('http://powervamg.us-il104.gateway.prod.island.powerapps.com', 'env', 'bot', {}),
        (err) => err instanceof RoutingMisconfiguredError && /https:\/\//.test(err.message)
    );
});

test('getSystemDialogs fails fast on non-allowlisted host (inherits guard)', async () => {
    await assert.rejects(
        () => getSystemDialogs('https://attacker.example.com', 'env', 'bot', {}),
        (err) => err instanceof RoutingMisconfiguredError && /not an allowed/.test(err.message)
    );
});
