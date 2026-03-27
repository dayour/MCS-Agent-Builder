import { useRef, useEffect } from "react";
import { useWizardStore } from "@/stores/wizardStore";
import ChatMessage from "./ChatMessage";
import ChatComposer from "./ChatComposer";
import SuggestionChips from "./SuggestionChips";

export default function ChatPanel() {
  const messages = useWizardStore((s) => s.messages);
  const phase = useWizardStore((s) => s.phase);
  const currentState = useWizardStore((s) => s.currentState);
  const sendMessage = useWizardStore((s) => s.sendMessage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = phase === "streaming";

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, messages[messages.length - 1]?.content]);

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  const handleChipSelect = (value: string) => {
    sendMessage(value);
  };

  // Show suggestions only from the last assistant message, and only when not streaming
  const lastAssistantState =
    !isStreaming && currentState.suggestions.length > 0
      ? currentState
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-2 scroll-smooth"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
      </div>

      {/* Suggestion chips */}
      {lastAssistantState && (
        <SuggestionChips
          suggestions={lastAssistantState.suggestions}
          onSelect={handleChipSelect}
          disabled={isStreaming}
        />
      )}

      {/* Composer */}
      <ChatComposer onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-2xl">&#x2728;</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Let's create your agent</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Tell me what you'd like your agent to do, and I'll guide you through the
        rest. No technical knowledge needed.
      </p>
    </div>
  );
}
