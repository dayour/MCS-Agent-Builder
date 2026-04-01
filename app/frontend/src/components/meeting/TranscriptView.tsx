/**
 * TranscriptView — Scrolling transcript with color-coded speakers.
 * Blue = Kim, Gray = Customer. Auto-scrolls only when user is near the bottom.
 */
import { useRef, useEffect, useCallback } from "react";
import { useMeetingStore } from "@/stores/meetingStore";

const SPEAKERS = {
  kim: { label: "You", className: "text-blue-500" },
  customer: { label: "Customer", className: "text-muted-foreground" },
} as const;

// Auto-scroll threshold — if user is within 80px of bottom, keep scrolling
const SCROLL_THRESHOLD = 80;

export function TranscriptView() {
  const transcript = useMeetingStore((s) => s.transcript);
  const phase = useMeetingStore((s) => s.phase);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  // Auto-scroll on new entries or last-entry text change, only if user hasn't scrolled up
  const lastEntry = transcript[transcript.length - 1];
  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript.length, lastEntry?.text]);

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
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-2">
        {transcript.map((entry, i) => {
          const speaker = SPEAKERS[entry.speaker] ?? SPEAKERS.customer;
          return (
            <div key={entry.id ?? i} className="flex gap-1.5 text-xs leading-relaxed">
              <span className={`font-medium shrink-0 text-[10px] uppercase ${speaker.className}`}>
                {speaker.label}
              </span>
              <span className="text-foreground flex-1 min-w-0">{entry.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
