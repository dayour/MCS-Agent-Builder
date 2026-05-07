/**
 * Dev Logger — Frontend instrumentation for triage & agentic test loop
 *
 * Captures: UI events, network requests, console output, errors, navigation.
 * Sends batched events to backend via POST /api/__dev/log.
 * Active only in development mode.
 *
 * Categories (toggleable via ?devlog=ui,net,error,console,nav,perf):
 *   ui      — clicks, inputs, focus, form submits
 *   net     — fetch requests (method, url, status, timing)
 *   error   — uncaught errors, unhandled rejections
 *   console — console.log/warn/error/info intercepts
 *   nav     — route changes (hash-based)
 *   perf    — long tasks, page load, route transition timing
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogCategory = 'ui' | 'net' | 'error' | 'console' | 'nav' | 'perf' | 'state';

export interface DevLogEvent {
  ts: string;           // ISO timestamp
  seq: number;          // monotonic sequence number
  sid: string;          // session ID
  cat: LogCategory;     // category
  type: string;         // event subtype (e.g., "click", "fetch", "error")
  route: string;        // current hash route
  data: Record<string, unknown>;  // event-specific payload
  testRunId?: string;   // correlation ID when running under agentic test loop
}

const TEST_RUN_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// ── Configuration ─────────────────────────────────────────────────────────────

const ALL_CATEGORIES: LogCategory[] = ['ui', 'net', 'error', 'console', 'nav', 'perf', 'state'];

const SENSITIVE_INPUT_TYPES = new Set([
  'password', 'hidden', 'token', 'secret', 'credit-card',
]);

const SENSITIVE_NAME_PATTERNS = /password|passwd|secret|token|apikey|api_key|auth|credential|ssn|credit/i;

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token',
]);

const BATCH_INTERVAL_MS = 500;
const MAX_BATCH_SIZE = 50;
const MAX_INPUT_VALUE_LENGTH = 100;

// ── State ─────────────────────────────────────────────────────────────────────

let initialized = false;
let sessionId = '';
let sequence = 0;
let enabledCategories = new Set<LogCategory>(ALL_CATEGORIES);
const eventBuffer: DevLogEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastRoute = '';
let lastRouteTime = 0;
let lastNavEmitTime = 0;  // Dedup: prevent double-fire from hashchange + popstate

// Saved originals for console monkey-patching
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Saved original fetch
let originalFetch: typeof window.fetch;

// ── Helpers ───────────────────────────────────────────────────────────────────

function genSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentRoute(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function isSensitiveField(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    if (SENSITIVE_INPUT_TYPES.has(el.type)) return true;
    if (SENSITIVE_NAME_PATTERNS.test(el.name || '')) return true;
    if (SENSITIVE_NAME_PATTERNS.test(el.id || '')) return true;
    if (SENSITIVE_NAME_PATTERNS.test(el.getAttribute('autocomplete') || '')) return true;
  }
  if (el instanceof HTMLTextAreaElement) {
    if (SENSITIVE_NAME_PATTERNS.test(el.name || '')) return true;
    if (SENSITIVE_NAME_PATTERNS.test(el.id || '')) return true;
  }
  return false;
}

function getElementDescriptor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classList = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
  const ariaLabel = el.getAttribute('aria-label');
  const text = ariaLabel
    || (el.textContent || '').trim().slice(0, 40)
    || '';
  const textPart = text ? ` "${text}"` : '';
  return `${tag}${id}${classList}${role}${textPart}`.trim();
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    // Redact sensitive query params
    for (const key of u.searchParams.keys()) {
      if (SENSITIVE_NAME_PATTERNS.test(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function redactHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers);
  for (const [key, value] of entries) {
    result[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return result;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// ── Core emit ─────────────────────────────────────────────────────────────────

function getTestRunId(): string | undefined {
  try {
    const fromWindow = (window as unknown as { __TEST_RUN_ID?: string }).__TEST_RUN_ID;
    if (fromWindow && TEST_RUN_ID_RE.test(fromWindow)) return fromWindow;
    const fromStorage = localStorage.getItem('__TEST_RUN_ID');
    if (fromStorage && TEST_RUN_ID_RE.test(fromStorage)) return fromStorage;
  } catch { /* localStorage unavailable */ }
  return undefined;
}

function emit(cat: LogCategory, type: string, data: Record<string, unknown>): void {
  if (!enabledCategories.has(cat)) return;

  const event: DevLogEvent = {
    ts: new Date().toISOString(),
    seq: sequence++,
    sid: sessionId,
    cat,
    type,
    route: currentRoute(),
    data,
  };

  const rid = getTestRunId();
  if (rid) event.testRunId = rid;

  eventBuffer.push(event);

  if (eventBuffer.length >= MAX_BATCH_SIZE) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
  }
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, MAX_BATCH_SIZE);

  // Fire-and-forget POST — don't use intercepted fetch
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/__dev/log', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ events: batch }));
  } catch {
    // Silent — logger must never crash the app
  }
}

