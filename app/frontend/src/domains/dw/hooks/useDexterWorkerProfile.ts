import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { isAuthDisabled } from '../../../auth/authConfig';
import { useDexterAuthFetch } from '../../../auth/useDexterAuthFetch';
import { fetchDexterWorkerDetail, type DexterWorkerDetail } from '../services/dexterWorkerService';

// User.ReadWrite.All is required because we write to another user's profile photo
// (the agent user, not the signed-in user). User.ReadWrite only covers the current
// user's own profile. There is no narrower delegated scope for writing another user's
// photo — User.ReadWrite.All is the minimum Graph permission that supports
// PUT /users/{id}/photo/$value for a different user.
// In production, scope this via Conditional Access policies or app-level consent
// to limit the blast radius.
const GRAPH_SCOPES = ['User.ReadWrite.All'];

interface DexterWorkerProfileData {
  worker: DexterWorkerDetail | null;
  photoUrl: string | null;
  email: string | null;
  entraDisplayName: string | null;
  jobTitle: string | null;
  department: string | null;
  teamsChatUrl: string | null;
  loading: boolean;
}

export interface DexterWorkerProfile extends DexterWorkerProfileData {
  /** Upload a PNG/JPEG blob as the agent user's Entra profile photo. Triggers refresh after. */
  uploadPhoto: (blob: Blob, contentType?: string) => Promise<void>;
  /** Re-fetch profile from the API + Entra. */
  refresh: () => void;
}

const EMPTY_DATA: DexterWorkerProfileData = {
  worker: null, photoUrl: null, email: null,
  entraDisplayName: null, jobTitle: null, department: null, teamsChatUrl: null, loading: false,
};

// Module-level cache so profile data survives agent switches without re-fetching
const profileCache: Record<string, DexterWorkerProfileData> = {
};

/**
 * Hook that fetches a Dexter worker's full profile: Control Plane detail + Entra photo/email.
 * Only runs when `isDexter` is true and a `dexterWorkerId` is provided.
 * Safe to call unconditionally — returns empty state when Dexter is off.
 */
