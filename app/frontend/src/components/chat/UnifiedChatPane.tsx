import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { CheckmarkCircle16Regular, ErrorCircle16Regular } from '@fluentui/react-icons';
import { CopilotChatInput, CopilotMessage, CopilotTypingIndicator } from '../ui';
import { ToolCallCard } from './ToolCallCard';
import { SuggestionsCard, type SuggestionOption } from './SuggestionsCard';
import { JobProgressCard } from './JobProgressCard';
import { streamChat, type ChatStreamEvent } from '../../utils/chatStream';
import { ensureProject, uploadOne, type UploadedAttachment } from '../../utils/chatUploads';

/**
 * UnifiedChatPane — single chat surface for the unified experience.
 *
 * Replaces the legacy interview flow (HomeLandingView, HomeConversationView,
 * SpecChatPane, ProjectModePage) and the three legacy chat endpoints
 * (/api/project-chat/turn, /api/wizard/chat, /api/copilot/chat for chat-
 * driven turns) with one component talking to POST /api/chat.
 *
 * Architecture:
 *   - State: messages (text + inline action cards), isStreaming, sessionId
 *   - Transport: utils/chatStream.streamChat — fetch streaming SSE against
 *     POST /api/chat (native EventSource doesn't support POST).
 *   - Action cards: render inline via ToolCallCard. User click POSTs the
 *     toolCallId back through a follow-up turn.
 *   - Spec patches: arrive as artifact_updated events; parent component
 *     decides what to do with them (Home: refresh side panel; /spec: highlight section).
 */

export interface SpecArtifactEvent {
  changeId: string;
  projectId: string;
  agentId: string;
  summary?: string;
  affectedPaths?: string[];
  version?: string;
}

export interface UnifiedChatPaneHandle {
  /** Imperatively set the input textarea contents (e.g. from a side-panel prompt click). */
  setInputValue: (value: string) => void;
  /** Imperatively focus the input. */
  focusInput: () => void;
}

export interface UnifiedChatPaneProps {
  mode: 'home' | 'spec' | 'build' | 'evaluate';
  projectId?: string;
  agentId?: string;
  /** Initial messages to seed the conversation (e.g. resumed session). */
  initialMessages?: ChatMessage[];
  /** Fired whenever the server commits a spec patch. */
  onSpecPatch?: (e: SpecArtifactEvent) => void;
  /** Fired when a long-running job is started (deep research / build). */
  onJobStarted?: (e: ChatStreamEvent) => void;
  /** Fired when the chat creates a new project on the user's behalf. */
  onProjectCreated?: (projectId: string) => void;
  /** Customize the welcome line shown when no messages exist. */
  welcomeText?: string;
  className?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
  pendingActions?: PendingActionCard[];
  pendingJobs?: PendingJobCard[];
}

interface PendingActionCard {
  toolCallId: string;
  action: string;
  title: string;
  body: string;
  confirmLabel?: string;
  declineLabel?: string;
  expiresAt?: number;
  /** When action === 'suggest_options', the chip choices. */
  options?: SuggestionOption[];
  status: 'pending' | 'confirmed' | 'declined';
}

interface PendingJobCard {
  jobId: string;
  kind: string;
  scope?: string;
  projectId?: string;
}

/** Per-file upload status. Eager-uploaded as soon as the user picks files. */
interface FileUploadStatus {
  fileKey: string;
  fileName: string;
  status: 'uploading' | 'done' | 'error';
  /** Server-assigned filename (post-conversion) when status === 'done'. */
  serverName?: string;
  kind?: string;
  errorMessage?: string;
}

