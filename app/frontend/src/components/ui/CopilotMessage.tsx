import React, { useState } from 'react';
import {
  ThumbLike20Regular,
  ThumbLike20Filled,
  ThumbDislike20Regular,
  ThumbDislike20Filled,
  BookStar20Regular,
  Add20Regular,
  ChevronRight16Regular,
  CheckmarkCircle16Filled,
  ErrorCircle16Filled,
  Warning16Filled,
} from '@fluentui/react-icons';
import { CopilotButton } from './CopilotButton';
import { LatencyLoader } from './StatusIcon';
import type { PublishBlock } from '../publish';
import { CopilotStudioIcon } from './CopilotStudioIcon';
import { ComponentPill } from './ComponentPill';
import { WorkIQCard } from './WorkIQCard';
import { DwInstructionsCard } from './DwInstructionsCard';
import { DwSkillCard } from './DwSkillCard';
import { DwTaskCard } from './DwTaskCard';
import { DwTaskListCard } from './DwTaskListCard';
import { ChangeSummaryCard } from './ChangeSummaryCard';
import { DeepResearchCta } from './DeepResearchCta';
import { getFileIcon, formatFileSize } from '../../utils/homeFileUtils';
import { KNOWN_TRIGGERS } from '../../utils/agentCatalog';
import { isDivider, isBulletLine, isNumberedLine } from '../../utils/messageFormatting';
import { Skill } from '../../types';
import { generateSkillMarkdown, downloadSkillZip, toSentenceCase } from '../../utils/skillUtils';
import { getConnectorIcon } from '../../utils/agentIcons';
import { WORK_IQ_DEFAULT_SERVERS } from '../../utils/workIqUtils';

