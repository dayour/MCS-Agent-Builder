import type { WizardSuggestion } from "@/stores/wizardStore";
import { Lightbulb, SkipForward } from "lucide-react";

interface SuggestionChipsProps {
  suggestions: WizardSuggestion[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export default function SuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
}: SuggestionChipsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(s.value)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"}
            ${
              s.type === "skip"
                ? "bg-muted/40 text-muted-foreground border border-border/40 hover:bg-muted/60"
                : s.type === "example"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/15"
                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
            }`}
        >
          {s.type === "skip" ? (
            <SkipForward className="h-3 w-3" />
          ) : s.type === "example" ? (
            <Lightbulb className="h-3 w-3" />
          ) : null}
          {s.label}
        </button>
      ))}
    </div>
  );
}
