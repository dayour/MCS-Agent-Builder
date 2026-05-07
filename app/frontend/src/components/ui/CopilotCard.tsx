import React from 'react';
import { Agents20Filled, Flow20Filled, Info20Regular } from '@fluentui/react-icons';

/**
 * CopilotCard - M365 Copilot-style card component with three complexity levels
 *
 * Based on the Coworker Design System.
 *
 * Variants:
 *   simple   → Title only (optional icon). Compact informational chip.
 *   medium   → Title + description + optional icon + optional badge.
 *   detailed → Title + description + metadata row + optional footer actions + optional header image.
 *   gallery  → Homepage-style card with large icon hero area, title + short description. Rounded-2xl, glow hover.
 */

export interface CopilotCardAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: React.ReactNode;
}

export interface CopilotCardProps {
  /** Controls how much content the card renders */
  variant?: 'simple' | 'medium' | 'detailed' | 'gallery';

  /** Primary text */
  title: string;

  /** Secondary text – shown in medium & detailed */
  description?: string;

  /** Leading icon – all variants */
  icon?: React.ReactNode;

  /** Trailing badge text – medium & detailed */
  badge?: string;

  /** Badge color – defaults to brand */
  badgeVariant?: 'brand' | 'success' | 'warning' | 'error' | 'neutral';

  /** Metadata key-value pairs – detailed only */
  metadata?: Array<{ label: string; value: string }>;

  /** Footer actions – detailed only */
  actions?: CopilotCardAction[];

  /** Header image URL – detailed only */
  image?: string;

  /** Makes the card clickable with hover/active states */
  onClick?: () => void;

  /** Selected / active state */
  selected?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Additional className */
  className?: string;

  /** Color palette for the gallery hero area — pastel bg + gradient icon */
  heroColor?: {
    /** Light pastel Tailwind gradient for the background (e.g. 'from-teal-50 to-cyan-50') */
    bg: string;
    /** CSS color for icon gradient start (e.g. '#0d9488') */
    from: string;
    /** CSS color for icon gradient end (e.g. '#06b6d4') */
    to: string;
  };
}

/* ── helpers ── */

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const badgeColors: Record<string, string> = {
  brand:   'bg-[hsl(var(--action-brand))] text-[hsl(var(--action-brand-foreground))]',
  success: 'bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]',
  warning: 'bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))]',
  error:   'bg-[hsl(var(--status-error)/0.12)] text-[hsl(var(--status-error))]',
  neutral: 'bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]',
};

const actionVariants: Record<string, string> = {
  primary:   'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]',
  secondary: 'bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--secondary-border))] hover:bg-[hsl(var(--secondary-hover))]',
  ghost:     'bg-transparent text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--secondary-hover))]',
};

/* ── component ── */

