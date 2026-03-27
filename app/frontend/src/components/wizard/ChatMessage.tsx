import { marked } from "marked";
import { useMemo } from "react";
import { Bot, User, Loader2 } from "lucide-react";
import type { WizardMessage } from "@/stores/wizardStore";

marked.setOptions({ breaks: true, gfm: true });

interface ChatMessageProps {
  message: WizardMessage;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming;

  const html = useMemo(() => {
    if (isUser || !message.content) return "";
    const raw = marked.parse(message.content) as string;
    // Basic sanitization: strip script tags and event handlers
    return raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\son\w+\s*=/gi, " data-removed=");
  }, [message.content, isUser]);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 text-foreground rounded-tl-sm border border-border/40"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.content ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none [&>p:last-child]:mb-0 [&>p:first-child]:mt-0 [&>ul]:my-1 [&>ol]:my-1"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : isStreaming ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : null}
            {isStreaming && message.content && (
              <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
