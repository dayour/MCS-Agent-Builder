import React from 'react';
import { Tooltip } from '@fluentui/react-components';
import type { TooltipProps, PositioningShorthand } from '@fluentui/react-components';

/**
 * CopilotTooltip — Fluent v9 Tooltip
 *
 * Wraps the Fluent v9 Tooltip component, mapping the CopilotTooltip API
 * (placement, delay, disabled) to Fluent's positioning system.
 *
 * Replaces the previous 166-line custom portal + position calculation
 * implementation with Fluent's built-in positioning engine.
 */

export interface CopilotTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
  /** 'inverted' = dark tooltip (default); 'normal' = light tooltip with border */
  appearance?: 'inverted' | 'normal';
  /** Optional richer explanation for Point to Ask — overrides content if provided */
  askContext?: string;
}

const placementMap: Record<string, PositioningShorthand> = {
  top: 'above',
  bottom: 'below',
  left: 'before',
  right: 'after',
};

export const CopilotTooltip: React.FC<CopilotTooltipProps> = ({
  content,
  children,
  placement = 'right',
  // Default show delay is 250ms — intentionally shorter than Fluent's 500ms default
  // to feel more responsive while still preventing flash-on-hover.
  delay = 250,
  disabled = false,
  className,
  appearance = 'inverted',
  askContext,
}) => {
  // Inject data-ask-context onto the child so Point to Ask can read tooltip labels
  const askContextStr = typeof content === 'string' ? content : '';
  const childWithContext = React.cloneElement(children, {
    'data-ask-context': askContext ?? askContextStr,
  } as React.HTMLAttributes<HTMLElement>);

  if (disabled || !content) {
    return childWithContext;
  }

  const tooltipContent = typeof content === 'string' ? content : <span>{content}</span>;

  return (
    <Tooltip
      content={tooltipContent}
      positioning={placementMap[placement] || 'after'}
      relationship="description"
      showDelay={delay}
      hideDelay={200}
      appearance={appearance}
    >
      {childWithContext}
    </Tooltip>
  );
};

export default CopilotTooltip;
