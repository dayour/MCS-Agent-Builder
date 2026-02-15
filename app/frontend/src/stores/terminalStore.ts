/**
 * Terminal session store — manages the right-side terminal panel.
 *
 * Each session connects to a WebSocket backend for agent
 * research / build / evaluate workflows.
 */
import { create } from "zustand";
import type { TerminalSession } from "@/types";

// Re-export for convenience
export type { TerminalSession } from "@/types";

function createDefaultSession(): TerminalSession {
  return {
    id: "main-" + crypto.randomUUID(),
    label: "Terminal",
    type: "system" as const,
    projectId: "system",
    agentName: "Terminal",
    status: "connecting" as const,
    wsUrl: "ws://localhost:8001/ws",
  };
}

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  panelOpen: boolean;
  /** Panel width in px (clamped 300–900). */
  panelWidth: number;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  /** Activate an existing session for a project+agent combo. Returns true if found. */
  findOrActivateSession: (projectId: string, agentName: string) => boolean;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  setPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  /** Open panel, creating a default session if none exist. */
  openOrCreate: () => void;
}

const defaultSession = createDefaultSession();

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [defaultSession],
  activeSessionId: defaultSession.id,
  panelOpen: false,
  panelWidth: 500,

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
      panelOpen: true,
    })),

  findOrActivateSession: (projectId, agentName) => {
    const existing = get().sessions.find(
      (s) => s.projectId === projectId && s.agentName === agentName
    );
    if (existing) {
      set({ activeSessionId: existing.id, panelOpen: true });
      return true;
    }
    return false;
  },

  removeSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((sess) => sess.id !== id);
      const activeSessionId =
        s.activeSessionId === id
          ? sessions[sessions.length - 1]?.id ?? null
          : s.activeSessionId;
      return {
        sessions,
        activeSessionId,
        // Keep panel open even if empty — openOrCreate will handle re-creation
        panelOpen: sessions.length > 0 ? s.panelOpen : false,
      };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionStatus: (id, status) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, status } : sess
      ),
    })),

  setPanelOpen: (open) => {
    if (open) {
      // If opening but no sessions, create one
      get().openOrCreate();
    } else {
      set({ panelOpen: false });
    }
  },

  setPanelWidth: (width) => set({ panelWidth: Math.max(300, Math.min(900, width)) }),

  openOrCreate: () => {
    const { sessions } = get();
    if (sessions.length === 0) {
      const session = createDefaultSession();
      set({
        sessions: [session],
        activeSessionId: session.id,
        panelOpen: true,
      });
    } else {
      set({ panelOpen: true });
    }
  },
}));
