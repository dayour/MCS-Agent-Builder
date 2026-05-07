import React from 'react';
import { ChevronDown16Regular, ChevronUp16Regular } from '@fluentui/react-icons';

interface DWSortIconProps {
  col: string;
  sortCol: string;
  sortDir: 'asc' | 'desc';
}

export function DWSortIcon({ col, sortCol, sortDir }: DWSortIconProps) {
  const active = col === sortCol;
  if (active && sortDir === 'asc')
    return <ChevronUp16Regular className="w-3.5 h-3.5 text-[hsl(var(--text-primary))] ml-1" />;
  return <ChevronDown16Regular className={`w-3.5 h-3.5 ml-1 ${active ? 'text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-disabled))]'}`} />;
}
