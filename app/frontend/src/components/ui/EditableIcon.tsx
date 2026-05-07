import React, { useState } from 'react';
import { Edit24Regular } from '@fluentui/react-icons';

interface EditableIconProps {
  children: React.ReactNode;
  onEdit: () => void;
  size?: number;
  /** Use fully circular overlay instead of squircle */
  rounded?: boolean;
  /** Explicit corner radius in px for the hover overlay (overrides default size * 0.25) */
  cornerRadius?: number;
}

export const EditableIcon: React.FC<EditableIconProps> = ({
  children,
  onEdit,
  size = 80,
  rounded = false,
  cornerRadius,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const borderRadius = rounded ? '50%' : cornerRadius !== undefined ? `${cornerRadius}px` : `${size * 0.25}px`;

  return (
    <button
      type="button"
      className="relative cursor-pointer group border-0 p-0 bg-transparent"
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onEdit}
      aria-label="Edit icon"
    >
      {children}

      {/* Hover Overlay - matches squircle border radius */}
      <div
        className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ borderRadius }}
      >
        <Edit24Regular style={{ width: 32, height: 32 }} className="text-white" />
      </div>
    </button>
  );
};
