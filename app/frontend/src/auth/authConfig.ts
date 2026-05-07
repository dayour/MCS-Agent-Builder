import { Configuration } from '@azure/msal-browser';

export const isAuthDisabled = process.env.REACT_APP_AUTH_DISABLED === 'true';

const clientId = process.env.REACT_APP_AUTH_CLIENT_ID;
const apiScope = process.env.REACT_APP_AUTH_API_SCOPE;
const routerScope = process.env.REACT_APP_AUTH_ROUTER_SCOPE;

// Warn instead of throw — Elevate can run without Dexter
if (!isAuthDisabled && !clientId) {
  console.warn('[Dexter Auth] REACT_APP_AUTH_CLIENT_ID not set. Dexter API calls will fail.');
}

if (!isAuthDisabled && !apiScope) {
  console.warn('[Dexter Auth] REACT_APP_AUTH_API_SCOPE not set. Dexter API calls will fail.');
}

if (!isAuthDisabled && !routerScope) {
  console.warn('[Dexter Auth] REACT_APP_AUTH_ROUTER_SCOPE not set. Dexter Router calls will fail.');
}

// MSAL v5 requires a redirect bridge page for Entra ID (COOP-protected) flows.
// Default to <baseUrl>/redirect.html (served by Vite multi-page build); override
// with REACT_APP_AUTH_REDIRECT_URI when deploying behind a different host or path.
// The redirect URI MUST be added to the Entra ID app registration.
// import.meta.env.BASE_URL respects Vite's `base` config (always trailing-slashed),
// so the default is correct under subpath deployments like /app/.
const defaultRedirectUri = `${window.location.origin}${import.meta.env.BASE_URL}redirect.html`;

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || 'disabled',
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: process.env.REACT_APP_AUTH_REDIRECT_URI || defaultRedirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

// Scopes for the login request (consent for Graph + Dexter API during interactive login).
// Router scope is NOT included — it's pre-authorized via app registration,
// so MSAL acquires it silently via the refresh token without user consent.
export const loginRequest = {
  scopes: ['User.Read', ...(apiScope ? [apiScope] : [])],
};

// Scopes for Dexter API access token (acquired separately after login)
export const dexterTokenRequest = {
  scopes: apiScope ? [apiScope] : [],
};

// Scopes for Dexter Router access token (WebSocket authentication)
export const routerTokenRequest = {
  scopes: routerScope ? [routerScope] : [],
};
