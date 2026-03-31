/**
 * MeetingPanel — Main container for the real-time meeting co-pilot.
 *
 * Vertical split layout (fits right-side panel):
 * 1. Controls (top strip) — prepare/start/stop, model selector, status
 * 2. Transcript (upper section) — scrolling color-coded transcript
 * 3. Suggestions (lower section) — streaming answer cards
 */
import { useMeetingStore } from "@/stores/meetingStore";
import { TranscriptView } from "./TranscriptView";
import { SuggestionsList } from "./SuggestionsList";
import { MeetingControls } from "./MeetingControls";
import { PostMeetingSummary } from "./PostMeetingSummary";

interface MeetingPanelProps {
  projectId: string;
  agentName?: string;
}

export function MeetingPanel({ projectId, agentName }: MeetingPanelProps) {
  const phase = useMeetingStore((s) => s.phase);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Controls bar */}
      <MeetingControls projectId={projectId} agentName={agentName} />

      {/* Main content area — vertical split */}
      {phase === "stopped" ? (
        <div className="flex-1 overflow-y-auto">
          <PostMeetingSummary />
        </div>
      ) : (
        <div className="flex flex-col flex-1 gap-2 min-h-0">
          {/* Transcript (top, 55%) */}
          <div className="flex-[55] min-h-0 overflow-hidden">
            <TranscriptView />
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50 shrink-0" />

          {/* Suggestions (bottom, 45%) */}
          <div className="flex-[45] min-h-0 overflow-hidden">
            <SuggestionsList />
          </div>
        </div>
      )}
    </div>
  );
}
