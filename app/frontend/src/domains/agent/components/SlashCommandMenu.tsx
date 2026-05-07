import React, { useState, useEffect, useMemo } from 'react';
import { AgentConfig } from '../../../types';
import { SlashState, SlashMenuItem } from '../../../hooks/useSlashMenu';
import { useAgent } from '../../../context/AgentContext';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { resolveComponentIcon } from '../../../utils/buildPageUtils';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { toSentenceCase } from '../../../utils/skillUtils';
import {
  Globe20Regular,
  Globe20Filled,
  ArrowUpload20Regular,
  ArrowUpload20Filled,
  BookStar20Regular,
  Search20Regular,
  ChevronRight20Regular,
  ChevronLeft20Regular,
} from '@fluentui/react-icons';

interface SlashCommandMenuProps {
  slashState: SlashState;
  filteredSlashItems: SlashMenuItem[];
  aiSuggestedItems: SlashMenuItem[] | null;
  urlInputMode: boolean;
  urlInputValue: string;
  /** True when opened via the + Add button (shows blinking cursor indicator) */
  addButtonMenuOpen: boolean;
  slashMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  uploadInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isSlashInsertingRef: React.MutableRefObject<boolean>;
  urlInputActiveRef: React.MutableRefObject<boolean>;
  openedViaAddButtonRef: React.MutableRefObject<boolean>;
  slashAnchorRef: React.MutableRefObject<{ node: Node; offset: number } | null>;
  addInsertionRangeRef: React.MutableRefObject<Range | null>;
  pendingFileRangeRef: React.MutableRefObject<Range | null>;
  agentConfig: AgentConfig;
  contentEditableRef: React.MutableRefObject<HTMLDivElement | null>;
  editableText: string;
  setEditableText: (text: string) => void;
  setContentEditableKey: React.Dispatch<React.SetStateAction<number>>;
  setUrlInputMode: (v: boolean) => void;
  setUrlInputValue: (v: string) => void;
  setSlashState: React.Dispatch<React.SetStateAction<SlashState>>;
  setAddButtonMenuOpen: (v: boolean) => void;
  pendingCursorEditTextRef: React.MutableRefObject<string | null>;
  readDOMIntoEditableText: (el: HTMLElement) => string;
  onSelectItem: (item: SlashMenuItem) => void;
}

const CATEGORY_NAV = [
  { label: 'Skills',    tab: 'skills'    as const },
  { label: 'Triggers',  tab: 'triggers'  as const },
  { label: 'Knowledge', tab: 'knowledge' as const },
  { label: 'Tools',     tab: 'tools'     as const },
  { label: 'Topic',     tab: 'topic'     as const },
  { label: 'Agents',    tab: 'agents'    as const },
];

