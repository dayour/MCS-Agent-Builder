import React, { useState, useRef, useEffect } from 'react';
import { Search20Regular, Filter20Regular, Checkmark20Regular } from '@fluentui/react-icons';
import { CopilotInput } from '../ui/CopilotInput';
import { CopilotCheckbox } from '../ui/CopilotCheckbox';

interface PacEnvironment {
  active: boolean;
  name: string;
  id: string;
  url: string;
}

interface PacProfile {
  index: number;
  active: boolean;
  kind: string;
  name: string;
  user: string;
  cloud: string;
  type: string;
  environment: string;
  environmentUrl: string;
}

interface NavEnvPickerProps {
  isOpen: boolean;
  position: { bottom: number; left: number } | null;
  onClose: () => void;
  selectedEnvName: string;
  onSelectEnv: (name: string) => void;
  // MCS: real data from backend
  pacEnvironments?: PacEnvironment[];
  pacProfiles?: PacProfile[];
}

export const NavEnvPicker: React.FC<NavEnvPickerProps> = ({
  isOpen,
  position,
  onClose,
  selectedEnvName,
  onSelectEnv,
  pacEnvironments = [],
  pacProfiles = [],
}) => {
  const [envSearch, setEnvSearch] = useState('');
  const [envFilterOpen, setEnvFilterOpen] = useState(false);
  const [envFilterPos, setEnvFilterPos] = useState<{ top: number; left: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const envFilterBtnRef = useRef<HTMLButtonElement>(null);

  if (!isOpen || !position) return null;

  const filteredEnvs = pacEnvironments.filter(
    env => !envSearch || env.name.toLowerCase().includes(envSearch.toLowerCase())
  );

  const handleSelectEnv = async (env: PacEnvironment) => {
    if (env.name === selectedEnvName) { onClose(); return; }
    setSwitching(true);
    try {
      await fetch('/api/auth/switch-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentId: env.id, environmentUrl: env.url }),
      });
      onSelectEnv(env.name);
      localStorage.setItem('mcs-env', env.name);
      onClose();
    } catch (err) {
      console.error('[NavEnvPicker] Switch failed:', err);
    } finally {
      setSwitching(false);
    }
  };

  // Active profile info
  const activeProfile = pacProfiles.find(p => p.active);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-lg flex flex-col"
        style={{
          width: 360,
          bottom: position.bottom,
          left: position.left,
          maxHeight: '70vh',
          boxShadow: '0 8px 16px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
          padding: 16,
          gap: 12,
        }}
      >
        {/* Title */}
        <h2 className="text-base font-semibold text-gray-900 leading-snug flex-shrink-0">Switch environment</h2>

        {/* Active profile */}
        {activeProfile && (
          <div className="text-xs text-gray-500 -mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="truncate">{activeProfile.user} — {activeProfile.environment}</span>
          </div>
        )}

        {/* Search */}
        <div className="flex-shrink-0">
          <CopilotInput
            placeholder="Search environments"
            size="sm"
            contentBefore={<Search20Regular className="w-4 h-4 text-gray-500" />}
            value={envSearch}
            onChange={(e) => setEnvSearch(e.target.value)}
          />
        </div>

        {/* Environment list */}
        <div className="overflow-y-auto flex-1 flex flex-col gap-0.5" style={{ maxHeight: '50vh' }}>
          {filteredEnvs.length === 0 && (
            <div className="text-sm text-gray-400 px-3 py-4 text-center">
              {pacEnvironments.length === 0 ? 'No PAC profiles configured' : 'No matching environments'}
            </div>
          )}
          {filteredEnvs.map(env => (
            <button
              key={env.id}
              disabled={switching}
              className="flex items-center h-9 px-1 rounded hover:bg-gray-100 transition-colors w-full disabled:opacity-50"
              onClick={() => handleSelectEnv(env)}
            >
              <span className="w-5 flex-shrink-0 flex items-center justify-center">
                {env.active && <Checkmark20Regular className="w-4 h-4 text-gray-800" />}
              </span>
              <div className="flex flex-col items-start pl-1 min-w-0">
                <span className="text-sm text-gray-700 truncate">{env.name}</span>
                <span className="text-[10px] text-gray-400 truncate">{env.url}</span>
              </div>
            </button>
          ))}

          {/* PAC Profiles section */}
          {pacProfiles.length > 1 && (
            <>
              <div className="h-px bg-gray-100 my-2" />
              <div className="h-7 flex items-center px-3">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Profiles</span>
              </div>
              {pacProfiles.map(profile => (
                <button
                  key={profile.index}
                  disabled={switching}
                  className="flex items-center h-9 px-1 rounded hover:bg-gray-100 transition-colors w-full disabled:opacity-50"
                  onClick={async () => {
                    setSwitching(true);
                    try {
                      await fetch('/api/auth/switch-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ index: profile.index }),
                      });
                      onSelectEnv(profile.environment);
                      localStorage.setItem('mcs-env', profile.environment);
                      // Reload credentials to get new environment list
                      window.location.reload();
                    } catch (err) {
                      console.error('[NavEnvPicker] Profile switch failed:', err);
                    } finally {
                      setSwitching(false);
                    }
                  }}
                >
                  <span className="w-5 flex-shrink-0 flex items-center justify-center">
                    {profile.active && <Checkmark20Regular className="w-4 h-4 text-gray-800" />}
                  </span>
                  <div className="flex flex-col items-start pl-1 min-w-0">
                    <span className="text-sm text-gray-700 truncate">{profile.user}</span>
                    <span className="text-[10px] text-gray-400 truncate">{profile.environment}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
};
