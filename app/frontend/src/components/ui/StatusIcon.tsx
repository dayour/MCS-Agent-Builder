import React from 'react';
import { LatencyLoader as FluentLatencyLoader } from '@fluentui-copilot/react-latency';

// @fluentui-copilot/react-latency calls CSS.registerProperty on every mount
// without guarding against duplicates. Patch it once here, close to the source.
// TODO: remove when https://github.com/microsoft/fluentui is fixed upstream.
if (typeof CSS !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _css = CSS as any;
  if (_css.registerProperty) {
    const _orig = _css.registerProperty.bind(CSS);
    _css.registerProperty = (descriptor: unknown) => {
      try { _orig(descriptor); } catch (e) {
        if (!(e instanceof DOMException && e.name === 'InvalidModificationError')) throw e;
      }
    };
  }
}

/**
 * StatusIcon - M365 Copilot-style status indicators
 *
 * Based on the Coworker Design System.
 */

export type StatusType = 'pending' | 'in-progress' | 'completed' | 'warning' | 'error';

interface StatusIconProps {
  status: StatusType;
  size?: number;
  className?: string;
}

export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  size = 20,
  className = ''
}) => {
  switch (status) {
    case 'completed':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          className={`text-[hsl(var(--status-success))] ${className}`}
          fill="none"
        >
          <circle
            cx="10"
            cy="10"
            r="8.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6.5 10L9 12.5L13.5 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'in-progress':
      return <LatencyLoader size={size} className={className} />;

    case 'warning':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          className={`text-[hsl(var(--status-warning))] ${className}`}
          fill="none"
        >
          <circle
            cx="10"
            cy="10"
            r="8.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 6V11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
      );

    case 'error':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          className={`text-[hsl(var(--status-error))] ${className}`}
          fill="none"
        >
          <circle
            cx="10"
            cy="10"
            r="8.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 7L13 13M13 7L7 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'pending':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 20 20"
          className={className}
          fill="none"
        >
          <circle
            cx="10"
            cy="10"
            r="8.5"
            stroke="#C4C4C4"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
};

/**
 * LatencyLoader - Official Fluent UI Copilot animated loading indicator
 *
 * Wrapper around @fluentui-copilot/react-latency LatencyLoader
 * to maintain backward compatibility with size and className props.
 */
interface LatencyLoaderProps {
  size?: number;
  className?: string;
}

export const LatencyLoader: React.FC<LatencyLoaderProps> = ({
  size = 20,
  className = ''
}) => {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <FluentLatencyLoader />
    </div>
  );
};

export default StatusIcon;