export function SlashCommandMenu({
  slashState,
  filteredSlashItems,
  aiSuggestedItems,
  urlInputMode,
  urlInputValue,
  addButtonMenuOpen,
  slashMenuRef,
  uploadInputRef,
  isSlashInsertingRef,
  urlInputActiveRef,
  openedViaAddButtonRef,
  slashAnchorRef,
  addInsertionRangeRef,
  pendingFileRangeRef,
  agentConfig,
  contentEditableRef,
  editableText,
  setEditableText,
  setContentEditableKey,
  setUrlInputMode,
  setUrlInputValue,
  setSlashState,
  setAddButtonMenuOpen,
  pendingCursorEditTextRef,
  readDOMIntoEditableText,
  onSelectItem,
}: SlashCommandMenuProps) {
  const { updateWithHistory, skills, isSkillsEnabled, isInsertComponents, currentAgentId, isToolsDA } = useAgent();

  const agentSkills = useMemo(
    () => skills.filter(s => !s.agentId || s.agentId === currentAgentId),
    [skills, currentAgentId],
  );

  // Filter skills by current search query
  const q = slashState.query.trim().toLowerCase();
  const filteredSkills = useMemo(
    () => q ? agentSkills.filter(s => s.name.toLowerCase().includes(q)) : agentSkills,
    [q, agentSkills],
  );

  // Last 2 capabilities added to the agent
  const recentCaps = (agentConfig.capabilities || []).slice(-2).reverse();

  const isLanding = isInsertComponents && slashState.tab === 'suggested' && !slashState.query;
  const categoryLabel = CATEGORY_NAV.find(c => c.tab === slashState.tab)?.label ?? '';

  // Search state for Triggers tab
  const [triggerSearch, setTriggerSearch] = useState('');
  useEffect(() => { setTriggerSearch(''); }, [slashState.tab]);

  return (
    <>
      {/* Slash command hint — appears inline at cursor when "/" is typed but no query yet */}
      {slashState.active && !slashState.query && (
        <div
          className="fixed z-[9998] pointer-events-none px-0.5 text-gray-400 text-sm bg-gray-100"
          style={{ top: slashState.cursorBottom - 18, left: slashState.cursorLeft + 4 }}
        >
          {addButtonMenuOpen ? (
            <span>/ <span className="animate-cursor-blink border-r border-gray-500" /></span>
          ) : (
            'Start typing to search'
          )}
        </div>
      )}

      {/* Slash command menu */}
      {slashState.active && (
        <div
          ref={slashMenuRef}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden"
          style={{
            top: slashState.position.top,
            left: slashState.position.left,
            width: isInsertComponents ? 380 : 550,
            maxHeight: isInsertComponents ? 560 : 320,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          {isInsertComponents ? (
            /* ── NEW INSERT-COMPONENTS DESIGN ── */
            isLanding ? (
              /* Landing view: Preview badge + search + recent caps + category nav */
              <>
                {/* Preview badge */}
                <div className="px-3 pt-3 pb-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs text-gray-500 bg-gray-100 font-medium">
                    Preview
                  </span>
                </div>

                {/* Search input — interactive */}
                <div className="px-3 pt-2 pb-3">
                  <CopilotInput
                    contentBefore={<Search20Regular className="text-gray-400 pointer-events-none" style={{ width: 18, height: 18 }} />}
                    placeholder="Search"
                    value={slashState.query}
                    onChange={e => setSlashState(prev => ({ ...prev, query: e.target.value, highlightedIndex: 0 }))}
                    onMouseDown={e => { e.stopPropagation(); urlInputActiveRef.current = true; }}
                    onFocus={() => { urlInputActiveRef.current = true; }}
                    onBlur={() => { urlInputActiveRef.current = false; }}
                    size="md"
                    appearance="outline"
                    className="[&>div]:!rounded-full [&>div]:!border-gray-200 [&>div]:focus-within:!border-gray-300 [&>div]:!bg-white"
                  />
                </div>

                {/* Recent 2 capabilities */}
                {recentCaps.length > 0 && (
                  <div className="pb-1">
                    {recentCaps.map((cap) => (
                      <div
                        key={`${cap.name}-${cap.type}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-default"
                      >
                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                          {resolveComponentIcon(cap.name, cap.type, 'w-7 h-7')}
                        </span>
                        <span className="text-sm text-gray-900 truncate">{cap.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Category nav rows */}
                <div className="overflow-y-auto">
                  {CATEGORY_NAV.filter(cat => !(isToolsDA && (cat.tab === 'triggers' || cat.tab === 'agents'))).map(cat => (
                    <CopilotButton
                      key={cat.label}
                      variant="transparent"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setSlashState(prev => ({ ...prev, tab: cat.tab, highlightedIndex: 0 }))}
                      className="!w-full !justify-between !h-auto !rounded-none px-4 py-3.5 !font-normal hover:!bg-gray-50 !text-gray-900 active:!text-gray-900 transition-colors"
                    >
                      <span className="text-sm text-gray-900">{cat.label}</span>
                      <ChevronRight20Regular className="text-gray-400 flex-shrink-0" style={{ width: 18, height: 18 }} />
                    </CopilotButton>
                  ))}
                </div>
              </>
            ) : (
              /* Category / search sub-view */
              <>
                {/* Header: back + category title + search */}
                <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-gray-100 flex-shrink-0">
                  <CopilotButton
                    variant="transparent"
                    size="sm"
                    icon={<ChevronLeft20Regular />}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setSlashState(prev => ({ ...prev, tab: 'suggested', query: '', highlightedIndex: 0 }))}
                    aria-label="Back"
                  />
                  <span className="text-sm font-semibold text-gray-800 flex-1">{categoryLabel}</span>
                </div>

                {/* Search input in sub-view — interactive */}
                <div className="px-3 pt-2 pb-2 flex-shrink-0">
                  <CopilotInput
                    autoFocus
                    contentBefore={<Search20Regular className="text-gray-400 pointer-events-none" style={{ width: 16, height: 16 }} />}
                    placeholder={`Search ${categoryLabel.toLowerCase()}…`}
                    value={slashState.query}
                    onChange={e => setSlashState(prev => ({ ...prev, query: e.target.value, highlightedIndex: 0 }))}
                    onMouseDown={e => { e.stopPropagation(); urlInputActiveRef.current = true; }}
                    onFocus={() => { urlInputActiveRef.current = true; }}
                    onBlur={() => { urlInputActiveRef.current = false; }}
                    size="sm"
                    appearance="outline"
                    className="[&>div]:!rounded-full [&>div]:!border-gray-200 [&>div]:focus-within:!border-gray-300 [&>div]:!bg-white"
                  />
                </div>

                {/* Items list */}
                <div className="overflow-y-auto flex-1 py-1">
                  {slashState.tab === 'skills' ? (
                    filteredSkills.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                        <BookStar20Regular className="w-6 h-6 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">{q ? 'No matching skills' : 'No skills yet'}</p>
                        {!q && <p className="text-xs text-gray-400 mt-1">Import a .md file or ask the Helper Agent to create one</p>}
                      </div>
                    ) : (
                      filteredSkills.map((skill, i) => {
                      const skillItem: SlashMenuItem = { id: skill.id, label: skill.name, icon: <BookStar20Regular className="w-5 h-5" />, category: 'Action', subtitle: 'Skill', editText: `[[Skill: ${skill.name}]]` };
                      return (
                        <CopilotButton
                          key={skill.id}
                          variant="transparent"
                          data-slash-index={i}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onSelectItem(skillItem)}
                          className={`!w-full !justify-start !h-auto !rounded-none px-3 py-2 !font-normal !gap-3 transition-colors ${i === slashState.highlightedIndex ? '!bg-gray-100' : 'hover:!bg-gray-50'}`}
                        >
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            <BookStar20Regular className="w-5 h-5" />
                          </span>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium text-gray-900 truncate">{toSentenceCase(skill.name)}</div>
                            <div className="text-xs text-gray-400">Skill</div>
                          </div>
                        </CopilotButton>
                      ); })
                    )
                  ) : filteredSlashItems.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">
                      {slashState.query ? `No results for "${slashState.query}"` : `Nothing in ${categoryLabel.toLowerCase()} yet`}
                    </p>
                  ) : (
                    filteredSlashItems.map((item, i) => (
                      <CopilotButton
                        key={item.id}
                        variant="transparent"
                        data-slash-index={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelectItem(item)}
                        className={`!w-full !justify-start !h-auto !rounded-none px-3 py-2 !font-normal !gap-3 transition-colors ${i === slashState.highlightedIndex ? '!bg-gray-100' : 'hover:!bg-gray-50'}`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.label}</div>
                          <div className="text-xs text-gray-400">{item.subtitle ?? item.category}</div>
                        </div>
                      </CopilotButton>
                    ))
                  )}
                </div>
              </>
            )
          ) : (
            /* ── ORIGINAL DESIGN (isInsertComponents OFF) ── */
            <>
              {/* Filter pills + upload actions */}
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                  {(
                    [
                      { id: 'suggested', label: 'Suggested' },
                      { id: 'triggers',  label: 'Triggers'  },
                      { id: 'tools',     label: 'Tools'     },
                      { id: 'knowledge', label: 'Knowledge' },
                    ] as const
                  ).filter(({ id }) => !(isToolsDA && id === 'triggers')).flatMap(({ id, label }, tabIdx) => {
                    const focusIdx = tabIdx === 0 ? 0 : tabIdx + 1;
                    const pills = [
                      <div key={id} onMouseDown={(e) => e.preventDefault()}>
                        <CopilotFilterPill
                          label={label}
                          active={slashState.tab === id}
                          size="xs"
                          onClick={() => setSlashState(prev => ({ ...prev, tab: id, headerFocusIdx: focusIdx, highlightedIndex: 0 }))}
                        />
                      </div>,
                    ];
                    if (id === 'suggested' && isSkillsEnabled) {
                      pills.push(
                        <div key="skills" onMouseDown={(e) => e.preventDefault()}>
                          <CopilotFilterPill
                            label="Skills"
                            active={slashState.tab === 'skills'}
                            size="xs"
                            onClick={() => setSlashState(prev => ({ ...prev, tab: 'skills', headerFocusIdx: 1, highlightedIndex: 0 }))}
                          />
                        </div>
                      );
                    }
                    return pills;
                  })}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pl-1">
                  {urlInputMode ? (
                    <form
                      onMouseDown={(e) => e.stopPropagation()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const url = urlInputValue.trim();
                        if (!url) { urlInputActiveRef.current = false; setUrlInputMode(false); return; }
                        const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
                        const editText = `[[Website - ${fullUrl}]]`;
                        const newCap = { name: `Website - ${fullUrl}`, type: 'knowledge' as const };
                        let baseText = editableText || '';
                        if (openedViaAddButtonRef.current) {
                          const savedRange = addInsertionRangeRef.current;
                          if (savedRange && contentEditableRef.current?.contains(savedRange.startContainer)) {
                            try {
                              const range = savedRange.cloneRange();
                              range.collapse(true);
                              const placeholder = document.createTextNode('\uFFFD');
                              range.insertNode(placeholder);
                              const textWithPlaceholder = readDOMIntoEditableText(contentEditableRef.current!);
                              placeholder.parentNode?.removeChild(placeholder);
                              const idx = textWithPlaceholder.indexOf('\uFFFD');
                              if (idx !== -1) {
                                baseText = textWithPlaceholder.slice(0, idx) + editText + textWithPlaceholder.slice(idx + 1);
                              }
                            } catch (_) { /* fallback */ }
                          }
                          if (baseText === (editableText || '')) {
                            const sep = baseText && !baseText.endsWith('\n') ? ' ' : '';
                            baseText = baseText + sep + editText;
                          }
                        } else {
                          const anchor = slashAnchorRef.current;
                          if (anchor && anchor.node.nodeType === Node.TEXT_NODE && contentEditableRef.current?.contains(anchor.node as Node)) {
                            try {
                              const slashPos = anchor.offset;
                              const queryLen = slashState.query.length;
                              const endPos = Math.min(slashPos + 1 + queryLen, (anchor.node as Text).length);
                              const range = document.createRange();
                              range.setStart(anchor.node, slashPos);
                              range.setEnd(anchor.node, endPos);
                              range.deleteContents();
                              const placeholder = document.createTextNode('\uFFFD');
                              range.insertNode(placeholder);
                              const textWithPlaceholder = readDOMIntoEditableText(contentEditableRef.current!);
                              placeholder.parentNode?.removeChild(placeholder);
                              const idx = textWithPlaceholder.indexOf('\uFFFD');
                              if (idx !== -1) {
                                baseText = textWithPlaceholder.slice(0, idx) + editText + textWithPlaceholder.slice(idx + 1);
                              }
                            } catch (_) { /* fallback */ }
                          }
                          if (baseText === (editableText || '')) {
                            const sep = baseText && !baseText.endsWith('\n') ? ' ' : '';
                            baseText = baseText + sep + editText;
                          }
                        }
                        pendingCursorEditTextRef.current = editText;
                        isSlashInsertingRef.current = true;
                        updateWithHistory({ instructions: baseText, capabilities: [...(agentConfig.capabilities || []), newCap] });
                        setEditableText(baseText);
                        setContentEditableKey(k => k + 1);
                        urlInputActiveRef.current = false;
                        setUrlInputMode(false);
                        setUrlInputValue('');
                        openedViaAddButtonRef.current = false;
                        addInsertionRangeRef.current = null;
                        slashAnchorRef.current = null;
                        setSlashState({ active: false, query: '', position: { top: 0, left: 0 }, cursorBottom: 0, cursorLeft: 0, highlightedIndex: 0, tab: 'suggested', localContext: '', headerFocusIdx: 0 });
                        setAddButtonMenuOpen(false);
                        setTimeout(() => { isSlashInsertingRef.current = false; setTimeout(() => contentEditableRef.current?.focus(), 0); }, 0);
                      }}
                      className="flex items-center gap-1"
                    >
                      <CopilotInput
                        autoFocus
                        value={urlInputValue}
                        onChange={(e) => setUrlInputValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') { urlInputActiveRef.current = false; setUrlInputMode(false); setUrlInputValue(''); } }}
                        placeholder="Paste URL…"
                        size="sm"
                        appearance="outline"
                        className="w-36"
                      />
                    </form>
                  ) : (
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      icon={<Globe20Regular />}
                      iconFilled={<Globe20Filled />}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { urlInputActiveRef.current = true; setUrlInputMode(true); }}
                      title="Add website URL"
                      className={`focus-visible:!ring-0 focus-visible:!ring-offset-0${slashState.headerFocusIdx === 5 ? ' text-brand' : ''}`}
                      style={slashState.headerFocusIdx === 5 ? { color: '#484FE3' } : undefined}
                    />
                  )}
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      const fileEditTexts = files.map(f => `[[${f.name}]]`);
                      const newCaps = files.map(f => ({ name: f.name, type: 'knowledge' as const }));
                      let baseText = editableText || '';
                      const savedRange = pendingFileRangeRef.current;
                      if (savedRange && contentEditableRef.current?.contains(savedRange.startContainer)) {
                        try {
                          const range = savedRange.cloneRange();
                          range.collapse(true);
                          const placeholder = document.createTextNode('\uFFFD');
                          range.insertNode(placeholder);
                          const textWithPlaceholder = readDOMIntoEditableText(contentEditableRef.current!);
                          placeholder.parentNode?.removeChild(placeholder);
                          const idx = textWithPlaceholder.indexOf('\uFFFD');
                          if (idx !== -1) {
                            const insertion = fileEditTexts.join(' ');
                            baseText = textWithPlaceholder.slice(0, idx) + insertion + textWithPlaceholder.slice(idx + 1);
                          }
                        } catch (_) { /* fallback */ }
                      }
                      if (baseText === (editableText || '')) {
                        const sep = baseText && !baseText.endsWith('\n') ? ' ' : '';
                        baseText = baseText + sep + fileEditTexts.join(' ');
                      }
                      pendingFileRangeRef.current = null;
                      pendingCursorEditTextRef.current = fileEditTexts[fileEditTexts.length - 1];
                      isSlashInsertingRef.current = true;
                      updateWithHistory({ instructions: baseText, capabilities: [...(agentConfig.capabilities || []), ...newCaps] });
                      setEditableText(baseText);
                      setContentEditableKey(k => k + 1);
                      setTimeout(() => { isSlashInsertingRef.current = false; setTimeout(() => contentEditableRef.current?.focus(), 0); }, 0);
                      e.target.value = '';
                    }}
                  />
                  <CopilotButton
                    variant="ghost"
                    size="sm"
                    icon={<ArrowUpload20Regular />}
                    iconFilled={<ArrowUpload20Filled />}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => uploadInputRef.current?.click()}
                    title="Upload files"
                    className={`focus-visible:!ring-0 focus-visible:!ring-offset-0${slashState.headerFocusIdx === 6 ? ' text-brand' : ''}`}
                    style={slashState.headerFocusIdx === 6 ? { color: '#484FE3' } : undefined}
                  />
                  <CopilotButton
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    title="Browse SharePoint"
                    className={`focus-visible:!ring-0 focus-visible:!ring-offset-0${slashState.headerFocusIdx === 7 ? ' text-brand' : ''}`}
                  >
                    {getConnectorIcon('sharepoint', 'w-4 h-4')}
                  </CopilotButton>
                </div>
              </div>

              {/* Trigger search input */}
              {slashState.tab === 'triggers' && (
                <div className="px-3 pb-2 pt-1 border-b border-gray-100 flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
                  <CopilotInput
                    size="sm"
                    appearance="outline"
                    placeholder="Search triggers..."
                    value={triggerSearch}
                    onChange={e => setTriggerSearch(e.target.value)}
                    contentBefore={<Search20Regular className="text-gray-400" style={{ width: 16, height: 16 }} />}
                    className="w-full"
                  />
                </div>
              )}

              {/* Item list */}
              <div className="overflow-y-auto flex-1 py-1">
                {slashState.tab === 'skills' ? (
                  agentSkills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                      <BookStar20Regular className="w-6 h-6 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No skills yet</p>
                      <p className="text-xs text-gray-400 mt-1">Import a .md file or ask the Helper Agent to create one</p>
                    </div>
                  ) : (
                    agentSkills.map((skill, i) => (
                      <CopilotButton
                        key={skill.id}
                        variant="transparent"
                        data-slash-index={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSlashState(prev => ({ ...prev, active: false })); setAddButtonMenuOpen(false); }}
                        className={`w-full justify-start gap-3 px-3 py-2 text-left transition-colors ${i === slashState.highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                          <BookStar20Regular className="w-5 h-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{toSentenceCase(skill.name)}</div>
                          <div className="text-xs text-gray-400">Skill</div>
                        </div>
                      </CopilotButton>
                    ))
                  )
                ) : slashState.tab === 'suggested' && aiSuggestedItems === null ? (
                  <div className="animate-pulse py-1">
                    {[40, 72, 56, 64, 48, 68].map((w, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 rounded bg-gray-200" style={{ width: `${w}%` }} />
                          <div className="h-2.5 rounded bg-gray-100" style={{ width: `${w * 0.6}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (() => {
                  const displayItems = slashState.tab === 'triggers' && triggerSearch.trim()
                    ? filteredSlashItems.filter(item => `${item.label} ${item.subtitle ?? ''} ${item.searchKeywords ?? ''}`.toLowerCase().includes(triggerSearch.trim().toLowerCase()))
                    : filteredSlashItems;
                  return displayItems.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">
                      {triggerSearch || slashState.query ? `No results for "${triggerSearch || slashState.query}"` : 'Nothing to suggest'}
                    </p>
                  ) : (
                    displayItems.map((item, i) => (
                      <CopilotButton
                        key={item.id}
                        variant="transparent"
                        data-slash-index={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelectItem(item)}
                        className={`w-full justify-start gap-3 px-3 py-2 text-left transition-colors ${i === slashState.highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.label}</div>
                          <div className="text-xs text-gray-400">{item.subtitle ?? item.category}</div>
                        </div>
                      </CopilotButton>
                    ))
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
