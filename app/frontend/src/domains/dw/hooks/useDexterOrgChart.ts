import { useState, useEffect, useRef, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { isAuthDisabled } from '../../../auth/authConfig';

const GRAPH_SCOPES = ['User.Read.All'];

export interface OrgChartPerson {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  photoUrl: string | null;
  directReportsCount?: number;
}

export interface DexterOrgChart {
  /** Management chain from the agent user up (immediate manager first). */
  managerChain: OrgChartPerson[];
  /** Direct reports of the agent user's manager (peers). */
  peers: OrgChartPerson[];
  /** People the agent user works with (from Graph /people endpoint). */
  worksWith: OrgChartPerson[];
  loading: boolean;
}

const EMPTY: DexterOrgChart = { managerChain: [], peers: [], worksWith: [], loading: false };

/**
 * Fetches the real org chart for a Dexter agent user from Microsoft Graph.
 * Only runs when `isDexter` is true and `agenticUserId` is provided.
 */
export function useDexterOrgChart(
  isDexter: boolean,
  agenticUserId: string | null | undefined,
): DexterOrgChart {
  const { instance, accounts } = useMsal();
  const instanceRef = useRef(instance);
  const accountsRef = useRef(accounts);
  instanceRef.current = instance;
  accountsRef.current = accounts;

  const [orgChart, setOrgChart] = useState<DexterOrgChart>({ ...EMPTY, loading: !!(isDexter && agenticUserId) });

  const acquireToken = useCallback(async (): Promise<string | null> => {
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

  useEffect(() => {
    if (!isDexter || !agenticUserId || isAuthDisabled) {
      setOrgChart(EMPTY);
      return;
    }

    let cancelled = false;
    const photoUrls: string[] = [];

    (async () => {
      setOrgChart(prev => ({ ...prev, loading: true }));
      try {
        const token = await acquireToken();
        if (!token || cancelled) return;
        const headers = { Authorization: `Bearer ${token}` };
        const select = '$select=id,displayName,jobTitle,department,mail,userPrincipalName';

        // Fetch manager chain, peers, and people in parallel
        // Use $expand=manager($levels=max) to get the full manager chain in a single call
        // instead of sequential N+1 requests walking up the chain.
        const expandHeaders = { ...headers, ConsistencyLevel: 'eventual' };
        const [managerResp, peopleResp] = await Promise.all([
          fetch(
            `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(agenticUserId)}?$expand=manager($levels=max;${select})&${select}`,
            { headers: expandHeaders },
          ).catch(() => null),
          // People the agent user works with
          fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(agenticUserId)}/people?$top=10&${select}`, { headers }).catch(() => null),
        ]);

        if (cancelled) return;

        // Walk the nested manager chain from the $expand response
        const managerChain: OrgChartPerson[] = [];
        if (managerResp && managerResp.ok) {
          const userData = await managerResp.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let mgr: Record<string, any> | null = userData.manager ?? null;
          while (mgr && mgr.id && managerChain.length < 5) {
            managerChain.push(mapPerson(mgr));
            mgr = mgr.manager ?? null;
          }
        }

        // Fetch direct reports count for each manager (immutable — collect into a Map)
        const reportsCounts = new Map<string, number>();
        if (!cancelled) {
          await Promise.all(managerChain.map(async (mgr) => {
            try {
              const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mgr.id)}/directReports/$count`, {
                headers: { ...headers, ConsistencyLevel: 'eventual' },
              });
              if (resp.ok) {
                const count = parseInt(await resp.text(), 10);
                if (!isNaN(count)) reportsCounts.set(mgr.id, count);
              }
            } catch { /* skip */ }
          }));
          if (reportsCounts.size > 0) {
            for (let i = 0; i < managerChain.length; i++) {
              const count = reportsCounts.get(managerChain[i].id);
              if (count !== undefined) {
                managerChain[i] = { ...managerChain[i], directReportsCount: count };
              }
            }
          }
        }

        // Parse peers (manager's direct reports)
        let peers: OrgChartPerson[] = [];
        if (managerChain.length > 0 && !cancelled) {
          try {
            const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(managerChain[0].id)}/directReports?$top=10&${select}`, { headers });
            if (resp.ok) {
              const data = await resp.json();
              peers = (data.value || [])
                .filter((p: any) => p.id !== agenticUserId) // exclude the agent itself
                .map(mapPerson);
            }
          } catch { /* skip */ }
        }

        // Parse people / works with
        let worksWith: OrgChartPerson[] = [];
        if (peopleResp && peopleResp.ok) {
          const data = await peopleResp.json();
          worksWith = (data.value || []).map(mapPerson);
        }

        // Fetch photos for visible people only (immediate manager + peers + top 6 works-with)
        // to avoid excessive Graph API calls. Upper chain photos load when expanded.
        // Collect into a Map to avoid mutating the person objects directly.
        const photoMap = new Map<string, string>();
        if (!cancelled) {
          const priorityPeople = [
            ...managerChain.slice(0, 1), // immediate manager only
            ...peers.slice(0, 6),
            ...worksWith.slice(0, 6),
          ];
          const uniqueIds = new Set<string>();
          const deduped = priorityPeople.filter(p => { if (uniqueIds.has(p.id)) return false; uniqueIds.add(p.id); return true; });

          await Promise.all(deduped.map(async (person) => {
            try {
              const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(person.id)}/photo/$value`, { headers });
              if (resp.ok) {
                const blob = await resp.blob();
                if (!cancelled) {
                  const url = URL.createObjectURL(blob);
                  photoUrls.push(url);
                  photoMap.set(person.id, url);
                }
              }
            } catch { /* no photo */ }
          }));
        }

        if (!cancelled) {
          // Immutably apply photo URLs to produce new objects for React state
          const applyPhotos = (people: OrgChartPerson[]) =>
            people.map(p => photoMap.has(p.id) ? { ...p, photoUrl: photoMap.get(p.id)! } : p);
          setOrgChart({
            managerChain: applyPhotos(managerChain),
            peers: applyPhotos(peers),
            worksWith: applyPhotos(worksWith),
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setOrgChart({ ...EMPTY, loading: false });
      }
    })();

    return () => {
      cancelled = true;
      photoUrls.forEach(url => URL.revokeObjectURL(url));
      setOrgChart(EMPTY);
    };
  }, [isDexter, agenticUserId, acquireToken]);

  return orgChart;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPerson(p: Record<string, any>): OrgChartPerson {
  return {
    id: p.id ?? '',
    displayName: p.displayName ?? '',
    jobTitle: p.jobTitle ?? null,
    department: p.department ?? null,
    mail: p.mail ?? null,
    userPrincipalName: p.userPrincipalName ?? null,
    photoUrl: null,
  };
}
