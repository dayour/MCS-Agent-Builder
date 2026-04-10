import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { useHelperStore } from "@/stores/helperStore";

export function HelperInput() {
  const phase = useHelperStore((s) => s.phase);
  const sendMessage = useHelperStore((s) => s.sendMessage);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = (phase === "ready" || phase === "streaming") && text.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    sendMessage(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px"; // max 4 lines (~96px)
  }, []);

  const disabled = phase !== "ready" && phase !== "streaming";

  return (
    <div className="flex items-end gap-1.5 px-3 py-2 border-t border-border/50 shrink-0">
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder={disabled ? "Initialize helper first..." : "Ask a question..."}
        className="flex-1 resize-none bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
