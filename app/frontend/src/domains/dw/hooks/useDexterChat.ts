import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface DexterChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  errorDetail?: string;
}

interface UseDexterChatOptions {
  /** Router base URL (http://...) — converted to ws:// */
  routerUrl: string;
  /** Worker ID — used as query param for routing */
  workerId: string;
  /** Display name for the user */
  userName?: string;
  /** AI provider */
  provider?: 'claude' | 'copilot';
  /** Model ID */
  model?: string;
  /** Acquires a JWT for the router. Called before each WS connection. */
  getAccessToken: () => Promise<string>;
}

interface UseDexterChatReturn {
  messages: DexterChatMessage[];
  sendMessage: (text: string) => void;
  isConnected: boolean;
  isStreaming: boolean;
  activeToolName: string | null;
  error: string | null;
}

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * WebSocket chat hook for talking to a Dexter worker via the router.
 * Ported from DexterFrontend's useWebSocketChat — simplified for admin testing.
 */
export function useDexterChat({
  routerUrl,
  workerId,
  userName = 'Elevate User',
  provider = 'claude',
  model,
  getAccessToken,
}: UseDexterChatOptions): UseDexterChatReturn {
  const [messages, setMessages] = useState<DexterChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  const conversationId = useMemo(() => crypto.randomUUID(), []);

  // Build WebSocket URL
  const wsUrl = useMemo(() => {
    const base = routerUrl.replace(/\/$/, '').replace(/^http/, 'ws');
    return `${base}/ws/dexter-studio?workerId=${encodeURIComponent(workerId)}`;
  }, [routerUrl, workerId]);

  const connectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError('Unable to connect after multiple attempts. Please reload the page.');
      return;
    }
    const delay = Math.min(
      BASE_RECONNECT_DELAY * 2 ** reconnectAttemptRef.current,
      MAX_RECONNECT_DELAY,
    );
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
  }, []);

  const handleIncomingActivity = useCallback((activity: any) => {
    const channelData = activity.channelData || {};
    const eventType = channelData.eventType;
    const requestId = channelData.requestId;

    if (currentRequestIdRef.current && requestId !== currentRequestIdRef.current) return;

    switch (eventType) {
      case 'text': {
        const text = activity.text || '';
        const assistantId = currentAssistantIdRef.current;
        if (assistantId) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId ? { ...msg, content: msg.content + text } : msg,
          ));
        } else {
          const newId = `assistant-${Date.now()}`;
          currentAssistantIdRef.current = newId;
          setMessages(prev => [...prev, { id: newId, role: 'assistant', content: text, timestamp: new Date() }]);
        }
        setActiveToolName(null);
        break;
      }
      case 'tool':
        setActiveToolName(channelData.toolName || 'Tool');
        break;
      case 'toolInvocation':
        setActiveToolName(channelData.toolName || 'Tool');
        break;
      case 'thinking':
        // Could show thinking indicator — for now just keep streaming state
        break;
      case 'reasoning':
        // Extended thinking step — skip for admin chat
        break;
      case 'result':
        setIsStreaming(false);
        setActiveToolName(null);
        currentAssistantIdRef.current = null;
        currentRequestIdRef.current = null;
        break;
      case 'error': {
        const detail = activity.text || 'An error occurred';
        console.error('[DexterChat] Error activity received:', detail, activity);
        const errorEntry: DexterChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong.',
          timestamp: new Date(),
          errorDetail: detail,
        };
        setMessages(prev => [...prev, errorEntry]);
        setIsStreaming(false);
        setActiveToolName(null);
        currentAssistantIdRef.current = null;
        currentRequestIdRef.current = null;
        break;
      }
    }
  }, []);

  const connect = useCallback(() => {
    // Don't connect if no workerId — allows callers to always invoke the hook
    // with an empty string when the feature is inactive.
    if (!workerId) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    getAccessToken()
      .then(token => {
        // WebSocket doesn't support Authorization headers, so the token is passed as a
        // query parameter. This is a known tradeoff — the router URL must always use TLS
        // (wss://) in production to prevent token leakage in network logs.
        const separator = wsUrl.includes('?') ? '&' : '?';
        const ws = new WebSocket(`${wsUrl}${separator}access_token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          isConnectedRef.current = true;
          setIsConnected(true);
          setError(null);
          reconnectAttemptRef.current = 0;
        };

        ws.onclose = (event) => {
          const wasConnected = isConnectedRef.current;
          isConnectedRef.current = false;
          setIsConnected(false);
          wsRef.current = null;
          if (event.code === 1006 && !wasConnected) {
            setError('WebSocket connection rejected — your session may have expired. Please reload the page.');
            return;
          }
          scheduleReconnect();
        };

        ws.onerror = () => {
          setError('WebSocket connection error');
        };

        ws.onmessage = (event) => {
          try {
            handleIncomingActivity(JSON.parse(event.data));
          } catch {
            // Ignore non-JSON
          }
        };
      })
      .catch((err) => {
        setError(`Auth failed: ${err instanceof Error ? err.message : String(err)}`);
        scheduleReconnect();
      });
  }, [wsUrl, getAccessToken, scheduleReconnect, handleIncomingActivity]);

  connectRef.current = connect;

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    if (!text.trim()) return;

    const requestId = crypto.randomUUID();
    currentRequestIdRef.current = requestId;
    currentAssistantIdRef.current = null;

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }]);
    setIsStreaming(true);
    setError(null);

    const activity = {
      type: 'message',
      text: text.trim(),
      relatesTo: {
        channelId: 'dexter-studio',
        conversation: { id: conversationId },
        user: { id: conversationId, name: userName },
      },
      channelData: {
        requestId,
        permissionMode: 'acceptEdits',
        provider,
        model,
        sessionKey: conversationId,
      },
    };

    wsRef.current.send(JSON.stringify(activity));
  }, [conversationId, userName, provider, model]);

  // connect depends on wsUrl, getAccessToken, scheduleReconnect, handleIncomingActivity.
  // getAccessToken must be a stable ref (useDexterRouterToken uses useCallback([], []))
  // to prevent reconnect loops on every render.
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { messages, sendMessage, isConnected, isStreaming, activeToolName, error };
}
