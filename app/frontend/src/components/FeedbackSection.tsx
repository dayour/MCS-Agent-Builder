import React, { useState, useRef } from 'react';
import { CopilotButton } from './ui/CopilotButton';
import { CopilotInput } from './ui/CopilotInput';
import { CopilotTextarea } from './ui/CopilotTextarea';
import {
  WrenchRegular,
  Server20Regular,
  Library20Regular,
  Bot20Regular,
  FlowSparkle20Regular,
  Flash20Regular,
} from '@fluentui/react-icons';

export type FeedbackStatus = 'pending' | 'accepted' | 'modified';

// Classify a free-text tool/component item into one of the known kinds so
// typed-list mode can render an appropriate icon + badge. Keeps the existing
// `list` mode untouched — typed-list is additive and opt-in.
type ItemKind = 'tool' | 'mcp' | 'knowledge' | 'agent' | 'flow' | 'trigger';

function detectItemKind(item: string): ItemKind {
  const l = item.toLowerCase();
  if (/\b(mcp|model context protocol)\b/.test(l)) return 'mcp';
  if (/\bsharepoint|documents?|files?|sites?|knowledge\b/.test(l)) return 'knowledge';
  if (/\b(agent|worker|assistant|teammate)\b/.test(l)) return 'agent';
  if (/\b(flow|automation|workflow|power automate)\b/.test(l)) return 'flow';
  if (/\b(when |trigger|on event|arrives|received)\b/.test(l)) return 'trigger';
  return 'tool';
}

function kindIconFor(kind: ItemKind): React.ReactNode {
  const props = { className: 'w-4 h-4' };
  switch (kind) {
    case 'mcp':       return <Server20Regular {...props} />;
    case 'knowledge': return <Library20Regular {...props} />;
    case 'agent':     return <Bot20Regular {...props} />;
    case 'flow':      return <FlowSparkle20Regular {...props} />;
    case 'trigger':   return <Flash20Regular {...props} />;
    default:          return <WrenchRegular {...props} />;
  }
}

const KIND_BADGE_CLASS: Record<ItemKind, string> = {
  tool:      'text-neutral-700 bg-neutral-100 border-neutral-200',
  mcp:       'text-violet-700 bg-violet-50 border-violet-200',
  knowledge: 'text-amber-700 bg-amber-50 border-amber-200',
  agent:     'text-sky-700 bg-sky-50 border-sky-200',
  flow:      'text-emerald-700 bg-emerald-50 border-emerald-200',
  trigger:   'text-rose-700 bg-rose-50 border-rose-200',
};

interface FeedbackSectionProps {
  title: string;
  sectionKey: string;
  originalValue: string;
  currentValue: string;
  onChange: (value: string) => void;
  status: FeedbackStatus;
  onStatusChange: (status: FeedbackStatus) => void;
  renderMode: 'text' | 'textarea' | 'pills' | 'list' | 'typed-list' | 'select';
  icon: string;
  renderContent?: (text: string) => React.ReactNode;
  subtitle?: string;
  suggestions?: string[];
  constrainToSuggestions?: boolean;
  options?: { value: string; label: string; description?: string }[];
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  title,
  sectionKey,
  originalValue,
  currentValue,
  onChange,
  status,
  onStatusChange,
  renderMode,
  icon,
  renderContent,
  subtitle,
  suggestions,
  constrainToSuggestions = false,
  options,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [pillInput, setPillInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const datalistId = `${sectionKey}-suggestions`;

  const handleAccept = () => {
    onStatusChange('accepted');
    setIsEditing(false);
  };

  const handleModify = () => {
    onStatusChange('modified');
    setIsEditing(true);
  };

  const handleDoneEditing = () => {
    setIsEditing(false);
  };

  // Pills helpers (||| delimited)
  const pillItems = currentValue ? currentValue.split('|||').filter(Boolean) : [];

  const addPill = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || pillItems.includes(trimmed)) return;
    if (constrainToSuggestions && suggestions && !suggestions.includes(trimmed)) return;
    onChange([...pillItems, trimmed].join('|||'));
    setPillInput('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePill = (index: number) => {
    const updated = pillItems.filter((_, i) => i !== index);
    onChange(updated.join('|||'));
  };

