import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown20Regular,
  ChevronRight20Regular,
  Checkmark20Regular,
  Document20Regular,
  Globe20Regular,
  ShareAndroid20Regular,
  Database20Regular,
  ErrorCircle20Filled,
  Copy20Regular,
  Open20Regular,
} from '@fluentui/react-icons';
import { LatencyLoader } from './StatusIcon';
import { CopilotButton } from './CopilotButton';
import { CopilotStudioIcon } from './CopilotStudioIcon';
import type { DACoTSource, DACoTStep, DANodeType, DANodeStatus, DANode, DANodeDetails, DACoTInlinePill } from '../../domains/agent/utils/daCoTGenerator';

// Re-export types for convenience
export type { DACoTSource, DACoTStep, DANodeType, DANodeStatus, DANode, DANodeDetails };

// ─── M365 Copilot Icon (colorful swirl, no text) ─────────────────────────────
const M365CopilotIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.0721 3.16246C16.7826 2.17691 15.8783 1.5 14.8511 1.5L14.1734 1.5C13.0568 1.5 12.0994 2.2971 11.897 3.3952L10.7119 9.82465L11.0335 8.72215C11.3215 7.73453 12.2269 7.05555 13.2557 7.05555L17.1771 7.05556L18.8242 7.69709L20.4118 7.05556H19.9483C18.9211 7.05556 18.0168 6.37864 17.7273 5.39309L17.0721 3.16246Z" fill="url(#cot_p0)"/>
    <path d="M7.16567 19.828C7.45196 20.8183 8.35859 21.5 9.38943 21.5H10.8433C12.0913 21.5 13.1146 20.5107 13.1568 19.2634L13.3712 12.9201L12.9682 14.2851C12.6777 15.2691 11.7741 15.9444 10.7481 15.9444L6.78685 15.9444L5.37512 15.1786L3.84674 15.9444H4.30256C5.33341 15.9444 6.24004 16.6261 6.52632 17.6164L7.16567 19.828Z" fill="url(#cot_p1)"/>
    <path d="M14.7507 1.5H6.73041C4.43891 1.5 3.06401 4.52777 2.14741 7.55553C1.06148 11.1426 -0.359484 15.9401 3.75146 15.9401H7.21482C8.24955 15.9401 9.15794 15.2559 9.44239 14.2611C10.0445 12.1551 11.0997 8.48146 11.9285 5.68489C12.3497 4.26367 12.7005 3.0431 13.239 2.283C13.5409 1.85686 14.044 1.5 14.7507 1.5Z" fill="url(#cot_p2)"/>
    <path d="M14.7507 1.5H6.73041C4.43891 1.5 3.06401 4.52777 2.14741 7.55553C1.06148 11.1426 -0.359484 15.9401 3.75146 15.9401H7.21482C8.24955 15.9401 9.15794 15.2559 9.44239 14.2611C10.0445 12.1551 11.0997 8.48146 11.9285 5.68489C12.3497 4.26367 12.7005 3.0431 13.239 2.283C13.5409 1.85686 14.044 1.5 14.7507 1.5Z" fill="url(#cot_p3)"/>
    <path d="M9.24933 21.5H17.2696C19.5611 21.5 20.936 18.4722 21.8526 15.4445C22.9385 11.8573 24.3595 7.05988 20.2485 7.05988H16.7852C15.7504 7.05988 14.842 7.74404 14.5576 8.73891C13.9555 10.8449 12.9003 14.5185 12.0715 17.3151C11.6503 18.7363 11.2995 19.9569 10.761 20.717C10.4591 21.1431 9.95601 21.5 9.24933 21.5Z" fill="url(#cot_p4)"/>
    <path d="M9.24933 21.5H17.2696C19.5611 21.5 20.936 18.4722 21.8526 15.4445C22.9385 11.8573 24.3595 7.05988 20.2485 7.05988H16.7852C15.7504 7.05988 14.842 7.74404 14.5576 8.73891C13.9555 10.8449 12.9003 14.5185 12.0715 17.3151C11.6503 18.7363 11.2995 19.9569 10.761 20.717C10.4591 21.1431 9.95601 21.5 9.24933 21.5Z" fill="url(#cot_p5)"/>
    <defs>
      <radialGradient id="cot_p0" cx="0" cy="0" r="1" gradientTransform="matrix(-5.49698 -6.79344 -5.93495 5.69811 18.9994 9.87906)" gradientUnits="userSpaceOnUse">
        <stop offset="0.0955758" stopColor="#00AEFF"/><stop offset="0.773185" stopColor="#2253CE"/><stop offset="1" stopColor="#0736C4"/>
      </radialGradient>
      <radialGradient id="cot_p1" cx="0" cy="0" r="1" gradientTransform="matrix(4.98016 6.47044 5.87896 -5.2813 5.57469 15.7453)" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB657"/><stop offset="0.633728" stopColor="#FF5F3D"/><stop offset="0.923392" stopColor="#C02B3C"/>
      </radialGradient>
      <linearGradient id="cot_p2" x1="6.25039" y1="3.2497" x2="7.39413" y2="16.485" gradientUnits="userSpaceOnUse">
        <stop offset="0.156162" stopColor="#0D91E1"/><stop offset="0.487484" stopColor="#52B471"/><stop offset="0.652394" stopColor="#98BD42"/><stop offset="0.937361" stopColor="#FFC800"/>
      </linearGradient>
      <linearGradient id="cot_p3" x1="7.25046" y1="1.5" x2="7.87502" y2="15.9401" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3DCBFF"/><stop offset="0.246674" stopColor="#0588F7" stopOpacity="0"/>
      </linearGradient>
      <radialGradient id="cot_p4" cx="0" cy="0" r="1" gradientTransform="matrix(-6.33606 18.1116 -21.564 -7.99353 20.6605 5.64609)" gradientUnits="userSpaceOnUse">
        <stop offset="0.0661714" stopColor="#8C48FF"/><stop offset="0.5" stopColor="#F2598A"/><stop offset="0.895833" stopColor="#FFB152"/>
      </radialGradient>
      <linearGradient id="cot_p5" x1="21.2941" y1="6.17827" x2="21.286" y2="10.1112" gradientUnits="userSpaceOnUse">
        <stop offset="0.0581535" stopColor="#F8ADFA"/><stop offset="0.708063" stopColor="#A86EDD" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

// ─── Node Metadata ─────────────────────────────────────────────────────────────

// Inline SVG with gradient fill — reliable cross-browser approach for gradient icons.
// Path data extracted from @fluentui/react-icons (20px Filled variants).
// Gradient: radial from #D660FF (violet, top-right) → #4750EB (indigo), matches Figma.
// Intentionally shared across instances — all use identical colors, so duplicate DOM IDs are harmless.
const GRAD_ID = 'cot-node-icon-grad';

const ICON_PATHS: Partial<Record<DANodeType, string>> = {
  topic:     'M8.54 2a6.5 6.5 0 0 0-5.68 9.67l-.8 2.08a1 1 0 0 0 1.21 1.32l2.49-.7A6.5 6.5 0 1 0 8.54 2ZM6.57 15.74a6.49 6.49 0 0 0 7.71 1.64l2.49.7a1 1 0 0 0 1.2-1.33l-.8-2.08a6.47 6.47 0 0 0-1.37-8.04c.15.56.23 1.15.24 1.76a5.47 5.47 0 0 1 .16 5.98l-.13.2.97 2.54-2.86-.8-.18.09a5.47 5.47 0 0 1-5.67-.4 7.5 7.5 0 0 1-1.76-.26Z',
  knowledge: 'M3.5 2C2.67 2 2 2.67 2 3.5v12.98c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5V3.5C6 2.67 5.33 2 4.5 2h-1Zm5 0C7.67 2 7 2.67 7 3.5v12.98c0 .83.67 1.5 1.5 1.5h1c.83 0 1.5-.67 1.5-1.5V3.5c0-.83-.67-1.5-1.5-1.5h-1Zm7.22 4.16a1.5 1.5 0 0 0-1.87-1.1l-.75.2A1.5 1.5 0 0 0 12.04 7l2 9.8c.18.84 1.02 1.36 1.84 1.15l.99-.25c.79-.2 1.27-1 1.1-1.78l-2.25-9.76Z',
  skill:     'M8.7 2.48a3.5 3.5 0 0 1 2.6 0l5.76 2.3c.57.23.94.78.94 1.4v7.64a1.5 1.5 0 0 1-.94 1.4l-5.76 2.3a3.5 3.5 0 0 1-2.6 0l-5.76-2.3a1.5 1.5 0 0 1-.94-1.4V6.18c0-.62.37-1.17.94-1.4l5.76-2.3Zm-3 3.56a.5.5 0 1 0-.4.92l4.2 1.86v4.68a.5.5 0 0 0 1 0V8.82l4.2-1.86a.5.5 0 1 0-.4-.92L10 7.95l-4.3-1.9Z',
  flow:      'M12.04 7.5H12c-.83 0-1.5.67-1.5 1.5v2A2.5 2.5 0 0 1 8 13.5h-.04a3 3 0 1 1 0-1H8c.83 0 1.5-.67 1.5-1.5V9A2.5 2.5 0 0 1 12 6.5h.04a3 3 0 1 1 0 1Z',
  connector: 'M17.78 2.22c.3.3.3.77 0 1.06l-1.45 1.45a4.04 4.04 0 0 1-.48 5.12l-.3.3-.3.31c-.42.41-1.08.41-1.5 0L9.55 6.24a1.05 1.05 0 0 1 0-1.48l.6-.61a4.05 4.05 0 0 1 5.13-.48l1.45-1.45c.3-.3.77-.3 1.06 0Zm-9 6.25c.3.3.3.77 0 1.06L7.51 10.8l1.69 1.7 1.27-1.28a.75.75 0 1 1 1.06 1.06l-1.28 1.28c.48.58.45 1.45-.1 2l-.3.3a4.04 4.04 0 0 1-5.12.47l-1.45 1.45a.75.75 0 0 1-1.06-1.06l1.45-1.45a4.04 4.04 0 0 1 .48-5.12l.3-.3a1.49 1.49 0 0 1 2-.1l1.27-1.28c.3-.3.77-.3 1.06 0Z',
  prompt:    'M7.4 12.8a1.04 1.04 0 0 0 1.59-.51l.45-1.37a2.34 2.34 0 0 1 1.47-1.48l1.4-.45A1.04 1.04 0 0 0 12.25 7l-1.37-.45A2.34 2.34 0 0 1 9.4 5.08L8.95 3.7a1.03 1.03 0 0 0-.82-.68 1.04 1.04 0 0 0-1.15.7l-.46 1.4a2.34 2.34 0 0 1-1.44 1.45L3.7 7a1.04 1.04 0 0 0 .02 1.97l1.37.45a2.33 2.33 0 0 1 1.48 1.48l.46 1.4c.07.2.2.37.38.5Zm6.14 4.05a.8.8 0 0 0 1.22-.4l.25-.76a1.09 1.09 0 0 1 .68-.68l.77-.25a.8.8 0 0 0-.02-1.52l-.77-.25a1.08 1.08 0 0 1-.68-.68l-.25-.77a.8.8 0 0 0-1.52.01l-.24.76a1.1 1.1 0 0 1-.67.68l-.77.25a.8.8 0 0 0 0 1.52l.77.25a1.09 1.09 0 0 1 .68.68l.25.77c.06.16.16.3.3.4Z',
  tool:      'M6 4.5V6H4a2 2 0 0 0-2 2v2h4v-.5a.5.5 0 0 1 1 0v.5h6v-.5a.5.5 0 0 1 1 0v.5h4V8a2 2 0 0 0-2-2h-2V4.5c0-.83-.67-1.5-1.5-1.5h-5C6.67 3 6 3.67 6 4.5ZM7.5 4h5c.28 0 .5.22.5.5V6H7V4.5c0-.28.22-.5.5-.5ZM18 11h-4v.5a.5.5 0 1 1-1 0V11H7v.5a.5.5 0 0 1-1 0V11H2v4c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2v-4Z',
  agent:     'M14.7 11.5c.99 0 1.8.81 1.8 1.81v.7a3.52 3.52 0 0 1-1.13 2.55c-.95.87-2.6 1.44-5.37 1.44s-4.42-.57-5.37-1.44A3.52 3.52 0 0 1 3.5 14H3.5v-.69c0-1 .81-1.8 1.8-1.8h9.4ZM6.5 3C5.67 3 5 3.67 5 4.5v4c0 .83.67 1.5 1.5 1.5h7c.83 0 1.5-.67 1.5-1.5v-4c0-.83-.67-1.5-1.5-1.5h-3v-.5c0-.3-.22-.5-.5-.5a.5.5 0 0 0-.5.5V3h-3ZM7 6.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm4 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z',
};

function getNodeIcon(type: DANodeType): React.ReactNode {
  const d = ICON_PATHS[type] ?? ICON_PATHS.prompt!;
  return (
    <svg width={24} height={24} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id={GRAD_ID} cx="22" cy="-1" r="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D660FF" />
          <stop offset="70%" stopColor="#4750EB" />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#${GRAD_ID})`} />
    </svg>
  );
}

function getNodeLabel(type: DANodeType): string {
  switch (type) {
    case 'topic':     return 'Topic';
    case 'knowledge': return 'Knowledge';
    case 'agent':     return 'Agent';
    case 'skill':     return 'Skill';
    case 'flow':      return 'Power Automate';
    case 'connector': return 'Connector';
    case 'prompt':    return 'Generative answers';
    case 'tool':      return 'Tool';
    default:          return 'Node';
  }
}

function getSourceIcon(type: DACoTSource['type']): React.ReactNode {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (type) {
    case 'file':       return <Document20Regular className={cls} />;
    case 'url':        return <Globe20Regular className={cls} />;
    case 'sharepoint': return <ShareAndroid20Regular className={cls} />;
    case 'dataverse':  return <Database20Regular className={cls} />;
  }
}

// ─── DASourceChip ─────────────────────────────────────────────────────────────

const DASourceChip: React.FC<{ source: DACoTSource; onSourceClick?: (source: DACoTSource) => void }> = ({ source, onSourceClick }) => (
  <CopilotButton
    variant="action"
    size="sm"
    icon={getSourceIcon(source.type)}
    onClick={onSourceClick ? () => onSourceClick(source) : undefined}
    className="!rounded-full !font-normal !text-[11px] !h-auto !py-1"
  >
    <span className="truncate max-w-[130px]">{source.name}</span>
    {onSourceClick && (
      <Open20Regular style={{ width: 10, height: 10, color: 'hsl(var(--text-disabled))', flexShrink: 0 }} />
    )}
  </CopilotButton>
);

// ─── DATopicPill ──────────────────────────────────────────────────────────────
// Inline clickable pill used mid-sentence in step descriptions

const DATopicPill: React.FC<{ pill: DACoTInlinePill; onPillClick?: (pill: DACoTInlinePill) => void }> = ({ pill, onPillClick }) => {
  const pillColor = pill.type === 'topic' ? 'hsl(var(--brand))' : pill.type === 'connector' ? 'hsl(var(--primary))' : '#0F6CBD';
  const pillPath = pill.type === 'topic' ? ICON_PATHS.topic! : pill.type === 'connector' ? ICON_PATHS.connector! : ICON_PATHS.knowledge!;
  const icon = (
    <svg width={12} height={12} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d={pillPath} fill={pillColor} />
    </svg>
  );

  return (
    <button
      onClick={onPillClick ? () => onPillClick(pill) : undefined}
      className="inline-flex items-center gap-0.5 bg-[hsl(var(--surface-quaternary))] hover:bg-[hsl(var(--stroke-default))] active:bg-[#d0d0d0] rounded-full px-1.5 h-6 align-middle transition-colors cursor-pointer mx-0.5 border-0 outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0"
    >
      {icon}
      <span className="text-[12px] text-[hsl(var(--text-secondary))] whitespace-nowrap leading-none">{pill.label}</span>
      {onPillClick && (
        <Open20Regular style={{ width: 10, height: 10, color: 'hsl(var(--text-disabled))', flexShrink: 0 }} />
      )}
    </button>
  );
};

// Renders a description that may contain an inline pill mid-sentence
const DAStepDescription: React.FC<{ step: DACoTStep; onPillClick?: (pill: DACoTInlinePill) => void }> = ({ step, onPillClick }) => {
  if (step.inlinePill) {
    const { before, after } = step.inlinePill;
    return (
      <div className="text-[12px] text-text-subtle leading-6 flex flex-wrap items-center">
        {before && <span>{before}</span>}
        <DATopicPill pill={step.inlinePill} onPillClick={onPillClick} />
        {after && <span>{after}</span>}
      </div>
    );
  }
  if (step.description) {
    return <p className="text-[12px] text-text-subtle leading-5 whitespace-pre-wrap">{step.description}</p>;
  }
  return null;
};

// ─── DAStepFieldBox ───────────────────────────────────────────────────────────
// Gray box shown inside a step row for Inputs / Output sections

const DAStepFieldBox: React.FC<{ data: Array<{ key: string; value: string }> }> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = data.map(({ key, value }) => `${key} : ${value}`).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="relative group bg-[hsl(var(--surface-tertiary))] rounded-2xl px-3 py-2 mt-1">
      {data.map(({ key, value }) => (
        <div key={key} className="flex items-baseline gap-1.5 py-0.5">
          <span className="text-[12px] text-text-primary whitespace-nowrap shrink-0">{key}</span>
          <span className="text-[11px] text-text-disabled leading-none">:</span>
          <span className="text-[12px] text-brand">{value}</span>
        </div>
      ))}
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
        title={copied ? 'Copied!' : 'Copy'}
      >
        <Copy20Regular className="w-3.5 h-3.5 text-text-subtle" />
      </button>
    </div>
  );
};

