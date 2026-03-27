import {
  Briefcase,
  UserCircle,
  Zap,
  Plug,
  Database,
  Shield,
  MessageSquare,
  Network,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useWizardStore, type WizardDraft } from "@/stores/wizardStore";

const PREVIEW_SECTIONS = [
  { key: "business", label: "Business Goals", icon: Briefcase },
  { key: "identity", label: "Agent Identity", icon: UserCircle },
  { key: "capabilities", label: "Capabilities", icon: Zap },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "knowledge", label: "Knowledge", icon: Database },
  { key: "boundaries", label: "Boundaries", icon: Shield },
  { key: "conversations", label: "Conversations", icon: MessageSquare },
  { key: "architecture", label: "Architecture", icon: Network },
] as const;

export default function BriefPreviewPanel() {
  const currentState = useWizardStore((s) => s.currentState);
  const { sections, draft } = currentState;

  const completed = Object.values(sections).filter((s) => s === "complete").length;
  const total = PREVIEW_SECTIONS.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40">
        <h2 className="text-sm font-semibold">Agent Brief</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {completed}/{total} sections captured
        </p>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {PREVIEW_SECTIONS.map(({ key, label, icon: Icon }) => {
          const status = sections[key] || "not_started";
          return (
            <PreviewSection
              key={key}
              sectionKey={key}
              label={label}
              icon={Icon}
              status={status}
              draft={draft}
            />
          );
        })}
      </div>

      {/* Readiness indicator */}
      <div className="px-4 py-3 border-t border-border/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Readiness
          </span>
          <span className="text-xs font-semibold">
            {Math.round((completed / total) * 100)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completed >= 4
                ? "bg-emerald-500"
                : completed >= 2
                  ? "bg-amber-500"
                  : "bg-muted-foreground/30"
            }`}
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
        {currentState.readyToSave && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            Ready to save and continue
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section accordion
// ---------------------------------------------------------------------------

function PreviewSection({
  sectionKey,
  label,
  icon: Icon,
  status,
  draft,
}: {
  sectionKey: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  draft: WizardDraft;
}) {
  const [open, setOpen] = useState(false);
  const hasData = status !== "not_started";

  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={() => hasData && setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
          hasData
            ? "hover:bg-muted/40 cursor-pointer"
            : "cursor-default opacity-50"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium truncate">{label}</span>
        <StatusDot status={status} />
        {hasData && (
          <ChevronRight
            className={`h-3 w-3 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        )}
      </button>
      {open && hasData && (
        <div className="px-4 pb-3 pl-10">
          <SectionContent sectionKey={sectionKey} draft={draft} />
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={`h-2 w-2 rounded-full shrink-0 ${
        status === "complete"
          ? "bg-emerald-500"
          : status === "in_progress"
            ? "bg-amber-500"
            : "bg-border"
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Section content renderers
// ---------------------------------------------------------------------------

function SectionContent({
  sectionKey,
  draft,
}: {
  sectionKey: string;
  draft: WizardDraft;
}) {
  switch (sectionKey) {
    case "business": {
      const d = draft.business;
      if (!d) return <EmptyNote />;
      return (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {d.useCase && <Field label="Use case" value={d.useCase} />}
          {d.problemStatement && (
            <Field label="Problem" value={d.problemStatement} />
          )}
          {d.challenges && d.challenges.length > 0 && (
            <Field label="Challenges" value={d.challenges.join(", ")} />
          )}
        </div>
      );
    }
    case "identity": {
      const d = draft.identity;
      if (!d) return <EmptyNote />;
      return (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {d.name && <Field label="Name" value={d.name} />}
          {d.description && <Field label="Description" value={d.description} />}
          {d.persona && <Field label="Persona" value={d.persona} />}
          {d.primaryUsers && <Field label="Users" value={d.primaryUsers} />}
        </div>
      );
    }
    case "capabilities": {
      const items = draft.capabilities;
      if (!items?.length) return <EmptyNote />;
      return (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {items.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5">
                {c.phase === "future" ? "○" : "●"}
              </span>
              <span>
                {c.name}
                {c.phase === "future" && (
                  <span className="ml-1 text-[10px] opacity-60">(future)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "integrations": {
      const items = draft.integrations;
      if (!items?.length) return <EmptyNote />;
      return (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>
              <span className="font-medium text-foreground/80">{item.name}</span>
              {item.purpose && <span> — {item.purpose}</span>}
            </li>
          ))}
        </ul>
      );
    }
    case "knowledge": {
      const items = draft.knowledge;
      if (!items?.length) return <EmptyNote />;
      return (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>
              <span className="font-medium text-foreground/80">{item.name}</span>
              {item.type && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({item.type})
                </span>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "boundaries": {
      const d = draft.boundaries;
      if (!d) return <EmptyNote />;
      const hasContent =
        (d.handle?.length || 0) +
          (d.decline?.length || 0) +
          (d.refuse?.length || 0) >
        0;
      if (!hasContent) return <EmptyNote />;
      return (
        <div className="space-y-2 text-xs text-muted-foreground">
          {d.handle && d.handle.length > 0 && (
            <div>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Handles:
              </span>{" "}
              {d.handle.join(", ")}
            </div>
          )}
          {d.decline && d.decline.length > 0 && (
            <div>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Declines:
              </span>{" "}
              {d.decline.map((x) => x.topic).join(", ")}
            </div>
          )}
          {d.refuse && d.refuse.length > 0 && (
            <div>
              <span className="font-medium text-red-600 dark:text-red-400">
                Refuses:
              </span>{" "}
              {d.refuse.map((x) => x.topic).join(", ")}
            </div>
          )}
        </div>
      );
    }
    case "conversations": {
      const items = draft.conversations;
      if (!items?.length) return <EmptyNote />;
      return (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>
              <span className="font-medium text-foreground/80">{item.name}</span>
              {item.triggerType && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({item.triggerType})
                </span>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "architecture": {
      const d = draft.architecture;
      if (!d) return <EmptyNote />;
      return (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {d.type && <Field label="Type" value={d.type} />}
          {d.channels && d.channels.length > 0 && (
            <Field label="Channels" value={d.channels.join(", ")} />
          )}
        </div>
      );
    }
    default:
      return <EmptyNote />;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-foreground/70">{label}:</span>{" "}
      {value}
    </div>
  );
}

function EmptyNote() {
  return (
    <p className="text-[10px] text-muted-foreground/50 italic">
      Not yet discussed
    </p>
  );
}
