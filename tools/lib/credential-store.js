/**
 * Cross-Platform OS-Native Credential Store
 *
 * Securely stores and retrieves tokens/secrets using the OS credential manager:
 *   - Windows: DPAPI via PowerShell (ConvertTo-SecureString / ConvertFrom-SecureString)
 *   - macOS: Keychain via `security` CLI
 *   - Linux: libsecret via `secret-tool` if available, else file with 0o600
 *
 * Based on patterns from microsoft/skills-for-copilot-studio credential-store.js.
 * Zero external dependencies — uses native Node.js child_process and fs.
 *
 * Usage:
 *   const store = require('./lib/credential-store');
 *   store.save('my-service', 'account1', tokenJson);
 *   const token = store.load('my-service', 'account1');
 *   store.remove('my-service', 'account1');
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VERBOSE = process.env.CRED_STORE_VERBOSE === '1';

// --- Input Sanitization ---

/**
 * Sanitize service/account names to prevent path traversal and injection.
 * Only allows alphanumeric, dot, hyphen, underscore.
 */
function sanitizeName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error('credential-store: service/account name must be a non-empty string');
    }
    return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

// --- Platform Detection ---

function getPlatform() {
    const p = os.platform();
    if (p === 'win32') return 'windows';
    if (p === 'darwin') return 'macos';
    return 'linux';
}

// --- Memoized secret-tool detection ---
let _secretToolAvailable = null;
function hasSecretTool() {
    if (_secretToolAvailable !== null) return _secretToolAvailable;
    try {
        execFileSync('which', ['secret-tool'], { stdio: ['pipe', 'pipe', 'pipe'] });
        _secretToolAvailable = true;
    } catch {
        _secretToolAvailable = false;
    }
    return _secretToolAvailable;
}

// --- Windows: DPAPI via PowerShell ---

function windowsSave(service, account, data) {
    const configDir = getConfigDir();
    const safeName = `${sanitizeName(service)}_${sanitizeName(account)}.dpapi`;
    const filePath = path.join(configDir, safeName);

    // B64-encode data so the PowerShell script never sees raw user content
    const b64 = Buffer.from(data, 'utf8').toString('base64');
    const psScript =
        `$plain = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')); ` +
        `$secure = ConvertTo-SecureString $plain -AsPlainText -Force; ` +
        `ConvertFrom-SecureString $secure`;

    try {
        const result = spawnSync('powershell',
            ['-NoProfile', '-NonInteractive', '-Command', psScript],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
        );

        if (result.status !== 0) throw new Error(result.stderr || 'DPAPI encrypt failed');
        const encrypted = (result.stdout || '').trim();
        if (!encrypted) throw new Error('DPAPI returned empty output');

        fs.writeFileSync(filePath, encrypted, { mode: 0o600 });
        if (VERBOSE) console.error(`[cred-store] Saved (DPAPI): ${filePath}`);
        return true;
    } catch (err) {
        if (VERBOSE) console.error(`[cred-store] DPAPI save failed: ${err.message}`);
        return fileSave(service, account, data);
    }
}

function windowsLoad(service, account) {
    const configDir = getConfigDir();
    const safeName = `${sanitizeName(service)}_${sanitizeName(account)}.dpapi`;
    const filePath = path.join(configDir, safeName);

    if (!fs.existsSync(filePath)) return null;

    try {
        const encrypted = fs.readFileSync(filePath, 'utf8').trim();
        // DPAPI encrypted strings are hex-encoded — validate before interpolating
        if (!/^[0-9a-fA-F]+$/.test(encrypted)) {
            throw new Error('DPAPI file contains unexpected characters');
        }

        const psScript =
            `$secure = ConvertTo-SecureString '${encrypted}'; ` +
            `$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); ` +
            `$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); ` +
            `[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); ` +
            `$plain`;

        const result = spawnSync('powershell',
            ['-NoProfile', '-NonInteractive', '-Command', psScript],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
        );

        if (result.status !== 0) throw new Error(result.stderr || 'DPAPI decrypt failed');
        const plain = (result.stdout || '').trim();

        if (VERBOSE) console.error(`[cred-store] Loaded (DPAPI): ${filePath}`);
        return plain;
    } catch (err) {
        if (VERBOSE) console.error(`[cred-store] DPAPI load failed: ${err.message}`);
        return fileLoad(service, account);
    }
}

function windowsRemove(service, account) {
    const configDir = getConfigDir();
    const safeName = `${sanitizeName(service)}_${sanitizeName(account)}.dpapi`;
    const filePath = path.join(configDir, safeName);
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        fileRemove(service, account);
        return true;
    } catch { return false; }
}

// --- macOS: Keychain (using execFileSync with arg arrays — no shell) ---

