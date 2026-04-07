import { ChevronDown, ChevronUp, Clock, Shield } from "lucide-react";
import { useState } from "react";
import type { ComparisonResult } from "@/lib/api";

interface ComparisonPanelProps {
  comparison: ComparisonResult;
}

const SEVERITY_COLORS = {
  info: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",
  warning: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30",
  conflict: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
} as const;

export default function ComparisonPanel({ comparison }: ComparisonPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!comparison || comparison.divergences.length === 0) return null;

  return (
    <div className="ml-9 mt-1 mb-2 text-xs border border-border rounded-lg overflow-hidden bg-card">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-medium text-muted-foreground">
          {comparison.divergences.length} difference{comparison.divergences.length !== 1 ? "s" : ""} found
          {" between "}
          <span className="text-foreground">{comparison.meta.primaryModel}</span>
          {" and "}
          <span className="text-foreground">{comparison.meta.secondaryModel}</span>
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border">
          {/* Divergences list */}
          <div className="divide-y divide-border">
            {comparison.divergences.map((d, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_COLORS[d.severity]}`}>
                    {d.severity}
                  </span>
                  <span className="font-mono text-muted-foreground">{d.aspect}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-muted/30 rounded px-2 py-1">
                    <span className="text-[10px] text-muted-foreground block">{comparison.meta.primaryModel}</span>
                    <span className="text-foreground">{d.primaryPosition}</span>
                  </div>
                  <div className="bg-muted/30 rounded px-2 py-1">
                    <span className="text-[10px] text-muted-foreground block">{comparison.meta.secondaryModel}</span>
                    <span className="text-foreground">{d.secondaryPosition}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer metadata */}
          <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {comparison.meta.primaryModel}: {comparison.meta.primaryLatencyMs ? `${(comparison.meta.primaryLatencyMs / 1000).toFixed(1)}s` : "n/a"}
              {" / "}
              {comparison.meta.secondaryModel}: {comparison.meta.secondaryLatencyMs ? `${(comparison.meta.secondaryLatencyMs / 1000).toFixed(1)}s` : "n/a"}
            </span>
            {comparison.safety.saferResponse !== "neither" && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Shield className="h-3 w-3" />
                {comparison.safety.saferResponse} was more cautious
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
