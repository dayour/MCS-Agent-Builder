/**
 * TranscriptView — Scrolling transcript with color-coded speakers.
 * Blue = Kim, Gray = Customer. Auto-scrolls to latest entry.
 */
import { useRef, useEffect } from "react";
import { useMeetingStore } from "@/stores/meetingStore";

export function TranscriptView() {
  const transcript = useMeetingStore((s) => s.transcript);
  const phase = useMeetingStore((s) => s.phase);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="h-full flex items-center justify-center border rounded-lg bg-card">
        <div className="text-center text-muted-foreground">
          {phase === "active" ? (
            <>
              <div className="text-lg mb-1">Listening...</div>
              <div className="text-xs">Transcript will appear here when speech is detected</div>
            </>
          ) : (
            <>
              <div className="text-lg mb-1">Transcript</div>
              <div className="text-xs">Start a meeting to see the live transcript</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card">
      <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
        Live Transcript ({transcript.length} entries)
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {transcript.map((entry, i) => (
          <div key={i} className="flex gap-1.5 text-xs leading-relaxed">
            <span
              className={`font-medium shrink-0 text-[10px] uppercase ${
                entry.speaker === "kim" ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {entry.speaker === "kim" ? "Kim" : "Cust"}
            </span>
            <span className="text-foreground flex-1 min-w-0">{entry.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
