import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { CopilotButton } from '../../../components/ui/CopilotButton';

import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import { CopilotBadge } from '../../../components/ui/CopilotBadge';
import { SquircleIcon } from '../../../components/ui/SquircleIcon';
import {
  ArrowSort24Regular,
  Search24Regular,
  Dismiss20Regular,
  MoreHorizontal24Regular,
  Info16Regular,
  Add24Regular,
  Checkmark16Regular,
  Library20Regular,
  Flash20Regular,
  FlowSparkle20Regular,
  ArrowDownload20Regular,
  Edit16Regular,
  Edit16Filled,
  Delete16Regular,
  Delete16Filled,
  BookStar20Regular,
  CheckmarkCircle20Filled,
} from '@fluentui/react-icons';
import { ComponentItem, resolveComponentIcon, serviceFluentIconComponents, mockComponentItems, getComponentMenuItems } from '../../../utils/buildPageUtils';
import { isConnectorMcp } from './ToolsBrowserModal';
import { getAgentIcon, getUniqueGradientCSS } from '../../../utils/agentIcons';
import { useAgent } from '../../../context/AgentContext';
import { Skill } from '../../../types';
import { downloadSkillZip, toSentenceCase } from '../../../utils/skillUtils';

export interface ComponentsPanelProps {
  isNarrowPreview: boolean;
  /** When true, suppress the outer container margin — for use inside InstructionsEditor. */
  embedded?: boolean;
  /** Real items derived from agent capabilities. Falls back to mockComponentItems when empty. */
  items?: ComponentItem[];
  /** LLM-generated descriptions keyed by item id. */
  componentDescriptions?: Record<string, string>;
  /** Called when a trigger item is clicked to open its detail panel. */
  onOpenTrigger?: (item: ComponentItem) => void;
  activeComponentTab: 'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills';
  setActiveComponentTab: (v: 'all' | 'knowledge' | 'tools' | 'topics' | 'agents' | 'triggers' | 'skills') => void;
  skills?: Skill[];
  onSkillDelete?: (id: string) => void;
  onSkillConfigure?: (skill: Skill) => void;
  onCreateSkill?: () => void;
  isSkillsEnabled?: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchExpanded: boolean;
  setSearchExpanded: (v: boolean) => void;
  searchQueryRef: React.MutableRefObject<string>;
  sortMenuOpen: boolean;
  setSortMenuOpen: (v: boolean) => void;
  sortMenuPos: CopilotMenuPosition;
  setSortMenuPos: (v: CopilotMenuPosition) => void;
  sortOption: 'name-az' | 'type';
  setSortOption: (v: 'name-az' | 'type') => void;
  groupOption: 'apps' | 'no-grouping';
  setGroupOption: (v: 'apps' | 'no-grouping') => void;
  openComponentMenuId: string | null;
  setOpenComponentMenuId: (v: string | null) => void;
  componentMenuPos: CopilotMenuPosition;
  setComponentMenuPos: (v: CopilotMenuPosition) => void;
  openSkillMenuId: string | null;
  setOpenSkillMenuId: (v: string | null) => void;
  skillMenuPos: CopilotMenuPosition;
  setSkillMenuPos: (v: CopilotMenuPosition) => void;
  componentToggles: Record<string, boolean>;
  setComponentToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Called when Open is selected from the context menu */
  onItemOpen?: (item: ComponentItem) => void;
  /** Called when Configure is selected or a component row is clicked */
  onItemConfigure?: (item: ComponentItem) => void;
  /** Called when Delete is selected from the context menu */
  onItemDelete?: (item: ComponentItem) => void;
  /** Called when the Work IQ item is clicked (opens WorkIQDetailPanel) */
  onOpenWorkIQ?: () => void;
  /** Called when the + Add button is clicked — opens the slash command menu */
  onAddClick?: (e?: React.MouseEvent) => void;
  /** When true, filter pills are hidden (rendered externally via filterPillsSlot) */
  hideFilterPills?: boolean;
  /** Names of capabilities currently in the "connecting" state (spinner) */
  connectingCapNames?: Set<string>;
  /** Names of capabilities in the "connected/success" state (green checkmark) */
  connectedCapNames?: Set<string>;
  /** Item types to exclude from the list (e.g. ['trigger', 'agent'] for isToolsDA) */
  hideTypes?: ComponentItem['type'][];
  /**
   * When true, items with reviewState === 'removed' are shown with strikethrough styling.
   * Intentional design: removed items are hidden by default so the panel looks clean after an HA
   * response. The user reveals them via the "Show all changes" toggle (highlightAllChanges).
   * This mirrors instructions: added text is always highlighted, deleted text is toggle-gated.
   */
  showDeletedItems?: boolean;
}

