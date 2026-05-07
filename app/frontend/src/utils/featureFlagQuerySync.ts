/**
 * Feature Flag Query String Support
 *
 * Enables feature flags to be set via URL query params for sharing and deep-linking.
 * Works with HashRouter (params embedded in the hash fragment: /#/path?flag=1).
 *
 * Priority order: URL query param > localStorage > defaultValue
 *
 * Accepted truthy values: '1', 'true', '' (bare param, e.g. ?isEvalMode), or any other
 *   non-falsy string (e.g. '2' for numeric flags like workflowVersion)
 * Accepted falsy values:  '0', 'false'
 *
 * Example URLs:
 *   /#/build?isEvalMode=1&isEvalsV2=1     → enables two flags for the session
 *   /#/?isAiAutocomplete=0               → disables a default-true flag
 *   /#/?workflowVersion=2               → sets numeric flag to v2
 */

/** Parse query params from a HashRouter URL or standard location.search. */
function parseQueryParams(): URLSearchParams {
  // HashRouter puts params inside window.location.hash: /#/path?param=value
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex >= 0) return new URLSearchParams(hash.slice(qIndex + 1));
  // Fallback for non-hash deployments
  return new URLSearchParams(window.location.search);
}

// Parsed once at module import — before any React rendering or state initialization.
const _queryParams = parseQueryParams();

/**
 * Set of localStorage keys provided via URL query params with a non-falsy value.
 * '0' and 'false' are excluded — those are explicit disables, not activations.
 * Used to render "via URL" indicators in the flags panel.
 */
export const urlActivatedFlags: ReadonlySet<string> = new Set(
  Array.from(_queryParams.keys()).filter(k => {
    const v = _queryParams.get(k);
    return v !== '0' && v !== 'false';
  })
);

/**
 * Read a single raw query param value. Returns null if the key is absent.
 * Useful for non-boolean flags (e.g. numeric workflowVersion).
 */
export function getQueryParam(key: string): string | null {
  return _queryParams.get(key);
}

/**
 * Dev-mode flag defaults. In development (import.meta.env.DEV), flags not
 * explicitly set in localStorage default to these values instead of false.
 * Prevents the app from "reverting" to minimal state on localStorage clear.
 *
 * Production builds always use the caller's defaultValue (usually false).
 * URL query params and localStorage still override these (priority unchanged).
 *
 * Only feature flags that represent shipped/working functionality belong here.
 * Debug-only flags (isAgentErrorSimulation, showPersonalAgentOption) stay false.
 */
const DEV_FLAG_DEFAULTS: Record<string, boolean> = {
  // Homepage / creation
  isInterviewMode: true,
  isPlanMode: true,
  isProjectMode: true,
  isShareCoauthoring: true,

  // Evaluation
  isEvalMode: true,
  isEvalsV2: true,
  showEvalResults: true,
  // Features / capabilities
  isSkillsEnabled: true,
  isWorkIQEnabled: true,
  isToolsDA: true,
  isToolsCA: true,
  isTriggersEnabled: true,
  isDistributeEnabled: true,
  isMonitorV2: true,
  isFlowCaptureEnabled: true,
  isAgentGlobalUndo: true,
  // UI/UX
  showConversationalLayoutFeature: true,
  // isL1NavJuneProposal deliberately omitted — it renames nav labels (Home→Create, My Projects→Agents)
  isInsertComponents: true,
  isComponentDrawer: true,
  isAgentTypeBadge: true,
  isStepTypeVisuals: true,
  isWorkflowTestingV2: true,
  isVersionHistory: true,
  // Helper Agent / Build
  isHAReviewUIEnabled: true,
  isCreateFlowChecklist: true,
};

/**
 * Initialize a boolean feature flag.
 * Priority: URL query param > localStorage > dev-mode default > defaultValue
 *
 * @param key          - The localStorage key, also used as the URL query param name.
 * @param defaultValue - Fallback when neither URL nor localStorage has a value (default: false).
 */
export function initFlag(key: string, defaultValue = false): boolean {
  const qv = _queryParams.get(key);
  if (qv !== null) {
    if (qv === '' || qv === '1' || qv === 'true') return true;
    if (qv === '0' || qv === 'false') return false;
    // Unrecognized value — fall through to localStorage/default
  }
  const stored = localStorage.getItem(key);
  if (stored !== null) return stored === 'true';
  // Dev mode: use richer defaults so features don't vanish on storage clear
  if (import.meta.env.DEV && key in DEV_FLAG_DEFAULTS) {
    return DEV_FLAG_DEFAULTS[key];
  }
  return defaultValue;
}

/** Entry for buildFlagsUrl — key is required, value defaults to '1'. */
export interface FlagUrlEntry {
  key: string;
  /** URL param value. Defaults to '1'. Use for non-boolean flags (e.g. '2' for workflowVersion). */
  value?: string;
}

/**
 * Build a shareable URL containing the given flag entries as query params.
 * Compatible with HashRouter: appends params to the hash path.
 *
 * @param activeFlags - Flags to embed. Each entry uses `value` if provided, otherwise '1'.
 */
export function buildFlagsUrl(activeFlags: FlagUrlEntry[]): string {
  const hashPath = window.location.hash.split('?')[0] || '#/';
  if (activeFlags.length === 0) {
    return `${window.location.origin}${window.location.pathname}${hashPath}`;
  }
  const params = new URLSearchParams(activeFlags.map(f => [f.key, f.value ?? '1']));
  return `${window.location.origin}${window.location.pathname}${hashPath}?${params.toString()}`;
}

// Guard so stripping only happens once per page load regardless of how many times
// stripFlagParamsFromUrl is called (e.g. if NavigationRail re-mounts).
let _paramsStripped = false;

/**
 * Remove the given flag keys from the URL without triggering a page reload.
 * Call once after flag state has been initialized to prevent URL params from
 * re-applying on subsequent refreshes while the URL stays in the address bar.
 *
 * Uses history.replaceState — does not fire hashchange, so React Router is unaffected.
 * Non-flag query params (e.g. ?autotest=1) are preserved.
 */
export function stripFlagParamsFromUrl(flagKeys: string[]): void {
  if (_paramsStripped) return;
  _paramsStripped = true;

  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex < 0) return; // Nothing to strip

  const params = new URLSearchParams(hash.slice(qIndex + 1));
  let modified = false;
  for (const key of flagKeys) {
    if (params.has(key)) {
      params.delete(key);
      modified = true;
    }
  }
  if (!modified) return;

  const hashPath = hash.slice(0, qIndex);
  const remaining = params.toString();
  const newHash = remaining ? `${hashPath}?${remaining}` : hashPath;
  window.history.replaceState(null, '', window.location.pathname + newHash);
}
