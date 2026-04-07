import { useMemo } from "react";
import { getAgentIconInfo } from "@/lib/agentIcons";
import { cn } from "@/lib/utils";

interface AgentIconProps {
  agent: { id: string; name?: string; purpose?: string; instructions?: string; description?: string };
  size?: number;
  className?: string;
}

export default function AgentIcon({ agent, size = 40, className }: AgentIconProps) {
  const { icon: Icon, gradient } = useMemo(
    () => getAgentIconInfo(agent),
    [agent.id, agent.name, agent.purpose, agent.instructions, agent.description],
  );
  const iconSize = Math.round(size * 0.5);
  const radius = Math.round(size * 0.25);

  return (
    <div
      className={cn("flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size, borderRadius: radius, background: gradient }}
    >
      <Icon className="text-white" style={{ width: iconSize, height: iconSize }} strokeWidth={1.75} />
    </div>
  );
}
