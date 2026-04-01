/**
 * PostMeetingSummary — Shows AI-generated meeting recap after meeting stops.
 *
 * Displays: summary, key takeaways, next steps, action items, follow-up suggestions.
 * Q&A pairs from real-time detection shown in collapsible section.
 */
import { useState, useMemo } from "react";
import { marked } from "marked";
import { useMeetingStore } from "@/stores/meetingStore";

marked.setOptions({ breaks: true, gfm: true });

export function PostMeetingSummary() {
  const suggestions = useMeetingStore((s) => s.suggestions);
  const analysisReport = useMeetingStore((s) => s.analysisReport);
  const analysisLoading = useMeetingStore((s) => s.analysisLoading);
  const reset = useMeetingStore((s) => s.reset);
  const [qaExpanded, setQaExpanded] = useState(false);

  const reportHtml = useMemo(() => {
    if (!analysisReport) return "";
    return marked.parse(analysisReport) as string;
  }, [analysisReport]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meeting Recap</h2>
        <button
          onClick={() => reset()}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          New Meeting
        </button>
      </div>

      {/* AI-generated analysis */}
      {analysisLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <span className="animate-pulse">Analyzing meeting transcript...</span>
        </div>
      )}

      {reportHtml && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-table:text-xs"
          dangerouslySetInnerHTML={{ __html: reportHtml }}
        />
      )}

      {!analysisReport && !analysisLoading && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No analysis available for this meeting.
        </div>
      )}

      {/* Q&A pairs — collapsible */}
      {suggestions.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <button
            onClick={() => setQaExpanded(!qaExpanded)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="text-xs">{qaExpanded ? "\u25BC" : "\u25B6"}</span>
            Real-Time Q&A ({suggestions.length})
          </button>
          {qaExpanded && (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {s.detection.type === "question" ? "Question" : "Requirement"} ({(s.detection.confidence * 100).toFixed(0)}%)
                  </div>
                  <div className="text-sm font-medium">&ldquo;{s.detection.text}&rdquo;</div>
                  <div className="text-sm text-muted-foreground">{s.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
