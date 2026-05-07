import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search20Regular, Dismiss20Regular, Checkmark20Regular, Link20Regular } from '@fluentui/react-icons';
import { CopilotButton } from '../ui/CopilotButton';
import { CopilotToggle } from '../ui/CopilotToggle';
import { CopilotInput } from '../ui/CopilotInput';
import { CopilotBadge } from '../ui/CopilotBadge';
import { CopilotDropdown } from '../ui/CopilotDropdown';
import { CopilotFilterPill } from '../ui/CopilotFilterPill';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { LiveFlag, FlagCategory, FLAG_CATEGORY_ORDER } from './NavTypes';
import { buildFlagsUrl, urlActivatedFlags } from '../../utils/featureFlagQuerySync';

// --- Release presets (batch-toggle flag combinations) ---
interface ReleasePreset {
  id: string;
  label: string;
  description: string;
  /** Flag IDs to turn ON. All others turn OFF. 'ALL' = every flag. */
  flagIds: string[] | 'ALL';
  /** When set, flagIds is auto-computed from flags with this tag. */
  tagFilter?: string;
}

// ⚠️ Keep in sync with flags initialized with defaultValue=true in AgentContext.tsx (initFlag('X', true))
const DEFAULT_FLAG_IDS = ['aiAutocomplete', 'buildTabs', 'pillContextMenu', 'publishHA', 'newNotifications', 'evalResults'];

const RELEASE_PRESETS: ReleasePreset[] = [
  { id: 'default', label: 'Default', description: 'Default flag configuration', flagIds: DEFAULT_FLAG_IDS },
  { id: 'all', label: 'All On', description: 'Enable all feature flags (dev mode)', flagIds: 'ALL' },
  { id: 'build', label: 'Build', description: 'Build-tagged flags', flagIds: [], tagFilter: 'build' },
];

const categoryOptions = [
  { label: 'All categories', value: 'all' },
  ...FLAG_CATEGORY_ORDER.map(c => ({ label: c, value: c })),
];

const sortOptions = [
  { label: 'Default order', value: 'default' },
  { label: 'Name A–Z', value: 'name-asc' },
  { label: 'Name Z–A', value: 'name-desc' },
  { label: 'Active first', value: 'active-first' },
  { label: 'Inactive first', value: 'inactive-first' },
];

const statusOptions = [
  { label: 'All flags', value: 'all' },
  { label: 'Enabled only', value: 'active' },
  { label: 'Disabled only', value: 'inactive' },
];

interface NavFeatureFlagsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allFlags: LiveFlag[];
  activeCount: number;
  /** Optional content rendered above the flags list (e.g. model selection). */
  headerContent?: React.ReactNode;
}

