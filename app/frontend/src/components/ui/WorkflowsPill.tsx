import React from 'react';

/**
 * WorkflowsPill — Inline pill used for referencing Dynamic values and PowerFx
 * expressions in input fields in the workflow designer.
 *
 * Shares the exact visual style of InstructionPill (brand-purple text, gray border,
 * semibold, 20px border-radius) but appends a small × button to the right end for
 * removing inline tokens from a contentEditable instructions field.
 */

export interface WorkflowsPillProps {
  /** Display label */
  label: string;
  /** Optional leading icon element */
  icon?: React.ReactNode;
  /** Called when the × button is clicked */
  onDismiss: () => void;
  /** Additional CSS class names */
  className?: string;
}

export const WorkflowsPill: React.FC<WorkflowsPillProps> = ({
  label,
  icon,
  onDismiss,
  className,
}) => (
  <span
    contentEditable={false}
    className={`inline-flex items-center font-semibold border border-gray-300 text-brand-purple gap-1 hover:bg-gray-100 transition-colors ${className || ''}`}
    style={{
      borderRadius: 20,
      fontSize: 13,
      height: 24,
      boxSizing: 'border-box',
      paddingLeft: 12,
      paddingRight: 4,
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}
  >
    {icon && (
      <span className="flex items-center flex-shrink-0" style={{ marginTop: '-1px' }}>
        {icon}
      </span>
    )}
    {label}
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={e => { e.stopPropagation(); onDismiss(); }}
      aria-label="Remove"
      className="flex items-center flex-shrink-0 rounded-full opacity-50 hover:opacity-100 hover:bg-indigo-100 transition-opacity"
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        width: 16,
        height: 16,
        cursor: 'pointer',
        marginLeft: '2px',
        color: 'inherit',
        flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  </span>
);

export default WorkflowsPill;
