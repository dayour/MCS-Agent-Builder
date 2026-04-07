/**
 * Environment Store — Tracks current PAC profile, environment, and Azure account.
 *
 * Fetches from /api/readiness/credentials and provides switch actions.
 * Single-user desktop app — global PAC state is safe (one user at a time).
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  checkCredentials,
  switchPacProfile,
  switchPacEnvironment,
  deletePacProfile,
  type CredentialCheck,
  type PacProfile,
  type PacEnvironment,
} from "@/lib/api";

interface EnvState {
  /** Full credential check result */
  credentials: CredentialCheck | null;
  /** Loading state for credential fetch */
  loading: boolean;
  /** Loading state for switch operations */
  switching: boolean;
  /** Error message */
  error: string | null;

  // Derived convenience getters
  activeProfile: PacProfile | null;
  activeEnvironment: PacEnvironment | null;

  /** Fetch credentials and populate state */
  loadCredentials: () => Promise<void>;
  /** Switch PAC auth profile by index */
  switchProfile: (index: number) => Promise<void>;
  /** Switch PAC environment by ID */
  switchEnvironment: (envId: string) => Promise<void>;
  /** Delete a PAC auth profile by index */
  deleteProfile: (index: number) => Promise<void>;
}

export const useEnvStore = create<EnvState>()(
  devtools(
    (set, get) => ({
      credentials: null,
      loading: false,
      switching: false,
      error: null,
      activeProfile: null,
      activeEnvironment: null,

      loadCredentials: async () => {
        set({ loading: true, error: null });
        try {
          const creds = await checkCredentials();
          set({
            credentials: creds,
            activeProfile: creds.pacProfiles.find((p) => p.active) ?? null,
            activeEnvironment: creds.pacEnvironments.find((e) => e.active) ?? null,
            loading: false,
          });
        } catch (err: any) {
          set({ error: err.message, loading: false });
        }
      },

      switchProfile: async (index: number) => {
        set({ switching: true, error: null });
        try {
          await switchPacProfile(index);
          // Reload credentials to get updated state (new environments, etc.)
          await get().loadCredentials();
          set({ switching: false });
        } catch (err: any) {
          set({ error: err.message, switching: false });
        }
      },

      switchEnvironment: async (envId: string) => {
        set({ switching: true, error: null });
        try {
          await switchPacEnvironment(envId);
          await get().loadCredentials();
          set({ switching: false });
        } catch (err: any) {
          set({ error: err.message, switching: false });
        }
      },

      deleteProfile: async (index: number) => {
        set({ switching: true, error: null });
        try {
          await deletePacProfile(index);
          await get().loadCredentials();
          set({ switching: false });
        } catch (err: any) {
          set({ error: err.message, switching: false });
        }
      },
    }),
    { name: "EnvStore" },
  ),
);
