import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { Dialog } from '../../../components/ui/Dialog';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { LatencyLoader } from '../../../components/ui/StatusIcon';
import { CopilotTooltip } from '../../../components/ui/CopilotTooltip';
import { callModel } from '../../../utils/modelClient';
import { matchSystemColorIcon, getIconCatalogPrompt, ICON_CATALOG } from '../../../utils/systemColorIcons';
import {
  Dismiss20Regular, Chat20Regular, Mail20Regular, CalendarLtr20Regular,
  Video20Regular, Call20Regular, ArrowRight20Filled, ChevronLeft20Regular, ChevronRight20Regular,
} from '@fluentui/react-icons';

interface DWCreateDialogProps {
  isOpen: boolean;
  onCancel: () => void;
}

const MAX_DW_SKILLS = 3;

export const DWCreateDialog: React.FC<DWCreateDialogProps> = ({ isOpen, onCancel }) => {
  const navigate = useNavigate();
  const { createAgent } = useAgent();
  const { provisionDexterWorker, isDexter, closeDwCreateDialog, tenantDomain } = useDW();

  const dwCancelledRef = useRef(false);
  const dwTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dwLastGeneratedPrompt = useRef('');

  const [dwPrompt, setDwPrompt] = useState('');
  const [dwName, setDwName] = useState('');
  const [dwEmail, setDwEmail] = useState('');
  const [dwCardSummary, setDwCardSummary] = useState('');
  const [dwCardIcon, setDwCardIcon] = useState('ai-teammate');
  const [dwIconOptions, setDwIconOptions] = useState<string[]>([]);
  const [dwIconIndex, setDwIconIndex] = useState(0);
  const [dwIconSlide, setDwIconSlide] = useState<'out-left' | 'out-right' | 'in-left' | 'in-right' | null>(null);
  const [dwGeneratingRole, setDwGeneratingRole] = useState(false);
  const [dwContentFadeIn, setDwContentFadeIn] = useState(false);
  const [dwCreating, setDwCreating] = useState(false);
  const [dwError, setDwError] = useState(false);

  // Reset cancelled flag each time the dialog opens so a previously cancelled
  // session doesn't poison the next one (component stays mounted in Layout).
  React.useEffect(() => {
    if (isOpen) dwCancelledRef.current = false;
  }, [isOpen]);

  const resetState = () => {
    setDwCreating(false);
    setDwPrompt('');
    setDwName('');
    setDwEmail('');
    setDwCardSummary('');
    setDwCardIcon('ai-teammate');
    setDwIconOptions([]);
    setDwIconIndex(0);
    setDwGeneratingRole(false);
    setDwContentFadeIn(false);
    setDwError(false);
    dwLastGeneratedPrompt.current = '';
  };

  const handleCancel = useCallback(() => {
    dwCancelledRef.current = true;
    resetState();
    onCancel();
   
  }, [onCancel]);

  const createDwAgent = (config: {
    name: string; email: string; prompt: string; cardSummary: string; cardIcon: string; skills: string[];
  }) => {
    const dwAgentId = createAgent({
      name: config.name,
      icon: '',
      iconKey: 'digital-worker',
      systemColorIcon: config.cardIcon,
      description: config.prompt.slice(0, 200),
      email: config.email || undefined,
      role: config.cardSummary || undefined,
      purpose: 'Act as a persistent, autonomous team member with its own identity that collaborates across the full Microsoft 365 suite',
      instructions: '',
      audience: 'employees',
      agentType: 'DW',
      channel: 'teams',
      isFuzzyComplete: true,
      dwSkills: config.skills,
      capabilities: [
        { name: 'Work IQ', type: 'connector' },
        { name: 'Teams - Post message in a chat or channel', type: 'action' },
        { name: 'Outlook - Send an email', type: 'action' },
        { name: 'OneDrive - Get file content', type: 'action' },
        { name: 'Excel Online - List rows in a table', type: 'action' },
        { name: 'Word Online - Populate a template', type: 'action' },
        { name: 'PowerPoint', type: 'connector' },
      ],
      type: 'agent',
      guidelines: [],
      skills: [],
      model: 'sonnet-4.5',
      knowledge: { files: [], webSearch: true, specificSources: true, referenceOrgChart: true, customAPIs: [] },
      published: false,
      createdWithPlanMode: true,
      justCreated: true,
    });
    if (isDexter && dwAgentId) {
      provisionDexterWorker(dwAgentId, { name: config.name, description: config.prompt.slice(0, 200), instructions: '' });
    }
    return dwAgentId;
  };

  const handleCreate = async () => {
    if (!dwPrompt.trim() || !dwName.trim() || !dwEmail.trim() || dwCreating) return;
    dwCancelledRef.current = false;
    setDwCreating(true);
    setDwError(false);
    let skills: string[] = [];
    try {
      const raw = await callModel({
        model: 'fast',
        maxTokens: 100,
        system: `Generate 3 skills for an AI Teammate based on the job description. Each skill must be 2-3 words max (e.g. "Process invoices", "Route approvals", "Track expenses"). Respond with JSON only: {"skills": ["skill 1", "skill 2", "skill 3"]}`,
        messages: [{ role: 'user', content: dwPrompt }],
      });
      if (dwCancelledRef.current) { setDwCreating(false); return; }
      const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      skills = (parsed.skills || []).slice(0, MAX_DW_SKILLS).map((s: unknown) => String(s).slice(0, 40));
    } catch (err) {
      console.warn('[DW create] Skills generation failed:', err);
    }
    if (dwCancelledRef.current) { setDwCreating(false); return; }
    createDwAgent({ name: dwName.trim(), email: dwEmail.trim(), prompt: dwPrompt.trim(), cardSummary: dwCardSummary.trim(), cardIcon: dwCardIcon, skills });
    resetState();
    closeDwCreateDialog();
    navigate('/build');
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleCancel} maxWidth="4xl">
      <div className="px-12 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create an AI Teammate</h2>
          <CopilotButton variant="ghost" size="sm" onClick={handleCancel} aria-label="Close">
            <Dismiss20Regular style={{ width: 20, height: 20 }} />
          </CopilotButton>
        </div>

        <div className="flex gap-12">
          {/* Left: fields */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 relative">
              <label className="text-sm font-semibold text-gray-900 mb-1.5 block">What should this teammate do?</label>
              <CopilotTextarea
                ref={dwTextareaRef}
                value={dwPrompt}
                onChange={(e) => { setDwPrompt(e.target.value); setDwError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && dwPrompt.trim()) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
                placeholder='e.g. "Process invoices, track budgets, and send payment reminders for the finance team"'
                rows={4}
                autoFocus
                onBlur={async () => {
                  if (dwCancelledRef.current) return;
                  const trimmed = dwPrompt.trim();
                  if (trimmed && trimmed !== dwLastGeneratedPrompt.current && !dwCreating) {
                    dwLastGeneratedPrompt.current = trimmed;
                    setDwGeneratingRole(true);
                    try {
                      const catalog = getIconCatalogPrompt();
                      const raw = (await callModel({
                        model: 'fast',
                        maxTokens: 150,
                        messages: [{ role: 'user', content: `Given this job description, generate a dad-joke-level pun name and job title, plus 5 different icon options.\n\nIcons (key: visual — use):\n${catalog}\n\nRespond JSON only: {"name":"First Last","role":"2-4 word title","icons":["key1","key2","key3","key4","key5"]}\n\nPun name examples: Bill Paysworth (finance), Travis Booking (travel), Sue Pervisor (management). Timestamp: ${Date.now()}\n\nDescription: ${dwPrompt.trim()}` }],
                      })).trim();
                      if (dwCancelledRef.current) return;
                      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim());
                      const validKeys = new Set(ICON_CATALOG.map(i => i.key));
                      if (parsed.role) setDwCardSummary(String(parsed.role));
                      if (parsed.name) {
                        const name = String(parsed.name).trim();
                        setDwName(name);
                        setDwEmail(`${name.toLowerCase().replace(/\s+/g, '.')}@${tenantDomain}`);
                      }
                      const icons = (parsed.icons || [parsed.icon]).filter((k: string) => validKeys.has(k)).slice(0, 5);
                      if (icons.length === 0) icons.push(matchSystemColorIcon(dwPrompt.trim()));
                      setDwIconOptions(icons);
                      setDwIconIndex(0);
                      setDwCardIcon(icons[0]);
                      setDwContentFadeIn(false);
                      requestAnimationFrame(() => setDwContentFadeIn(true));
                    } catch (err) {
                      console.warn('[DW dialog] Role/name generation failed:', err);
                      setDwCardIcon(matchSystemColorIcon(dwPrompt.trim()));
                    } finally {
                      setDwGeneratingRole(false);
                    }
                  }
                }}
              />
              {dwPrompt.trim() && (
                dwGeneratingRole ? (
                  <div className="absolute bottom-3 right-3 w-7 h-7 flex items-center justify-center">
                    <LatencyLoader size={24} />
                  </div>
                ) : (
                  <CopilotButton
                    variant="primary"
                    size="sm"
                    onClick={() => { dwTextareaRef.current?.blur(); }}
                    className="absolute bottom-3 right-3 !rounded-full !w-8 !h-8 !p-0 !min-w-0"
                    aria-label="Submit"
                    icon={<ArrowRight20Filled className="w-5 h-5" />}
                  />
                )
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-1.5 block">Name</label>
              <CopilotInput
                value={dwName}
                onChange={(e) => setDwName(e.target.value)}
                onBlur={() => {
                  const trimmed = dwName.trim().toLowerCase().replace(/\s+/g, '.');
                  if (trimmed) setDwEmail(`${trimmed}@${tenantDomain}`);
                }}
                placeholder=""
                disabled={dwGeneratingRole}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-1.5 block">Email</label>
              <CopilotInput
                value={dwEmail}
                onChange={(e) => setDwEmail(e.target.value)}
                placeholder=""
                disabled={dwGeneratingRole}
              />
            </div>
            {dwError && (
              <p className="text-sm text-amber-600">
                Could not generate config. Try again or create with defaults.
              </p>
            )}
          </div>

          {/* Right: people card preview */}
          <div className="w-[300px] flex-shrink-0 flex items-stretch">
            <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col items-center justify-center">
              {/* Avatar */}
              <div className="flex items-center gap-2 mb-4">
                {dwCardSummary ? (
                  <CopilotButton
                    variant="transparent"
                    size="xs"
                    onClick={() => {
                      if (dwIconOptions.length === 0) return;
                      setDwIconSlide('out-left');
                      setTimeout(() => {
                        const newIdx = (dwIconIndex - 1 + dwIconOptions.length) % dwIconOptions.length;
                        setDwIconIndex(newIdx);
                        setDwCardIcon(dwIconOptions[newIdx]);
                        setDwIconSlide('in-right');
                        setTimeout(() => setDwIconSlide(null), 150);
                      }, 150);
                    }}
                    className="!p-1 !rounded-full text-gray-300 hover:!text-gray-500"
                    aria-label="Previous icon"
                    icon={<ChevronLeft20Regular />}
                  />
                ) : <div className="w-7" />}
                <div className="w-20 h-20 rounded-full border border-[hsl(var(--stroke-default))] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(138deg, #FFFFFF, #F8F8FA)' }}>
                  <img
                    src={`${process.env.PUBLIC_URL || ''}/icons/system-color/${dwCardIcon}.svg`}
                    alt="AI Teammate"
                    className="w-12 h-12 transition-all duration-150 ease-out"
                    style={{
                      transform: dwIconSlide === 'out-left' ? 'translateX(-20px)' : dwIconSlide === 'out-right' ? 'translateX(20px)' : dwIconSlide === 'in-left' ? 'translateX(-20px)' : dwIconSlide === 'in-right' ? 'translateX(20px)' : 'translateX(0)',
                      opacity: dwIconSlide?.startsWith('out') ? 0 : dwIconSlide?.startsWith('in') ? 0 : 1,
                      transition: dwIconSlide?.startsWith('in') ? 'none' : 'all 150ms ease-out',
                    }}
                  />
                </div>
                {dwCardSummary ? (
                  <CopilotButton
                    variant="transparent"
                    size="xs"
                    onClick={() => {
                      if (dwIconOptions.length === 0) return;
                      setDwIconSlide('out-right');
                      setTimeout(() => {
                        const newIdx = (dwIconIndex + 1) % dwIconOptions.length;
                        setDwIconIndex(newIdx);
                        setDwCardIcon(dwIconOptions[newIdx]);
                        setDwIconSlide('in-left');
                        setTimeout(() => setDwIconSlide(null), 150);
                      }, 150);
                    }}
                    className="!p-1 !rounded-full text-gray-300 hover:!text-gray-500"
                    aria-label="Next icon"
                    icon={<ChevronRight20Regular />}
                  />
                ) : <div className="w-7" />}
              </div>
              <div className="transition-opacity duration-500 w-full overflow-hidden" style={{ opacity: dwContentFadeIn ? 1 : (dwName ? 0 : 1) }}>
                <p className="text-lg font-semibold text-gray-900 text-center">
                  {dwName || 'AI Teammate'}
                </p>
                <CopilotTooltip content={dwEmail || `teammate@${tenantDomain}`} placement="bottom">
                  <p tabIndex={0} className="text-sm text-gray-500 mt-0.5 text-center truncate max-w-full">
                    {dwEmail || `teammate@${tenantDomain}`}
                  </p>
                </CopilotTooltip>
                <p className="text-sm text-gray-400 mt-1 text-center break-words">
                  {dwCardSummary || 'Teammate'}
                </p>
              </div>
              {/* Divider */}
              <div className="border-t border-gray-200 w-full mt-4 pt-4">
                <div className="flex justify-center gap-5">
                  <Chat20Regular className="text-gray-400" />
                  <Mail20Regular className="text-gray-400" />
                  <CalendarLtr20Regular className="text-gray-400" />
                  <Video20Regular className="text-gray-400" />
                  <Call20Regular className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-10">
          <CopilotButton variant="secondary" onClick={handleCancel}>
            Cancel
          </CopilotButton>
          {dwError && (
            <CopilotButton variant="outline" onClick={() => {
              const name = dwName.trim() || 'AI Teammate';
              const email = dwEmail.trim() || `ai.teammate@${tenantDomain}`;
              createDwAgent({ name, email, prompt: dwPrompt.trim(), cardSummary: '', cardIcon: 'ai-teammate', skills: [] });
              resetState();
              closeDwCreateDialog();
              navigate('/build');
            }}>
              Create with defaults
            </CopilotButton>
          )}
          <CopilotButton variant="primary" onClick={handleCreate} disabled={!dwPrompt.trim() || !dwName.trim() || !dwEmail.trim() || dwCreating}>
            {dwCreating ? 'Adding...' : dwError ? 'Retry' : 'Add to my team'}
          </CopilotButton>
        </div>
      </div>
    </Dialog>
  );
};
