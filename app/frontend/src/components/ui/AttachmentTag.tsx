import React from 'react';
import {
  Dismiss20Regular,
  DocumentPdf20Regular,
  DocumentText20Regular,
  Table20Regular,
  SlideText20Regular,
  Image20Regular,
  CodeBlock20Regular,
  Attach20Regular,
} from '@fluentui/react-icons';

/**
 * AttachmentTag — file attachment pill shown inside the chat input.
 *
 * Matches the "Interaction tag" component in Figma (node 533-8054):
 *   h-8, rounded-xl, #F5F5F5 background, #E0E0E0 border.
 *   Left: file-type icon (20px) + truncated filename.
 *   Right: dismiss button separated by a vertical divider.
 */

const iconClass = 'w-5 h-5 text-[hsl(var(--text-secondary))] flex-shrink-0';

const getFileTypeIcon = (file: File): React.ReactNode => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <DocumentPdf20Regular className={iconClass} />;
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return <DocumentText20Regular className={iconClass} />;
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return <Table20Regular className={iconClass} />;
  if (['ppt', 'pptx'].includes(ext)) return <SlideText20Regular className={iconClass} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <Image20Regular className={iconClass} />;
  if (['json', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'html', 'css'].includes(ext)) return <CodeBlock20Regular className={iconClass} />;
  return <Attach20Regular className={iconClass} />;
};

export interface AttachmentTagProps {
  file: File;
  onRemove?: () => void;
}

export const AttachmentTag: React.FC<AttachmentTagProps> = ({ file, onRemove }) => (
  <div className="inline-flex items-center h-8 bg-[hsl(var(--surface-tertiary))] border border-[hsl(var(--stroke-default))] overflow-hidden select-none" style={{ borderRadius: '12px' }}>
    {/* Primary section: icon + filename */}
    <div className={`flex items-center gap-1 px-2 h-full ${onRemove ? 'border-r border-[hsl(var(--stroke-default))]' : ''}`}>
      {getFileTypeIcon(file)}
      <span className="text-sm text-[hsl(var(--text-secondary))] max-w-[120px] truncate leading-none">
        {file.name}
      </span>
    </div>

    {/* Dismiss section — only rendered when a remove handler is provided */}
    {onRemove && (
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-8 h-8 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--stroke-default))] transition-colors flex-shrink-0"
        aria-label={`Remove attachment ${file.name}`}
        type="button"
      >
        <Dismiss20Regular className="w-5 h-5" />
      </button>
    )}
  </div>
);
