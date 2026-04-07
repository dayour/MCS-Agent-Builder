/**
 * NavAgentList — Scrollable agent list inside the navigation rail.
 *
 * Shows agents from the current project with active indicators and status dots.
 */
import { useLocation, useNavigate } from "react-router";
import type { Agent } from "@/types";
import { cn } from "@/lib/utils";
import AgentIcon from "@/components/AgentIcon";

const statusDot: Record<string, string> = {
  draft: "bg-muted-foreground",
  researched: "bg-info",
  ready: "bg-warning",
  built: "bg-success",
};

interface NavAgentListProps {
  agents: Agent[];
  projectId: string;
  expanded: boolean;
}

export default function NavAgentList({ agents, projectId, expanded }: NavAgentListProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="overflow-y-auto overflow-x-hidden px-2 flex-1 min-h-0">
      <div className="flex flex-col gap-0.5">
        {agents.map((agent) => {
          const href = `/project/${projectId}/agent/${agent.id}`;
          const active = location.pathname === href;

          return (
            <button
              key={agent.id}
              onClick={() => navigate(href)}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                "hover:bg-[hsl(var(--nav-background-hover))]",
                active && "bg-[hsl(var(--brand-background))] text-primary font-medium",
                !active && "text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))]",
              )}
              title={expanded ? undefined : agent.name}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
              )}

              {/* Agent icon with status dot */}
              <span className="relative shrink-0">
                <AgentIcon agent={agent} size={20} />
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[hsl(var(--nav-background))]",
                    statusDot[agent.status] ?? statusDot.draft,
                  )}
                />
              </span>

              {/* Agent name (only when expanded) */}
              {expanded && (
                <span className="truncate">{agent.name}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
