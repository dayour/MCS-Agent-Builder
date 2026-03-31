/**
 * Settings Store — Zustand state for wizard model selection and feature flags.
 *
 * Persists to localStorage so settings survive page reloads.
 * All models default to Opus 4.6; users can switch for testing.
 */
import { create } from "zustand";

export type ModelKey = "opus" | "sonnet" | "haiku" | "gpt-5.4";
export type ModelTask = "wizardChat" | "enrichment" | "prefetch";
export type FeatureKey = "prefetchEnabled" | "speculativeEnrichment" | "progressivePreview";

export const AVAILABLE_MODELS: Record<ModelKey, string> = {
  opus: "Claude Opus 4.6",
  sonnet: "Claude Sonnet 4.6",
  haiku: "Claude Haiku 4.5",
  "gpt-5.4": "GPT-5.4",
};

const STORAGE_KEY = "mcs-wizard-settings";

interface SettingsState {
  models: Record<ModelTask, ModelKey>;
  prefetchEnabled: boolean;
  speculativeEnrichment: boolean;
  progressivePreview: boolean;
  setModel: (task: ModelTask, model: ModelKey) => void;
  toggleFeature: (feature: FeatureKey, enabled: boolean) => void;
  reset: () => void;
  getModelForTask: (task: ModelTask) => ModelKey;
}

const DEFAULT_STATE = {
  models: {
    wizardChat: "opus" as ModelKey,
    enrichment: "opus" as ModelKey,
    prefetch: "opus" as ModelKey,
  },
  prefetchEnabled: true,
  speculativeEnrichment: true,
  progressivePreview: true,
};

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function pickPersisted(s: Pick<SettingsState, "models" | "prefetchEnabled" | "speculativeEnrichment" | "progressivePreview">) {
  return { models: s.models, prefetchEnabled: s.prefetchEnabled, speculativeEnrichment: s.speculativeEnrichment, progressivePreview: s.progressivePreview };
}

function saveSettings(state: ReturnType<typeof pickPersisted>) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[settingsStore] persist failed:", e);
  }
}

function restoreSettings(): typeof DEFAULT_STATE {
  if (!isBrowser) return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const p = JSON.parse(raw);
    const validModel = (v: unknown): v is ModelKey => typeof v === "string" && v in AVAILABLE_MODELS;
    const validBool = (v: unknown, def: boolean): boolean => typeof v === "boolean" ? v : def;
    return {
      models: {
        wizardChat: validModel(p?.models?.wizardChat) ? p.models.wizardChat : DEFAULT_STATE.models.wizardChat,
        enrichment: validModel(p?.models?.enrichment) ? p.models.enrichment : DEFAULT_STATE.models.enrichment,
        prefetch: validModel(p?.models?.prefetch) ? p.models.prefetch : DEFAULT_STATE.models.prefetch,
      },
      prefetchEnabled: validBool(p?.prefetchEnabled, DEFAULT_STATE.prefetchEnabled),
      speculativeEnrichment: validBool(p?.speculativeEnrichment, DEFAULT_STATE.speculativeEnrichment),
      progressivePreview: validBool(p?.progressivePreview, DEFAULT_STATE.progressivePreview),
    };
  } catch (e) {
    console.warn("[settingsStore] restore failed, using defaults:", e);
    return DEFAULT_STATE;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...restoreSettings(),

  setModel: (task, model) =>
    set((s) => {
      const next = { ...s, models: { ...s.models, [task]: model } };
      saveSettings(pickPersisted(next));
      return next;
    }),

  toggleFeature: (feature, enabled) =>
    set((s) => {
      const next = { ...s, [feature]: enabled };
      saveSettings(pickPersisted(next));
      return next;
    }),

  reset: () =>
    set(() => {
      saveSettings(DEFAULT_STATE);
      return DEFAULT_STATE;
    }),

  getModelForTask: (task) => get().models[task],
}));
