/**
 * Dual-Model Configuration
 *
 * Feature flags and defaults for running Claude + GPT in parallel.
 * Reads from environment variables or programmatic overrides.
 */

const DEFAULTS = Object.freeze({
  enabled: false,
  primaryModel: 'opus',
  secondaryModel: 'gpt-5.4',
  mode: 'shadow',              // 'shadow' | 'comparison' | 'merge'
  secondaryTimeoutMs: 30000,   // max wait for secondary after primary completes
  compareMethod: 'heuristic',  // 'heuristic' | 'llm'
});

// Runtime override (set via setConfig or programmatic callers)
let _override = {};

/**
 * Get current dual-model configuration.
 * Priority: runtime override > env vars > defaults.
 * @returns {object}
 */
function getConfig() {
  const envEnabled = process.env.DUAL_MODEL_ENABLED;
  const envMode = process.env.DUAL_MODEL_MODE;
  const envTimeout = process.env.DUAL_MODEL_TIMEOUT_MS;
  const envCompare = process.env.DUAL_MODEL_COMPARE;

  return {
    ...DEFAULTS,
    // Env overrides
    ...(envEnabled !== undefined && { enabled: envEnabled === '1' || envEnabled === 'true' }),
    ...(envMode && { mode: envMode }),
    ...(envTimeout && { secondaryTimeoutMs: parseInt(envTimeout, 10) }),
    ...(envCompare && { compareMethod: envCompare }),
    // Runtime overrides (highest priority)
    ..._override,
  };
}

/**
 * Check if dual-model is enabled.
 * @returns {boolean}
 */
function isEnabled() {
  return getConfig().enabled;
}

/**
 * Set runtime configuration overrides (e.g., from settings store or API).
 * @param {object} overrides - Partial config to merge
 */
function setConfig(overrides) {
  _override = { ..._override, ...overrides };
}

/**
 * Reset runtime overrides back to defaults + env.
 */
function resetConfig() {
  _override = {};
}

module.exports = { getConfig, isEnabled, setConfig, resetConfig, DEFAULTS };
