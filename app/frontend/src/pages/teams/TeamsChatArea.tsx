import React, { useRef, useEffect, useCallback } from 'react';
import { DEXTER_CONFIG } from '../../config/dexterConfig';
import { useDexterRouterToken } from '../../auth/useDexterRouterToken';
import { useDwConversationalChat, DwChatMessage } from '../../domains/dw/hooks/useDwConversationalChat';
import { DwInstructionsAction, DwSkillAction, DwTaskAction, DwTaskListAction } from '../../domains/dw/utils/dwActionParser';
import { TeamsMessageBubble } from './TeamsMessageBubble';
import { TEAMS_FONTS, TEAMS_COLORS } from './teamsLayoutConfig';
import { useAgent } from '../../context/AgentContext';
import { useDW } from '../../domains/dw/context/DWContext';
import { wrapWithGlobalInstructions } from '../../domains/dw/utils/dwGlobalInstructions';
import { updateDexterWorker } from '../../domains/dw/services/dexterWorkerService';

interface TeamsChatAreaProps {
  workerId: string;
  workerName: string;
  userName?: string;
  /** Agent icon config for bot avatar */
  agentIconProps?: { id: string; name: string; agentType?: 'DW'; systemColorIcon?: string; iconKey?: string; gradientKey?: string };
  /** Local-only welcome message shown before any network calls */
  welcomeMessage?: string;
  /** Called to expose sendMessage + state to parent */
  onReady?: (api: TeamsChatApi) => void;
  /** Called when messages change with the last visible message */
  onLastMessage?: (msg: { role: string; content: string; timestamp?: Date } | null) => void;
  /** Enable DW conversational demo cards */
  dwConversationalDemo?: boolean;
  /** Side-effect callbacks for DW actions */
  onInstructionsUpdate?: (action: DwInstructionsAction) => void;
  onSkillCreated?: (action: DwSkillAction) => void;
  onTaskCreated?: (action: DwTaskAction) => void;
  onTaskListRequested?: (action: DwTaskListAction) => void;
}

export interface TeamsChatApi {
  sendMessage: (text: string) => void;
  isConnected: boolean;
  isStreaming: boolean;
}

// Cross-tab sync — notify other tabs when DW state changes from chat
const dwSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dw-state-sync') : null;

