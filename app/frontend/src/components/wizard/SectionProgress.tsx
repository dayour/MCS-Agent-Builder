import {
  Briefcase,
  UserCircle,
  Zap,
  Plug,
  Database,
  Shield,
  MessageSquare,
  Network,
  Circle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { WizardSectionStatus } from "@/stores/wizardStore";

const SECTIONS = [
  { key: "business", label: "Business Goals", icon: Briefcase },
  { key: "identity", label: "Agent Identity", icon: UserCircle },
  { key: "capabilities", label: "Capabilities", icon: Zap },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "knowledge", label: "Knowledge", icon: Database },
  { key: "boundaries", label: "Boundaries", icon: Shield },
  { key: "conversations", label: "Conversations", icon: MessageSquare },
  { key: "architecture", label: "Architecture", icon: Network },
] as const;

interface SectionProgressProps {
  sections: Record<string, WizardSectionStatus>;
  activeSection: string | null;
}

export default function SectionProgress({
  sections,
  activeSection,
}: SectionProgressProps) {
  const completed = Object.values(sections).filter((s) => s === "complete").length;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Progress
        </span>
        <span className="text-xs text-muted-foreground">
          {completed}/{SECTIONS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mx-3 h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(completed / SECTIONS.length) * 100}%` }}
        />
      </div>

      {/* Section list */}
      <div className="pt-2 space-y-0.5">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const status = sections[key] || "not_started";
          const isActive = activeSection === key;

          return (
            <div
              key={key}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : status === "complete"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              <StatusIcon status={status} isActive={isActive} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  isActive,
}: {
  status: WizardSectionStatus;
  isActive: boolean;
}) {
  if (status === "complete") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
  if (isActive || status === "in_progress") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  }
  return <Circle className="h-3 w-3 text-border" />;
}
