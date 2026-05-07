/**
 * om-cli adapter
 *
 * Detects drift between the bundled `tools/om-cli/` binary and the upstream
 * ObjectModel source on msazure.visualstudio.com. Read-only — never clones,
 * pulls, builds, or stages files. The user takes the change and runs
 * `tools/update-om-cli.ps1` manually if they accept it.
 *
 * Fingerprint shape:
 *   primary:   sha256 of tools/om-cli/om-cli.dll (or 'missing')
 *   secondary: stamped source SHA from tools/om-cli/.source-hash (or 'unknown')
 *   version:   schema-count rollup ("N schemas")
 *   timestamp: ISO mtime of the binary
 *
 * Upstream comparison: the upstream ObjectModel is on Azure DevOps, not GitHub,
 * so `gh api` does not work. We only fingerprint the local binary + its stamped
 * source SHA. If a developer ran update-om-cli.ps1 since the last sync run,
 * the .source-hash will have changed and we surface it as a TAKE card with a
 * "review the new binary, commit if accepted" action plan.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../lib/ids');

const REL_BIN = 'tools/om-cli/om-cli.dll';
const REL_HASH = 'tools/om-cli/.source-hash';
const REL_SCHEMAS = 'tools/om-cli/schemas';

function sha256File(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return sha256(fs.readFileSync(absPath));
}

function readSourceHash(absHashPath) {
  if (!fs.existsSync(absHashPath)) return null;
  return fs.readFileSync(absHashPath, 'utf8').trim() || null;
}

function countSchemas(absSchemasDir) {
  if (!fs.existsSync(absSchemasDir)) return 0;
  return fs.readdirSync(absSchemasDir).filter(n => n.endsWith('.json')).length;
}

async function detect({ source, root }) {
  const binPath = path.join(root, REL_BIN);
  const hashPath = path.join(root, REL_HASH);
  const schemasDir = path.join(root, REL_SCHEMAS);

  if (!fs.existsSync(binPath)) {
    return { error: `om-cli binary missing at ${REL_BIN}` };
  }

  const binHash = sha256File(binPath);
  const sourceSha = readSourceHash(hashPath);
  const schemaCount = countSchemas(schemasDir);
  const mtime = fs.statSync(binPath).mtimeMs;

  return {
    fingerprint: {
      primary: binHash || 'missing',
      secondary: sourceSha || 'unknown',
      version: `${schemaCount} schemas`,
      timestamp: new Date(mtime).toISOString(),
    },
    meta: {
      binSha8: binHash ? binHash.slice(0, 8) : null,
      sourceSha8: sourceSha ? sourceSha.slice(0, 8) : null,
      schemaCount,
    },
  };
}

async function understand({ source, before, after, root }) {
  const prevBin = before?.fingerprint?.primary;
  const currBin = after?.fingerprint?.primary;
  const prevSrc = before?.fingerprint?.secondary;
  const currSrc = after?.fingerprint?.secondary;

  const binChanged = prevBin && prevBin !== currBin;
  const sourceChanged = prevSrc && prevSrc !== currSrc;

  const signals = [];
  const evidence = [];
  let severity = 'low';
  let breakingRisk = 'low';
  let recommendation = 'REJECT';
  const planSteps = [];

  if (sourceChanged) {
    severity = 'medium';
    breakingRisk = 'medium';
    signals.push(`source SHA advanced: ${String(prevSrc).slice(0, 8)} -> ${String(currSrc).slice(0, 8)}`);
    evidence.push({ type: 'source_sha', excerpt: `prev=${String(prevSrc).slice(0, 8)} curr=${String(currSrc).slice(0, 8)}` });
    recommendation = 'TAKE';
    planSteps.push('Verify the rebuilt om-cli binaries by running a smoke test (e.g. `node tools/mcs-lsp.js pull` against a known agent).');
    planSteps.push('Inspect tools/om-cli/schemas/ for new or renamed schema files.');
    planSteps.push('Commit the new tools/om-cli/* artifacts manually (sync never stages or commits binary updates).');
  }

  if (binChanged && !sourceChanged) {
    signals.push('binary hash drifted with no source SHA bump — the binary was edited or replaced outside update-om-cli.ps1');
    severity = 'medium';
    breakingRisk = 'medium';
    recommendation = 'TAKE';
    planSteps.push('Decide whether the binary edit was intentional. Re-run `tools/update-om-cli.ps1` to restore from source if not.');
  }

  if (!binChanged && !sourceChanged) {
    signals.push('om-cli binary and source stamp unchanged');
    return {
      severity: 'none',
      confidence: 1,
      classification: { kind: 'binary', breakingRisk: 'none', novelty: 'none' },
      recommendation: 'REJECT',
      actionPlan: 'No drift — no action.',
      evidence: [],
      headline: 'om-cli: no change',
      why: signals,
    };
  }

  // Probe upstream (best-effort). ObjectModel is on ADO so `gh api` cannot help;
  // the action plan tells the user to run update-om-cli.ps1 to learn upstream state.
  planSteps.push('Run `tools/update-om-cli.ps1 -SkipStage` to pull the latest ObjectModel and rebuild without staging.');
  planSteps.push('Re-run sync afterward so the snapshot picks up the rebuilt fingerprint.');

  return {
    severity,
    confidence: 0.85,
    classification: {
      kind: 'binary',
      subkind: sourceChanged ? 'source_advanced' : 'unexpected_binary_drift',
      breakingRisk,
      novelty: 'incremental',
    },
    recommendation,
    actionPlan: planSteps.join('\n'),
    evidence,
    headline: sourceChanged
      ? `om-cli source SHA advanced (${String(currSrc).slice(0, 8)})`
      : 'om-cli binary drift (no source-hash change)',
    why: signals,
  };
}

module.exports = { detect, understand };
