import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { callModel } from '../utils/modelClient';
import { KNOWN_TRIGGERS, KNOWN_TOOLS, KNOWN_CONNECTORS } from '../utils/agentCatalog';
import { AgentConfig } from '../types';
import { useAgent } from '../context/AgentContext';
import { getConnectorIcon } from '../utils/agentIcons';
import {
  SlashMenuItem,
  getTriggerFriendlyName,
  formatActionDisplayName,
  getKnowledgeSubtitle,
  getTriggerChannel,
  getServiceFluentIcon,
  menuFluentIcon,
  fluentIconStyle,
  resolveComponentIcon,
  getCapabilityIcon,
} from '../utils/buildPageUtils';
import {
  Flash20Regular,
  ArrowRepeatAll20Regular,
  FlowSparkle20Regular,
  Image20Regular,
  DocumentPdf20Regular,
  DocumentText20Regular,
} from '@fluentui/react-icons';

/** Debounce interval for pushing an undo snapshot after a pause in typing. */
export const INSTRUCTIONS_UNDO_DEBOUNCE_MS = 500;

/** Maximum number of lines allowed in the instructions editor. */
export const MAX_INSTRUCTIONS_LINES = 1000;

// Re-export so consumers don't need to reach into buildPageUtils directly
export type { SlashMenuItem };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the updated capabilities array after inserting a slash-menu item.
 *  Extracts the capability name from the `[[...]]` bracket in editText,
 *  strips the "Tool: " prefix (matching renderLineWithPills behaviour),
 *  and deduplicates by name. */
function buildNewCapabilities(
  item: SlashMenuItem,
  existingCaps: AgentConfig['capabilities'],
): AgentConfig['capabilities'] {
  const capMatch = item.editText.match(/\[\[([^\]]+)\]\]/);
  const rawCapName = capMatch?.[1] ?? item.label;
  const capName = rawCapName.startsWith('Tool: ') ? rawCapName.substring(6) : rawCapName;
  const capType: 'knowledge' | 'action' = item.category === 'Knowledge' ? 'knowledge' : 'action';
  const caps = existingCaps || [];
  return caps.some(c => c.name === capName)
    ? caps
    : [...caps, { name: capName, type: capType }];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Capability {
  id: number;
  type: 'knowledge' | 'action' | 'connector' | 'trigger';
  label: string;
  icon: React.ReactNode;
  color: string;
}

export interface SlashState {
  active: boolean;
  query: string;
  position: { top: number; left: number };
  cursorBottom: number;
  cursorLeft: number;
  highlightedIndex: number;
  tab: 'suggested' | 'skills' | 'triggers' | 'tools' | 'knowledge' | 'topic' | 'agents';
  localContext: string;
  /** Header item with keyboard focus: 0–4 = tabs, 5 = globe/URL, 6 = upload, 7 = SharePoint */
  headerFocusIdx: number;
}

const INITIAL_SLASH_STATE: SlashState = {
  active: false,
  query: '',
  position: { top: 0, left: 0 },
  cursorBottom: 0,
  cursorLeft: 0,
  highlightedIndex: 0,
  tab: 'suggested',
  localContext: '',
  headerFocusIdx: 0,
};

// ── Hook params ───────────────────────────────────────────────────────────────

export interface UseSlashMenuParams {
  agentConfig: AgentConfig;
  updateAgentConfig: (updates: Partial<AgentConfig>) => void;
  contentEditableRef: React.MutableRefObject<HTMLDivElement | null>;
  instructionsBoxRef: React.MutableRefObject<HTMLDivElement | null>;
  editableText: string;
  setEditableText: (text: string) => void;
  setContentEditableKey: React.Dispatch<React.SetStateAction<number>>;
  setIsEditing: (v: boolean) => void;
  readDOMIntoEditableText: (el: HTMLElement) => string;
  /** Shared ref created at BuildPage level — prevents blur from firing during pill insertion. */
  isSlashInsertingRef: React.MutableRefObject<boolean>;
  /** Shared ref created at BuildPage level — prevents blur when URL input grabs focus. */
  urlInputActiveRef: React.MutableRefObject<boolean>;
  /** Shared ref created at BuildPage level — accumulates draft text from onInput for handleBlur to read. */
  draftTextRef: React.MutableRefObject<string | null>;
}

// ── Hook return ───────────────────────────────────────────────────────────────

