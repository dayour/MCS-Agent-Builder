import React, { useMemo, useId } from 'react';
import { getSvgPath } from 'figma-squircle';

interface SquircleIconProps {
  /** Rendered size in px (default 48) */
  size?: number;
  /** Figma corner radius (default 12) */
  cornerRadius?: number;
  /** CSS gradient string, e.g. "linear-gradient(138deg, #28B8D2, #1C9DC1, #3963C6)" */
  gradient: string;
  /** Icon element to center inside the squircle */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Optional stroke color for a border around the squircle */
  stroke?: string;
  /** Optional stroke width in px (default 1) */
  strokeWidth?: number;
}

/**
 * Parse a CSS linear-gradient string into its angle and color stops.
 * Supports: linear-gradient(138deg, #color1, #color2[, #color3])
 */
function parseCSSGradient(css: string): { angle: number; stops: string[] } {
  const match = typeof css === 'string' ? css.match(/linear-gradient\(\s*(\d+)deg\s*,\s*(.+)\)/) : null;
  if (!match) return { angle: 138, stops: ['#888', '#444'] };
  const angle = parseInt(match[1], 10);
  const stops = match[2].split(',').map((s) => s.trim());
  return { angle, stops };
}

/**
 * Squircle background container that matches Figma's cornerSmoothing = 1.
 *
 * Uses figma-squircle to generate the exact same superellipse path that Figma
 * uses for its "smooth corners" feature.
 *
 * Renders the squircle as an inline SVG <path> with gradient fill rather than
 * CSS clip-path, avoiding subpixel rendering artifacts that occur when elements
 * land on half-pixel positions in CSS grid layouts.
 */
export const SquircleIcon: React.FC<SquircleIconProps> = ({
  size = 48,
  cornerRadius = 12,
  gradient,
  children,
  className,
  style,
  stroke,
  strokeWidth = 1,
}) => {
  // Generate a unique ID for the SVG gradient definition
  const rawId = useId();
  const gradientId = `sg${rawId.replace(/:/g, '')}`;

  const path = useMemo(
    () =>
      getSvgPath({
        width: size,
        height: size,
        cornerRadius,
        cornerSmoothing: 1,
      }),
    [size, cornerRadius],
  );

  // Inset path for stroke — slightly smaller so the stroke renders fully inside
  const insetPath = useMemo(
    () =>
      stroke
        ? getSvgPath({
            width: size - strokeWidth,
            height: size - strokeWidth,
            cornerRadius: Math.max(0, cornerRadius - strokeWidth / 2),
            cornerSmoothing: 1,
          })
        : '',
    [size, cornerRadius, stroke, strokeWidth],
  );

  const { angle, stops } = useMemo(() => parseCSSGradient(gradient), [gradient]);
  const center = size / 2;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* SVG squircle shape with gradient fill */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={center}
            y1={size}
            x2={center}
            y2={0}
            gradientTransform={`rotate(${angle}, ${center}, ${center})`}
          >
            {stops.map((color, i) => (
              <stop
                key={i}
                offset={`${(i / (stops.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#${gradientId})`} />
        {stroke && <path d={insetPath} fill="none" stroke={stroke} strokeWidth={strokeWidth} transform={`translate(${strokeWidth / 2}, ${strokeWidth / 2})`} />}
      </svg>
      {/* Icon overlay centered on top of the squircle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SquircleIcon;