function macosSave(service, account, data) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    try {
        // Delete existing entry first (update = delete + add)
        try {
            execFileSync('security', ['delete-generic-password', '-s', svc, '-a', acct],
                { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch { /* entry may not exist */ }

        execFileSync('security', ['add-generic-password', '-s', svc, '-a', acct, '-w', data],
            { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });

        if (VERBOSE) console.error(`[cred-store] Saved (Keychain): ${svc}/${acct}`);
        return true;
    } catch (err) {
        if (VERBOSE) console.error(`[cred-store] Keychain save failed: ${err.message}`);
        return fileSave(service, account, data);
    }
}

function macosLoad(service, account) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    try {
        const result = execFileSync('security',
            ['find-generic-password', '-s', svc, '-a', acct, '-w'],
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
        ).trim();

        if (VERBOSE) console.error(`[cred-store] Loaded (Keychain): ${svc}/${acct}`);
        return result;
    } catch {
        return fileLoad(service, account);
    }
}

function macosRemove(service, account) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    try {
        execFileSync('security', ['delete-generic-password', '-s', svc, '-a', acct],
            { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch { /* entry may not exist */ }
    // Always clean up file-based fallback too
    fileRemove(service, account);
    return true;
}

// --- Linux: secret-tool (libsecret, using arg arrays + stdin) ---

function linuxSave(service, account, data) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    if (hasSecretTool()) {
        try {
            // Pass secret via stdin to avoid command-line exposure
            const result = spawnSync('secret-tool',
                ['store', `--label=${svc}`, 'service', svc, 'account', acct],
                { input: data, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
            );
            if (result.status === 0) {
                if (VERBOSE) console.error(`[cred-store] Saved (secret-tool): ${svc}/${acct}`);
                return true;
            }
        } catch (err) {
            if (VERBOSE) console.error(`[cred-store] secret-tool save failed: ${err.message}`);
        }
    }
    return fileSave(service, account, data);
}

function linuxLoad(service, account) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    if (hasSecretTool()) {
        try {
            const result = execFileSync('secret-tool',
                ['lookup', 'service', svc, 'account', acct],
                { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
            ).trim();
            if (result) {
                if (VERBOSE) console.error(`[cred-store] Loaded (secret-tool): ${svc}/${acct}`);
                return result;
            }
        } catch { /* not found */ }
    }
    return fileLoad(service, account);
}

function linuxRemove(service, account) {
    const svc = sanitizeName(service);
    const acct = sanitizeName(account);
    if (hasSecretTool()) {
        try {
            execFileSync('secret-tool', ['clear', 'service', svc, 'account', acct],
                { stdio: ['pipe', 'pipe', 'pipe'] });
            return true;
        } catch { /* not found */ }
    }
    return fileRemove(service, account);
}

// --- File-based fallback (all platforms) ---

function getConfigDir() {
    const dir = path.join(os.homedir(), '.mcs-automation');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return dir;
}

function fileSave(service, account, data) {
    try {
        const configDir = getConfigDir();
        const filePath = path.join(configDir, `${sanitizeName(service)}_${sanitizeName(account)}.json`);
        fs.writeFileSync(filePath, data, { mode: 0o600 });
        if (VERBOSE) console.error(`[cred-store] Saved (file): ${filePath}`);
        return true;
    } catch (err) {
        if (VERBOSE) console.error(`[cred-store] File save failed: ${err.message}`);
        return false;
    }
}

function fileLoad(service, account) {
    const configDir = getConfigDir();
    const filePath = path.join(configDir, `${sanitizeName(service)}_${sanitizeName(account)}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch { return null; }
}

function fileRemove(service, account) {
    const configDir = getConfigDir();
    const filePath = path.join(configDir, `${sanitizeName(service)}_${sanitizeName(account)}.json`);
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
    } catch { return false; }
}

// --- Public API ---

const platform = getPlatform();

/**
 * Save a credential to the OS credential store.
 *
 * @param {string} service - Service name (e.g., 'mcs-automation', 'copilot-studio-cli')
 * @param {string} account - Account identifier (e.g., 'dataverse-token', email)
 * @param {string} data - Data to store (token, JSON string, etc.)
 * @returns {boolean} Success
 */
function save(service, account, data) {
    switch (platform) {
        case 'windows': return windowsSave(service, account, data);
        case 'macos': return macosSave(service, account, data);
        case 'linux': return linuxSave(service, account, data);
        default: return fileSave(service, account, data);
    }
}

/**
 * Load a credential from the OS credential store.
 *
 * @param {string} service - Service name
 * @param {string} account - Account identifier
 * @returns {string|null} Stored data or null if not found
 */
function load(service, account) {
    switch (platform) {
        case 'windows': return windowsLoad(service, account);
        case 'macos': return macosLoad(service, account);
        case 'linux': return linuxLoad(service, account);
        default: return fileLoad(service, account);
    }
}

/**
 * Remove a credential from the OS credential store.
 *
 * @param {string} service - Service name
 * @param {string} account - Account identifier
 * @returns {boolean} Success
 */
function remove(service, account) {
    switch (platform) {
        case 'windows': return windowsRemove(service, account);
        case 'macos': return macosRemove(service, account);
        case 'linux': return linuxRemove(service, account);
        default: return fileRemove(service, account);
    }
}

/**
 * Get info about which credential store backend is in use.
 * @returns {{platform: string, backend: string, configDir: string}}
 */
function info() {
    let backend;
    switch (platform) {
        case 'windows': backend = 'DPAPI (Windows Data Protection)'; break;
        case 'macos': backend = 'macOS Keychain'; break;
        case 'linux': backend = hasSecretTool() ? 'libsecret (secret-tool)' : 'file (0o600)'; break;
        default: backend = 'file (0o600)';
    }
    return { platform, backend, configDir: getConfigDir() };
}

module.exports = { save, load, remove, info };
