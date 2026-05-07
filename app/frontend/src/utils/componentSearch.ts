import { Suggestion, SearchResult, FilterTab } from '../components/modals/AddComponentModalTypes';
import { SUGGESTION_DATABASE } from '../data/suggestionDatabase';

/**
 * Filter suggestions based on search query
 * Matches keywords bidirectionally (query contains keyword OR keyword contains query)
 */
export function filterSuggestions(query: string): Suggestion[] {
  if (!query.trim()) {
    return [SUGGESTION_DATABASE[0], SUGGESTION_DATABASE[1]];
  }

  const lowerQuery = query.toLowerCase();
  const matched = SUGGESTION_DATABASE.filter(suggestion =>
    suggestion.keywords.some(keyword =>
      lowerQuery.includes(keyword) || keyword.includes(lowerQuery)
    )
  ).slice(0, 3);

  return matched.length > 0 ? matched : [SUGGESTION_DATABASE[0], SUGGESTION_DATABASE[1]];
}

/**
 * Filter search results by category
 */
export function filterResultsByCategory(
  results: SearchResult[],
  category: FilterTab
): SearchResult[] {
  if (category === 'all') {
    return results;
  }
  return results.filter(item => item.category === category);
}

/**
 * Check if all items in a list are selected
 */
export function areAllSelected(itemIds: string[], selectedIds: string[]): boolean {
  return itemIds.every(id => selectedIds.includes(id));
}

/**
 * Toggle selection for a single item
 */
export function toggleItemSelection(itemId: string, selectedIds: string[]): string[] {
  return selectedIds.includes(itemId)
    ? selectedIds.filter(id => id !== itemId)
    : [...selectedIds, itemId];
}

/**
 * Toggle selection for all items in a list
 */
export function toggleAllItemsSelection(
  itemIds: string[],
  selectedIds: string[]
): string[] {
  const allSelected = areAllSelected(itemIds, selectedIds);

  if (allSelected) {
    return selectedIds.filter(id => !itemIds.includes(id));
  } else {
    return Array.from(new Set([...selectedIds, ...itemIds]));
  }
}
