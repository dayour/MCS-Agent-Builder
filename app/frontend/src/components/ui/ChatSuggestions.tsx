import React from 'react';
import { CopilotButton } from './CopilotButton';

interface ChatSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isProcessing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * ChatSuggestions - Displays a horizontal list of clickable suggestion pills
 * Used in chat interfaces to provide quick reply options
 */
export const ChatSuggestions: React.FC<ChatSuggestionsProps> = ({
  suggestions,
  onSelect,
  isProcessing = false,
  size = 'sm'
}) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 justify-start">
      {suggestions.map((suggestion, index) => (
        <CopilotButton
          key={index}
          variant="secondary"
          size={size}
          onClick={() => onSelect(suggestion)}
          disabled={isProcessing}
          className="!font-normal whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
        >
          {suggestion.length > 60 ? suggestion.slice(0, 57) + '…' : suggestion}
        </CopilotButton>
      ))}
    </div>
  );
};
