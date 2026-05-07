import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings20Regular,
  Settings20Filled,
  Delete20Regular,
  Delete20Filled,
  MoreHorizontal20Regular,
  MoreHorizontal20Filled,
  Apps20Regular,
  Apps20Filled,
  PersonAdd20Regular,
  QuestionCircle20Regular,
  QuestionCircle20Filled,
  PuzzlePiece20Regular,
  PuzzlePiece20Filled,
  SignOut20Regular,
  PersonArrowRight20Regular,
  Checkmark16Regular,
  ArrowSync20Regular,
} from '@fluentui/react-icons';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import { CopilotMenu } from '../ui/CopilotMenu';
import { CopilotButton } from '../ui/CopilotButton';
import { iconContainerClass, textFadeIn, textFadeOut } from './NavConstants';

interface NavAccountRowProps {
  effectiveExpanded: boolean;
  navDisplayName: string;
  navInitials: string;
  onOpenApps: (pos: { bottom: number; left: number }) => void;
  appsOpen: boolean;
  onClearAllAgents: () => void;
  onOpenSettingsModal: () => void;
  credentials?: any;
  onCredentialsChange?: (creds: any) => void;
}

export const NavAccountRow: React.FC<NavAccountRowProps> = ({
  effectiveExpanded,
  navDisplayName,
  navInitials,
  onOpenApps,
  appsOpen,
  onClearAllAgents,
  onOpenSettingsModal,
  credentials,
  onCredentialsChange,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMenuPos, setSettingsMenuPos] = useState<{ bottom: number; left: number; maxHeight: number } | null>(null);
  const [accountFlyoutOpen, setAccountFlyoutOpen] = useState(false);
  const [accountFlyoutPos, setAccountFlyoutPos] = useState<{ bottom: number; left: number } | null>(null);

  const navigate = useNavigate();
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsNameRef = useRef<HTMLSpanElement>(null);
  const moreCollapsedBtnRef = useRef<HTMLButtonElement>(null);

  const azAccount = credentials?.azAccount;
  const tenantName = azAccount?.tenantName || azAccount?.tenantDomain || 'Local';
  const userEmail = azAccount?.user || '';
  const activeProfile = (credentials?.pacProfiles || []).find((p: any) => p.active);

  const settingsMenuItems = [
    {
      label: 'Settings',
      icon: <Settings20Regular />,
      iconFilled: <Settings20Filled />,
      onClick: () => { setSettingsOpen(false); onOpenSettingsModal(); },
    },
    {
      label: 'Help',
      icon: <QuestionCircle20Regular />,
      iconFilled: <QuestionCircle20Filled />,
      onClick: () => {},
    },
    {
      label: 'Components',
      icon: <PuzzlePiece20Regular />,
      iconFilled: <PuzzlePiece20Filled />,
      onClick: () => { setSettingsOpen(false); navigate('/components'); },
    },
    ...(!effectiveExpanded ? [{
      label: 'Apps',
      icon: <Apps20Regular />,
      iconFilled: <Apps20Filled />,
      onClick: () => {
        setSettingsOpen(false);
        if (moreCollapsedBtnRef.current) {
          const rect = moreCollapsedBtnRef.current.getBoundingClientRect();
          onOpenApps({ bottom: window.innerHeight - rect.bottom, left: rect.left + 56 });
        }
      },
    }] : []),
    {
      label: 'Clear all agents',
      icon: <Delete20Regular />,
      iconFilled: <Delete20Filled />,
      onClick: () => onClearAllAgents(),
      destructive: true,
    },
  ];

  return (
    <div ref={moreCollapsedBtnRef as any}>
      {/* Avatar opens account flyout; apps icon and ⋯ visible when expanded */}
      <div className="flex items-center w-[calc(100%-16px)] h-[48px] rounded-xl mb-1 mx-2 relative group overflow-visible">
        <CopilotTooltip content={navDisplayName} placement="right" disabled={effectiveExpanded || accountFlyoutOpen}>
          <button
            ref={settingsBtnRef}
            aria-label={`Account menu for ${navDisplayName}`}
            aria-expanded={accountFlyoutOpen}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setAccountFlyoutPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
              setAccountFlyoutOpen(v => !v);
            }}
            className={`flex items-center flex-1 min-w-0 h-full py-2 rounded-xl transition-colors ${accountFlyoutOpen ? 'bg-[hsl(var(--card))] shadow-[inset_0_0_0_1px_hsl(var(--border))]' : 'hover:bg-[hsl(var(--nav-background-hover))]'}`}
          >
            <div className={iconContainerClass}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold">
                {navInitials}
              </div>
            </div>
            <span ref={settingsNameRef} className={`text-xs font-medium whitespace-nowrap ${effectiveExpanded ? textFadeIn : textFadeOut}`}>
              {navDisplayName}
            </span>
          </button>
        </CopilotTooltip>

        {/* Apps */}
        <CopilotButton
          variant="icon"
          size="md"
          checked={appsOpen}
          icon={<Apps20Regular className="w-6 h-6" />}
          iconFilled={<Apps20Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenApps({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
          }}
          className={`transition-opacity ${appsOpen ? '!bg-[hsl(var(--card))] shadow-[inset_0_0_0_1px_hsl(var(--border))]' : ''} ${effectiveExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />

        {/* ⋯ settings menu */}
        <CopilotButton
          variant="icon"
          size="md"
          checked={settingsOpen}
          icon={<MoreHorizontal20Regular className="w-6 h-6" />}
          iconFilled={<MoreHorizontal20Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" />}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSettingsMenuPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8, maxHeight: rect.bottom - 16 });
            setSettingsOpen(v => !v);
          }}
          className={`transition-opacity ${settingsOpen ? '!bg-[hsl(var(--card))] shadow-[inset_0_0_0_1px_hsl(var(--border))]' : ''} ${effectiveExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      </div>

      {/* Settings menu */}
      {settingsOpen && settingsMenuPos && (
        <CopilotMenu
          items={settingsMenuItems}
          position={{ bottom: settingsMenuPos.bottom, left: settingsMenuPos.left, maxHeight: settingsMenuPos.maxHeight }}
          onClose={() => setSettingsOpen(false)}
          size="md"
          minWidth={200}
        />
      )}

      {/* Account flyout */}
      {accountFlyoutOpen && accountFlyoutPos && (
        <AccountFlyout
          position={accountFlyoutPos}
          onClose={() => setAccountFlyoutOpen(false)}
          navDisplayName={navDisplayName}
          navInitials={navInitials}
          tenantName={tenantName}
          userEmail={userEmail}
          initialCredentials={credentials}
          activeProfile={activeProfile}
          onCredentialsChange={onCredentialsChange}
        />
      )}
    </div>
  );
};

// ── Account Flyout — sign out, connections, add account ──────────────────

interface AccountFlyoutProps {
  position: { bottom: number; left: number };
  onClose: () => void;
  navDisplayName: string;
  navInitials: string;
  tenantName: string;
  userEmail: string;
  initialCredentials: any;
  activeProfile: any;
  onCredentialsChange?: (creds: any) => void;
}

const CONNECTION_TOOLS = [
  { key: 'az', label: 'Azure CLI', toolId: 'az' },
  { key: 'gh', label: 'GitHub Copilot', toolId: 'gh' },
  { key: 'pac', label: 'PAC CLI', toolId: 'pac' },
  { key: 'dataverse', label: 'Dataverse', toolId: 'dataverse' },
] as const;

function AccountFlyout({ position, onClose, navDisplayName, navInitials, tenantName, userEmail, initialCredentials, activeProfile, onCredentialsChange }: AccountFlyoutProps) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [creds, setCreds] = React.useState<any>(initialCredentials);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);

  // Derive statuses from live credentials
  const activeProf = (creds?.pacProfiles || []).find((p: any) => p.active);
  const statuses: Record<string, { ok: boolean; detail: string }> = {
    az: { ok: !!creds?.az, detail: creds?.details?.az || 'Not connected' },
    gh: { ok: !!creds?.gh, detail: creds?.details?.gh || 'Not connected' },
    pac: { ok: !!activeProf, detail: activeProf ? activeProf.user : 'Not configured' },
    dataverse: {
      ok: creds?.dataverse === true,
      detail: !creds?.az
        ? 'Requires Azure login first'
        : (creds?.details?.dataverse || 'Not checked'),
    },
  };
  const anyConnected = Object.values(statuses).some(s => s.ok);

  // Fetch fresh credentials — on open and after any auth action
  const refreshCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/readiness/credentials?force=1');
      const data = await resp.json();
      setCreds(data);
      onCredentialsChange?.(data);
    } catch { /* keep stale data */ }
    setLoading(false);
  }, [onCredentialsChange]);

  // Fetch fresh on mount (flyout open)
  React.useEffect(() => { refreshCredentials(); }, [refreshCredentials]);

  const handleConnect = async (toolId: string) => {
    setBusy(toolId);
    try {
      const resp = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolId }),
      });
      const data = await resp.json();
      if (data.ok) {
        await refreshCredentials();
      } else {
        // Update just this tool's status on failure
        setCreds((prev: any) => ({
          ...prev,
          details: { ...prev?.details, [toolId]: data.detail || 'Failed' },
        }));
      }
    } catch { /* ignore */ }
    setBusy(null);
  };

  const handleSignOut = async () => {
    if (!confirm('Sign out of all CLI tools?\n\nThis will clear: Azure CLI, GitHub, PAC CLI, and Dataverse tokens')) return;
    setBusy('signout');
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      localStorage.removeItem('userName');
      localStorage.removeItem('mcs-env');
      await refreshCredentials();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
    setBusy(null);
  };

  const handleSignIn = async (tool: string = 'all') => {
    setBusy('signin');
    try {
      const resp = await fetch('/api/auth/add-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool }),
      });
      await resp.json();
      await refreshCredentials();
    } catch (err) {
      console.error('Sign in failed:', err);
    }
    setBusy(null);
  };

  const handleSwitchProfile = async (profileIndex: number) => {
    setBusy('switch');
    try {
      await fetch('/api/auth/switch-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIndex }),
      });
      await refreshCredentials();
    } catch (err) {
      console.error('Switch profile failed:', err);
    }
    setBusy(null);
  };

  const pacProfiles: any[] = creds?.pacProfiles || [];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden flex flex-col"
        style={{ width: 360, maxHeight: 520, bottom: position.bottom, left: position.left, boxShadow: 'var(--shadow-dropdown)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
          <span className="text-xs font-medium text-[hsl(var(--text-subtle))]">{creds?.azAccount?.tenantName || creds?.azAccount?.tenantDomain || tenantName}</span>
          {anyConnected ? (
            <button
              onClick={handleSignOut}
              disabled={!!busy}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <SignOut20Regular className="w-3.5 h-3.5" />
              {busy === 'signout' ? 'Signing out...' : 'Sign out'}
            </button>
          ) : (
            <button
              onClick={() => handleSignIn('all')}
              disabled={!!busy}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <PersonArrowRight20Regular className="w-3.5 h-3.5" />
              {busy === 'signin' ? 'Signing in...' : 'Sign in'}
            </button>
          )}
        </div>

        {/* User info */}
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 flex items-center justify-center text-white text-base font-semibold">
            {navInitials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{navDisplayName}</p>
            <p className="text-xs text-[hsl(var(--text-subtle))] truncate mt-0.5">{creds?.azAccount?.user || userEmail || 'Not signed in'}</p>
            {activeProf && (
              <p className="text-[10px] text-[hsl(var(--text-disabled))] truncate mt-0.5">PAC: {activeProf.environment || activeProf.user}</p>
            )}
          </div>
          {/* Refresh button */}
          <button
            onClick={() => refreshCredentials()}
            disabled={loading || !!busy}
            className="p-1 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-subtle))] disabled:opacity-40 transition-colors"
            title="Refresh connection status"
          >
            <ArrowSync20Regular className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Connections */}
        <div className="border-t border-[hsl(var(--border))] px-4 py-3 overflow-y-auto flex-1">
          <div className="text-[11px] font-semibold text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-2">Connections</div>

          {loading && !creds ? (
            // Loading skeleton
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--border))] animate-pulse" />
                  <span className="h-3 w-20 bg-[hsl(var(--border))] rounded animate-pulse" />
                  <span className="h-3 flex-1 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {CONNECTION_TOOLS.map(tool => {
                const status = statuses[tool.key];
                const isConnected = status?.ok;
                const isBusy = busy === tool.toolId;
                const isDataverseDep = tool.key === 'dataverse' && !statuses.az.ok;
                return (
                  <button
                    key={tool.key}
                    disabled={!!busy || isDataverseDep}
                    onClick={() => !isConnected && !isDataverseDep ? handleConnect(tool.toolId) : undefined}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors w-full text-left ${
                      isConnected ? 'hover:bg-[hsl(var(--secondary-hover))] cursor-default'
                      : isDataverseDep ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-blue-50 cursor-pointer'
                    } disabled:opacity-60`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isBusy ? 'bg-yellow-400 animate-pulse' : isConnected ? 'bg-green-500' : 'bg-[hsl(var(--text-disabled))]'
                    }`} />
                    <span className="text-[hsl(var(--text-primary))] font-medium w-[88px]">{tool.label}</span>
                    <span className="text-[hsl(var(--text-disabled))] truncate flex-1">{isBusy ? 'Connecting...' : (status?.detail || 'Not checked')}</span>
                    {!isConnected && !isBusy && !isDataverseDep && (
                      <span className="text-blue-600 text-[10px] font-medium flex-shrink-0">Connect</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* PAC Profiles — show when more than 1 profile exists */}
          {pacProfiles.length > 1 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-2">PAC Profiles</div>
              <div className="flex flex-col gap-0.5">
                {pacProfiles.map((prof: any) => (
                  <button
                    key={prof.index}
                    disabled={!!busy || prof.active}
                    onClick={() => !prof.active && handleSwitchProfile(prof.index)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors w-full text-left ${
                      prof.active ? 'bg-blue-50 cursor-default' : 'hover:bg-[hsl(var(--secondary-hover))] cursor-pointer'
                    } disabled:opacity-70`}
                  >
                    {prof.active ? (
                      <Checkmark16Regular className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span className={`font-medium truncate ${prof.active ? 'text-blue-700' : 'text-[hsl(var(--text-primary))]'}`}>
                      {prof.user || `Profile ${prof.index}`}
                    </span>
                    {prof.environment && (
                      <span className="text-[hsl(var(--text-disabled))] truncate flex-1">{prof.environment}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add account */}
        <div className="border-t border-[hsl(var(--border))] relative">
          <button
            disabled={!!busy}
            onClick={() => setAddMenuOpen(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--secondary-hover))] disabled:opacity-50 transition-colors"
          >
            <PersonAdd20Regular className="w-5 h-5 text-[hsl(var(--text-subtle))] flex-shrink-0" />
            {busy === 'signin' ? 'Authenticating... (check browser)' : 'Add another account'}
          </button>

          {/* Add account picker */}
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-1 ml-2 z-50 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] py-1 min-w-[200px]"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {[
                  { tool: 'az', label: 'Azure CLI', desc: 'az login' },
                  { tool: 'gh', label: 'GitHub', desc: 'gh auth login' },
                  { tool: 'pac', label: 'PAC CLI', desc: 'New auth profile' },
                ].map(item => (
                  <button
                    key={item.tool}
                    onClick={() => { setAddMenuOpen(false); handleSignIn(item.tool); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[hsl(var(--secondary-hover))] transition-colors"
                  >
                    <span className="font-medium text-[hsl(var(--text-primary))]">{item.label}</span>
                    <span className="text-[hsl(var(--text-disabled))]">{item.desc}</span>
                  </button>
                ))}
                <div className="border-t border-[hsl(var(--border))] mt-1 pt-1">
                  <button
                    onClick={() => { setAddMenuOpen(false); handleSignIn('all'); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[hsl(var(--secondary-hover))] transition-colors"
                  >
                    <span className="font-medium text-[hsl(var(--text-primary))]">All tools</span>
                    <span className="text-[hsl(var(--text-disabled))]">Sign in to everything</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