/** Stable per-file key. File objects don't have intrinsic identity; this gives us one. */
function fileKeyFor(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

const SESSION_ID_KEY = 'unifiedChat:sessionId';

function generateMessageId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateSessionId(): string {
  try {
    let v = localStorage.getItem(SESSION_ID_KEY);
    if (!v) {
      v = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SESSION_ID_KEY, v);
    }
    return v;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

/**
 * Strip newlines, escape backticks, clamp length. Used on raw server-side
 * error strings before we inject them into an assistant message bubble that
 * gets rendered through the markdown pipeline. Without this, an error
 * containing `]` or `<script>` could break out of the inline-code wrapper
 * we render it in.
 */
function sanitizeForChat(input: unknown): string {
  return String(input ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/`/g, 'ˋ') // tiny backtick visual swap that can't close the code span
    .slice(0, 240);
}

/** Render the user's typed message + a compact attachment summary line. */
function buildUserMessageWithAttachments(
  message: string,
  attachments: Array<{ name: string; kind?: string }>,
  failures: UploadedAttachment[]
): string {
  const parts: string[] = [];
  if (message) parts.push(message);
  if (attachments.length > 0) {
    parts.push(`\n\n_Attached: ${attachments.map(a => a.name).join(', ')}_`);
  }
  if (failures.length > 0) {
    const reasons = failures
      .map(f => f.conversionError || 'failed')
      .map((r, i) => `(${i + 1}) ${r}`)
      .join(' ');
    parts.push(`\n\n_${failures.length} upload${failures.length === 1 ? '' : 's'} failed: ${reasons}_`);
  }
  return parts.join('');
}

export const UnifiedChatPane = forwardRef<UnifiedChatPaneHandle, UnifiedChatPaneProps>(({
  mode,
  projectId: projectIdProp,
  agentId,
  initialMessages,
  onSpecPatch,
  onJobStarted,
  onProjectCreated,
  welcomeText,
  className = '',
}, ref) => {
  // Project ID resolution priority:
  //   1. URL query param (?project=xxx) — survives refresh
  //   2. Prop from parent
  //   3. Local state (set when chat creates a project mid-session)
  const initialProjectId = projectIdProp || readProjectIdFromUrl();
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHydrating, setIsHydrating] = useState<boolean>(!!initialProjectId);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Map<string, FileUploadStatus>>(new Map());
  // Mirror to a ref so async sendTurn can read up-to-date status without
  // depending on the closure's snapshot of state.
  const uploadStatusRef = useRef(uploadStatus);
  useEffect(() => { uploadStatusRef.current = uploadStatus; }, [uploadStatus]);
  // In-flight upload promises so sendTurn can await them without polling.
  const uploadPromisesRef = useRef<Map<string, Promise<UploadedAttachment | null>>>(new Map());

  useEffect(() => {
    if (projectIdProp) setProjectId(projectIdProp);
  }, [projectIdProp]);

  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const cancelRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputElementRef = useRef<HTMLTextAreaElement | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    setInputValue: (value: string) => setInputValue(value),
    focusInput: () => {
      try {
        inputElementRef.current?.focus?.();
      } catch { /* noop */ }
    },
  }), []);

  // Streaming guard via ref — `isStreaming` STATE updates async so two
  // fast-fire send clicks both saw `isStreaming=false` and double-fired.
  // The ref flips synchronously inside sendTurn, blocking the second call.
  const isStreamingRef = useRef(false);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Track which projectId we've fully hydrated. The persist-PUT effect
  // guards on this so a project switch can't write the OLD project's
  // messages to the NEW project's session.json before hydration finishes.
  const lastHydratedProjectIdRef = useRef<string | undefined>(undefined);

  // Set when the chat itself just adopted a brand-new projectId via the
  // lazy-create path (artifact_updated event with a previously-unseen id).
  // The hydration effect uses this to preserve the in-memory exchange that
  // led to the project being created. URL/prop-supplied projectIds do NOT
  // set this flag, so an externally-deep-linked project still wipes any
  // stale local state before fetching its real session.
  const ownProjectAdoptionRef = useRef<string | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Cancel in-flight stream on unmount
  useEffect(() => () => { cancelRef.current?.(); }, []);

  // Hydrate session from server when projectId changes (or on mount with URL param).
  // Sync URL hash so reload keeps the same project.
  useEffect(() => {
    if (!projectId) {
      setIsHydrating(false);
      lastHydratedProjectIdRef.current = undefined;
      return;
    }
    let cancelled = false;
    setIsHydrating(true);
    // Clear messages SYNCHRONOUSLY before fetching — prevents the persist
    // effect from racing with the new project and writing stale state.
    //
    // Preserve the in-memory exchange ONLY when the chat itself just
    // lazy-created this project (ownProjectAdoptionRef set in the
    // artifact_updated handler). All other paths — initial deep-link,
    // user manually switching projects — wipe before fetching so we
    // never mix one conversation's tail into another project's session.
    const isOwnAdoption = ownProjectAdoptionRef.current === projectId;
    if (lastHydratedProjectIdRef.current !== projectId && !isOwnAdoption) {
      setMessages([]);
    }
    // Consume the flag — single-use, so a later URL navigation doesn't
    // accidentally inherit "this is mine" status.
    if (isOwnAdoption) ownProjectAdoptionRef.current = null;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/session`);
        if (cancelled) return;
        if (res.status === 404) {
          // Project gone — clear URL + state, start fresh
          writeProjectIdToUrl(null);
          setProjectId(undefined);
          setMessages([]);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id || generateMessageId(),
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : '',
            ts: m.ts || m.timestamp,
          })));
        }
        lastHydratedProjectIdRef.current = projectId;
      } catch (err) {
        if (!cancelled) console.warn('[UnifiedChatPane] hydration failed', err);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    writeProjectIdToUrl(projectId);
    return () => { cancelled = true; };
  }, [projectId]);

  // Persist messages back to the server after each settled turn.
  // Gated on (a) projectId matches the last fully-hydrated id, (b) we're
  // not currently streaming or hydrating. Without (a), a project switch
  // window where state still holds the old project's messages would PUT
  // them to the new project's session.json. Without (b), partial assistant
  // content gets persisted mid-stream.
  useEffect(() => {
    if (!projectId || isStreaming || isHydrating) return;
    if (lastHydratedProjectIdRef.current !== projectId) return;
    if (messages.length === 0) return;
    const persistable = messages
      .filter(m => !!m.content)
      .map(m => ({ id: m.id, role: m.role, content: m.content, ts: m.ts }));
    fetch(`/api/projects/${encodeURIComponent(projectId)}/session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: persistable }),
    }).catch((err) => {
      console.warn('[UnifiedChatPane] session persist failed', err);
    });
  }, [projectId, messages, isStreaming, isHydrating]);

  // ── Eager file uploads ────────────────────────────────────────────────────
  // Picking a file kicks off the upload immediately so the user sees real
  // progress. By the time they click Send the file is already on disk.

  const setFileStatus = useCallback((key: string, next: FileUploadStatus) => {
    setUploadStatus(prev => {
      const m = new Map(prev);
      m.set(key, next);
      return m;
    });
  }, []);

  const uploadOneEager = useCallback(async (file: File, pid: string): Promise<UploadedAttachment | null> => {
    const key = fileKeyFor(file);
    setFileStatus(key, { fileKey: key, fileName: file.name, status: 'uploading' });
    try {
      const result = await uploadOne(pid, file);
      if (!result.name) {
        setFileStatus(key, {
          fileKey: key,
          fileName: file.name,
          status: 'error',
          errorMessage: result.conversionError || 'upload returned no filename',
        });
        return null;
      }
      setFileStatus(key, {
        fileKey: key,
        fileName: file.name,
        status: 'done',
        serverName: result.name,
        kind: result.kind,
      });
      return result;
    } catch (err) {
      setFileStatus(key, {
        fileKey: key,
        fileName: file.name,
        status: 'error',
        errorMessage: (err as Error).message || 'upload failed',
      });
      return null;
    }
  }, [setFileStatus]);

  const handleFilesAdded = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadedFiles(prev => [...prev, ...files]);

    // Resolve project once (lazy-create if user has no project yet).
    let pid = projectId;
    if (!pid) {
      try {
        const ensured = await ensureProject({
          existingProjectId: undefined,
          // Seed name from the first file so the auto-derived slug isn't a
          // bare timestamp. Brain can rename via spec_patch agent.name.
          seedMessage: files[0]?.name?.replace(/\.[^.]+$/, '') || '',
        });
        pid = ensured.projectId;
        setProjectId(pid);
        if (ensured.created) onProjectCreated?.(pid);
      } catch (err) {
        for (const f of files) {
          const key = fileKeyFor(f);
          setFileStatus(key, {
            fileKey: key,
            fileName: f.name,
            status: 'error',
            errorMessage: (err as Error).message || 'project create failed',
          });
        }
        return;
      }
    }

    // Kick off uploads in parallel and store the promises so sendTurn can
    // await any still-in-flight when the user hits send.
    for (const f of files) {
      const key = fileKeyFor(f);
      if (uploadPromisesRef.current.has(key)) continue;
      const p = uploadOneEager(f, pid);
      uploadPromisesRef.current.set(key, p);
    }
  }, [projectId, onProjectCreated, setFileStatus, uploadOneEager]);

  const handleRemoveFile = useCallback((idx: number) => {
    setUploadedFiles(prev => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      if (removed) {
        const key = fileKeyFor(removed);
        setUploadStatus(s => {
          const m = new Map(s);
          m.delete(key);
          return m;
        });
        uploadPromisesRef.current.delete(key);
      }
      return next;
    });
  }, []);

  const appendUserMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: generateMessageId(), role: 'user', content, ts: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const appendAssistantPlaceholder = useCallback(() => {
    const msg: ChatMessage = { id: generateMessageId(), role: 'assistant', content: '', ts: new Date().toISOString() };
    currentAssistantIdRef.current = msg.id;
    setMessages(prev => [...prev, msg]);
    return msg.id;
  }, []);

  const updateAssistantMessage = useCallback((id: string, mutator: (m: ChatMessage) => ChatMessage) => {
    setMessages(prev => prev.map(m => m.id === id ? mutator(m) : m));
  }, []);

  const handleStreamEvent = useCallback((evt: ChatStreamEvent) => {
    const assistantId = currentAssistantIdRef.current;
    if (!assistantId) return;

    switch (evt.type) {
      case 'message_delta': {
        const text = String(evt.text || '');
        if (!text) return;
        updateAssistantMessage(assistantId, m => ({ ...m, content: m.content + text }));
        break;
      }
      case 'action_requested': {
        // Normalize options for suggest_options cards.
        const rawOptions = Array.isArray(evt.options) ? evt.options : null;
        const options: SuggestionOption[] | undefined = rawOptions?.map((o: any) => ({
          label: String(o?.label ?? '').slice(0, 60),
          value: String(o?.value ?? o?.label ?? '').slice(0, 200),
          hint: typeof o?.hint === 'string' ? o.hint.slice(0, 120) : undefined,
        })).filter((o: SuggestionOption) => o.label && o.value);

        const card: PendingActionCard = {
          toolCallId: String(evt.toolCallId),
          action: String(evt.action),
          title: String(evt.title || 'Confirm'),
          body: String(evt.body || ''),
          confirmLabel: evt.confirmLabel,
          declineLabel: evt.declineLabel,
          expiresAt: evt.expiresAt,
          options,
          status: 'pending',
        };
        updateAssistantMessage(assistantId, m => ({
          ...m,
          pendingActions: [...(m.pendingActions || []), card],
        }));
        break;
      }
      case 'artifact_updated': {
        if (evt.kind === 'spec') {
          // Detect chat-issued lazy project creation: the event carries a
          // projectId that doesn't match our current state. Mark it as ours
          // so the hydration effect (when the parent updates projectIdProp)
          // preserves the in-memory turns that led here.
          const incoming = evt.projectId ? String(evt.projectId) : null;
          if (incoming && incoming !== projectId) {
            ownProjectAdoptionRef.current = incoming;
          }
          onSpecPatch?.({
            changeId: String(evt.changeId),
            projectId: String(evt.projectId),
            agentId: String(evt.agentId),
            summary: evt.summary,
            affectedPaths: evt.affectedPaths,
            version: evt.version,
          });
        }
        break;
      }
      case 'job_started': {
        const card: PendingJobCard = {
          jobId: String(evt.jobId),
          kind: String(evt.kind || 'research'),
          scope: evt.scope ? String(evt.scope) : undefined,
          projectId: evt.projectId ? String(evt.projectId) : undefined,
        };
        updateAssistantMessage(assistantId, m => ({
          ...m,
          pendingJobs: [...(m.pendingJobs || []), card],
        }));
        onJobStarted?.(evt);
        break;
      }
      case 'action_completed': {
        // Tool failures (pipeline crash, validation, missing scope, etc.) are
        // dropped on the floor without this — the user sees the assistant
        // claim "starting research" and then never anything. Errors come
        // from server-side and may contain markdown-meaningful characters,
        // so wrap in a code span and clamp length.
        if (evt.ok === false) {
          const reason = sanitizeForChat(evt.error || evt.code || 'unknown error');
          const action = sanitizeForChat(evt.action ? String(evt.action) : 'action');
          updateAssistantMessage(assistantId, m => ({
            ...m,
            content: m.content + (m.content ? '\n\n' : '') + `\`${action} failed: ${reason}\``,
          }));
        }
        break;
      }
      case 'error': {
        const reason = sanitizeForChat(evt.message || evt.code || 'unknown');
        updateAssistantMessage(assistantId, m => ({
          ...m,
          content: m.content + (m.content ? '\n\n' : '') + `\`error: ${reason}\``,
        }));
        break;
      }
      default:
        break;
    }
  }, [onJobStarted, onSpecPatch, updateAssistantMessage, projectId]);

  const sendTurn = useCallback(async (
    message: string,
    toolCallResponse?: { toolCallId: string; decision: 'confirm' | 'decline' }
  ) => {
    // Use ref, not state — state is async and a fast double-tap saw stale false.
    if (isStreamingRef.current) return;
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStatusBanner(null);

    // Cancel any prior in-flight stream before starting a new one. Without
    // this, the old AbortController leaks and its events keep firing into
    // currentAssistantIdRef which now points at the new assistant message.
    try { cancelRef.current?.(); } catch { /* noop */ }
    cancelRef.current = null;

    // Files are uploaded eagerly when picked (handleFilesAdded). Here we
    // just wait for any still-in-flight uploads and assemble attachments
    // from the per-file status map. Project ID was already set during
    // eager upload too; just read it.
    const activeProjectId = projectId;
    const attachments: Array<{ name: string; kind?: string }> = [];
    const uploadFailures: UploadedAttachment[] = [];

    if (uploadedFiles.length > 0) {
      // Wait for any pending uploads first (user may have hit send before
      // the network round-trip finished).
      const inFlight: Array<Promise<UploadedAttachment | null>> = [];
      for (const f of uploadedFiles) {
        const p = uploadPromisesRef.current.get(fileKeyFor(f));
        if (p) inFlight.push(p);
      }
      if (inFlight.length > 0) {
        setStatusBanner(`Waiting for ${inFlight.length} upload${inFlight.length === 1 ? '' : 's'} to finish…`);
        await Promise.all(inFlight);
        setStatusBanner(null);
      }

      // Collect successes vs failures from the (now-final) status map.
      for (const f of uploadedFiles) {
        const status = uploadStatusRef.current.get(fileKeyFor(f));
        if (status?.status === 'done' && status.serverName) {
          attachments.push({ name: status.serverName, kind: status.kind });
        } else if (status?.status === 'error') {
          uploadFailures.push({
            name: '',
            kind: f.type || undefined,
            conversionError: status.errorMessage || 'upload failed',
          });
        }
      }
    }

    appendUserMessage(buildUserMessageWithAttachments(message, attachments, uploadFailures));
    appendAssistantPlaceholder();

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .filter(m => !!m.content)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const handle = streamChat(
      {
        message,
        projectId: activeProjectId,
        agentId,
        history,
        toolCallResponse,
        sessionId: sessionIdRef.current,
        attachments,
      },
      {
        onAny: handleStreamEvent,
        onDone: () => {
          isStreamingRef.current = false;
          setIsStreaming(false);
          currentAssistantIdRef.current = null;
          cancelRef.current = null;
        },
        onError: (e) => {
          isStreamingRef.current = false;
          setIsStreaming(false);
          cancelRef.current = null;
          // The error is already surfaced into the assistant bubble in handleStreamEvent
          console.warn('[UnifiedChatPane] stream error', e);
        },
      }
    );
    cancelRef.current = handle.cancel;
    // Clear ONLY the files that participated in this turn. A user who
    // picked additional files DURING the in-flight upload (while sendTurn
    // was awaiting) would otherwise have those new files silently wiped
    // by `setUploadedFiles([])`. We snapshot the keys at turn start
    // (`turnFileKeys` below) and remove only those from state + maps.
    const turnFileKeys = new Set(uploadedFiles.map(fileKeyFor));
    setUploadedFiles(prev => prev.filter(f => !turnFileKeys.has(fileKeyFor(f))));
    setUploadStatus(prev => {
      const next = new Map(prev);
      for (const k of turnFileKeys) next.delete(k);
      return next;
    });
    for (const k of turnFileKeys) uploadPromisesRef.current.delete(k);
    // We intentionally do NOT include `messages` in deps — sendTurn reads it
    // via the freshly-captured snapshot for `history`, and adding it would
    // re-create the callback every keystroke, defeating the streaming guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, appendAssistantPlaceholder, appendUserMessage, handleStreamEvent, onProjectCreated, projectId, uploadedFiles]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text && uploadedFiles.length === 0) return;
    setInputValue('');
    void sendTurn(text || `Please extract a spec from these files: ${uploadedFiles.map(f => f.name).join(', ')}`);
  }, [inputValue, sendTurn, uploadedFiles]);

  const handleActionResponse = useCallback((toolCallId: string, decision: 'confirm' | 'decline', card: PendingActionCard) => {
    // Mark the card so it disables visually
    setMessages(prev => prev.map(m => ({
      ...m,
      pendingActions: m.pendingActions?.map(c =>
        c.toolCallId === toolCallId ? { ...c, status: decision === 'confirm' ? 'confirmed' : 'declined' } : c
      ),
    })));

    const phrase = decision === 'confirm'
      ? `Yes — proceed with ${card.action.replace(/^confirm_/, '').replace(/_/g, ' ')}.`
      : `No — let's stay interactive for now.`;
    void sendTurn(phrase, { toolCallId, decision });
  }, [sendTurn]);

  // Triggered from JobProgressCard when a long job (research, build) finishes
  // and the user wants the brain to walk them through what was generated.
  // The literal phrase here is the cue the system prompt looks for.
  const handleReviewRequest = useCallback(() => {
    void sendTurn("Let's review the spec together — walk me through it section by section so I can confirm or refine.");
  }, [sendTurn]);

  // Triggered from SuggestionsCard when the user clicks a chip. The picked
  // value goes back as a normal user turn — no token consumption needed
  // because suggest_options has no privileged side effects. We also mark
  // the card as 'confirmed' so it disables visually after one click.
  const handleSuggestionPick = useCallback((toolCallId: string, value: string) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      pendingActions: m.pendingActions?.map(c =>
        c.toolCallId === toolCallId ? { ...c, status: 'confirmed' } : c
      ),
    })));
    void sendTurn(value);
  }, [sendTurn]);

  const greeting = useMemo(() => welcomeText || (
    mode === 'home' ? 'Start by describing your agent… or upload files to extract a spec.'
    : mode === 'spec' ? 'Working on the agent spec. Ask anything, or describe a change.'
    : mode === 'build' ? 'Build mode. Tell me what to configure or run.'
    : 'Evaluation mode.'
  ), [mode, welcomeText]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Status banner — surfaces upload progress / project creation */}
      {statusBanner && (
        <div className="px-4 py-2 border-b border-[hsl(var(--border-subtle))] text-xs text-[hsl(var(--text-secondary))] bg-[hsl(var(--brand-background))]">
          {statusBanner}
        </div>
      )}

      {/* Per-file upload progress — rendered while there are files in the
          input area, regardless of streaming state. */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--brand-background))] space-y-1">
          {uploadedFiles.map((f) => {
            const key = fileKeyFor(f);
            const s = uploadStatus.get(key);
            return (
              <div key={key} className="flex items-center gap-2 text-[12px]">
                <span className="font-medium text-[hsl(var(--text-primary))] truncate flex-1" title={f.name}>{f.name}</span>
                {(!s || s.status === 'uploading') && (
                  <span className="inline-flex items-center gap-1.5 text-[hsl(var(--primary))]">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                    Uploading…
                  </span>
                )}
                {s?.status === 'done' && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckmarkCircle16Regular className="w-3.5 h-3.5" />
                    Ready
                  </span>
                )}
                {s?.status === 'error' && (
                  <span
                    className="inline-flex items-center gap-1 text-red-700"
                    title={s.errorMessage}
                  >
                    <ErrorCircle16Regular className="w-3.5 h-3.5" />
                    Failed
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-[hsl(var(--text-secondary))] py-12">
            {greeting}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            <CopilotMessage role={m.role} content={m.content} />
            {m.pendingActions?.map(card => {
              if (card.action === 'suggest_options' && card.options && card.options.length >= 2) {
                return (
                  <SuggestionsCard
                    key={card.toolCallId}
                    toolCallId={card.toolCallId}
                    title={card.title}
                    body={card.body}
                    options={card.options}
                    disabled={card.status !== 'pending' || isStreaming}
                    onSelect={(value) => handleSuggestionPick(card.toolCallId, value)}
                  />
                );
              }
              return (
                <ToolCallCard
                  key={card.toolCallId}
                  toolCallId={card.toolCallId}
                  action={card.action}
                  title={card.title}
                  body={card.body}
                  confirmLabel={card.confirmLabel}
                  declineLabel={card.declineLabel}
                  expiresAt={card.expiresAt}
                  disabled={card.status !== 'pending' || isStreaming}
                  onRespond={(decision) => handleActionResponse(card.toolCallId, decision, card)}
                />
              );
            })}
            {m.pendingJobs?.map(job => (
              <JobProgressCard
                key={job.jobId}
                jobId={job.jobId}
                kind={job.kind}
                scope={job.scope}
                projectId={job.projectId}
                onReview={handleReviewRequest}
              />
            ))}
          </div>
        ))}

        {isStreaming && (
          <div className="px-2">
            <CopilotTypingIndicator />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--background))] px-4 py-3">
        <CopilotChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          isProcessing={isStreaming}
          uploadedFiles={uploadedFiles}
          onRemoveFile={handleRemoveFile}
          onFilesAdded={handleFilesAdded}
          showSuggestions={false}
          maxRows={6}
          shadow="input"
          inputRef={inputElementRef}
        />
      </div>
    </div>
  );
});

UnifiedChatPane.displayName = 'UnifiedChatPane';

// ---------------------------------------------------------------------------
// URL helpers — keep ?project=xxx in the HashRouter hash so refresh works
// ---------------------------------------------------------------------------

function readProjectIdFromUrl(): string | undefined {
  try {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return undefined;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const v = params.get('project');
    return v ? v : undefined;
  } catch { return undefined; }
}

function writeProjectIdToUrl(projectId: string | null): void {
  try {
    const hash = window.location.hash || '#/';
    const qIdx = hash.indexOf('?');
    const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    const params = qIdx >= 0 ? new URLSearchParams(hash.slice(qIdx + 1)) : new URLSearchParams();
    if (projectId) params.set('project', projectId);
    else params.delete('project');
    const next = params.toString();
    const newHash = next ? `${path}?${next}` : path;
    if (newHash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${newHash}`);
    }
  } catch { /* noop */ }
}

export default UnifiedChatPane;
