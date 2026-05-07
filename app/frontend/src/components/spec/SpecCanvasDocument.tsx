/**
 * SpecCanvasDocument — single-scroll "document being written" view of the
 * working agent spec. Always visible on Home alongside the chat — this is
 * the unified canvas: chat on the left, spec doc on the right, sections
 * fill in as the brain (chat or deep research) makes patches.
 *
 * Three signals drive the live feel:
 *   1. Each section is always rendered. Empty sections show an invitation
 *      prompt that doubles as discoverability ("tell the chat about X").
 *   2. When a chat-driven spec patch lands, the affected sections briefly
 *      pulse (border highlight via .section-pulse keyframe in index.css).
 *   3. While a research job is running, sections that the current pipeline
 *      step is producing carry a "Writing…" pill, mapped from job.steps.
 *
 * Source of truth: SpecSessionContext (same path /spec used). Edits fall
 * through to applyServerPatch(), so direct refinements after a section is
 * filled work the same as chat-driven patches.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkle20Regular,
  ArrowUpRight16Regular,
  Document20Regular,
} from '@fluentui/react-icons';
import { useSpecSessionContext } from '../../context/SpecSessionContext';
import { usePipelineActivity } from '../../context/PipelineActivityContext';
import { DocumentsPanel } from '../DocumentsPanel';
import {
  AgentIdentityEditor,
  CapabilitiesEditor,
  IntegrationsEditor,
  KnowledgeEditor,
  TopicsEditor,
  OpenQuestionsEditor,
  DecisionsEditor,
} from './SpecSectionEditors';

// ─── Section definitions ────────────────────────────────────────────────────

type SectionKey =
  | 'identity'
  | 'capabilities'
  | 'integrations'
  | 'knowledge'
  | 'topics'
  | 'questions'
  | 'decisions'
  | 'documents';

interface SectionDef {
  key: SectionKey;
  title: string;
  invitation: string;
  /** Spec field names that, when changed, should pulse this section. */
  pathKeys: string[];
}

const SECTIONS: SectionDef[] = [
  {
    key: 'identity',
    title: 'Identity',
    invitation: 'What is this agent called, and who is it for? Tell the chat the role and audience.',
    pathKeys: ['agent', 'business', 'architecture'],
  },
  {
    key: 'capabilities',
    title: 'Capabilities',
    invitation: 'What should users actually be able to do here? Describe the tasks the agent owns.',
    pathKeys: ['capabilities'],
  },
  {
    key: 'integrations',
    title: 'Integrations',
    invitation: 'Where does the agent get its data and take actions? Name the systems it connects to.',
    pathKeys: ['integrations'],
  },
  {
    key: 'knowledge',
    title: 'Knowledge',
    invitation: 'What docs, sites, or sources should ground its answers? SharePoint, Dataverse, public web?',
    pathKeys: ['knowledge'],
  },
  {
    key: 'topics',
    title: 'Topics',
    invitation: 'What conversational flows should it handle? Triggers, hand-offs, branches.',
    pathKeys: ['conversations'],
  },
  {
    key: 'questions',
    title: 'Open questions',
    invitation: 'Anything we are not sure about yet — these populate as the brain identifies gaps.',
    pathKeys: ['openQuestions'],
  },
  {
    key: 'decisions',
    title: 'Decisions',
    invitation: 'Key trade-offs we make along the way. Auto-recorded as we resolve open questions.',
    pathKeys: ['decisions'],
  },
  {
    key: 'documents',
    title: 'Documents',
    invitation: 'Drop SDRs, design briefs, or transcripts in the chat to seed deep research.',
    pathKeys: [],
  },
];

/**
 * Map a pipeline step.id to the spec sections it's currently writing.
 *
 * Covers BOTH the canonical analyze-pipeline (CLI, the path chat now uses)
 * and the legacy research-pipeline IDs (kept so any in-flight jobs from
 * before the 2026-05-05 swap still light up correct sections). Adding a
 * step ID here is cheap; missing one just means a section won't show
 * "Writing…" while that step runs.
 */
