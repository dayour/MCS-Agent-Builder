/**
 * microsoft-agents-objectmodel npm package integration smoke
 *
 * This package ships the canonical Copilot Studio bot schema, generated TS
 * types (kinds, idTypes, enums, mapper, typeGuards), WASM command definitions,
 * and PowerFx helpers. It's the single source of truth we use to replace
 * hand-written type definitions.
 *
 * The package uses an older pre-exports packaging convention: package.json has
 * `"module": "./dist/index.esm.js"` but no `main` / `exports` field, so plain
 * Node can't resolve `import 'microsoft-agents-objectmodel'` by the bare
 * specifier. Consumers must import via the explicit dist path until the
 * upstream package adds an `exports` map.
 *
 * Run: node --test app/lib/__tests__/microsoft-agents-objectmodel.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

function packageIsResolvable() {
    try {
        require.resolve('microsoft-agents-objectmodel/package.json');
        return true;
    } catch {
        return false;
    }
}

// Skip entire file in CI environments where the Azure DevOps feed isn't
// authenticated. Tests run in full on developer machines after
// `npm run auth:ado-npm && npm install`.
const skipAll = { skip: packageIsResolvable() ? false : 'microsoft-agents-objectmodel not installed — run `npm run auth:ado-npm && npm install`' };

test('package is installed at the expected version', skipAll, () => {
    const pkg = require('microsoft-agents-objectmodel/package.json');
    assert.equal(pkg.name, 'microsoft-agents-objectmodel');
    // Version is advanced by Microsoft-internal pipelines; just confirm presence.
    assert.match(pkg.version, /^\d+\.\d+\.\d+/);
});

test('dynamic ESM import resolves via explicit dist path', skipAll, async () => {
    const om = await import('microsoft-agents-objectmodel/dist/index.esm.js');
    assert.equal(typeof om, 'object');
    assert.ok(Object.keys(om).length > 100, `expected many exports, got ${Object.keys(om).length}`);
});

test('bot schema is exported and looks like a JSON Schema', skipAll, async () => {
    const om = await import('microsoft-agents-objectmodel/dist/index.esm.js');
    assert.equal(typeof om.schema, 'object');
    assert.ok(om.schema.$ref || om.schema.$schema || om.schema.definitions,
        'schema should have at least one JSON Schema top-level field');
});

test('yamlSchema is exported separately from schema', skipAll, async () => {
    const om = await import('microsoft-agents-objectmodel/dist/index.esm.js');
    assert.equal(typeof om.yamlSchema, 'object');
    assert.notEqual(om.yamlSchema, om.schema, 'yamlSchema and schema should be distinct');
});

test('representative runtime exports exist (enums, helpers, kinds)', skipAll, async () => {
    const om = await import('microsoft-agents-objectmodel/dist/index.esm.js');
    // These come from the generated TS layer — picked because they appeared
    // in the Object.keys(om) sample during first smoke.
    assert.equal(typeof om.ActivityType, 'object', 'ActivityType enum should be exported');
    assert.equal(typeof om.ActivityTypeHelpers, 'object', 'ActivityTypeHelpers should be exported');
    assert.equal(typeof om.AgentMessageContentType, 'object', 'AgentMessageContentType should be exported');
});
