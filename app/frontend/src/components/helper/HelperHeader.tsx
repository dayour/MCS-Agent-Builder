import { useHelperStore } from "@/stores/helperStore";
import { cn } from "@/lib/utils";

export function HelperHeader() {
  const phase = useHelperStore((s) => s.phase);
  const contextTokens = useHelperStore((s) => s.contextTokens);
  const model = useHelperStore((s) => s.model);
  const messages = useHelperStore((s) => s.messages);
  const close = useHelperStore((s) => s.close);

  const msgCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0">
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          phase === "ready" && "bg-emerald-500",
          phase === "streaming" && "bg-blue-500 animate-pulse",
          phase === "loading" && "bg-amber-500 animate-pulse",
          phase === "error" && "bg-red-500",
          phase === "idle" && "bg-muted-foreground"
        )}
      />
      <span className="text-xs font-medium text-foreground truncate">Helper</span>
      {contextTokens && (
        <span className="text-[10px] text-muted-foreground">
          {Math.round(contextTokens / 1000)}k ctx
        </span>
      )}
      <span className="text-[10px] text-muted-foreground">{model}</span>
      {msgCount > 0 && (
        <span className="text-[10px] text-muted-foreground">{msgCount} msg</span>
      )}
      <div className="flex-1" />
      {phase !== "idle" && (
        <button
          onClick={close}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      )}
    </div>
  );
}
