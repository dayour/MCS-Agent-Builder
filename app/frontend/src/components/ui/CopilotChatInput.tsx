import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUp20Filled, ArrowRight20Filled, Add20Regular, ArrowUpload20Regular, ArrowUpload20Filled, CloudAdd20Regular, CloudAdd20Filled, GlanceHorizontalSparkles20Regular, GlanceHorizontalSparkles20Filled, Cloud20Regular, Cloud20Filled, Globe20Regular, Globe20Filled, Dismiss12Regular, CursorClick20Regular, CursorClick20Filled, Organization20Regular } from '@fluentui/react-icons';
import { CopilotTooltip } from './CopilotTooltip';
import { CopilotButton } from './CopilotButton';
import { AttachmentTag } from './AttachmentTag';
import { generatePromptSuggestions } from '../../utils/promptSuggestions';
import { CopilotMenu, CopilotMenuItem, CopilotMenuPosition } from './CopilotMenu';

// =============================================================================
// CHAT INPUT BAR - From COMPONENT_PATTERNS.md (with props added)
// =============================================================================
interface CopilotChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  animatedPlaceholders?: string[];
  animatedPlaceholderIndex?: number;
  onAnimationCycleComplete?: () => void;
  onDeletionNearComplete?: () => void;
  onFocusChange?: (focused: boolean) => void;
  isProcessing?: boolean;
  shadow?: 'none' | 'input' | 'md' | 'dropdown';
  rows?: number;
  autoFocus?: boolean;
  sendIcon?: 'up' | 'right';
  uploadedFiles?: File[];
  onRemoveFile?: (index: number) => void;
  onFilesAdded?: (files: File[]) => void;
  /** Prompts shown in the dropdown when the input is empty (replaces animatedPlaceholders slice). */
  featuredPrompts?: string[];
  /** Set to false to suppress the suggestion dropdown entirely (e.g. in the helper agent pane). */
  showSuggestions?: boolean;
  /** Maximum number of visible lines before the textarea scrolls. Defaults to 1 (fixed height). */
  maxRows?: number;
  /** Optional quote chip displayed above the textarea (e.g. CoT node context). */
  quoteChip?: { label: string; type: string; onDismiss: () => void };
  /** Callback to toggle Point to Ask inspection mode. When provided, renders the crosshair button. */
  onPointToAsk?: () => void;
  /** Whether Point to Ask mode is currently active (highlights the button). */
  isPointToAskMode?: boolean;
  /** When provided, renders the Project Mode toggle button. Active state highlights the button. */
  onProjectModeToggle?: () => void;
  /** Whether Project Mode is currently active (highlights the button). */
  isProjectModeActive?: boolean;
  /** Optional external ref to the internal textarea (so parents can call .focus()). */
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

const HISTORY_KEY = 'elevate_prompt_history';
const MAX_HISTORY = 20;