// ── UI Events (clicks, inputs, focus, submit) ────────────────────────────────

function setupUIListeners(): void {
  // Click capture — event delegation on document
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (!target) return;

    // Find the nearest meaningful element (button, link, or the target itself)
    const meaningful = target.closest('button, a, [role=button], [role=tab], [role=menuitem], [data-testid]') || target;

    emit('ui', 'click', {
      element: getElementDescriptor(meaningful),
      tag: meaningful.tagName.toLowerCase(),
      testId: meaningful.getAttribute('data-testid') || undefined,
      x: e.clientX,
      y: e.clientY,
    });
  }, { capture: true, passive: true });

  // Input events — debounced, metadata only for sensitive fields
  const inputDebounceMap = new Map<Element, ReturnType<typeof setTimeout>>();

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Debounce per-element (300ms) to avoid log storms while typing
    const existing = inputDebounceMap.get(target);
    if (existing) clearTimeout(existing);

    inputDebounceMap.set(target, setTimeout(() => {
      inputDebounceMap.delete(target);

      const sensitive = isSensitiveField(target);
      const value = sensitive
        ? '[REDACTED]'
        : truncate(
            (target as HTMLInputElement).value || (target as HTMLTextAreaElement).value || '',
            MAX_INPUT_VALUE_LENGTH
          );

      emit('ui', 'input', {
        element: getElementDescriptor(target),
        field: (target as HTMLInputElement).name || target.id || target.getAttribute('aria-label') || 'unnamed',
        sensitive,
        length: ((target as HTMLInputElement).value || '').length,
        value: sensitive ? undefined : value,
      });
    }, 300));
  }, { capture: true, passive: true });

  // Form submit
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    emit('ui', 'submit', {
      element: getElementDescriptor(form),
      action: form.action ? redactUrl(form.action) : undefined,
      method: form.method,
      fieldCount: form.elements.length,
    });
  }, { capture: true, passive: true });

  // Focus tracking (only for inputs/textareas — not every element)
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      emit('ui', 'focus', {
        element: getElementDescriptor(target),
        field: target.name || target.id || target.getAttribute('aria-label') || 'unnamed',
      });
    }
  }, { capture: true, passive: true });

  // Keyboard shortcuts (Ctrl/Cmd + key only — not modifier-only presses)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey || e.altKey) &&
        !['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
      emit('ui', 'shortcut', {
        key: e.key,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      });
    }
  }, { capture: true, passive: true });
}

// ── Network (fetch interceptor) ──────────────────────────────────────────────

function setupNetworkInterceptor(): void {
  originalFetch = window.fetch;

  window.fetch = async function devLoggedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : String(input);

    // Skip logging our own log endpoint to avoid recursion
    if (url.includes('/__dev/log')) {
      return originalFetch.call(window, input, init);
    }

    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    const startTime = performance.now();

    emit('net', 'fetch:start', {
      method: method.toUpperCase(),
      url: redactUrl(url),
    });

    try {
      const response = await originalFetch.call(window, input, init);
      const duration = Math.round(performance.now() - startTime);

      emit('net', 'fetch:done', {
        method: method.toUpperCase(),
        url: redactUrl(url),
        status: response.status,
        statusText: response.statusText,
        duration,
        ok: response.ok,
      });

      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);

      emit('net', 'fetch:error', {
        method: method.toUpperCase(),
        url: redactUrl(url),
        error: err instanceof Error ? err.message : String(err),
        duration,
      });

      throw err;
    }
  };
}

// ── Console interceptor ──────────────────────────────────────────────────────

function setupConsoleInterceptor(): void {
  const levels: Array<'log' | 'warn' | 'error' | 'info' | 'debug'> = ['log', 'warn', 'error', 'info', 'debug'];

  for (const level of levels) {
    const orig = originalConsole[level] || console[level];
    console[level] = (...args: unknown[]) => {
      // Call the original first
      orig.apply(console, args);

      // Skip our own messages to avoid noise
      const first = args[0];
      if (typeof first === 'string' && first.includes('%c[devLogger]')) return;

      // Serialize args, but truncate large values
      const serialized = args.map(a => {
        if (a instanceof Error) return { message: a.message, stack: a.stack?.split('\n').slice(0, 3).join('\n') };
        if (typeof a === 'string') return truncate(a, 500);
        try { return truncate(JSON.stringify(a), 500); } catch { return String(a); }
      });

      emit('console', level, {
        args: serialized,
      });
    };
  }
}

// ── Error handlers ───────────────────────────────────────────────────────────

