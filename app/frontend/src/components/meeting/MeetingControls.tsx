/**
 * MeetingControls — Start/stop, model selector, status indicators.
 * Designed for narrow right-panel layout — wraps vertically.
 */
import { useMeetingStore, type MeetingPhase } from "@/stores/meetingStore";

const MODEL_OPTIONS = [
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "haiku", label: "Haiku 4.5" },
  { value: "sonnet", label: "Sonnet 4.6" },
  { value: "opus", label: "Opus 4.6" },
];

const PHASE_LABELS: Record<MeetingPhase, string> = {
  idle: "Ready",
  preparing: "Loading context...",
  ready: "Ready to start",
  starting: "Connecting...",
  active: "Live",
  stopping: "Wrapping up...",
  stopped: "Ended",
  error: "Error",
};

interface MeetingControlsProps {
  projectId: string;
  agentName?: string;
}

export function MeetingControls({ projectId, agentName }: MeetingControlsProps) {
  const phase = useMeetingStore((s) => s.phase);
  const answerModel = useMeetingStore((s) => s.answerModel);
  const briefingTokens = useMeetingStore((s) => s.briefingTokens);
  const error = useMeetingStore((s) => s.error);
  const transcript = useMeetingStore((s) => s.transcript);
  const suggestions = useMeetingStore((s) => s.suggestions);
  const prepare = useMeetingStore((s) => s.prepare);
  const start = useMeetingStore((s) => s.start);
  const stop = useMeetingStore((s) => s.stop);
  const setModel = useMeetingStore((s) => s.setModel);
  const reset = useMeetingStore((s) => s.reset);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-card shrink-0">
      {/* Status dot + label */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            phase === "active"
              ? "bg-red-500 animate-pulse"
              : phase === "ready"
              ? "bg-green-500"
              : phase === "error"
              ? "bg-red-500"
              : "bg-muted-foreground/40"
          }`}
        />
        <span className="text-xs font-medium whitespace-nowrap">{PHASE_LABELS[phase]}</span>
      </div>

      {/* Stats (active only) */}
      {phase === "active" && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {transcript.length}L / {suggestions.length}S
        </span>
      )}

      {/* Token count (ready only) */}
      {phase === "ready" && briefingTokens && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {briefingTokens.toLocaleString()} tokens
        </span>
      )}

      <div className="flex-1" />

      {/* Model selector */}
      {(phase === "idle" || phase === "ready" || phase === "active") && (
        <select
          value={answerModel}
          onChange={(e) => setModel(e.target.value)}
          className="px-1.5 py-0.5 text-[10px] rounded border bg-background shrink-0"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      {/* Action button */}
      {phase === "idle" && (
        <button
          onClick={() => prepare(projectId, agentName)}
          className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
        >
          Prepare
        </button>
      )}
      {phase === "ready" && (
        <button
          onClick={() => start()}
          className="px-2.5 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
        >
          Start
        </button>
      )}
      {phase === "active" && (
        <button
          onClick={() => stop()}
          className="px-2.5 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
        >
          Stop
        </button>
      )}
      {(phase === "stopped" || phase === "error") && (
        <button
          onClick={() => reset()}
          className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 whitespace-nowrap"
        >
          New
        </button>
      )}

      {/* Error */}
      {error && (
        <span className="text-[10px] text-red-500 truncate basis-full" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
