/**
 * Wizard Store — Zustand state for the conversational agent wizard.
 *
 * Manages chat messages, draft brief state, section progress,
 * and localStorage persistence for session recovery.
 */
import { create } from "zustand";
import {
  wizardChat,
  wizardSave,
  startEnrichment,
  createProject,
  uploadDocument,
  deleteDocument,
  type WizardChatEvent,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WizardSectionStatus = "not_started" | "in_progress" | "complete";
export type WizardMode = "interview" | "fuzzy";
export type WizardPhase = "idle" | "chatting" | "streaming" | "saving" | "complete";

/** Page-level phase for the unified create experience. */
export type PagePhase = "create" | "saving" | "enriching" | "auth" | "building" | "done";

/** Uploaded document metadata (lightweight — no content). */
export interface WizardDocument {
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

export interface WizardSuggestion {
  label: string;
  value: string;
  type: "text" | "example" | "skip";
}

export interface WizardDraft {
  business?: {
    useCase?: string;
    problemStatement?: string;
    challenges?: string[];
    benefits?: string[];
    successCriteria?: string[];
  };
  identity?: {
    name?: string;
    description?: string;
    persona?: string;
    responseFormat?: string;
    primaryUsers?: string;
    secondaryUsers?: string;
  };
  capabilities?: Array<{
    name: string;
    description?: string;
    phase?: "mvp" | "future";
  }>;
  integrations?: Array<{
    name: string;
    type?: string;
    purpose?: string;
  }>;
  knowledge?: Array<{
    name: string;
    type?: string;
    purpose?: string;
  }>;
  boundaries?: {
    handle?: string[];
    decline?: Array<{ topic: string; redirect?: string }>;
    refuse?: Array<{ topic: string; reason?: string }>;
  };
  conversations?: Array<{
    name: string;
    description?: string;
    triggerType?: string;
  }>;
  architecture?: {
    type?: "single-agent" | "multi-agent";
    channels?: string[];
    triggers?: Array<{ type: string; description?: string }>;
  };
}

export interface WizardState {
  sections: Record<string, WizardSectionStatus>;
  draft: WizardDraft;
  suggestions: WizardSuggestion[];
  activeSection: string | null;
  readyToSave: boolean;
}

export interface WizardMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  wizardState?: WizardState;
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_SECTIONS: Record<string, WizardSectionStatus> = {
  business: "not_started",
  identity: "not_started",
  capabilities: "not_started",
  integrations: "not_started",
  knowledge: "not_started",
  boundaries: "not_started",
  conversations: "not_started",
  architecture: "not_started",
};

const INITIAL_STATE: WizardState = {
  sections: { ...INITIAL_SECTIONS },
  draft: {},
  suggestions: [],
  activeSection: null,
  readyToSave: false,
};

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mcs-wizard-session";

function saveToStorage(messages: WizardMessage[], state: WizardState, mode: WizardMode) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages, state, mode, savedAt: new Date().toISOString() })
    );
  } catch { /* quota exceeded — silently ignore */ }
}

