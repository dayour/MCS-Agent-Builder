#!/usr/bin/env node
/**
 * Validate vendored OpenAPI/Swagger specs against their provenance records.
 *
 * Checks:
 *   1. Each <spec>.json has a matching <spec>.provenance.json
 *   2. Provenance.sha256 matches the actual file hash (detect tampering / silent edits)
 *   3. Spec parses as JSON
 *   4. Spec has expected structural keys (paths, definitions or components)
 *
 * Exit codes:
 *   0 — all specs valid
 *   1 — any spec invalid; details printed
 */

const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../lib/ids');

function checkSpec(specPath) {
  const errors = [];
  const baseName = path.basename(specPath, '.json');
  const dir = path.dirname(specPath);
  const provenancePath = path.join(dir, `${baseName}.provenance.json`);

  if (!fs.existsSync(provenancePath)) {
    errors.push(`missing provenance: ${provenancePath}`);
    return errors;
  }

  const buf = fs.readFileSync(specPath);
  const actualSha = sha256(buf);
  let provenance;
  try {
    provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  } catch (e) {
    errors.push(`provenance is not valid JSON: ${provenancePath} — ${e.message}`);
    return errors;
  }

  if (provenance.sha256 !== actualSha) {
    errors.push(
      `sha256 mismatch for ${specPath}\n  provenance: ${provenance.sha256}\n  actual:     ${actualSha}\n` +
      `If you intentionally updated the spec, update provenance.sha256 to match.`
    );
  }

  let spec;
  try {
    spec = JSON.parse(buf.toString('utf8'));
  } catch (e) {
    errors.push(`spec is not valid JSON: ${specPath} — ${e.message}`);
    return errors;
  }

  if (!spec.paths || typeof spec.paths !== 'object') {
    errors.push(`spec missing 'paths' object: ${specPath}`);
  }

  const hasDefinitions = spec.definitions && typeof spec.definitions === 'object';
  const hasComponents = spec.components && spec.components.schemas;
  if (!hasDefinitions && !hasComponents) {
    errors.push(`spec has neither 'definitions' (swagger 2.0) nor 'components.schemas' (openapi 3.x): ${specPath}`);
  }

  return errors;
}

function main() {
  const specsDir = __dirname;
  const specFiles = fs
    .readdirSync(specsDir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.provenance.json'))
    .map((f) => path.join(specsDir, f));

  if (specFiles.length === 0) {
    console.log('[validate] no specs found in', specsDir);
    process.exit(0);
  }

  let hadError = false;
  for (const spec of specFiles) {
    const errors = checkSpec(spec);
    if (errors.length === 0) {
      console.log(`[validate] OK  ${path.basename(spec)}`);
    } else {
      hadError = true;
      console.error(`[validate] FAIL ${path.basename(spec)}`);
      for (const e of errors) console.error(`  - ${e}`);
    }
  }

  process.exit(hadError ? 1 : 0);
}

main();
