import { useEffect, useState } from 'react';

/**
 * useModelCatalog
 *
 * Fetches the live model catalog from the backend so dropdowns can render
 * whatever the server resolved (e.g. gpt-5.5 today, gpt-5.6 tomorrow) without
 * hardcoded labels. The backend single source of truth lives in
 * tools/lib/openai.js (KNOWN_LATEST_GPT + discovery) and tools/lib/anthropic.js
 * (forward-probe).
 *
 * Failure mode: if /api/models is unreachable, returns the supplied fallback
 * so dropdowns still render something sensible. The fallback's `id` is also
 * what gets sent to the backend, which routes any gpt-* string to openai.js
 * regardless of the specific version.
 */

export interface ModelCatalogEntry {
  /** Family sentinel ('gpt') or concrete id ('gpt-5.5'). Sent verbatim to backend. */
  id: string;
  /** Display label, e.g. 'GPT-5.5'. Reflects the latest resolved id. */
  label: string;
  /** Whether the backend can reach this provider right now. */
  available: boolean;
}

export interface ModelCatalog {
  gpt: ModelCatalogEntry;
  loaded: boolean;
}

const FALLBACK: ModelCatalog = {
  // Floor — should match KNOWN_LATEST_GPT in tools/lib/openai.js. Backend
  // discovery overrides this whenever a newer family is offered.
  gpt: { id: 'gpt-5.5', label: 'GPT-5.5', available: true },
  loaded: false,
};

let _cachedCatalog: ModelCatalog | null = null;
let _inFlight: Promise<ModelCatalog> | null = null;

async function fetchCatalog(): Promise<ModelCatalog> {
  if (_cachedCatalog) return _cachedCatalog;
  if (_inFlight) return _inFlight;
  _inFlight = (async () => {
    try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error(`/api/models returned ${res.status}`);
      const data = await res.json();
      const gptEntry = (data.models || []).find((m: any) => typeof m.id === 'string' && m.id.startsWith('gpt'));
      if (gptEntry) {
        const next: ModelCatalog = {
          gpt: {
            id: gptEntry.id,
            label: gptEntry.name || gptEntry.id,
            available: !!gptEntry.available,
          },
          loaded: true,
        };
        _cachedCatalog = next;
        return next;
      }
    } catch {
      // fall through to fallback
    }
    return { ...FALLBACK, loaded: true };
  })();
  try {
    return await _inFlight;
  } finally {
    _inFlight = null;
  }
}

/**
 * Hook — returns the live catalog. Refetches on first mount per session;
 * cached after that so multiple components share one network call.
 */
export function useModelCatalog(): ModelCatalog {
  const [catalog, setCatalog] = useState<ModelCatalog>(_cachedCatalog || FALLBACK);
  useEffect(() => {
    let cancelled = false;
    fetchCatalog().then(c => {
      if (!cancelled) setCatalog(c);
    });
    return () => { cancelled = true; };
  }, []);
  return catalog;
}

/**
 * Reset the catalog cache. Test/debug helper; does not currently fire.
 */
export function resetModelCatalogCache() {
  _cachedCatalog = null;
}

/**
 * Returns true for any GPT model identifier — accepts the family sentinel
 * 'gpt' and concrete ids like 'gpt-5.5'. Use this when matching saved
 * agentConfig.model values against the catalog entry, since older agents may
 * have a pinned id and newer ones use the sentinel.
 */
export function isGptModelId(model: string | undefined | null): boolean {
  return typeof model === 'string' && (model === 'gpt' || model.startsWith('gpt-'));
}
