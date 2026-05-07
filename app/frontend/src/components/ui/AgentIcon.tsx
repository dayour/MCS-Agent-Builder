import React from 'react';
import { SquircleIcon } from './SquircleIcon';
import { AgentConfig } from '../../types';
import {
  detectAgentDomain,
  getAgentIcon,
  getUniqueGradientCSS,
  getGradientByKey,
} from '../../utils/agentIcons';
import { useSharedDexterWorkerProfile } from '../../context/DexterWorkerProfileContext';
import { useAgent } from '../../context/AgentContext';

interface AgentIconProps {
  /** Agent config (or partial — needs id, agentType, iconKey, gradientKey, systemColorIcon, iconImageData) */
  agent: Pick<AgentConfig, 'id' | 'name'> & Partial<Pick<AgentConfig, 'type' | 'agentType' | 'iconKey' | 'gradientKey' | 'systemColorIcon' | 'iconImageData'>>;
  /** Rendered size in px */
  size: number;
  /** Optional className on the wrapper */
  className?: string;
  /** When true, DW icons render inside a white squircle with a light stroke */
  withSquircle?: boolean;
  /** When true, system color icons render inside a circular container with border */
  rounded?: boolean;
}

/**
 * Resolve the avatar URL for a DW agent.
 * Priority: iconImageData (custom upload) → Entra profile photo (no local icon) → null (SVG fallback).
 * When a systemColorIcon is set, we skip the Entra photo because the SVG is the authoritative
 * representation — the Entra photo is just a backend mirror that may be stale.
 */
function useDwAvatarUrl(agentId: string, agentType?: string, iconImageData?: string, systemColorIcon?: string): string | null {
  const dwProfile = useSharedDexterWorkerProfile();
  const { currentAgentId } = useAgent();

  if (agentType !== 'DW') return null;

  // If a system color icon is explicitly set, let the SVG fallback render it —
  // the circular container looks better than a rendered PNG
  if (systemColorIcon) return null;

  // Custom uploaded image — wins over Entra photo
  if (iconImageData) return iconImageData;

  // No local icon info — use Entra photo if available
  if (agentId === currentAgentId && dwProfile.photoUrl) return dwProfile.photoUrl;

  return null;
}

/**
 * Unified agent icon renderer.
 * - DW (AI Teammate) agents: Entra photo > custom upload > system color icon
 * - Regular agents: squircle with gradient + domain icon
 */
export const AgentIcon: React.FC<AgentIconProps> = ({ agent, size, className, withSquircle = false, rounded = false }) => {
  const avatarUrl = useDwAvatarUrl(agent.id, agent.agentType, agent.iconImageData ?? undefined, agent.systemColorIcon);

  // Photo / custom image avatar (circular)
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={agent.name}
        className={`rounded-full object-cover flex-shrink-0 border border-[hsl(var(--stroke-default))] ${className || ''}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // System color icon path — for DW agents or any agent with systemColorIcon set
  if (agent.systemColorIcon || agent.agentType === 'DW') {
    const iconKey = agent.systemColorIcon || 'briefcase';
    const imgSize = Math.round(size * 0.55);

    if (rounded) {
      return (
        <div
          className={`rounded-full border border-[hsl(var(--stroke-default))] flex items-center justify-center flex-shrink-0 ${className || ''}`}
          style={{ width: size, height: size, background: 'linear-gradient(138deg, hsl(var(--background)), hsl(var(--surface-secondary)))' }}
        >
          <img
            src={`/icons/system-color/${iconKey}.svg`}
            alt={agent.name}
            className="object-contain"
            style={{ width: imgSize, height: imgSize }}
          />
        </div>
      );
    }

    if (withSquircle) {
      const cornerRadius = Math.round(size * 0.25);
      return (
        <SquircleIcon size={size} cornerRadius={cornerRadius} gradient="linear-gradient(138deg, hsl(var(--background)), hsl(var(--surface-secondary)))" stroke="hsl(var(--stroke-default))" strokeWidth={1} className={className}>
          <img
            src={`/icons/system-color/${iconKey}.svg`}
            alt={agent.name}
            className="object-contain"
            style={{ width: imgSize, height: imgSize, display: 'block' }}
          />
        </SquircleIcon>
      );
    }

    return (
      <div className={`flex items-center justify-center overflow-hidden flex-shrink-0 ${className || ''}`} style={{ width: size, height: size }}>
        <img
          src={`/icons/system-color/${iconKey}.svg`}
          alt={agent.name}
          className="object-contain"
          style={{ width: size, height: size, maxWidth: size, maxHeight: size }}
        />
      </div>
    );
  }

  const iconKey = agent.iconKey || (agent.type === 'workflow' ? 'tpl:workflow' : detectAgentDomain(agent as AgentConfig));
  const gradientCSS = agent.gradientKey
    ? getGradientByKey(agent.gradientKey)
    : getUniqueGradientCSS(agent.id);
  const cornerRadius = Math.round(size * 0.25);
  const iconSize = Math.round(size * 0.6);

  return (
    <SquircleIcon size={size} cornerRadius={cornerRadius} gradient={gradientCSS} className={className}>
      {getAgentIcon(iconKey, iconSize)}
    </SquircleIcon>
  );
};
