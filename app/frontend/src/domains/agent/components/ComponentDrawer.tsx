import React, { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { CopilotBadge } from '../../../components/ui/CopilotBadge';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotMenu, CopilotMenuPosition } from '../../../components/ui/CopilotMenu';
import {
  ChevronUp20Regular,
  ChevronDown20Regular,
  Library20Regular,
  Flash20Regular,
  FlowSparkle20Regular,
  ArrowSort24Regular,
  Search24Regular,
  Dismiss20Regular,
  MoreHorizontal24Regular,
} from '@fluentui/react-icons';
import { ComponentItem, resolveComponentIcon, serviceFluentIconComponents, getComponentMenuItems } from '../../../utils/buildPageUtils';
import { SquircleIcon } from '../../../components/ui/SquircleIcon';
import { getAgentIcon, getUniqueGradientCSS } from '../../../utils/agentIcons';

export interface ComponentDrawerProps {
  isNarrowPreview: boolean;
  items: ComponentItem[];
  componentDescriptions: Record<string, string>;
  componentToggles: Record<string, boolean>;
  setComponentToggles?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Called when Configure is selected from the menu or when a component row is clicked */
  onItemConfigure?: (item: ComponentItem) => void;
  /** Called when Delete is selected from the menu */
  onItemDelete?: (item: ComponentItem) => void;
  /** Called when the drawer opens or closes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Item types to exclude from the list and tabs */
  hideTypes?: ComponentItem['type'][];
}

type TabValue = 'all' | 'knowledge' | 'tools' | 'agents' | 'triggers';

/**
 * Shared component list — used by both the inline components view and the bottom drawer.
 * Renders filter pills, search, sort, and the item list.
 */
