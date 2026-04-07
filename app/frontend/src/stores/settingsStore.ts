/**
 * Settings Store — Zustand state for wizard model selection and feature flags.
 *
 * Uses zustand/middleware persist for automatic localStorage sync.
 * All models default to Opus 4.6; users can switch for testing.
 */
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type ModelKey = "opus" | "sonnet" | "haiku" | "gpt-5.4";
export type ModelTask = "wizardChat" | "enrichment" | "prefetch";
export type FeatureKey = "prefetchEnabled" | "speculativeEnrichment" | "progressivePreview" | "dualModelEnabled";

export const AVAILABLE_MODELS: Record<ModelKey, string> = {
  opus: "Claude Opus 4.6",
  sonnet: "Claude Sonnet 4.6",
  haiku: "Claude Haiku 4.5",
  "gpt-5.4": "GPT-5.4",
};

interface SettingsState {
  models: Record<ModelTask, ModelKey>;
  prefetchEnabled: boolean;
  speculativeEnrichment: boolean;
  progressivePreview: boolean;
  dualModelEnabled: boolean;
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
  dualModelEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
  devtools(persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setModel: (task, model) =>
        set((s) => ({ models: { ...s.models, [task]: model } })),

      toggleFeature: (feature, enabled) =>
        set({ [feature]: enabled }),

      reset: () => set(DEFAULT_STATE),

      getModelForTask: (task) => get().models[task],
    }),
    {
      name: "mcs-wizard-settings",
      version: 1,
      partialize: (state) => ({
        models: state.models,
        prefetchEnabled: state.prefetchEnabled,
        speculativeEnrichment: state.speculativeEnrichment,
        progressivePreview: state.progressivePreview,
        dualModelEnabled: state.dualModelEnabled,
      }),
      // Deep-merge persisted models with defaults to guard against partial/stale storage
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof DEFAULT_STATE> | null;
        const validModel = (v: unknown): v is ModelKey =>
          typeof v === "string" && v in AVAILABLE_MODELS;
        return {
          ...current,
          models: {
            ...DEFAULT_STATE.models,
            ...(p?.models && typeof p.models === "object"
              ? Object.fromEntries(
                  Object.entries(p.models).filter(([, v]) => validModel(v)),
                )
              : {}),
          },
          prefetchEnabled: typeof p?.prefetchEnabled === "boolean" ? p.prefetchEnabled : DEFAULT_STATE.prefetchEnabled,
          speculativeEnrichment: typeof p?.speculativeEnrichment === "boolean" ? p.speculativeEnrichment : DEFAULT_STATE.speculativeEnrichment,
          progressivePreview: typeof p?.progressivePreview === "boolean" ? p.progressivePreview : DEFAULT_STATE.progressivePreview,
          dualModelEnabled: typeof p?.dualModelEnabled === "boolean" ? p.dualModelEnabled : DEFAULT_STATE.dualModelEnabled,
        };
      },
    },
  ), { name: "SettingsStore" }),
);
