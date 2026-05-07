import React, { useState } from 'react';
import { EnhancedInputSuggestion } from './EnhancedInputSuggestion';
import type { EnhancedInputItem } from './EnhancedInputSuggestion';
import { CopilotButton } from './CopilotButton';

/**
 * EnhancedInputSuggestionList — renders a list of EnhancedInputSuggestion items
 *
 * Three modes:
 *   'text'   — plain suggestions, no selection indicator; items left-aligned
 *   'single' — one-shot selection; clicking fires onSelect immediately
 *   'multi'  — multi-select with toggle; shows Confirm button; calls onSubmit on confirm
 *
 * The parent is responsible for unmounting this component after selection/submission.
 */

export interface EnhancedInputSuggestionListProps {
  items: EnhancedInputItem[];
  mode?: 'text' | 'single' | 'multi';
  onSelect?: (id: string) => void;      // 'text' and 'single' mode
  onSubmit?: (ids: string[]) => void;   // 'multi' mode
  disabled?: boolean;
  confirmLabel?: string;                // defaults to 'Confirm'
}

export const EnhancedInputSuggestionList: React.FC<EnhancedInputSuggestionListProps> = ({
  items,
  mode = 'text',
  onSelect,
  onSubmit,
  disabled = false,
  confirmLabel = 'Confirm',
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Local guards prevent double-fire while waiting for the parent to unmount/disable the list.
  const [submitted, setSubmitted] = useState(false);
  const [singleSelected, setSingleSelected] = useState(false);

  const handleSelect = (item: EnhancedInputItem) => {
    if (disabled || singleSelected) return;

    if (mode === 'text' || mode === 'single') {
      setSingleSelected(true);
      onSelect?.(item.id);
    } else if (mode === 'multi') {
      setSelectedIds(prev =>
        prev.includes(item.id)
          ? prev.filter(id => id !== item.id)
          : [...prev, item.id],
      );
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0 || disabled || submitted) return;
    setSubmitted(true);
    onSubmit?.(selectedIds);
  };

  const isMulti = mode === 'multi';

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Selectable items — grouped for screen readers in multi mode */}
      <div
        role={isMulti ? 'group' : undefined}
        aria-label={isMulti ? 'Select options' : undefined}
        className="flex flex-col gap-2"
      >
        {items.map(item => (
          <EnhancedInputSuggestion
            key={item.id}
            item={item}
            selectable={mode === 'multi'}
            selected={mode === 'multi' ? selectedIds.includes(item.id) : false}
            disabled={disabled || submitted || singleSelected}
            fill={mode === 'single' || mode === 'multi'}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Confirm button outside the group — it's an action, not a group member */}
      {isMulti && (
        <CopilotButton
          variant="primary"
          size="md"
          disabled={selectedIds.length === 0 || disabled || submitted}
          onClick={handleConfirm}
          className="w-full"
        >
          {confirmLabel}
        </CopilotButton>
      )}
    </div>
  );
};

EnhancedInputSuggestionList.displayName = 'EnhancedInputSuggestionList';

export default EnhancedInputSuggestionList;
