import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TeamsChatArea, type TeamsChatApi } from './TeamsChatArea';
import { CopilotInput, AgentIcon } from '../../components/ui';

interface AgentIconConfig {
  id: string;
  name: string;
  agentType?: 'DW';
  systemColorIcon?: string;
  iconKey?: string;
  gradientKey?: string;
}

interface TeamsShellProps {
  workerId: string;
  workerName: string;
  workerInitials: string;
  userName?: string;
  /** Agent icon config for rendering with AgentIcon */
  agentIconProps?: AgentIconConfig;
  /** Auto-send a greeting from the user when chat connects */
  greetUser?: boolean;
  /** Local-only welcome message — shown immediately without a network call */
  welcomeMessage?: string;
}

// Base dimensions — must match the actual teams-chrome.png pixel size
const IMG_W = 1601;
const IMG_H = 1242;
const BASE_CHAT_LEFT = 428;
const BASE_CHAT_TOP = 56;
const BASE_CHAT_BOTTOM = 120;

function useScale() {
  const [scale, setScale] = useState(() => 1 / window.devicePixelRatio);
  useEffect(() => {
    const update = () => setScale(1 / window.devicePixelRatio);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return scale;
}

export function TeamsShell({ workerId, workerName, workerInitials, userName, agentIconProps, greetUser, welcomeMessage }: TeamsShellProps) {
  const scale = useScale();
  const imgW = IMG_W * scale;
  const imgH = IMG_H * scale;
  const CHAT_LEFT = BASE_CHAT_LEFT * scale;
  const CHAT_TOP = BASE_CHAT_TOP * scale;
  const CHAT_BOTTOM = BASE_CHAT_BOTTOM * scale;
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastMessage, setLastMessage] = useState<{ role: string; content: string; timestamp?: Date } | null>(
    welcomeMessage ? { role: 'assistant', content: welcomeMessage, timestamp: new Date() } : null
  );
  const chatApiRef = useRef<TeamsChatApi | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greetedRef = useRef(false);

  const handleChatReady = useCallback((api: TeamsChatApi) => {
    chatApiRef.current = api;
    setIsStreaming(prev => prev !== api.isStreaming ? api.isStreaming : prev);
    // Send a greeting to trigger the agent's welcome response — only when truly connected
    if (greetUser && api.isConnected && !api.isStreaming && !greetedRef.current) {
      greetedRef.current = true;
      setTimeout(() => {
        if (chatApiRef.current?.isConnected) {
          chatApiRef.current.sendMessage('Hello');
        }
      }, 500);
    }
  }, [greetUser]);

  const handleSend = useCallback(() => {
    const api = chatApiRef.current;
    if (!api || !input.trim() || api.isStreaming) return;
    api.sendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  }, [input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Skeleton base layer — fills entire browser */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 48, flexShrink: 0, background: '#EBEBEB', borderBottom: '1px solid #e0e0e0' }} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 62, flexShrink: 0, background: '#EBEBEB', borderRight: '1px solid #e0e0e0' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: 53, flexShrink: 0, display: 'flex' }}>
              <div style={{ width: 363, flexShrink: 0, background: '#f5f5f5', borderRight: '1px solid #e0e0e0' }} />
              <div style={{ flex: 1, background: '#ffffff', borderBottom: '1px solid #e0e0e0' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: 363, flexShrink: 0, background: '#f5f5f5', borderRight: '1px solid #e0e0e0' }} />
              <div style={{ flex: 1, background: '#ffffff' }} />
            </div>
            <div style={{ height: 52, flexShrink: 0, display: 'flex' }}>
              <div style={{ width: 363, flexShrink: 0, background: '#f5f5f5', borderRight: '1px solid #e0e0e0' }} />
              <div style={{ flex: 1, background: '#ffffff', borderTop: '1px solid #edebe9' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Image container — locked to image size, scaled for DPR */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: imgW, height: imgH, minWidth: imgW, minHeight: imgH }}>
        <img
          src="/teams-chrome.png"
          alt=""
          style={{ position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'none', width: imgW, height: imgH }}
        />
      </div>

      {/* Sidebar active chat overlay — covers "Rich Moneybags" row */}
      <div style={{
        position: 'absolute',
        top: 326 * scale,
        left: 82 * scale,
        width: 331 * scale,
        height: 59 * scale,
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${10 * scale}px`,
        gap: 8 * scale,
        fontFamily: "'Segoe UI', sans-serif",
        zIndex: 1,
      }}>
        {agentIconProps ? (
          <div style={{
            width: 36 * scale, height: 36 * scale, borderRadius: '50%',
            border: '1px solid #E0E0E0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(138deg, #FFFFFF, #F8F8FA)',
            flexShrink: 0, overflow: 'hidden',
          }}>
            <img
              src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${agentIconProps.systemColorIcon || 'agents'}.svg`}
              alt={workerName}
              style={{ width: 22 * scale, height: 22 * scale }}
            />
          </div>
        ) : (
          <div style={{
            width: 36 * scale, height: 36 * scale, borderRadius: '50%',
            background: '#6264A7', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12 * scale, fontWeight: 600, flexShrink: 0,
          }}>
            {workerInitials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#242424', lineHeight: '18px' }}>{workerName}</span>
            <span style={{ fontSize: 11, color: '#616161', fontWeight: 600, flexShrink: 0 }}>
              {lastMessage?.timestamp ? lastMessage.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: lastMessage?.role === 'assistant' ? '#242424' : '#616161',
            fontWeight: lastMessage?.role === 'assistant' ? 600 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: '16px', marginTop: -1,
          }}>
            {isStreaming ? (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 16 }}>
                <span className="animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: '#6264A7', animationDelay: '0ms', animationDuration: '600ms' }} />
                <span className="animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: '#6264A7', animationDelay: '150ms', animationDuration: '600ms' }} />
                <span className="animate-bounce" style={{ width: 4, height: 4, borderRadius: '50%', background: '#6264A7', animationDelay: '300ms', animationDuration: '600ms' }} />
              </div>
            ) : lastMessage ? (
              <>{lastMessage.role === 'user' ? 'You: ' : ''}{lastMessage.content.replace(/[#*\n]/g, ' ').replace(/\s+/g, ' ').trim()}</>
            ) : null}
          </div>
        </div>
      </div>

      {/* Live overlay — header + chat area — positioned relative to viewport */}
      <div style={{
        position: 'absolute',
        top: CHAT_TOP,
        left: CHAT_LEFT,
        right: 0,
        bottom: CHAT_BOTTOM,
        background: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
          {/* Agent header */}
          <div style={{
            height: 48, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 16px 5px',
            borderBottom: '1px solid #e0e0e0',
            fontFamily: "'Segoe UI', sans-serif",
            position: 'relative',
          }}>
            {/* Avatar */}
            {agentIconProps ? (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid #E0E0E0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(138deg, #FFFFFF, #F8F8FA)',
                flexShrink: 0, overflow: 'hidden',
              }}>
                <img
                  src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${agentIconProps.systemColorIcon || 'agents'}.svg`}
                  alt={workerName}
                  style={{ width: 22, height: 22 }}
                />
              </div>
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#6264A7', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>
                {workerInitials}
              </div>
            )}
            <span style={{ marginLeft: 10, fontSize: 18, fontWeight: 600, color: '#242424' }}>
              {workerName}
            </span>
            <span style={{ marginLeft: 20, fontSize: 14, fontWeight: 600, color: '#242424', position: 'relative', marginTop: 3 }}>
              Chat
              <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#6264A7', top: 33 }} />
            </span>
            <span style={{ marginLeft: 16, fontSize: 14, color: '#616161', marginTop: 3 }}>Shared</span>
            <span style={{ marginLeft: 16, fontSize: 14, color: '#616161', marginTop: 3 }}>Storyline</span>
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TeamsChatArea workerId={workerId} workerName={workerName} userName={userName} agentIconProps={agentIconProps} welcomeMessage={welcomeMessage} onReady={handleChatReady} onLastMessage={setLastMessage} dwConversationalDemo />
          </div>
        </div>

      {/* Live compose area — positioned relative to viewport */}
      <div style={{
        position: 'absolute',
        left: CHAT_LEFT,
        right: 0,
        bottom: 0,
        height: CHAT_BOTTOM,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '0 clamp(24px, 12%, 172px)',
        paddingBottom: 36,
      }}>
        {/* Typing indicator — agent avatar + animated dots */}
        {isStreaming && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            paddingLeft: 4,
          }}>
            {agentIconProps ? (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '1px solid #E0E0E0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(138deg, #FFFFFF, #F8F8FA)',
                flexShrink: 0, overflow: 'hidden',
              }}>
                <img
                  src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${agentIconProps.systemColorIcon || 'agents'}.svg`}
                  alt={workerName}
                  style={{ width: 14, height: 14 }}
                />
              </div>
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#6264A7', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, flexShrink: 0,
              }}>
                {workerInitials}
              </div>
            )}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span className="animate-bounce" style={{ width: 5, height: 5, borderRadius: '50%', background: '#6264A7', animationDelay: '0ms', animationDuration: '600ms' }} />
              <span className="animate-bounce" style={{ width: 5, height: 5, borderRadius: '50%', background: '#6264A7', animationDelay: '150ms', animationDuration: '600ms' }} />
              <span className="animate-bounce" style={{ width: 5, height: 5, borderRadius: '50%', background: '#6264A7', animationDelay: '300ms', animationDuration: '600ms' }} />
            </div>
          </div>
        )}

        <CopilotInput
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message"
          size="lg"
          className="w-full [&_input]:!pl-5"
        />
      </div>
    </div>
  );
}
