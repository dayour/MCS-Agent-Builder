/**
 * Terminal session store — manages the right-side terminal panel.
 *
 * Sessions are per-agent (one tab per project+agent combo).
 * Research/Build/Evaluate buttons send commands to the agent's existing session.
 */
import { create } from "zustand";
import type { TerminalSession } from "@/types";

export type { TerminalSession } from "@/types";

// Registry of live WebSocket refs — XTerminal registers on connect, unregisters on unmount.
const wsRegistry = new Map<string, WebSocket>();

export function registerSessionWs(sessionId: string, ws: WebSocket) {
  wsRegistry.set(sessionId, ws);
}

export function unregisterSessionWs(sessionId: string) {
  wsRegistry.delete(sessionId);
}

export function getSessionWs(sessionId: string): WebSocket | undefined {
  return wsRegistry.get(sessionId);
}

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
  panelWidth: number;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  /** Find existing session for a project+agent. Returns session ID or null. */
  findSession: (projectId: string, agentId: string) => string | null;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  setPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  openOrCreate: () => void;
  /** Send a command to an existing session's WebSocket. */
  sendCommand: (sessionId: string, command: string) => void;
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

  findSession: (projectId, agentId) => {
    const key = `${projectId}-${agentId}`;
    const existing = get().sessions.find((s) => s.id.startsWith(key));
    return existing?.id ?? null;
  },

  removeSession: (id) => {
    wsRegistry.delete(id);
    set((s) => {
      const sessions = s.sessions.filter((sess) => sess.id !== id);
      const activeSessionId =
        s.activeSessionId === id
          ? sessions[sessions.length - 1]?.id ?? null
          : s.activeSessionId;
      return {
        sessions,
        activeSessionId,
        panelOpen: sessions.length > 0 ? s.panelOpen : false,
      };
    });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionStatus: (id, status) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, status } : sess
      ),
    })),

  setPanelOpen: (open) => {
    if (open) {
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
      set({ sessions: [session], activeSessionId: session.id, panelOpen: true });
    } else {
      set({ panelOpen: true });
    }
  },

  sendCommand: (sessionId, command) => {
    const ws = wsRegistry.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "command", text: command }));
    }
  },
}));
