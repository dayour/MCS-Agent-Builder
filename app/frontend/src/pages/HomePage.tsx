import React, { useEffect, useRef, useCallback } from 'react';
import { useDW } from '../domains/dw/context/DWContext';
import { UnifiedChatPane, type UnifiedChatPaneHandle } from '../components/chat/UnifiedChatPane';
import { usePipelineActivity } from '../context/PipelineActivityContext';
import { useSpecSessionContext } from '../context/SpecSessionContext';
import { SpecCanvasDocument } from '../components/spec/SpecCanvasDocument';
import type { ChatStreamEvent } from '../utils/chatStream';

/**
 * HomePage — unified canvas. Chat (left) + working-spec document (right).
 *
 * Both panes are always present. The spec doc renders as an empty template
 * when no project exists; sections fill in as the brain (chat patches and
 * deep research) does its work. This is the single source of truth for the
 * "what am I building" view.
 *
 * The chat is mounted once and kept stable across patches and project
 * adoption — its SSE stream and history must survive the spec on the
 * right turning from skeleton to filled.
 */

const CREATE_TYPE_PROMPTS: Record<string, string> = {
  agent: 'I want to build an agent that…',
  workflow: 'I want to build a workflow that…',
  hr: 'Build me an HR onboarding agent for new hires.',
  sales: 'Build me a sales-prep agent that briefs reps for upcoming customer meetings.',
  it: 'Build me an IT helpdesk agent that creates ServiceNow tickets.',
};

export const HomePage: React.FC = () => {
  const { openDwCreateDialog } = useDW();
  const { trackJob } = usePipelineActivity();
  const session = useSpecSessionContext();
  const chatRef = useRef<UnifiedChatPaneHandle | null>(null);

  // Auto-seed from sessionStorage — preserves the My Projects "Create new"
  // entry point. `teammate` opens the Digital Worker dialog (same path the
  // legacy wrappedHandleCardClick took); anything else seeds a chat prompt.
  const autoSeedHandled = useRef(false);
  useEffect(() => {
    if (autoSeedHandled.current) return;
    const createType = sessionStorage.getItem('pendingCreateType');
    if (!createType) return;
    autoSeedHandled.current = true;
    sessionStorage.removeItem('pendingCreateType');

    if (createType === 'teammate') {
      openDwCreateDialog();
      return;
    }

    const prompt = CREATE_TYPE_PROMPTS[createType] || `Help me build a ${createType}.`;
    setTimeout(() => {
      chatRef.current?.setInputValue(prompt);
      chatRef.current?.focusInput();
    }, 0);
  }, [openDwCreateDialog]);

  // Adopt server-issued jobs into PipelineActivityContext so the activity
  // bar AND the inline JobProgressCard pick up live SSE progress, AND so
  // the canvas's "Writing…" pills can read step-level state.
  const handleJobStarted = useCallback((evt: ChatStreamEvent) => {
    const jobId = evt.jobId ? String(evt.jobId) : null;
    if (!jobId) return;
    const kind = String(evt.kind || 'research');
    trackJob(jobId, {
      skillType: kind,
      projectId: String(evt.projectId || ''),
      agentId: String(evt.agentId || 'default'),
    });
  }, [trackJob]);

  // Spec patches — adopt new projects mid-turn (when the brain lazy-creates
  // one via agent.name) and refetch session so the canvas pulses.
  const handleSpecPatch = useCallback((evt: { projectId: string }) => {
    if (evt.projectId && evt.projectId !== session.projectId) {
      session.setProjectId(evt.projectId);
      return;
    }
    session.reloadSession().catch((err) => {
      // Surface for diagnosis; the canvas will catch up on the next user
      // interaction (which triggers another reload), so this is non-blocking.
      console.warn('[HomePage] spec session reload failed after patch:', err);
    });
  }, [session]);

  const handleProjectCreated = useCallback((projectId: string) => {
    session.setProjectId(projectId);
  }, [session]);

  return (
    <div
      className="h-full grid overflow-hidden"
      style={{ gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1fr)' }}
      data-testid="home-canvas"
    >
      {/* Chat (left) */}
      <div className="min-w-0 h-full flex flex-col overflow-hidden border-r border-[hsl(var(--border-subtle))]">
        <UnifiedChatPane
          ref={chatRef}
          mode="home"
          welcomeText="Start by describing your agent… or upload files to extract a spec."
          projectId={session.projectId || undefined}
          onJobStarted={handleJobStarted}
          onSpecPatch={handleSpecPatch}
          onProjectCreated={handleProjectCreated}
        />
      </div>

      {/* Spec canvas (right) */}
      <div className="min-w-0 h-full overflow-hidden">
        <SpecCanvasDocument />
      </div>
    </div>
  );
};
