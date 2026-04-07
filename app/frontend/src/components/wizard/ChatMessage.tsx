import { marked } from "marked";
import DOMPurify from "dompurify";
import { useMemo, useState } from "react";
import { Bot, User } from "lucide-react";
import type { WizardMessage } from "@/stores/wizardStore";
import type { ComparisonResult } from "@/lib/api";
import DualModelBadge from "./DualModelBadge";
import ComparisonPanel from "./ComparisonPanel";

marked.setOptions({ breaks: true, gfm: true });

interface ChatMessageProps {
  message: WizardMessage;
  comparison?: ComparisonResult | null;
  dualModelStatus?: "idle" | "running" | "complete" | "failed" | "disabled";
  isLatestAssistant?: boolean;
}

export default function ChatMessage({ message, comparison, dualModelStatus, isLatestAssistant }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming;
  const [showPanel, setShowPanel] = useState(false);

  const html = useMemo(() => {
    if (isUser || !message.content) return "";
    const raw = marked.parse(message.content) as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "code", "pre", "ul", "ol", "li", "a", "h3", "h4"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });
  }, [message.content, isUser]);

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} mb-4 animate-slide-up-fade`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary/15 text-primary"
            : "bg-[hsl(var(--brand-background))] text-primary"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={`relative max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.content ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_pre]:my-2 [&_ul]:my-1 [&_ol]:my-1 [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : isStreaming ? (
              <div className="flex gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:0.4s]" />
              </div>
            ) : null}
            {isStreaming && message.content && (
              <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
            )}
          </>
        )}
      </div>

      {/* Dual-model comparison (last assistant message only) */}
      {!isUser && isLatestAssistant && (
        <>
          <DualModelBadge
            comparison={comparison ?? null}
            status={dualModelStatus ?? "idle"}
            onClick={() => setShowPanel(!showPanel)}
          />
          {showPanel && comparison && (
            <ComparisonPanel comparison={comparison} />
          )}
        </>
      )}
    </div>
  );
}
