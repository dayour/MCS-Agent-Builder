import React, { useEffect, useRef, useState } from 'react';
import { PublicClientApplication, InteractionStatus } from '@azure/msal-browser';
import { MsalProvider, MsalContext, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { msalConfig, isAuthDisabled, loginRequest } from './authConfig';
import { useDexterAuthFetch } from './useDexterAuthFetch';
import { useDW } from '../domains/dw/context/DWContext';

// Anonymous account for when auth is disabled
const ANON_ACCOUNT = {
  homeAccountId: 'anon',
  localAccountId: 'anon-user',
  environment: 'anon',
  tenantId: 'anon',
  username: 'anonymous@local',
  name: 'Anonymous User',
};

/**
 * Mock MsalProvider for when auth is disabled (REACT_APP_AUTH_DISABLED=true).
 * Provides a fake MSAL context so useMsal() in useDexterAuthFetch works.
 */
function AnonMsalProvider({ children }: { children: React.ReactNode }) {
  const mockContext = {
    instance: {} as InstanceType<typeof PublicClientApplication>,
    inProgress: InteractionStatus.None,
    accounts: [ANON_ACCOUNT],
    logger: { verbose: () => {}, info: () => {}, warning: () => {}, error: () => {} } as never,
  };
  return (
    <MsalContext.Provider value={mockContext}>
      {children}
    </MsalContext.Provider>
  );
}

/**
 * Triggers a login popup when MSAL is initialized but no user is signed in.
 * Unlike digital-worker's AuthGuard (which uses loginRedirect and blocks the whole page),
 * this uses loginPopup so the Elevate app stays usable during auth.
 */
function DexterAuthGuard({ children }: { children: React.ReactNode }) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const loginAttempted = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated && inProgress === InteractionStatus.None && !loginAttempted.current) {
      loginAttempted.current = true;
      setAuthError(null);
      instance.loginPopup(loginRequest).catch((error) => {
        console.error('[Dexter] Login popup failed:', error);
        loginAttempted.current = false;
        setAuthError(
          error?.errorCode === 'user_cancelled'
            ? 'Authentication was cancelled. Dexter features require sign-in.'
            : `Authentication failed: ${error?.message || 'Unknown error'}. Dexter features require sign-in.`
        );
      });
    }
  }, [isAuthenticated, inProgress, instance]);

  return (
    <>
      {authError && !isAuthenticated && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-red-50 border border-red-200 rounded-lg shadow-lg p-3 flex items-start gap-2">
          <p className="text-sm text-red-700 flex-1">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              loginAttempted.current = false;
            }}
            className="text-red-400 hover:text-red-600 text-xs font-medium flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </>
  );
}

/**
 * Inner component that reads useDexterAuthFetch() (requires MsalProvider above)
 * and injects the function into the AgentContext ref.
 * Only injects once authenticated so the auth fetch has a valid account.
 */
function AuthFetchInjector({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { accounts } = useMsal();
  const authFetch = useDexterAuthFetch();
  const { setDexterAuthFetch, setTenantDomain } = useDW();

  useEffect(() => {
    if (isAuthenticated) {
      setDexterAuthFetch(authFetch);
      // Extract tenant domain from the MSAL account username (UPN), e.g. "jared@microsoft.com" → "microsoft.com"
      const upn = accounts[0]?.username;
      if (upn && upn.includes('@')) {
        setTenantDomain(upn.split('@')[1]);
      }
    }
  }, [authFetch, setDexterAuthFetch, isAuthenticated, accounts, setTenantDomain]);

  return <>{children}</>;
}

/**
 * Conditional MSAL wrapper — only active when the "Dexter" feature flag is on.
 * When off, renders children directly (zero overhead).
 *
 * Place inside AgentProvider so it can read isDexter from context.
 */
export function DexterMsalBridge({ children }: { children: React.ReactNode }) {
  const { isDexter } = useDW();
  const msalInstanceRef = useRef<PublicClientApplication | null>(null);
  const [msalReady, setMsalReady] = useState(false);

  // Lazily initialize MSAL when the flag is turned on
  useEffect(() => {
    if (!isDexter || isAuthDisabled || msalInstanceRef.current) return;

    const instance = new PublicClientApplication(msalConfig);
    instance.initialize().then(() => {
      msalInstanceRef.current = instance;
      setMsalReady(true);
    }).catch(err => {
      console.error('[Dexter] MSAL initialization failed:', err);
    });
  }, [isDexter]);

  // Flag is off — render children directly
  if (!isDexter) {
    return <>{children}</>;
  }

  // Auth disabled — use mock provider
  if (isAuthDisabled) {
    return (
      <AnonMsalProvider>
        <AuthFetchInjector>{children}</AuthFetchInjector>
      </AnonMsalProvider>
    );
  }

  // MSAL not yet initialized
  if (!msalReady || !msalInstanceRef.current) {
    return <>{children}</>;
  }

  return (
    <MsalProvider instance={msalInstanceRef.current}>
      <DexterAuthGuard>
        <AuthFetchInjector>{children}</AuthFetchInjector>
      </DexterAuthGuard>
    </MsalProvider>
  );
}
