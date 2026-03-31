/**
 * Meeting Co-Pilot Store — Zustand state for real-time meeting sessions.
 *
 * Manages meeting lifecycle: prepare → start → active → stop.
 * Subscribes to SSE stream for real-time transcript + answer suggestions.
 */
import { create } from "zustand";
import { rafBatch } from "@/lib/rafBatcher";
import {
  prepareMeeting,
  startMeeting,
  stopMeeting,
  subscribeMeetingStream,
  setMeetingModel,
  type MeetingTranscriptEntry,
  type MeetingEvent,
  type MeetingStats,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeetingPhase =
  | "idle"       // No meeting in progress
  | "preparing"  // Generating briefing
  | "ready"      // Briefing loaded, whisper ready
  | "starting"   // Connecting to audio capture
  | "active"     // Meeting in progress — live transcription + suggestions
  | "stopping"   // Wrapping up
  | "stopped"    // Meeting ended — showing summary
  | "error";     // Something went wrong

export interface ActiveAnswer {
  id: string;
  text: string;
  detection: { text: string; type: "question" | "requirement"; confidence: number };
  isStreaming: boolean;
  ttft?: number;
  totalMs?: number;
  model?: string;
  fallback?: string;
  cost?: number;
}

interface MeetingStore {
  // State
  phase: MeetingPhase;
  sessionId: string | null;
  projectId: string | null;
  transcript: MeetingTranscriptEntry[];
  suggestions: ActiveAnswer[];
  dismissedIds: Set<string>;
  answerModel: string;
  error: string | null;
  briefingTokens: number | null;
  stats: MeetingStats | null;

  // Project context (persists across navigation)
  openForProject: (projectId: string, agentName?: string) => void;

  // Actions
  prepare: (projectId: string, agentName?: string) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setModel: (model: string) => Promise<void>;
  dismissSuggestion: (id: string) => void;
  reset: () => void;

  // Internal
  _unsubscribe: (() => void) | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  // Initial state
  phase: "idle",
  sessionId: null,
  projectId: null,
  transcript: [],
  suggestions: [],
  dismissedIds: new Set(),
  answerModel: "gpt-5.4",
  error: null,
  briefingTokens: null,
  stats: null,
  _unsubscribe: null,

  openForProject: (projectId) => {
    const state = get();
    // Already running for this or another project — just set context
    if (state.phase !== "idle") return;
    // Idle — set project context
    set({ projectId });
  },

  prepare: async (projectId: string, agentName?: string) => {
    set({ phase: "preparing", projectId, error: null });
    try {
      const result = await prepareMeeting(projectId, {
        agentName,
        answerModel: get().answerModel,
      });
      set({
        sessionId: result.sessionId,
        briefingTokens: result.briefingTokens,
        phase: "ready",
      });
    } catch (err) {
      set({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  start: async () => {
    const { sessionId, _unsubscribe: existingUnsub } = get();
    if (!sessionId) return;

    // Clean up any existing subscription first
    if (existingUnsub) existingUnsub();

    set({ phase: "starting", _unsubscribe: null });
    try {
      await startMeeting(sessionId);

      // RAF batchers for high-frequency events (~60fps max)
      const transcriptBatcher = rafBatch<MeetingStore>(set);
      const deltaBatcher = rafBatch<MeetingStore>(set);

      // Accumulate transcript entries between frames
      let pendingTranscripts: MeetingTranscriptEntry[] = [];
      // Accumulate answer deltas keyed by answer id
      const pendingDeltas = new Map<string, string>();

      // Subscribe to SSE stream
      const unsub = subscribeMeetingStream(
        sessionId,
        (event: MeetingEvent) => {
          switch (event.type) {
            case "transcript": {
              const entry = event as unknown as MeetingTranscriptEntry & { type: string };
              pendingTranscripts.push({ speaker: entry.speaker, text: entry.text, timestamp: entry.timestamp, duration: entry.duration });
              const batch = pendingTranscripts;
              transcriptBatcher((s) => {
                const combined = [...s.transcript, ...batch];
                batch.length = 0;
                return { transcript: combined };
              });
              break;
            }
            case "answer_start": {
              deltaBatcher.flush(); // flush pending deltas before adding new answer
              const e = event as MeetingEvent & { id: string; detection: ActiveAnswer["detection"] };
              const newAnswer: ActiveAnswer = {
                id: e.id,
                text: "",
                detection: e.detection,
                isStreaming: true,
              };
              set((s) => ({ suggestions: [newAnswer, ...s.suggestions] }));
              break;
            }
            case "answer_delta": {
              const e = event as MeetingEvent & { id: string; text: string };
              pendingDeltas.set(e.id, (pendingDeltas.get(e.id) || "") + e.text);
              deltaBatcher((s) => {
                // Consume all accumulated deltas in one frame
                const consumed = new Map(pendingDeltas);
                pendingDeltas.clear();
                return {
                  suggestions: s.suggestions.map((a) => {
                    const delta = consumed.get(a.id);
                    return delta ? { ...a, text: a.text + delta } : a;
                  }),
                };
              });
              break;
            }
            case "answer_ttft": {
              const e = event as MeetingEvent & { id: string; ttft: number };
              set((s) => ({
                suggestions: s.suggestions.map((a) =>
                  a.id === e.id ? { ...a, ttft: e.ttft } : a
                ),
              }));
              break;
            }
            case "answer_complete": {
              deltaBatcher.flush(); // flush pending deltas before finalizing
              const e = event as MeetingEvent & { id: string; text: string; model: string; fallback?: string; cost: number; totalMs: number };
              set((s) => ({
                suggestions: s.suggestions.map((a) =>
                  a.id === e.id ? { ...a, text: e.text, isStreaming: false, model: e.model, fallback: e.fallback, cost: e.cost, totalMs: e.totalMs } : a
                ),
              }));
              break;
            }
            case "state_change": {
              const e = event as MeetingEvent & { to: string };
              if (e.to === "active") set({ phase: "active" });
              if (e.to === "stopped") set({ phase: "stopped" });
              break;
            }
            case "stopped": {
              transcriptBatcher.flush();
              deltaBatcher.flush();
              set({ phase: "stopped", stats: (event as MeetingEvent & { stats: MeetingStats }).stats });
              break;
            }
          }
        },
        (err) => {
          transcriptBatcher.cancel();
          deltaBatcher.cancel();
          console.error("[meeting] SSE error:", err);
          set({ error: "Meeting connection lost" });
        }
      );

      set({ phase: "active", _unsubscribe: unsub });
    } catch (err) {
      set({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  stop: async () => {
    const { sessionId, _unsubscribe } = get();
    if (!sessionId) return;

    // Unsubscribe SSE immediately — don't wait for server
    if (_unsubscribe) _unsubscribe();
    set({ phase: "stopping", _unsubscribe: null });

    try {
      const result = await stopMeeting(sessionId) as { stats?: MeetingStats };
      set({ phase: "stopped", stats: result?.stats ?? null });
    } catch (err) {
      // Even on error, move to stopped — don't leave in "stopping" forever
      set({
        phase: "stopped",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setModel: async (model: string) => {
    const { sessionId } = get();
    set({ answerModel: model });
    if (sessionId) {
      try {
        await setMeetingModel(sessionId, model);
      } catch { /* ignore — model will apply on next answer */ }
    }
  },

  dismissSuggestion: (id: string) => {
    const { dismissedIds } = get();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    set({ dismissedIds: newDismissed });
  },

  reset: () => {
    const { _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    set({
      phase: "idle",
      sessionId: null,
      projectId: null,
      transcript: [],
      suggestions: [],
      dismissedIds: new Set(),
      error: null,
      briefingTokens: null,
      stats: null,
      _unsubscribe: null,
    });
  },
}));
