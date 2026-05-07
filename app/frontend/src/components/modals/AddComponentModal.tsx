import React, { useState, useRef, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CopilotButton, CopilotInput, CopilotFilterPill } from '../ui';
import {
  AddComponentModalProps,
  FilterTab,
  SearchResult
} from './AddComponentModalTypes';
import {
  filterSuggestions,
  toggleItemSelection,
  toggleAllItemsSelection,
  areAllSelected
} from '../../utils/componentSearch';
import { TopPicksSection, FilterTabs, ResultsList } from './AddComponentModalResults';
import { SEARCH_RESULTS_DATA } from '../../data/searchResultsData';

// Import Fluent UI icons
import {
  Search20Regular,
  Library24Regular,
  Wrench24Regular,
  BotSparkle24Regular,
  People24Regular,
  ArrowLeft20Regular,
  Dismiss20Regular,
  Edit20Regular,
  DataBarVertical20Regular,
} from '@fluentui/react-icons';

// ── Module-level helpers ──────────────────────────────────────────────────────

/** Get items by their IDs from combined data */
function getItemsByIds(itemIds: string[], allItems: SearchResult[]): SearchResult[] {
  return allItems.filter(item => itemIds.includes(item.id));
}

/** Get app icon by name — pure function, no dependency on props/state */
const getAppIcon = (appName: string) => {
  const icons: Record<string, string> = {
    'Outlook':    '/component-icons/Outlook24.svg',
    'SharePoint': '/component-icons/SharePoint24.svg',
    'Teams':      '/component-icons/Teams24.svg',
    'OneDrive':   '/component-icons/OneDrive24.svg',
    'Excel':      '/component-icons/Excel24.svg',
  };
  const src = icons[appName];
  return src
    ? <img src={src} alt={appName} className="w-5 h-5" />
    : <div className="w-5 h-5 bg-gray-300 rounded" />;
};

/** Compute result counts from a list of results */
function computeResultCounts(results: SearchResult[]): Record<FilterTab, number> {
  const counts: Record<FilterTab, number> = {
    all: results.length,
    knowledge: 0,
    tools: 0,
    agents: 0,
    triggers: 0,
    others: 0
  };
  results.forEach(item => {
    if (item.category in counts) counts[item.category]++;
  });
  return counts;
}


/**
 * CapabilityCard Component
 * Card for "What your agent can do" section
 */
interface CapabilityCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const CapabilityCard: React.FC<CapabilityCardProps> = ({
  title,
  description,
  icon,
  onClick
}) => (
  <div
    onClick={onClick}
    className="bg-white border border-gray-200 rounded-xl overflow-hidden opacity-60"
  >
    <div className="p-4 flex flex-col gap-2">
      <div className="flex-shrink-0">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-700 min-w-0 break-words">{title}</h3>
      <p className="text-xs text-gray-600 break-words">{description}</p>
    </div>
  </div>
);

/**
 * AppCard Component
 * Card for "Start with apps" section
 */
interface AppCardProps {
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ name, icon, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2 overflow-hidden opacity-60"
  >
    <div className="w-5 h-5 flex-shrink-0">{icon}</div>
    <span className="text-sm font-semibold text-gray-700 flex-1 min-w-0 truncate">
      {name}
    </span>
  </div>
);

/**
 * Main AddComponentModal Component
 *
 * Renders as a full-canvas panel (absolute inset-0) rather than a dialog,
 * following the same pattern as AgentSettingsPageSimplified.
 */
