/**
 * PostMeetingSummary — Shows after meeting stops with stats and transcript.
 */
import { useMeetingStore } from "@/stores/meetingStore";

export function PostMeetingSummary() {
  const transcript = useMeetingStore((s) => s.transcript);
  const suggestions = useMeetingStore((s) => s.suggestions);
  const stats = useMeetingStore((s) => s.stats);
  const reset = useMeetingStore((s) => s.reset);

  const duration = stats?.session.durationMs
    ? Math.round(stats.session.durationMs / 60000)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meeting Summary</h2>
        <button
          onClick={() => reset()}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          New Meeting
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Duration" value={`${duration} min`} />
        <StatCard label="Transcript Lines" value={String(transcript.length)} />
        <StatCard label="Questions Detected" value={String(stats?.questions.questions ?? 0)} />
        <StatCard label="Suggestions Made" value={String(suggestions.length)} />
      </div>

      {stats?.answers && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Avg Response" value={`${(stats.answers.avgResponseMs / 1000).toFixed(1)}s`} />
          <StatCard label="Avg TTFT" value={`${stats.answers.avgTTFT.toFixed(0)}ms`} />
          <StatCard label="Total Cost" value={`$${stats.answers.totalCost.toFixed(4)}`} />
        </div>
      )}

      {/* Q&A pairs */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Questions & Answers</h3>
          {suggestions.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 space-y-1">
              <div className="text-xs text-muted-foreground">
                {s.detection.type === "question" ? "Question" : "Requirement"} ({(s.detection.confidence * 100).toFixed(0)}%)
              </div>
              <div className="text-sm font-medium">"{s.detection.text}"</div>
              <div className="text-sm text-muted-foreground">{s.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Full transcript */}
      {transcript.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Full Transcript</h3>
          <div className="border rounded-lg p-3 max-h-96 overflow-y-auto space-y-1">
            {transcript.map((entry, i) => (
              <div key={i} className="text-xs">
                <span className={`font-medium ${entry.speaker === "kim" ? "text-blue-500" : "text-muted-foreground"}`}>
                  {entry.speaker === "kim" ? "Kim" : "Customer"}:
                </span>{" "}
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