// ─── DAStepRawBox ─────────────────────────────────────────────────────────────
// Gray box for raw text lines (e.g. HTTP method + URL, response status)

const DAStepRawBox: React.FC<{ lines: string[] }> = ({ lines }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="relative group bg-[hsl(var(--surface-tertiary))] rounded-2xl px-3 py-1.5 mt-1">
      {lines.map((line, i) => (
        <p key={i} className="text-[12px] text-text-primary leading-5 py-0.5 whitespace-pre-wrap">{line}</p>
      ))}
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
        title={copied ? 'Copied!' : 'Copy'}
      >
        <Copy20Regular className="w-3.5 h-3.5 text-text-subtle" />
      </button>
    </div>
  );
};

// ─── DAJsonField ──────────────────────────────────────────────────────────────

const DAJsonField: React.FC<{ data: Array<{ key: string; value: string }> }> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = data.map(({ key, value }) => `${key}: ${value}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="relative group">
      {data.map(({ key, value }, i) => (
        <div
          key={key}
          className={`flex items-start gap-3 px-4 py-2.5 ${i < data.length - 1 ? 'border-b border-[hsl(var(--stroke-default))]' : ''}`}
        >
          <span className="text-[12px] text-text-subtle whitespace-nowrap shrink-0 w-[120px] leading-5">{key}</span>
          <span className="text-[12px] text-text-primary flex-1 min-w-0 leading-5 break-words">{value}</span>
        </div>
      ))}
      <button
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[hsl(var(--surface-tertiary))] flex items-center justify-center"
        title={copied ? 'Copied!' : 'Copy'}
      >
        <Copy20Regular className="w-3.5 h-3.5 text-text-subtle" />
      </button>
    </div>
  );
};

// ─── DADetailsCard ────────────────────────────────────────────────────────────

const DADetailsCard: React.FC<{ details: DANodeDetails }> = ({ details }) => {
  const [expanded, setExpanded] = useState(true);
  const timeSec = (details.responseTimeMs / 1000).toFixed(2);

  return (
    <div className="border border-[hsl(var(--stroke-default))] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold text-text-primary">Details</span>
          <span className="text-[12px] text-text-subtle">Time taken: {timeSec}s</span>
          {details.tokens != null && (
            <span className="text-[12px] text-text-disabled">· {details.tokens.toLocaleString()} tokens</span>
          )}
        </div>
        <CopilotButton
          variant="icon-subtle"
          size="sm"
          icon={expanded
            ? <ChevronDown20Regular className="w-3.5 h-3.5" />
            : <ChevronRight20Regular className="w-3.5 h-3.5" />
          }
          onClick={() => setExpanded(v => !v)}
          className="!h-6 !w-6"
        />
      </div>

      {/* Fields */}
      {expanded && details.fields && details.fields.length > 0 && (
        <div className="border-t border-[hsl(var(--stroke-default))]">
          <DAJsonField data={details.fields} />
        </div>
      )}
    </div>
  );
};

// ─── DADetailRow (backward compat for old isDetail steps) ─────────────────────

const DADetailRow: React.FC<{ step: DACoTStep; onSourceClick?: (source: DACoTSource) => void }> = ({ step, onSourceClick }) => (
  <div className="py-1.5">
    <p className="text-[13px] font-normal leading-snug text-text-subtle">{step.title}</p>
    {step.description && (
      <p className="text-[12px] text-text-disabled leading-relaxed pt-1 whitespace-pre-wrap">{step.description}</p>
    )}
    {step.sources && step.sources.length > 0 && (
      <div className="flex flex-wrap gap-1.5 pt-1.5">
        {step.sources.map(s => <DASourceChip key={s.id} source={s} onSourceClick={onSourceClick} />)}
      </div>
    )}
  </div>
);

// ─── DACoTStepRow ─────────────────────────────────────────────────────────────

interface DACoTStepRowProps {
  step: DACoTStep;
  isDone: boolean;
  isLastActive: boolean;
  showLineBelow: boolean;
  onPillClick?: (pill: DACoTInlinePill) => void;
  onSourceClick?: (source: DACoTSource) => void;
}

const DACoTStepRow: React.FC<DACoTStepRowProps> = ({ step, isDone, isLastActive, showLineBelow, onPillClick, onSourceClick }) => {
  const [descExpanded, setDescExpanded] = useState(true);
  const hasDesc = !!step.description || !!step.inlinePill || (step.sources && step.sources.length > 0) || (step.fields && step.fields.length > 0) || (step.rawLines && step.rawLines.length > 0);

  return (
    <div className="flex">
      {/* Left: checkmark + connector */}
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className="w-5 h-5 flex items-center justify-center mt-[2px] shrink-0">
          {!isDone && isLastActive
            ? <LatencyLoader size={14} />
            : <Checkmark20Regular className="w-4 h-4 text-text-subtle" />
          }
        </div>
        {showLineBelow && <div className="flex-1 w-px min-h-[4px] bg-border" />}
      </div>

      {/* Right: title + chevron + description */}
      <div className="flex-1 min-w-0 pl-3 pb-2">
        <div className="flex items-center gap-1 py-0.5">
          <span className={`text-[13px] font-semibold flex-1 min-w-0 ${!isDone && isLastActive ? 'text-text-subtle' : 'text-text-primary'}`}>
            {step.title}
          </span>
          {hasDesc && (
            <CopilotButton
              variant="icon-subtle"
              size="sm"
              icon={descExpanded
                ? <ChevronDown20Regular className="w-3 h-3" />
                : <ChevronRight20Regular className="w-3 h-3" />
              }
              onClick={() => setDescExpanded(v => !v)}
              className="!h-5 !w-5 shrink-0"
            />
          )}
        </div>
        {hasDesc && descExpanded && (
          <>
            <DAStepDescription step={step} onPillClick={onPillClick} />
            {step.rawLines && step.rawLines.length > 0 && (
              <DAStepRawBox lines={step.rawLines} />
            )}
            {step.fields && step.fields.length > 0 && (
              <>
                {step.fieldsLabel && (
                  <p className="text-[12px] text-text-subtle mt-1.5">{step.fieldsLabel}</p>
                )}
                <DAStepFieldBox data={step.fields} />
              </>
            )}
            {step.sources && step.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {step.sources.map(s => <DASourceChip key={s.id} source={s} onSourceClick={onSourceClick} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── DASearchCycleGroup ───────────────────────────────────────────────────────

interface DASearchCycleGroupProps {
  cycle: number;
  cycleSteps: { step: DACoTStep; originalIdx: number }[];
  isLoading: boolean;
  visibleCount: number;
  completedCount: number;
  showLineBelow: boolean;
  defaultCollapsed: boolean;
  onSourceClick?: (source: DACoTSource) => void;
}

const DASearchCycleGroup: React.FC<DASearchCycleGroupProps> = ({
  cycle, cycleSteps, isLoading, visibleCount, completedCount, showLineBelow, defaultCollapsed, onSourceClick,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => { setCollapsed(defaultCollapsed); }, [defaultCollapsed]);

  const allDone = cycleSteps.every(({ originalIdx }) => isLoading ? originalIdx < completedCount : true);

  return (
    <>
      {/* Cycle header */}
      <div className="flex">
        <div className="flex flex-col items-center w-6 shrink-0">
          <div className="w-5 h-5 flex items-center justify-center mt-[2px] shrink-0">
            {allDone
              ? <Checkmark20Regular className="w-4 h-4 text-text-subtle" />
              : <LatencyLoader size={14} />
            }
          </div>
          {showLineBelow && <div className="flex-1 w-px min-h-[4px] bg-border" />}
        </div>
        <div className="flex-1 min-w-0 pl-3">
          <CopilotButton
            variant="ghost"
            size="sm"
            icon={collapsed
              ? <ChevronRight20Regular className="w-3.5 h-3.5" />
              : <ChevronDown20Regular className="w-3.5 h-3.5" />
            }
            iconPosition="right"
            onClick={() => setCollapsed(!collapsed)}
            className="!font-semibold !text-[13px] !px-0 !justify-start !text-text-primary"
          >
            Search cycle {cycle}
          </CopilotButton>
        </div>
      </div>

      {/* Sub-steps */}
      {!collapsed && cycleSteps.map(({ step, originalIdx }, si) => {
        const stepDone = isLoading ? originalIdx < completedCount : true;
        const isLastVisible = isLoading && originalIdx === visibleCount - 1 && !stepDone;
        const isLastInCycle = si === cycleSteps.length - 1;
        const showStepLine = !isLastInCycle || showLineBelow;
        const hasSubContent = !!step.description || (step.sources && step.sources.length > 0);

        return (
          <div key={`${originalIdx}-${step.title}`} className="flex">
            <div className="flex flex-col items-center w-6 shrink-0">
              {showLineBelow && <div className="w-px min-h-[4px] bg-border" />}
            </div>
            <div className="flex pl-3 flex-1 min-w-0">
              <div className="flex flex-col items-center w-5 shrink-0">
                <div className="w-4 h-4 shrink-0 flex items-center justify-center mt-[3px]">
                  {!stepDone && isLastVisible
                    ? <LatencyLoader size={12} />
                    : <Checkmark20Regular className="w-3.5 h-3.5 text-text-subtle" />
                  }
                </div>
                {showStepLine && <div className="flex-1 w-px min-h-[4px] bg-border" />}
              </div>
              <div className="flex-1 min-w-0 pl-2 pb-1.5">
                <p className={`text-[12px] font-semibold leading-snug ${!stepDone && isLastVisible ? 'text-text-subtle' : 'text-text-primary'}`}>
                  {step.title}
                </p>
                {hasSubContent && (
                  <>
                    {step.description && (
                      <p className="text-[12px] text-text-subtle leading-5 mt-0.5">{step.description}</p>
                    )}
                    {step.sources && step.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {step.sources.map(s => <DASourceChip key={s.id} source={s} onSourceClick={onSourceClick} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

// ─── DACoTNodeRow ─────────────────────────────────────────────────────────────

interface DACoTNodeRowProps {
  node: DANode;
  isLast: boolean;
  forceExpanded?: boolean;
  onPillClick?: (pill: DACoTInlinePill) => void;
  onSourceClick?: (source: DACoTSource) => void;
  onNodeAsk?: (node: DANode) => void;
}

const DACoTNodeRow: React.FC<DACoTNodeRowProps> = ({ node, isLast, forceExpanded, onPillClick, onSourceClick, onNodeAsk }) => {
  // Completed nodes default to expanded (they were expanded during loading; preserve that on remount)
  const [isExpanded, setIsExpanded] = useState(
    node.status === 'completed' && node.steps.filter(s => !s.isDetail).length > 0
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = node.status === 'loading';
  const isCompleted = node.status === 'completed';

  const regularSteps = node.steps.filter(s => !s.isDetail);
  const legacyDetailSteps = node.steps.filter(s => s.isDetail);
  const totalRegular = regularSteps.length;

  // Start progressive reveal when loading begins
  useEffect(() => {
    if (node.status !== 'loading' || totalRegular === 0) return;

    setIsExpanded(true);
    setVisibleCount(1);
    setCompletedCount(0);
    let current = 0;

    const advance = () => {
      current++;
      if (current < totalRegular) {
        setCompletedCount(current);
        setVisibleCount(current + 1);
        timerRef.current = setTimeout(advance, 600 + Math.random() * 400);
      } else {
        setCompletedCount(totalRegular);
      }
    };

    timerRef.current = setTimeout(advance, 800 + Math.random() * 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [node.status, totalRegular]);

  // Mark all done instantly when completed
  useEffect(() => {
    if (node.status === 'completed') {
      setVisibleCount(totalRegular);
      setCompletedCount(totalRegular);
    }
  }, [node.status, totalRegular]);

  // Respond to global expand/collapse signal
  useEffect(() => {
    if (forceExpanded !== undefined) setIsExpanded(forceExpanded);
  }, [forceExpanded]);

  const hasCotSteps = node.steps.length > 0;
  const cotVisible = (isLoading || isExpanded) && hasCotSteps;
  const showHeaderLine = cotVisible || !isLast;

  // Build step groups (flat + search cycles)
  const stepsToShow = regularSteps.slice(0, isLoading ? visibleCount : totalRegular);
  type StepGroup =
    | { type: 'step'; step: DACoTStep; originalIdx: number }
    | { type: 'cycle'; cycle: number; steps: { step: DACoTStep; originalIdx: number }[] };

  const groups: StepGroup[] = [];
  const cycleMap = new Map<number, { step: DACoTStep; originalIdx: number }[]>();

  stepsToShow.forEach(step => {
    const originalIdx = regularSteps.indexOf(step);
    if (step.cycle != null) {
      if (!cycleMap.has(step.cycle)) {
        const arr: { step: DACoTStep; originalIdx: number }[] = [];
        cycleMap.set(step.cycle, arr);
        groups.push({ type: 'cycle', cycle: step.cycle, steps: arr });
      }
      cycleMap.get(step.cycle)!.push({ step, originalIdx });
    } else {
      groups.push({ type: 'step', step, originalIdx });
    }
  });

  const allCycles = Array.from(cycleMap.keys()).sort((a, b) => a - b);
  const maxCycle = allCycles[allCycles.length - 1] ?? 0;

  return (
    <div className="relative py-1">
      {/* ── Header row ── */}
      <div className="flex group/noderow">
        {/* Left: squircle icon + connector line */}
        <div className="flex flex-col items-center w-6 shrink-0">
          <div className="mt-1 shrink-0">
            {getNodeIcon(node.type)}
          </div>
          {showHeaderLine && <div className="flex-1 w-px min-h-[8px] bg-border" />}
        </div>

        {/* Right: name + type label + error icon + chevron */}
        <div className="flex-1 min-w-0 pl-3 pb-1">
          <div className="flex items-center gap-2 pt-1.5 pb-0.5">
            {isLoading && (
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse shrink-0" />
            )}
            <span className="text-[14px] font-semibold text-text-primary leading-tight">{node.name}</span>
            <span className="text-[10px] text-text-subtle font-normal shrink-0">only visible to makers</span>
            {(node.errorTitle || node.error) && (
              <ErrorCircle20Filled className="w-4 h-4 text-[#bc2f32] shrink-0" />
            )}
            {hasCotSteps && !isLoading && (
              <CopilotButton
                variant="icon-subtle"
                size="sm"
                icon={isExpanded
                  ? <ChevronDown20Regular className="w-3.5 h-3.5" />
                  : <ChevronRight20Regular className="w-3.5 h-3.5" />
                }
                onClick={() => setIsExpanded(!isExpanded)}
                className="!h-6 !w-6"
              />
            )}
            {onNodeAsk && !isLoading && (
              <CopilotButton
                variant="icon-subtle"
                size="sm"
                icon={<CopilotStudioIcon />}
                onClick={() => onNodeAsk(node)}
                className="!h-6 !w-6 opacity-0 group-hover/noderow:opacity-100 transition-opacity"
                title="Ask Copilot about this step"
              />
            )}
          </div>
          <span className="text-[12px] font-normal text-text-subtle block">
            {getNodeLabel(node.type)}
          </span>
        </div>
      </div>

      {/* ── Error message bar ── */}
      {(node.errorTitle || node.error) && (
        <div className="flex items-start gap-2.5 bg-[#fdf3f4] border border-[#eeacb2] rounded-xl px-3.5 py-2.5 mt-2 mb-1 ml-9">
          <ErrorCircle20Filled className="w-4 h-4 text-[#bc2f32] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[hsl(var(--text-primary))] leading-5 flex-1 min-w-0">
            {node.errorTitle && <span className="font-semibold">{node.errorTitle} </span>}
            {node.error && <span>{node.error}</span>}
          </p>
        </div>
      )}

      {/* ── CoT Steps ── */}
      {cotVisible && (
        <div className="animate-slide-up-fade">
          {groups.map((group, gi) => {
            const isLastGroup = gi === groups.length - 1;

            if (group.type === 'step') {
              const { step, originalIdx } = group;
              const isDone = isLoading ? originalIdx < completedCount : true;
              const isLastActive = isLoading && originalIdx === visibleCount - 1 && !isDone;
              const showLineBelow = !isLastGroup || !isLast;

              return (
                <DACoTStepRow
                  key={`step-${gi}`}
                  step={step}
                  isDone={isDone}
                  isLastActive={isLastActive}
                  showLineBelow={showLineBelow}
                  onPillClick={onPillClick}
                  onSourceClick={onSourceClick}
                />
              );
            }

            // Cycle group
            const { cycle, steps: cycleSteps } = group;
            const allCycleStepsDone = cycleSteps.every(({ originalIdx }) =>
              isLoading ? originalIdx < completedCount : true
            );
            const showLineBelow = !isLastGroup || !isLast;

            return (
              <DASearchCycleGroup
                key={`cycle-${cycle}`}
                cycle={cycle}
                cycleSteps={cycleSteps}
                isLoading={isLoading}
                visibleCount={visibleCount}
                completedCount={completedCount}
                showLineBelow={showLineBelow}
                defaultCollapsed={allCycleStepsDone && cycle < maxCycle}
                onSourceClick={onSourceClick}
              />
            );
          })}

        </div>
      )}
    </div>
  );
};

// ─── DAActivityCoT (main export) ──────────────────────────────────────────────

export interface DAActivityCoTProps {
  nodes: DANode[];
  agentName: string;
  className?: string;
  /**
   * Agent icon rendered in the trigger node. Pass a SquircleIcon (size 24) so
   * the trigger visually matches the agent's identity. Falls back to a gradient dot.
   */
  agentIcon?: React.ReactNode;
  /** Display name for the channel shown in the trigger node (e.g. "Slack"). Defaults to "Microsoft 365 Copilot". */
  channelName?: string;
  /** Icon element for the channel shown in the trigger node. Defaults to the M365 Copilot swirl. */
  channelIcon?: React.ReactNode;
  /** When true, suppresses the internal "Expand all / Collapse all" toggle (useful when the parent provides its own). */
  hideExpandToggle?: boolean;
  /**
   * When true, the last node draws a connector line below it, so the CoT chain
   * can visually connect to an agent response element rendered outside this component.
   */
  connectsToResponse?: boolean;
  /**
   * Whether to render the trigger node at the top. Defaults to true.
   */
  showTrigger?: boolean;
  /**
   * External expand/collapse signal. When provided, all nodes expand or collapse
   * to match. Individual node toggles still work after the signal is applied.
   */
  externalExpandedState?: boolean;
  /**
   * Initial expanded state for all nodes. Defaults to true (expanded).
   * Pass false to start all nodes collapsed — the internal Expand all button
   * remains available for the user to expand them.
   */
  initialExpanded?: boolean;
  /**
   * Called when a pill in a CoT step description is clicked.
   * Typically used to navigate to the corresponding Build component.
   */
  onPillClick?: (pill: DACoTInlinePill) => void;
  /**
   * Called when a source chip is clicked.
   * Typically used to navigate to the corresponding Build knowledge component.
   */
  onSourceClick?: (source: DACoTSource) => void;
  /**
   * Called when the user clicks the sparkle "Ask Copilot" button on a node header.
   * Receives the full node so the caller can build a contextual question.
   */
  onNodeAsk?: (node: DANode) => void;
}

export const DAActivityCoT: React.FC<DAActivityCoTProps> = ({
  nodes, agentName: _agentName, className = '', agentIcon: _agentIcon, channelName, channelIcon, hideExpandToggle = false, connectsToResponse, externalExpandedState, showTrigger = true, initialExpanded, onPillClick, onSourceClick, onNodeAsk,
}) => {
  const [forceExpanded, setForceExpanded] = useState<boolean | undefined>(initialExpanded === false ? false : undefined);

  const allCompleted = nodes.length > 0 && nodes.every(n => n.status === 'completed');
  const hasAnySteps = nodes.some(n => n.steps.length > 0);
  const showExpandToggle = allCompleted && hasAnySteps;

  useEffect(() => {
    if (externalExpandedState !== undefined) setForceExpanded(externalExpandedState);
  }, [externalExpandedState]);

  const handleToggleAll = () => {
    setForceExpanded(prev => prev === true ? false : true);
  };

  return (
    <div className={`px-4 py-3 ${className}`}>
      {/* Expand/Collapse all toggle — only shown when not externally controlled */}
      {showExpandToggle && !hideExpandToggle && externalExpandedState === undefined && (
        <div className="flex items-center mb-1 animate-slide-up-fade">
          <CopilotButton
            variant="ghost"
            size="sm"
            icon={forceExpanded === true
              ? <ChevronDown20Regular className="w-3.5 h-3.5" />
              : <ChevronRight20Regular className="w-3.5 h-3.5" />
            }
            onClick={handleToggleAll}
            className="!text-[11px] !px-0 !font-normal text-text-disabled"
          >
            {forceExpanded === true ? 'Collapse all' : 'Expand all'}
          </CopilotButton>
        </div>
      )}

      {/* Trigger node */}
      {showTrigger && (
        <div className="flex">
          <div className="flex flex-col items-center w-6 shrink-0">
            <div className="mt-1 shrink-0">
              {channelIcon ?? <M365CopilotIcon size={24} />}
            </div>
            {nodes.length > 0 && <div className="flex-1 w-px min-h-[8px] bg-border" />}
          </div>
          <div className="flex-1 min-w-0 pl-3 pb-2">
            <div className="flex items-center gap-2 pt-1.5 pb-0.5">
              <span className="text-[14px] font-semibold text-text-primary leading-tight">{channelName ?? 'Microsoft 365 Copilot'}</span>
              <span className="text-[10px] text-text-subtle font-normal shrink-0">only visible to makers</span>
            </div>
            <span className="text-[12px] font-normal text-text-subtle block">
              Trigger
            </span>
          </div>
        </div>
      )}

      {/* Node rows */}
      {nodes.map((node, index) => (
        <DACoTNodeRow
          key={node.id}
          node={node}
          isLast={index === nodes.length - 1 && !connectsToResponse}
          forceExpanded={forceExpanded}
          onPillClick={onPillClick}
          onSourceClick={onSourceClick}
          onNodeAsk={onNodeAsk}
        />
      ))}
    </div>
  );
};

export default DAActivityCoT;
