/**
 * Save Service — storage adapter for agent data.
 *
 * All persistence goes through this module so the storage backend
 * (localStorage today, server API later) can be swapped in one place.
 */

import type { AgentConfig, Message } from '../types';

// ── Types ────────────────────────────────────────────────────────────────

export type SaveResult = { ok: true; savedAt: number } | { ok: false; error: string };

export interface SavePayload {
  agents: AgentConfig[];
  currentAgentId: string | null;
  helperMessages: Record<string, Message[]>;
  previewMessages: Record<string, Message[]>;
}

// ── localStorage adapter ─────────────────────────────────────────────────

export function saveToLocalStorage(payload: SavePayload): SaveResult {
  try {
    localStorage.setItem('agents', JSON.stringify(payload.agents));
    if (payload.currentAgentId) {
      localStorage.setItem('currentAgentId', payload.currentAgentId);
    }
    localStorage.setItem('agentHelperMessages', JSON.stringify(payload.helperMessages));
    localStorage.setItem('agentPreviewMessages', JSON.stringify(payload.previewMessages));
    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown save error';
    console.error('[saveService] localStorage save failed:', message);
    return { ok: false, error: message };
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

export function loadFromLocalStorage(): SavePayload {
  return {
    agents: safeParse<AgentConfig[]>(localStorage.getItem('agents'), []),
    currentAgentId: localStorage.getItem('currentAgentId'),
    helperMessages: safeParse<Record<string, Message[]>>(localStorage.getItem('agentHelperMessages'), {}),
    previewMessages: safeParse<Record<string, Message[]>>(localStorage.getItem('agentPreviewMessages'), {}),
  };
}
