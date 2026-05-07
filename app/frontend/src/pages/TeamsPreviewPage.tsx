import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import { useDW } from '../domains/dw/context/DWContext';
import { useDexterAuthFetch } from '../auth/useDexterAuthFetch';
import { fetchDexterWorkerDetail, type DexterWorkerDetail } from '../domains/dw/services/dexterWorkerService';
import { TeamsShell } from './teams/TeamsShell';

function buildWelcomeMessage(name: string, role?: string, description?: string): string {
  const intro = `Hey! I'm ${name}`;
  if (role && description) return `${intro}, ${role}. ${description} — what can I help you with?`;
  if (role) return `${intro}, ${role}. What can I help you with today?`;
  if (description) return `${intro}. ${description} — what can I help you with?`;
  return `${intro}. What can I help you with today?`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function TeamsPreviewInner() {
  const { workerId } = useParams<{ workerId: string }>();
  const location = useLocation();
  const { agents } = useAgent();
  const authFetch = useDexterAuthFetch();
  const [worker, setWorker] = useState<DexterWorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  // Read agent name and icon from URL search params (passed from admin portal)
  const searchParams = new URLSearchParams(location.search);
  const urlName = searchParams.get('name');
  const urlSysIcon = searchParams.get('sysIcon');
  const urlIconKey = searchParams.get('iconKey');
  const urlGradientKey = searchParams.get('gradientKey');
  const urlAgentId = searchParams.get('agentId');

  const loadWorker = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDexterWorkerDetail(authFetch, workerId);
      setWorker(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch worker');
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerId]);

  useEffect(() => { loadWorker(); }, [loadWorker]);

  const workerName = urlName || worker?.name || workerId || 'preview';

  // Set browser tab title and favicon to match real Teams
  useEffect(() => {
    const prevTitle = document.title;
    const prevFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prevHref = prevFavicon?.href;

    document.title = `Chat | ${workerName} | Microsoft Teams`;

    let favicon = prevFavicon;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = `${process.env.PUBLIC_URL}/component-icons/Teams16.svg`;

    return () => {
      document.title = prevTitle;
      if (prevHref && favicon) favicon.href = prevHref;
    };
  }, [workerName]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif", color: 'hsl(var(--text-secondary))' }}>
        Loading Teams preview...
      </div>
    );
  }

  const id = workerId || 'preview';
  const agentConfig = urlAgentId ? agents.find(a => a.id === urlAgentId) : undefined;

  const urlAgentType = searchParams.get('agentType');

  // Build a partial agent config for AgentIcon rendering
  const agentIconProps = {
    id: urlAgentId || id,
    name: workerName,
    agentType: (urlAgentType as 'DW' | undefined) || undefined,
    systemColorIcon: urlSysIcon || undefined,
    iconKey: urlIconKey || undefined,
    gradientKey: urlGradientKey || undefined,
  };

  return (
    <TeamsShell
      workerId={id}
      workerName={workerName}
      workerInitials={getInitials(workerName)}
      agentIconProps={agentIconProps}
      welcomeMessage={buildWelcomeMessage(workerName, agentConfig?.role, agentConfig?.description)}
    />
  );
}

/**
 * Standalone Teams chat preview page.
 * Access via /#/teams-chat/{workerId} — opens in a new tab.
 */
export function TeamsPreviewPage() {
  const { isDexter } = useDW();

  if (!isDexter) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ background: '#FEF7E0', border: '1px solid #F5DEB3', borderRadius: 8, padding: '12px 20px', fontSize: 14, color: '#7A6200' }}>
          The Dexter feature toggle is off. Enable it in the Feature Toggles panel to use this page.
        </div>
      </div>
    );
  }

  return <TeamsPreviewInner />;
}
