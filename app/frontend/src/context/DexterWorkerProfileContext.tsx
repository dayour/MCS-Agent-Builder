import React, { createContext, useContext } from 'react';
import { useDexterWorkerProfile, type DexterWorkerProfile } from '../domains/dw/hooks/useDexterWorkerProfile';
import { useAgent } from './AgentContext';
import { useDW } from '../domains/dw/context/DWContext';

const NOOP_UPLOAD = async () => {};
const NOOP_REFRESH = () => {};

const EMPTY: DexterWorkerProfile = {
  worker: null, photoUrl: null, email: null,
  entraDisplayName: null, jobTitle: null, department: null, teamsChatUrl: null, loading: false,
  uploadPhoto: NOOP_UPLOAD, refresh: NOOP_REFRESH,
};

const DexterWorkerProfileContext = createContext<DexterWorkerProfile>(EMPTY);

/**
 * Inner provider — only rendered when isDexter is true (i.e. inside MsalProvider).
 * Calls useDexterWorkerProfile which calls useMsal() internally.
 */
function DexterWorkerProfileProviderInner({ workerId, children }: { workerId?: string; children: React.ReactNode }) {
  const profile = useDexterWorkerProfile(true, workerId);
  return (
    <DexterWorkerProfileContext.Provider value={profile}>
      {children}
    </DexterWorkerProfileContext.Provider>
  );
}

/**
 * Provides a single shared DexterWorkerProfile for the current agent.
 * When isDexter is off, provides empty state without calling any MSAL hooks
 * (safe to render outside MsalProvider).
 */
export const DexterWorkerProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { agentConfig } = useAgent();
  const { isDexter } = useDW();

  if (!isDexter) {
    return (
      <DexterWorkerProfileContext.Provider value={EMPTY}>
        {children}
      </DexterWorkerProfileContext.Provider>
    );
  }

  return (
    <DexterWorkerProfileProviderInner workerId={agentConfig.dexterWorkerId}>
      {children}
    </DexterWorkerProfileProviderInner>
  );
};

/** Use the shared Dexter worker profile. Must be inside DexterWorkerProfileProvider. */
export function useSharedDexterWorkerProfile(): DexterWorkerProfile {
  return useContext(DexterWorkerProfileContext);
}
