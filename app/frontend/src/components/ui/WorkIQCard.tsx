import React, { useState } from 'react';
import {
  WORK_IQ_MCP_SERVERS,
  WORK_IQ_SERVER_ICON,
  WORK_IQ_PILL_LABEL,
  WORK_IQ_BRAND_COLOR,
  WORK_IQ_BORDER_COLOR,
} from '../../utils/workIqUtils';
import { CopilotToggle } from './CopilotToggle';
import { CopilotButton } from './CopilotButton';

// ── Design tokens (Fluent 2 / M365) ───────────────────────────────────────────
const BORDER_COLOR = WORK_IQ_BORDER_COLOR;
const TITLE_COLOR  = WORK_IQ_BRAND_COLOR;
const BG_COLOR     = 'hsl(var(--background))';
const RADIUS       = '24px';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkIQCardProps {
  /** Subset of WORK_IQ_MCP_SERVERS that are currently enabled. */
  enabledServers: string[];
  /** Called when the user saves server changes from the manage panel. */
  onServersChange: (servers: string[]) => void;
  /**
   * Called when the user clicks "See added tools".
   * When provided, opens the canvas detail panel instead of the inline manage view.
   */
  onViewTools?: () => void;
}

const MAX_VISIBLE_PILLS = 4;
const TOTAL_SERVERS = WORK_IQ_MCP_SERVERS.length; // 9

// ── Sub-components ─────────────────────────────────────────────────────────────

const ServerPill: React.FC<{ name: string }> = ({ name }) => {
  const icon = WORK_IQ_SERVER_ICON[name];
  const label = WORK_IQ_PILL_LABEL[name] ?? name.replace(' MCP Server', ' MCP');
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs text-gray-700 whitespace-nowrap leading-none"
      style={{ border: `1px solid ${BORDER_COLOR}`, background: BG_COLOR }}
    >
      {icon && <img src={icon} alt="" aria-hidden className="w-3.5 h-3.5 flex-shrink-0" />}
      {label}
    </span>
  );
};

const ServerToggleRow: React.FC<{
  name: string;
  isOn: boolean;
  onChange: () => void;
}> = ({ name, isOn, onChange }) => {
  const icon = WORK_IQ_SERVER_ICON[name];
  return (
    <div className="flex items-center justify-between rounded-lg px-1 py-1.5 hover:bg-gray-50">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <img src={icon} alt="" aria-hidden className="w-4 h-4 flex-shrink-0" />}
        <span className="text-xs text-gray-800 truncate">{name}</span>
      </div>
      <CopilotToggle
        checked={isOn}
        onChange={() => onChange()}
        aria-label={`${isOn ? 'Disable' : 'Enable'} ${name}`}
        size="md"
      />
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const WorkIQCard: React.FC<WorkIQCardProps> = ({
  enabledServers,
  onServersChange,
  onViewTools,
}) => {
  const [isManaging, setIsManaging] = useState(false);
  const [draftServers, setDraftServers] = useState<string[]>(enabledServers);

  // Keep draft in sync when parent changes
  React.useEffect(() => {
    setDraftServers(enabledServers);
  }, [enabledServers]);

  const toggleDraft = (name: string) =>
    setDraftServers(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );

  const handleSave = () => {
    onServersChange(draftServers);
    setIsManaging(false);
  };

  const handleCancelManage = () => {
    setDraftServers(enabledServers);
    setIsManaging(false);
  };

  const handleSeeTools = () => {
    if (onViewTools) {
      onViewTools();
    } else {
      setDraftServers(enabledServers);
      setIsManaging(true);
    }
  };

  const visibleServers = enabledServers.slice(0, MAX_VISIBLE_PILLS);
  const overflowCount = Math.max(0, enabledServers.length - MAX_VISIBLE_PILLS);

  return (
    <div
      className="p-4 max-w-[400px]"
      style={{
        borderRadius: RADIUS,
        border: `1px solid ${BORDER_COLOR}`,
        background: BG_COLOR,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2">
        {/* Copilot filled color icon */}
        <img
          src="/copilot-color-icon.svg"
          alt="Work IQ"
          className="w-5 h-5 flex-shrink-0"
        />
        <span className="text-sm font-semibold" style={{ color: TITLE_COLOR }}>
          Work IQ enabled
        </span>
      </div>

      {/* ── Description ────────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-600 leading-relaxed mb-3">
        Your agent is ready to understand work context and respond while respecting
        user permissions. It will use these tools:
      </p>

      {/* ── Server pills (default view) ──────────────────────────────────── */}
      {!isManaging && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {enabledServers.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No servers enabled</span>
          ) : (
            <>
              {visibleServers.map(name => (
                <ServerPill key={name} name={name} />
              ))}
              {overflowCount > 0 && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-[5px] text-xs text-gray-500 leading-none"
                  style={{ border: `1px solid ${BORDER_COLOR}`, background: BG_COLOR }}
                >
                  +{overflowCount}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Inline manage panel (fallback when onViewTools is not provided) ── */}
      {isManaging && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-700">
              {draftServers.length} of {TOTAL_SERVERS} enabled
            </span>
          </div>
          <div className="space-y-0.5">
            {WORK_IQ_MCP_SERVERS.map(name => (
              <ServerToggleRow
                key={name}
                name={name}
                isOn={draftServers.includes(name)}
                onChange={() => toggleDraft(name)}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-[hsl(var(--stroke-default))]">
            <CopilotButton
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={handleSave}
            >
              Save changes
            </CopilotButton>
            <CopilotButton
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleCancelManage}
            >
              Cancel
            </CopilotButton>
          </div>
        </div>
      )}

      {/* ── Primary CTA: "See added tools" ──────────────────────────────────── */}
      {!isManaging && (
        <CopilotButton
          variant="primary"
          size="sm"
          className="w-full rounded-xl"
          onClick={handleSeeTools}
        >
          See added tools
        </CopilotButton>
      )}

      {/* ── Learn more link ─────────────────────────────────────────────────── */}
      {!isManaging && (
        <div className="text-center mt-2">
          <CopilotButton
            variant="ghost"
            size="sm"
            className="text-xs hover:underline"
            style={{ color: TITLE_COLOR }}
          >
            Learn what Work IQ does
          </CopilotButton>
        </div>
      )}
    </div>
  );
};
