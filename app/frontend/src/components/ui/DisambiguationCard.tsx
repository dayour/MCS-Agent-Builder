import React, { useState, useRef } from 'react';
import { Checkmark20Regular, Add20Regular, ArrowUp20Filled } from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';

// =============================================================================
// DISAMBIGUATION CARD - From COMPONENT_PATTERNS.md
// Variants: 'radio' (default), 'simple' (no indicator, instant nav), 'multi' (checkboxes)
// =============================================================================

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Helper to render simple markdown (bold text with **text**)
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export interface DisambiguationOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface DisambiguationCardBaseProps {
  question: string;
  options: DisambiguationOption[];
  current?: number;
  total?: number;
  onCustomSubmit?: (value: string) => void;
  onSkip?: () => void;
  hideOptions?: boolean; // Hide question/options during processing, keep input visible
  showInput?: boolean; // Show input box at bottom (default: true)
  borderless?: boolean; // Render without outer card border (for use inside a container)
}

interface RadioProps extends DisambiguationCardBaseProps {
  variant?: 'radio';
  selected?: string;
  onSelect: (id: string) => void;
  onSubmit?: never;
}

interface SimpleProps extends DisambiguationCardBaseProps {
  variant: 'simple';
  selected?: never;
  onSelect: (id: string) => void;
  onSubmit?: never;
}

interface MultiProps extends DisambiguationCardBaseProps {
  variant: 'multi';
  selected?: never;
  onSelect?: never;
  onSubmit: (ids: string[]) => void;
}

type DisambiguationCardProps = RadioProps | SimpleProps | MultiProps;

export const DisambiguationCard: React.FC<DisambiguationCardProps> = (props) => {
  const {
    question,
    options,
    current,
    total,
    onCustomSubmit,
    variant = 'radio',
    onSkip,
    hideOptions = false,
    showInput = true,
    borderless = false,
  } = props;

  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef<HTMLTextAreaElement>(null);

  // Remove "Other" option from the options list since we'll always show input
  const filteredOptions = options.filter(opt => opt.label.toLowerCase() !== 'other');

  const toggleMulti = (id: string) => {
    setMultiSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCustomSubmit = () => {
    if (customInput.trim() && onCustomSubmit) {
      onCustomSubmit(customInput.trim());
      setCustomInput('');
    }
  };

  return (
    <div className={borderless ? '' : 'max-w-[780px] mx-auto'} data-testid="disambiguation-card">
      {/* Unified container with border around both elements */}
      <div className={borderless ? '' : 'bg-white rounded-xl border border-[hsl(var(--stroke-default))] p-5'}>
        {/* Question + Options container (animated) */}
        <div
          className="animate-slide-up-fade transition-opacity"
          style={{
            opacity: hideOptions ? 0 : 1,
            pointerEvents: hideOptions ? 'none' : 'auto',
            minHeight: hideOptions ? '200px' : 'auto'
          }}
        >
          {/* Question + step indicator on same line */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-body-1-strong">{question}</h4>
            {current !== undefined && total !== undefined && total > 1 && (
              <span className="flex items-center gap-1 text-caption-1 text-gray-900 flex-shrink-0 ml-4">
                <span className="px-0.5">Question {current} of {total}</span>
              </span>
            )}
          </div>

          {/* Options — single container, divided by lines */}
          <div className="border border-[hsl(var(--stroke-default))] overflow-hidden" style={{ borderRadius: borderless ? 'var(--radius-3xl)' : '0.5rem' }}>
            {filteredOptions.map((option, index) => {
            const isLast = index === filteredOptions.length - 1;
            const divider = !isLast ? 'border-b border-[hsl(var(--stroke-default))]' : '';

            if (variant === 'simple') {
              return (
                <button
                  key={option.id}
                  data-testid="disambiguation-option"
                  onClick={() => (props as SimpleProps).onSelect(option.id)}
                  className={cn(
                    "group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                    divider
                  )}
                >
                  {option.icon && (
                    <div className="flex-shrink-0">
                      {option.icon}
                    </div>
                  )}
                  <div className="flex-1">
                    <span className="text-body-1 block">{renderMarkdown(option.label)}</span>
                    {option.description && (
                      <span className="text-caption-1 text-text-subtle">{option.description}</span>
                    )}
                  </div>
                  <ArrowUp20Filled className="w-4 h-4 text-gray-700 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            }

            if (variant === 'multi') {
              const isChecked = multiSelected.has(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleMulti(option.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                    isChecked && "bg-primary/5",
                    divider
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center border-[1.5px] transition-colors flex-shrink-0",
                    isChecked
                      ? "border-primary bg-primary"
                      : "border-[#C4C4C4]"
                  )}>
                    {isChecked && (
                      <Checkmark20Regular className="w-3 h-3 text-white" />
                    )}
                  </div>
                  {option.icon && (
                    <div className="flex-shrink-0">
                      {option.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-body-1 block">{renderMarkdown(option.label)}</span>
                    {option.description && (
                      <span className="text-caption-1 text-text-subtle block truncate">{option.description}</span>
                    )}
                  </div>
                </button>
              );
            }

            // Default: radio
            const radioProps = props as RadioProps;
            const isSelected = radioProps.selected === option.id;
            return (
              <button
                key={option.id}
                onClick={() => radioProps.onSelect(option.id)}
                className={cn(
                  "group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                  isSelected && "bg-primary/5",
                  divider
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-[#C4C4C4]"
                )}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                {option.icon && (
                  <div className="flex-shrink-0">
                    {option.icon}
                  </div>
                )}
                <div className="flex-1">
                  <span className="text-sm block">{renderMarkdown(option.label)}</span>
                  {option.description && (
                    <span className="text-caption-1 text-text-subtle">{option.description}</span>
                  )}
                </div>
                <ArrowUp20Filled className="w-4 h-4 text-gray-700 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
          </div>
        </div>

        {/* Input box at bottom within same container */}
        {showInput && onCustomSubmit && (
          <div className="mt-4 -mx-5 -mb-5 px-3 pb-3 pt-5 border-t border-[hsl(var(--stroke-default))]">
            <textarea
              ref={customInputRef}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && customInput.trim()) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Or type your own answer..."
              className="w-full min-h-[40px] resize-none bg-transparent text-body-1 placeholder:text-text-placeholder focus:outline-none"
              style={{ paddingLeft: '6px' }}
              rows={1}
            />

            {/* Toolbar + Send button row */}
            <div className="flex items-center gap-1 mt-2">
              <button className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-md">
                <Add20Regular className="w-5 h-5" />
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Send button - only visible when there's text */}
              {customInput.trim() && (
                <button
                  onClick={handleCustomSubmit}
                  className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-[hsl(var(--primary-hover))] transition-colors"
                >
                  <ArrowUp20Filled className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer: skip or submit */}
        {(onSkip || variant === 'multi') && (
          <div className="flex items-center gap-3 mt-4">
            {variant === 'multi' && (
              <CopilotButton
                variant="primary"
                size="md"
                onClick={() => (props as MultiProps).onSubmit(Array.from(multiSelected))}
                disabled={multiSelected.size === 0}
              >
                Continue
              </CopilotButton>
            )}
            {onSkip && (
              <CopilotButton
                variant="outline"
                size="md"
                onClick={onSkip}
              >
                Skip
              </CopilotButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisambiguationCard;
