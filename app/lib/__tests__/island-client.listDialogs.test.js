/**
 * listDialogs guard tests — pure / no network.
 *
 * Covers the fail-fast checks added in Phase 1b:
 *   - Hostname allowlist (assertAllowedGateway)
 *   - Response shape check (isPagedDialogsShape)
 *   - RoutingMisconfiguredError surface
 *
 * End-to-end live testing requires a real Gateway + token and is out of scope here.
 *
 * Run: node --test app/lib/__tests__/island-client.listDialogs.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    RoutingMisconfiguredError,
    _internal: { assertAllowedGateway, isPagedDialogsShape, ALLOWED_GATEWAY_HOST_SUFFIX }
} = require('../../../tools/island-client.js');

test('ALLOWED_GATEWAY_HOST_SUFFIX is the Island domain', () => {
    assert.equal(ALLOWED_GATEWAY_HOST_SUFFIX, '.gateway.prod.island.powerapps.com');
});

test('assertAllowedGateway accepts a legit Island Gateway hostname', () => {
    assert.doesNotThrow(() =>
        assertAllowedGateway('https://powervamg.us-il104.gateway.prod.island.powerapps.com')
    );
});

test('assertAllowedGateway rejects a random host', () => {
    assert.throws(
        () => assertAllowedGateway('https://attacker.example.com'),
        (err) => err instanceof RoutingMisconfiguredError && /attacker\.example\.com/.test(err.message)
    );
});

test('assertAllowedGateway rejects localhost', () => {
    assert.throws(
        () => assertAllowedGateway('http://localhost:4201'),
        (err) => err instanceof RoutingMisconfiguredError
    );
});

test('assertAllowedGateway rejects http:// even on allowlisted host (HTTPS required)', () => {
    assert.throws(
        () => assertAllowedGateway('http://powervamg.us-il104.gateway.prod.island.powerapps.com'),
        (err) => err instanceof RoutingMisconfiguredError && /https:\/\//.test(err.message)
    );
});

test('assertAllowedGateway wraps URL parse errors in RoutingMisconfiguredError', () => {
    assert.throws(
        () => assertAllowedGateway('not a url'),
        (err) => err instanceof RoutingMisconfiguredError && /not parseable/.test(err.message)
    );
});

test('assertAllowedGateway rejects lookalike suffix injection', () => {
    // e.g. attacker.com.gateway.prod.island.powerapps.com.evil.com — hostname must END with the allowed suffix
    assert.throws(
        () => assertAllowedGateway('https://gateway.prod.island.powerapps.com.evil.com'),
        (err) => err instanceof RoutingMisconfiguredError
    );
});

test('isPagedDialogsShape accepts { items: [] }', () => {
    assert.equal(isPagedDialogsShape({ items: [] }), true);
});

test('isPagedDialogsShape accepts { items: [...], hasMoreResults: false }', () => {
    assert.equal(isPagedDialogsShape({ items: [{ id: 'd1' }], hasMoreResults: false }), true);
});

test('isPagedDialogsShape accepts { value: [...] } (OData shape fallback)', () => {
    assert.equal(isPagedDialogsShape({ value: [] }), true);
});

test('isPagedDialogsShape REJECTS { nextLink: "..." } without items array (tightened)', () => {
    // Pagination metadata alone is not a valid PagedQueryResponseOfDialog.
    assert.equal(isPagedDialogsShape({ nextLink: 'https://...' }), false);
});

test('isPagedDialogsShape rejects { hasMoreResults: false } without items', () => {
    assert.equal(isPagedDialogsShape({ hasMoreResults: false }), false);
});

test('isPagedDialogsShape rejects bare array', () => {
    assert.equal(isPagedDialogsShape([]), false);
});

test('isPagedDialogsShape rejects string body (HTML error page)', () => {
    assert.equal(isPagedDialogsShape('<html>401 Unauthorized</html>'), false);
});

test('isPagedDialogsShape rejects null and undefined', () => {
    assert.equal(isPagedDialogsShape(null), false);
    assert.equal(isPagedDialogsShape(undefined), false);
});

test('isPagedDialogsShape rejects plain error envelope { error: "..." }', () => {
    assert.equal(isPagedDialogsShape({ error: 'bad token' }), false);
});

test('isTestSetsEnvelopeShape accepts { testComponents: [...] }', () => {
    const { _internal: { isTestSetsEnvelopeShape } } = require('../../../tools/island-client.js');
    assert.equal(isTestSetsEnvelopeShape({ testComponents: [] }), true);
    assert.equal(isTestSetsEnvelopeShape({ testComponents: [{ id: 't' }] }), true);
});

test('isTestSetsEnvelopeShape rejects bare array (caught the real contract gap)', () => {
    const { _internal: { isTestSetsEnvelopeShape } } = require('../../../tools/island-client.js');
    assert.equal(isTestSetsEnvelopeShape([]), false);
    assert.equal(isTestSetsEnvelopeShape([{ id: 't' }]), false);
});

test('isTestSetsEnvelopeShape rejects missing/wrong-typed testComponents', () => {
    const { _internal: { isTestSetsEnvelopeShape } } = require('../../../tools/island-client.js');
    assert.equal(isTestSetsEnvelopeShape({}), false);
    assert.equal(isTestSetsEnvelopeShape({ testComponents: "nope" }), false);
    assert.equal(isTestSetsEnvelopeShape(null), false);
});

test('RoutingMisconfiguredError captures url, status, contentType, bodyPreview', () => {
    const err = new RoutingMisconfiguredError('boom', {
        url: 'https://x.gateway.prod.island.powerapps.com/api/foo',
        status: 401,
        contentType: 'text/html',
        bodyPreview: '<html>...'
    });
    assert.equal(err.name, 'RoutingMisconfiguredError');
    assert.equal(err.status, 401);
    assert.equal(err.contentType, 'text/html');
    assert.match(err.url, /gateway\.prod\.island/);
    assert.match(err.bodyPreview, /html/);
});
