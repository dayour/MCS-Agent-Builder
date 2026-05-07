import React from 'react';
import { CopilotButton } from './CopilotButton';
import { CopilotStudioIcon } from './CopilotStudioIcon';

export interface ActivitySummaryButtonProps {
  /** Tooltip text. Defaults to 'Summarize activity with Copilot'. */
  title?: string;
  onClick: () => void;
}

/**
 * Hover-reveal Copilot icon button for triggering an activity summary.
 * Rendered invisible by default and shown via `group-hover:opacity-100` —
 * the parent element must have the `group` Tailwind class.
 *
 * Forwards its ref to the underlying button so Fluent UI Tooltip can attach.
 */
export const ActivitySummaryButton = React.forwardRef<HTMLButtonElement, ActivitySummaryButtonProps>(({
  title = 'Summarize activity with Copilot',
  onClick,
}, ref) => (
  <CopilotButton
    ref={ref}
    variant="icon-subtle"
    size="sm"
    icon={<CopilotStudioIcon className="w-4 h-4" />}
    className="opacity-0 group-hover:opacity-100 transition-opacity"
    title={title}
    onClick={onClick}
  />
));
