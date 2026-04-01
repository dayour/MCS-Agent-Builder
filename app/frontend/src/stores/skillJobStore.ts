/**
 * Skill Job Store — Zustand state for headless skill execution tracking.
 *
 * Manages skill job lifecycle for research/eval/fix/build pipeline steps.
 * Subscribes to SSE stream from /api/skill/status/:jobId for real-time
 * step progress, auth prompts, and completion events.
 *
 * Supports multiple concurrent jobs (one per agent per skill type).
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  startSkill as apiStartSkill,
  subscribeSkillStatus,
  skillAuthComplete,
  fetchSkillLog,
  type SkillType,
  type SkillStep,
  type SkillStatusEvent,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillPhase =
  | "idle"
  | "starting"
  | "running"
  | "paused_auth"
  | "completed"
  | "failed";

export interface SkillJob {
  jobId: string;
  skillType: SkillType;
  projectId: string;
  agentId: string;
  phase: SkillPhase;
  steps: SkillStep[];
  errors: string[];
  summary: string | null;
  rawLog: string;
  authPrompt: { system: string; instructions: string } | null;
  startedAt: string;
  completedAt: string | null;
}

/** Unique key for a job slot: projectId + agentId + skillType */
function jobKey(projectId: string, agentId: string, skillType: SkillType): string {
  return `${projectId}::${agentId}::${skillType}`;
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

interface SkillJobStore {
  /** Map of active/recent jobs keyed by projectId::agentId::skillType */
  jobs: Record<string, SkillJob>;

  /** Launch a skill job. Returns the job key. */
  launchSkill: (skillType: SkillType, projectId: string, agentId: string) => Promise<string>;

  /** Resume a paused job after auth. */
  resumeAfterAuth: (key: string) => Promise<void>;

  /** Fetch raw log for a job. */
  fetchLog: (key: string) => Promise<string>;

  /** Get a job by key. */
  getJob: (key: string) => SkillJob | undefined;

  /** Remove a job from the store (any state). Aborts SSE if still active. */
  clearJob: (key: string) => void;

  /** Check if a skill is actively running for an agent. */
  isRunning: (projectId: string, agentId: string, skillType: SkillType) => boolean;
}

/** Abort controllers for active SSE subscriptions, keyed by job key. */
const sseAborts = new Map<string, AbortController>();

function abortSse(key: string) {
  const ctrl = sseAborts.get(key);
  if (ctrl) {
    ctrl.abort();
    sseAborts.delete(key);
  }
}

export const useSkillJobStore = create<SkillJobStore>()(devtools((set, get) => ({
  jobs: {},

  launchSkill: async (skillType, projectId, agentId) => {
    const key = jobKey(projectId, agentId, skillType);

    // Guard against concurrent launches for same slot
    const existing = get().jobs[key];
    if (existing && (existing.phase === "starting" || existing.phase === "running" || existing.phase === "paused_auth")) {
      return key;
    }

    // Abort any leftover SSE stream
    abortSse(key);

    // Create initial job state
    const initialJob: SkillJob = {
      jobId: "",
      skillType,
      projectId,
      agentId,
      phase: "starting",
      steps: [],
      errors: [],
      summary: null,
      rawLog: "",
      authPrompt: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    set((s) => ({ jobs: { ...s.jobs, [key]: initialJob } }));

    try {
      const result = await apiStartSkill(skillType, projectId, agentId || undefined);
      const jobId = result.jobId;

      set((s) => {
        const job = s.jobs[key];
        if (!job) return s;
        return { jobs: { ...s.jobs, [key]: { ...job, jobId, phase: "running" } } };
      });

      // Subscribe to SSE stream
      const localController = new AbortController();
      sseAborts.set(key, localController);

      subscribeSkillStatus(jobId, (event: SkillStatusEvent) => {
        set((s) => {
          const job = s.jobs[key];
          if (!job || job.jobId !== jobId) return s;

          switch (event.type) {
            case "step":
            case "state":
              if (event.steps) {
                return { jobs: { ...s.jobs, [key]: { ...job, steps: event.steps } } };
              }
              return s;

            case "output":
              if (event.data) {
                return { jobs: { ...s.jobs, [key]: { ...job, rawLog: job.rawLog + event.data } } };
              }
              return s;

            case "auth_required":
              return {
                jobs: {
                  ...s.jobs,
                  [key]: {
                    ...job,
                    phase: "paused_auth",
                    authPrompt: {
                      system: event.system || "Unknown",
                      instructions: event.instructions || "Complete authorization in your browser.",
                    },
                  },
                },
              };

            case "auth_completed":
              return {
                jobs: { ...s.jobs, [key]: { ...job, phase: "running", authPrompt: null } },
              };

            case "done": {
              const success = event.status === "completed";
              return {
                jobs: {
                  ...s.jobs,
                  [key]: {
                    ...job,
                    phase: success ? "completed" : "failed",
                    steps: event.steps || job.steps,
                    errors: event.errors || job.errors,
                    summary: event.summary || null,
                    completedAt: new Date().toISOString(),
                  },
                },
              };
            }

            default:
              return s;
          }
        });
      }, localController.signal).catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;

        set((s) => {
          const job = s.jobs[key];
          if (!job || job.jobId !== jobId) return s;
          if (job.phase !== "running" && job.phase !== "starting") return s;
          return {
            jobs: {
              ...s.jobs,
              [key]: {
                ...job,
                phase: "failed",
                errors: [...job.errors, "Lost connection to skill server"],
                completedAt: new Date().toISOString(),
              },
            },
          };
        });
      }).finally(() => {
        if (sseAborts.get(key)?.signal === localController.signal) {
          sseAborts.delete(key);
        }
      });
    } catch (err) {
      set((s) => {
        const job = s.jobs[key];
        return {
          jobs: {
            ...s.jobs,
            [key]: job
              ? { ...job, phase: "failed", errors: [...job.errors, toErrorMessage(err)], completedAt: new Date().toISOString() }
              : initialJob,
          },
        };
      });
    }

    return key;
  },

  resumeAfterAuth: async (key) => {
    const job = get().jobs[key];
    if (!job || !job.jobId) throw new Error("No active skill job to resume");

    try {
      await skillAuthComplete(job.jobId);
      // SSE stream will emit "auth_completed" event — store updates from there
    } catch (err) {
      set((s) => {
        const j = s.jobs[key];
        if (!j) return s;
        return { jobs: { ...s.jobs, [key]: { ...j, errors: [...j.errors, `Resume failed: ${toErrorMessage(err)}`] } } };
      });
      throw err;
    }
  },

  fetchLog: async (key) => {
    const job = get().jobs[key];
    if (!job || !job.jobId) return "";
    try {
      return await fetchSkillLog(job.jobId);
    } catch {
      return job.rawLog;
    }
  },

  getJob: (key) => get().jobs[key],

  clearJob: (key) => {
    abortSse(key);
    set((s) => {
      const { [key]: _, ...rest } = s.jobs;
      return { jobs: rest };
    });
  },

  isRunning: (projectId, agentId, skillType) => {
    const key = jobKey(projectId, agentId, skillType);
    const job = get().jobs[key];
    return !!job && (job.phase === "starting" || job.phase === "running" || job.phase === "paused_auth");
  },
}), { name: "SkillJobStore" }));

/** Helper to compute the job key from outside the store. */
export function getSkillJobKey(projectId: string, agentId: string, skillType: SkillType): string {
  return jobKey(projectId, agentId, skillType);
}