const SkillPreviewCard: React.FC<{ skill: Skill }> = ({ skill }) => {
  const [expanded, setExpanded] = React.useState(false);
  const markdown = generateSkillMarkdown(skill);
  const lines = markdown.split('\n');

  return (
    <div className="mt-2">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer select-none transition-colors"
      >
        {expanded ? 'Hide' : 'View'} technical details
        <ChevronRight16Regular className={`w-3 h-3 transition-transform self-end ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500">SKILL.md</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-medium text-gray-700">{toSentenceCase(skill.name)}</span>
            </div>
            <button
              aria-label="Download skill as ZIP"
              onClick={(e) => { e.stopPropagation(); downloadSkillZip(skill); }}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
            </button>
          </div>
          {/* Markdown preview */}
          <div className="px-3 py-2.5 bg-white font-mono text-xs text-gray-700 max-h-64 overflow-y-auto leading-relaxed">
            {lines.map((line, i) => {
              if (line.startsWith('---')) return <div key={i} className="text-gray-300">---</div>;
              if (line.startsWith('# ')) return <div key={i} className="font-bold text-gray-900 mt-1">{line}</div>;
              if (line.startsWith('## ')) return <div key={i} className="font-semibold text-gray-800 mt-1">{line}</div>;
              if (line.startsWith('### ')) return <div key={i} className="font-medium text-gray-700 mt-1">{line}</div>;
              if (line.match(/^(name|description|license|allowed-tools|dependencies):/)) {
                const [key, ...rest] = line.split(':');
                return <div key={i}><span className="text-purple-600">{key}:</span><span>{rest.join(':')}</span></div>;
              }
              if (line.match(/^\s+\w+:/)) {
                const [key, ...rest] = line.split(':');
                return <div key={i}><span className="text-purple-500">{key}:</span><span>{rest.join(':')}</span></div>;
              }
              if (line === '') return <div key={i} className="h-2" />;
              return <div key={i}>{line}</div>;
            })}
          </div>
          {/* Tools, knowledge sources, and scripts footer */}
          {((skill.tools?.length ?? 0) > 0 || (skill.knowledgeSources?.length ?? 0) > 0 || (skill.scripts?.length ?? 0) > 0) && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
              {skill.tools && skill.tools.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0 pt-0.5">Tools</span>
                  <div className="flex flex-wrap gap-1">
                    {skill.tools.map((tool) => {
                      const icon = getConnectorIcon(tool.toLowerCase().split(/[\s-]/)[0], 'w-3 h-3');
                      return (
                        <span key={tool} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700">
                          {icon && <span className="flex-shrink-0">{icon}</span>}
                          {tool}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {skill.knowledgeSources && skill.knowledgeSources.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0 pt-0.5">Knowledge</span>
                  <div className="flex flex-wrap gap-1">
                    {skill.knowledgeSources.map((source) => (
                      <span key={source} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skill.scripts && skill.scripts.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0 pt-0.5">Scripts</span>
                  <div className="flex flex-wrap gap-1">
                    {skill.scripts.map((script) => (
                      <span key={script.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs font-mono text-gray-700">
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        {script.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── DA Guardrails: skill suggestion confirm card ─────────────────────────────
const DASkillSuggestCard: React.FC<{ onConfirm: () => void; onDismiss: () => void }> = ({ onConfirm, onDismiss }) => (
  <div className="mt-3 border border-indigo-100 rounded-lg overflow-hidden bg-indigo-50">
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-indigo-100">
      <BookStar20Regular className="w-4 h-4 text-indigo-500 flex-shrink-0" />
      <span className="text-sm font-medium text-indigo-900">Package as a skill?</span>
    </div>
    <div className="px-3 py-2.5 flex items-center justify-between gap-3">
      <p className="text-xs text-indigo-700">This set of capabilities could be saved as a reusable skill and wired directly into your agent.</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <CopilotButton size="sm" variant="ghost" onClick={onDismiss} className="text-gray-500">Not now</CopilotButton>
        <CopilotButton size="sm" variant="primary" icon={<Add20Regular />} onClick={onConfirm}>Set it up</CopilotButton>
      </div>
    </div>
  </div>
);


interface CopilotMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  thinkingText?: string;
  agentName?: string;
  agentIcon?: React.ReactNode;
  size?: 'compact' | 'normal';
  metadata?: any;
  attachedFiles?: File[];
  onSendMessage?: (message: string) => void;
  onWorkIQManage?: (servers: string[]) => void;
  onWorkIQViewTools?: () => void;
  onNewContent?: () => void;
  skipEntranceAnimation?: boolean;
  hideHeader?: boolean;
  showFeedback?: boolean;
  onFeedbackSubmit?: (rating: 'up' | 'down', comment: string) => void;
  /** Called when user clicks a [[type:name]] pill (non-knowledge types only). */
  onPillClick?: (type: string, name: string) => void;
  onNavigate?: (target: string) => void;
}

/**
 * CopilotMessage - M365 Copilot-style message component
 *
 * Based on the Coworker Design System:
 * - Left-justified messages without background containers
 * - User messages: Simple text
 * - AI messages: Icon + name header + content
 */

// ─── Pill icon for [[type:name]] tokens ──────────────────────────────────────
const NODE_PILL_PATHS: Record<string, string> = {
  knowledge: 'M3.5 2C2.67 2 2 2.67 2 3.5v12.98c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5V3.5C6 2.67 5.33 2 4.5 2h-1Zm5 0C7.67 2 7 2.67 7 3.5v12.98c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5V3.5c0-.83-.67-1.5-1.5-1.5h-1Zm7.22 4.16a1.5 1.5 0 0 0-1.87-1.1l-.75.2A1.5 1.5 0 0 0 12.04 7l2 9.8c.18.84 1.02 1.36 1.84 1.15l.99-.25c.79-.2 1.27-1 1.1-1.78l-2.25-9.76Z',
  connector: 'M17.78 2.22c.3.3.3.77 0 1.06l-1.45 1.45a4.04 4.04 0 0 1-.48 5.12l-.3.3-.3.31c-.42.41-1.08.41-1.5 0L9.55 6.24a1.05 1.05 0 0 1 0-1.48l.6-.61a4.05 4.05 0 0 1 5.13-.48l1.45-1.45c.3-.3.77-.3 1.06 0Zm-9 6.25c.3.3.3.77 0 1.06L7.51 10.8l1.69 1.7 1.27-1.28a.75.75 0 1 1 1.06 1.06l-1.28 1.28c.48.58.45 1.45-.1 2l-.3.3a4.04 4.04 0 0 1-5.12.47l-1.45 1.45a.75.75 0 0 1-1.06-1.06l1.45-1.45a4.04 4.04 0 0 1 .48-5.12l.3-.3a1.49 1.49 0 0 1 2-.1l1.27-1.28c.3-.3.77-.3 1.06 0Z',
  topic: 'M8.54 2a6.5 6.5 0 0 0-5.68 9.67l-.8 2.08a1 1 0 0 0 1.21 1.32l2.49-.7A6.5 6.5 0 1 0 8.54 2Z',
  skill: 'M8.7 2.48a3.5 3.5 0 0 1 2.6 0l5.76 2.3c.57.23.94.78.94 1.4v7.64a1.5 1.5 0 0 1-.94 1.4l-5.76 2.3a3.5 3.5 0 0 1-2.6 0l-5.76-2.3a1.5 1.5 0 0 1-.94-1.4V6.18c0-.62.37-1.17.94-1.4l5.76-2.3Z',
  flow: 'M12.04 7.5H12c-.83 0-1.5.67-1.5 1.5v2A2.5 2.5 0 0 1 8 13.5h-.04a3 3 0 1 1 0-1H8c.83 0 1.5-.67 1.5-1.5V9A2.5 2.5 0 0 1 12 6.5h.04a3 3 0 1 1 0 1Z',
};
const NodePillIcon: React.FC<{ type: string }> = ({ type }) => {
  const gradId = React.useId();
  const d = NODE_PILL_PATHS[type] ?? NODE_PILL_PATHS.knowledge;
  return (
    <svg width={12} height={12} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, display: 'inline' }}>
      <defs>
        <radialGradient id={gradId} cx="22" cy="-1" r="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D660FF" />
          <stop offset="70%" stopColor="#4750EB" />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#${gradId})`} />
    </svg>
  );
};