export interface UseSlashMenuReturn {
  // State
  slashState: SlashState;
  setSlashState: React.Dispatch<React.SetStateAction<SlashState>>;
  urlInputMode: boolean;
  setUrlInputMode: React.Dispatch<React.SetStateAction<boolean>>;
  urlInputValue: string;
  setUrlInputValue: React.Dispatch<React.SetStateAction<string>>;
  addButtonMenuOpen: boolean;
  setAddButtonMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aiSuggestedItems: SlashMenuItem[] | null;
  // Refs
  slashMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  slashAnchorRef: React.MutableRefObject<{ node: Node; offset: number } | null>;
  addInsertionRangeRef: React.MutableRefObject<Range | null>;
  slashStateRef: React.MutableRefObject<SlashState>;
  filteredSlashItemsRef: React.MutableRefObject<SlashMenuItem[]>;
  suggestedCacheRef: React.MutableRefObject<{ context: string; items: SlashMenuItem[] } | null>;
  pendingFileRangeRef: React.MutableRefObject<Range | null>;
  pendingCursorEditTextRef: React.MutableRefObject<string | null>;
  isSlashInsertingRef: React.MutableRefObject<boolean>;
  urlInputActiveRef: React.MutableRefObject<boolean>;
  openedViaAddButtonRef: React.MutableRefObject<boolean>;
  uploadInputRef: React.MutableRefObject<HTMLInputElement | null>;
  draftTextRef: React.MutableRefObject<string | null>;
  // Computed
  slashMenuItems: SlashMenuItem[];
  tabFilteredItems: SlashMenuItem[];
  filteredSlashItems: SlashMenuItem[];
  capabilities: Capability[];
  // Handlers
  cancelSlashCommand: () => void;
  handleSlashSelect: (item: SlashMenuItem) => void;
  handleInstructionsKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleInstructionsInput: () => void;
  resetSlashState: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSlashMenu({
  agentConfig,
  updateAgentConfig,
  contentEditableRef,
  instructionsBoxRef,
  editableText,
  setEditableText,
  setContentEditableKey,
  setIsEditing,
  readDOMIntoEditableText,
  isSlashInsertingRef,
  urlInputActiveRef,
  draftTextRef,
}: UseSlashMenuParams): UseSlashMenuReturn {
  const { updateWithHistory, addCapabilityToInstructions } = useAgent();

  // ── Slash command state ────────────────────────────────────────────────────

  const [slashState, setSlashState] = useState<SlashState>(INITIAL_SLASH_STATE);
  const [urlInputMode, setUrlInputMode] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  // True only when the slash menu was opened via the + Add button (not the / key).
  // Used to light up the + Add button while its menu is open.
  const [addButtonMenuOpen, setAddButtonMenuOpen] = useState(false);
  const [aiSuggestedItems, setAiSuggestedItems] = useState<SlashMenuItem[] | null>(null);

  // ── Slash command refs ─────────────────────────────────────────────────────

  const slashAnchorRef = useRef<{ node: Node; offset: number } | null>(null);
  const slashMenuRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  // Cache: keyed by localContext, cleared when the menu closes
  const suggestedCacheRef = useRef<{ context: string; items: SlashMenuItem[] } | null>(null);
  // Refs for global keydown handler (avoids stale closures)
  const filteredSlashItemsRef = useRef<SlashMenuItem[]>([]);
  const slashStateRef = useRef(slashState);
  // Stores the cursor position saved when "Local files" was selected — used to insert file pills
  const pendingFileRangeRef = useRef<Range | null>(null);
  // After text-based pill insertion, stores the editText of the inserted item so
  // useLayoutEffect can place the cursor after the React-rendered pill.
  const pendingCursorEditTextRef = useRef<string | null>(null);
  // isSlashInsertingRef and urlInputActiveRef are passed in from BuildPage
  // so useBuildPageEditor's handleBlur can read the same ref values.
  const openedViaAddButtonRef = useRef(false);
  const addInsertionRangeRef = useRef<Range | null>(null);
  // draftTextRef is now shared from BuildPage via params — see UseSlashMenuParams

  // Debounce timer: pushes an undo step after a pause in typing without requiring blur.
  // The callback re-reads draftTextRef.current at fire time so that if blur fires first
  // (which clears draftTextRef to null), the timer is a safe no-op and avoids double-push.
  const draftHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (draftHistoryTimerRef.current) clearTimeout(draftHistoryTimerRef.current);
    };
  }, []);

  // Clear any pending debounce when the agent changes so a stale draft isn't
  // pushed against the wrong agent's history stack.
  useEffect(() => {
    if (draftHistoryTimerRef.current) {
      clearTimeout(draftHistoryTimerRef.current);
      draftHistoryTimerRef.current = null;
    }
  }, [agentConfig.id]);

  // ── capabilities useMemo ──────────────────────────────────────────────────

  const capabilities = React.useMemo<Capability[]>(() => {
    const agentCaps = agentConfig.capabilities || [];
    return agentCaps.length > 0
      ? agentCaps.map((cap, index) => ({
          id: index + 1,
          type: cap.type as Capability['type'],
          label: cap.name,
          icon: getCapabilityIcon(cap.type),
          color: 'text-brand-purple border-gray-300',
        }))
      : [];
  }, [agentConfig.capabilities]);

  // ── slashMenuItems useMemo ────────────────────────────────────────────────

  // All items available in the slash command menu
  const slashMenuItems = React.useMemo<SlashMenuItem[]>(() => {
    return [
      ...KNOWN_TRIGGERS.map(name => {
        const ch = getTriggerChannel(name);
        const isRecurrence = name.toLowerCase().includes('recurrence');
        const dashIdx = name.indexOf(' - ');
        const channelPrefix = dashIdx !== -1 ? name.substring(0, dashIdx) : undefined;
        // Common aliases so users can search "m365" for "Microsoft 365", etc.
        const CHANNEL_SEARCH_ALIASES: Record<string, string> = { 'microsoft 365': 'm365 copilot' };
        const aliasKeywords = ch ? CHANNEL_SEARCH_ALIASES[ch] : undefined;
        return {
          id: `trigger-${name}`,
          label: getTriggerFriendlyName(name),
          subtitle: channelPrefix ?? 'Trigger',
          searchKeywords: aliasKeywords,
          category: 'Trigger',
          editText: ch ? `{{icon:${ch}}} [[${name}]]` : `[[${name}]]`,
          icon: ch
            ? (getConnectorIcon(ch, 'w-6 h-6') ?? menuFluentIcon(<Flash20Regular style={fluentIconStyle} />))
            : isRecurrence
              ? menuFluentIcon(<ArrowRepeatAll20Regular style={fluentIconStyle} />)
              : menuFluentIcon(<Flash20Regular style={fluentIconStyle} />),
        };
      }),
      ...KNOWN_CONNECTORS.map(name => ({
        id: `connector-${name}`,
        label: name,
        category: 'Action',
        subtitle: 'Tool',
        editText: `[[${name}]]`,
        icon: getConnectorIcon(name.toLowerCase(), 'w-6 h-6') ?? menuFluentIcon(<FlowSparkle20Regular style={fluentIconStyle} />),
      })),
      ...KNOWN_TOOLS.map(name => {
        const dashIdx = name.indexOf(' - ');
        const serviceKey = dashIdx !== -1 ? name.substring(0, dashIdx).toLowerCase() : name.toLowerCase();
        return {
          id: `tool-${name}`,
          label: formatActionDisplayName(name),
          category: 'Action',
          subtitle: 'Tool',
          editText: `[[Tool: ${name}]]`,
          icon: getConnectorIcon(serviceKey, 'w-6 h-6') ?? getServiceFluentIcon(serviceKey) ?? menuFluentIcon(<FlowSparkle20Regular style={fluentIconStyle} />),
        };
      }),
      ...(agentConfig.capabilities || []).map(cap => {
        let capIcon: React.ReactNode = resolveComponentIcon(cap.name, cap.type, 'w-6 h-6');
        if (!capIcon && /\.\w{2,5}$/.test(cap.name.trim())) {
          const lower = cap.name.toLowerCase();
          if (lower.match(/\.(jpe?g|png|gif|svg|webp|bmp|tiff?)$/)) capIcon = menuFluentIcon(<Image20Regular style={fluentIconStyle} />);
          else if (lower.endsWith('.pdf'))                           capIcon = menuFluentIcon(<DocumentPdf20Regular style={fluentIconStyle} />);
          else                                                       capIcon = menuFluentIcon(<DocumentText20Regular style={fluentIconStyle} />);
        }
        return {
          id: `cap-${cap.name}`,
          label: cap.name,
          category: cap.type === 'knowledge' ? 'Knowledge' : cap.type === 'trigger' ? 'Trigger' : 'Action',
          subtitle: cap.type === 'knowledge' ? getKnowledgeSubtitle(cap.name) : undefined,
          editText: `[[${cap.name}]]`,
          icon: capIcon ?? getCapabilityIcon(cap.type),
        };
      }),
    ];
  }, [agentConfig.capabilities]);  

  // ── tabFilteredItems useMemo ──────────────────────────────────────────────

  // Items filtered by the active tab
  const tabFilteredItems = React.useMemo<SlashMenuItem[]>(() => {
    switch (slashState.tab) {
      case 'suggested':
        return aiSuggestedItems ?? [];
      case 'skills':
        return []; // Skills tab renders its own list from AgentContext
      case 'triggers':
        return slashMenuItems.filter(item => item.category === 'Trigger');
      case 'tools':
        return slashMenuItems.filter(item => item.category === 'Action');
      case 'knowledge':
        return slashMenuItems.filter(item => item.category === 'Knowledge');
      default:
        return slashMenuItems;
    }
  }, [slashMenuItems, slashState.tab, aiSuggestedItems]);  

  // ── filteredSlashItems useMemo ────────────────────────────────────────────

  // Filtered items based on current slash query + active tab.
  // When a query is typed, search across all items so the tab doesn't gate results.
  const filteredSlashItems = React.useMemo<SlashMenuItem[]>(() => {
    if (!slashState.active) return [];
    const q = slashState.query.trim().toLowerCase();
    if (q === '') return tabFilteredItems;
    const words = q.split(/\s+/).filter(Boolean);
    return slashMenuItems.filter(item => {
      const searchable = `${item.label} ${item.subtitle ?? ''} ${item.searchKeywords ?? ''}`.toLowerCase();
      return words.every(w => searchable.includes(w));
    });
  }, [slashMenuItems, tabFilteredItems, slashState.active, slashState.query]);

  // ── Keep refs in sync ─────────────────────────────────────────────────────

  useEffect(() => { filteredSlashItemsRef.current = filteredSlashItems; }, [filteredSlashItems]);
  useEffect(() => { slashStateRef.current = slashState; }, [slashState]);

  // ── resetSlashState (called from handleBlur in editor) ────────────────────

  const resetSlashState = () => {
    setSlashState(INITIAL_SLASH_STATE);
    setUrlInputMode(false);
    setUrlInputValue('');
    setAddButtonMenuOpen(false);
  };

  // ── cancelSlashCommand ────────────────────────────────────────────────────

  const cancelSlashCommand = () => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode && contentEditableRef.current) {
      try {
        const anchorNode = sel.anchorNode;
        const anchorOffset = sel.anchorOffset;
        if (anchorNode.nodeType === Node.TEXT_NODE) {
          const nodeText = anchorNode.textContent || '';
          let slashPos = -1;
          for (let i = anchorOffset - 1; i >= 0; i--) {
            if (nodeText[i] === '/') { slashPos = i; break; }
          }
          if (slashPos !== -1) {
            const range = document.createRange();
            range.setStart(anchorNode, slashPos);
            range.setEnd(anchorNode, anchorOffset);
            range.deleteContents();
            const newRange = document.createRange();
            newRange.setStart(anchorNode, slashPos);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }
      } catch (_) { /* ignore range errors */ }
    }
    openedViaAddButtonRef.current = false;
    addInsertionRangeRef.current = null;
    urlInputActiveRef.current = false;
    setSlashState(INITIAL_SLASH_STATE);
    setUrlInputMode(false);
    setUrlInputValue('');
    setAddButtonMenuOpen(false);
    slashAnchorRef.current = null;
    draftTextRef.current = null; // slash cancelled — draft (which had the "/" in it) is stale
  };

  // ── Dismiss menu on click outside ─────────────────────────────────────────

  useEffect(() => {
    if (!slashState.active) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (slashMenuRef.current?.contains(target)) return;
      // Reset state directly — avoids stale-closure issues with cancelSlashCommand
      openedViaAddButtonRef.current = false;
      addInsertionRangeRef.current = null;
      urlInputActiveRef.current = false;
      slashAnchorRef.current = null;
      draftTextRef.current = null;
      setSlashState(INITIAL_SLASH_STATE);
      setUrlInputMode(false);
      setUrlInputValue('');
      setAddButtonMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slashState.active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global keydown handler for slash menu ─────────────────────────────────

  // Global keydown handler for slash menu — covers Add-button path where
  // contentEditable may not be focused. Skips if target IS the contentEditable
  // (those events are already handled by handleInstructionsKeyDown).
  useEffect(() => {
    if (!slashState.active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === contentEditableRef.current) return; // handled by onKeyDown
      // Don't intercept keys when focus is inside a text input (e.g. URL input, trigger search)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const tabs = ['suggested', 'skills', 'triggers', 'tools', 'knowledge'] as const;
      const items = filteredSlashItemsRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashState(prev => ({ ...prev, highlightedIndex: Math.min(prev.highlightedIndex + 1, Math.max(0, items.length - 1)) }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashState(prev => ({ ...prev, highlightedIndex: Math.max(prev.highlightedIndex - 1, 0) }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSlashState(prev => {
          const nextIdx = Math.min(prev.headerFocusIdx + 1, 7); // 0-4=tabs, 5=globe, 6=upload, 7=sharepoint
          const newTab = nextIdx <= 4 ? tabs[nextIdx] : prev.tab;
          return { ...prev, headerFocusIdx: nextIdx, tab: newTab, highlightedIndex: 0 };
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlashState(prev => {
          const prevIdx = Math.max(prev.headerFocusIdx - 1, 0);
          const newTab = prevIdx <= 4 ? tabs[prevIdx] : prev.tab;
          return { ...prev, headerFocusIdx: prevIdx, tab: newTab, highlightedIndex: 0 };
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const hfi = slashStateRef.current.headerFocusIdx;
        if (hfi === 5) { urlInputActiveRef.current = true; setUrlInputMode(true); return; }
        if (hfi === 6) { uploadInputRef.current?.click(); return; }
        const selected = items[slashStateRef.current.highlightedIndex];
        if (selected) handleSlashSelect(selected);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setSlashState(prev => ({ ...prev, query: prev.query.slice(0, -1), highlightedIndex: 0 }));
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSlashState(prev => ({ ...prev, query: prev.query + e.key, highlightedIndex: 0 }));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelSlashCommand();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [slashState.active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI suggestions effect ─────────────────────────────────────────────────

  // Fetch AI-powered suggestions from Claude when the Suggested tab is active.
  // Results are cached by localContext for the lifetime of the menu session so
  // switching tabs and returning to Suggested doesn't trigger a second fetch.
  useEffect(() => {
    if (!slashState.active) {
      // Menu closed — clear cache and reset items for the next session
      setAiSuggestedItems(null);
      suggestedCacheRef.current = null;
      return;
    }
    if (slashState.tab !== 'suggested') return;

    // Cache hit: same context as last fetch — restore immediately, no spinner
    if (suggestedCacheRef.current?.context === slashState.localContext) {
      setAiSuggestedItems(suggestedCacheRef.current.items);
      return;
    }

    setAiSuggestedItems(null); // show loading spinner
    let cancelled = false;

    (async () => {
      const text = editableText || '';
      const candidates = slashMenuItems.filter(
        (item: SlashMenuItem) => !item.onSelect && !text.includes(`[[${item.label}]]`) && !text.includes(item.editText)
      );

      // Split by category for balanced sampling
      const triggerPool   = candidates.filter(i => i.category === 'Trigger');
      const actionPool    = candidates.filter(i => i.category === 'Action');
      const knowledgePool = candidates.filter(i => i.category === 'Knowledge');

      const balancedFallback = (): SlashMenuItem[] => {
        const t = triggerPool.slice(0, 2);
        const a = actionPool.slice(0, 2);
        const k = knowledgePool.slice(0, 1);
        return [...t, ...a, ...k].slice(0, 5);
      };

      try {
        if (candidates.length === 0) {
          const result: SlashMenuItem[] = [];
          suggestedCacheRef.current = { context: slashState.localContext, items: result };
          if (!cancelled) setAiSuggestedItems(result);
          return;
        }

        // Determine category bias from cursor context
        const beforeCursor = (slashState.localContext || '').split(' ').slice(0, -1).join(' ').toLowerCase();
        const lastFewWords = beforeCursor.split(/\s+/).slice(-5).join(' ');
        const triggerWords   = ['when', 'whenever', 'if', 'upon', 'triggered', 'trigger', 'once', 'after', 'starts'];
        const actionWords    = ['send', 'create', 'post', 'update', 'add', 'get', 'fetch', 'delete', 'save', 'notify', 'reply', 'forward', 'move', 'generate', 'translate'];
        const knowledgeWords = ['knows', 'knowledge', 'access', 'information', 'documents', 'data', 'refer'];
        const isTriggerCtx   = triggerWords.some(w => lastFewWords.includes(w));
        const isActionCtx    = actionWords.some(w => lastFewWords.includes(w));
        const isKnowledgeCtx = knowledgeWords.some(w => lastFewWords.includes(w));

        // Pre-sample a BALANCED set so Claude sees a manageable, representative list.
        // Sending 80+ actions to haiku causes it to default to whatever comes first (triggers).
        const maxTriggers  = isTriggerCtx   ? 5 : isActionCtx ? 2 : 3;
        const maxActions   = isActionCtx    ? 8 : isTriggerCtx ? 3 : 5;
        const maxKnowledge = isKnowledgeCtx ? 5 : 3;
        const sampled = [
          ...triggerPool.slice(0, maxTriggers),
          ...actionPool.slice(0, maxActions),
          ...knowledgePool.slice(0, maxKnowledge),
        ];

        const itemList = sampled
          .map(item => `  { "id": ${JSON.stringify(item.id)}, "label": ${JSON.stringify(item.label)}, "category": ${JSON.stringify(item.category)} }`)
          .join(',\n');

        const categoryHint =
          isTriggerCtx   ? 'Context suggests a TRIGGER is needed. Include 2-3 triggers.' :
          isActionCtx    ? 'Context suggests an ACTION is needed. Include 2-3 actions.' :
          isKnowledgeCtx ? 'Context suggests a KNOWLEDGE source is needed. Include 2-3 knowledge items.' :
          'No strong context signal — return a balanced mix across all categories.';

        const rawResponse = await callModel({
          model: 'fast',
          maxTokens: 150,
          system: 'You suggest capabilities to insert in AI agent instructions. Return ONLY a JSON array of item IDs — no explanation, no markdown.',
          messages: [{
            role: 'user',
            content: `The user is writing agent instructions and wants to insert a capability at their cursor.

Context: ${categoryHint}
IMPORTANT: Return a BALANCED MIX — include items from multiple categories (Trigger, Action, Knowledge) unless the context strongly demands one type. Aim for 1-2 triggers, 1-2 actions, and 1 knowledge item in your 5 results.

Available capabilities:
[
${itemList}
]

Full instructions so far:
${text || '(empty)'}

Insertion point context:
${slashState.localContext || '(no context)'}

Return a JSON array of exactly 5 item IDs ordered by relevance. Example: ["trigger-foo", "tool-bar", "cap-baz"]`,
          }],
        });

        if (cancelled) return;
        const jsonStr = rawResponse.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        const ids: string[] = JSON.parse(jsonStr);
        const idSet = new Set(ids);
        const ordered = ids
          .map(id => sampled.find(item => item.id === id))
          .filter(Boolean) as SlashMenuItem[];

        // Enforce minimum diversity: if result lacks actions or knowledge, inject some
        const addFromPool = (pool: SlashMenuItem[], min: number) => {
          pool.filter(i => !idSet.has(i.id)).slice(0, min).forEach(i => {
            if (ordered.length < 5) { ordered.push(i); idSet.add(i.id); }
          });
        };
        if (ordered.filter(i => i.category === 'Action').length === 0)    addFromPool(actionPool, 2);
        if (ordered.filter(i => i.category === 'Knowledge').length === 0) addFromPool(knowledgePool, 1);
        if (ordered.filter(i => i.category === 'Trigger').length === 0)   addFromPool(triggerPool, 1);

        const result = ordered.slice(0, 5);
        suggestedCacheRef.current = { context: slashState.localContext, items: result };
        if (!cancelled) setAiSuggestedItems(result);
      } catch (err) {
        console.error('Slash suggestions fetch failed:', err);
        if (!cancelled) {
          const fallbackItems = balancedFallback();
          setAiSuggestedItems(fallbackItems);
          suggestedCacheRef.current = { context: slashState.localContext, items: fallbackItems };
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- editableText intentionally omitted: fetching on every keystroke would be too aggressive; localContext already captures the relevant cursor context and re-triggers when it changes
  }, [slashState.active, slashState.tab, slashState.localContext, slashMenuItems]);

  // ── handleSlashSelect ─────────────────────────────────────────────────────

  const handleSlashSelect = (item: SlashMenuItem) => {
    if (!contentEditableRef.current) return;

    // ── Items with custom onSelect (e.g. Local files picker) ─────────────────
    if (item.onSelect) {
      pendingFileRangeRef.current = addInsertionRangeRef.current;
      openedViaAddButtonRef.current = false;
      addInsertionRangeRef.current = null;
      slashAnchorRef.current = null;
      draftTextRef.current = null;
      setSlashState(INITIAL_SLASH_STATE);
      setUrlInputMode(false);
      setUrlInputValue('');
      setAddButtonMenuOpen(false);
      item.onSelect();
      return;
    }

    // ── Add-button path: insert at saved cursor range (or end of text) ──────
    if (openedViaAddButtonRef.current) {
      openedViaAddButtonRef.current = false;

      // Triggers are placed in the "Where this agent works:" line, not at cursor
      if (item.category === 'Trigger') {
        const triggerName = item.editText.replace(/^\{\{icon:[^}]+\}\}\s*/, '').replace(/^\[\[/, '').replace(/\]\]$/, '');
        addCapabilityToInstructions(triggerName, 'trigger', '');
        isSlashInsertingRef.current = true;
        setContentEditableKey(k => k + 1);
        setTimeout(() => {
          isSlashInsertingRef.current = false;
          setTimeout(() => contentEditableRef.current?.focus(), 0);
        }, 0);
        addInsertionRangeRef.current = null;
        setSlashState(INITIAL_SLASH_STATE);
        setUrlInputMode(false);
        setUrlInputValue('');
        setAddButtonMenuOpen(false);
        slashAnchorRef.current = null;
        draftTextRef.current = null;
        return;
      }

      try {
        const savedRange = addInsertionRangeRef.current;
        let idx = -1;
        let baseText = '';

        if (savedRange && contentEditableRef.current.contains(savedRange.startContainer)) {
          const range = savedRange.cloneRange();
          range.collapse(true);
          const placeholder = document.createTextNode('\uFFFD');
          range.insertNode(placeholder);
          const textWithPlaceholder = readDOMIntoEditableText(contentEditableRef.current);
          placeholder.parentNode?.removeChild(placeholder);
          idx = textWithPlaceholder.indexOf('\uFFFD');
          baseText = textWithPlaceholder;
        } else {
          // No saved cursor — append at end
          baseText = (editableText || '') + '\uFFFD';
          idx = baseText.length - 1;
        }

        if (idx !== -1) {
          const newText = baseText.slice(0, idx) + item.editText + baseText.slice(idx + 1);

          // Also register the capability so the pill renders with the correct
          // icon and type (knowledge / action).
          updateWithHistory({ instructions: newText, capabilities: buildNewCapabilities(item, agentConfig.capabilities) });
          pendingCursorEditTextRef.current = item.editText;
          isSlashInsertingRef.current = true;
          setEditableText(newText);
          setContentEditableKey(k => k + 1);
          setTimeout(() => {
            isSlashInsertingRef.current = false;
            setTimeout(() => contentEditableRef.current?.focus(), 0);
          }, 0);
        }
      } catch (_) { /* ignore range errors */ }

      addInsertionRangeRef.current = null;
      setSlashState(INITIAL_SLASH_STATE);
      setUrlInputMode(false);
      setUrlInputValue('');
      setAddButtonMenuOpen(false);
      slashAnchorRef.current = null;
      draftTextRef.current = null;
      return;
    }

    // ── Slash-command path: find "/" in live DOM and replace ─────────────────

    // Triggers are placed in the "Where this agent works:" line, not at cursor
    if (item.category === 'Trigger') {
      // Remove the "/" + query from the DOM using slashAnchorRef (reliable even
      // after sub-view navigation that may have moved the live DOM selection).
      const triggerAnchor = slashAnchorRef.current;
      if (
        triggerAnchor &&
        triggerAnchor.node.nodeType === Node.TEXT_NODE &&
        contentEditableRef.current?.contains(triggerAnchor.node)
      ) {
        try {
          const nodeText = (triggerAnchor.node as Text).textContent || '';
          const deleteEnd = Math.min(triggerAnchor.offset + 1 + slashStateRef.current.query.length, nodeText.length);
          const slashRange = document.createRange();
          slashRange.setStart(triggerAnchor.node, triggerAnchor.offset);
          slashRange.setEnd(triggerAnchor.node, deleteEnd);
          slashRange.deleteContents();
          const cleaned = readDOMIntoEditableText(contentEditableRef.current);
          setEditableText(cleaned);
          updateAgentConfig({ instructions: cleaned });
        } catch (_) { /* ignore range errors */ }
      } else {
        // Fallback: scan backward from live selection
        const slashSel = window.getSelection();
        if (slashSel?.anchorNode?.nodeType === Node.TEXT_NODE) {
          const nodeText = slashSel.anchorNode.textContent || '';
          for (let i = slashSel.anchorOffset - 1; i >= 0; i--) {
            if (nodeText[i] === '/') {
              const slashRange = document.createRange();
              slashRange.setStart(slashSel.anchorNode, i);
              slashRange.setEnd(slashSel.anchorNode, slashSel.anchorOffset);
              slashRange.deleteContents();
              const cleaned = readDOMIntoEditableText(contentEditableRef.current);
              setEditableText(cleaned);
              updateAgentConfig({ instructions: cleaned });
              break;
            }
          }
        }
      }
      const triggerName = item.editText.replace(/^\{\{icon:[^}]+\}\}\s*/, '').replace(/^\[\[/, '').replace(/\]\]$/, '');
      addCapabilityToInstructions(triggerName, 'trigger', '');
      isSlashInsertingRef.current = true;
      setContentEditableKey(k => k + 1);
      setTimeout(() => {
        isSlashInsertingRef.current = false;
        setTimeout(() => contentEditableRef.current?.focus(), 0);
      }, 0);
      setSlashState(INITIAL_SLASH_STATE);
      setUrlInputMode(false);
      setUrlInputValue('');
      setAddButtonMenuOpen(false);
      slashAnchorRef.current = null;
      draftTextRef.current = null;
      return;
    }

    // Prefer slashAnchorRef (the exact node/offset where "/" was typed) over
    // scanning the live selection — sub-view navigation can leave the DOM
    // selection on a non-text node, causing silent early returns.
    let slashAnchorNode: Node | null = null;
    let slashPos = -1;

    const savedAnchor = slashAnchorRef.current;
    if (
      savedAnchor &&
      savedAnchor.node.nodeType === Node.TEXT_NODE &&
      contentEditableRef.current?.contains(savedAnchor.node)
    ) {
      slashAnchorNode = savedAnchor.node;
      slashPos = savedAnchor.offset;
    } else {
      // Fallback: scan backward from live cursor
      const sel = window.getSelection();
      if (sel?.anchorNode?.nodeType === Node.TEXT_NODE) {
        const nodeText = sel.anchorNode.textContent || '';
        for (let i = sel.anchorOffset - 1; i >= 0; i--) {
          if (nodeText[i] === '/') { slashAnchorNode = sel.anchorNode; slashPos = i; break; }
        }
      }
    }

    if (!slashAnchorNode || slashPos === -1) {
      // Couldn't locate the "/" — close the menu without inserting
      setSlashState(INITIAL_SLASH_STATE);
      setUrlInputMode(false);
      setUrlInputValue('');
      setAddButtonMenuOpen(false);
      slashAnchorRef.current = null;
      draftTextRef.current = null;
      return;
    }

    try {
      const nodeText = (slashAnchorNode as Text).textContent || '';
      const queryLen = slashStateRef.current.query.length;
      const deleteEnd = Math.min(slashPos + 1 + queryLen, nodeText.length);

      const range = document.createRange();
      range.setStart(slashAnchorNode, slashPos);
      range.setEnd(slashAnchorNode, deleteEnd);
      range.deleteContents();

      // Insert a unique placeholder character at the cursor so we can locate
      // the insertion point when we reconstruct the text string.
      const placeholder = document.createTextNode('\uFFFD');
      range.insertNode(placeholder);

      // Reconstruct the full editableText with the placeholder in it
      const textWithPlaceholder = readDOMIntoEditableText(contentEditableRef.current);
      const idx = textWithPlaceholder.indexOf('\uFFFD');

      // Remove the placeholder — React will own the final DOM from here
      placeholder.parentNode?.removeChild(placeholder);

      if (idx !== -1) {
        const newText =
          textWithPlaceholder.slice(0, idx) +
          item.editText +
          textWithPlaceholder.slice(idx + 1);

        // Register the capability so the pill gets the correct icon/type
        updateWithHistory({ instructions: newText, capabilities: buildNewCapabilities(item, agentConfig.capabilities) });

        // Set the pending cursor before state updates so useLayoutEffect
        // can place it immediately after the remount.
        pendingCursorEditTextRef.current = item.editText;

        // Increment contentEditableKey to force a full remount of the
        // contentEditable div. This wipes the Range-manipulated DOM (which
        // has split text nodes that React would otherwise double-insert)
        // and renders a clean DOM from newText.
        // isSlashInsertingRef suppresses the blur that fires on unmount.
        isSlashInsertingRef.current = true;
        setEditableText(newText);
        setContentEditableKey(k => k + 1);
        setTimeout(() => {
          isSlashInsertingRef.current = false;
          setTimeout(() => contentEditableRef.current?.focus(), 0);
        }, 0);
      }
    } catch (_) { /* ignore range errors */ }

    setSlashState(INITIAL_SLASH_STATE);
    setUrlInputMode(false);
    setUrlInputValue('');
    setAddButtonMenuOpen(false);
    slashAnchorRef.current = null;
    draftTextRef.current = null; // pill just inserted — draft is stale, clear it
  };

  // ── handleInstructionsKeyDown ─────────────────────────────────────────────

  const handleInstructionsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Intercept Backspace on an empty bullet list item to delete the whole row cleanly.
    // Without this, Chrome needs multiple presses: one to remove the \u200b anchor and
    // another (or more) to collapse our custom <li> structure.
    if (e.key === 'Backspace' && !slashState.active) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== contentEditableRef.current) {
          if ((node as HTMLElement).tagName === 'LI') break;
          node = node.parentNode;
        }
        if (node && (node as HTMLElement).tagName === 'LI') {
          const li = node as HTMLElement;
          const childSpans = Array.from(li.children) as HTMLElement[];
          const contentSpan = childSpans.length >= 1 ? childSpans[childSpans.length - 1] : null;
          if (contentSpan) {
            const contentText = (contentSpan.textContent ?? '').replace(/\u200b/g, '');
            if (contentText === '') {
              e.preventDefault();
              try {
                const ul = li.parentElement;
                const prevLi = li.previousElementSibling as HTMLElement | null;
                li.remove();
                // If <ul> is now empty, remove it too
                if (ul && ul.children.length === 0) ul.remove();
                // Move cursor to end of previous <li>'s content span
                if (prevLi) {
                  const prevSpans = Array.from(prevLi.children) as HTMLElement[];
                  const prevContent = prevSpans[prevSpans.length - 1] as HTMLElement | undefined;
                  if (prevContent) {
                    const range = document.createRange();
                    range.selectNodeContents(prevContent);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                  }
                }
                if (contentEditableRef.current) {
                  contentEditableRef.current.dispatchEvent(new InputEvent('input', { bubbles: true }));
                }
              } catch (err) { if (process.env.NODE_ENV === 'development') console.warn('Backspace handler DOM error:', err); }
              return;
            }
          }
        }
      }
    }

    // Intercept Enter inside a bullet list item so we can insert a properly-structured
    // <li> (with marker span) instead of the browser's bare split.
    if (e.key === 'Enter' && !slashState.active) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== contentEditableRef.current) {
          if ((node as HTMLElement).tagName === 'LI') break;
          node = node.parentNode;
        }
        if (node && (node as HTMLElement).tagName === 'LI') {
          const li = node as HTMLElement;
          const childSpans = Array.from(li.children) as HTMLElement[];
          // Identify marker and content spans
          const markerSpan = childSpans.length >= 2 ? childSpans[0] : null;
          const contentSpan = childSpans.length >= 1 ? childSpans[childSpans.length - 1] : null;
          if (contentSpan) {
            e.preventDefault();
            try {
              const isDash = markerSpan?.textContent?.trim() === '−' || markerSpan?.textContent?.trim() === '-';

              // Split content at cursor: extract everything after cursor into the new <li>
              const range = sel.getRangeAt(0);
              const afterRange = document.createRange();
              afterRange.setStart(range.endContainer, range.endOffset);
              afterRange.setEnd(contentSpan, contentSpan.childNodes.length);
              const afterFragment = afterRange.extractContents();

              // Build new <li> with our marker+content structure
              const newLi = document.createElement('li');
              newLi.className = li.className;

              const newMarker = document.createElement('span');
              newMarker.className = markerSpan?.className ?? 'text-gray-400 mt-0.5 flex-shrink-0';
              newMarker.textContent = isDash ? '−' : '•';
              newMarker.contentEditable = 'false';

              const newContent = document.createElement('span');
              // Ensure explicit foreground color so text never inherits gray-400 from the marker span.
              const baseClass = contentSpan.className;
              newContent.className = baseClass.includes('text-gray-900') ? baseClass : [baseClass, 'text-gray-900'].filter(Boolean).join(' ');
              // Always prepend an empty text node as a cursor anchor. Chrome normalises
              // an element-level caret at offset 0 to the end of the *previous* sibling's
              // text node (the marker "•"), causing typed text to land in the wrong span
              // with the wrong colour. A text-node-level position avoids that.
              const cursorAnchor = document.createTextNode('\u200b');
              newContent.appendChild(cursorAnchor);
              const hasRealContent = afterFragment.textContent !== '' ||
                Array.from(afterFragment.childNodes).some(n => n.nodeName !== 'BR' && n.textContent !== '');
              if (hasRealContent) newContent.appendChild(afterFragment);

              newLi.appendChild(newMarker);
              newLi.appendChild(newContent);
              li.after(newLi);

              // Cursor inside the text-node anchor — prevents Chrome from normalising
              // the caret to the marker span.
              const newRange = document.createRange();
              newRange.setStart(cursorAnchor, 1);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              // Sync draft
              if (contentEditableRef.current) {
                contentEditableRef.current.dispatchEvent(new InputEvent('input', { bubbles: true }));
              }
              return;
            } catch (err) { if (process.env.NODE_ENV === 'development') console.warn('Enter handler DOM error:', err); }
          }
        }
      }
    }

    if (!slashState.active) return;
    // URL input inside the menu has focus — let it handle its own keys
    if (urlInputMode) return;

    const tabs = ['suggested', 'triggers', 'tools', 'knowledge'] as const;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashState(prev => ({
        ...prev,
        highlightedIndex: Math.min(prev.highlightedIndex + 1, Math.max(0, filteredSlashItems.length - 1)),
      }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashState(prev => ({
        ...prev,
        highlightedIndex: Math.max(prev.highlightedIndex - 1, 0),
      }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSlashState(prev => {
        const nextIdx = Math.min(prev.headerFocusIdx + 1, 6); // 0-3=tabs, 4=globe, 5=upload, 6=sharepoint
        const newTab = nextIdx <= 3 ? tabs[nextIdx] : prev.tab;
        return { ...prev, headerFocusIdx: nextIdx, tab: newTab, highlightedIndex: 0 };
      });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSlashState(prev => {
        const prevIdx = Math.max(prev.headerFocusIdx - 1, 0);
        const newTab = prevIdx <= 3 ? tabs[prevIdx] : prev.tab;
        return { ...prev, headerFocusIdx: prevIdx, tab: newTab, highlightedIndex: 0 };
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hfi = slashState.headerFocusIdx;
      if (hfi === 5) { urlInputActiveRef.current = true; setUrlInputMode(true); return; }
      if (hfi === 6) { uploadInputRef.current?.click(); return; }
      const selected = filteredSlashItems[slashState.highlightedIndex];
      if (selected) handleSlashSelect(selected);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelSlashCommand();
    } else if (e.key === 'Backspace' && slashState.query === '') {
      // The slash itself is about to be deleted — exit slash mode
      cancelSlashCommand();
      e.preventDefault();
    }
  };

  // ── handleInstructionsInput ───────────────────────────────────────────────

  const handleInstructionsInput = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    if (!slashState.active) {
      // Detect "/" just typed
      if (sel.anchorNode.nodeType === Node.TEXT_NODE) {
        const text = sel.anchorNode.textContent || '';
        const offset = sel.anchorOffset;
        if (offset > 0 && text[offset - 1] === '/') {
          const rawRange = sel.getRangeAt(0);
          // A collapsed caret range returns a zero rect in many browsers; extend
          // left by 1 char to cover the "/" then use getClientRects which is more
          // reliable than getBoundingClientRect for text ranges.
          const clonedRange = rawRange.cloneRange();
          clonedRange.setStart(clonedRange.startContainer, Math.max(0, clonedRange.startOffset - 1));
          const clientRects = clonedRange.getClientRects();
          const rect: DOMRect = clientRects.length > 0
            ? clientRects[clientRects.length - 1]
            : clonedRange.getBoundingClientRect();
          const containerEl = instructionsBoxRef.current;
          if (containerEl) {
            const menuWidth = 500; // generous estimate for repositioning clamp
            const menuHeight = 280;
            const boxRect = containerEl.getBoundingClientRect();
            // Shift left so the menu doesn't run off the right edge of the Instructions box
            const naturalLeft = Math.max(boxRect.left, rect.left);
            const clampedLeft = Math.min(naturalLeft, boxRect.right - menuWidth);
            // Flip above the cursor if the menu would overflow the viewport bottom
            // (use window.innerHeight since the menu is position: fixed)
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow >= menuHeight + 4
              ? rect.bottom + 4
              : rect.top - menuHeight - 4;
            // Extract text surrounding the "/" for relevance scoring in Suggested tab
            const slashPos = offset - 1;
            const localContext = text.slice(Math.max(0, slashPos - 150), slashPos) + ' '
              + text.slice(slashPos + 1, Math.min(text.length, slashPos + 150));
            setSlashState({
              active: true,
              query: '',
              position: {
                top: Math.max(8, top),
                left: clampedLeft,
              },
              cursorBottom: rect.bottom,
              cursorLeft: rect.left,
              highlightedIndex: 0,
              tab: 'suggested',
              localContext,
              headerFocusIdx: 0,
            });
            // Record position OF "/" (offset - 1 is the "/" character)
            slashAnchorRef.current = { node: sel.anchorNode, offset: offset - 1 };
          }
        }
      }
    } else {
      // Update query as user types after "/"
      if (slashAnchorRef.current && sel.anchorNode === slashAnchorRef.current.node) {
        const text = sel.anchorNode.textContent || '';
        const slashPos = slashAnchorRef.current.offset;
        const newQuery = text.slice(slashPos + 1, sel.anchorOffset);
        setSlashState(prev => ({ ...prev, query: newQuery, highlightedIndex: 0 }));
      } else if (slashAnchorRef.current && sel.anchorNode !== slashAnchorRef.current.node) {
        // Cursor moved to a different node — cancel slash mode
        setSlashState(prev => ({ ...prev, active: false, query: '' }));
        slashAnchorRef.current = null;
      }
    }

    // While not in slash mode, keep draftTextRef up-to-date with each keystroke.
    // Reading the DOM here (immediately after the input event) is safe — the
    // browser has just committed the change and React hasn't re-rendered yet.
    if (!slashState.active && contentEditableRef.current) {
      const raw = readDOMIntoEditableText(contentEditableRef.current);
      const lines = raw.split('\n');
      draftTextRef.current = lines.length > MAX_INSTRUCTIONS_LINES
        ? lines.slice(0, MAX_INSTRUCTIONS_LINES).join('\n')
        : raw;

      // Debounce an undo push so history is recorded after a natural pause in
      // typing, not only on blur. The callback re-reads draftTextRef at fire
      // time: if blur fires first it clears the ref to null, making this a no-op
      // and avoiding a double-push.
      if (draftHistoryTimerRef.current) clearTimeout(draftHistoryTimerRef.current);
      draftHistoryTimerRef.current = setTimeout(() => {
        draftHistoryTimerRef.current = null;
        const draft = draftTextRef.current;
        if (draft === null) return; // blur already handled it
        draftTextRef.current = null;
        setEditableText(draft);
        updateWithHistory({ instructions: draft });
      }, INSTRUCTIONS_UNDO_DEBOUNCE_MS);
    }
  };

  // ── Cursor positioning useLayoutEffect ───────────────────────────────────

  // After a text-based pill insertion, place the cursor immediately after the
  // React-rendered pill — runs synchronously before the browser paints so the
  // cursor never visibly jumps.
  useLayoutEffect(() => {
    const editText = pendingCursorEditTextRef.current;
    if (!editText || !contentEditableRef.current) return;

    const pills = Array.from(
      contentEditableRef.current.querySelectorAll<HTMLElement>('[data-edit-text]')
    ).filter(el => el.getAttribute('data-edit-text') === editText);
    const pill = pills.at(-1);
    if (pill) {
      pendingCursorEditTextRef.current = null;
      const afterRange = document.createRange();
      afterRange.setStartAfter(pill);
      afterRange.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(afterRange);
      }
    }
  }); // intentionally no deps — runs after every render until pill is found

  // ── Scroll highlighted item into view ─────────────────────────────────────

  // Scroll the highlighted slash menu item into view when navigating with arrows.
  useEffect(() => {
    if (!slashMenuRef.current || !slashState.active) return;
    const item = slashMenuRef.current.querySelector<HTMLElement>(
      `[data-slash-index="${slashState.highlightedIndex}"]`
    );
    if (!item) return;
    // If a category header sits immediately before this button, scroll to the
    // header so it stays visible (handles the top of the list and any mid-list
    // category boundary when arrowing upward).
    const prev = item.previousElementSibling as HTMLElement | null;
    const target = prev && !prev.hasAttribute('data-slash-index') ? prev : item;
    target.scrollIntoView({ block: 'nearest' });
  }, [slashState.highlightedIndex, slashState.active]);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    slashState,
    setSlashState,
    urlInputMode,
    setUrlInputMode,
    urlInputValue,
    setUrlInputValue,
    addButtonMenuOpen,
    setAddButtonMenuOpen,
    aiSuggestedItems,
    // Refs
    slashMenuRef,
    slashAnchorRef,
    addInsertionRangeRef,
    slashStateRef,
    filteredSlashItemsRef,
    suggestedCacheRef,
    pendingFileRangeRef,
    pendingCursorEditTextRef,
    isSlashInsertingRef,
    urlInputActiveRef,
    openedViaAddButtonRef,
    uploadInputRef,
    draftTextRef,
    // Computed
    slashMenuItems,
    tabFilteredItems,
    filteredSlashItems,
    capabilities,
    // Handlers
    cancelSlashCommand,
    handleSlashSelect,
    handleInstructionsKeyDown,
    handleInstructionsInput,
    resetSlashState,
  };
}