export const CopilotCard: React.FC<CopilotCardProps> = ({
  variant = 'medium',
  title,
  description,
  icon,
  badge,
  badgeVariant = 'brand',
  metadata,
  actions,
  image,
  onClick,
  selected = false,
  disabled = false,
  className,
  heroColor,
}) => {
  const gradientSuffix = React.useId().replace(/:/g, '');
  const gradientId = `icon-grad-${gradientSuffix}`;
  const iconWrapClass = `icon-wrap-${gradientSuffix}`;
  const isClickable = !!onClick && !disabled;

  const rootStyles = cn(
    // base
    'bg-[hsl(var(--card))] border rounded-xl transition-all',
    // padding per variant (gallery handles its own)
    variant === 'simple' ? 'px-4 py-3' : variant === 'medium' ? 'p-4' : variant === 'detailed' ? 'p-0 overflow-hidden' : '',
    // border / selected
    selected
      ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))]'
      : 'border-[hsl(var(--secondary-border))]',
    // clickable states
    isClickable && !selected && 'hover:border-[hsl(var(--text-disabled))] hover:shadow-[var(--shadow-sm)] cursor-pointer group',
    isClickable && 'active:bg-[hsl(var(--secondary-hover))]',
    // disabled
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  /* ── GALLERY ── */
  if (variant === 'gallery') {
    return (
      <div
        className={cn(
          'bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 transition-all overflow-hidden',
          selected
            ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))]'
            : '',
          isClickable && 'cursor-pointer group',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        style={{ borderRadius: 24 }}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onMouseEnter={isClickable ? (e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.10)';
          e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
        } : undefined}
        onMouseLeave={isClickable ? (e) => {
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.boxShadow = '';
        } : undefined}
      >
        {/* Hero area — large gradient icon on soft pastel background */}
        <div
          className={cn(
            'w-full flex items-center justify-center rounded-2xl mb-3 relative overflow-hidden',
            heroColor ? `bg-gradient-to-br ${heroColor.bg}` : '',
          )}
          style={{ height: 120, ...(!heroColor ? { background: 'hsl(var(--action-brand))' } : {}) }}
        >
          {/* SVG gradient definition + scoped fill override */}
          {heroColor && (
            <>
              <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={heroColor.from} />
                    <stop offset="100%" stopColor={heroColor.to} />
                  </linearGradient>
                </defs>
              </svg>
              <style>{`.${iconWrapClass} svg, .${iconWrapClass} svg path, .${iconWrapClass} svg circle, .${iconWrapClass} svg rect { fill: url(#${gradientId}) !important; }`}</style>
            </>
          )}
          {/* Background ghost icon — large, blurred, subtle */}
          {icon && React.isValidElement(icon) && (
            <span
              className={cn('absolute flex items-center justify-center pointer-events-none', heroColor ? iconWrapClass : 'text-[hsl(var(--action-brand-foreground))]')}
              style={{ width: 240, height: 240, opacity: 0.10, filter: 'blur(20px)', top: -15 }}
              aria-hidden
            >
              {React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties }>, {
                style: { width: 240, height: 240, ...(icon as React.ReactElement<{ style?: React.CSSProperties }>).props.style },
              })}
            </span>
          )}

          {/* Foreground icon */}
          <span
            className={cn('relative flex items-center justify-center', heroColor ? iconWrapClass : 'text-[hsl(var(--action-brand-foreground))]')}
            style={{ width: 64, height: 64, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))' }}
          >
            {icon && React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties }>, {
                  style: { width: 64, height: 64, ...(icon as React.ReactElement<{ style?: React.CSSProperties }>).props.style },
                })
              : icon}
          </span>
        </div>

        {/* Title row — with optional right-justified badge */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm text-[hsl(var(--text-primary))] truncate flex-1">{title}</h3>
          {badge && (
            <span className={cn('flex-shrink-0 inline-flex items-center gap-1 text-caption-1-strong px-2.5 py-1 rounded-full', badgeColors[badgeVariant])}>
              {badge === 'Agent' && <Agents20Filled className="w-3.5 h-3.5" />}
              {badge === 'Workflow' && <Flow20Filled className="w-3.5 h-3.5" />}
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-[hsl(var(--text-subtle))] line-clamp-2">{description}</p>
        )}
      </div>
    );
  }

  /* ── SIMPLE ── */
  if (variant === 'simple') {
    return (
      <div
        className={rootStyles}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[hsl(var(--primary))]">
              {icon}
            </span>
          )}
          <span className="text-body-2-strong text-[hsl(var(--text-primary))] truncate">{title}</span>
          {badge && (
            <span className={cn('ml-auto text-caption-1-strong px-2 py-0.5 rounded-full', badgeColors[badgeVariant])}>
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  /* ── MEDIUM ── */
  if (variant === 'medium') {
    return (
      <div
        className={rootStyles}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[hsl(var(--action-brand))] flex items-center justify-center text-[hsl(var(--action-brand-foreground))] transition-colors group-hover:bg-brand group-hover:text-white">
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-body-2-strong text-[hsl(var(--text-primary))] truncate">{title}</h3>
              {badge && (
                <span className={cn('flex-shrink-0 text-caption-1-strong px-2 py-0.5 rounded-full', badgeColors[badgeVariant])}>
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-caption-1 text-[hsl(var(--text-subtle))] mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── DETAILED ── */
  return (
    <div
      className={rootStyles}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Optional header image */}
      {image && (
        <div className="w-full h-36 bg-[hsl(var(--muted))] overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Body */}
      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start gap-3">
          {icon && (
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[hsl(var(--action-brand))] flex items-center justify-center text-[hsl(var(--action-brand-foreground))] transition-colors group-hover:bg-brand group-hover:text-white">
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-body-1-strong text-[hsl(var(--text-primary))]">{title}</h3>
              {badge && (
                <span className={cn('flex-shrink-0 text-caption-1-strong px-2 py-0.5 rounded-full', badgeColors[badgeVariant])}>
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-body-2 text-[hsl(var(--text-subtle))] mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {metadata && metadata.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[hsl(var(--secondary-border))]">
            {metadata.map((item) => (
              <div key={item.label} className="flex flex-col">
                <span className="text-caption-1 text-[hsl(var(--text-disabled))]">{item.label}</span>
                <span className={cn('text-caption-1-strong text-[hsl(var(--text-primary))]', /\d/.test(item.value) && 'font-numeric')}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[hsl(var(--secondary-border))]">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption-1-strong transition-colors',
                  actionVariants[action.variant || 'secondary'],
                )}
              >
                {action.icon && (
                  <span className="w-4 h-4 flex items-center justify-center">{action.icon}</span>
                )}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotCard;

/* ═══════════════════════════════════════════════════════════════════════
 *  MetricCard – KPI stat card for dashboards
 *  Displays a label, large value, and optional trend indicator.
 * ═══════════════════════════════════════════════════════════════════════ */

export interface MetricCardProps {
  /** Metric label (e.g. "Total runs") */
  label: string;
  /** Primary display value (e.g. "1,706") */
  value: string | number;
  /** Optional unit suffix displayed after the value (e.g. "%", "sec") */
  suffix?: string;
  /** Trend direction — controls arrow and color */
  trend?: 'up' | 'down';
  /** Trend percentage text (e.g. "5%") */
  trendValue?: string;
  /** Whether an upward trend is positive (green) or negative (red). Defaults to true. */
  trendUpIsGood?: boolean;
  /** Show info tooltip icon beside the label */
  showInfo?: boolean;
  /** Info tooltip click handler */
  onInfoClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  suffix,
  trend,
  trendValue,
  trendUpIsGood = true,
  showInfo = true,
  onInfoClick,
  className,
}) => {
  const isPositive = trend
    ? (trend === 'up' && trendUpIsGood) || (trend === 'down' && !trendUpIsGood)
    : true;

  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <div className={cn('bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col gap-3 hover:shadow-sm hover:border-[hsl(var(--text-disabled))] transition-all', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[hsl(var(--text-subtle))] uppercase tracking-wide">{label}</span>
        {showInfo && (
          <button
            onClick={onInfoClick}
            className="text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-subtle))] transition-colors"
          >
            <Info20Regular style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-[hsl(var(--text-primary))]">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-base font-medium text-[hsl(var(--text-subtle))] ml-1">{suffix}</span>}
        </p>
      </div>
      {trend && trendValue && (
        <div className={cn('flex items-center gap-1.5 pt-1 border-t border-[hsl(var(--border))] text-xs', trendColor)}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
            {trend === 'up' ? (
              <path d="M6 9V3M3 6L6 3L9 6" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M6 3V9M3 6L6 9L9 6" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
 *  ContentCard – Card container with optional header
 *  Use for wrapping content like tables or lists with a titled card frame.
 * ═══════════════════════════════════════════════════════════════════════ */

export interface ContentCardProps {
  /** Card title */
  title?: string;
  /** Description or subtitle — can be a string or JSX for inline links */
  description?: React.ReactNode;
  /** Metadata text shown to the right of the description (e.g. "Last updated 02/12/26") */
  meta?: string;
  /** Action elements rendered in the top-right corner */
  actions?: React.ReactNode;
  /** Footer content rendered below the main children */
  footer?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  className?: string;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  description,
  meta,
  actions,
  footer,
  children,
  className,
}) => {
  const hasHeader = title || description || actions;

  return (
    <div className={cn('bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]', className)}>
      {hasHeader && (
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex-1">
            {title && (
              <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))]">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-[hsl(var(--text-subtle))] mt-1">{description}</p>
            )}
          </div>
          {(meta || actions) && (
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              {meta && (
                <span className={cn('text-sm text-[hsl(var(--text-subtle))]', /\d/.test(meta) && 'font-numeric')}>{meta}</span>
              )}
              {actions}
            </div>
          )}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="px-6 pb-4 pt-2">{footer}</div>
      )}
    </div>
  );
};
