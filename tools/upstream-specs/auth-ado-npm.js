#!/usr/bin/env node
/**
 * Refresh Azure DevOps npm feed credentials in the user-level .npmrc.
 *
 * Uses the `az` CLI to fetch a short-lived AAD access token for Azure DevOps
 * (resource 499b84ac-1321-427f-aa17-267ca6975798) and writes a scoped
 * _authToken entry in ~/.npmrc so npm can install packages from the
 * msazure/CCI-Dependency feed.
 *
 * AAD tokens expire in ~1 hour — re-run this script if npm install starts
 * failing with 401. Users who install once per day typically won't notice.
 *
 * Why not vendor vsts-npm-auth or ado-npm-auth? This uses only the az CLI
 * that we already require for Gateway/Dataverse calls, keeps no extra global
 * dependency, and is auditable in ~40 lines.
 *
 * Safety:
 *   - Writes only ~/.npmrc (user-level), never the repo-level .npmrc
 *   - Preserves existing lines that don't match the feed we're updating
 *   - Tokens live only in ~/.npmrc; the repo .npmrc is secret-free
 *
 * Run:
 *   npm run auth:ado-npm
 *
 * Exit codes:
 *   0 — ~/.npmrc updated, feed proven reachable
 *   1 — az CLI failed, probe failed, or fs error (details printed)
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const https = require('node:https');

const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const FEED_URL = 'https://pkgs.dev.azure.com/msazure/_packaging/CCI-Dependency/npm/registry/';
const FEED_REGISTRY_KEY = '//pkgs.dev.azure.com/msazure/_packaging/CCI-Dependency/npm/registry/';
const EXPECTED_TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47'; // Microsoft tenant
const NPMRC_PATH = path.join(os.homedir(), '.npmrc');

function getAzToken() {
    const cmd = `az account get-access-token --resource ${ADO_RESOURCE} --query accessToken -o tsv`;
    try {
        const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        if (!out || out.split('.').length !== 3) {
            throw new Error('az returned no JWT token — is az login current?');
        }
        return out;
    } catch (err) {
        throw new Error(`az failed: ${err.message}. Try: az login --tenant ${EXPECTED_TENANT}`);
    }
}

function checkTenant() {
    try {
        const tenant = execSync('az account show --query tenantId -o tsv', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
        if (tenant !== EXPECTED_TENANT) {
            console.error(
                `[auth-ado-npm] WARNING: active tenant is ${tenant}, expected Microsoft tenant ${EXPECTED_TENANT}.`
            );
            console.error(`  Run: az account set --subscription <sub-in-microsoft-tenant>`);
        }
    } catch {
        // Not fatal — getAzToken will fail with a clearer message if auth is broken.
    }
}

function probeFeed(token) {
    return new Promise((resolve, reject) => {
        const req = https.get(`${FEED_URL}microsoft-agents-objectmodel`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        }, (res) => {
            res.resume();
            if (res.statusCode === 200) resolve();
            else reject(new Error(`feed probe returned HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('feed probe timed out')); });
    });
}

function rewriteNpmrc(token) {
    const existing = fs.existsSync(NPMRC_PATH) ? fs.readFileSync(NPMRC_PATH, 'utf8') : '';
    const preserved = existing
        .split(/\r?\n/)
        .filter((line) => !line.startsWith(FEED_REGISTRY_KEY))
        .filter((line) => line.trim() !== '')
        .join('\n');

    // Only _authToken — npm 10+ deprecated per-registry always-auth.
    const managed = `${FEED_REGISTRY_KEY}:_authToken=${token}`;

    const next = (preserved ? preserved + '\n' : '') + managed + '\n';
    fs.writeFileSync(NPMRC_PATH, next, { mode: 0o600 });
}

async function main() {
    checkTenant();
    const token = getAzToken();
    await probeFeed(token);
    rewriteNpmrc(token);
    console.log(`[auth-ado-npm] OK: refreshed credentials for ${FEED_URL}`);
    console.log(`  ~/.npmrc updated (mode 0600). Token expires in ~1 hour; re-run this script to refresh.`);
}

main().catch((err) => {
    console.error('[auth-ado-npm] FAIL:', err.message);
    process.exit(1);
});