const ExternalLinkIcon: React.FC = () => (
  <svg width={11} height={11} viewBox="0 0 16 16" fill="none" style={{ display: 'inline', flexShrink: 0, position: 'relative', top: '-1px' }}>
    <path d="M9 2.5h4.5v4.5M13.5 2.5 7 9M6.5 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
export const CopilotMessage: React.FC<CopilotMessageProps> = ({
  role,
  content,
  isStreaming = false,
  isThinking = false,
  thinkingText = 'Thinking…',
  agentName = 'Copilot Studio',
  agentIcon,
  size = 'normal',
  metadata,
  attachedFiles,
  onSendMessage,
  onWorkIQManage,
  onWorkIQViewTools,
  onNewContent,
  skipEntranceAnimation = false,
  hideHeader = false,
  showFeedback = false,
  onFeedbackSubmit,
  onPillClick,
  onNavigate,
}) => {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [comment, setComment] = useState('');

  // Text size classes based on size prop
  const textClass = size === 'compact' ? 'text-body-2' : 'text-body-1';
  const textStrongClass = size === 'compact' ? 'text-body-2-strong' : 'text-body-1-strong';


  // Render text with bold, component pills [[type:name]], and markdown links [text](url).
  const renderTextWithBold = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]*\]\]|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-semibold">{part.slice(2, -2)}</span>;
      }
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const inner = part.slice(2, -2);
        const colonIdx = inner.indexOf(':');
        if (colonIdx > 0) {
          const type = inner.slice(0, colonIdx).trim().toLowerCase();
          const name = inner.slice(colonIdx + 1).trim();
          if (!name) return <span key={i}>{part}</span>;
          // Knowledge sources don't have individual build-page detail views — render as bold text
          if (type === 'knowledge') {
            return <span key={i} className="font-semibold">{name}</span>;
          }
          // All other component types (connector, topic, skill, flow) have detail pages — render as clickable pill
          return (
            <ComponentPill
              key={i}
              label={name}
              editText={`[[${type}:${name}]]`} // read-only context; editText unused here but kept for type completeness
              icon={<NodePillIcon type={type} />}
              onClick={onPillClick ? (_e) => onPillClick(type, name) : undefined}
            />
          );
        }
        const stripped = inner.replace(/^(?:Tool|Source):\s*/i, '');
        return <span key={i} className="font-semibold">{stripped}</span>;
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const safeHref = /^https?:\/\//i.test(linkMatch[2]) ? linkMatch[2] : '#';
        return (
          <a key={i} href={safeHref} target="_blank" rel="noreferrer"
            className="text-brand underline hover:opacity-80 inline-flex items-center gap-0.5 align-baseline">
            {linkMatch[1]}
            <ExternalLinkIcon />
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatContent = (text: string) => {
    // Normalize literal escape sequences the LLM sometimes outputs
    let formattedText = text
      .replace(/\\n\\n/g, '\n\n')
      .replace(/\\n/g, '\n');
    // Add paragraph breaks before common transition phrases
    formattedText = formattedText
      .replace(/([.!?])\s+(For example,)/g, '$1\n\n$2')
      .replace(/([.!?])\s+(For instance,)/g, '$1\n\n$2')
      .replace(/([.!?])\s+(That said,)/g, '$1\n\n$2')
      .replace(/([.!?])\s+(However,)/g, '$1\n\n$2');

    // Ensure heading lines (## / ###) are always their own paragraphs
    formattedText = formattedText.replace(/^(#{2,3} .+)$/gm, '\n\n$1\n\n');
    // Collapse runs of 3+ newlines down to 2
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n').trim();

    const paragraphs = formattedText.split('\n\n').filter(p => p.trim());
    const paragraphEntries: { el: React.ReactNode; isList: boolean; isHeading?: boolean }[] = [];

    paragraphs.forEach((para, index) => {
      const lines = para.split('\n');

      // Markdown headings (## / ###) — render as bold labels, no raw syntax
      const trimmedFirst = lines[0].trim();
      if (trimmedFirst.startsWith('## ')) {
        paragraphEntries.push({ isList: false, isHeading: true, el: <p key={index} className="font-semibold text-gray-900 text-sm">{renderTextWithBold(trimmedFirst.slice(3))}</p> });
        return;
      }
      if (trimmedFirst.startsWith('### ')) {
        paragraphEntries.push({ isList: false, isHeading: true, el: <p key={index} className="font-semibold text-gray-700 text-sm">{renderTextWithBold(trimmedFirst.slice(4))}</p> });
        return;
      }

      const hasBullets = lines.some(isBulletLine);
      const hasNumbered = lines.some(isNumberedLine);

      if (hasBullets || hasNumbered) {
        paragraphEntries.push({
          isList: true,
          el: (
            <ul key={index} className="space-y-1.5">
              {lines.map((line, i) => {
                const trimmed = line.trim();
                if (isDivider(trimmed)) {
                  return (
                    <li key={i} className="list-none my-1" aria-hidden="true"><div className="h-px bg-gray-200" /></li>
                  );
                }
                if (isBulletLine(trimmed)) {
                  const content = trimmed.replace(/^[-•]\s*/, '');
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="relative -top-[1px] shrink-0">•</span>
                      <span className="flex-1">{renderTextWithBold(content)}</span>
                    </li>
                  );
                }
                if (isNumberedLine(trimmed)) {
                  const match = trimmed.match(/^(\d+[.)]\s+)(.*)/);
                  const num = match?.[1] ?? '';
                  const content = match?.[2] ?? trimmed;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">{num}</span>
                      <span className="flex-1">{renderTextWithBold(content)}</span>
                    </li>
                  );
                }
                return trimmed ? <div key={i}>{renderTextWithBold(trimmed)}</div> : null;
              })}
            </ul>
          ),
        });
        return;
      }

      // Skip explicit divider-only paragraphs
      if (lines.length === 1 && isDivider(lines[0])) return;

      paragraphEntries.push({
        isList: false,
        el: <div key={index}>{renderTextWithBold(para)}</div>,
      });
    });

    return (
      <div className="space-y-4">
        {paragraphEntries.map((entry, i) => (
          <React.Fragment key={i}>
            {i > 0 && entry.isList !== paragraphEntries[i - 1].isList && !paragraphEntries[i - 1].isHeading && (
              <div className="h-px bg-[hsl(var(--stroke-default))]" />
            )}
            {entry.el}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (role === 'user') {
    return (
      <div className={`flex justify-end${skipEntranceAnimation ? '' : ' animate-slide-up-fade'}`}>
        <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
          {attachedFiles && attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {attachedFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1 text-xs"
                >
                  <span>{getFileIcon(file)}</span>
                  <span className="text-gray-700 font-medium max-w-[150px] truncate">{file.name}</span>
                  <span className="text-gray-400">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="bg-[hsl(var(--action-brand))] rounded-2xl px-4 py-2.5 w-full">
            <p className={`${textClass} text-gray-900 leading-relaxed`}>
              {content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div style={!skipEntranceAnimation ? { animation: 'fadeInText 0.3s ease-out' } : undefined}>
      {/* Agent name row with icon — suppressed when parent handles the header */}
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 flex items-center justify-center">
            {agentIcon || (
              <CopilotStudioIcon className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className={`${textStrongClass} text-gray-900`}>{agentName}</span>
        </div>
      )}

      {/* Message content — pl-6 aligns with agent name text (icon 16px + gap 8px) */}
      <div className={`${hideHeader ? '' : 'mt-2'} ${!hideHeader && size === 'normal' ? 'pl-6' : ''}`}>
        <div className={`${textClass} text-gray-700 leading-normal`}>
          {formatContent(content)}
        </div>



        {/* DA Guardrails: skill suggestion confirm */}
        {metadata?.type === 'da-skill-suggest' && (
          <DASkillSuggestCard
            onConfirm={() => onSendMessage?.('Yes, set it up as a skill')}
            onDismiss={() => onSendMessage?.('Not now, continue with the current setup')}
          />
        )}

        {/* Skill preview card — also handles legacy 'da-skill-preview' type for backward-compat */}
        {(metadata?.type === 'skill-preview' || metadata?.type === 'da-skill-preview') && metadata.skill && (
          <SkillPreviewCard skill={metadata.skill} />
        )}

        {/* Work IQ card — always shows connected state (auto-enabled) */}
        {metadata?.type === 'workiq' && (
          <div className="mt-3">
            <WorkIQCard
              enabledServers={metadata.workIqServers ?? WORK_IQ_DEFAULT_SERVERS}
              onServersChange={onWorkIQManage ?? (() => {})}
              onViewTools={onWorkIQViewTools}
            />
          </div>
        )}


        {/* DW conversational cards */}
        {metadata?.type === 'dw-instructions' && metadata.payload && (
          <div className="mt-3">
            <DwInstructionsCard
              role={metadata.payload.role}
              responsibilities={metadata.payload.responsibilities}
              goal={metadata.payload.goal}
              title={metadata.payload.title}
            />
          </div>
        )}
        {metadata?.type === 'dw-skill' && metadata.payload && (
          <div className="mt-3">
            <DwSkillCard
              name={metadata.payload.name}
              description={metadata.payload.description}
              capabilities={metadata.payload.capabilities}
              optimizedFor={metadata.payload.optimizedFor}
            />
          </div>
        )}
        {metadata?.type === 'dw-task' && metadata.payload && (
          <div className="mt-3">
            <DwTaskCard
              name={metadata.payload.name}
              description={metadata.payload.description}
              bullets={metadata.payload.bullets}
              recurrence={metadata.payload.recurrence}
              timeSaved={metadata.payload.timeSaved}
            />
          </div>
        )}
        {metadata?.type === 'dw-task-list' && metadata.payload && (
          <div className="mt-3">
            <DwTaskListCard
              tasks={metadata.payload.tasks}
            />
          </div>
        )}

        {/* Publish checklist blocks — rendered with proper Fluent icons */}
        {metadata?.publishBlocks && metadata.publishBlocks.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {metadata.publishBlocks.map((block: PublishBlock, idx: number) => (
              <div key={block.label ?? idx} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {block.status === 'passed' && <CheckmarkCircle16Filled className="text-green-600 flex-shrink-0" />}
                  {block.status === 'warning' && <Warning16Filled className="text-amber-500 flex-shrink-0" />}
                  {block.status === 'failed' && <ErrorCircle16Filled className="text-red-600 flex-shrink-0" />}
                  <span className="text-sm text-gray-500">{block.label}</span>
                </div>
                {block.summary && (
                  <span className="text-sm pl-[22px]">{block.summary}</span>
                )}
                {block.note && (
                  <span className="text-sm pl-[22px] text-gray-400 italic">{block.note}</span>
                )}
                {block.issues && block.issues.length > 0 && (
                  <ul className="text-sm text-red-600 pl-[22px] list-disc list-inside">
                    {block.issues.map((issue: string, j: number) => <li key={j}>{issue}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Deep Research CTA — Phase 3 expansion: inline activity card */}
        {metadata?.type === 'deep-research-cta' && metadata.projectId && metadata.agentId && (
          <DeepResearchCta
            projectId={metadata.projectId as string}
            agentId={metadata.agentId as string}
          />
        )}

        {/* Change summary card */}
        {metadata?.type === 'change-summary' && metadata.summary && (
          <>
            <ChangeSummaryCard
              summary={metadata.summary}
              onNavigate={onNavigate}
            />
            {metadata.summary.nextStep && (
              <p className={`mt-3 ${textClass} text-text-primary leading-normal`}>
                {metadata.summary.nextStep}
              </p>
            )}
          </>
        )}

        {/* Thinking indicator (appended to this message) */}
        {isThinking && (
          <div className="mt-3 flex items-center gap-2">
            <LatencyLoader />
            <span className="text-sm text-gray-500">{thinkingText}</span>
          </div>
        )}

        {/* Publish outcome — always the very last element */}
        {metadata?.publishOutcome && (
          <div className="mt-3 text-sm space-y-2">
            {(metadata.publishOutcome as string).split('\n\n').map((para: string, i: number) => (
              <p key={i}>{renderTextWithBold(para)}</p>
            ))}
          </div>
        )}
      </div>

      {/* Eval mode feedback buttons */}
      {showFeedback && !isStreaming && !isThinking && (() => {
        const handleThumbClick = (thumb: 'up' | 'down') => {
          if (feedbackSubmitted) return;
          if (rating === thumb) {
            // Re-click same thumb → cancel
            setRating(null);
            setShowCommentBox(false);
            setComment('');
          } else {
            // First click or switch thumb
            setRating(thumb);
            setShowCommentBox(true);
          }
        };
        const handleSubmit = () => {
          onFeedbackSubmit?.(rating!, comment);
          setFeedbackSubmitted(true);
          setShowCommentBox(false);
        };
        const handleSkip = () => {
          onFeedbackSubmit?.(rating!, '');
          setFeedbackSubmitted(true);
          setShowCommentBox(false);
        };
        return (
          <>
            <div className="mt-3 pl-6 flex items-center gap-1">
              {(!feedbackSubmitted || rating === 'up') && (
                <button
                  onClick={() => handleThumbClick('up')}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {rating === 'up' ? <ThumbLike20Filled className="text-brand" /> : <ThumbLike20Regular />}
                </button>
              )}
              {(!feedbackSubmitted || rating === 'down') && (
                <button
                  onClick={() => handleThumbClick('down')}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {rating === 'down' ? <ThumbDislike20Filled className="text-brand" /> : <ThumbDislike20Regular />}
                </button>
              )}
            </div>
            {showCommentBox && !feedbackSubmitted && (
              <div className="mt-2 pl-6 flex items-center gap-2">
                <input
                  ref={el => { if (el && !el.dataset.focused) { el.dataset.focused = '1'; el.focus({ preventScroll: true }); } }}
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') handleSkip(); }}
                  placeholder="What's on your mind? (optional)"
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-brand"
                />
                <button onClick={handleSubmit} className="shrink-0 text-sm px-2.5 py-1.5 rounded-md bg-brand text-white hover:opacity-90 transition-opacity">Send</button>
                <button onClick={handleSkip} className="shrink-0 text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip</button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

/**
 * CopilotTypingIndicator - Shows when the AI is thinking.
 * Supports cycling through multiple messages via the `messages` prop.
 */
export const CopilotTypingIndicator: React.FC<{
  agentName?: string;
  agentIcon?: React.ReactNode;
  size?: 'compact' | 'normal';
  /** Single text to show next to the loader — defaults to "Thinking…" */
  text?: string;
  /** Array of messages to cycle through (overrides `text`). Rotates every `interval` ms. */
  messages?: string[];
  /** Time in ms between message rotations. Defaults to 3000. */
  interval?: number;
}> = ({ agentName = 'Copilot Studio', agentIcon, size = 'normal', text = 'Thinking…', messages, interval = 3000 }) => {
  const [msgIndex, setMsgIndex] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  const fadeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!messages || messages.length <= 1) return;
    intervalRef.current = setInterval(() => {
      // Fade out first, swap text at midpoint, then fade back in
      setFading(true);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => {
        setMsgIndex(prev => {
          if (prev >= messages.length - 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
        setFading(false);
      }, 200);
    }, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [messages, interval]);

  // Reset index when messages array changes
  React.useEffect(() => { setMsgIndex(0); setFading(false); }, [messages]);

  const displayText = messages && messages.length > 0 ? messages[msgIndex] : text;

  return (
    <div className={`flex items-center gap-2 ${size === 'normal' ? 'pl-6' : ''}`} style={{ animation: 'fadeInText 0.3s ease-out' }}>
      <LatencyLoader />
      <span className={`text-sm text-gray-500 transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`}>{displayText}</span>
    </div>
  );
};

export default CopilotMessage;
