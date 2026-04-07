/**
 * Dual-Model Engine — Entry Point
 *
 * Shared module for running Claude + GPT in parallel and comparing responses.
 * Used by both the web app (app/lib/wizard.js) and CLI (tools/multi-model-review.js).
 */

const { compare, extractWizardState, textSimilarity, detectRefusal, diffWizardStates } = require('./compare');
const { getConfig, isEnabled, setConfig, resetConfig, DEFAULTS } = require('./config');

module.exports = {
  // Comparison
  compare,
  extractWizardState,
  textSimilarity,
  detectRefusal,
  diffWizardStates,

  // Configuration
  getConfig,
  isEnabled,
  setConfig,
  resetConfig,
  DEFAULTS,
};
