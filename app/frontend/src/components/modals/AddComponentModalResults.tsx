import React from 'react';
import { SearchResult, FilterTab } from './AddComponentModalTypes';
import { CheckboxChecked20Filled, CheckboxUnchecked20Regular } from '@fluentui/react-icons';
import { CopilotFilterPill, CopilotButton } from '../ui';

/**
 * TopPicksSection Component
 * Displays top 3 suggested results
 */
interface TopPicksSectionProps {
  topPicks: SearchResult[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
}

export const TopPicksSection: React.FC<TopPicksSectionProps> = ({
  topPicks,
  selectedIds,
  onToggleSelection
}) => {
  if (topPicks.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Top picks for you</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {topPicks.map(item => (
          <div
            key={item.id}
            role="checkbox"
            aria-checked={selectedIds.includes(item.id)}
            aria-labelledby={`item-title-${item.id}`}
            tabIndex={0}
            onClick={() => onToggleSelection(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelection(item.id);
              }
            }}
            className={`
              bg-white border rounded-xl p-4
              hover:border-brand hover:shadow-md
              transition-all cursor-pointer
              ${selectedIds.includes(item.id) ? 'border-brand ring-2 ring-brand/20' : 'border-gray-200'}
            `}
          >
            {/* Checkbox */}
            <div className="flex justify-end mb-2">
              {selectedIds.includes(item.id) ? (
                <CheckboxChecked20Filled className="text-brand" />
              ) : (
                <CheckboxUnchecked20Regular className="text-gray-400" />
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <h3 id={`item-title-${item.id}`} className="text-sm font-semibold text-gray-900">{item.title}</h3>
              <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
              <span className="inline-block px-2 py-0.5 bg-gray-100 text-xs text-gray-700 rounded">
                {item.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * FilterTabs Component
 * Category filter tabs
 */
interface FilterTabsProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  resultCounts: Record<FilterTab, number>;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  resultCounts
}) => {
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'tools', label: 'Tools' },
    { key: 'agents', label: 'Agents' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'others', label: 'Others' },
  ];

  return (
    <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
      {tabs.map(tab => (
        <CopilotFilterPill
          key={tab.key}
          active={activeFilter === tab.key}
          label={tab.label}
          count={resultCounts[tab.key] || 0}
          onClick={() => onFilterChange(tab.key)}
          size="sm"
        />
      ))}
    </div>
  );
};

/**
 * ResultItem Component
 * Individual search result with checkbox
 */
interface ResultItemProps {
  item: SearchResult;
  isSelected: boolean;
  onToggle: () => void;
}

export const ResultItem: React.FC<ResultItemProps> = ({
  item,
  isSelected,
  onToggle
}) => (
  <div
    role="checkbox"
    aria-checked={isSelected}
    aria-labelledby={`item-title-${item.id}`}
    tabIndex={0}
    onClick={onToggle}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    }}
    className={`
      w-full flex items-start gap-3 p-3 rounded-lg
      hover:bg-gray-50 transition-all cursor-pointer
      ${isSelected ? 'bg-brand/5' : ''}
    `}
  >
    {/* Checkbox */}
    <div className="flex-shrink-0 mt-0.5">
      {isSelected ? <CheckboxChecked20Filled className="text-brand" /> : <CheckboxUnchecked20Regular className="text-gray-400" />}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <h3 id={`item-title-${item.id}`} className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
      <p className="text-xs text-gray-600 mb-1.5">{item.description}</p>
      <span className="inline-block px-2 py-0.5 bg-gray-100 text-xs text-gray-700 rounded">
        {item.type}
      </span>
    </div>
  </div>
);

/**
 * ResultsList Component
 * List of search results with select all
 */
interface ResultsListProps {
  results: SearchResult[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

export const ResultsList: React.FC<ResultsListProps> = ({
  results,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  allSelected
}) => {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No results found</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </h2>
        <CopilotButton
          onClick={onToggleAll}
          variant="transparent"
          size="sm"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </CopilotButton>
      </div>

      <div className="space-y-1">
        {results.map(item => (
          <ResultItem
            key={item.id}
            item={item}
            isSelected={selectedIds.includes(item.id)}
            onToggle={() => onToggleSelection(item.id)}
          />
        ))}
      </div>
    </section>
  );
};
