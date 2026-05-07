/**
 * Agent Snapshots — Built-in Snapshots
 *
 * Built-in snapshots are stored as individual JSON files in src/data/snapshots/.
 * Each file is one snapshot. To add a new built-in snapshot:
 *   1. Configure an agent in the UI
 *   2. Click "Download snapshot" on the Snapshots page
 *   3. Upload the downloaded .json file to src/data/snapshots/ in the GitHub repo
 *
 * The optional "notes" field (author annotations) is a first-class field on
 * AgentSnapshot — it is loaded as-is and shown in the snapshot detail view.
 * Date strings in message timestamps and evaluation runDates are revived to
 * Date objects automatically.
 */

import { AgentSnapshot, Message, Evaluation } from '../types';

// ─── Lifecycle stage sort order ──────────────────────────────────────────────

const STAGE_ORDER: Record<string, number> = {
  'day-zero': 0,
  'in-progress': 1,
  'published': 2,
  'bad-agent': 3,
  'custom': 4,
};

// ─── Date revival helpers ─────────────────────────────────────────────────────

function reviveMessages(messages: any[]): Message[] {
  return messages.map((m) => ({
    ...m,
    timestamp: m.timestamp ? new Date(m.timestamp) : m.timestamp,
  }));
}

function reviveEvaluations(evaluations: any[]): Evaluation[] {
  return evaluations.map((e) => ({
    ...e,
    runDate: e.runDate ? new Date(e.runDate) : e.runDate,
  }));
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidSnapshot(obj: unknown): obj is AgentSnapshot {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).name === 'string' &&
    typeof (obj as any).lifecycleStage === 'string'
  );
}

// ─── Loader ───────────────────────────────────────────────────────────────────

// Vite uses import.meta.glob instead of Webpack's require.context
const snapshotModules = import.meta.glob('./snapshots/*.json', { eager: true });

function loadSnapshots(): AgentSnapshot[] {
  const snapshots: AgentSnapshot[] = [];

  for (const [key, module] of Object.entries(snapshotModules)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (module as any).default ?? module;

      if (!isValidSnapshot(raw)) {
        console.warn(`[agentSnapshots] Skipping invalid snapshot file: ${key}`);
        continue;
      }

      const snapshot: AgentSnapshot = {
        ...raw,
        helperMessages: raw.helperMessages ? reviveMessages(raw.helperMessages) : undefined,
        previewMessages: raw.previewMessages ? reviveMessages(raw.previewMessages) : undefined,
        evaluations: raw.evaluations ? reviveEvaluations(raw.evaluations) : undefined,
      };

      snapshots.push(snapshot);
    } catch (err) {
      console.warn(`[agentSnapshots] Failed to load snapshot file: ${key}`, err);
    }
  }

  return snapshots.sort((a, b) => {
    const stageDiff = (STAGE_ORDER[a.lifecycleStage] ?? 99) - (STAGE_ORDER[b.lifecycleStage] ?? 99);
    return stageDiff !== 0 ? stageDiff : a.name.localeCompare(b.name);
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const BUILT_IN_SNAPSHOTS: AgentSnapshot[] = loadSnapshots();

export function getBuiltInSnapshots(): AgentSnapshot[] {
  return BUILT_IN_SNAPSHOTS;
}

export function findSnapshotById(id: string): AgentSnapshot | undefined {
  return BUILT_IN_SNAPSHOTS.find((s) => s.id === id);
}
