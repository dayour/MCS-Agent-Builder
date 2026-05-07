import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '../../../context/ToastContext';
import ReactDOM from 'react-dom';
import {
  FlashRegular,
  LockClosed20Regular,
  ArrowExpand20Regular,
  Dismiss20Regular,
  Edit20Regular,
  TextBulletListRegular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Sparkle20Regular,
  ArrowClockwise20Regular,
  Add20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { SkillDetailPage } from '../../../components/SkillDetailPage';
import { Skill } from '../../../types';
import { SKILL_FAMILIES } from './DWOverviewTab';
import { wrapWithGlobalInstructions } from '../utils/dwGlobalInstructions';
import { updateDexterWorker } from '../services/dexterWorkerService';
import { isDivider, isBulletLine, isNumberedLine } from '../../../utils/messageFormatting';
import { callModel } from '../../../utils/modelClient';
import { getAgentStorage, setAgentStorage } from '../../../utils/agentStorage';
import { AgentConfig } from '../../../types';

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderTextWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} className="font-semibold text-neutral-900">{part.slice(2, -2)}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownRenderer({ content }: { content: string }) {
  let text = content.replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
  text = text.replace(/^(#{1,3} .+)$/gm, '\n\n$1\n\n').replace(/\n{3,}/g, '\n\n').trim();

  const paragraphs = text.split('\n\n').filter(p => p.trim());

  const entries: { el: React.ReactNode; isList: boolean; isHeading?: boolean }[] = [];

  paragraphs.forEach((para, index) => {
    const lines = para.split('\n');
    const first = lines[0].trim();

    if (first.startsWith('# ')) {
      entries.push({ isList: false, isHeading: true, el: <h2 key={index} className="text-base font-bold text-neutral-900 mt-1">{renderTextWithBold(first.slice(2))}</h2> });
      return;
    }
    if (first.startsWith('## ')) {
      entries.push({ isList: false, isHeading: true, el: <h3 key={index} className="text-sm font-semibold text-neutral-800">{renderTextWithBold(first.slice(3))}</h3> });
      return;
    }
    if (first.startsWith('### ')) {
      entries.push({ isList: false, isHeading: true, el: <h4 key={index} className="text-sm font-medium text-neutral-700">{renderTextWithBold(first.slice(4))}</h4> });
      return;
    }
    if (lines.length === 1 && isDivider(first)) {
      entries.push({ isList: false, el: <hr key={index} className="border-neutral-200" /> });
      return;
    }

    const hasBullets = lines.some(l => isBulletLine(l.trim()));
    const hasNumbered = lines.some(l => isNumberedLine(l.trim()));

    if (hasBullets || hasNumbered) {
      entries.push({
        isList: true,
        el: (
          <ul key={index} className="space-y-1.5 pl-1">
            {lines.map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (isDivider(t)) return <li key={i} className="list-none"><div className="h-px bg-neutral-200 my-1" /></li>;
              if (isBulletLine(t)) {
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-neutral-400 flex-shrink-0" />
                    <span className="flex-1">{renderTextWithBold(t.replace(/^[-•]\s*/, ''))}</span>
                  </li>
                );
              }
              if (isNumberedLine(t)) {
                const match = t.match(/^(\d+[.)]\s+)(.*)/);
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="font-semibold text-neutral-500 flex-shrink-0 w-5 text-right">{match?.[1]}</span>
                    <span className="flex-1">{renderTextWithBold(match?.[2] ?? t)}</span>
                  </li>
                );
              }
              return <div key={i} className="text-sm text-neutral-700">{renderTextWithBold(t)}</div>;
            })}
          </ul>
        ),
      });
      return;
    }

    entries.push({ isList: false, el: <p key={index} className="text-sm text-neutral-700 leading-relaxed">{renderTextWithBold(para)}</p> });
  });

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => <React.Fragment key={i}>{entry.el}</React.Fragment>)}
    </div>
  );
}


// ── Agent summary card ────────────────────────────────────────────────────────

