import React from 'react';
import { ArrowLeft24Regular } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

export interface SubHeaderProps {
  /** Page/section title — displayed at 20px bold */
  title: string;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Optional subtitle shown below the title (12px, gray) */
  subtitle?: string;
  /** Optional badge shown inline next to the title */
  badge?: React.ReactNode;
  /**
   * Optional icon shown immediately before the title.
   * By default the icon is wrapped in a rounded gray box.
   * Pass `noIconWrap` to render the icon as-is (use when the icon already carries its own container styling).
   */
  icon?: React.ReactNode;
  /** When true, the icon is rendered without the default rounded gray box wrapper */
  noIconWrap?: boolean;
  /** Optional right-side actions (e.g. toolbar buttons) */
  actions?: React.ReactNode;
  /** Additional classes — use to set horizontal padding matching the page content */
  className?: string;
}

/**
 * Page-level back navigation header.
 * Matches the Figma PageTitle spec — 4 variants driven by `badge` and `subtitle` props:
 *   1. Title only
 *   2. Title + Subtitle
 *   3. Title + Badge
 *   4. Title + Badge + Subtitle
 *
 * No border or background — padding is provided by the caller via `className`
 * to align with the page's content area.
 */
export const SubHeader: React.FC<SubHeaderProps> = ({
  title,
  onBack,
  subtitle,
  badge,
  icon,
  noIconWrap = false,
  actions,
  className = '',
}) => (
  <div className={`flex ${subtitle ? 'items-start' : 'items-center'} justify-between gap-2 ${className}`}>
    <div className={`flex gap-2 min-w-0 flex-1 ${subtitle ? 'items-start' : 'items-center'}`}>
      <CopilotButton
        variant="icon-subtle"
        size="md"
        icon={<ArrowLeft24Regular />}
        onClick={onBack}
        aria-label="Go back"
        className="shrink-0 -ml-2"
      />
      {/* Icon wrapper — self-stretches to match title+subtitle height, icon centered inside */}
      {icon && (
        noIconWrap ? (
          <div className="self-stretch flex-shrink-0 flex items-center">
            {icon}
          </div>
        ) : (
          <div className="self-stretch flex-shrink-0 flex items-center justify-center rounded-xl bg-gray-100 p-2 aspect-square">
            {icon}
          </div>
        )
      )}

      {/* Title + subtitle column */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate">{title}</h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>

    {actions && (
      <div className="flex items-center gap-1.5 shrink-0">
        {actions}
      </div>
    )}
  </div>
);

/**
 * Colored badge pill for use with SubHeader.
 * Matches the "Preview" / "Configure" / "Connector" badge pattern.
 */
export const SubHeaderBadge: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-1 flex-shrink-0 ml-2 px-2.5 py-1 bg-[hsl(var(--action-brand))] rounded-full cursor-default">
    <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
    <span className="text-[11px] font-medium text-brand whitespace-nowrap leading-none">{label}</span>
  </div>
);
