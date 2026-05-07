import { KnowledgeConfig, KnowledgeHealthResult } from '../types';

const CHECK_TIMEOUT_MS = 5000;

/**
 * Validates each enabled API connection in a knowledge config.
 * Attempts a HEAD request to each endpoint; network failures (CORS, timeout,
 * DNS) are treated as the connector being unreachable.
 *
 * Browser-side limitation: `mode: 'no-cors'` avoids CORS preflight but
 * returns an opaque response — HTTP status codes (404, 500, etc.) are
 * invisible. Only hard network failures (DNS failure, timeout, TCP refused)
 * cause fetch() to throw and are caught here. A server that responds with
 * an error status will appear "reachable". For complete health checks a
 * server-side proxy is required.
 */
export async function checkKnowledgeHealth(
  knowledge: KnowledgeConfig,
): Promise<KnowledgeHealthResult[]> {
  const enabledAPIs = knowledge.customAPIs.filter(api => api.enabled);
  if (enabledAPIs.length === 0) return [];

  const results = await Promise.all(
    enabledAPIs.map(async (api): Promise<KnowledgeHealthResult | null> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      try {
        await fetch(api.endpoint, {
          method: 'HEAD',
          signal: controller.signal,
          // no-cors avoids a preflight but still throws on DNS/network failure
          mode: 'no-cors',
        });
        clearTimeout(timeout);
        return null; // reachable — no error
      } catch (err) {
        clearTimeout(timeout);
        const isTimeout = (err as Error)?.name === 'AbortError';
        return {
          sourceId: api.id,
          sourceName: api.name,
          type: 'api',
          status: 'unreachable',
          message: isTimeout
            ? `${api.name} timed out after ${CHECK_TIMEOUT_MS / 1000}s. The connector may be offline or the endpoint has moved.`
            : `${api.name} could not be reached. This may be due to network or CORS issues, or the Dataverse table or connector-backed resource may no longer be accessible.`,
        };
      }
    }),
  );

  return results.filter((r): r is KnowledgeHealthResult => r !== null);
}
