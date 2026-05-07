/**
 * getSystemIntents guard tests — pure / no network.
 *
 * Phase 1d adapter. Same shape (Intent2[]) as getSystemDialogs, so reuses
 * the isBareObjectArrayShape validator. Tests focus on the guard inheritance
 * and end-to-end error path; shape validator itself is covered in the
 * getSystemDialogs test file.
 *
 * Run: node --test app/lib/__tests__/island-client.getSystemIntents.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getSystemIntents,
    RoutingMisconfiguredError,
    _internal: { isBareObjectArrayShape }
} = require('../../../tools/island-client.js');

test('getSystemIntents is exported', () => {
    assert.equal(typeof getSystemIntents, 'function');
});

test('isBareObjectArrayShape is exported under the generic name', () => {
    assert.equal(typeof isBareObjectArrayShape, 'function');
});

test('isBareObjectArrayShape accepts Intent2-like objects', () => {
    assert.equal(
        isBareObjectArrayShape([{ id: 'sys-escalate', displayName: 'Escalate to an agent' }]),
        true
    );
});

test('getSystemIntents fails fast on non-HTTPS gateway', async () => {
    await assert.rejects(
        () => getSystemIntents('http://powervamg.us-il104.gateway.prod.island.powerapps.com', 'env', 'bot', {}),
        (err) => err instanceof RoutingMisconfiguredError && /https:\/\//.test(err.message)
    );
});

test('getSystemIntents fails fast on non-allowlisted host', async () => {
    await assert.rejects(
        () => getSystemIntents('https://attacker.example.com', 'env', 'bot', {}),
        (err) => err instanceof RoutingMisconfiguredError && /not an allowed/.test(err.message)
    );
});

test('getSystemIntents fails fast on malformed gateway URL', async () => {
    await assert.rejects(
        () => getSystemIntents('not a url', 'env', 'bot', {}),
        (err) => err instanceof RoutingMisconfiguredError && /not parseable/.test(err.message)
    );
});