export function useDexterWorkerProfile(
  isDexter: boolean,
  dexterWorkerId: string | undefined,
): DexterWorkerProfile {
  // Hooks must be called unconditionally — we just don't use the result when Dexter is off
  const authFetch = useDexterAuthFetch();
  const { instance, accounts } = useMsal();
  const instanceRef = useRef(instance);
  const accountsRef = useRef(accounts);
  instanceRef.current = instance;
  accountsRef.current = accounts;

  const [profile, setProfile] = useState<DexterWorkerProfileData>(() => {
    if (isDexter && dexterWorkerId && profileCache[dexterWorkerId]) {
      return profileCache[dexterWorkerId];
    }
    return { ...EMPTY_DATA, loading: !!(isDexter && dexterWorkerId) };
  });
  const [refreshCounter, setRefreshCounter] = useState(0);
  const photoUrlRef = useRef<string | null>(null);
  // Refs so callbacks always read the latest values without needing them in deps
  const dexterWorkerIdRef = useRef(dexterWorkerId);
  dexterWorkerIdRef.current = dexterWorkerId;
  const agenticUserIdRef = useRef<string | null>(null);

  const acquireGraphToken = useCallback(async (): Promise<string | null> => {
    if (isAuthDisabled) return null;
    const account = accountsRef.current[0];
    if (!account) return null;
    try {
      return (await instanceRef.current.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })).accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        try {
          return (await instanceRef.current.acquireTokenPopup({ scopes: GRAPH_SCOPES, account })).accessToken;
        } catch {
          // Popup blocked by browser or cancelled by user
          return null;
        }
      }
      return null;
    }
  }, []);

  const uploadPhoto = useCallback(async (blob: Blob, contentType = 'image/png') => {
    // Read from ref to avoid stale closure — always gets the latest agenticUserId
    const agenticUserId = agenticUserIdRef.current;
    if (!agenticUserId) throw new Error('No agent user ID — cannot upload photo');
    const token = await acquireGraphToken();
    if (!token) throw new Error('Failed to acquire Graph token');
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(agenticUserId)}/photo/$value`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body: blob },
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Photo upload failed: ${resp.status} ${body}`);
    }
    // Invalidate cache and refresh to pick up new photo
    if (dexterWorkerIdRef.current) {
      const cached = profileCache[dexterWorkerIdRef.current];
      if (cached?.photoUrl) URL.revokeObjectURL(cached.photoUrl);
      delete profileCache[dexterWorkerIdRef.current];
    }
    setRefreshCounter(c => c + 1);
  }, [acquireGraphToken]);

  const refresh = useCallback(() => {
    if (dexterWorkerIdRef.current) {
      const cached = profileCache[dexterWorkerIdRef.current];
      if (cached?.photoUrl) URL.revokeObjectURL(cached.photoUrl);
      delete profileCache[dexterWorkerIdRef.current];
    }
    setRefreshCounter(c => c + 1);
  }, []);

  useEffect(() => {
    if (!isDexter || !dexterWorkerId || isAuthDisabled) {
      setProfile(EMPTY_DATA);
      return;
    }

    let cancelled = false;

    // Serve from cache immediately if available
    if (profileCache[dexterWorkerId]) {
      setProfile(profileCache[dexterWorkerId]);
      agenticUserIdRef.current = profileCache[dexterWorkerId].worker?.agenticUserId ?? null;
      return;
    }

    (async () => {
      setProfile(prev => ({ ...prev, loading: true }));
      try {
        // Step 1: Fetch worker detail from Control Plane
        const worker = await fetchDexterWorkerDetail(authFetch, dexterWorkerId);
        if (cancelled) return;

        let photoUrl: string | null = null;
        let email: string | null = worker.email;
        let entraDisplayName: string | null = null;
        let jobTitle: string | null = null;
        let department: string | null = null;

        // Step 2: If we have an agenticUserId, fetch Entra profile + photo
        if (worker.agenticUserId) {
          try {
            const token = await acquireGraphToken();
            if (token) {
              const headers = { Authorization: `Bearer ${token}` };
              const graphBase = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(worker.agenticUserId)}`;

              const [profileResp, photoResp] = await Promise.all([
                fetch(`${graphBase}?$select=mail,userPrincipalName,displayName,jobTitle,department`, { headers }),
                fetch(`${graphBase}/photo/$value`, { headers }).catch(() => null),
              ]);

              if (cancelled) return;

              if (profileResp.ok) {
                const data = await profileResp.json();
                email = data.mail || data.userPrincipalName || email;
                entraDisplayName = data.displayName ?? null;
                jobTitle = data.jobTitle ?? null;
                department = data.department ?? null;
              }

              if (photoResp && photoResp.ok) {
                const blob = await photoResp.blob();
                if (!cancelled) photoUrl = URL.createObjectURL(blob);
              }
            }
          } catch {
            // Entra fetch failed — continue with worker data only
          }
        }

        if (!cancelled) {
          // Revoke previous photo blob URL before setting new one
          if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
          photoUrlRef.current = photoUrl;
          agenticUserIdRef.current = worker.agenticUserId ?? null;

          // Build Teams 1:1 chat URL from signed-in user + agent user IDs
          let teamsChatUrl: string | null = null;
          const currentUserId = accountsRef.current[0]?.localAccountId;
          if (currentUserId && worker.agenticUserId) {
            // Teams 1:1 thread IDs require the two user GUIDs sorted lexicographically
            const ids = [currentUserId, worker.agenticUserId].sort();
            const threadId = `19:${ids[0]}_${ids[1]}@unq.gbl.spaces`;
            teamsChatUrl = `https://teams.cloud.microsoft/l/chat/${threadId}/conversations?context=${encodeURIComponent(JSON.stringify({ contextType: 'chat' }))}`;
          }

          const data: DexterWorkerProfileData = { worker, photoUrl, email, entraDisplayName, jobTitle, department, teamsChatUrl, loading: false };
          profileCache[dexterWorkerId] = data;
          setProfile(data);
        }
      } catch {
        if (!cancelled) setProfile({ ...EMPTY_DATA, loading: false });
      }
    })();

    return () => {
      cancelled = true;
      // Don't revoke photo blob URLs — the cache still references them
      photoUrlRef.current = null;
      agenticUserIdRef.current = null;
    };
  }, [isDexter, dexterWorkerId, authFetch, refreshCounter]);

  // Memoize the result so consumers get a stable object reference —
  // without this, every render creates a new object which triggers
  // downstream effects that depend on the profile.
  return useMemo(
    () => ({ ...profile, uploadPhoto, refresh }),
    [profile, uploadPhoto, refresh],
  );
}