export function ComponentsPanel({
  isNarrowPreview,
  embedded = false,
  items,
  componentDescriptions,
  onOpenTrigger,
  activeComponentTab,
  setActiveComponentTab,
  searchQuery,
  setSearchQuery,
  searchExpanded,
  setSearchExpanded,
  searchQueryRef,
  sortMenuOpen,
  setSortMenuOpen,
  sortMenuPos,
  setSortMenuPos,
  sortOption,
  setSortOption,
  groupOption,
  setGroupOption,
  openComponentMenuId,
  setOpenComponentMenuId,
  componentMenuPos,
  setComponentMenuPos,
  openSkillMenuId,
  setOpenSkillMenuId,
  skillMenuPos,
  setSkillMenuPos,
  componentToggles,
  setComponentToggles,
  onItemOpen,
  onItemConfigure,
  onItemDelete,
  onOpenWorkIQ,
  skills = [],
  onSkillDelete,
  onSkillConfigure,
  onCreateSkill,
  isSkillsEnabled = false,
  onAddClick,
  hideFilterPills,
  connectingCapNames,
  connectedCapNames,
  hideTypes,
  showDeletedItems = false,
}: ComponentsPanelProps) {
  const { isToolsDA } = useAgent();
  // Use real derived items when available, fall back to mock data
  const allDisplayItems = (items && items.length > 0 ? items : mockComponentItems)
    .filter(item => !hideTypes?.includes(item.type))
    .map(item => ({
      ...item,
      description: item.description || componentDescriptions?.[item.id] || '',
    }));
  const displayItems = showDeletedItems
    ? allDisplayItems
    : allDisplayItems.filter(item => item.reviewState !== 'removed');

  // If skills is disabled while the Skills tab is active, move back to All.
  useEffect(() => {
    if (!isSkillsEnabled && activeComponentTab === 'skills') {
      setActiveComponentTab('all');
    }
  }, [isSkillsEnabled, activeComponentTab, setActiveComponentTab]);

  const menuCallbacks = {
    componentToggles,
    setComponentToggles,
    onOpen: onItemOpen ?? onItemConfigure,
    onConfigure: onItemConfigure,
    onDelete: onItemDelete,
  };
  const itemCounts = useMemo(() => {
    const countableItems = allDisplayItems.filter(item => item.reviewState !== 'removed');
    return {
      all: countableItems.length,
      knowledge: countableItems.filter(item => item.type === 'knowledge').length,
      tools: countableItems.filter(item => item.type === 'tool').length,
      topics: countableItems.filter(item => item.type === 'topic').length,
      agents: countableItems.filter(item => item.type === 'agent').length,
      triggers: countableItems.filter(item => item.type === 'trigger').length,
      skills: skills.length,
    };
  }, [allDisplayItems, skills]);

  const renderEmptyState = () => {
    const isAllTab = activeComponentTab === 'all';
    return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {isAllTab && (
        <div className="mb-6">
          <img
            src="/drop-files-empty-icon.svg"
            alt="Drop files"
            className="w-[182px] h-[182px] object-contain"
            draggable={false}
          />
        </div>
      )}
      <p className="text-xs font-semibold leading-none text-gray-900">{isAllTab ? 'Drop files here' : 'No components found'}</p>
      <p className="mt-7 text-sm font-normal leading-[1.35] text-gray-600 w-[432px] max-w-full">
        {isAllTab
            ? "Extend your agent's capabilities by adding components such as knowledge, tools, agents and more."
          : 'Try a different filter or search term.'}
      </p>
    </div>
  );
  };

  return (
    <>
      {/* Components Section */}
      <div
        className={embedded ? 'bg-white' : 'mt-4 flex-shrink-0 border border-gray-300 bg-white'}
        style={embedded ? undefined : { borderRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)' }}
      >
        {/* Header — hidden when embedded (InstructionsEditor provides its own) */}
        {!embedded && (
        <div className={`flex items-center justify-between ${isNarrowPreview ? 'px-4 py-3' : 'px-7 py-4'}`}>
          <div className="flex items-center gap-2">
            <h2 className={`font-bold text-gray-900 ${isNarrowPreview ? 'text-sm' : 'text-xl'}`}>Components</h2>
            <Info16Regular style={{ color: 'hsl(var(--text-disabled))' }} />
          </div>
          <div className="flex items-center gap-1">
            <CopilotButton
              variant="transparent"
              size="sm"
              icon={<ArrowSort24Regular />}
              aria-label="Sort and group components"
              className="hover:!bg-gray-100 active:!bg-gray-200"
              onClick={(e) => {
                if (sortMenuOpen) { setSortMenuOpen(false); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setSortMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setSortMenuOpen(true);
              }}
            />
            {searchExpanded ? (
              <CopilotInput
                appearance="filled-darker"
                size="sm"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQueryRef.current) setSearchExpanded(false); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchExpanded(false); } }}
                placeholder="Search..."
                className="w-[240px]"
                contentBefore={<Search24Regular />}
                contentAfter={searchQuery ? (
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    icon={<Dismiss20Regular />}
                    tabIndex={-1}
                    onMouseDown={(e) => { e.preventDefault(); setSearchQuery(''); }}
                    aria-label="Clear search"
                  />
                ) : undefined}
              />
            ) : (
              <CopilotButton
                variant="transparent"
                size="sm"
                icon={<Search24Regular />}
                aria-label="Search components"
                className="hover:!bg-gray-100 active:!bg-gray-200"
                onClick={() => setSearchExpanded(true)}
              />
            )}
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<Add24Regular />}
              onClick={onAddClick}
            >
              Add
            </CopilotButton>
          </div>
        </div>
        )}

        {/* Filter tabs */}
        {!hideFilterPills && <div className={`flex items-center gap-2.5 pb-3 flex-wrap ${embedded ? 'pt-0' : ''} ${isNarrowPreview ? 'px-4' : (embedded ? 'px-5' : 'px-7')}`}>
          {(['all', 'knowledge', 'tools', 'topics', 'agents', 'triggers'] as const)
            .filter(tab => {
              if (tab === 'all') return true;
              const typeKey = tab === 'tools' ? 'tool' : tab === 'knowledge' ? 'knowledge' : tab === 'agents' ? 'agent' : tab === 'topics' ? 'topic' : 'trigger';
              return displayItems.some(item => item.type === typeKey);
            })
            .map((tab) => {
              const tabCountKey = tab === 'tools' ? 'tools' : tab === 'knowledge' ? 'knowledge' : tab === 'agents' ? 'agents' : tab === 'triggers' ? 'triggers' : tab === 'topics' ? 'topics' : 'all';
              return (
                <CopilotFilterPill
                  key={tab}
                  active={activeComponentTab === tab}
                  label={tab === 'triggers' ? 'Runs when' : tab === 'tools' ? 'Connectors/Tools' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  count={tab !== 'all' ? itemCounts[tabCountKey] : undefined}
                  size="sm"
                  onClick={() => { setActiveComponentTab(tab); setSearchQuery(''); }}
                />
              );
            })}
          {isSkillsEnabled && (
            <CopilotFilterPill
              key="skills"
              active={activeComponentTab === 'skills'}
              label="Skills"
              count={itemCounts.skills}
              size="sm"
              onClick={() => { setActiveComponentTab('skills'); setSearchQuery(''); }}
            />
          )}
        </div>}

        {/* Skills list — shown when Skills tab is active */}
        {activeComponentTab === 'skills' && (
          <div>
            {(() => {
              const filteredSkills = skills.filter(skill => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q);
              });

              if (filteredSkills.length === 0) {
                return renderEmptyState();
              }

              return filteredSkills.map(skill => (
                  <div key={skill.id} className="group/skill">
                    <div className={`relative ${isNarrowPreview ? 'py-2.5' : 'py-3'}`}>
                      <div className={`absolute inset-0 rounded-2xl group-hover/skill:bg-gray-50 transition-colors pointer-events-none ${isNarrowPreview ? 'mx-2' : (embedded ? 'mx-0' : 'mx-5')}`} />
                      <div className={`relative flex items-center gap-3 ${isNarrowPreview ? 'px-4' : (embedded ? 'px-5' : 'px-7')}`}>
                        <div
                          className={`w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 ${onSkillConfigure ? 'cursor-pointer' : ''}`}
                          onClick={() => onSkillConfigure?.(skill)}
                        >
                          <BookStar20Regular style={{ width: 20, height: 20, color: '#7C3AED' }} />
                        </div>
                        <div
                          className={`flex-1 min-w-0 ${onSkillConfigure ? 'cursor-pointer' : ''}`}
                          onClick={() => onSkillConfigure?.(skill)}
                        >
                          <div className="text-sm font-semibold text-gray-900 truncate">{toSentenceCase(skill.name)}</div>
                          <div className="text-xs text-gray-500 truncate">{skill.description}</div>
                        </div>
                        <CopilotBadge appearance="tint" color="subtle" size="small">Skill</CopilotBadge>
                        <CopilotButton
                          variant="ghost"
                          size="sm"
                          icon={<MoreHorizontal24Regular />}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openSkillMenuId === skill.id) {
                              setOpenSkillMenuId(null);
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const pos: CopilotMenuPosition = spaceBelow >= 120
                                ? { top: rect.bottom + 4, left: rect.right - 160 }
                                : { bottom: window.innerHeight - rect.top + 4, left: rect.right - 160 };
                              setSkillMenuPos(pos);
                              setOpenSkillMenuId(skill.id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ));
            })()}
          </div>
        )}

        {/* Items list */}
        <div style={{ display: activeComponentTab === 'skills' ? 'none' : undefined }}>
          {(() => {
            const filtered = displayItems.filter(item => {
              if (activeComponentTab === 'all') return true;
              if (activeComponentTab === 'knowledge') return item.type === 'knowledge';
              if (activeComponentTab === 'tools') return item.type === 'tool';
              if (activeComponentTab === 'topics') return item.type === 'topic';
              if (activeComponentTab === 'agents') return item.type === 'agent';
              if (activeComponentTab === 'triggers') return item.type === 'trigger';
              if (activeComponentTab === 'skills') return false;
              return true;
            }).filter(item => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
            });
            const sorted = [...filtered].sort((a, b) => {
              // Always pin Work IQ at the top regardless of sort mode
              if (a.id === 'work-iq') return -1;
              if (b.id === 'work-iq') return 1;
              // Pin newly added items right after Work IQ
              if (a.isNew && !b.isNew) return -1;
              if (!a.isNew && b.isNew) return 1;
              if (sortOption === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
              return a.name.localeCompare(b.name);
            });
            const renderItem = (item: ComponentItem) => {
              const isWorkIQ = item.id === 'work-iq' || item.name === 'Work IQ';
              return (
              <div key={item.id} data-component-name={item.name}>
                <div
                  className={`group/item relative ${isNarrowPreview ? 'py-2.5' : 'py-3'} ${item.reviewState !== 'removed' && ((isWorkIQ && onOpenWorkIQ) || onItemConfigure || (item.type === 'trigger' && onOpenTrigger)) ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    if (item.reviewState === 'removed') return;
                    // Don't open detail page when clicking the ellipsis menu button
                    if ((e.target as HTMLElement).closest('button')) return;
                    if (isWorkIQ && onOpenWorkIQ) { onOpenWorkIQ(); return; }
                    if (item.type === 'trigger' && onOpenTrigger) {
                      onOpenTrigger(item);
                    } else {
                      onItemConfigure?.(item);
                    }
                  }}
                >
                  <div className={`absolute inset-0 rounded-2xl transition-colors pointer-events-none ${item.reviewState === 'added' ? `my-1 bg-brand-background ${isNarrowPreview ? 'mx-5' : (embedded ? 'mx-3' : 'mx-8')}` : item.reviewState === 'removed' ? `my-1 bg-[hsl(var(--review-deleted-bg))] ${isNarrowPreview ? 'mx-5' : (embedded ? 'mx-3' : 'mx-8')}` : `group-hover/item:bg-gray-50 ${isNarrowPreview ? 'mx-2' : (embedded ? 'mx-0' : 'mx-5')}`}`} />
                  <div className={`relative flex items-center gap-3 ${isNarrowPreview ? 'px-4' : (embedded ? 'px-5' : 'px-7')}`}>
                    <div className="flex-shrink-0">
                      {isWorkIQ ? (
                        <div className="w-10 h-10 flex items-center justify-center">
                          <img src={isToolsDA ? '/component-icons/WorkIQ.svg' : '/copilot-color-icon.svg'} alt="Work IQ" className="w-6 h-6 object-contain" />
                        </div>
                      ) : item.iconKey ? (
                        <SquircleIcon
                          size={40}
                          cornerRadius={10}
                          gradient={getUniqueGradientCSS(item.id)}
                        >
                          {getAgentIcon(item.iconKey, 24)}
                        </SquircleIcon>
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center">
                          {(() => {
                            const fullName = item.source !== 'Others' ? `${item.source} - ${item.name}` : item.name;
                            const svgIcon = resolveComponentIcon(fullName, item.type, 'w-8 h-8', true);
                            if (svgIcon) return svgIcon;
                            const sourceLower = (item.source || '').toLowerCase();
                            const ServiceFluentIcon = serviceFluentIconComponents[sourceLower];
                            if (ServiceFluentIcon) {
                              return (
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <ServiceFluentIcon style={{ width: 26, height: 26, color: 'hsl(var(--text-secondary))' }} />
                                </div>
                              );
                            }
                            // Fluent icon fallback with brand color
                            const IconComp = item.type === 'knowledge' ? Library20Regular
                              : item.type === 'topic' ? Library20Regular
                              : item.type === 'trigger' ? Flash20Regular
                              : FlowSparkle20Regular;
                            return (
                              <div className="w-10 h-10 rounded-full bg-[#f0f0ff] flex items-center justify-center">
                                <IconComp style={{ width: 22, height: 22, color: '#5B5FC7' }} />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-sm font-semibold truncate ${item.reviewState === 'added' ? 'text-brand' : item.reviewState === 'removed' ? 'text-gray-900 line-through' : 'text-gray-900'}`}>{item.name}</span>
                        {item.isNew && (
                          <span className="flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full leading-none">
                            New
                          </span>
                        )}
                      </div>
                      <div className={`text-xs truncate ${item.reviewState === 'added' ? 'text-brand' : item.reviewState === 'removed' ? 'text-gray-500 line-through' : 'text-gray-500'}`}>{item.description}</div>
                    </div>
                    {connectingCapNames?.has(item.name) ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        <span className="text-xs text-blue-500 font-medium">Connecting</span>
                      </div>
                    ) : connectedCapNames?.has(item.name) ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <CheckmarkCircle20Filled className="text-green-500 w-4 h-4" />
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      </div>
                    ) : (item.type !== 'tool' || item.subType === 'connector') && !isWorkIQ && (
                      <CopilotBadge
                        appearance="tint"
                        color={item.reviewState === 'added' ? 'brand' : 'subtle'}
                        size="small"
                        className={item.reviewState === 'removed' ? '!bg-[hsl(var(--review-deleted-bg))]' : ''}
                      >
                        {item.type === 'trigger' ? 'Runs when'
                          : item.type === 'tool' && item.subType === 'connector'
                            ? (isConnectorMcp(item.source !== 'Others' ? item.source : item.name) ? 'MCP' : 'Action')
                          : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </CopilotBadge>
                    )}
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      className={`hover:bg-gray-100 ${item.reviewState === 'removed' ? 'invisible' : ''}`}
                      icon={<MoreHorizontal24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openComponentMenuId === item.id) {
                          setOpenComponentMenuId(null);
                        } else {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const menuHeight = item.type === 'trigger' ? 120 : 210;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const pos: CopilotMenuPosition = spaceBelow >= menuHeight
                            ? { top: rect.bottom + 4, left: rect.right - 160 }
                            : { bottom: window.innerHeight - rect.top + 4, left: rect.right - 160 };
                          setComponentMenuPos(pos);
                          setOpenComponentMenuId(item.id);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
            };
            if (sorted.length === 0) {
              return renderEmptyState();
            }
            if (groupOption === 'no-grouping') {
              return sorted.map(renderItem);
            }
            const groups: Record<string, ComponentItem[]> = {};
            sorted.forEach(item => {
              if (!groups[item.source]) groups[item.source] = [];
              groups[item.source].push(item);
            });
            const sourceOrder = ['Work IQ', 'Excel', 'Outlook', 'SharePoint', 'Teams', 'Others'];
            const orderedGroups = sourceOrder
              .filter(s => groups[s])
              .map(s => [s, groups[s]] as [string, ComponentItem[]]);
            return orderedGroups.map(([source, items]) => (
              <div key={source}>
                <div className={`pt-3 pb-1 text-xs font-semibold text-gray-500 ${isNarrowPreview ? 'px-4' : 'px-7'}`}>{source}</div>
                <div className={`border-b border-gray-200 mb-0.5 ${isNarrowPreview ? 'mx-4' : 'mx-7'}`} />
                {items.map(renderItem)}
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Sort menu — portaled to body to escape transformed ancestors */}
      {sortMenuOpen && ReactDOM.createPortal(
        <CopilotMenu
          position={sortMenuPos}
          onClose={() => setSortMenuOpen(false)}
          minWidth={180}
          items={[
            { label: 'Sort by', sectionLabel: true },
            {
              label: 'Name A to Z',
              icon: sortOption === 'name-az' ? <Checkmark16Regular /> : <span className="w-4 h-4 block" />,
              onClick: () => setSortOption('name-az'),
            },
            {
              label: 'Type',
              icon: sortOption === 'type' ? <Checkmark16Regular /> : <span className="w-4 h-4 block" />,
              onClick: () => setSortOption('type'),
            },
            { label: 'Group by', sectionLabel: true, dividerAbove: true },
            {
              label: 'Apps',
              icon: groupOption === 'apps' ? <Checkmark16Regular /> : <span className="w-4 h-4 block" />,
              onClick: () => setGroupOption('apps'),
            },
            {
              label: 'No grouping',
              icon: groupOption === 'no-grouping' ? <Checkmark16Regular /> : <span className="w-4 h-4 block" />,
              onClick: () => setGroupOption('no-grouping'),
            },
          ]}
        />,
        document.body,
      )}

      {/* Skill context menu */}
      {openSkillMenuId && (() => {
        const skill = skills.find(s => s.id === openSkillMenuId);
        if (!skill) return null;
        const skillToggled = componentToggles[skill.id] ?? true;
        const items = [
          { label: 'Download', icon: <ArrowDownload20Regular />, iconFilled: <ArrowDownload20Regular />, onClick: () => { setOpenSkillMenuId(null); downloadSkillZip(skill); } },
          ...(onSkillConfigure ? [{ label: 'Edit', icon: <Edit16Regular />, iconFilled: <Edit16Filled />, onClick: () => { setOpenSkillMenuId(null); onSkillConfigure(skill); } }] : []),
          ...(onSkillDelete ? [{ label: 'Delete', icon: <Delete16Regular />, iconFilled: <Delete16Filled />, destructive: true, onClick: () => { setOpenSkillMenuId(null); onSkillDelete(skill.id); } }] : []),
          {
            label: 'Enabled',
            dividerAbove: true,
            toggle: {
              checked: skillToggled,
              onChange: (v: boolean) => setComponentToggles(prev => ({ ...prev, [skill.id]: v })),
            },
          },
        ];
        return ReactDOM.createPortal(
          <CopilotMenu items={items} position={skillMenuPos} onClose={() => setOpenSkillMenuId(null)} minWidth={160} />,
          document.body,
        );
      })()}

      {/* Component context menu — portaled to body to escape transformed ancestors */}
      {openComponentMenuId && (() => {
        const menuItem = displayItems.find(i => i.id === openComponentMenuId);
        return menuItem ? ReactDOM.createPortal(
          <CopilotMenu
            items={getComponentMenuItems(menuItem, menuCallbacks)}
            position={componentMenuPos}
            onClose={() => setOpenComponentMenuId(null)}
            minWidth={160}
          />,
          document.body,
        ) : null;
      })()}
    </>
  );
}
