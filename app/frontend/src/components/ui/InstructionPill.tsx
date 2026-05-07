import React from 'react';
import { Library16Filled, FlowSparkle16Filled, Warning16Filled, Person16Regular } from '@fluentui/react-icons';
import { CopilotTooltip } from './CopilotTooltip';
import { PillConfig } from '../../types';
import { CHANNEL_ICONS } from '../../utils/channelIcons';

export interface InstructionPillProps {
  config: PillConfig;
  isConfigured: boolean;
  onClick: () => void;
  isNarrowPreview?: boolean;
  /** Forwarded as data-edit-text for contentEditable cursor tracking */
  dataEditText?: string;
  /** Set to false on pill spans inside a contentEditable editor */
  contentEditable?: false;
}

// Returns an icon whose color inherits from the parent element via currentColor.
function getTypeIcon(type: PillConfig['type'], channel: string | undefined): React.ReactNode {
  if (channel) {
    const iconPath = CHANNEL_ICONS[channel.toLowerCase()];
    if (iconPath) {
      return <img src={iconPath} alt={channel} className="w-4 h-4 flex-shrink-0" style={{ display: 'block' }} />;
    }
  }
  switch (type) {
    case 'knowledge':
      return <Library16Filled className="flex-shrink-0 w-4 h-4" style={{ color: 'currentColor' }} />;
    case 'agent':
      return <Person16Regular className="flex-shrink-0 w-4 h-4" style={{ color: 'currentColor' }} />;
    case 'connector':
    case 'action':
    case 'trigger':
    default:
      return <FlowSparkle16Filled className="flex-shrink-0 w-4 h-4" style={{ color: 'currentColor' }} />;
  }
}

export const InstructionPill: React.FC<InstructionPillProps> = ({
  config,
  isConfigured,
  onClick,
  isNarrowPreview = false,
  dataEditText,
  contentEditable,
}) => {
  const isConnector = config.type === 'connector' || config.type === 'action';

  // Warning state only applies to connector/action pills
  const showWarning = isConnector && !isConfigured;

  const borderClass = showWarning
    ? 'border-amber-400 hover:bg-amber-50'
    : isConnector
      ? 'border-gray-300 hover:bg-gray-50 cursor-pointer'
      : 'border-gray-300';

  // Use Tailwind color tokens — icons inherit via currentColor
  const textClass = showWarning ? 'text-amber-600' : 'text-brand-purple';

  const warningTooltipId = showWarning ? `pill-warning-${config.id}` : undefined;

  const pill = (
    <span
      role={isConnector ? 'button' : undefined}
      tabIndex={isConnector ? 0 : undefined}
      aria-label={isConnector ? `Configure ${config.label}` : undefined}
      aria-describedby={warningTooltipId}
      onClick={isConnector ? onClick : undefined}
      onKeyDown={isConnector ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      contentEditable={contentEditable}
      data-edit-text={dataEditText}
      className={`inline-flex items-center font-semibold border transition-all ${borderClass} ${textClass} ${
        isNarrowPreview ? 'gap-0.5 px-1.5 text-[11px]' : 'gap-1 px-3'
      }`}
      style={{
        borderRadius: isNarrowPreview ? '12px' : '20px',
        fontSize: isNarrowPreview ? '11px' : '13px',
        paddingTop: isNarrowPreview ? '0' : '1.5px',
        paddingBottom: isNarrowPreview ? '0' : '1.5px',
      }}
    >
      {!isNarrowPreview && (
        <span className="flex items-center" style={{ marginTop: '-1px' }}>
          {getTypeIcon(config.type, config.channel)}
        </span>
      )}
      <span>{config.label}</span>
      {showWarning && !isNarrowPreview && (
        <span className="flex items-center" style={{ marginTop: '-1px', marginLeft: '2px' }}>
          <Warning16Filled className="flex-shrink-0 text-amber-600" />
        </span>
      )}
    </span>
  );

  if (showWarning) {
    return (
      <CopilotTooltip
        content="Required inputs not configured — click to set up"
        placement="top"
        delay={300}
      >
        <span id={warningTooltipId} style={{ display: 'contents' }}>
          {pill}
        </span>
      </CopilotTooltip>
    );
  }

  return pill;
};

export default InstructionPill;