export const NavFeatureFlagsPanel: React.FC<NavFeatureFlagsPanelProps> = ({
  isOpen,
  onClose,
  allFlags,
  activeCount,
  headerContent,
}) => {
  const [flagSearch, setFlagSearch] = useState('');
  const [flagCategory, setFlagCategory] = useState<string>('all');
  const [flagTag, setFlagTag] = useState<string>('all');
  const [flagSort, setFlagSort] = useState<string>('default');
  const [flagStatus, setFlagStatus] = useState<string>('all');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyFlagsLink = useCallback(() => {
    const activeFlags = allFlags
      .filter(f => f.active && f.queryKey)
      .map(f => ({ key: f.queryKey!, value: f.queryValue }));
    const url = buildFlagsUrl(activeFlags);
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [allFlags]);

  const resolvedPresets = useMemo(() =>
    RELEASE_PRESETS.map(preset => {
      if (!preset.tagFilter) return preset;
      return { ...preset, flagIds: allFlags.filter(f => f.tags.includes(preset.tagFilter!)).map(f => f.id) };
    }), [allFlags]);

  const matchedPresetId = useMemo(() => {
    const activeIds = new Set(allFlags.filter(f => f.active).map(f => f.id));
    const allIds = allFlags.map(f => f.id);
    for (const preset of resolvedPresets) {
      const targetIds = preset.flagIds === 'ALL' ? allIds : preset.flagIds as string[];
      const targetSet = new Set(targetIds);
      if (allIds.every(id => targetSet.has(id) === activeIds.has(id))) return preset.id;
    }
    return null;
  }, [allFlags, resolvedPresets]);

  const applyPreset = useCallback((preset: ReleasePreset) => {
    const targetIds = preset.flagIds === 'ALL' ? allFlags.map(f => f.id) : preset.flagIds as string[];
    const targetSet = new Set(targetIds);
    for (const flag of allFlags) {
      if (flag.active !== targetSet.has(flag.id)) flag.onToggle();
    }
    setActivePresetId(preset.id);
    setFlagStatus('all');
  }, [allFlags]);

  const closePanel = () => {
    onClose();
    setFlagSearch('');
    setFlagCategory('all');
    setFlagTag('all');
    setFlagSort('default');
    setFlagStatus('all');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTags = useMemo(
    () => Array.from(new Set(allFlags.flatMap(f => f.tags))).sort(),
    [allFlags]
  );

  const tagOptions = useMemo(() => [
    { label: 'All tags', value: 'all' },
    ...allTags.map(t => ({
      label: t.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      value: t,
    })),
  ], [allTags]);

  const visibleFlags = useMemo(() => {
    let result = [...allFlags];
    if (flagSearch.trim()) {
      const q = flagSearch.toLowerCase();
      result = result.filter(f =>
        f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      );
    }
    if (flagCategory !== 'all') result = result.filter(f => f.category === flagCategory);
    if (flagTag !== 'all') result = result.filter(f => f.tags.includes(flagTag));
    if (flagStatus === 'active') result = result.filter(f => f.active);
    else if (flagStatus === 'inactive') result = result.filter(f => !f.active);
    if (flagSort === 'name-asc') result.sort((a, b) => a.label.localeCompare(b.label));
    else if (flagSort === 'name-desc') result.sort((a, b) => b.label.localeCompare(a.label));
    else if (flagSort === 'active-first') result.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    else if (flagSort === 'inactive-first') result.sort((a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0));
    return result;
  }, [allFlags, flagSearch, flagCategory, flagTag, flagStatus, flagSort]);

  const flagsByCategory = useMemo(() => {
    const map = new Map<FlagCategory, LiveFlag[]>();
    for (const cat of FLAG_CATEGORY_ORDER) {
      const flags = visibleFlags.filter(f => f.category === cat);
      if (flags.length > 0) map.set(cat, flags);
    }
    return map;
  }, [visibleFlags]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
      {/* Panel */}
      <div
        data-feature-panel
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl border border-gray-200 flex flex-col"
        style={{ width: '75vw', height: '75vh', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Feature Flags</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {allFlags.length} flags · {activeCount} active
              {import.meta.env.DEV && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                  DEV :{window.location.port}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <CopilotTooltip content={linkCopied ? 'Copied!' : 'Copy link with active flags'} placement="bottom">
              <CopilotButton variant="ghost" size="sm" onClick={copyFlagsLink} className="gap-1.5">
                {linkCopied
                  ? <Checkmark20Regular className="w-4 h-4 text-green-600" />
                  : <Link20Regular className="w-4 h-4" />}
                <span className="text-xs">{linkCopied ? 'Copied' : 'Copy link'}</span>
              </CopilotButton>
            </CopilotTooltip>
            <CopilotButton variant="ghost" size="sm" onClick={closePanel}>
              <Dismiss20Regular className="w-4 h-4" />
            </CopilotButton>
          </div>
        </div>

        {/* Release Presets */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs font-medium text-gray-500 mr-1">Presets</span>
          {resolvedPresets.map(preset => (
            <CopilotTooltip key={preset.id} content={preset.description} placement="bottom">
              <CopilotFilterPill
                active={matchedPresetId === preset.id}
                label={preset.label}
                count={preset.flagIds === 'ALL' ? allFlags.length : (preset.flagIds as string[]).length}
                size="sm"
                onClick={() => applyPreset(preset)}
              />
            </CopilotTooltip>
          ))}
          {matchedPresetId === null && activePresetId !== null && (
            <CopilotBadge appearance="tint" color="warning" size="small">Modified</CopilotBadge>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <CopilotInput
              placeholder="Search flags..."
              size="sm"
              contentBefore={<Search20Regular className="w-4 h-4 text-gray-400" />}
              value={flagSearch}
              onChange={(e) => setFlagSearch(e.target.value)}
            />
          </div>
          <CopilotDropdown options={categoryOptions} value={flagCategory} onChange={setFlagCategory} size="sm" placeholder="All categories" />
          <CopilotDropdown options={tagOptions} value={flagTag} onChange={setFlagTag} size="sm" placeholder="All tags" />
          <CopilotDropdown options={statusOptions} value={flagStatus} onChange={setFlagStatus} size="sm" placeholder="All flags" />
          <CopilotDropdown options={sortOptions} value={flagSort} onChange={setFlagSort} size="sm" placeholder="Sort by" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {headerContent && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              {headerContent}
            </div>
          )}
          {visibleFlags.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <Search20Regular className="w-8 h-8 mb-3" />
              <p className="text-sm font-medium">No flags match your search</p>
              <CopilotButton
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setFlagSearch('');
                  setFlagCategory('all');
                  setFlagTag('all');
                  setFlagSort('default');
                }}
              >
                Clear filters
              </CopilotButton>
            </div>
          ) : (
            <div className="space-y-1.5">
              {Array.from(flagsByCategory.entries()).map(([cat, flags]) => (
                <CollapsibleSection key={cat} title={cat} badge={flags.length} defaultOpen={true}>
                  <div className="space-y-1.5 pb-1.5">
                    {flags.map(flag => (
                      <div
                        key={flag.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{flag.label}</span>
                            <CopilotBadge
                              appearance="tint"
                              color={flag.active ? 'success' : 'subtle'}
                              size="small"
                            >
                              {flag.active ? 'Active' : 'Inactive'}
                            </CopilotBadge>
                            {flag.queryKey && urlActivatedFlags.has(flag.queryKey) && (
                              <CopilotTooltip content={`Set via ?${flag.queryKey}= in URL`} placement="top">
                                <CopilotBadge appearance="tint" color="informative" size="small">
                                  <Link20Regular className="w-3 h-3 mr-0.5" />
                                  via URL
                                </CopilotBadge>
                              </CopilotTooltip>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{flag.description}</p>
                          {flag.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {flag.tags.map(tag => (
                                <CopilotBadge key={tag} appearance="ghost" color="informative" size="small">
                                  {tag.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </CopilotBadge>
                              ))}
                            </div>
                          )}
                        </div>
                        <CopilotToggle
                          checked={flag.active}
                          onChange={() => flag.onToggle()}
                          aria-label={flag.label}
                          size="sm"
                          className="mt-0.5"
                        />
                      </div>
                      {flag.active && flag.expandedContent && (
                        <div className="mt-2 pl-1 border-l-2 border-[hsl(var(--border))] ml-3">
                          {flag.expandedContent}
                        </div>
                      )}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
