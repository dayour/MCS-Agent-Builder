/**
 * SSE data-line parser — reads a fetch Response body as a stream of
 * `data: {...}` lines (JSON-per-line SSE), calling onEvent for each
 * successfully parsed JSON payload.
 *
 * Ported from src-backup/lib/sseStream.ts — proven pattern used across
 * enrichment, skill, and pipeline SSE endpoints.
 */

const DATA_PREFIX = "data: ";

function dispatchLine<T>(line: string, onEvent: (event: T) => void): void {
  if (!line.startsWith(DATA_PREFIX)) return;
  try {
    onEvent(JSON.parse(line.slice(DATA_PREFIX.length)));
  } catch {
    // Skip malformed JSON
  }
}

export async function consumeSSE<T>(
  res: Response,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const onAbort = () => reader.cancel();
  signal?.addEventListener("abort", onAbort, { once: true });

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        dispatchLine(line, onEvent);
      }
    }

    buffer += decoder.decode();
    dispatchLine(buffer, onEvent);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
