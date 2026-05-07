import React, { useState, useRef, useEffect } from 'react';
import { CopilotButton, CopilotBadge, CopilotTextarea } from '../../../../components/ui';
import { DEXTER_CONFIG } from '../../../../config/dexterConfig';
import { useDexterRouterToken } from '../../../../auth/useDexterRouterToken';
import { useDexterChat, type DexterChatMessage } from '../../hooks/useDexterChat';

interface DexterWorkerChatTabProps {
  workerId: string;
  workerName: string;
}

function ChatMessageBubble({ message }: { message: DexterChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : message.errorDetail
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-white border border-neutral-200 text-neutral-800'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {message.errorDetail ? (
          <div className="mt-1 text-xs text-red-500">{message.errorDetail}</div>
        ) : null}
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-neutral-400'}`}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function ChatInner({ workerId, workerName }: DexterWorkerChatTabProps) {
  const getRouterToken = useDexterRouterToken();
  const { messages, sendMessage, isConnected, isStreaming, activeToolName, error } = useDexterChat({
    routerUrl: DEXTER_CONFIG.routerUrl,
    workerId,
    getAccessToken: getRouterToken,
  });

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] min-h-[400px] max-w-3xl">
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-3">
        <CopilotBadge color={isConnected ? 'success' : 'danger'} size="small">
          {isConnected ? 'Connected' : 'Disconnected'}
        </CopilotBadge>
        <span className="text-xs text-neutral-500">Chat with {workerName}</span>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-3">{error}</div>
      ) : null}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
            Send a message to start chatting with this worker.
          </div>
        ) : (
          messages.map(msg => <ChatMessageBubble key={msg.id} message={msg} />)
        )}
        {isStreaming && activeToolName ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="animate-pulse">Using tool: {activeToolName}...</span>
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="animate-pulse">Thinking...</span>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2 mt-3">
        <CopilotTextarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="flex-1 resize-none"
          disabled={!isConnected || isStreaming}
        />
        <CopilotButton
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={!isConnected || isStreaming || !input.trim()}
        >
          Send
        </CopilotButton>
      </div>
    </div>
  );
}

/**
 * Chat tab for testing a Dexter worker.
 * Uses a raw <textarea> for the input since this is an admin test tool,
 * not a production chat surface — keeps it lightweight.
 */
export function DexterWorkerChatTab({ workerId, workerName }: DexterWorkerChatTabProps) {
  return <ChatInner workerId={workerId} workerName={workerName} />;
}
