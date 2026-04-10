/**
 * Helper Chat Store — Zustand state for the context-loaded helper chatbot.
 *
 * Manages helper lifecycle: idle → loading → ready → streaming → ready.
 * Pre-loads project context, then streams answers via SSE.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  initHelper,
  sendHelperMessage,
  subscribeHelperStream,
  closeHelper,
  type HelperEvent,
} from "@/lib/api";
import { rafBatch } from "@/lib/rafBatcher";

export type HelperPhase = "idle" | "loading" | "ready" | "streaming" | "error";

export interface HelperMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  ttft?: number;
  totalMs?: number;
  model?: string;
  cost?: number;
  timestamp: number;
}

interface HelperStore {
  phase: HelperPhase;
  sessionId: string | null;
  projectId: string | null;
  messages: HelperMessage[];
  contextTokens: number | null;
  model: string;
  error: string | null;
  _unsubscribe: (() => void) | null;

  init: (projectId: string, agentName?: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  close: () => Promise<void>;
  reset: () => void;
}

export const useHelperStore = create<HelperStore>()(devtools((set, get) => ({
  phase: "idle",
  sessionId: null,
  projectId: null,
  messages: [],
  contextTokens: null,
  model: "gpt-5.4",
  error: null,
  _unsubscribe: null,

  async init(projectId: string, agentName?: string) {
    const { sessionId: existing, _unsubscribe } = get();
    // Clean up any existing session
    if (existing) {
      if (_unsubscribe) _unsubscribe();
      closeHelper(existing).catch(() => {});
    }

    set({ phase: "loading", projectId, messages: [], error: null, sessionId: null, contextTokens: null });

    try {
      const result = await initHelper(projectId, { agentName });
      set({ sessionId: result.sessionId, contextTokens: result.contextTokens });

      // Subscribe to SSE
      const deltaBatcher = rafBatch<HelperStore>(set);

      const unsub = subscribeHelperStream(
        result.sessionId,
        (event: HelperEvent) => {
          const state = get();
          switch (event.type) {
            case "message_start": {
              const e = event as HelperEvent & { id: string };
              set({
                phase: "streaming",
                messages: [...state.messages, {
                  id: e.id,
                  role: "assistant",
                  content: "",
                  isStreaming: true,
                  timestamp: Date.now(),
                }]
              });
              break;
            }
            case "message_delta": {
              const e = event as HelperEvent & { id: string; text: string };
              deltaBatcher((s) => ({
                messages: s.messages.map(m =>
                  m.id === e.id ? { ...m, content: m.content + e.text } : m
                )
              }));
              break;
            }
            case "message_ttft": {
              const e = event as HelperEvent & { id: string; ttft: number };
              set({
                messages: state.messages.map(m =>
                  m.id === e.id ? { ...m, ttft: e.ttft } : m
                )
              });
              break;
            }
            case "message_complete": {
              const e = event as HelperEvent & { id: string; text: string; model: string; cost: number; totalMs: number };
              set({
                phase: "ready",
                messages: state.messages.map(m =>
                  m.id === e.id ? { ...m, content: e.text, isStreaming: false, model: e.model, cost: e.cost, totalMs: e.totalMs } : m
                )
              });
              break;
            }
            case "message_error": {
              const e = event as HelperEvent & { id: string; error: string };
              set({
                phase: "ready",
                messages: state.messages.map(m =>
                  m.id === e.id ? { ...m, isStreaming: false, content: m.content || `Error: ${e.error}` } : m
                )
              });
              break;
            }
            case "message_cancelled":
              set({
                phase: "ready",
                messages: state.messages.map(m =>
                  m.isStreaming ? { ...m, isStreaming: false } : m
                )
              });
              break;
            case "ready":
              set({ phase: "ready" });
              break;
          }
        },
        (err: Error) => {
          console.error("[helper] SSE error:", err);
          set({ error: "Helper connection lost" });
        }
      );

      set({ _unsubscribe: unsub, phase: "ready" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initialize helper";
      set({ phase: "error", error: message });
    }
  },

  async sendMessage(text: string) {
    const { sessionId, phase } = get();
    if (!sessionId || (phase !== "ready" && phase !== "streaming")) return;

    // Add user message immediately
    const userMsg: HelperMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      isStreaming: false,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));

    try {
      await sendHelperMessage(sessionId, text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      set({ error: message });
    }
  },

  async close() {
    const { sessionId, _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    if (sessionId) {
      try { await closeHelper(sessionId); } catch { /* ignore */ }
    }
    set({
      phase: "idle",
      sessionId: null,
      projectId: null,
      messages: [],
      contextTokens: null,
      error: null,
      _unsubscribe: null,
    });
  },

  reset() {
    const { _unsubscribe, sessionId } = get();
    if (_unsubscribe) _unsubscribe();
    if (sessionId) closeHelper(sessionId).catch(() => {});
    set({
      phase: "idle",
      sessionId: null,
      projectId: null,
      messages: [],
      contextTokens: null,
      error: null,
      _unsubscribe: null,
    });
  },
}), { name: "HelperStore" }));
