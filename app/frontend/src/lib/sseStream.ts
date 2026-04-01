/**
 * Shared SSE data-line parser — replaces 5 duplicate parsing blocks in api.ts.
 *
 * Reads a fetch Response body as a stream of `data: {...}` lines (JSON-per-line SSE),
 * calling onEvent for each successfully parsed JSON payload.
 *
 * Note: This handles the single-line `data:` JSON format used by all our server
 * endpoints. It does not implement full SSE spec (multi-line data, event/id fields).
 */

const DATA_PREFIX = "data: ";

/** Parse a single SSE data line and dispatch to onEvent. Skips malformed JSON. */
function dispatchLine<T>(line: string, onEvent: (event: T) => void): void {
  if (!line.startsWith(DATA_PREFIX)) return;
  try {
    onEvent(JSON.parse(line.slice(DATA_PREFIX.length)));
  } catch {
    // Skip malformed JSON — server streaming regressions caught by eval tests
  }
}

export async function consumeSSE<T>(
  res: Response,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Bail immediately if already aborted
  signal?.throwIfAborted();

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  // Cancel the reader when the signal fires (unblocks pending read())
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

    // Flush any buffered multibyte bytes from the decoder
    buffer += decoder.decode();

    // Process remaining buffer (last event may lack trailing newline)
    dispatchLine(buffer, onEvent);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
