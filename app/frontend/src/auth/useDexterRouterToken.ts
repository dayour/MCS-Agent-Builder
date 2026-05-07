import { useCallback, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { routerTokenRequest, isAuthDisabled } from './authConfig';

/**
 * Hook that returns a stable callback to acquire a JWT for the Dexter Router
 * (WebSocket authentication). Used by useWebSocketChat before each connection.
 * When auth is disabled or outside MsalProvider (isDexter off), returns a dummy token.
 *
 * Safe to call unconditionally — uses MSAL's default context (empty accounts)
 * when rendered outside MsalProvider. The callback checks for an account before
 * attempting token acquisition and throws if none is available.
 */
export function useDexterRouterToken(): () => Promise<string> {
  const { instance, accounts } = useMsal();
  const instanceRef = useRef(instance);
  const accountsRef = useRef(accounts);
  instanceRef.current = instance;
  accountsRef.current = accounts;

  return useCallback(async (): Promise<string> => {
    if (isAuthDisabled) return 'disabled';

    const account = accountsRef.current[0];
    if (!account) throw new Error('No authenticated account');

    try {
      const result = await instanceRef.current.acquireTokenSilent({
        ...routerTokenRequest,
        account,
      });
      return result.accessToken;
    } catch (silentError: any) {
      // Any silent acquisition failure falls back to popup — covers
      // InteractionRequiredAuthError, monitor_window_timeout, 400 responses
      // from token endpoint, and iframe/cookie issues.
      console.warn('[DexterRouterToken] Silent acquisition failed, falling back to popup:', silentError?.errorCode || silentError?.message);
      try {
        const result = await instanceRef.current.acquireTokenPopup({
          ...routerTokenRequest,
          account,
        });
        return result.accessToken;
      } catch (popupError) {
        console.error('[DexterRouterToken] Popup acquisition also failed:', popupError);
        throw popupError;
      }
    }
  }, []);
}
