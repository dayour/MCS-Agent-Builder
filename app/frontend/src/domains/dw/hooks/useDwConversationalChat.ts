/**
 * useDwConversationalChat.ts
 *
 * A wrapper around `useDexterChat` that post-processes completed assistant
 * messages to extract fenced `dw-action` blocks. Parsed actions are attached
 * as metadata on the message and dispatched to caller-provided callbacks so
 * the UI can react (e.g. update instructions, create skills/tasks).
 *
 * When `enabled` is false the hook passes through `useDexterChat` unchanged,
 * so callers can always render the same hook regardless of feature state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDexterChat, DexterChatMessage } from './useDexterChat';
import {
  parseDwActions,
  DwAction,
  DwInstructionsAction,
  DwSkillAction,
  DwTaskAction,
  DwTaskListAction,
} from '../utils/dwActionParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DwChatMessage extends DexterChatMessage {
  metadata?: {
    type: 'dw-instructions' | 'dw-skill' | 'dw-task' | 'dw-task-list';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
  };
}

interface UseDwConversationalChatOptions {
  routerUrl: string;
  workerId: string;
  userName?: string;
  provider?: 'claude' | 'copilot';
  model?: string;
  getAccessToken: () => Promise<string>;
  /** When false, the hook returns raw `useDexterChat` output with no post-processing. */
  enabled: boolean;
  // Side-effect callbacks
  onInstructionsUpdate?: (action: DwInstructionsAction) => void;
  onSkillCreated?: (action: DwSkillAction) => void;
  onTaskCreated?: (action: DwTaskAction) => void;
  onTaskListRequested?: (action: DwTaskListAction) => void;
}

interface UseDwConversationalChatReturn {
  messages: DwChatMessage[];
  sendMessage: (text: string) => void;
  isConnected: boolean;
  isStreaming: boolean;
  activeToolName: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a `DwAction.type` to the metadata type string used on `DwChatMessage`. */
function metadataTypeFor(actionType: DwAction['type']): DwChatMessage['metadata'] extends undefined ? never : NonNullable<DwChatMessage['metadata']>['type'] {
  switch (actionType) {
    case 'update-instructions': return 'dw-instructions';
    case 'create-skill':        return 'dw-skill';
    case 'create-task':         return 'dw-task';
    case 'show-tasks':          return 'dw-task-list';
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDwConversationalChat(
  options: UseDwConversationalChatOptions,
): UseDwConversationalChatReturn {
  const {
    routerUrl,
    workerId,
    userName,
    provider,
    model,
    getAccessToken,
    enabled,
    onInstructionsUpdate,
    onSkillCreated,
    onTaskCreated,
    onTaskListRequested,
  } = options;

  // Upstream chat hook — always called (hooks cannot be conditional).
  const upstream = useDexterChat({
    routerUrl,
    workerId,
    userName,
    provider,
    model,
    getAccessToken,
  });

  // ----- Disabled path: pass-through -----
  // We still maintain state below even when disabled so hook call order is
  // stable. The early return only affects the *returned* value.

  // Processed messages (with cleaned text + metadata).
  const [processedMessages, setProcessedMessages] = useState<DwChatMessage[]>([]);

  // Track which message IDs we have already parsed so we never re-process.
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Track the previous streaming state to detect the falling edge.
  const prevStreamingRef = useRef(false);

  // Keep callback refs stable to avoid re-triggering effects when callers
  // pass new inline arrow functions.
  const onInstructionsUpdateRef = useRef(onInstructionsUpdate);
  onInstructionsUpdateRef.current = onInstructionsUpdate;
  const onSkillCreatedRef = useRef(onSkillCreated);
  onSkillCreatedRef.current = onSkillCreated;
  const onTaskCreatedRef = useRef(onTaskCreated);
  onTaskCreatedRef.current = onTaskCreated;
  const onTaskListRequestedRef = useRef(onTaskListRequested);
  onTaskListRequestedRef.current = onTaskListRequested;

  const dispatchAction = useCallback((action: DwAction) => {
    switch (action.type) {
      case 'update-instructions':
        onInstructionsUpdateRef.current?.(action);
        break;
      case 'create-skill':
        onSkillCreatedRef.current?.(action);
        break;
      case 'create-task':
        onTaskCreatedRef.current?.(action);
        break;
      case 'show-tasks':
        onTaskListRequestedRef.current?.(action);
        break;
    }
  }, []);

  // Main effect: watch for streaming completion and parse the last assistant message.
  useEffect(() => {
    if (!enabled) {
      prevStreamingRef.current = upstream.isStreaming;
      return;
    }

    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = upstream.isStreaming;

    // Detect the falling edge: streaming just stopped.
    const streamingJustStopped = wasStreaming && !upstream.isStreaming;

    if (streamingJustStopped && upstream.messages.length > 0) {
      const lastMsg = upstream.messages[upstream.messages.length - 1];

      if (
        lastMsg.role === 'assistant' &&
        !processedIdsRef.current.has(lastMsg.id)
      ) {
        processedIdsRef.current.add(lastMsg.id);

        const { cleanText, actions } = parseDwActions(lastMsg.content);

        // Fire side-effect callbacks for each action.
        for (const action of actions) {
          dispatchAction(action);
        }

        // Build processed message. If there are multiple actions we attach
        // the first one as metadata (the callbacks still fire for all).
        const firstAction = actions[0] ?? null;
        const processed: DwChatMessage = {
          ...lastMsg,
          content: cleanText,
          ...(firstAction
            ? {
                metadata: {
                  type: metadataTypeFor(firstAction.type),
                  payload: firstAction,
                },
              }
            : {}),
        };

        // Replace the last message in our processed list with the cleaned version.
        // All prior messages are carried forward from the upstream list, preserving
        // any previously-processed versions.
        setProcessedMessages((prev) => {
          const result: DwChatMessage[] = [];
          for (const msg of upstream.messages) {
            if (msg.id === lastMsg.id) {
              result.push(processed);
            } else if (processedIdsRef.current.has(msg.id)) {
              // Keep the previously-processed version if we have one.
              const existing = prev.find(p => p.id === msg.id);
              result.push(existing ?? (msg as DwChatMessage));
            } else {
              result.push(msg as DwChatMessage);
            }
          }
          return result;
        });

        return;
      }
    }

    // While streaming (or when no new message needs processing), sync the
    // processed list from upstream so new user/assistant messages appear in
    // real-time. Already-processed messages keep their cleaned content.
    setProcessedMessages(prev => {
      const prevById = new Map(prev.map(m => [m.id, m]));
      return upstream.messages.map(msg => {
        if (processedIdsRef.current.has(msg.id)) {
          return prevById.get(msg.id) ?? (msg as DwChatMessage);
        }
        return msg as DwChatMessage;
      });
    });
     
  }, [upstream.messages, upstream.isStreaming, enabled, dispatchAction]);

  // ----- Return -----

  if (!enabled) {
    return {
      messages: upstream.messages as DwChatMessage[],
      sendMessage: upstream.sendMessage,
      isConnected: upstream.isConnected,
      isStreaming: upstream.isStreaming,
      activeToolName: upstream.activeToolName,
      error: upstream.error,
    };
  }

  return {
    messages: processedMessages,
    sendMessage: upstream.sendMessage,
    isConnected: upstream.isConnected,
    isStreaming: upstream.isStreaming,
    activeToolName: upstream.activeToolName,
    error: upstream.error,
  };
}
