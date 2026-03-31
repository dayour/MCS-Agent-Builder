/**
 * RAF Token Batcher — collapses high-frequency SSE updates into one
 * Zustand set() per animation frame (~60fps), reducing renders 2-10x
 * during fast streaming.
 *
 * Usage:
 *   const flush = rafBatch(set, (s) => ({ messages: ... }));
 *   // in SSE loop:
 *   accumulatedText += token;
 *   flush((s) => ({ messages: s.messages.map(...) }));
 *   // on stream end:
 *   flush.cancel();
 */

type SetFn<S> = (updater: S | Partial<S> | ((s: S) => S | Partial<S>)) => void;
type Updater<S> = (s: S) => S | Partial<S>;

export interface RafHandle<S> {
  /** Schedule a state update — batched into the next animation frame. */
  (updater: Updater<S>): void;
  /** Flush any pending update immediately and cancel the RAF. */
  flush: () => void;
  /** Cancel without flushing. */
  cancel: () => void;
}

/**
 * Create a RAF-batched state updater. Each call replaces the pending
 * updater — only the latest one fires on the next animation frame.
 * This is correct for streaming text where each update contains the
 * full accumulated content (not a delta).
 */
export function rafBatch<S>(set: SetFn<S>): RafHandle<S> {
  let rafId: number | null = null;
  let pending: Updater<S> | null = null;

  function schedule(updater: Updater<S>) {
    pending = updater;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pending) {
          set(pending);
          pending = null;
        }
      });
    }
  }

  schedule.flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pending) {
      set(pending);
      pending = null;
    }
  };

  schedule.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pending = null;
  };

  return schedule;
}
