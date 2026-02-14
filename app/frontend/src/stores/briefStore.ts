/**
 * Brief store — loads brief via API + transform, tracks dirty state,
 * saves via transform + PUT. Includes debounced auto-save and polling.
 */
import { create } from "zustand";
import type { BriefData, BuildStatus, EvalResults } from "@/types";
import type { ApiBrief } from "@/types/api";
import { fetchAgent, saveAgentBrief } from "@/lib/api";
import { briefFromApi, briefToApi } from "@/lib/briefTransforms";
import { sectionCompletion } from "@/lib/readiness";

interface BriefStore {
  projectId: string | null;
  agentId: string | null;
  agentName: string;
  /** Transformed UI data. */
  data: BriefData | null;
  /** Raw brief from server (for merge-on-save). */
  rawBrief: ApiBrief | null;
  /** Build status from raw brief. */
  buildStatus: BuildStatus | null;
  /** Eval results from raw brief. */
  evalResults: EvalResults | null;
  /** Per-section completion map. */
  completion: Record<string, boolean>;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Server timestamp for polling. */
  serverUpdatedAt: string | null;
  /** Load an agent's brief from server. */
  load: (projectId: string, agentId: string) => Promise<void>;
  /** Update a section's data in the store. Marks dirty. */
  updateSection: (sectionId: string, sectionData: any) => void;
  /** Save current state to server. */
  save: () => Promise<void>;
  /** Poll for server changes (returns true if refreshed). */
  poll: () => Promise<boolean>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useBriefStore = create<BriefStore>((set, get) => ({
  projectId: null,
  agentId: null,
  agentName: "",
  data: null,
  rawBrief: null,
  buildStatus: null,
  evalResults: null,
  completion: {},
  dirty: false,
  loading: false,
  saving: false,
  error: null,
  serverUpdatedAt: null,

  load: async (projectId: string, agentId: string) => {
    set({ loading: true, error: null, projectId, agentId, dirty: false });
    try {
      const result = await fetchAgent(projectId, agentId);
      const raw = result.brief ?? ({} as ApiBrief);
      const data = briefFromApi(raw);
      set({
        agentName: result.name,
        data,
        rawBrief: raw,
        buildStatus: raw.buildStatus ?? null,
        evalResults: raw.evalResults ?? null,
        completion: sectionCompletion(data),
        serverUpdatedAt: raw.updated_at ?? null,
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  updateSection: (sectionId: string, sectionData: any) => {
    const { data } = get();
    if (!data) return;
    const updated = { ...data, [sectionId]: sectionData } as BriefData;
    set({
      data: updated,
      completion: sectionCompletion(updated),
      dirty: true,
    });
    // Debounced auto-save: 2s after last edit
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      get().save();
    }, 2000);
  },

  save: async () => {
    const { projectId, agentId, data, rawBrief, dirty, saving } = get();
    if (!projectId || !agentId || !data || !rawBrief || saving) return;
    if (!dirty) return;
    set({ saving: true });
    try {
      const merged = briefToApi(data, rawBrief);
      await saveAgentBrief(projectId, agentId, merged as unknown as Record<string, unknown>);
      set({ rawBrief: merged, dirty: false, saving: false, serverUpdatedAt: new Date().toISOString() });
    } catch (e: any) {
      set({ saving: false, error: e.message });
    }
  },

  poll: async () => {
    const { projectId, agentId, dirty } = get();
    if (!projectId || !agentId || dirty) return false;
    try {
      const result = await fetchAgent(projectId, agentId);
      const raw = result.brief ?? ({} as ApiBrief);
      const serverTs = raw.updated_at ?? null;
      if (serverTs && serverTs !== get().serverUpdatedAt) {
        const data = briefFromApi(raw);
        set({
          data,
          rawBrief: raw,
          buildStatus: raw.buildStatus ?? null,
          evalResults: raw.evalResults ?? null,
          completion: sectionCompletion(data),
          serverUpdatedAt: serverTs,
        });
        return true;
      }
    } catch {
      // Silent poll failure
    }
    return false;
  },
}));
