import React from 'react';
import { AgentConfig } from '../../types';

export type FlagCategory =
  | 'Evaluation'
  | 'Experimental'
  | 'UI/UX'
  | 'Homepage'
  | 'Flows'
  | 'Preview'
  | 'Monitor'
  | 'Tools'
  | 'Saving'
  | 'Helper Agent'
  | 'Workflows'
  | 'Version History';

export const FLAG_CATEGORY_ORDER: FlagCategory[] = [
  'Evaluation',
  'Experimental',
  'UI/UX',
  'Homepage',
  'Flows',
  'Preview',
  'Monitor',
  'Tools',
  'Saving',
  'Helper Agent',
  'Workflows',
  'Version History',
];

export interface LiveFlag {
  id: string;
  label: string;
  description: string;
  category: FlagCategory;
  tags: string[];
  active: boolean;
  onToggle: () => void;
  /**
   * The localStorage key used as the URL query param name for this flag.
   * Set this on every boolean flag so it can be included in shareable URLs.
   * Omit only for flags that cannot be meaningfully represented as a URL param.
   */
  queryKey?: string;
  /**
   * The URL param value to write when this flag is active in a generated link.
   * Defaults to '1'. Use for non-boolean flags (e.g. queryValue: '2' for workflowVersion).
   */
  queryValue?: string;
  /** Optional extra content rendered below the flag row when the flag is active. */
  expandedContent?: React.ReactNode;
}

export interface NavigationRailProps {
  isNavExpanded: boolean;
  setIsNavExpanded: (expanded: boolean) => void;
  isHomePage: boolean;
  agents: AgentConfig[];
  currentAgentId: string | null;
  switchAgent: (id: string) => void;
  isInConversationMode: boolean;
  setIsInConversationMode: (mode: boolean) => void;
  pendingAgentData?: any | null;
  isLanding?: boolean;
}
