/**
 * SuggestionCard — Answer card with streaming text, metadata, and dismiss.
 */
import { useMeetingStore, type ActiveAnswer } from "@/stores/meetingStore";

interface SuggestionCardProps {
  answer: ActiveAnswer;
}

export function SuggestionCard({ answer }: SuggestionCardProps) {
  const dismiss = useMeetingStore((s) => s.dismissSuggestion);

  const typeLabel = answer.detection.type === "question" ? "Q" : "R";
  const typeBg = answer.detection.type === "question" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600";

  return (
    <div className="border rounded-lg bg-card p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBg}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-muted-foreground flex-1 truncate" title={answer.detection.text}>
          "{answer.detection.text}"
        </span>
        {answer.isStreaming && (
          <span className="text-[10px] text-blue-500 animate-pulse">streaming...</span>
        )}
        <button
          onClick={() => dismiss(answer.id)}
          className="text-muted-foreground/40 hover:text-muted-foreground text-xs"
          title="Dismiss"
        >
          x
        </button>
      </div>

      {/* Answer text */}
      <div className="text-sm text-foreground whitespace-pre-wrap">
        {answer.text}
        {answer.isStreaming && <span className="animate-pulse">|</span>}
      </div>

      {/* Metadata footer */}
      {!answer.isStreaming && answer.totalMs && (
        <div className="flex gap-3 text-[10px] text-muted-foreground/60">
          {answer.ttft && <span>TTFT: {answer.ttft}ms</span>}
          <span>Total: {(answer.totalMs / 1000).toFixed(1)}s</span>
          {answer.model && <span>Model: {answer.model}{answer.fallback ? ` (${answer.fallback})` : ""}</span>}
          {answer.cost != null && <span>Cost: ${answer.cost.toFixed(4)}</span>}
          <span>Confidence: {(answer.detection.confidence * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
