/**
 * Wizard Store — Zustand state for the conversational agent wizard.
 *
 * Manages chat messages, draft brief state, section progress,
 * and localStorage persistence for session recovery.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useSettingsStore } from "./settingsStore";
import { rafBatch } from "@/lib/rafBatcher";
import {
  wizardChat,
  wizardSave,
  wizardPrefetch,
  startEnrichment,
  speculativeEnrichment,
  reconcileEnrichment,
  createProject,
  uploadDocument,
  deleteDocument,
  type WizardChatEvent,
  type WizardPrefetchResult,
  type ComparisonResult,
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

  // Prefetch cache
  _prefetchResult: WizardPrefetchResult | null;
  _prefetchKey: string | null;
  _prefetchInFlight: boolean;

  // Speculative enrichment
  _speculativeJobId: string | null;

  // Dual-model comparison
  lastComparison: ComparisonResult | null;
  dualModelStatus: "idle" | "running" | "complete" | "failed" | "disabled";

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

/** Compute a prefetch key from section state (client-side only — server uses MD5). */
function computePrefetchKey(state: WizardState): string {
  const src = JSON.stringify({ active: state.activeSection, sections: state.sections });
  // Simple 32-bit hash — only compared client-side to detect section state changes
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
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

/**
 * Fire a background prefetch for the next wizard question.
 * Non-blocking — errors are silently ignored.
 */
function _firePrefetch(
  get: () => WizardStore,
  set: (partial: Partial<WizardStore> | ((s: WizardStore) => Partial<WizardStore>)) => void,
) {
  const { mode, messages, currentState, projectId, _prefetchInFlight } = get();
  if (_prefetchInFlight) return; // already in flight

  const settings = useSettingsStore.getState();
  const prefetchModel = settings.getModelForTask("prefetch");
  const prefetchKey = computePrefetchKey(currentState);

  set({ _prefetchInFlight: true });

  const apiMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  wizardPrefetch(mode, apiMessages, currentState as Record<string, unknown>, projectId, prefetchModel)
    .then((result) => {
      // Only store if state hasn't changed while we were fetching
      const current = get();
      const newKey = computePrefetchKey(current.currentState);
      if (newKey === prefetchKey) {
        set({ _prefetchResult: result, _prefetchKey: prefetchKey, _prefetchInFlight: false });
      } else {
        set({ _prefetchInFlight: false }); // state changed, discard
      }
    })
    .catch(() => {
      set({ _prefetchInFlight: false }); // silently ignore prefetch failures
    });
}

export const useWizardStore = create<WizardStore>()(devtools((set, get) => ({
  mode: "interview",
  phase: "idle",
  pagePhase: "create",
  messages: [],
  currentState: freshState(),
  documents: [],
  projectId: null,
  agentId: null,
  enrichJobId: undefined,
  _prefetchResult: null,
  _prefetchKey: null,
  _prefetchInFlight: false,
  _speculativeJobId: null,
  lastComparison: null,
  dualModelStatus: "idle",
  error: null,
  hasSavedSession: loadFromStorage() !== null,

  setMode: (mode) => set({ mode }),
  setPagePhase: (pagePhase) => set({ pagePhase }),

  sendMessage: async (text: string) => {
    const { mode, messages, currentState, projectId, _prefetchResult, _prefetchKey } = get();
    const settings = useSettingsStore.getState();
    const wizardModel = settings.getModelForTask("wizardChat");
    const prefetchEnabled = settings.prefetchEnabled;

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

    // Optimistic UI: immediately flash active section to in_progress
    const optimisticState = { ...currentState };
    if (currentState.activeSection && currentState.sections?.[currentState.activeSection] !== "complete") {
      optimisticState.sections = {
        ...currentState.sections,
        [currentState.activeSection]: "in_progress",
      };
    }

    set({ messages: updatedMessages, phase: "streaming", error: null, currentState: optimisticState, lastComparison: null, dualModelStatus: "running" });

    // Check prefetch cache — use it if section state matches and user gave a short direct answer
    // (long messages likely contain new context that the prefetched response wouldn't account for)
    const currentKey = computePrefetchKey(currentState);
    const isSimpleAnswer = text.length < 500 && !text.includes("?");
    if (_prefetchResult && _prefetchKey === currentKey && isSimpleAnswer) {
      // Cache hit! Use the prefetched response
      const { text: prefetchedText, state: prefetchedState } = _prefetchResult;
      const newState = (prefetchedState as WizardState) || currentState;

      const finalMessages = updatedMessages.map((m) =>
        m.id === assistantMsg.id
          ? { ...m, content: prefetchedText, streaming: false, wizardState: newState }
          : m
      );

      saveToStorage(finalMessages, newState, mode);
      set({
        messages: finalMessages,
        currentState: newState,
        phase: "chatting",
        _prefetchResult: null,
        _prefetchKey: null,
      });

      // Fire next prefetch in background
      if (prefetchEnabled && !newState.readyToSave) {
        _firePrefetch(get, set);
      }
      return;
    }

    // No cache hit — clear stale prefetch and call API normally
    set({ _prefetchResult: null, _prefetchKey: null });

    // Build message history for API (exclude the placeholder)
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let accumulatedText = "";
    let finalState: WizardState | null = null;

    // RAF batcher: collapses per-token set() calls into ~60fps updates
    const batchedSet = rafBatch<WizardStore>(set);

    try {
      await wizardChat(mode, apiMessages, currentState, (event: WizardChatEvent) => {
        switch (event.type) {
          case "token":
            accumulatedText += event.text || "";
            batchedSet((s) => ({
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

          case "comparison":
            if (event.data) {
              set({ lastComparison: event.data, dualModelStatus: "complete" });
            }
            break;

          case "error":
            set({ error: event.detail || "Unknown error" });
            break;
        }
      }, projectId, wizardModel, settings.dualModelEnabled);

      // Flush any remaining batched token update before finalizing
      batchedSet.flush();

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

      // Fire background prefetch for the next turn
      if (prefetchEnabled && !newState.readyToSave) {
        _firePrefetch(get, set);
      }

      // Trigger speculative enrichment when readyToSave just became true
      const speculativeEnabled = settings.speculativeEnrichment;
      if (speculativeEnabled && newState.readyToSave && !get()._speculativeJobId) {
        const agentName = newState.draft?.identity?.name || "New Agent";
        speculativeEnrichment(newState.draft as Record<string, unknown>, agentName)
          .then((result) => set({ _speculativeJobId: result.jobId }))
          .catch(() => { /* speculative enrichment is non-blocking */ });
      }
    } catch (err: any) {
      batchedSet.cancel(); // discard any pending RAF on error
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
      set((s) => ({ documents: [...s.documents, doc], _prefetchResult: null, _prefetchKey: null }));
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

    const { currentState, _speculativeJobId } = get();
    const agentName =
      currentState.draft.identity?.name || "New Agent";

    try {
      const result = await wizardSave(projectName, agentName, currentState.draft);

      // Try to reconcile speculative enrichment first — if it ran, we skip re-running
      let enrichJobId: string | undefined;
      if (_speculativeJobId) {
        try {
          await reconcileEnrichment(_speculativeJobId, result.projectId, result.agentId);
          enrichJobId = _speculativeJobId; // reuse the same job ID
        } catch {
          // Reconcile failed — fall through to normal enrichment
        }
      }

      // If no speculative result, trigger fresh enrichment
      if (!enrichJobId) {
        try {
          const enrichResult = await startEnrichment(result.projectId, result.agentId);
          enrichJobId = enrichResult.jobId;
        } catch { /* enrichment is non-blocking */ }
      }

      set({
        projectId: result.projectId,
        agentId: result.agentId,
        enrichJobId,
        _speculativeJobId: null,
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
      _prefetchResult: null,
      _prefetchKey: null,
      _prefetchInFlight: false,
      _speculativeJobId: null,
      error: null,
      hasSavedSession: false,
    });
  },
}), { name: "WizardStore" }));
