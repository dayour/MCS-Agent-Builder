/**
 * Type definitions for Add Component Modal
 * Used across modal, search utilities, and data structures
 */

export interface Suggestion {
  text: string;
  keywords: string[];
  apps: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
  category: 'knowledge' | 'tools' | 'agents' | 'triggers' | 'others';
  icon?: string;
}

export interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: SearchResult[]) => number;
}

export type FilterTab = 'all' | 'knowledge' | 'tools' | 'agents' | 'triggers' | 'others';

export interface SearchResultsData {
  topPicks: SearchResult[];
  allResults: SearchResult[];
}