export function TeamsChatArea({ workerId, workerName, userName = 'You', agentIconProps, welcomeMessage, onReady, onLastMessage, dwConversationalDemo, onInstructionsUpdate, onSkillCreated, onTaskCreated, onTaskListRequested }: TeamsChatAreaProps) {
  const { agentConfig, updateAgentConfig, addSkill } = useAgent();
  const { addDwTask, getDexterAuthFetch, isDwConversationalDemo } = useDW();
  const getRouterToken = useDexterRouterToken();

  // Side-effect: update instructions locally + sync to Dexter
  const handleInstructionsUpdate = useCallback((action: DwInstructionsAction) => {
    if (action.fullInstructions) {
      updateAgentConfig({ instructions: action.fullInstructions });
      // Sync to Dexter
      const authFetch = getDexterAuthFetch();
      if (authFetch && agentConfig.dexterWorkerId) {
        const wrapped = wrapWithGlobalInstructions(action.fullInstructions, agentConfig.name, agentConfig.role, true);
        updateDexterWorker(authFetch, agentConfig.dexterWorkerId, { instructions: wrapped }).catch(err =>
          console.warn('[DW] Instruction sync from chat failed:', err)
        );
      }
    }
    dwSyncChannel?.postMessage({ type: 'instructions-updated', agentId: agentConfig.id });
    onInstructionsUpdate?.(action);
  }, [agentConfig.dexterWorkerId, agentConfig.name, agentConfig.role, agentConfig.id, getDexterAuthFetch, updateAgentConfig, onInstructionsUpdate]);

  // Side-effect: create skill locally + sync to Dexter
  const handleSkillCreated = useCallback((action: DwSkillAction) => {
    addSkill({
      name: action.name,
      description: action.description,
      body: action.capabilities.map(c => `- ${c}`).join('\n'),
      agentId: agentConfig.id,
    });
    dwSyncChannel?.postMessage({ type: 'skill-created', agentId: agentConfig.id });
    onSkillCreated?.(action);
  }, [addSkill, agentConfig.id, onSkillCreated]);

  // Side-effect: create task locally
  const handleTaskCreated = useCallback((action: DwTaskAction) => {
    addDwTask(agentConfig.id, {
      id: crypto.randomUUID(),
      name: action.name,
      subtitle: action.description,
      status: action.recurrence ? 'upcoming' : 'incomplete',
      lastUpdated: 'Just now',
    });
    dwSyncChannel?.postMessage({ type: 'task-created', agentId: agentConfig.id });
    onTaskCreated?.(action);
  }, [addDwTask, agentConfig.id, onTaskCreated]);

  const { messages, sendMessage, isConnected, isStreaming, activeToolName, error } = useDwConversationalChat({
    routerUrl: DEXTER_CONFIG.routerUrl,
    workerId,
    getAccessToken: getRouterToken,
    enabled: !!dwConversationalDemo,
    onInstructionsUpdate: handleInstructionsUpdate,
    onSkillCreated: handleSkillCreated,
    onTaskCreated: handleTaskCreated,
    onTaskListRequested,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Report last visible message to parent — fall back to welcome message when no network messages yet
  const onLastMessageRef = useRef(onLastMessage);
  onLastMessageRef.current = onLastMessage;
  useEffect(() => {
    const visible = messages.filter((msg, i) => !(isStreaming && msg.role === 'assistant' && i === messages.length - 1));
    const last = visible.length > 0 ? visible[visible.length - 1] : null;
    if (last) {
      onLastMessageRef.current?.({ role: last.role, content: last.content, timestamp: last.timestamp });
    } else if (welcomeMessage) {
      onLastMessageRef.current?.({ role: 'assistant', content: welcomeMessage, timestamp: new Date() });
    } else {
      onLastMessageRef.current?.(null);
    }
  }, [messages, isStreaming, welcomeMessage]);

  // Expose API to parent shell
  const apiRef = useRef<TeamsChatApi>({ sendMessage, isConnected, isStreaming });
  apiRef.current = { sendMessage, isConnected, isStreaming };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    onReadyRef.current?.(apiRef.current);
  }, [isConnected, isStreaming]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: TEAMS_FONTS.family }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#fff',
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        {error && (
          <div style={{ margin: '8px 16px', padding: '8px 12px', background: '#FDF2F2', border: '1px solid #F3D6D8', borderRadius: 4, fontSize: TEAMS_FONTS.sizeSm, color: '#c4314b' }}>
            {error}
          </div>
        )}

        {/* Local-only welcome bubble — no network call */}
        {welcomeMessage && (
          <TeamsMessageBubble
            key="welcome"
            message={{ id: 'welcome', role: 'assistant' as const, content: welcomeMessage, timestamp: new Date() }}
            senderName={workerName}
            isBot
            showHeader
            agentIconProps={agentIconProps}
          />
        )}

        {/* Hide the last assistant message while streaming — show it all at once when done */}
        {messages
          .filter((msg, i) => !(isStreaming && msg.role === 'assistant' && i === messages.length - 1))
          .map((msg, i, filtered) => {
            const isBot = msg.role === 'assistant';
            const prevMsg = filtered[i - 1];
            const showHeader = !prevMsg || prevMsg.role !== msg.role;

            return (
              <TeamsMessageBubble
                key={msg.id}
                message={msg}
                senderName={isBot ? workerName : userName}
                isBot={isBot}
                showHeader={showHeader}
                agentIconProps={isBot ? agentIconProps : undefined}
              />
            );
          })}


        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
