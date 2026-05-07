import { useState, useRef } from 'react';
import { CopilotMenuPosition } from '../components/ui/CopilotMenu';

const COMPONENTS_GROUP_OPTION_STORAGE_KEY = 'componentsGroupOption';
const GROUP_OPTION_VALUES = new Set(['apps', 'no-grouping']);

export interface UseComponentsPanelReturn {
  activeComponentTab: 'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills';
  setActiveComponentTab: React.Dispatch<React.SetStateAction<'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills'>>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchExpanded: boolean;
  setSearchExpanded: (v: boolean) => void;
  searchQueryRef: React.MutableRefObject<string>;
  componentToggles: Record<string, boolean>;
  setComponentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sortMenuOpen: boolean;
  setSortMenuOpen: (v: boolean) => void;
  sortMenuPos: CopilotMenuPosition;
  setSortMenuPos: (v: CopilotMenuPosition) => void;
  sortOption: 'name-az' | 'type';
  setSortOption: React.Dispatch<React.SetStateAction<'name-az' | 'type'>>;
  groupOption: 'apps' | 'no-grouping';
  setGroupOption: React.Dispatch<React.SetStateAction<'apps' | 'no-grouping'>>;
  openComponentMenuId: string | null;
  setOpenComponentMenuId: (v: string | null) => void;
  componentMenuPos: CopilotMenuPosition;
  setComponentMenuPos: (v: CopilotMenuPosition) => void;
  openSkillMenuId: string | null;
  setOpenSkillMenuId: (v: string | null) => void;
  skillMenuPos: CopilotMenuPosition;
  setSkillMenuPos: (v: CopilotMenuPosition) => void;
}

export const useComponentsPanel = (): UseComponentsPanelReturn => {
  const [activeComponentTab, setActiveComponentTab] = useState<'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills'>('all');
  const [searchQuery, setSearchQueryState] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchQueryRef = useRef('');
  const [componentToggles, setComponentToggles] = useState<Record<string, boolean>>({});
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<CopilotMenuPosition>({});
  const [sortOption, setSortOption] = useState<'name-az' | 'type'>('name-az');
  const [groupOptionState, setGroupOptionState] = useState<'apps' | 'no-grouping'>(() => {
    const storedValue = localStorage.getItem(COMPONENTS_GROUP_OPTION_STORAGE_KEY);
    return storedValue && GROUP_OPTION_VALUES.has(storedValue)
      ? (storedValue as 'apps' | 'no-grouping')
      : 'apps';
  });
  const [openComponentMenuId, setOpenComponentMenuId] = useState<string | null>(null);
  const [componentMenuPos, setComponentMenuPos] = useState<CopilotMenuPosition>({});
  const [openSkillMenuId, setOpenSkillMenuId] = useState<string | null>(null);
  const [skillMenuPos, setSkillMenuPos] = useState<CopilotMenuPosition>({});

  const setSearchQuery = (v: string) => {
    setSearchQueryState(v);
    searchQueryRef.current = v;
  };

  const setGroupOption: React.Dispatch<React.SetStateAction<'apps' | 'no-grouping'>> = (value) => {
    setGroupOptionState((previousValue) => {
      const nextValue = typeof value === 'function' ? value(previousValue) : value;
      localStorage.setItem(COMPONENTS_GROUP_OPTION_STORAGE_KEY, nextValue);
      return nextValue;
    });
  };

  return {
    activeComponentTab,
    setActiveComponentTab,
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    searchQueryRef,
    componentToggles,
    setComponentToggles,
    sortMenuOpen,
    setSortMenuOpen,
    sortMenuPos,
    setSortMenuPos,
    sortOption,
    setSortOption,
    groupOption: groupOptionState,
    setGroupOption,
    openComponentMenuId,
    setOpenComponentMenuId,
    componentMenuPos,
    setComponentMenuPos,
    openSkillMenuId,
    setOpenSkillMenuId,
    skillMenuPos,
    setSkillMenuPos,
  };
};