  // List helpers (||| delimited, same as pills but displayed as numbered list)
  const listItems = currentValue ? currentValue.split('|||').filter(Boolean) : [];

  const addListItem = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || listItems.includes(trimmed)) return;
    if (constrainToSuggestions && suggestions && !suggestions.includes(trimmed)) return;
    onChange([...listItems, trimmed].join('|||'));
    setPillInput('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeListItem = (index: number) => {
    const updated = listItems.filter((_, i) => i !== index);
    onChange(updated.join('|||'));
  };

  const statusBadge = status === 'accepted' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      Accepted
    </span>
  ) : status === 'modified' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      Modified
    </span>
  ) : null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2">
          {status !== 'accepted' && (
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={handleAccept}
              className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
            >
              Accept
            </CopilotButton>
          )}
          {!isEditing ? (
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={handleModify}
              className="text-brand-purple bg-purple-50 hover:bg-purple-100 border-purple-200"
            >
              Modify
            </CopilotButton>
          ) : (
            <CopilotButton
              variant="secondary"
              size="sm"
              onClick={handleDoneEditing}
              className="text-gray-700 bg-gray-100 hover:bg-gray-200 border-gray-300"
            >
              Done
            </CopilotButton>
          )}
        </div>
      </div>

      {/* Subtitle info banner */}
      {subtitle && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
          <span className="text-blue-500 flex-shrink-0 mt-0.5">&#8505;</span>
          <p className="text-xs text-blue-700">{subtitle}</p>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-3">
        {/* TEXT mode */}
        {renderMode === 'text' && (
          isEditing ? (
            <CopilotInput
              type="text"
              value={currentValue}
              onChange={(e) => onChange(e.target.value)}
              size="md"
            />
          ) : (
            <p className="text-sm text-gray-900">{currentValue || <span className="text-gray-400 italic">Not set</span>}</p>
          )
        )}

        {/* TEXTAREA mode */}
        {renderMode === 'textarea' && (
          isEditing ? (
            <CopilotTextarea
              value={currentValue}
              onChange={(e) => onChange(e.target.value)}
              size="md"
              rows={6}
              className="font-mono"
            />
          ) : (
            <div className="text-sm text-gray-900">
              {renderContent ? renderContent(currentValue) : (
                <pre className="whitespace-pre-wrap font-sans">{currentValue || <span className="text-gray-400 italic">Not set</span>}</pre>
              )}
            </div>
          )
        )}

        {/* PILLS mode */}
        {renderMode === 'pills' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {pillItems.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-brand-purple bg-purple-50 border border-purple-200 rounded-full">
                  {item}
                  {isEditing && (
                    <CopilotButton
                      variant="icon"
                      size="sm"
                      onClick={() => removePill(i)}
                      className="p-0 h-auto w-auto text-purple-400 hover:text-purple-700 ml-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </CopilotButton>
                  )}
                </span>
              ))}
              {pillItems.length === 0 && !isEditing && (
                <span className="text-sm text-gray-400 italic">None</span>
              )}
            </div>
            {isEditing && (
              <div className="flex gap-2">
                <CopilotInput
                  ref={inputRef}
                  type="text"
                  list={suggestions ? datalistId : undefined}
                  value={pillInput}
                  onChange={(e) => setPillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addPill(pillInput); }
                  }}
                  placeholder="Type and press Enter to add..."
                  size="md"
                  className="flex-1"
                />
                <CopilotButton
                  variant="secondary"
                  size="sm"
                  onClick={() => addPill(pillInput)}
                  className="text-brand-purple bg-purple-50 hover:bg-purple-100 border-purple-200"
                >
                  Add
                </CopilotButton>
                {suggestions && (
                  <datalist id={datalistId}>
                    {suggestions.filter(s => !pillItems.includes(s)).map((s, i) => (
                      <option key={i} value={s} />
                    ))}
                  </datalist>
                )}
              </div>
            )}
          </div>
        )}

        {/* TYPED-LIST mode — cards with kind icon + colored badge per item */}
        {renderMode === 'typed-list' && (
          <div>
            {listItems.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-2">
                {listItems.map((item, i) => {
                  const kind = detectItemKind(item);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors"
                    >
                      <span className="flex-shrink-0 text-gray-500">{kindIconFor(kind)}</span>
                      <span className="flex-1 text-sm text-gray-900 truncate">{item}</span>
                      <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${KIND_BADGE_CLASS[kind]}`}>
                        {kind}
                      </span>
                      {isEditing && (
                        <CopilotButton
                          variant="icon"
                          size="sm"
                          onClick={() => removeListItem(i)}
                          className="p-0 h-auto w-auto text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </CopilotButton>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              !isEditing && <span className="text-sm text-gray-400 italic">None</span>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <CopilotInput
                  ref={inputRef}
                  type="text"
                  list={suggestions ? datalistId : undefined}
                  value={pillInput}
                  onChange={(e) => setPillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addListItem(pillInput); }
                  }}
                  placeholder="Type and press Enter to add..."
                  size="md"
                  className="flex-1"
                />
                <CopilotButton
                  variant="secondary"
                  size="sm"
                  onClick={() => addListItem(pillInput)}
                  className="text-brand-purple bg-purple-50 hover:bg-purple-100 border-purple-200"
                >
                  Add
                </CopilotButton>
                {suggestions && (
                  <datalist id={datalistId}>
                    {suggestions.filter(s => !listItems.includes(s)).map((s, i) => (
                      <option key={i} value={s} />
                    ))}
                  </datalist>
                )}
              </div>
            )}
          </div>
        )}

        {/* LIST mode */}
        {renderMode === 'list' && (
          <div>
            {listItems.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                {listItems.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono w-5">{i + 1}.</span>
                      <span className="text-gray-900">{item}</span>
                    </div>
                    {isEditing && (
                      <CopilotButton
                        variant="icon"
                        size="sm"
                        onClick={() => removeListItem(i)}
                        className="p-0 h-auto w-auto text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </CopilotButton>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !isEditing && <span className="text-sm text-gray-400 italic">None</span>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <CopilotInput
                  ref={inputRef}
                  type="text"
                  list={suggestions ? datalistId : undefined}
                  value={pillInput}
                  onChange={(e) => setPillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addListItem(pillInput); }
                  }}
                  placeholder="Type and press Enter to add..."
                  size="md"
                  className="flex-1"
                />
                <CopilotButton
                  variant="secondary"
                  size="sm"
                  onClick={() => addListItem(pillInput)}
                  className="text-brand-purple bg-purple-50 hover:bg-purple-100 border-purple-200"
                >
                  Add
                </CopilotButton>
                {suggestions && (
                  <datalist id={datalistId}>
                    {suggestions.filter(s => !listItems.includes(s)).map((s, i) => (
                      <option key={i} value={s} />
                    ))}
                  </datalist>
                )}
              </div>
            )}
          </div>
        )}

        {/* SELECT mode */}
        {renderMode === 'select' && options && (
          isEditing ? (
            <div className="space-y-2">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    currentValue === opt.value
                      ? 'border-brand-purple bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={sectionKey}
                    value={opt.value}
                    checked={currentValue === opt.value}
                    onChange={() => onChange(opt.value)}
                    className="mt-0.5 accent-[hsl(var(--primary))]"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                    {opt.description && <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
              currentValue ? 'text-brand-purple bg-purple-50 border border-purple-200' : 'text-gray-400 italic'
            }`}>
              {options.find(o => o.value === currentValue)?.label || 'Not set'}
            </span>
          )
        )}
      </div>
    </div>
  );
};
