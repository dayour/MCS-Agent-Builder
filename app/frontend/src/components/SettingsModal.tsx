import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotInput } from './ui/CopilotInput';
import { CopilotFilterPill } from './ui/CopilotFilterPill';
import { CopilotDropdown } from './ui/CopilotDropdown';
import { useAgent } from '../context/AgentContext';
import { COPILOT_TIER_OPTIONS } from '../config/endpointConfig';
import type { ModelTier } from '../config/endpointConfig';
import {
  WeatherSunny20Regular,
  WeatherMoon20Regular,
  TextDensityRegular,
  TextDensityFilled,
  BuildingMultiple20Regular,
} from '@fluentui/react-icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return 'A';
  const trimmed = name.trim();
  if (!trimmed) return 'A';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('');
}

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const OptionCard: React.FC<OptionCardProps> = ({ selected, onClick, icon, label }) => (
  <CopilotButton
    variant="card"
    checked={selected}
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2"
  >
    <span className="text-xl">{icon}</span>
    <span>{label}</span>
  </CopilotButton>
);

const PRESET_ENVS = ['Development', 'Test', 'Production'];

// ── Main component ─────────────────────────────────────────────────────────────

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { userName, setUserName, theme, setTheme, density, setDensity, environment, setEnvironment, isCopilotEndpoint, copilotTierModels, setCopilotTierModel } = useAgent();

  const [nameInput, setNameInput] = useState(userName || '');
  const [customEnv, setCustomEnv] = useState(() =>
    PRESET_ENVS.includes(environment) ? '' : environment
  );
  const [envSelection, setEnvSelection] = useState(() =>
    PRESET_ENVS.includes(environment) ? environment : 'custom'
  );
  const [localDensity, setLocalDensity] = useState(density);
  const [customEnvError, setCustomEnvError] = useState('');

  // Reset local state whenever the modal opens so Cancel always discards changes.
  useEffect(() => {
    if (isOpen) {
      setNameInput(userName || '');
      setCustomEnv(PRESET_ENVS.includes(environment) ? '' : environment);
      setEnvSelection(PRESET_ENVS.includes(environment) ? environment : 'custom');
      setLocalDensity(density);
      setCustomEnvError('');
    }
  }, [isOpen, userName, environment, density]);

  const handleSave = () => {
    const trimmed = nameInput.trim();
    setUserName(trimmed || null);

    let finalEnv: string;
    if (envSelection === 'custom') {
      const trimmedEnv = customEnv.trim();
      if (!trimmedEnv) {
        setCustomEnvError('Please enter a custom environment name or select a preset.');
        return;
      }
      finalEnv = trimmedEnv;
    } else {
      finalEnv = envSelection;
    }

    setEnvironment(finalEnv);
    setDensity(localDensity);
    onClose();
  };

  const handleEnvPreset = (preset: string) => {
    setEnvSelection(preset);
    setCustomEnv('');
    setCustomEnvError('');
  };

  const handleCustomEnvChange = (value: string) => {
    setCustomEnv(value);
    setEnvSelection('custom');
    if (value.trim()) setCustomEnvError('');
  };

  const initials = getInitials(nameInput || userName);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Settings</DialogTitle>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-7">

          {/* ── Profile ────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-body-2-strong text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-3">
              Profile
            </h3>
            <div className="flex items-center gap-4">
              {/* Avatar preview */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 flex items-center justify-center text-white text-lg font-semibold select-none">
                {initials}
              </div>
              {/* Name input */}
              <div className="flex-1">
                <CopilotInput
                  label="Display name"
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  size="md"
                />
              </div>
            </div>
          </section>

          {/* ── Appearance ─────────────────────────────────────────────── */}
          <section>
            <h3 className="text-body-2-strong text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-3">
              Appearance
            </h3>

            {/* Theme */}
            <p className="text-body-2 text-[hsl(var(--text-primary))] mb-2">Theme</p>
            <div className="flex gap-3 mb-4">
              <OptionCard
                selected={theme === 'light'}
                onClick={() => setTheme('light')}
                icon={<WeatherSunny20Regular />}
                label="Light"
              />
              <OptionCard
                selected={theme === 'dark'}
                onClick={() => setTheme('dark')}
                icon={<WeatherMoon20Regular />}
                label="Dark"
              />
            </div>

            {/* Density */}
            <p className="text-body-2 text-[hsl(var(--text-primary))] mb-2">Density</p>
            <div className="flex gap-3">
              <OptionCard
                selected={localDensity === 'comfortable'}
                onClick={() => setLocalDensity('comfortable')}
                icon={<TextDensityRegular />}
                label="Comfortable"
              />
              <OptionCard
                selected={localDensity === 'compact'}
                onClick={() => setLocalDensity('compact')}
                icon={<TextDensityFilled />}
                label="Compact"
              />
            </div>
          </section>

          {/* ── Environment ────────────────────────────────────────────── */}
          <section>
            <h3 className="text-body-2-strong text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-3">
              Environment
            </h3>
            <div className="flex items-center gap-2 text-body-2 text-[hsl(var(--text-subtle))] mb-3">
              <BuildingMultiple20Regular />
              <span>Power Platform environment</span>
            </div>
            <div className="flex gap-2 flex-wrap mb-3">
              {PRESET_ENVS.map(preset => (
                <CopilotFilterPill
                  key={preset}
                  label={preset}
                  active={envSelection === preset}
                  onClick={() => handleEnvPreset(preset)}
                  size="sm"
                />
              ))}
            </div>
            <CopilotInput
              type="text"
              value={customEnv}
              onChange={e => handleCustomEnvChange(e.target.value)}
              placeholder="Or enter a custom environment name…"
              size="md"
              error={customEnvError || undefined}
            />
          </section>

          {/* ── Model Provider ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-body-2-strong text-[hsl(var(--text-subtle))] uppercase tracking-wide mb-3">
              Model Provider
            </h3>

            <p className="text-body-2 text-[hsl(var(--text-primary))] mb-3">
              Endpoint: <span className="font-semibold capitalize">{process.env.REACT_APP_MODEL_ENDPOINT || 'copilot'}</span>
            </p>

            {/* Per-tier model dropdowns — visible when using Copilot endpoint */}
            {isCopilotEndpoint && (
              <div className="space-y-3 pl-1 border-l-2 border-[hsl(var(--border))] ml-3">
                {(['fast', 'balanced', 'capable'] as ModelTier[]).map(tier => (
                  <div key={tier} className="pl-3">
                    <p className="text-caption-1 text-[hsl(var(--text-subtle))] mb-1 capitalize">{tier} tier</p>
                    <CopilotDropdown
                      variant="dropdown"
                      size="sm"
                      value={copilotTierModels[tier]}
                      onChange={value => setCopilotTierModel(tier, value)}
                      options={COPILOT_TIER_OPTIONS[tier].map(opt => ({
                        value: opt.id,
                        label: opt.label,
                      }))}
                    />
                  </div>
                ))}
                <p className="pl-3 text-caption-1 text-[hsl(var(--text-subtle))] italic">
                  Requires GitHub Copilot CLI authenticated locally.
                </p>
              </div>
            )}

            {!isCopilotEndpoint && (
              <p className="text-caption-1 text-[hsl(var(--text-subtle))]">
                Set <code className="text-xs bg-[hsl(var(--muted))] px-1 rounded">REACT_APP_MODEL_ENDPOINT</code> in <code className="text-xs bg-[hsl(var(--muted))] px-1 rounded">.env</code> to change the model provider.
              </p>
            )}
          </section>

        </div>
      </DialogContent>

      <DialogFooter>
        <CopilotButton variant="secondary" onClick={onClose}>
          Cancel
        </CopilotButton>
        <CopilotButton variant="primary" onClick={handleSave}>
          Save
        </CopilotButton>
      </DialogFooter>
    </Dialog>
  );
};

export default SettingsModal;