export const CopilotChatInput: React.FC<CopilotChatInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "Ask me anything...",
  animatedPlaceholders,
  animatedPlaceholderIndex,
  onAnimationCycleComplete,
  onDeletionNearComplete,
  onFocusChange,
  isProcessing = false,
  shadow = 'input',
  rows = 1,
  autoFocus = false,
  sendIcon = 'up',
  uploadedFiles = [],
  onRemoveFile,
  onFilesAdded,
  featuredPrompts,
  showSuggestions = true,
  maxRows,
  quoteChip,
  onPointToAsk,
  isPointToAskMode = false,
  onProjectModeToggle,
  isProjectModeActive = false,
  inputRef,
}) => {
  // --- Typewriter state ---
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const cycleCompleteCalledRef = useRef(false);
  const nearCompleteCalledRef = useRef(false);

  // --- Focus / dropdown state ---
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = nothing active
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const preHoverValueRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mirror the textarea node onto an external ref if a parent provided one.
  // Keeps CopilotChatInput as an FC (no forwardRef migration) while letting
  // callers like UnifiedChatPane imperatively focus the input.
  useEffect(() => {
    if (!inputRef) return;
    inputRef.current = textareaRef.current;
    return () => { if (inputRef) inputRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRef]);

  // --- Auto-resize textarea up to maxRows ---
  useEffect(() => {
    if (!maxRows || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10);
    const maxHeight = lineHeight * maxRows + 16; // +16 for top/bottom padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxRows]);

  // --- + button menu state ---
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<CopilotMenuPosition>({});

  // --- Cloud files submenu state ---
  const [isCloudSubMenuOpen, setIsCloudSubMenuOpen] = useState(false);
  const [cloudSubMenuPos, setCloudSubMenuPos] = useState<CopilotMenuPosition>({});

  // --- AI autocomplete state ---
  // typedValue tracks only what the user actually typed — never overwritten by hover/keyboard previews.
  // Dropdown mode (featured vs AI) is driven by typedValue, not value, so hovering a suggestion
  // never accidentally flips the dropdown into "AI loading" mode.
  const [typedValue, setTypedValue] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  // Cache: query (lowercased) → results.
  const suggestionCacheRef = useRef<Map<string, string[]>>(new Map());
  // Always holds the current typedValue so async callbacks can read it without stale closures.
  const typedValueRef = useRef('');
  // Tracks the prefix length of the suggestions currently displayed — prevents shorter/older
  // results from overwriting longer/more-specific ones that arrived first.
  const bestShownQueryLenRef = useRef(0);
  // Shuffled zero-state suggestions shown when input is empty.
  const [shuffledFeatured, setShuffledFeatured] = useState<string[]>(() => {
    const pool = featuredPrompts;
    if (!pool || pool.length === 0) return [];
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 6);
  });
  // Ref keeps the current animated index accessible in effects without adding it to deps
  // (so advancing the typewriter doesn't reshuffle an already-open dropdown).
  const animatedPlaceholderIndexRef = useRef(animatedPlaceholderIndex ?? 0);

  typedValueRef.current = typedValue; // keep ref in sync on every render
  animatedPlaceholderIndexRef.current = animatedPlaceholderIndex ?? 0;

  const isControlled = animatedPlaceholderIndex !== undefined;

  // Load prompt history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setPromptHistory(JSON.parse(stored));
    } catch {}
  }, []);

  // Close dropdown only when clicking outside the entire component
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        onChange(preHoverValueRef.current !== null ? preHoverValueRef.current : value);
        preHoverValueRef.current = null;
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, onChange]);

  // Reshuffle the zero-state dropdown each time it opens with an empty input.
  // Pins the currently-animating placeholder at position 0 so there's a visible
  // connection between what's being typed and the dropdown suggestions.
  // Uses a ref for the animated index so the typewriter advancing mid-session
  // doesn't cause a reshuffle on an already-open dropdown.
  useEffect(() => {
    if (!isDropdownOpen || typedValue.trim()) return;
    const pool = featuredPrompts || (animatedPlaceholders ?? []);
    if (pool.length === 0) return;
    const currentPrompt = (animatedPlaceholders ?? [])[animatedPlaceholderIndexRef.current];
    const hasCurrentInPool = !!currentPrompt && pool.includes(currentPrompt);
    const others = hasCurrentInPool ? pool.filter(p => p !== currentPrompt) : pool;
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, hasCurrentInPool ? 5 : 6);
    setShuffledFeatured(hasCurrentInPool ? [currentPrompt, ...picks] : picks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDropdownOpen, typedValue]);

  // Merges incoming suggestions into the currently-visible list without reordering.
  // Items already on screen that also appear in `next` keep their position;
  // genuinely new items are appended at the bottom. This eliminates the visual
  // "jumping" that happens when multiple in-flight responses arrive in quick succession.
  const stableMerge = (prev: string[], next: string[]): string[] => {
    const nextLower = new Set(next.map(s => s.toLowerCase()));
    const kept = prev.filter(s => nextLower.has(s.toLowerCase()));
    const keptLower = new Set(kept.map(s => s.toLowerCase()));
    const added = next.filter(s => !keptLower.has(s.toLowerCase()));
    return [...kept, ...added].slice(0, 6);
  };

  // AI suggestions with prefix caching.
  // Cache hits are shown immediately. API calls are debounced by 500ms to avoid
  // firing on every keystroke. A `cancelled` flag in the cleanup ensures stale
  // promise handlers are ignored when the effect re-runs or the component unmounts.
  useEffect(() => {
    const query = typedValue.trim();
    if (!query || query.length < 3 || !isDropdownOpen || !showSuggestions) {
      setAiSuggestions([]);
      bestShownQueryLenRef.current = 0;
      return;
    }

    const cache = suggestionCacheRef.current;
    const qLower = query.toLowerCase();

    // Helper: best cached results for a given query
    const bestFromCache = (q: string) => {
      // Exact match first
      if (cache.has(q)) return { results: cache.get(q)!, len: q.length };
      // Walk backwards over prefixes of q to find the longest cached prefix
      for (let prefixLen = q.length - 1; prefixLen > 0; prefixLen--) {
        const prefix = q.slice(0, prefixLen);
        const results = cache.get(prefix);
        if (!results) continue;
        const filtered = results.filter((r: string) => r.toLowerCase().startsWith(q));
        const best = filtered.length > 0 ? filtered : results;
        return { results: best, len: q.length };
      }
      return { results: [], len: 0 };
    };

    // Show cached results immediately (no debounce)
    const { results: cached, len: cachedLen } = bestFromCache(qLower);
    if (cached.length > 0) {
      setAiSuggestions(prev => stableMerge(prev, cached));
      bestShownQueryLenRef.current = cachedLen;
      if (cache.has(qLower)) return; // exact hit — no API call needed
    }

    // Debounce the API call: wait 250ms after the last keystroke before fetching.
    // `cancelled` is set in the cleanup so stale promise handlers are no-ops.
    let cancelled = false;
    const capturedQLower = qLower;
    const capturedQFull = query;
    const debounceTimer = setTimeout(() => {
      generatePromptSuggestions(capturedQFull).then(suggestions => {
        if (cancelled || !suggestions.length) return;
        if (cache.size >= 30) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) cache.delete(firstKey);
        }
        cache.set(capturedQLower, suggestions);

        // Valid to show if current query still starts with what we fetched for,
        // and this result is more specific than what's currently shown.
        const currentLower = typedValueRef.current.trim().toLowerCase();
        if (
          currentLower.startsWith(capturedQLower) &&
          capturedQLower.length > bestShownQueryLenRef.current
        ) {
          const filtered = suggestions.filter((r: string) => r.toLowerCase().startsWith(currentLower));
          const toShow = filtered.length > 0 ? filtered : suggestions;
          setAiSuggestions(prev => stableMerge(prev, toShow));
          bestShownQueryLenRef.current = capturedQLower.length;
        }
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [typedValue, isDropdownOpen, showSuggestions]);

  const saveToHistory = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...promptHistory.filter(p => p !== trimmed)].slice(0, MAX_HISTORY);
    setPromptHistory(updated);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  };

  // Dropdown: shuffled featured prompts when empty, AI suggestions while typing.
  // Always driven by typedValue, never by hover/keyboard preview state.
  const dropdownItems = useMemo(() => {
    if (!isDropdownOpen) return [];
    const query = typedValue.trim();
    if (!query) return shuffledFeatured;
    // While typing, only show AI suggestions — never show stale featured prompts.
    // Dropdown closes instantly on first keystroke and snaps back in when results arrive.
    return aiSuggestions;
  }, [isDropdownOpen, typedValue, shuffledFeatured, aiSuggestions]);

  const isDropdownVisible = showSuggestions && isDropdownOpen && dropdownItems.length > 0;

  // Bold the longest leading prefix shared between the suggestion and query.
  // When early results arrive (fetched for a shorter query), we still bold
  // however much of the typed text the suggestion starts with — so bolding
  // is always instant and only grows as more specific results arrive.
  const highlightMatch = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const tLower = text.toLowerCase();
    const qLower = query.toLowerCase();
    // Find longest prefix of query that text starts with (check full length first for speed)
    let boldLen = 0;
    for (let i = qLower.length; i >= 1; i--) {
      if (tLower.startsWith(qLower.slice(0, i))) { boldLen = i; break; }
    }
    if (boldLen > 0) {
      return (
        <>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{text.slice(0, boldLen)}</span>
          {text.slice(boldLen)}
        </>
      );
    }
    // Fallback: highlight anywhere in text (used for featured prompts)
    const idx = tLower.indexOf(qLower);
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-[hsl(var(--text-primary))]">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // Reset active index when dropdown closes
  useEffect(() => {
    if (!isDropdownOpen) setActiveIndex(-1);
  }, [isDropdownOpen]);

  // -------------------------------------------------------------------------
  // Typewriter effects
  // -------------------------------------------------------------------------

  // When parent advances the index, reset the typewriter for the new prompt.
  useEffect(() => {
    if (!isControlled) return;
    setDisplayText('');
    setIsDeleting(false);
    setCharIndex(0);
    // Note: do NOT reset cycleCompleteCalledRef here. The typewriter effect runs
    // in the same commit with the old state (isDeleting=true, charIndex=0) and
    // would immediately re-fire onAnimationCycleComplete if the ref were cleared
    // synchronously. The ref is reset by the effect below once isDeleting has
    // actually flipped to false.
  }, [animatedPlaceholderIndex, isControlled]);

  // Reset the cycle-complete guards only after isDeleting has fully settled to
  // false — i.e., after the state update from the reset above has been processed.
  useEffect(() => {
    if (!isDeleting) {
      cycleCompleteCalledRef.current = false;
      nearCompleteCalledRef.current = false;
    }
  }, [isDeleting]);

  useEffect(() => {
    if (!animatedPlaceholders || animatedPlaceholders.length === 0 || value || isFocused) return;

    const activeIndex = isControlled
      ? (animatedPlaceholderIndex ?? 0)
      : loopIndex;
    const current = animatedPlaceholders[activeIndex % animatedPlaceholders.length];
    const typingSpeed = 30;
    const deletingSpeed = 20;
    const pauseBeforeDelete = 5000;
    const pauseBeforeType = 500;

    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex < current.length) {
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, typingSpeed);
    } else if (!isDeleting && charIndex === current.length) {
      timeout = setTimeout(() => setIsDeleting(true), pauseBeforeDelete);
    } else if (isDeleting && charIndex > 0) {
      // Fire near-complete callback when a handful of chars remain so the
      // parent can start fading the header word slightly before deletion ends.
      if (charIndex <= 20 && !nearCompleteCalledRef.current) {
        nearCompleteCalledRef.current = true;
        onDeletionNearComplete?.();
      }
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      }, deletingSpeed);
    } else if (isDeleting && charIndex === 0) {
      if (isControlled) {
        // Notify parent once; stall until parent changes animatedPlaceholderIndex.
        if (!cycleCompleteCalledRef.current) {
          cycleCompleteCalledRef.current = true;
          onAnimationCycleComplete?.();
        }
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setLoopIndex(loopIndex + 1);
        }, pauseBeforeType);
      }
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, loopIndex, animatedPlaceholderIndex, animatedPlaceholders, value, isFocused, isControlled, onDeletionNearComplete, onAnimationCycleComplete]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSend = () => {
    if (value.trim() && !isProcessing) {
      saveToHistory(value);
      onSend();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, dropdownItems.length - 1);
        preHoverValueRef.current = preHoverValueRef.current ?? value;
        setActiveIndex(next);
        onChange(dropdownItems[next]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, -1);
        setActiveIndex(prev);
        if (prev >= 0) {
          onChange(dropdownItems[prev]);
        } else {
          const restored = preHoverValueRef.current ?? value;
          preHoverValueRef.current = null;
          setTypedValue(restored);
          onChange(restored);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsDropdownOpen(false);
        const restored = preHoverValueRef.current ?? value;
        preHoverValueRef.current = null;
        setTypedValue(restored);
        onChange(restored);
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        preHoverValueRef.current = null;
        const item = dropdownItems[activeIndex];
        if (item.trim() && !isProcessing) {
          saveToHistory(item);
          onChange(item);
          onSend();
        }
        setActiveIndex(-1);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- + button menu handlers ---
  const handleAddButtonClick = () => {
    if (!addButtonRef.current) return;
    setIsDropdownOpen(false);
    const rect = addButtonRef.current.getBoundingClientRect();
    setAddMenuPos({ top: rect.bottom + 8, left: rect.left });
    setIsAddMenuOpen(true);
  };

  const handleAttachFile = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = 'image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.ppt,.pptx';
    fileInputRef.current.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFilesAdded?.(files);
    e.target.value = '';
  };

  // Timer ref used to delay-close the cloud submenu so the user can move the
  // mouse from the "Attach cloud files" row into the submenu without it flickering.
  const cloudSubMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (cloudSubMenuCloseTimerRef.current) clearTimeout(cloudSubMenuCloseTimerRef.current); }, []);

  // Opens the cloud-files submenu to the right of the main menu.
  // "Attach cloud files" is the 2nd item (index 1). With py-1 menu padding (4px)
  // and ~36px per size="md" item, its top edge is at addMenuPos.top + 4 + 36.
  const openCloudSubMenu = () => {
    if (cloudSubMenuCloseTimerRef.current) {
      clearTimeout(cloudSubMenuCloseTimerRef.current);
      cloudSubMenuCloseTimerRef.current = null;
    }
    setCloudSubMenuPos({
      top: (addMenuPos.top ?? 0) + 4 + 36,
      left: (addMenuPos.left ?? 0) + 240,
    });
    setIsCloudSubMenuOpen(true);
  };

  const scheduleCloseCloudSubMenu = () => {
    cloudSubMenuCloseTimerRef.current = setTimeout(() => {
      setIsCloudSubMenuOpen(false);
      cloudSubMenuCloseTimerRef.current = null;
    }, 200);
  };

  const cloudSubMenuItems: CopilotMenuItem[] = [
    { label: 'OneDrive',   icon: <Cloud20Regular />,  iconFilled: <Cloud20Filled />,  onClick: () => {} },
    { label: 'SharePoint', icon: <Globe20Regular />,  iconFilled: <Globe20Filled />,  onClick: () => {} },
  ];

  const addMenuItems: CopilotMenuItem[] = [
    { label: 'Upload images and files', icon: <ArrowUpload20Regular />, iconFilled: <ArrowUpload20Filled />, onClick: handleAttachFile },
    { label: 'Attach cloud files',      icon: <CloudAdd20Regular />,   iconFilled: <CloudAdd20Filled />,   hasSubMenu: true, onMouseEnter: openCloudSubMenu, onMouseLeave: scheduleCloseCloudSubMenu },
    { label: 'Tools',                   icon: <GlanceHorizontalSparkles20Regular />, iconFilled: <GlanceHorizontalSparkles20Filled />, disabled: true },
  ];

  const showAnimatedPlaceholder = !!animatedPlaceholders && !value && !isFocused;

  return (
    <div ref={containerRef}>
      {/* Input container — relative so dropdown anchors to its bottom edge */}
      <div
        className={`relative border border-border px-3 pb-3 pt-5 bg-[hsl(var(--card))] focus-within:border-[hsl(var(--text-disabled))] transition-all ${
          shadow === 'dropdown' ? 'shadow-dropdown' : shadow === 'md' ? 'shadow-md' : shadow === 'none' ? 'shadow-none' : 'shadow-input'
        }`}
        style={{ borderRadius: 'var(--radius-3xl)' }}
      >
        {/* Quote chip — CoT node context */}
        {quoteChip && (
          <div className="flex flex-wrap gap-1.5 mb-2 px-1.5">
            <div className="inline-flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full pl-2.5 pr-1 py-0.5 max-w-xs">
              <span className="text-[hsl(var(--text-disabled))] leading-none text-sm select-none mr-0.5">{'\u201C'}</span>
              <span className="truncate text-xs font-medium text-[hsl(var(--text-primary))]">{quoteChip.label}</span>
              <button
                type="button"
                onClick={quoteChip.onDismiss}
                className="ml-0.5 h-4 w-4 flex items-center justify-center rounded-full hover:bg-[hsl(var(--secondary-hover))] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-subtle))] flex-shrink-0 transition-colors"
                aria-label="Remove context"
              >
                <Dismiss12Regular />
              </button>
            </div>
          </div>
        )}

        {/* File attachment tags */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1.5">
            {uploadedFiles.map((file, index) => (
              <AttachmentTag
                key={`${file.name}-${index}`}
                file={file}
                onRemove={onRemoveFile ? () => onRemoveFile(index) : undefined}
              />
            ))}
          </div>
        )}

        {/* Text input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { const v = e.target.value; setTypedValue(v); onChange(v); setIsDropdownOpen(true); setActiveIndex(-1); }}
            onKeyDown={handleKeyDown}
            onFocus={() => { setIsFocused(true); setIsDropdownOpen(true); onFocusChange?.(true); }}
            onBlur={() => { setIsFocused(false); onFocusChange?.(false); }}
            placeholder={showAnimatedPlaceholder ? undefined : placeholder}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isDropdownVisible}
            aria-autocomplete="list"
            aria-controls={isDropdownVisible ? 'copilot-suggestions-listbox' : undefined}
            aria-activedescendant={isDropdownVisible && activeIndex >= 0 ? `copilot-suggestion-${activeIndex}` : undefined}
            className="w-full min-h-[40px] resize-none bg-transparent text-body-1 placeholder:text-text-placeholder focus:outline-none"
            style={{
              paddingLeft: '6px',
              // Hide the native caret when the animated placeholder is showing so
              // the animation cursor is the only one visible.
              caretColor: showAnimatedPlaceholder ? 'transparent' : undefined,
            }}
            rows={rows}
            autoFocus={autoFocus}
          />

          {/* Animated placeholder overlay */}
          {showAnimatedPlaceholder && (
            <div
              aria-hidden
              className="absolute top-0 left-0 pointer-events-none text-body-1 text-text-placeholder select-none"
              style={{ paddingLeft: '6px' }}
            >
              {displayText}
              <span
                className="inline-block w-[1.5px] h-[1em] bg-current align-middle ml-[1px]"
                style={{ animation: 'cursor-blink 1s step-end infinite' }}
              />
            </div>
          )}
        </div>

        {/* Toolbar + Send button row */}
        <div className="flex items-center gap-1 mt-2">
          <CopilotTooltip content="Add files and tools" placement="top">
            <button
              ref={addButtonRef}
              onClick={handleAddButtonClick}
              className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-md"
            >
              <Add20Regular className="w-5 h-5" />
            </button>
          </CopilotTooltip>
          {onProjectModeToggle && (
            <CopilotTooltip content="Project mode" placement="top" askContext="Project Mode — Compose a multi-artifact AI system to solve an enterprise problem. Combines agents, workflows, connectors, and more on a visual canvas driven by natural language.">
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={onProjectModeToggle}
                className={`h-8 w-8 !px-0 hover:bg-muted rounded-md ${isProjectModeActive ? '!text-brand' : '!text-inherit'}`}
              >
                <Organization20Regular className="w-5 h-5" />
              </CopilotButton>
            </CopilotTooltip>
          )}
          {onPointToAsk && (
            <CopilotTooltip content="Point to ask about a UI element" placement="top" askContext="Point to Ask — Enters an inspection mode where you can hover over any UI element to highlight it and click to automatically ask the helper agent what it does. The question is pre-filled with context about the selected element.">
              <CopilotButton
                variant="ghost"
                size="sm"
                onClick={onPointToAsk}
                className={`h-8 w-8 !px-0 hover:bg-muted rounded-md ${isPointToAskMode ? '!text-brand' : '!text-inherit'}`}
              >
                {isPointToAskMode
                  ? <CursorClick20Filled className="w-5 h-5" />
                  : <CursorClick20Regular className="w-5 h-5" />
                }
              </CopilotButton>
            </CopilotTooltip>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send button - only visible when there's text */}
          {value.trim() && (
            <button
              onClick={handleSend}
              disabled={isProcessing}
              className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50 transition-colors"
            >
              {sendIcon === 'right' ? <ArrowRight20Filled className="w-5 h-5" /> : <ArrowUp20Filled className="w-5 h-5" />}
            </button>
          )}
        </div>

        {/* Dropdown: suggestion prompts when open and input is empty, AI suggestions when typing */}
        {isDropdownVisible && (
          <div
            id="copilot-suggestions-listbox"
            role="listbox"
            aria-label="Prompt suggestions"
            className="absolute left-0 right-0 top-full mt-3 bg-[hsl(var(--card))] border border-border rounded-3xl shadow-dropdown overflow-hidden z-50 py-2"
            onMouseLeave={() => {
              setActiveIndex(-1);
              const restored = preHoverValueRef.current ?? value;
              preHoverValueRef.current = null;
              setTypedValue(restored);
              onChange(restored);
            }}
          >
            {/* Intentionally using raw <button> here: CopilotButton overrides className
                internally and cannot accommodate listbox-option styling. role="option"
                also requires semantic parity with the listbox role on the container. */}
            {dropdownItems.map((item, i) => (
              <button
                key={`${item}-${i}`}
                id={`copilot-suggestion-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`w-full text-left px-4 py-2.5 text-body-1 transition-colors flex items-center justify-between gap-3 ${
                  i === activeIndex ? 'bg-[hsl(var(--muted))] text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-primary))]'
                }`}
                onMouseEnter={() => {
                  preHoverValueRef.current = preHoverValueRef.current ?? value;
                  setActiveIndex(i);
                  onChange(item);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  preHoverValueRef.current = null;
                  if (item.trim() && !isProcessing) {
                    saveToHistory(item);
                    onChange(item);
                    onSend();
                  }
                }}
              >
                <span>{highlightMatch(item, typedValue.trim())}</span>
                <ArrowRight20Filled className={`w-4 h-4 text-[hsl(var(--text-subtle))] transition-opacity flex-shrink-0 ${i === activeIndex ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer - outside the input box */}
      <p className={`text-caption-2 text-text-subtle mt-1.5 text-center ${isDropdownVisible ? 'invisible' : ''}`}>
        AI-generated content may be incorrect
      </p>

      {/* + button menu — rendered outside the input container to avoid clipping */}
      {isAddMenuOpen && (
        <CopilotMenu
          items={addMenuItems}
          position={addMenuPos}
          onClose={() => setIsAddMenuOpen(false)}
          size="md"
          minWidth={240}
        />
      )}

      {/* Cloud files submenu */}
      {isCloudSubMenuOpen && (
        <CopilotMenu
          items={cloudSubMenuItems}
          position={cloudSubMenuPos}
          onClose={() => setIsCloudSubMenuOpen(false)}
          size="md"
          minWidth={160}
          onMouseEnter={() => {
            if (cloudSubMenuCloseTimerRef.current) {
              clearTimeout(cloudSubMenuCloseTimerRef.current);
              cloudSubMenuCloseTimerRef.current = null;
            }
          }}
          onMouseLeave={scheduleCloseCloudSubMenu}
        />
      )}
    </div>
  );
};

export default CopilotChatInput;