export const AddComponentModal: React.FC<AddComponentModalProps> = ({
  isOpen,
  onClose,
  onAddItems,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setShowSearchResults(false);
      setSelectedIds([]);
      setActiveFilter('all');
    }
  }, [isOpen]);

  // Get filtered suggestions based on search query
  const suggestions = filterSuggestions(searchQuery);

  // Filter results by search query and category
  const filteredResults = useMemo(() => {
    let results = SEARCH_RESULTS_DATA.allResults;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
      );
    }
    if (activeFilter !== 'all') {
      results = results.filter(r => r.category === activeFilter);
    }
    return results;
  }, [searchQuery, activeFilter]);

  // Result counts update as user types — reflects filtered totals in tabs
  const resultCounts = useMemo(() => {
    const queryFiltered = searchQuery.trim()
      ? SEARCH_RESULTS_DATA.allResults.filter(r => {
          const q = searchQuery.toLowerCase();
          return r.title.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q) ||
            r.category?.toLowerCase().includes(q);
        })
      : SEARCH_RESULTS_DATA.allResults;
    return computeResultCounts(queryFiltered);
  }, [searchQuery]);

  // Check if all current results are selected
  const allResultsSelected = areAllSelected(
    filteredResults.map(r => r.id),
    selectedIds
  );

  // Handlers
  const handleEnterClick = () => {
    if (searchQuery.trim()) {
      setShowSearchResults(true);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setSearchQuery(text);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => toggleItemSelection(id, prev));
  };

  const handleToggleAll = () => {
    setSelectedIds(prev =>
      toggleAllItemsSelection(filteredResults.map(r => r.id), prev)
    );
  };

  const handleAddSelected = () => {
    if (selectedIds.length === 0) return;

    const allItems = [...SEARCH_RESULTS_DATA.topPicks, ...SEARCH_RESULTS_DATA.allResults];
    const itemsToAdd = getItemsByIds(selectedIds, allItems);
    onAddItems(itemsToAdd);

    // Reset and close
    setSelectedIds([]);
    setSearchQuery('');
    setShowSearchResults(false);
    setActiveFilter('all');
    onClose();
  };

  const handleBackToSearch = () => {
    setShowSearchResults(false);
    setSelectedIds([]);
    setActiveFilter('all');
    setSearchQuery('');
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSearchQuery('');
    setShowSearchResults(false);
    setActiveFilter('all');
    onClose();
  };

  const navigateToFlow = (_flowType: string) => {
    // TODO: Implement in future PR
  };

  const handleAppClick = (_appName: string) => {
    // TODO: Implement flow for app-specific component addition
  };

  const showAllApps = () => {
    // TODO: Expand to show all 18 apps
  };

  const portalTarget = document.getElementById('elevate-right-pane');
  if (!isOpen || !portalTarget) return null;

  return ReactDOM.createPortal(
    <div className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden">

      {/* Top bar — back (left) + close (right), no title */}
      <div className="shrink-0 px-4 py-2 flex items-center justify-between">
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={showSearchResults ? handleBackToSearch : handleClose}
        >
          Back
        </CopilotButton>
        <CopilotButton
          variant="ghost"
          size="sm"
          icon={<Dismiss20Regular />}
          onClick={handleClose}
          aria-label="Close"
          title="Close"
        />
      </div>

      {/* Scrollable content — responsive gutters */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 sm:px-8 md:px-16 lg:px-24 xl:px-36 pt-10 pb-24 flex flex-col gap-10">

          {/* Initial View */}
          {!showSearchResults && (
            <>
              {/* Search group: title + input + pills */}
              <div className="flex flex-col gap-5">
                <h1 className="text-2xl font-bold text-gray-900">
                  Add components to your agent
                </h1>

                <div className="flex flex-col gap-3">
                  {/* Search Box */}
                  <CopilotInput
                    ref={searchInputRef}
                    size="lg"
                    placeholder="Search or paste a URL to add what your agent needs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEnterClick()}
                    contentBefore={<Search20Regular />}
                    contentAfter={searchQuery ? (
                      <CopilotButton variant="transparent" size="sm" onClick={handleEnterClick}>
                        <ArrowLeft20Regular className="rotate-180 text-brand" />
                      </CopilotButton>
                    ) : undefined}
                  />

                  {/* Suggestion pills */}
                  <div className="flex flex-wrap gap-2 overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                      <CopilotFilterPill
                        key={suggestion.text}
                        active={false}
                        label={suggestion.text}
                        icon={index === 0 ? <Edit20Regular /> : <DataBarVertical20Regular />}
                        onClick={() => handleSuggestionClick(suggestion.text)}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* What your agent can do */}
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  What your agent can do
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <CapabilityCard
                    title="Add knowledge"
                    description="Choose where your agent should look for answers"
                    icon={<Library24Regular className="text-blue-600" />}
                    onClick={() => navigateToFlow('knowledge')}
                  />
                  <CapabilityCard
                    title="Take an action"
                    description="Add tools your agent can execute"
                    icon={<Wrench24Regular className="text-green-600" />}
                    onClick={() => navigateToFlow('action')}
                  />
                  <CapabilityCard
                    title="Triggers"
                    description="Handle multi-step processes automatically"
                    icon={<BotSparkle24Regular className="text-amber-500" />}
                    onClick={() => navigateToFlow('triggers')}
                  />
                  <CapabilityCard
                    title="Connect other agents"
                    description="Delegate tasks or share components with other agents"
                    icon={<People24Regular className="text-pink-500" />}
                    onClick={() => navigateToFlow('agents')}
                  />
                </div>
              </section>

              {/* Start with apps */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Start with apps
                  </h2>
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    onClick={showAllApps}
                  >
                    See all (18)
                  </CopilotButton>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {['Outlook', 'SharePoint', 'Teams', 'OneDrive', 'Excel'].map(app => (
                    <AppCard
                      key={app}
                      name={app}
                      icon={getAppIcon(app)}
                      onClick={() => handleAppClick(app)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Search Results View */}
          {showSearchResults && (
            <div className="flex flex-col gap-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Search results
              </h1>
              <TopPicksSection
                topPicks={SEARCH_RESULTS_DATA.topPicks}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
              />
              <FilterTabs
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                resultCounts={resultCounts}
              />
              <ResultsList
                results={filteredResults}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onToggleAll={handleToggleAll}
                allSelected={allResultsSelected}
              />
            </div>
          )}

        </div>
      </div>

      {/* Footer — search results only */}

      {showSearchResults && (
        <div className="shrink-0 px-4 sm:px-8 md:px-16 lg:px-24 xl:px-36 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
          {selectedIds.length > 0 && (
            <span className="text-sm text-gray-600 mr-2">
              {selectedIds.length} selected
            </span>
          )}
          <CopilotButton
            variant="primary"
            size="md"
            onClick={handleAddSelected}
            disabled={selectedIds.length === 0}
          >
            {selectedIds.length > 0 ? `Add (${selectedIds.length})` : 'Add'}
          </CopilotButton>
        </div>
      )}

    </div>,
    portalTarget
  );
};
