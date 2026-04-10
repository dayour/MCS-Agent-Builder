import { useRef, useEffect } from "react";
import { useHelperStore, type HelperMessage } from "@/stores/helperStore";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 80;

function MessageBubble({ msg }: { msg: HelperMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        {msg.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-text-bottom" />
        )}
        {!isUser && !msg.isStreaming && msg.content && (
          <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
            {msg.ttft != null && <span>TTFT {msg.ttft}ms</span>}
            {msg.totalMs != null && <span>{msg.totalMs}ms</span>}
            {msg.model && <span>{msg.model}</span>}
            {msg.cost != null && msg.cost > 0 && <span>${msg.cost.toFixed(4)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function HelperMessages() {
  const messages = useHelperStore((s) => s.messages);
  const phase = useHelperStore((s) => s.phase);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when near bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < SCROLL_THRESHOLD;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2 px-4">
        {phase === "ready" ? (
          <>
            <span className="text-base">Ask anything about this project</span>
            <span className="text-xs">MCS, Azure, agents, connectors, architecture...</span>
          </>
        ) : phase === "loading" ? (
          <span className="animate-pulse">Loading context...</span>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-3 py-2 space-y-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
