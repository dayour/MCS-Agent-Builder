import type { AgentConfig } from '../types';

interface DwProfileLike {
  teamsChatUrl?: string | null;
}

/**
 * Open a 1:1 Teams chat with the given agent.
 * Priority: dwProfile.teamsChatUrl (auto-constructed from Entra IDs)
 *         → agentConfig.teamsChatUrl (manual override)
 *         → legacy fake Teams chat route
 *         → generic teams.microsoft.com
 */
export function openTeamsChat(dwProfile: DwProfileLike, agentConfig: AgentConfig): void {
  if (dwProfile.teamsChatUrl) {
    window.open(dwProfile.teamsChatUrl, '_blank');
  } else if (agentConfig.teamsChatUrl) {
    window.open(agentConfig.teamsChatUrl, '_blank');
  } else if (agentConfig.dexterWorkerId) {
    const params = new URLSearchParams();
    if (agentConfig.name) params.set('name', agentConfig.name);
    params.set('sysIcon', agentConfig.systemColorIcon || 'agents');
    if (agentConfig.agentType) params.set('agentType', agentConfig.agentType);
    if (agentConfig.iconKey) params.set('iconKey', agentConfig.iconKey);
    if (agentConfig.gradientKey) params.set('gradientKey', agentConfig.gradientKey);
    params.set('agentId', agentConfig.id);
    window.open(`#/teams-chat/${agentConfig.dexterWorkerId}?${params.toString()}`, '_blank');
  } else {
    window.open('https://teams.microsoft.com', '_blank');
  }
}
