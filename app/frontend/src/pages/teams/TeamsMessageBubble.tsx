import React from 'react';
import type { DwChatMessage } from '../../domains/dw/hooks/useDwConversationalChat';
import { TEAMS_COLORS, TEAMS_FONTS } from './teamsLayoutConfig';
import { DwInstructionsCard } from '../../components/ui/DwInstructionsCard';
import { DwSkillCard } from '../../components/ui/DwSkillCard';
import { DwTaskCard } from '../../components/ui/DwTaskCard';
import { DwTaskListCard } from '../../components/ui/DwTaskListCard';

/** Render inline markdown: **bold**, *italic*, and `code` */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: '#e8e8e8', borderRadius: 3, padding: '1px 4px', fontSize: '0.9em' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/** Render markdown line by line — handles headings, lists, hrs, and text */
function renderMarkdown(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let prevWasEmpty = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (!trimmed) {
      prevWasEmpty = true;
      i++;
      continue;
    }

    const gap = prevWasEmpty && elements.length > 0 ? 16 : 0;
    prevWasEmpty = false;

    // Horizontal rule
    if (trimmed === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px 0' }} />);
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(<div key={i} style={{ fontWeight: 600, marginTop: gap || 6 }}>{renderInline(trimmed.slice(4))}</div>);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontWeight: 600, fontSize: '1.05em', marginTop: gap || 6 }}>{renderInline(trimmed.slice(3))}</div>);
      i++;
      continue;
    }

    // List item (- or • or *)
    if (/^\s*[-•*]\s/.test(trimmed)) {
      // Collect consecutive list items
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\s*[-•*]\s*/, ''));
        i++;
      }
      elements.push(
        <ul key={`list-${i}`} style={{ margin: `${gap || 4}px 0 4px`, paddingLeft: 20, listStyleType: 'disc' }}>
          {items.map((item, li) => <li key={li} style={{ marginBottom: 2 }}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Regular text
    elements.push(<div key={i} style={{ marginTop: gap }}>{renderInline(trimmed)}</div>);
    i++;
  }

  return elements;
}

interface TeamsMessageBubbleProps {
  message: DwChatMessage;
  senderName: string;
  isBot: boolean;
  showHeader: boolean;
  agentIconProps?: { id: string; name: string; agentType?: 'DW'; systemColorIcon?: string; iconKey?: string; gradientKey?: string };
}

function Avatar({ name, isBot }: { name: string; isBot: boolean }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isBot ? TEAMS_COLORS.purple : '#0078D4',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: TEAMS_FONTS.sizeSm, fontWeight: 600,
        fontFamily: TEAMS_FONTS.family, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function TeamsMessageBubble({ message, senderName, isBot, showHeader, agentIconProps }: TeamsMessageBubbleProps) {
  // Human messages: right-aligned bubble
  if (!isBot) {
    return (
      <div
        style={{
          padding: '2px clamp(24px, 12%, 172px)',
          marginTop: showHeader ? 16 : 4,
          fontFamily: TEAMS_FONTS.family,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {showHeader && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: TEAMS_FONTS.sizeXs, color: TEAMS_COLORS.textSecondary }}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: TEAMS_FONTS.sizeMd,
            color: TEAMS_COLORS.textPrimary,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: TEAMS_COLORS.userBubbleBg,
            borderRadius: 6,
            padding: '8px 14px',
            maxWidth: '70%',
          }}
        >
          {renderMarkdown(message.content)}
        </div>
      </div>
    );
  }

  // Bot messages: icon on left, name+time on top, bubble to the right
  const iconElement = agentIconProps ? (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '1px solid #E0E0E0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(138deg, #FFFFFF, #F8F8FA)',
      flexShrink: 0, overflow: 'hidden',
    }}>
      <img
        src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${agentIconProps.systemColorIcon || 'agents'}.svg`}
        alt={senderName}
        style={{ width: 24, height: 24 }}
      />
    </div>
  ) : (
    <Avatar name={senderName} isBot={isBot} />
  );

  return (
    <div
      style={{
        padding: '2px clamp(24px, 12%, 172px)',
        marginTop: showHeader ? 16 : 4,
        fontFamily: TEAMS_FONTS.family,
      }}
    >
      {/* Name + time on top */}
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, marginLeft: 40 }}>
          <span style={{ fontWeight: 600, fontSize: TEAMS_FONTS.sizeXs, color: TEAMS_COLORS.textSecondary }}>
            {senderName}
          </span>
          <span style={{ fontSize: TEAMS_FONTS.sizeXs, color: TEAMS_COLORS.textSecondary }}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      )}

      {/* Icon + bubble side by side */}
      <div style={{ display: 'flex', gap: 8 }}>
        {showHeader ? iconElement : <div style={{ width: 36, flexShrink: 0 }} />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: TEAMS_FONTS.sizeMd,
              color: TEAMS_COLORS.textPrimary,
              lineHeight: 1.5,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              background: '#f5f5f5',
              borderRadius: 6,
              padding: '8px 14px',
              maxWidth: '70%',
              display: 'inline-block',
            }}
          >
            {renderMarkdown(message.content)}
          </div>

          {/* DW conversational cards */}
          {message.metadata?.type === 'dw-instructions' && message.metadata.payload && (
            <div style={{ marginTop: 8 }}>
              <DwInstructionsCard
                role={message.metadata.payload.role}
                responsibilities={message.metadata.payload.responsibilities}
                goal={message.metadata.payload.goal}
                title={message.metadata.payload.title}
              />
            </div>
          )}
          {message.metadata?.type === 'dw-skill' && message.metadata.payload && (
            <div style={{ marginTop: 8 }}>
              <DwSkillCard
                name={message.metadata.payload.name}
                description={message.metadata.payload.description}
                capabilities={message.metadata.payload.capabilities}
                optimizedFor={message.metadata.payload.optimizedFor}
              />
            </div>
          )}
          {message.metadata?.type === 'dw-task' && message.metadata.payload && (
            <div style={{ marginTop: 8 }}>
              <DwTaskCard
                name={message.metadata.payload.name}
                description={message.metadata.payload.description}
                bullets={message.metadata.payload.bullets}
                recurrence={message.metadata.payload.recurrence}
                timeSaved={message.metadata.payload.timeSaved}
              />
            </div>
          )}
          {message.metadata?.type === 'dw-task-list' && message.metadata.payload && (
            <div style={{ marginTop: 8 }}>
              <DwTaskListCard tasks={message.metadata.payload.tasks} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