function setupErrorHandlers(): void {
  window.addEventListener('error', (e) => {
    emit('error', 'uncaught', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const stack = reason instanceof Error ? reason.stack ?? '' : '';
    // Suppress Vite HMR internal errors — they're transient WebSocket reconnection noise
    if (stack.includes('@vite/client') || stack.includes('vite/dist/client')) return;
    emit('error', 'unhandled-rejection', {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: stack.split('\n').slice(0, 5).join('\n') || undefined,
    });
  });
}

// ── Navigation (hash changes) ────────────────────────────────────────────────

function setupNavigationTracking(): void {
  lastRoute = currentRoute();
  lastRouteTime = performance.now();
  lastNavEmitTime = 0;

  emit('nav', 'initial', {
    route: lastRoute,
    referrer: document.referrer || undefined,
  });

  // Unified handler: both hashchange and popstate call this,
  // but we deduplicate within a 50ms window.
  function handleNavChange(source: 'hashchange' | 'popstate'): void {
    const newRoute = currentRoute();
    const now = performance.now();

    // Skip if same route or if we already emitted within 50ms (dedup)
    if (newRoute === lastRoute || (now - lastNavEmitTime) < 50) return;

    const dwellTime = Math.round(now - lastRouteTime);

    emit('nav', 'navigate', {
      from: lastRoute,
      to: newRoute,
      dwellTime,
      trigger: source,
    });

    lastRoute = newRoute;
    lastRouteTime = now;
    lastNavEmitTime = now;
  }

  window.addEventListener('hashchange', () => handleNavChange('hashchange'));
  window.addEventListener('popstate', () => handleNavChange('popstate'));
}

// ── Performance (long tasks, resource timing) ────────────────────────────────

function setupPerformanceTracking(): void {
  // Long task observer (>50ms)
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          emit('perf', 'long-task', {
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask not supported in all browsers
    }

    // Largest contentful paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          emit('perf', 'lcp', {
            renderTime: Math.round((last as any).renderTime || 0),
            loadTime: Math.round((last as any).loadTime || 0),
            size: (last as any).size,
            element: (last as any).element ? getElementDescriptor((last as any).element) : undefined,
          });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Not supported
    }
  }

  // Page load timing
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        emit('perf', 'page-load', {
          dns: Math.round(timing.domainLookupEnd - timing.domainLookupStart),
          connect: Math.round(timing.connectEnd - timing.connectStart),
          ttfb: Math.round(timing.responseStart - timing.requestStart),
          domReady: Math.round(timing.domContentLoadedEventEnd - timing.fetchStart),
          load: Math.round(timing.loadEventEnd - timing.fetchStart),
          domInteractive: Math.round(timing.domInteractive - timing.fetchStart),
        });
      }
    }, 100);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Manually log a state change (call from context providers or stores).
 * Logs action name and a shallow diff — never full state snapshots.
 */
export function logStateChange(store: string, action: string, diff?: Record<string, unknown>): void {
  if (!initialized) return;
  emit('state', 'change', {
    store,
    action,
    diff: diff ? Object.fromEntries(
      Object.entries(diff).map(([k, v]) => [k, typeof v === 'string' ? truncate(v, 100) : v])
    ) : undefined,
  });
}

/**
 * Log a custom event. Use for domain-specific telemetry.
 */
export function logCustom(cat: LogCategory, type: string, data: Record<string, unknown>): void {
  if (!initialized) return;
  emit(cat, type, data);
}

/**
 * Get the current session ID (useful for correlation in tests).
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Initialize the dev logger. Call once at app startup.
 * No-op in production builds.
 */
export function initDevLogger(): void {
  if (initialized) return;
  if (process.env.NODE_ENV !== 'development') return;

  sessionId = genSessionId();
  sequence = 0;
  initialized = true;

  // Parse category filter from URL: ?devlog=ui,net,error
  const params = new URLSearchParams(window.location.search);
  const devlogParam = params.get('devlog');
  if (devlogParam) {
    const requested = devlogParam.split(',').filter(c => ALL_CATEGORIES.includes(c as LogCategory)) as LogCategory[];
    if (requested.length > 0) {
      enabledCategories = new Set(requested);
    }
  }

  // Setup all listeners
  setupUIListeners();
  setupNetworkInterceptor();
  setupConsoleInterceptor();
  setupErrorHandlers();
  setupNavigationTracking();
  setupPerformanceTracking();

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flush();
  });

  // Announce startup (use original console to avoid recursion)
  originalConsole.log(
    '%c[devLogger]%c Session %c%s%c — categories: %s',
    'color: #6366f1; font-weight: bold',
    'color: inherit',
    'color: #6366f1',
    sessionId,
    'color: inherit',
    Array.from(enabledCategories).join(', ')
  );
}

/**
 * Restore original fetch/console. Useful for cleanup in tests.
 */
export function destroyDevLogger(): void {
  if (!initialized) return;
  flush();

  // Restore fetch
  if (originalFetch) window.fetch = originalFetch;

  // Restore console
  for (const [level, fn] of Object.entries(originalConsole)) {
    (console as any)[level] = fn;
  }

  initialized = false;
  originalConsole.log('%c[devLogger]%c Destroyed', 'color: #6366f1; font-weight: bold', 'color: inherit');
}
