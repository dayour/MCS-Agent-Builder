import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Square } from "lucide-react";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onCancel?: () => void;
  placeholder?: string;
}

export default function ChatComposer({
  onSend,
  disabled = false,
  streaming = false,
  onCancel,
  placeholder = "Describe your agent or answer the question...",
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled || streaming) return;
    onSend(text);
    setValue("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [value, disabled, streaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="p-3 border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="relative flex items-end rounded-xl border border-border/60 bg-card shadow-[var(--shadow-input-val)] focus-within:border-primary/40 focus-within:shadow-[var(--shadow-input-focus-val)] transition-all">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent text-sm pl-3.5 pr-12 py-3 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
          rows={1}
        />
        <div className="absolute right-2 bottom-2">
          {streaming ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              aria-label="Stop generating"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || !hasText}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                hasText && !disabled
                  ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
