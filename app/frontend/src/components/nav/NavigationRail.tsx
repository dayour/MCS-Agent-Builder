/**
 * NavigationRail — Copilot Studio-style collapsible left sidebar.
 *
 * 64px (icons only) ↔ 240px (icons + labels). Persists state to localStorage.
 * Shows primary nav items + contextual agent list when inside a project.
 */
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  Home,
  FolderKanban,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Users,
  Compass,
} from "lucide-react";
import NavAgentList from "./NavAgentList";
import EnvironmentSelector from "./EnvironmentSelector";
import { useProjectStore } from "@/stores/projectStore";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nav-rail-expanded";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, expanded, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        "hover:bg-[hsl(var(--nav-background-hover))]",
        active && "bg-[hsl(var(--brand-background))] text-primary",
        !active && "text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))]",
      )}
      title={expanded ? undefined : label}
    >
      {/* Active indicator — purple left border */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
      )}
      <span className="shrink-0 w-5 h-5 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5">
        {icon}
      </span>
      {expanded && (
        <span className="truncate whitespace-nowrap">{label}</span>
      )}
    </button>
  );
}

export default function NavigationRail() {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "false"; }
    catch { return true; }
  });

  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ id?: string; projectId?: string }>();

  // Determine if we're inside a project context
  const projectId = params.projectId ?? params.id ?? null;
  const agents = useProjectStore((s) => s.agents);
  const currentProjectName = useProjectStore((s) => s.projectName);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(expanded)); }
    catch { /* noop */ }
  }, [expanded]);

  const isHome = location.pathname === "/";
  const isCreate = location.pathname === "/create";
  const isAgents = location.pathname === "/agents";
  const isDiscover = location.pathname === "/discover";
  const isProject = location.pathname.startsWith("/project");

  return (
    <nav
      className={cn(
        "shrink-0 flex flex-col h-full border-r border-[hsl(var(--nav-border))] bg-[hsl(var(--nav-background))]",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        !expanded && "cursor-pointer",
      )}
      style={{ width: expanded ? 240 : 64 }}
      onClick={(e) => {
        // Clicking blank space in collapsed rail expands it — skip if a button/link was the target
        if (!expanded && !(e.target as HTMLElement).closest("button, a")) {
          setExpanded(true);
        }
      }}
    >
      {/* Header — Logo only */}
      <div className={cn("shrink-0 flex items-center h-14 gap-2", expanded ? "px-3" : "justify-center px-2")}>
        <button
          onClick={() => navigate("/")}
          className={cn(
            "shrink-0 flex items-center rounded-lg p-1 hover:bg-[hsl(var(--nav-background-hover))] transition-colors",
            expanded && "gap-2.5"
          )}
          title="MCS Agent Builder"
        >
          <img src="/favicon.png" alt="" className="h-7 w-7" />
          {expanded && (
            <span className="text-sm font-semibold text-[hsl(var(--nav-text-primary))] truncate">
              Agent Builder
            </span>
          )}
        </button>
      </div>

      {/* Primary nav items */}
      <div className="flex flex-col gap-0.5 px-2 mt-1">
        <NavItem
          icon={<Home />}
          label="Home"
          href="/"
          active={isHome}
          expanded={expanded}
          onClick={() => navigate("/")}
        />
        <NavItem
          icon={<FolderKanban />}
          label="Projects"
          href="/"
          active={isProject && !location.pathname.includes("/agent/")}
          expanded={expanded}
          onClick={() => navigate("/")}
        />
        <NavItem
          icon={<Users />}
          label="All Agents"
          href="/agents"
          active={isAgents}
          expanded={expanded}
          onClick={() => navigate("/agents")}
        />
        <NavItem
          icon={<Compass />}
          label="Discover"
          href="/discover"
          active={isDiscover}
          expanded={expanded}
          onClick={() => navigate("/discover")}
        />
        <NavItem
          icon={<Sparkles />}
          label="Create with Wizard"
          href="/create"
          active={isCreate}
          expanded={expanded}
          onClick={() => navigate("/create")}
        />
      </div>

      {/* Contextual agent list when inside a project */}
      {projectId && agents.length > 0 && (
        <div className="flex flex-col mt-4 flex-1 min-h-0">
          {expanded && (
            <div className="px-4 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--nav-text-secondary))]">
                {currentProjectName || "Agents"}
              </span>
            </div>
          )}
          {!expanded && (
            <div className="flex justify-center mb-1.5">
              <Bot className="w-4 h-4 text-[hsl(var(--nav-text-secondary))]" />
            </div>
          )}
          <NavAgentList
            agents={agents}
            projectId={projectId}
            expanded={expanded}
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section — environment selector + collapse/expand toggle */}
      <div className="shrink-0 pb-3 flex flex-col gap-1">
        <EnvironmentSelector expanded={expanded} />
        {expanded ? (
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 mx-2 px-3 h-9 rounded-lg text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))] hover:bg-[hsl(var(--nav-background-hover))] transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
            <span className="text-xs">Collapse</span>
          </button>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center justify-center mx-2 h-9 rounded-lg text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))] hover:bg-[hsl(var(--nav-background-hover))] transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}
      </div>
    </nav>
  );
}