interface AgentSummaryCardProps {
  agentConfig: AgentConfig;
  instructions: string;
  onSaveInstructions: (value: string) => void;
}

function AgentSummaryCard({ agentConfig, instructions, onSaveInstructions }: AgentSummaryCardProps) {
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [showAllScenarios, setShowAllScenarios] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(instructions);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => { if (!isEditing) setDraft(instructions); }, [instructions, isEditing]);

  const startEdit = useCallback(() => {
    setDraft(instructions);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [instructions]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    if (draft !== instructions) onSaveInstructions(draft);
  }, [draft, instructions, onSaveInstructions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsEditing(false); setDraft(instructions); }
  };

  // Stable primitives for fingerprint — avoid depending on the full agentConfig object
  const agentId = agentConfig.id;
  const agentName = agentConfig.name;
  const agentRole = agentConfig.role ?? '';
  const agentPurpose = agentConfig.purpose ?? '';
  const dwSkillsKey = (agentConfig.dwSkills ?? []).join(',');
  const skillsKey = (agentConfig.skills ?? []).join(',');
  const capsKey = (agentConfig.capabilities ?? []).map(c => c.name).join(',');
  const capsContextKey = (agentConfig.capabilities ?? []).map(c => c.description ?? c.name).join(',');

  const fingerprint = useMemo(
    () => [agentName, agentRole, agentPurpose, dwSkillsKey, skillsKey, capsKey].join('|'),
    [agentName, agentRole, agentPurpose, dwSkillsKey, skillsKey, capsKey],
  );

  const generate = useCallback(async (bust = false) => {
    if (!bust) {
      const cached = getAgentStorage(agentId, 'expertiseScenarios');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.fingerprint === fingerprint) {
            setScenarios(parsed.scenarios);
            return;
          }
        } catch { /* stale cache — regenerate */ }
      }
    }

    setScenarios([]);
    setIsLoading(true);
    const allSkills = [...dwSkillsKey.split(','), ...skillsKey.split(',')].filter(Boolean);
    const allCaps = capsContextKey.split(',').filter(Boolean);
    const context = [
      `Agent name: ${agentName}${agentRole ? ` — Role: ${agentRole}` : ''}`,
      agentPurpose ? `Purpose: ${agentPurpose}` : '',
      allSkills.length ? `Skills: ${allSkills.join(', ')}` : '',
      allCaps.length ? `Capabilities: ${allCaps.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    try {
      const text = await callModel({
        model: 'fast',
        maxTokens: 500,
        system: `You write concise first-person scenario descriptions for an AI teammate. The agent speaks as "I". Write up to 10 bullet points — use as many as needed to cover all distinct capabilities without repetition, but never more than 10. Each bullet is one sentence in first person describing a specific scenario and the outcome. Cover the full breadth of capabilities. No markdown, no bold, no labels — just the raw sentence per bullet, one per line starting with "- ". Be concrete and specific, not generic.`,
        messages: [{ role: 'user', content: context }],
      });
      const lines = text.trim().split('\n')
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 0)
        .slice(0, 10);
      if (!mountedRef.current) return;
      setScenarios(lines);
      setAgentStorage(agentId, 'expertiseScenarios', JSON.stringify({ fingerprint, scenarios: lines }));
    } catch (e) {
      console.error('Failed to generate expertise scenarios:', e);
    }
    if (mountedRef.current) setIsLoading(false);
  }, [agentId, agentName, agentRole, agentPurpose, fingerprint, dwSkillsKey, skillsKey, capsContextKey]);

  useEffect(() => { generate(); }, [generate]);

  // Full-screen instructions portal
  if (isFullScreen) {
    const pane = document.getElementById('elevate-right-pane');
    if (pane) {
      return ReactDOM.createPortal(
        <div className="absolute inset-0 z-20 bg-white flex flex-col p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-base font-semibold text-neutral-900">Custom Instructions</h2>
            <div className="flex items-center gap-1">
              {!isEditing && <CopilotButton variant="transparent" size="sm" icon={<Edit20Regular className="w-4 h-4" />} onClick={startEdit} title="Edit" />}
              <CopilotButton variant="transparent" size="sm" icon={<Dismiss20Regular className="w-4 h-4" />} onClick={() => setIsFullScreen(false)} title="Exit full view" />
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            {isEditing ? (
              <>
                <CopilotTextarea
                  ref={textareaRef as React.Ref<HTMLTextAreaElement>}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-h-0 flex flex-col font-mono"
                  style={{ height: '100%' }}
                  placeholder="Write instructions in markdown..."
                />
                <div className="flex items-center justify-end gap-2 flex-shrink-0">
                  <CopilotButton variant="transparent" size="sm" onClick={() => { setIsEditing(false); setDraft(instructions); }}>Cancel</CopilotButton>
                  <CopilotButton variant="primary" size="sm" onClick={commitEdit}>Save</CopilotButton>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 rounded-xl border border-neutral-200 bg-white p-5 cursor-text overflow-y-auto hover:border-neutral-300 transition-colors" onClick={startEdit} title="Click to edit">
                {instructions ? <MarkdownRenderer content={instructions} /> : <p className="text-sm text-neutral-400 italic">No instructions configured yet. Click to add.</p>}
              </div>
            )}
          </div>
        </div>,
        pane,
      );
    }
  }

  return (
    <div className="rounded-xl border border-[#E0E0F0] bg-[#F5F5FA] overflow-hidden">

      {/* ── What I Can Do section ── */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkle20Regular className="w-4 h-4 text-[#6264A7]" />
            <span className="text-sm font-semibold text-neutral-900">What I Can Do</span>
          </div>
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<ArrowClockwise20Regular className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => generate(true)}
            disabled={isLoading}
            title="Regenerate"
          />
        </div>

        {isLoading && !scenarios.length ? (
          <div className="space-y-2.5">
            {[100, 88, 76, 92, 68].map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-200 flex-shrink-0 animate-pulse" />
                <div className="h-3 bg-neutral-100 rounded animate-pulse" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {(showAllScenarios ? scenarios : scenarios.slice(0, 6)).map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] opacity-60 flex-shrink-0" />
                  <span className="text-sm text-neutral-700 leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
            {scenarios.length > 6 && (
              <div className="mt-4">
                <CopilotButton
                  variant="transparent"
                  size="xs"
                  onClick={() => setShowAllScenarios(v => !v)}
                  className="opacity-70 hover:opacity-100"
                >
                  {showAllScenarios ? 'Show less' : `+${scenarios.length - 6} more`}
                </CopilotButton>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Instructions section (collapsed by default) ── */}
      <div className="border-t border-[#E0E0F0] bg-white rounded-b-xl">
        <div className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 transition-colors rounded-b-xl cursor-pointer">
          <div className="flex items-center gap-2 flex-1 cursor-pointer select-none" onClick={() => setInstructionsOpen(v => !v)}>
            <TextBulletListRegular className="w-4 h-4 text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Custom Instructions</h2>
          </div>
          <div className="flex items-center gap-1">
            {instructionsOpen && !isEditing && (
              <CopilotButton variant="transparent" size="sm" icon={<Edit20Regular className="w-4 h-4" />} onClick={startEdit} title="Edit" />
            )}
            <CopilotButton
              variant="transparent" size="sm"
              icon={instructionsOpen ? <ChevronUp20Regular className="w-4 h-4" /> : <ChevronDown20Regular className="w-4 h-4" />}
              onClick={() => setInstructionsOpen(v => !v)}
              title={instructionsOpen ? 'Collapse' : 'Expand'}
            />
            <CopilotButton variant="transparent" size="sm" icon={<ArrowExpand20Regular className="w-4 h-4" />} onClick={() => setIsFullScreen(true)} title="Full view" />
          </div>
        </div>
        {instructionsOpen && (
          <>
            <div className="border-t border-[#E0E0F0]" />
            {isEditing ? (
              <div className="flex flex-col gap-2 px-4 pb-4 pt-4" style={{ height: 400 }}>
                <CopilotTextarea
                  ref={textareaRef as React.Ref<HTMLTextAreaElement>}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-h-0 flex flex-col font-mono"
                  style={{ height: '100%' }}
                  placeholder="Write instructions in markdown..."
                />
                <div className="flex items-center justify-end gap-2 flex-shrink-0">
                  <CopilotButton variant="transparent" size="sm" onClick={() => { setIsEditing(false); setDraft(instructions); }}>Cancel</CopilotButton>
                  <CopilotButton variant="primary" size="sm" onClick={commitEdit}>Save</CopilotButton>
                </div>
              </div>
            ) : (
              <div className="px-5 pt-4 pb-5 overflow-y-auto cursor-text" style={{ height: 400 }} onClick={startEdit} title="Click to edit">
                {instructions
                  ? <MarkdownRenderer content={instructions} />
                  : <p className="text-sm text-neutral-400 italic">No instructions configured yet. Click to add.</p>}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const DWKnowledgeTab: React.FC = () => {
  const { agentConfig, skills, addSkill, updateWithHistory, updateAgentConfig, isAgentGlobalUndo } = useAgent();
  const { isDexter, getDexterAuthFetch, isDwConversationalDemo } = useDW();
  const { addToast } = useToast();
  const firstName = agentConfig.name?.split(' ')[0] || agentConfig.name || 'AI Teammate';
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);

  const chatSkills = skills.filter(s => s.agentId === agentConfig.id);

  const handleCreateSkill = () => {
    const saved = addSkill({
      name: '',
      description: '',
      body: '',
      agentId: agentConfig.id,
    });
    setActiveSkill(saved);
  };


  const handleSaveInstructions = (value: string) => {
    isAgentGlobalUndo
      ? updateWithHistory({ instructions: value })
      : updateAgentConfig({ instructions: value });

    // Keep Dexter worker in sync with local instructions
    if (isDexter && agentConfig.dexterWorkerId) {
      const authFetch = getDexterAuthFetch();
      if (authFetch) {
        const wrapped = wrapWithGlobalInstructions(value, agentConfig.name, agentConfig.role, isDwConversationalDemo);
        updateDexterWorker(authFetch, agentConfig.dexterWorkerId, { instructions: wrapped }).catch((err) => {
          console.warn('Dexter instruction sync failed:', err);
          addToast({ variant: 'warning', title: 'Sync failed', message: 'Instructions saved locally but could not sync to Dexter worker.' });
        });
      }
    }
  };

  if (activeSkill) {
    return (
      <SkillDetailPage
        key={activeSkill.id}
        skill={activeSkill}
        onBack={() => setActiveSkill(null)}
      />
    );
  }

  return (
    <>
    <div className="space-y-8">

      {/* ── What I Can Do + Instructions (combined card) ─────────────────── */}
      <AgentSummaryCard
        agentConfig={agentConfig}
        instructions={agentConfig.instructions || ''}
        onSaveInstructions={handleSaveInstructions}
      />

      {/* ── Section 2: Skills ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-neutral-900">Skills</h2>
          <CopilotButton
            variant="secondary"
            size="sm"
            icon={<Add20Regular className="w-4 h-4" />}
            onClick={handleCreateSkill}
          >
            Create skill
          </CopilotButton>
        </div>
        <div className="grid grid-cols-3 gap-3 auto-rows-fr">
          {SKILL_FAMILIES.map(skill => (
            <div key={skill.title} className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-white hover:shadow-sm hover:border-neutral-300 transition-all">
              <div className={`w-8 h-8 rounded-lg ${skill.iconBg} ${skill.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {skill.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 leading-snug">{skill.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{skill.description}</p>
              </div>
              <LockClosed20Regular className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
          {chatSkills.map(skill => (
            <div key={skill.id} className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-white hover:shadow-sm hover:border-neutral-300 transition-all cursor-pointer" role="button" tabIndex={0} onClick={() => setActiveSkill(skill)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSkill(skill); } }}>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FlashRegular className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 leading-snug">{skill.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{skill.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
    </>
  );
};