const STEP_TO_SECTIONS: Record<string, SectionKey[]> = {
  // analyze-pipeline (CLI) — current canonical
  process:   [],                             // doc ingestion, no spec section yet
  classify:  [],                             // content classification, internal
  research:  ['integrations', 'knowledge'],  // component research (Microsoft-first)
  score:     ['identity'],                   // architecture scoring lands on identity
  generate:  ['identity', 'capabilities'],   // agent spec generation
  evals:     ['questions'],                  // eval set creation surfaces gaps
  finalize:  [],                             // packaging, no live writes

  // research-pipeline (API-direct, deprecated) — legacy step IDs
  agents:        ['identity'],
  components:    ['integrations', 'knowledge'],
  architecture:  ['identity'],
  instructions:  ['identity'],
  topics:        ['topics'],
  reconcile:     [],
};

// ─── Empty-state detection ──────────────────────────────────────────────────

function isSectionEmpty(spec: any, key: SectionKey): boolean {
  if (!spec) return true;
  switch (key) {
    case 'identity':
      return !spec.agent?.name && !spec.agent?.description && !spec.business?.useCase;
    case 'capabilities':
      return !Array.isArray(spec.capabilities) || spec.capabilities.length === 0;
    case 'integrations':
      return !Array.isArray(spec.integrations) || spec.integrations.length === 0;
    case 'knowledge':
      return !Array.isArray(spec.knowledge) || spec.knowledge.length === 0;
    case 'topics':
      return !spec.conversations?.topics || spec.conversations.topics.length === 0;
    case 'questions':
      return !Array.isArray(spec.openQuestions) || spec.openQuestions.length === 0;
    case 'decisions':
      return !Array.isArray(spec.decisions) || spec.decisions.length === 0;
    case 'documents':
      return false; // DocumentsPanel handles its own empty state
    default:
      return true;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SpecCanvasDocument: React.FC = () => {
  const session = useSpecSessionContext();
  const { jobs } = usePipelineActivity();
  const spec = session.specData;
  const projectId = session.projectId;

  // Pulse tracking: when changelog appends a new entry, mark the affected
  // sections as "recently updated" for ~700ms so the keyframe fires once.
  const lastSeenChangeId = useRef<string | null>(null);
  const [pulsing, setPulsing] = useState<Set<SectionKey>>(new Set());

  useEffect(() => {
    const log = session.changelog;
    if (!log || log.length === 0) return;
    const latest = log[log.length - 1];
    if (!latest || latest.changeId === lastSeenChangeId.current) return;
    lastSeenChangeId.current = latest.changeId;

    const affectedPaths = latest.affectedPaths || [];
    const sectionsToPulse = new Set<SectionKey>();
    for (const sec of SECTIONS) {
      // Match exact (server currently emits top-level keys like "agent")
      // AND dotted children (defensive against future changes that emit
      // "agent.name" style paths) so the pulse never silently breaks.
      const hit = sec.pathKeys.some((p) =>
        affectedPaths.some((ap: string) => ap === p || ap.startsWith(p + '.')),
      );
      if (hit) sectionsToPulse.add(sec.key);
    }
    if (sectionsToPulse.size === 0) return;
    setPulsing(sectionsToPulse);
    const t = setTimeout(() => setPulsing(new Set()), 750);
    return () => clearTimeout(t);
  }, [session.changelog]);

  // Active research job for this project — drives the "Writing…" pills.
  const activeJob = useMemo(() => {
    if (!projectId) return null;
    return jobs.find(
      (j) => j.status === 'running' && j.projectId === projectId &&
        (j.skillType === 'research' || j.skillType === 'preview' || j.skillType === 'analyze')
    ) || null;
  }, [jobs, projectId]);

  const writingSections = useMemo(() => {
    if (!activeJob) return new Set<SectionKey>();
    const out = new Set<SectionKey>();
    for (const step of activeJob.steps) {
      if (step.status !== 'running') continue;
      const targets = STEP_TO_SECTIONS[step.id] || [];
      for (const t of targets) out.add(t);
    }
    return out;
  }, [activeJob]);

  const applyPatch = (patch: Record<string, any>, summary: string) => {
    session.applyServerPatch(patch, 'chat', summary || 'Edit on canvas');
  };

  const projectName = spec?.agent?.name;
  const projectDescription = spec?.agent?.description;

  return (
    <div
      className="h-full overflow-y-auto bg-[hsl(var(--background))]"
      data-testid="spec-canvas-document"
    >
      <div className="max-w-[720px] mx-auto px-6 py-6">
        {/* ── Document title ── */}
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--text-disabled))] font-medium mb-1">
            Working spec
          </div>
          <h1
            className={`text-[24px] font-bold leading-tight ${
              projectName ? 'text-[hsl(var(--text-primary))]' : 'text-[hsl(var(--text-disabled))] italic'
            }`}
          >
            {projectName || 'Untitled project'}
          </h1>
          {projectDescription && (
            <p className="mt-1 text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed">
              {projectDescription}
            </p>
          )}

          {activeJob && (
            <div
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.06)]"
              role="status"
              aria-live="polite"
            >
              <Sparkle20Regular className="w-3.5 h-3.5 text-[hsl(var(--primary))] animate-pulse" />
              <span className="text-[12px] font-medium text-[hsl(var(--primary))]">
                Deep Research running — sections will fill as steps complete
              </span>
            </div>
          )}
        </header>

        {/* ── Sections ── */}
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const isPulsing = pulsing.has(section.key);
            const isWriting = writingSections.has(section.key);
            const empty = isSectionEmpty(spec, section.key);
            return (
              <section
                key={section.key}
                className={`rounded-2xl border bg-[hsl(var(--card))] p-4 transition-colors ${
                  isPulsing ? 'section-pulse' : 'border-[hsl(var(--border-subtle))]'
                }`}
                aria-label={section.title}
                data-section={section.key}
                data-empty={empty ? 'true' : 'false'}
                data-writing={isWriting ? 'true' : 'false'}
              >
                <header className="flex items-center justify-between mb-2.5">
                  <h2 className="text-[13px] font-semibold text-[hsl(var(--text-primary))]">
                    {section.title}
                  </h2>
                  {isWriting && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--primary))]">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                      Writing…
                    </span>
                  )}
                </header>

                {/* Empty state: invitation OR skeleton (when actively writing) */}
                {empty && !isWriting && (
                  <p className="text-[12px] text-[hsl(var(--text-disabled))] italic leading-relaxed flex items-start gap-1.5">
                    <ArrowUpRight16Regular className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 -rotate-90 text-[hsl(var(--text-disabled))]" />
                    {section.invitation}
                  </p>
                )}
                {empty && isWriting && (
                  <div className="space-y-2 py-1">
                    <div className="h-2.5 w-3/4 rounded bg-[hsl(var(--primary)/0.10)] animate-pulse" />
                    <div className="h-2.5 w-2/3 rounded bg-[hsl(var(--primary)/0.10)] animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-[hsl(var(--primary)/0.10)] animate-pulse" />
                  </div>
                )}

                {/* Filled state: real editor */}
                {!empty && section.key === 'identity' && spec && (
                  <AgentIdentityEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'capabilities' && spec && (
                  <CapabilitiesEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'integrations' && spec && (
                  <IntegrationsEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'knowledge' && spec && (
                  <KnowledgeEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'topics' && spec && (
                  <TopicsEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'questions' && spec && (
                  <OpenQuestionsEditor spec={spec} onPatch={applyPatch} />
                )}
                {!empty && section.key === 'decisions' && spec && (
                  <DecisionsEditor spec={spec} onPatch={applyPatch} />
                )}
                {section.key === 'documents' && projectId && (
                  <DocumentsPanel projectId={projectId} />
                )}
                {section.key === 'documents' && !projectId && (
                  <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--text-disabled))]">
                    <Document20Regular className="w-4 h-4" />
                    No project yet — start the conversation in chat to create one.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpecCanvasDocument;
