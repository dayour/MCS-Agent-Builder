import { useCallback, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { dexterTokenRequest, isAuthDisabled } from './authConfig';

/**
 * Hook that returns a fetch wrapper which attaches a Bearer token
 * for the Dexter API. On 401, attempts a silent token refresh and retries once.
 * Returns a stable function reference (safe for useCallback dependencies).
 * When auth is disabled (REACT_APP_AUTH_DISABLED=true), returns plain fetch.
 */
export function useDexterAuthFetch() {
  const { instance, accounts } = useMsal();

  // Use refs so the returned function is stable (no dependency changes)
  const instanceRef = useRef(instance);
  const accountsRef = useRef(accounts);
  instanceRef.current = instance;
  accountsRef.current = accounts;

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (isAuthDisabled) {
      return fetch(url, options);
    }

    const account = accountsRef.current[0];
    if (!account) {
      throw new Error('No authenticated account');
    }

    const acquireToken = async (forceRefresh = false): Promise<string> => {
      try {
        const result = await instanceRef.current.acquireTokenSilent({
          ...dexterTokenRequest,
          account,
          forceRefresh,
        });
        return result.accessToken;
      } catch (silentError: any) {
        // Any silent acquisition failure falls back to popup — covers
        // InteractionRequiredAuthError, monitor_window_timeout, 400 responses
        // from token endpoint, and iframe/cookie issues.
        console.warn('[DexterAuthFetch] Silent acquisition failed, falling back to popup:', silentError?.errorCode || silentError?.message);
        try {
          const result = await instanceRef.current.acquireTokenPopup({
            ...dexterTokenRequest,
            account,
          });
          return result.accessToken;
        } catch (popupError) {
          console.error('[DexterAuthFetch] Popup acquisition also failed:', popupError);
          throw popupError;
        }
      }
    };

    const token = await acquireToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    // On 401, force-refresh the token and retry once
    if (response.status === 401) {
      const freshToken = await acquireToken(true);
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${freshToken}`,
        },
      });
    }

    return response;
  }, []);

  return authFetch;
}
