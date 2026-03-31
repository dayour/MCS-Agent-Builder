/**
 * Terminal session store — manages the right-side console/meeting panel.
 *
 * Sessions are per-project (one tab per project).
 * Research/Build/Evaluate buttons send commands to the project's existing session.
 * Default hidden — opened via header "Console" button or pipeline actions.
 */
import { create } from "zustand";
import type { TerminalSession } from "@/types";
import { getTerminalWsUrl } from "@/lib/api";

export type { TerminalSession } from "@/types";

// Registry of live WebSocket refs — XTerminal registers on connect, unregisters on unmount.
const wsRegistry = new Map<string, WebSocket>();
// Pending commands — queued when sendCommand is called before the WS is open.
const pendingCommands = new Map<string, string>();
// Pending writes — queued when writeCommand is called before the WS is open.
const pendingWrites = new Map<string, string>();

export function registerSessionWs(sessionId: string, ws: WebSocket) {
  wsRegistry.set(sessionId, ws);
  // Flush any command that was queued before the WS opened
  const queued = pendingCommands.get(sessionId);
  if (queued && ws.readyState === WebSocket.OPEN) {
    pendingCommands.delete(sessionId);
    ws.send(JSON.stringify({ type: "command", text: queued }));
  }
  // Flush any write (pre-fill, no Enter) that was queued before the WS opened
  const queuedWrite = pendingWrites.get(sessionId);
  if (queuedWrite && ws.readyState === WebSocket.OPEN) {
    pendingWrites.delete(sessionId);
    ws.send(JSON.stringify({ type: "write", text: queuedWrite }));
  }
}

export function unregisterSessionWs(sessionId: string) {
  wsRegistry.delete(sessionId);
  pendingCommands.delete(sessionId);
  pendingWrites.delete(sessionId);
}


function createDefaultSession(): TerminalSession {
  // wsUrl will be resolved asynchronously before first use
  const port = parseInt(window.location.port || "8000", 10);
  return {
    id: "main-" + crypto.randomUUID(),
    label: "Terminal",
    type: "system" as const,
    projectId: "system",
    agentName: "Terminal",
    status: "connecting" as const,
    wsUrl: `ws://localhost:${port}/ws`,
  };
}

export type PanelTab = "console" | "meeting";

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  panelOpen: boolean;
  /** Which tab is active in the right panel */
  activeTab: PanelTab;
  /** Width of the right panel in pixels. */
  panelWidth: number;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  /** Find existing session for a project. Returns session ID or null. */
  findSession: (projectId: string) => string | null;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  setPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  setActiveTab: (tab: PanelTab) => void;
  openOrCreate: () => void;
  /** Send a command to an existing session's WebSocket. */
  sendCommand: (sessionId: string, command: string) => void;
  /** Write text into the terminal prompt without pressing Enter (pre-fill). */
  writeCommand: (sessionId: string, text: string) => void;
}

const defaultSession = createDefaultSession();

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [defaultSession],
  activeSessionId: defaultSession.id,
  panelOpen: false,
  activeTab: "console" as PanelTab,
  panelWidth: 480,

  addSession: (session) => {
    // If the session carries an initial command, queue it in pendingCommands
    // so it's flushed via registerSessionWs after the WS connects.
    // This unifies new-session and existing-session command delivery.
    if (session.command) {
      pendingCommands.set(session.id, session.command);
    }
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
      panelOpen: true,
    }));
  },

  findSession: (projectId) => {
    const existing = get().sessions.find(
      (s) => s.projectId === projectId && s.type !== "system"
    );
    return existing?.id ?? null;
  },

  removeSession: (id) => {
    unregisterSessionWs(id);
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

  setPanelWidth: (width) => set({ panelWidth: Math.max(320, Math.min(Math.floor(window.innerWidth * 0.6), width)) }),

  setActiveTab: (tab) => set({ activeTab: tab, panelOpen: true }),

  openOrCreate: () => {
    const { sessions } = get();
    if (sessions.length === 0) {
      const session = createDefaultSession();
      // Resolve actual terminal URL asynchronously and patch the session
      getTerminalWsUrl().then((url) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === session.id ? { ...sess, wsUrl: url } : sess
          ),
        }));
      }).catch(() => {
        // URL resolution failed — default URL will be used, xterm will show connection error
      });
      set({ sessions: [session], activeSessionId: session.id, panelOpen: true });
    } else {
      set({ panelOpen: true });
    }
  },

  sendCommand: (sessionId, command) => {
    const ws = wsRegistry.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "command", text: command }));
    } else {
      // WS not open yet — queue so it's sent when registerSessionWs fires
      pendingCommands.set(sessionId, command);
    }
  },

  writeCommand: (sessionId, text) => {
    const ws = wsRegistry.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "write", text }));
    } else {
      pendingWrites.set(sessionId, text);
    }
  },
}));
