import React from 'react';
import { Person16Regular, ChevronDown16Regular } from '@fluentui/react-icons';

export interface ConnectionBadgeProps {
  email?: string;
  connected?: boolean;
}

/**
 * Shared connection status badge used in detail panel headers.
 * Shows a person icon, email, green connected dot, and a chevron menu trigger.
 */
export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  email = 'Mona.Kane@contoso.com',
  connected = true,
}) => (
  <div className="flex items-center gap-1.5 flex-shrink-0">
    <Person16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
    <span className="text-sm text-gray-700">{email}</span>
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
    />
    <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} />
  </div>
);
