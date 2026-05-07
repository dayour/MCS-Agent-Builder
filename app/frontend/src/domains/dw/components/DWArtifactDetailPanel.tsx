import React, { useState } from 'react';
import {
  ArrowLeft20Regular,
  ArrowDownload20Regular,
  Share20Regular,
  Open20Regular,
  DocumentText20Regular,
  TableSimple20Regular,
  SlideAdd20Regular,
  Mail20Regular,
  Chat20Regular,
  Document20Regular,
  Copy20Regular,
  CheckmarkCircle16Regular,
  Person20Regular,
  PersonAdd20Regular,
  Link20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ArrowReply16Regular,
  ChevronDown16Regular,
  ChevronUp16Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { getConnectorIcon } from '../../../utils/agentIcons';
import type { ArtifactType, ArtifactPreview, SharedFile, ChatMessage, EmailData, DocData, SpreadsheetData, SlideData, FileData, SharePointFile, TaskArtifact } from '../data/dwArtifactData';

// Re-export types and data for consumers
export type { ArtifactType, TaskArtifact } from '../data/dwArtifactData';
export { ARTIFACTS } from '../data/dwArtifactData';

// ── File type icon helpers ───────────────────────────────────────────────────

const FILE_EXT_COLORS: Record<string, string> = {
  docx: 'bg-blue-600',
  doc: 'bg-blue-600',
  xlsx: 'bg-green-700',
  xls: 'bg-green-700',
  csv: 'bg-green-700',
  pptx: 'bg-orange-500',
  ppt: 'bg-orange-500',
  pdf: 'bg-red-600',
  png: 'bg-purple-500',
  jpg: 'bg-purple-500',
};

function FileExtBadge({ ext, size = 'sm' }: { ext: string; size?: 'sm' | 'md' }) {
  const color = FILE_EXT_COLORS[ext] || 'bg-neutral-500';
  const sizeClasses = size === 'md' ? 'w-8 h-8 text-[9px]' : 'w-6 h-6 text-[8px]';
  return (
    <span className={`${sizeClasses} rounded flex items-center justify-center ${color} text-white font-bold uppercase flex-shrink-0`}>
      {ext.slice(0, 4)}
    </span>
  );
}

// ── Preview renderers ─────────────────────────────────────────────────────────

function FileAttachmentCard({ file }: { file: SharedFile }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 mt-1.5 rounded-lg border border-neutral-200 bg-white max-w-[260px]">
      <FileExtBadge ext={file.ext} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-800 truncate">{file.name}</p>
        <p className="text-[10px] text-neutral-400">{file.size}</p>
      </div>
      <CopilotButton variant="transparent" size="xs" className="!text-[10px] !font-semibold !text-[#5B5FC7] hover:!text-[#444791] !p-0 !h-auto !min-w-0 flex-shrink-0">
        Open
      </CopilotButton>
    </div>
  );
}

