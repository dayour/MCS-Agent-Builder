#!/usr/bin/env node
/**
 * Drift detector — fails CI/pre-push when the committed mgmt-types.ts is
 * out of sync with what `npm run regen:mgmt-types` would produce right now.
 *
 * Flow:
 *   1. Take SHA-256 of the current committed tools/generated/mgmt-types.ts
 *   2. Copy it aside as <file>.bak
 *   3. Run regen (regen:mgmt-types)
 *   4. Take SHA-256 of the newly-generated file
 *   5. Compare hashes — if different, restore backup and exit 1 with a diff stat
 *   6. If identical, delete backup and exit 0
 *
 * This catches two failure modes:
 *   a. Someone updated the spec but forgot `npm run regen:mgmt-types`
 *   b. Someone hand-edited the generated file
 *
 * Expected to run alongside `npm test` in CI before tests execute.
 *
 * Exit codes:
 *   0 — clean (generated file matches regen output byte-for-byte)
 *   1 — drift detected; file restored
 *   2 — tooling error (regen failed, fs error, etc.)
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_FILE = path.join(REPO_ROOT, 'tools', 'generated', 'mgmt-types.ts');

function sha256OfFile(p) {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
    if (!fs.existsSync(GENERATED_FILE)) {
        console.error(`[assert-regen-clean] FAIL: committed file missing at ${GENERATED_FILE}`);
        console.error('  Run: npm run regen:mgmt-types');
        process.exit(1);
    }

    const beforeSha = sha256OfFile(GENERATED_FILE);
    const backupFile = GENERATED_FILE + '.bak';
    fs.copyFileSync(GENERATED_FILE, backupFile);

    try {
        const result = spawnSync('npm run regen:mgmt-types', {
            cwd: REPO_ROOT,
            stdio: 'pipe',
            encoding: 'utf8',
            shell: true
        });

        if (result.status !== 0) {
            // Regen itself failed — restore and bail with tooling error.
            fs.copyFileSync(backupFile, GENERATED_FILE);
            fs.unlinkSync(backupFile);
            console.error('[assert-regen-clean] FAIL: regen command errored');
            console.error('  stdout:', result.stdout || '(empty)');
            console.error('  stderr:', result.stderr || '(empty)');
            process.exit(2);
        }

        const afterSha = sha256OfFile(GENERATED_FILE);

        if (beforeSha === afterSha) {
            fs.unlinkSync(backupFile);
            console.log('[assert-regen-clean] OK: generated file matches regen output');
            process.exit(0);
        }

        // Drift — restore backup and report.
        fs.copyFileSync(backupFile, GENERATED_FILE);
        fs.unlinkSync(backupFile);
        console.error('[assert-regen-clean] FAIL: generated file is out of sync with the vendored spec.');
        console.error(`  committed sha256: ${beforeSha}`);
        console.error(`  regen sha256:     ${afterSha}`);
        console.error('  Fix: run `npm run regen:mgmt-types` and commit the result.');
        process.exit(1);

    } catch (err) {
        // Unknown error — best-effort restore and bail.
        if (fs.existsSync(backupFile)) {
            try { fs.copyFileSync(backupFile, GENERATED_FILE); fs.unlinkSync(backupFile); } catch { /* noop */ }
        }
        console.error('[assert-regen-clean] FAIL: unexpected error', err);
        process.exit(2);
    }
}

main();
