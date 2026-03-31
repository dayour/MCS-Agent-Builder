/**
 * Build Job Store — Zustand state for headless build tracking.
 *
 * Manages build job lifecycle: start → auth gate → building → done.
 * Subscribes to SSE stream from /api/build/status/:jobId for real-time
 * step progress, auth prompts, and completion events.
 */
import { create } from "zustand";
import { rafBatch } from "@/lib/rafBatcher";
import {
  startBuild,
  subscribeBuildStatus,
  buildAuthComplete,
  fetchBuildLog,
  checkCredentials,
  type BuildStatusEvent,
  type CredentialCheck,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuildPhase =
  | "idle"        // No build in progress
  | "auth_gate"   // Pre-build credential check
  | "starting"    // POST /build/start sent, waiting for jobId
  | "running"     // SSE connected, receiving step events
  | "paused_auth" // Build paused for mid-build OAuth
  | "completed"   // Build succeeded
  | "failed";     // Build failed

export interface BuildJob {
  jobId: string;
  projectId: string;
  agentId: string;
  steps: Array<{ id: string; label: string; status: string; detail: string | null }>;
  errors: string[];
  summary: string | null;
  rawLog: string;
  authPrompt: { system: string; instructions: string } | null;
  startedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface BuildJobStore {
  job: BuildJob | null;
  phase: BuildPhase;
  credCheck: CredentialCheck | null;

  openAuthGate: (projectId: string, agentId: string) => Promise<void>;
  refreshCredentials: () => Promise<void>;
  closeAuthGate: () => void;
  launchBuild: () => Promise<void>;
  /** Notify backend that mid-build OAuth is complete. Throws on failure. */
  resumeAfterAuth: () => Promise<void>;
  fetchLog: () => Promise<string>;
  reset: () => void;
}

/** Abort controller for the active SSE subscription. */
let sseAbort: AbortController | null = null;

/** Abort any active SSE stream and clear the controller ref. */
function abortSse() {
  if (sseAbort) {
    sseAbort.abort();
    sseAbort = null;
  }
}

export const useBuildJobStore = create<BuildJobStore>((set, get) => ({
  job: null,
  phase: "idle",
  credCheck: null,

  openAuthGate: async (projectId, agentId) => {
    set({
      phase: "auth_gate",
      job: {
        jobId: "",
        projectId,
        agentId,
        steps: [],
        errors: [],
        summary: null,
        rawLog: "",
        authPrompt: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
    });

    try {
      const creds = await checkCredentials();
      set({ credCheck: creds });
    } catch (err) {
      // Surface a meaningful fallback — null means "could not check"
      console.warn("[buildJobStore] credential check failed:", toErrorMessage(err));
      set({ credCheck: null });
    }
  },

  refreshCredentials: async () => {
    try {
      const creds = await checkCredentials();
      set({ credCheck: creds });
    } catch (err) {
      console.warn("[buildJobStore] credential refresh failed:", toErrorMessage(err));
      throw err; // Rethrow so UI can show error toast
    }
  },

  closeAuthGate: () => {
    set({ phase: "idle", job: null, credCheck: null });
  },

  launchBuild: async () => {
    const { job, phase } = get();
    if (!job) return;

    // Guard against concurrent launches
    if (phase === "starting" || phase === "running" || phase === "paused_auth") return;

    // Abort any leftover SSE stream from a previous build
    abortSse();

    set({ phase: "starting" });

    // Capture job context before the async gap so we don't spread null on error
    const { projectId, agentId } = job;

    try {
      const result = await startBuild(projectId, agentId);
      const jobId = result.jobId;

      set((s) => ({
        phase: "running",
        job: s.job ? { ...s.job, jobId } : null,
      }));

      // Subscribe to SSE stream with abort signal
      const localController = new AbortController();
      sseAbort = localController;

      // RAF batcher for high-frequency output events (~60fps max)
      let pendingLog = "";
      const logBatcher = rafBatch<BuildJobStore>(set);

      subscribeBuildStatus(jobId, (event: BuildStatusEvent) => {
        // High-frequency output events go through RAF batcher
        if (event.type === "output" && event.data) {
          pendingLog += event.data;
          logBatcher((s) => {
            if (!s.job || s.job.jobId !== jobId) return s;
            // Consume all accumulated output in one frame
            const chunk = pendingLog;
            pendingLog = "";
            return { job: { ...s.job, rawLog: s.job.rawLog + chunk } };
          });
          return;
        }

        // All other events: flush pending log first, then apply immediately
        logBatcher.flush();

        set((s) => {
          if (!s.job || s.job.jobId !== jobId) return s;
          const current = s.job;

          switch (event.type) {
            case "step":
            case "state":
              if (event.steps) {
                return { job: { ...current, steps: event.steps } };
              }
              return s;

            case "auth_required":
              return {
                phase: "paused_auth",
                job: {
                  ...current,
                  authPrompt: {
                    system: event.system || "Unknown",
                    instructions: event.instructions || "Complete authorization in your browser.",
                  },
                },
              };

            case "auth_completed":
              return {
                phase: "running",
                job: { ...current, authPrompt: null },
              };

            case "done": {
              const success = event.status === "completed";
              return {
                phase: success ? "completed" : "failed",
                job: {
                  ...current,
                  steps: event.steps || current.steps,
                  errors: event.errors || current.errors,
                  summary: event.summary || null,
                  completedAt: new Date().toISOString(),
                },
              };
            }

            default:
              return s;
          }
        });
      }, localController.signal).catch((err) => {
        // AbortError is expected on reset/cleanup — ignore it
        if (err instanceof DOMException && err.name === "AbortError") return;

        set((s) => {
          if (!s.job || s.job.jobId !== jobId) return s;
          if (s.phase !== "running" && s.phase !== "starting") return s;
          return {
            phase: "failed" as const,
            job: {
              ...s.job,
              errors: [...s.job.errors, "Lost connection to build server"],
              completedAt: new Date().toISOString(),
            },
          };
        });
      }).finally(() => {
        logBatcher.flush(); // flush any remaining output before cleanup
        // Clear module-level ref if this controller is still the active one
        if (sseAbort?.signal === localController.signal) sseAbort = null;
      });
    } catch (err) {
      // Preserve existing job state where possible
      set((s) => ({
        phase: "failed" as const,
        job: s.job
          ? { ...s.job, errors: [...s.job.errors, toErrorMessage(err)], completedAt: new Date().toISOString() }
          : {
              jobId: "",
              projectId,
              agentId,
              steps: [],
              errors: [toErrorMessage(err)],
              summary: null,
              rawLog: "",
              authPrompt: null,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            },
      }));
    }
  },

  resumeAfterAuth: async () => {
    const { job } = get();
    if (!job || !job.jobId) throw new Error("No active build to resume");

    try {
      await buildAuthComplete(job.jobId);
      // SSE stream will emit "auth_completed" event — store updates from there
    } catch (err) {
      const msg = toErrorMessage(err);
      set((s) => {
        if (!s.job) return s;
        return { job: { ...s.job, errors: [...s.job.errors, `Resume failed: ${msg}`] } };
      });
      throw err; // Rethrow so callers (OAuthPromptModal) can keep modal open
    }
  },

  fetchLog: async () => {
    const { job } = get();
    if (!job || !job.jobId) return "";
    try {
      return await fetchBuildLog(job.jobId);
    } catch {
      return job.rawLog;
    }
  },

  reset: () => {
    abortSse();
    set({ job: null, phase: "idle", credCheck: null });
  },
}));
