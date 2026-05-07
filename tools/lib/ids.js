/**
 * ID Generation
 *
 * Replaces `Date.now()` ID patterns that collide under concurrent use.
 * Uses crypto.randomUUID() (available since Node 19+, stable in 20+).
 */

const crypto = require("crypto");

/**
 * Generate a unique ID safe for job IDs, cache keys, and index entries.
 * @returns {string} UUID v4 (e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Generate a short ID for display/logging (first 8 chars of UUID).
 * Not collision-resistant for large sets — use generateId() for storage keys.
 * @returns {string} Short ID (e.g. "a1b2c3d4")
 */
function shortId() {
  return crypto.randomUUID().split("-")[0];
}

/**
 * sha256 of a string. Hex digest. Canonical helper for fingerprints, content
 * hashes, and audit chains. Used by sync-adapters and audit logs — always
 * import from here instead of redefining locally.
 * @param {string} s
 * @returns {string} 64-char hex digest
 */
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

module.exports = { generateId, shortId, sha256 };