export function ComponentList({
  isNarrowPreview,
  items,
  componentDescriptions,
  componentToggles,
  setComponentToggles,
  onItemConfigure,
  onItemDelete,
  hideTypes,
  maxHeight = '100%',
  showFilters = true,
  compact = false,
}: ComponentDrawerProps & { maxHeight?: string; showFilters?: boolean; compact?: boolean }) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [sortOption, setSortOption] = useState<'name' | 'type'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<CopilotMenuPosition>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<CopilotMenuPosition>({});
  const searchQueryLive = React.useRef(searchQuery);
  searchQueryLive.current = searchQuery;

  const visibleItems = hideTypes ? items.filter(item => !hideTypes.includes(item.type)) : items;

  const filtered = visibleItems.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'knowledge') return item.type === 'knowledge';
    if (activeTab === 'tools') return item.type === 'tool';
    if (activeTab === 'agents') return item.type === 'agent';
    if (activeTab === 'triggers') return item.type === 'trigger';
    return true;
  }).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  const hasKnowledge = visibleItems.some(i => i.type === 'knowledge');
  const hasTools     = visibleItems.some(i => i.type === 'tool');
  const hasAgents    = visibleItems.some(i => i.type === 'agent');
  const hasTriggers  = visibleItems.some(i => i.type === 'trigger');
  const typeCount = [hasKnowledge, hasTools, hasAgents, hasTriggers].filter(Boolean).length;

  const menuCallbacks = setComponentToggles
    ? { componentToggles, setComponentToggles, onConfigure: onItemConfigure, onDelete: onItemDelete }
    : undefined;

  const renderItem = (item: ComponentItem) => {
    const isDisabled = !(componentToggles[item.id] ?? true);
    return (
      <div key={item.id}>
        <div
          className={`group/item relative ${isNarrowPreview ? 'py-2.5' : 'py-3'} ${onItemConfigure ? 'cursor-pointer' : ''}`}
          onClick={() => onItemConfigure?.(item)}
        >
          <div className={`absolute inset-0 rounded-2xl group-hover/item:bg-gray-50 transition-colors pointer-events-none ${isNarrowPreview ? 'mx-2' : 'mx-5'}`} />
          <div className={`relative flex items-center gap-3 ${isNarrowPreview ? 'px-4' : 'px-7'}`}>
            <div className="flex-shrink-0" style={isDisabled ? { filter: 'grayscale(100%)', opacity: 0.7 } : undefined}>
              {item.iconKey ? (
                <SquircleIcon size={24} cornerRadius={6} gradient={getUniqueGradientCSS(item.id)}>
                  {getAgentIcon(item.iconKey, 16)}
                </SquircleIcon>
              ) : (
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const fullName = item.source !== 'Others' ? `${item.source} - ${item.name}` : item.name;
                    const svgIcon = resolveComponentIcon(fullName, item.type, 'w-6 h-6', true);
                    if (svgIcon) return svgIcon;
                    const s = { width: 18, height: 18, color: 'hsl(var(--text-secondary))' };
                    const sourceLower = (item.source || '').toLowerCase();
                    const ServiceFluentIcon = serviceFluentIconComponents[sourceLower];
                    const innerIcon = ServiceFluentIcon
                      ? <ServiceFluentIcon style={s} />
                      : item.type === 'knowledge' ? <Library20Regular style={s} />
                      : item.type === 'trigger'   ? <Flash20Regular style={s} />
                      : <FlowSparkle20Regular style={s} />;
                    return (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {innerIcon}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>{item.name}</div>
              <div className={`text-xs truncate ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>{componentDescriptions[item.id] || item.description}</div>
            </div>
            {isDisabled && (
              <CopilotBadge appearance="tint" color="danger" size="small">
                Disabled
              </CopilotBadge>
            )}
            <CopilotBadge appearance="tint" color="subtle" size="small">
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </CopilotBadge>
            {menuCallbacks && (
              <CopilotButton
                variant="ghost"
                size="sm"
                className="hover:bg-gray-100"
                icon={<MoreHorizontal24Regular />}
                aria-label={`Actions for ${item.name}`}
                title={`Actions for ${item.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (openMenuId === item.id) {
                    setOpenMenuId(null);
                  } else {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const pos: CopilotMenuPosition = spaceBelow >= 120
                      ? { top: rect.bottom + 4, left: rect.right - 160 }
                      : { bottom: window.innerHeight - rect.top + 4, left: rect.right - 160 };
                    setMenuPos(pos);
                    setOpenMenuId(item.id);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ maxHeight }}>
      {/* Filter pills */}
      {showFilters && items.length > 0 && typeCount >= 2 && (
        <div className={`flex items-center gap-1.5 ${compact ? 'pt-0.5' : 'pt-3'} pb-1 ${isNarrowPreview ? 'px-4' : 'px-7'}`}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {([
              { value: 'all'       as const, label: 'All',       show: true         },
              { value: 'knowledge' as const, label: 'Knowledge', show: hasKnowledge  },
              { value: 'tools'     as const, label: 'Tools',     show: hasTools      },
              { value: 'agents'    as const, label: 'Agents',    show: hasAgents     },
              { value: 'triggers'  as const, label: 'Triggers',  show: hasTriggers   },
            ] as const).filter(t => t.show).map(tab => (
              <CopilotFilterPill
                key={tab.value}
                size="xs"
                active={activeTab === tab.value}
                label={tab.label}
                onClick={() => { setActiveTab(tab.value); setSearchQuery(''); }}
              />
            ))}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<ArrowSort24Regular />}
              aria-label="Sort components"
              title="Sort components"
              onClick={(e) => {
                if (sortMenuOpen) { setSortMenuOpen(false); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setSortMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setSortMenuOpen(true);
              }}
            />
            {searchExpanded ? (
              <CopilotInput
                size="sm"
                className="w-[160px]"
                placeholder="Search..."
                value={searchQuery}
                autoFocus
                onBlur={() => { if (!searchQueryLive.current) setSearchExpanded(false); }}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                contentAfter={searchQuery ? (
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    icon={<Dismiss20Regular />}
                    tabIndex={-1}
                    onMouseDown={(e) => { e.preventDefault(); setSearchQuery(''); setSearchExpanded(false); }}
                    aria-label="Clear search"
                  />
                ) : undefined}
              />
            ) : (
              <CopilotButton
                variant="ghost"
                size="sm"
                icon={<Search24Regular />}
                aria-label="Search"
                onClick={() => setSearchExpanded(true)}
              />
            )}
          </div>
        </div>
      )}
      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className={`text-sm text-gray-400 ${isNarrowPreview ? 'px-4 py-6' : 'px-7 py-6'} text-center`}>
            No components found
          </div>
        ) : (
          sorted.map(renderItem)
        )}
      </div>
      {/* Sort menu */}
      {sortMenuOpen && (
        <CopilotMenu
          items={[
            { label: 'Name', onClick: () => { setSortOption('name'); setSortMenuOpen(false); } },
            { label: 'Type', onClick: () => { setSortOption('type'); setSortMenuOpen(false); } },
          ]}
          position={sortMenuPos}
          onClose={() => setSortMenuOpen(false)}
        />
      )}
      {/* Item context menu */}
      {openMenuId && menuCallbacks && (() => {
        const menuItem = items.find(i => i.id === openMenuId);
        return menuItem ? (
          <CopilotMenu
            items={getComponentMenuItems(menuItem, menuCallbacks)}
            position={menuPos}
            onClose={() => setOpenMenuId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

/**
 * Bottom drawer that overlays the instructions editor from the bottom.
 * Shows a handle bar with component count; expands to reveal the full component list.
 */
export function ComponentDrawer({
  isNarrowPreview,
  items,
  componentDescriptions,
  componentToggles,
  setComponentToggles,
  onOpenChange,
  hideTypes,
}: ComponentDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col bg-white"
      style={{
        borderBottomLeftRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
        borderBottomRightRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
      }}
    >
      {/* Inset shadow — contained within the instructions box */}
      {drawerOpen && (
        <div className="absolute -top-6 left-0 right-0 h-6 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.03), transparent)' }} />
      )}
      {/* Handle bar — always visible, acts as header when expanded */}
      <button
        onClick={() => {
          setDrawerOpen(prev => {
            const next = !prev;
            onOpenChange?.(next);
            return next;
          });
        }}
        className={`w-full flex items-center justify-between border-t border-gray-300 bg-white hover:bg-gray-50 transition-colors cursor-pointer flex-shrink-0 ${isNarrowPreview ? 'px-4 py-3' : 'px-7 py-4'}`}
        style={{
          ...(!drawerOpen ? {
            borderBottomLeftRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
            borderBottomRightRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
          } : {}),
        }}
      >
        <span className="text-xs font-semibold text-gray-500">
          {items.length} component{items.length !== 1 ? 's' : ''}
        </span>
        {drawerOpen ? (
          <ChevronDown20Regular className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp20Regular className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {/* Expanded list below the handle — animates open and closed */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
        style={{
          maxHeight: drawerOpen ? '380px' : '0px',
          opacity: drawerOpen ? 1 : 0,
          borderBottomLeftRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
          borderBottomRightRadius: isNarrowPreview ? 'var(--radius-xl)' : 'var(--radius-4xl)',
        }}
      >
        <ComponentList
          isNarrowPreview={isNarrowPreview}
          items={items}
          componentDescriptions={componentDescriptions}
          componentToggles={componentToggles}
          setComponentToggles={setComponentToggles}
          maxHeight="380px"
          showFilters
          hideTypes={hideTypes}
        />
      </div>
    </div>
  );
}

/**
 * Padding constants for the scroll area behind the absolutely-positioned drawer.
 * Handle bar: py-4 (32px) + line-height (~20px) + 1px border = ~53px.
 * Expanded list: 380px max-height.
 */
export const DRAWER_HANDLE_HEIGHT = 53;
export const DRAWER_CLOSED_PADDING = DRAWER_HANDLE_HEIGHT;
export const DRAWER_OPEN_PADDING = DRAWER_HANDLE_HEIGHT + 380;
