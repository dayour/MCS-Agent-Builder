import { Bot } from "lucide-react";

interface CardDesign {
  header: string;
  body: Array<{
    type: string;
    label?: string;
    facts?: Array<{ title: string; value: string }>;
  }>;
  actions: Array<{
    type: string;
    title: string;
    data?: string;
  }>;
}

interface Props {
  cardDesign: CardDesign;
  agentName?: string;
}

const AdaptiveCardPreview = ({ cardDesign, agentName }: Props) => {
  return (
    <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white p-5 shadow-sm dark:from-blue-950/30 dark:to-card dark:border-blue-800">
      {/* Bot header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
          <Bot className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">{agentName || "Agent"}</span>
      </div>

      {/* Card header */}
      {cardDesign.header && (
        <p className="text-sm text-foreground mb-3">{cardDesign.header}</p>
      )}

      {/* Body sections */}
      {cardDesign.body.map((section, i) => (
        <div key={i} className="mb-3">
          {section.label && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              {section.label}
            </p>
          )}
          {section.type === "FactSet" && section.facts && (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {section.facts.map((fact, j) => (
                <div key={j} className="contents">
                  <span className="text-xs font-medium text-foreground">{fact.title}</span>
                  <span className="text-xs text-muted-foreground">{fact.value}</span>
                </div>
              ))}
            </div>
          )}
          {section.type === "TextBlock" && section.label && (
            <p className="text-xs text-muted-foreground">{section.label}</p>
          )}
        </div>
      ))}

      {/* Actions */}
      {cardDesign.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-blue-100 dark:border-blue-800/50">
          {cardDesign.actions.map((action, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              {action.title}
            </span>
          ))}
        </div>
      )}

      {/* Footer label */}
      <p className="text-[10px] text-muted-foreground/60 mt-3 text-right">
        Adaptive Card &middot; Conversation Start
      </p>
    </div>
  );
};

export default AdaptiveCardPreview;
