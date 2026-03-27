import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Describe your agent or answer the question...",
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    // Refocus after send
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end p-4 border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[44px] max-h-[160px] resize-none rounded-xl text-sm bg-muted/30 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30"
        rows={1}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="h-[44px] w-[44px] rounded-xl shrink-0"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