function loadFromStorage(): {
  messages: WizardMessage[];
  state: WizardState;
  mode: WizardMode;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard sessions older than 24 hours
    if (data.savedAt) {
      const age = Date.now() - new Date(data.savedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WizardStore {
  // Session state
  mode: WizardMode;
  phase: WizardPhase;
  pagePhase: PagePhase;
  messages: WizardMessage[];

  // Brief state
  currentState: WizardState;

  // Document state
  documents: WizardDocument[];

  // Saved project/agent IDs
  projectId: string | null;
  agentId: string | null;
  enrichJobId: string | undefined;

  // Error
  error: string | null;

  // Has a recoverable session?
  hasSavedSession: boolean;

  // Actions
  setMode: (mode: WizardMode) => void;
  setPagePhase: (phase: PagePhase) => void;
  sendMessage: (text: string) => Promise<void>;
  updateDraftField: (section: string, field: string, value: unknown) => void;
  uploadFile: (file: File) => Promise<void>;
  removeFile: (filename: string) => Promise<void>;
  saveBrief: (projectName: string) => Promise<{ projectId: string; agentId: string; enrichJobId?: string }>;
  restoreSession: () => void;
  reset: () => void;
}

let messageCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++messageCounter}`;
}

function freshState(): WizardState {
  return {
    sections: { ...INITIAL_SECTIONS },
    draft: {},
    suggestions: [],
    activeSection: null,
    readyToSave: false,
  };
}

export const useWizardStore = create<WizardStore>((set, get) => ({
  mode: "interview",
  phase: "idle",
  pagePhase: "create",
  messages: [],
  currentState: freshState(),
  documents: [],
  projectId: null,
  agentId: null,
  enrichJobId: undefined,
  error: null,
  hasSavedSession: loadFromStorage() !== null,

  setMode: (mode) => set({ mode }),
  setPagePhase: (pagePhase) => set({ pagePhase }),

  sendMessage: async (text: string) => {
    const { mode, messages, currentState, projectId } = get();

    // Add user message
    const userMsg: WizardMessage = {
      id: nextId(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    // Add placeholder assistant message for streaming
    const assistantMsg: WizardMessage = {
      id: nextId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      streaming: true,
    };

    const updatedMessages = [...messages, userMsg, assistantMsg];
    set({ messages: updatedMessages, phase: "streaming", error: null });

    // Build message history for API (exclude the placeholder)
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let accumulatedText = "";
    let finalState: WizardState | null = null;

    try {
      await wizardChat(mode, apiMessages, currentState, (event: WizardChatEvent) => {
        switch (event.type) {
          case "token":
            accumulatedText += event.text || "";
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: accumulatedText }
                  : m
              ),
            }));
            break;

          case "state":
            finalState = event.wizardState || null;
            break;

          case "error":
            set({ error: event.detail || "Unknown error" });
            break;
        }
      }, projectId);

      // Finalize the assistant message
      const newState = finalState || currentState;
      set((s) => {
        const finalMessages = s.messages.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: accumulatedText,
                streaming: false,
                wizardState: finalState || undefined,
              }
            : m
        );

        // Persist to localStorage
        saveToStorage(finalMessages, newState, s.mode);

        return {
          messages: finalMessages,
          currentState: newState,
          phase: "chatting",
        };
      });
    } catch (err: any) {
      set((s) => ({
        error: err.message,
        phase: "chatting",
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accumulatedText || "Sorry, something went wrong. Please try again.", streaming: false }
            : m
        ),
      }));
    }
  },

  updateDraftField: (section: string, field: string, value: unknown) => {
    set((s) => {
      const draft = { ...s.currentState.draft };
      const sectionData = { ...(draft as any)[section] };
      sectionData[field] = value;
      (draft as any)[section] = sectionData;

      const newState = { ...s.currentState, draft };
      saveToStorage(s.messages, newState, s.mode);
      return { currentState: newState };
    });
  },

  uploadFile: async (file: File) => {
    try {
      let { projectId } = get();

      // Eagerly create project on first upload (auto-name from file)
      if (!projectId) {
        const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        const projectName = `${baseName} project`;
        const result = await createProject(projectName);
        projectId = result.id;
        set({ projectId });
      }

      const result = await uploadDocument(projectId, file);
      const doc: WizardDocument = {
        name: result.filename || file.name,
        size: file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type: file.name.split(".").pop() || "file",
        uploadedAt: new Date().toISOString(),
      };
      set((s) => ({ documents: [...s.documents, doc] }));
    } catch (err: any) {
      set({ error: `Upload failed: ${err.message}` });
      throw err;
    }
  },

  removeFile: async (filename: string) => {
    const { projectId } = get();
    if (projectId) {
      try {
        await deleteDocument(projectId, filename);
      } catch { /* best effort */ }
    }
    set((s) => ({ documents: s.documents.filter((d) => d.name !== filename) }));
  },

  saveBrief: async (projectName: string) => {
    set({ phase: "saving", pagePhase: "saving", error: null });

    const { currentState } = get();
    const agentName =
      currentState.draft.identity?.name || "New Agent";

    try {
      const result = await wizardSave(projectName, agentName, currentState.draft);

      // Auto-trigger background enrichment
      let enrichJobId: string | undefined;
      try {
        const enrichResult = await startEnrichment(result.projectId, result.agentId);
        enrichJobId = enrichResult.jobId;
      } catch { /* enrichment is non-blocking */ }

      set({
        projectId: result.projectId,
        agentId: result.agentId,
        enrichJobId,
        phase: "complete",
        pagePhase: "enriching",
      });
      clearStorage();
      return { ...result, enrichJobId };
    } catch (err: any) {
      set({ error: err.message, phase: "chatting", pagePhase: "create" });
      throw err;
    }
  },

  restoreSession: () => {
    const saved = loadFromStorage();
    if (saved) {
      set({
        messages: saved.messages,
        currentState: saved.state,
        mode: saved.mode,
        phase: "chatting",
        hasSavedSession: false,
      });
    }
  },

  reset: () => {
    clearStorage();
    set({
      mode: "interview",
      phase: "idle",
      pagePhase: "create",
      messages: [],
      currentState: freshState(),
      documents: [],
      projectId: null,
      agentId: null,
      enrichJobId: undefined,
      error: null,
      hasSavedSession: false,
    });
  },
}));
