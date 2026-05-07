/**
 * getDialogById guard tests — pure / no network.
 *
 * Phase 1e adapter. Tests the detail-endpoint pattern (path parameter + single
 * object response shape, distinct from paged or bare-array responses).
 *
 * Run: node --test app/lib/__tests__/island-client.getDialogById.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getDialogById,
    RoutingMisconfiguredError,
    _internal: { isNonEmptyObjectShape }
} = require('../../../tools/island-client.js');

test('getDialogById is exported', () => {
    assert.equal(typeof getDialogById, 'function');
});

test('isNonEmptyObjectShape accepts a Dialog2-like object', () => {
    assert.equal(
        isNonEmptyObjectShape({ id: 'dlg-1', schemaName: 'greeting', $kind: 'DialogComponent' }),
        true
    );
});

test('isNonEmptyObjectShape rejects empty object (likely error envelope)', () => {
    assert.equal(isNonEmptyObjectShape({}), false);
});

test('isNonEmptyObjectShape rejects arrays', () => {
    assert.equal(isNonEmptyObjectShape([]), false);
    assert.equal(isNonEmptyObjectShape([{ id: 'x' }]), false);
});

test('isNonEmptyObjectShape rejects null and undefined', () => {
    assert.equal(isNonEmptyObjectShape(null), false);
    assert.equal(isNonEmptyObjectShape(undefined), false);
});

test('isNonEmptyObjectShape rejects primitives', () => {
    assert.equal(isNonEmptyObjectShape('html'), false);
    assert.equal(isNonEmptyObjectShape(42), false);
    assert.equal(isNonEmptyObjectShape(true), false);
});

test('getDialogById throws RoutingMisconfiguredError for missing dialogId', async () => {
    const goodGateway = 'https://powervamg.us-il104.gateway.prod.island.powerapps.com';
    await assert.rejects(
        () => getDialogById(goodGateway, 'env', 'bot', '', {}),
        (err) => err instanceof RoutingMisconfiguredError && /dialogId is required/.test(err.message)
    );
});

test('getDialogById throws for non-string dialogId', async () => {
    const goodGateway = 'https://powervamg.us-il104.gateway.prod.island.powerapps.com';
    await assert.rejects(
        () => getDialogById(goodGateway, 'env', 'bot', null, {}),
        (err) => err instanceof RoutingMisconfiguredError
    );
});

test('getDialogById fails fast on non-HTTPS gateway', async () => {
    await assert.rejects(
        () => getDialogById('http://powervamg.us-il104.gateway.prod.island.powerapps.com', 'env', 'bot', 'dlg-1', {}),
        (err) => err instanceof RoutingMisconfiguredError && /https:\/\//.test(err.message)
    );
});

test('getDialogById fails fast on non-allowlisted host', async () => {
    await assert.rejects(
        () => getDialogById('https://attacker.example.com', 'env', 'bot', 'dlg-1', {}),
        (err) => err instanceof RoutingMisconfiguredError && /not an allowed/.test(err.message)
    );
});
