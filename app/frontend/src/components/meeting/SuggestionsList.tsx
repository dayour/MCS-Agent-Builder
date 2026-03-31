/**
 * SuggestionsList — Stacked answer cards, most recent on top.
 */
import { useMeetingStore } from "@/stores/meetingStore";
import { SuggestionCard } from "./SuggestionCard";

export function SuggestionsList() {
  const suggestions = useMeetingStore((s) => s.suggestions);
  const dismissedIds = useMeetingStore((s) => s.dismissedIds);
  const phase = useMeetingStore((s) => s.phase);

  const visible = suggestions.filter((s) => !dismissedIds.has(s.id));

  if (visible.length === 0) {
    return (
      <div className="h-full flex items-center justify-center border rounded-lg bg-card">
        <div className="text-center text-muted-foreground">
          {phase === "active" ? (
            <>
              <div className="text-lg mb-1">Suggestions</div>
              <div className="text-xs">Answers will appear here when questions are detected</div>
            </>
          ) : (
            <>
              <div className="text-lg mb-1">AI Suggestions</div>
              <div className="text-xs">Real-time answer suggestions during the meeting</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card">
      <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
        Suggestions ({visible.length})
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visible.map((answer) => (
          <SuggestionCard key={answer.id} answer={answer} />
        ))}
      </div>
    </div>
  );
}