function TeamsChatPreview({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200">
      {/* Channel header */}
      <div className="bg-gradient-to-r from-[#5B5FC7] to-[#4F6BED] px-4 py-2.5 flex items-center gap-2">
        <span className="text-white/90 text-xs font-semibold">Sprint 22 Retrospective</span>
        <span className="text-white/50 text-[10px]">General</span>
      </div>

      {/* Messages */}
      <div className="bg-white p-4 space-y-3">
        {messages.map((msg, i) => {
          const initials = msg.from.split(' ').map(n => n[0]).join('').slice(0, 2);
          return (
            <div key={i} className="flex gap-2.5">
              {/* Avatar */}
              {msg.fromAgent ? (
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5B5FC7] to-[#4F6BED] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  ✦
                </span>
              ) : (
                <span className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                  {initials}
                </span>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-neutral-800">{msg.from}</span>
                  <span className="text-[10px] text-neutral-400">{msg.time}</span>
                </div>
                <div className={`mt-0.5 px-3 py-2 rounded-lg text-sm leading-5 text-neutral-800 ${msg.fromAgent ? 'bg-[#EFF6FF]' : 'bg-neutral-50'}`}>
                  {msg.body}
                </div>
                {msg.attachment && <FileAttachmentCard file={msg.attachment} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutlookEmailPreview({ data }: { data: EmailData }) {
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const senderName = data.from.split('<')[0].trim();
  const senderInitials = senderName.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="space-y-0">
      {/* Blue accent bar */}
      <div className="h-1 bg-[#0078D4] rounded-t-xl" />

      <div className="border border-t-0 border-neutral-200 rounded-b-xl bg-white">
        {/* Header card */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0078D4] to-[#005A9E] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {senderInitials}
            </span>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-semibold text-neutral-900">{senderName}</p>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>To: {data.to}</span>
                <span className="text-neutral-300">|</span>
                <span>{data.sentAt}</span>
              </div>
            </div>
          </div>

          <h3 className="text-base font-semibold text-neutral-900">{data.subject}</h3>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-100" />

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-neutral-800 leading-6 whitespace-pre-wrap" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
            {data.body}
          </p>
        </div>

        {/* Replies */}
        {data.replies && data.replies.length > 0 && (
          <div className="border-t border-neutral-100">
            <div className="px-5 py-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                {data.replies.length} {data.replies.length === 1 ? 'Reply' : 'Replies'}
              </p>
              <div className="space-y-2">
                {data.replies.map((reply, i) => {
                  const replyInitials = reply.from.split(' ').map(n => n[0]).join('').slice(0, 2);
                  const isExpanded = expandedReplies[i] ?? true;
                  return (
                    <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50">
                      <CopilotButton
                        variant="transparent"
                        onClick={() => setExpandedReplies(prev => ({ ...prev, [i]: !isExpanded }))}
                        className="!w-full !gap-2.5 !px-3 !py-2.5 !h-auto !justify-start !rounded-none !font-normal"
                      >
                        <ArrowReply16Regular className="w-3.5 h-3.5 text-[#0078D4] flex-shrink-0" />
                        <span className="w-6 h-6 rounded-full bg-neutral-300 text-neutral-700 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                          {replyInitials}
                        </span>
                        <span className="text-xs font-semibold text-neutral-700 flex-1">{reply.from}</span>
                        <span className="text-[10px] text-neutral-400 flex-shrink-0">{reply.sentAt}</span>
                        {isExpanded ? (
                          <ChevronUp16Regular className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <ChevronDown16Regular className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </CopilotButton>
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-[52px]">
                          <p className="text-sm text-neutral-700 leading-5">{reply.body}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WordPreview({ data }: { data: DocData }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8 space-y-5" style={{ minHeight: 200 }}>
      <h1 className="text-xl font-bold text-neutral-900">{data.title}</h1>
      <div className="border-b border-neutral-100" />
      {data.sections.map((section, i) => (
        <div key={i} className="space-y-1.5">
          {section.heading && (
            <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">{section.heading}</h2>
          )}
          <p className="text-sm text-neutral-800 leading-6 whitespace-pre-wrap">{section.body}</p>
        </div>
      ))}
    </div>
  );
}

function ExcelPreview({ data }: { data: SpreadsheetData }) {
  const lastRow = data.rows.length - 1;
  return (
    <div className="space-y-0">
      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-t-xl">
        <span className="text-[11px] font-semibold text-neutral-500 italic">fx</span>
        <div className="flex-1 h-6 rounded border border-neutral-200 bg-white px-2 flex items-center">
          <span className="text-[11px] text-neutral-300">Select a cell to view formula</span>
        </div>
      </div>

      {/* Table — raw <table> intentional: this is a visual mock of an Excel spreadsheet
         with custom cell borders, alternating row colors, and green header styling.
         CopilotTable's data-table styling would not replicate the Excel chrome. */}
      <div className="overflow-x-auto border-x border-neutral-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1D7044] text-white">
              {data.headers.map((h, i) => (
                <th key={i} className={`px-3 py-2 text-left font-semibold text-xs whitespace-nowrap border border-[#1a6339] ${i > 0 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const isTotal = ri === lastRow;
              return (
                <tr key={ri} className={`${isTotal ? 'font-semibold border-t-2 border-t-neutral-400' : ''} ${ri % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 text-xs whitespace-nowrap border border-neutral-200 ${ci > 0 ? 'text-right' : ''} ${typeof cell === 'string' && cell.startsWith('+') ? 'text-red-600' : typeof cell === 'string' && cell.startsWith('−') ? 'text-green-700' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-0 bg-neutral-50 border border-t-0 border-neutral-200 rounded-b-xl overflow-hidden">
        <div className="px-4 py-1.5 text-xs font-medium text-neutral-800 border-b-2 border-[#1D7044] bg-white">
          {data.sheetName}
        </div>
        <div className="px-3 py-1.5 text-[11px] text-neutral-400">Sheet2</div>
        <div className="px-3 py-1.5 text-[11px] text-neutral-400">Sheet3</div>
      </div>

      {data.footnote && <p className="text-[11px] text-neutral-400 italic mt-2">{data.footnote}</p>}
    </div>
  );
}

function PowerPointPreview({ data }: { data: SlideData }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = data.slides[activeSlide];
  return (
    <div className="space-y-3">
      {/* Slide viewer with navigation */}
      <div className="relative">
        <div className="bg-gradient-to-br from-[#1E1E2E] to-[#2D2D44] rounded-xl p-8 min-h-[220px] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/40 font-medium tracking-widest uppercase">{data.title}</p>
            <span className="text-[10px] text-white/30 bg-white/10 px-2 py-0.5 rounded-full font-medium">
              {activeSlide + 1} / {data.slides.length}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{slide.heading}</h2>
          <ul className="space-y-2 mt-1">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/80">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">&#9656;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Nav arrows */}
        {activeSlide > 0 && (
          <CopilotButton
            variant="icon"
            size="sm"
            onClick={() => setActiveSlide(s => s - 1)}
            className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !rounded-full !bg-black/30 hover:!bg-black/50 !text-white"
            icon={<ChevronLeft20Regular className="w-5 h-5" />}
          />
        )}
        {activeSlide < data.slides.length - 1 && (
          <CopilotButton
            variant="icon"
            size="sm"
            onClick={() => setActiveSlide(s => s + 1)}
            className="!absolute !right-2 !top-1/2 !-translate-y-1/2 !rounded-full !bg-black/30 hover:!bg-black/50 !text-white"
            icon={<ChevronRight20Regular className="w-5 h-5" />}
          />
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2">
        {data.slides.map((s, i) => (
          <CopilotButton
            key={i}
            variant="secondary"
            size="sm"
            onClick={() => setActiveSlide(i)}
            className={`!flex-1 !px-3 !py-2 !rounded-lg !text-left !h-auto !items-start !flex-col ${i === activeSlide ? '!border-purple-400 !bg-purple-50 !shadow-sm' : '!border-neutral-200 hover:!border-neutral-300 !bg-white'}`}
          >
            <p className={`text-[10px] font-medium ${i === activeSlide ? 'text-purple-700' : 'text-neutral-400'}`}>Slide {i + 1}</p>
            <p className={`text-[11px] font-medium truncate mt-0.5 w-full ${i === activeSlide ? 'text-purple-900' : 'text-neutral-600'}`}>{s.heading}</p>
          </CopilotButton>
        ))}
      </div>
    </div>
  );
}

function SharePointPreview({ files }: { files: SharePointFile[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-neutral-200">
        <span className="flex-shrink-0">{getConnectorIcon('sharepoint', 'w-5 h-5')}</span>
        <h3 className="text-sm font-semibold text-[#0364B8]">Documents</h3>
        <span className="text-[11px] text-neutral-400 ml-auto">{files.length} items</span>
      </div>

      {/* File list header */}
      <div className="grid grid-cols-[1fr_100px_100px_60px] gap-2 px-4 py-2 bg-neutral-50 border-b border-neutral-100 text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
        <span>Name</span>
        <span>Modified</span>
        <span>Modified By</span>
        <span className="text-right">Size</span>
      </div>

      {/* File rows */}
      <div className="divide-y divide-neutral-100 bg-white">
        {files.map((file, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_100px_60px] gap-2 px-4 py-2.5 items-center hover:bg-[#F3F7FB] transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileExtBadge ext={file.ext} size="sm" />
              <span className="text-sm text-neutral-800 truncate group-hover:text-[#0364B8] transition-colors">{file.name}</span>
            </div>
            <span className="text-xs text-neutral-500">{file.modified}</span>
            <span className="text-xs text-neutral-500 truncate">{file.modifiedBy}</span>
            <span className="text-xs text-neutral-400 text-right">{file.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilePreview({ data }: { data: FileData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4 p-4 rounded-xl border border-neutral-200 bg-neutral-50">
        <div className="w-12 h-12 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
          <Document20Regular className="w-6 h-6 text-neutral-400" />
        </div>
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{data.filename}</p>
          <p className="text-xs text-neutral-500">{data.size} · Modified {data.modified}</p>
          <p className="text-xs text-neutral-500">{data.location}</p>
        </div>
      </div>
      <div className="p-4 rounded-xl border border-amber-100 bg-amber-50">
        <p className="text-sm text-amber-800 leading-5">{data.description}</p>
      </div>
    </div>
  );
}

// ── Shared files bar ──────────────────────────────────────────────────────────

function SharedFilesBar({ files }: { files: SharedFile[] }) {
  return (
    <div className="border border-neutral-200 rounded-xl bg-neutral-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Files shared in this task</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {files.map((file, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white flex-shrink-0 min-w-[180px] max-w-[260px]">
            <FileExtBadge ext={file.ext} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800 truncate">{file.name}</p>
              <p className="text-[10px] text-neutral-400">{file.size}</p>
            </div>
            <CopilotButton variant="icon-subtle" size="xs" className="!w-6 !h-6 !rounded" icon={<ArrowDownload20Regular className="w-4 h-4" />} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META: Record<ArtifactType, { label: string; icon: React.ReactNode; color: string }> = {
  word:        { label: 'Word document',       icon: <DocumentText20Regular />,  color: 'text-blue-700' },
  excel:       { label: 'Spreadsheet',         icon: <TableSimple20Regular />,   color: 'text-green-700' },
  powerpoint:  { label: 'Presentation',        icon: <SlideAdd20Regular />,      color: 'text-orange-600' },
  email:       { label: 'Email',               icon: <Mail20Regular />,          color: 'text-sky-600' },
  chat:        { label: 'Chat transcript',     icon: <Chat20Regular />,          color: 'text-purple-600' },
  file:        { label: 'File',                icon: <Document20Regular />,      color: 'text-neutral-500' },
  sharepoint:  { label: 'SharePoint library',  icon: <Document20Regular />,      color: 'text-[#0364B8]' },
};

// ── Share panel ───────────────────────────────────────────────────────────────

function SharePanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="border border-neutral-200 rounded-2xl p-5 bg-white space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Share this artifact</p>
        <CopilotButton variant="icon-subtle" size="xs" onClick={onClose} className="!text-lg !leading-none" icon={<span>×</span>} />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50">
          <Link20Regular className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="text-xs text-neutral-500 truncate">https://contoso.sharepoint.com/artifact/...</span>
        </div>
        <CopilotButton
          variant="secondary"
          size="sm"
          icon={copied ? <CheckmarkCircle16Regular className="text-green-600" /> : <Copy20Regular />}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </CopilotButton>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-neutral-500">Share with</p>
        <div className="flex gap-2">
          <CopilotButton variant="secondary" size="sm" icon={<Person20Regular />}>Teammates</CopilotButton>
          <CopilotButton variant="secondary" size="sm" icon={<PersonAdd20Regular />}>Add people</CopilotButton>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DWArtifactDetailPanelProps {
  artifact: TaskArtifact;
  taskName: string;
  onClose: () => void;
}

export const DWArtifactDetailPanel: React.FC<DWArtifactDetailPanelProps> = ({ artifact, taskName, onClose }) => {
  const meta = TYPE_META[artifact.type];
  const [showShare, setShowShare] = useState(false);

  const renderPreview = () => {
    const p = artifact.preview;
    if (p.type === 'chat')        return <TeamsChatPreview messages={p.messages} />;
    if (p.type === 'email')       return <OutlookEmailPreview data={p.data} />;
    if (p.type === 'word')        return <WordPreview data={p.data} />;
    if (p.type === 'excel')       return <ExcelPreview data={p.data} />;
    if (p.type === 'powerpoint')  return <PowerPointPreview data={p.data} />;
    if (p.type === 'sharepoint')  return <SharePointPreview files={p.files} />;
    if (p.type === 'file')        return <FilePreview data={p.data} />;
    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white">
      <div className="pt-10 pb-12 space-y-6 w-full">

        {/* ── Back ─────────────────────────────────────────────────────── */}
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular className="w-4 h-4" />}
          onClick={onClose}
          className="!px-0 !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))] -mt-2"
        >
          {taskName}
        </CopilotButton>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Type label */}
          <div className={`flex items-center gap-1.5 ${meta.color}`}>
            <span className="w-4 h-4 flex items-center">{meta.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
          </div>

          {/* Filename + actions */}
          <div className="flex items-start gap-4">
            <h1 className="flex-1 text-[24px] font-bold text-[hsl(var(--text-primary))] leading-8 break-words">{artifact.name}</h1>
          </div>

          {/* Status pill */}
          {artifact.status === 'awaiting' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              ⏳ Awaiting feedback
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 pt-1">
            {artifact.appKey && (
              <CopilotButton
                variant="primary"
                size="sm"
                icon={getConnectorIcon(artifact.appKey, 'w-4 h-4')}
                onClick={() => {}}
              >
                Open in {artifact.appLabel}
              </CopilotButton>
            )}
            <CopilotButton
              variant="secondary"
              size="sm"
              icon={<ArrowDownload20Regular className="w-4 h-4" />}
              onClick={() => {}}
            >
              Download
            </CopilotButton>
            <div className="relative">
              <CopilotButton
                variant="secondary"
                size="sm"
                icon={<Share20Regular className="w-4 h-4" />}
                onClick={() => setShowShare(v => !v)}
              >
                Share
              </CopilotButton>
              {showShare && (
                <div className="absolute top-full left-0 mt-2 w-80 z-20">
                  <SharePanel onClose={() => setShowShare(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Shared files bar ────────────────────────────────────────── */}
        {artifact.sharedFiles && artifact.sharedFiles.length > 0 && (
          <SharedFilesBar files={artifact.sharedFiles} />
        )}

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-neutral-200" />

        {/* ── Preview ───────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Preview</p>
          <div className="bg-[hsl(var(--surface-secondary))] border border-neutral-200 rounded-2xl p-6">
            {renderPreview()}
          </div>
        </div>

      </div>
    </div>
  );
};

// ── Deliverable detail panel ──────────────────────────────────────────────────
// For static deliverables that have no linked TaskArtifact.

export interface DeliverableFileProp {
  id: string;
  name: string;
  type: 'document' | 'spreadsheet' | 'presentation' | 'report' | 'note';
  app: string;
  location: string;
  actionText: string;
  owner?: string;
  url?: string;
}

const DELIVERABLE_TYPE_META: Record<DeliverableFileProp['type'], { label: string; icon: React.ReactNode; color: string }> = {
  document:     { label: 'Word document',  icon: <DocumentText20Regular />, color: 'text-blue-700' },
  spreadsheet:  { label: 'Spreadsheet',    icon: <TableSimple20Regular />,  color: 'text-green-700' },
  presentation: { label: 'Presentation',   icon: <SlideAdd20Regular />,     color: 'text-orange-600' },
  report:       { label: 'Report',         icon: <DocumentText20Regular />, color: 'text-neutral-700' },
  note:         { label: 'Note',           icon: <Document20Regular />,     color: 'text-purple-600' },
};

const APP_LABELS: Record<string, string> = {
  word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint',
  onenote: 'OneNote', sharepoint: 'SharePoint', onedrive: 'OneDrive',
};

// Rich placeholder previews for each static deliverable
const DELIVERABLE_PREVIEWS: Record<string, ArtifactPreview> = {
  d1: { type: 'powerpoint', data: { title: '[Internal] M365 Companion — Copilot Value Walking Deck', slides: [
    { heading: 'Why Microsoft Copilot', bullets: ['Integrated across Word, Excel, Teams, and Outlook', 'Reduces time on routine tasks by up to 30%', 'Grounded in your org\'s data via Microsoft Graph'] },
    { heading: 'Key Use Cases', bullets: ['Meeting summaries and action items in Teams', 'Draft and reply suggestions in Outlook', 'Document generation and rewriting in Word', 'Formula assistance and data insights in Excel'] },
    { heading: 'ROI Highlights', bullets: ['6.8 hours saved per week per user (Forrester, 2025)', '83% of early adopters report improved focus', '$5.8M estimated annual value for 500-seat deployment'] },
  ]}},
  d2: { type: 'excel', data: { sheetName: 'Q2 Summary',
    headers: ['Category', 'Q1 Actual', 'Q2 Budget', 'Q2 Forecast', 'Δ vs Budget'],
    rows: [
      ['Headcount',       '$2,140,000', '$2,280,000', '$2,310,000', '+$30,000'],
      ['Infrastructure',  '$420,000',   '$460,000',   '$445,000',   '−$15,000'],
      ['Marketing',       '$580,000',   '$640,000',   '$660,000',   '+$20,000'],
      ['T&E',             '$112,000',   '$130,000',   '$118,000',   '−$12,000'],
      ['TOTAL',           '$3,252,000', '$3,510,000', '$3,533,000', '+$23,000'],
    ],
    footnote: 'Forecast as of March 20, 2026. Pending finance sign-off.',
  }},
  d3: { type: 'word', data: { title: 'Accessibility Requirements', sections: [
    { heading: 'Overview', body: 'This document outlines accessibility requirements for all M365 Companion surfaces. All new features must meet WCAG 2.1 AA standards before release.' },
    { heading: 'Core Requirements', body: '• All interactive elements must be keyboard navigable\n• Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text\n• Screen reader support required for all tables and form controls\n• Focus indicators must be clearly visible at all times' },
    { heading: 'Testing Protocol', body: 'All features require accessibility sign-off from the A11y team before merging. Use the accessibility-checklist template in Confluence for PR reviews.' },
  ]}},
  d4: { type: 'powerpoint', data: { title: 'CEO Townhall — July Cut', slides: [
    { heading: 'Company Highlights', bullets: ['Q2 revenue: $142M (+18% YoY)', 'New logo wins: 34 enterprise accounts', 'NPS: 71 (+6 from last quarter)', 'Headcount: 1,247 across 12 offices'] },
    { heading: 'Strategic Priorities H2', bullets: ['Accelerate AI Teammate rollout', 'Expand into EMEA mid-market', 'Complete SOC 2 Type II certification', 'Invest in onboarding and retention programs'] },
    { heading: 'Q&A', bullets: ['Submit questions via Slido: #townhall-july', 'Recording available in SharePoint within 24 hours', 'Follow-up AMA scheduled for July 12'] },
  ]}},
  d5: { type: 'word', data: { title: 'Weekly Status Report — Week 28', sections: [
    { heading: 'Completed This Week', body: '• Shipped v2.4.1 with accessibility fixes and performance improvements\n• Completed Sprint 22 retrospective — 3 action items logged\n• Q1 financial close completed; variance report submitted to Finance\n• 2 new enterprise onboarding sessions delivered' },
    { heading: 'In Progress', body: '• Day 100 AI Teammate feature (targeting Thursday demo)\n• Notification system overhaul — design review Wednesday\n• Annual performance data rollup due Friday' },
    { heading: 'Blockers & Risks', body: '• Competitor landscape refresh delayed 4 days — reassigned to Sophie\n• Dexter API availability required for Day 100 demo — confirming with infra' },
  ]}},
  d6: { type: 'excel', data: { sheetName: 'Audit Checklist',
    headers: ['Control Area', 'Requirement', 'Status', 'Owner', 'Due'],
    rows: [
      ['Access Control',    'MFA enforced for all admin accounts',     '✓ Complete',   'James O.', 'Mar 1'],
      ['Data Handling',     'PII data classified and labeled',         '⏳ In Review', 'Priya N.', 'Mar 25'],
      ['Incident Response', 'IR plan reviewed and tested',             '✓ Complete',   'Marco R.', 'Mar 10'],
      ['Vendor Risk',       'Third-party risk assessments updated',    '⏳ In Progress','AI Teammate','Mar 28'],
      ['Training',          'Security awareness training completed',   '✓ Complete',   'Sophie L.','Mar 5'],
    ],
    footnote: 'Updated March 17, 2026. Owned by Priya Nair.',
  }},
  d7: { type: 'excel', data: { sheetName: 'Timeline',
    headers: ['Milestone', 'Owner', 'Start', 'End', 'Status'],
    rows: [
      ['Q2 Planning',            'Avery F.',  'Mar 1',  'Mar 15', '✓ Done'],
      ['Design Handoff',         'Sophie L.', 'Mar 10', 'Mar 20', '✓ Done'],
      ['Engineering Sprint 22',  'Marco R.',  'Mar 10', 'Mar 24', '⏳ Active'],
      ['QA & Accessibility',     'James O.',  'Mar 25', 'Apr 4',  '⬜ Upcoming'],
      ['Release v2.5',           'Avery F.',  'Apr 7',  'Apr 7',  '⬜ Upcoming'],
    ],
    footnote: 'Last updated March 15, 2026. Shared with engineering leads.',
  }},
  d8: { type: 'word', data: { title: 'Onboarding Checklist — New Hire', sections: [
    { heading: 'Day 1', body: '✓ Complete IT setup and access requests\n✓ Meet with your manager (Avery Fuller)\n✓ Review team wiki and design system docs\n✓ Attend Thursday all-hands\n□ Complete security training module' },
    { heading: 'Week 1 Goals', body: '□ Schedule 1:1s with all immediate team members\n□ Review current sprint board and pick up a starter task\n□ Join #team-rd, #design-feedback, and #eng-general Slack channels\n□ Read the last 3 retrospective summaries' },
    { heading: 'Resources', body: 'Design system: figma.com/contoso/design-system\nEngineering wiki: confluence.contoso.com/eng\nHR portal: people.contoso.com\nIT help: helpdesk@contoso.com · ext. 4400' },
  ]}},
  d9: { type: 'word', data: { title: 'Design Review Notes — Sprint 22', sections: [
    { heading: 'Attendees', body: 'Sophie Lin (lead), Avery Fuller, Marcus Webb, Priya Nair' },
    { heading: 'Components Reviewed', body: '• New notification drawer — Approved with minor changes\n• Kanban card redesign — Approved\n• Filter pill sizing — Needs revision (xs size too small on mobile)\n• AI Teammate overview layout — Approved pending accessibility check' },
    { heading: 'Action Items', body: '• Sophie to revise filter pill sizing by March 20\n• Marcus to update Figma specs with approved kanban card changes\n• Avery to schedule accessibility review for AI Teammate overview' },
  ]}},
  d10: { type: 'powerpoint', data: { title: 'Launch Event Highlights', slides: [
    { heading: 'Event Overview', bullets: ['300+ attendees across 8 cities', '12 sessions, 4 keynotes', '94% satisfaction score from post-event survey', '47 press mentions in first 24 hours'] },
    { heading: 'Top Moments', bullets: ['CEO live demo of AI Teammate on stage', 'Customer panel: 3 enterprise logos sharing ROI stories', 'Product roadmap reveal — 2,400 social impressions', 'Hackathon winner: AI-powered meeting prep tool'] },
    { heading: 'Follow-Up Actions', bullets: ['Send thank-you emails to all speakers by EOW', 'Publish session recordings to portal by March 25', 'Share approved press kit and media assets', 'Schedule post-event debrief with GTM team'] },
  ]}},
  d11: { type: 'word', data: { title: 'Q1 Retrospective Summary', sections: [
    { heading: 'What Went Well', body: '• Shipped 3 major features on schedule including AI Teammate Day 0\n• Team NPS improved from 62 to 71\n• Zero P0 incidents in production for the full quarter\n• Successful expansion into EMEA pilot — 4 new logos' },
    { heading: 'What Could Be Improved', body: '• Scope creep affected 2 sprints — need stronger change control\n• Cross-functional handoffs between design and engineering added delays\n• Documentation lagged behind shipping pace in Q1' },
    { heading: 'Actions for Q2', body: '• Implement stricter sprint scope freeze after day 3\n• Add design-to-eng handoff checklist to sprint planning template\n• Assign documentation owner for each major feature shipped' },
  ]}},
  d12: { type: 'word', data: { title: 'Stakeholder Meeting Notes — March 10', sections: [
    { heading: 'Attendees', body: 'Avery Fuller, Lydia Barnes (VP Product), Marcus Webb, James Okafor, external: Contoso CSM' },
    { heading: 'Key Discussion Points', body: '• Q2 roadmap priorities reviewed and aligned\n• Compliance milestone confirmed for June — legal sign-off required by April 15\n• Customer requested earlier access to evaluation reporting — added to Q2 backlog\n• Budget ask for EMEA expansion approved in principle (formal sign-off by March 25)' },
    { heading: 'Next Steps', body: '• Avery to circulate updated roadmap by March 15\n• Lydia to confirm legal review timeline for compliance milestone\n• James to scope evaluation reporting feature for next sprint\n• Schedule follow-up meeting for April 5' },
  ]}},
  // h11 SharePoint sub-files — individual compliance documents
  'h11-0': { type: 'word', data: { title: 'Data Handling Policy v3.2', sections: [
    { heading: 'Purpose & Scope', body: 'This policy governs the collection, storage, processing, and deletion of personal and sensitive data across all Contoso systems. Applies to all employees, contractors, and third-party vendors with access to Contoso data assets.' },
    { heading: 'Data Classification & Controls', body: '• Confidential — encrypted at rest and in transit; MFA required\n• Internal — accessible only to authenticated employees\n• Public — no restrictions; must not contain PII\n\nAll systems handling Confidential data must log access and retain audit trails for 24 months.' },
    { heading: 'Retention & Deletion', body: '• Customer PII: retained for contract duration + 90 days\n• Financial records: 7 years per regulatory requirement\n• Employee records: duration of employment + 5 years\n• Deletion confirmed via automated purge workflow; certificate of destruction issued upon request' },
  ]}},
  'h11-1': { type: 'excel', data: { sheetName: 'Q1 2026 Checklist',
    headers: ['Control Area', 'Status', 'Notes'],
    rows: [
      ['Data encryption at rest',               '✓ Verified',      'AES-256 enforced across all storage tiers'],
      ['MFA for privileged accounts',           '✓ Verified',      'Entra ID — 100% coverage'],
      ['Access log retention ≥ 24 months',      '✓ Verified',      'Sentinel workspace — 730-day retention'],
      ['Security awareness training',           '⏳ 94% complete', '141 of 150 employees completed'],
      ['Third-party vendor risk assessments',   '⏳ 2 pending',    'Zoom, Jira reviews in progress'],
      ['Incident response plan reviewed',       '✓ Verified',      'Tabletop exercise completed Feb 28'],
      ['GDPR data subject request process',     '✓ Verified',      'SLA: respond within 72 h'],
      ['SOC 2 Type II audit scheduled',         '⏳ June 2026',    'Deloitte engagement confirmed'],
    ],
    footnote: 'Updated March 22, 2026. Owned by Priya Nair.',
  }},
  'h11-2': { type: 'word', data: { title: 'Audit Evidence — Access Controls', sections: [
    { heading: 'Audit Period', body: 'January 1 – March 31, 2026. Conducted by Internal Audit in coordination with Information Security. External auditor: Deloitte (SOC 2 readiness review scheduled June 2026).' },
    { heading: 'Evidence Collected', body: '• IAM role assignment reports exported from Azure AD — March 22, 2026\n• Privileged access review sign-off by department heads — March 15, 2026\n• MFA enforcement logs from Entra ID — full quarter\n• Service account inventory with owner attestation — 147 accounts reviewed, 3 deprovisioned\n• Firewall rule review and change log — 0 unauthorized changes detected' },
    { heading: 'Findings & Remediation', body: '• Finding 1 (Low): 4 inactive accounts not deprovisioned within SLA — remediated March 18\n• Finding 2 (Medium): 2 vendor accounts lacked time-bound access controls — remediated March 20\n• No High or Critical findings\n\nAll findings closed prior to submission. Evidence package ready for external auditor.' },
  ]}},
  'h11-3': { type: 'word', data: { title: 'Privacy Impact Assessment', sections: [
    { heading: 'System Under Review', body: 'AI Teammate platform — digital worker provisioning, task orchestration, and artifact storage. Review covers data flows between Contoso M365 tenant, Dexter Control Plane, and Azure storage endpoints.' },
    { heading: 'Personal Data Inventory', body: '• Employee names and email addresses — used for task assignment and notifications\n• Meeting transcripts — processed ephemerally; not retained beyond 30 days\n• Document metadata (author, modified date) — retained for audit trail\n• No special category data (health, biometric, financial) processed by the AI Teammate system' },
    { heading: 'Risk Assessment & Mitigations', body: '• Risk: Transcript data retained beyond policy limit — Mitigation: automated 30-day purge job deployed March 1\n• Risk: Cross-tenant data leakage via shared inference endpoint — Mitigation: tenant isolation confirmed via Azure OpenAI deployment model\n• Residual risk: Low\n\nDPO sign-off obtained March 21, 2026.' },
  ]}},
  'h11-4': { type: 'excel', data: { sheetName: 'Vendor Risk Matrix',
    headers: ['Vendor', 'Tier', 'Last Assessment', 'Status', 'Owner'],
    rows: [
      ['Microsoft Azure',              'Tier 1 — Critical', 'Jan 2026', '✓ Approved', 'James O.'],
      ['Dexter Control Plane',         'Tier 1 — Critical', 'Feb 2026', '✓ Approved', 'Marco R.'],
      ['Okta (SSO)',                   'Tier 2 — High',     'Jan 2026', '✓ Approved', 'Priya N.'],
      ['DocuSign',                     'Tier 2 — High',     'Dec 2025', '✓ Approved', 'Priya N.'],
      ['Zoom (conferencing)',           'Tier 3 — Medium',   'Mar 2026', '⏳ In Review', 'AI Teammate'],
      ['Jira (project tracking)',       'Tier 3 — Medium',   'Mar 2026', '⏳ In Review', 'AI Teammate'],
      ['Slack (messaging)',             'Tier 3 — Medium',   'Feb 2026', '✓ Approved', 'James O.'],
      ['Grammarly (writing assist)',    'Tier 4 — Low',      'Nov 2025', '✓ Approved', 'Sophie L.'],
    ],
    footnote: 'Updated March 20, 2026. Reviews due annually or upon contract renewal.',
  }},
  'h11-5': { type: 'excel', data: { sheetName: 'Training Completion',
    headers: ['Training Module', 'Completion Rate', 'Headcount', 'Due Date', 'Status'],
    rows: [
      ['Security Awareness — Q1 2026',         '94%',  '141/150', 'Mar 31, 2026', '⏳ In Progress'],
      ['Data Handling Policy v3.2',            '100%', '150/150', 'Mar 15, 2026', '✓ Complete'],
      ['GDPR & Privacy Fundamentals',          '98%',  '147/150', 'Mar 15, 2026', '✓ Complete'],
      ['Phishing Simulation — March',          '88%',  'pass rate','Mar 28, 2026', '⏳ In Progress'],
      ['Privileged Access Management',         '100%', '22/22',   'Mar 1, 2026',  '✓ Complete'],
      ['Incident Response Tabletop (planned)', '—',    '—',       'Apr 10, 2026', '⏳ Scheduled'],
    ],
    footnote: 'Source: Contoso LMS export March 22, 2026. Owned by Sophie Laurent.',
  }},
};

interface DeliverableDetailPanelProps {
  file: DeliverableFileProp;
  onClose: () => void;
}

export const DeliverableDetailPanel: React.FC<DeliverableDetailPanelProps> = ({ file, onClose }) => {
  const meta = DELIVERABLE_TYPE_META[file.type];
  const [showShare, setShowShare] = useState(false);
  const preview = DELIVERABLE_PREVIEWS[file.id];

  const renderPreview = () => {
    if (!preview) return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-neutral-400">Preview not available</p>
      </div>
    );
    if (preview.type === 'word')        return <WordPreview data={preview.data} />;
    if (preview.type === 'excel')       return <ExcelPreview data={preview.data} />;
    if (preview.type === 'powerpoint')  return <PowerPointPreview data={preview.data} />;
    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white">
      <div className="pt-10 pb-12 space-y-6 w-full">

        {/* ── Back ─────────────────────────────────────────────────────── */}
        <CopilotButton
          variant="transparent"
          size="sm"
          icon={<ArrowLeft20Regular className="w-4 h-4" />}
          onClick={onClose}
          className="!px-0 !text-[hsl(var(--text-secondary))] hover:!text-[hsl(var(--text-primary))] -mt-2"
        >
          Files
        </CopilotButton>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className={`flex items-center gap-1.5 ${meta.color}`}>
            <span className="w-4 h-4 flex items-center">{meta.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
          </div>

          <h1 className="text-[24px] font-bold text-[hsl(var(--text-primary))] leading-8 break-words">{file.name}</h1>

          <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-500">
            <span>{file.actionText}</span>
            <span className="text-neutral-300">·</span>
            <span>{file.location}</span>
            {file.owner && (
              <>
                <span className="text-neutral-300">·</span>
                <span>Owned by {file.owner}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <CopilotButton
              variant="primary"
              size="sm"
              icon={getConnectorIcon(file.app, 'w-4 h-4')}
              onClick={() => {}}
            >
              Open in {APP_LABELS[file.app] ?? file.app}
            </CopilotButton>
            <CopilotButton variant="secondary" size="sm" icon={<ArrowDownload20Regular className="w-4 h-4" />} onClick={() => {}}>
              Download
            </CopilotButton>
            <div className="relative">
              <CopilotButton variant="secondary" size="sm" icon={<Share20Regular className="w-4 h-4" />} onClick={() => setShowShare(v => !v)}>
                Share
              </CopilotButton>
              {showShare && (
                <div className="absolute top-full left-0 mt-2 w-80 z-20">
                  <SharePanel onClose={() => setShowShare(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-neutral-200" />

        {/* ── Preview ───────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Preview</p>
          <div className="bg-[hsl(var(--surface-secondary))] border border-neutral-200 rounded-2xl p-6">
            {renderPreview()}
          </div>
        </div>

      </div>
    </div>
  );
};
