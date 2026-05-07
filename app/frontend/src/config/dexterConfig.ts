// Dexter Control Plane API Configuration
// Override with environment variables (REACT_APP_DEXTER_API_URL)

export const DEXTER_CONFIG = {
  baseUrl: process.env.REACT_APP_DEXTER_API_URL || 'http://localhost:5201',
  routerUrl: process.env.REACT_APP_DEXTER_ROUTER_URL || 'http://localhost:5301',
  apiVersion: 'v1',
};

/**
 * Build a full API URL for Dexter Control Plane endpoints
 * @param path - API path starting with / (e.g., '/workers', '/workers/123')
 * @returns Full URL (e.g., 'http://localhost:5201/api/v1/workers')
 */
export const getDexterUrl = (path: string): string =>
  `${DEXTER_CONFIG.baseUrl}/api/${DEXTER_CONFIG.apiVersion}${path}`;

/**
 * Build a full API URL for Dexter Machines service endpoints
 * @param path - API path starting with / (e.g., '/machines', '/machines/123')
 * @returns Full URL (e.g., 'http://localhost:5804/api/v1/machines')
 */
export const getDexterMachinesUrl = (path: string): string =>
  `${(process.env.REACT_APP_DEXTER_MACHINES_URL || DEXTER_CONFIG.baseUrl)}/api/${DEXTER_CONFIG.apiVersion}${path}`;
