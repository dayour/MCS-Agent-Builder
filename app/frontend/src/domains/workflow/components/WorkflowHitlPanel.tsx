// ─── Workflow HITL Panel ───────────────────────────────────────────────────
// Human-in-the-loop contact management: global + step-level contacts,
// add/edit/remove contacts, escalation configuration.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React from 'react';
import { WorkflowNode, HitlContact } from '../../../types';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import {
  Person20Regular,
  Mail20Regular,
  Info20Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import {
  HITL_COLORS,
  MOCK_DIRECTORY,
  getHitlInitials,
  TeamsIcon,
} from './workflowConstants';
import { panelChevronRight } from './WorkflowNodeDetails';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

interface Props {
  ctx: WorkflowCanvasState;
}

/** Global + step-level HITL helpers and renderStepHitl */
export const useWorkflowHitlHelpers = (ctx: WorkflowCanvasState) => {
  const {
    agentConfig, updateAgentConfig, updateWorkflowNodes,
    workflowNodes,
    selectedNode,
    version,
    patchNode,
    hitlAddOpen, setHitlAddOpen,
    hitlAddPhase, setHitlAddPhase,
    hitlName, setHitlName,
    hitlNotifyVia, setHitlNotifyVia,
    hitlEmail, setHitlEmail,
    hitlEditingId, setHitlEditingId,
    hitlEditNotifyVia, setHitlEditNotifyVia,
    hitlEditEmail, setHitlEditEmail,
    hitlNotifyFrequency, setHitlNotifyFrequency,
    hitlNoResponse, setHitlNoResponse,
    hitlNoResponseDelay, setHitlNoResponseDelay,
    hitlEscalateWarnVisible, setHitlEscalateWarnVisible,
    hitlEscalateContacts, setHitlEscalateContacts,
    hitlEscalateAddOpen, setHitlEscalateAddOpen,
    hitlEscalateAddPhase, setHitlEscalateAddPhase,
    hitlEscalateName, setHitlEscalateName,
    hitlEscalateEmail, setHitlEscalateEmail,
    hitlEscalateNotifyVia, setHitlEscalateNotifyVia,
    hitlContactMenuId, setHitlContactMenuId,
    hitlContactMenuPos, setHitlContactMenuPos,
    hitlWhoDetailOpen, setHitlWhoDetailOpen,
    stepHitlAddOpen, setStepHitlAddOpen,
    stepHitlAddPhase, setStepHitlAddPhase,
    stepHitlName, setStepHitlName,
    stepHitlEmail, setStepHitlEmail,
    stepHitlNotifyVia, setStepHitlNotifyVia,
    stepHitlEditingId, setStepHitlEditingId,
    stepHitlEditNotifyVia, setStepHitlEditNotifyVia,
    stepHitlEditEmail, setStepHitlEditEmail,
    stepHitlDrillIn, setStepHitlDrillIn,
    dismissedHitlBanners, setDismissedHitlBanners,
    stepHitlNoResponse, setStepHitlNoResponse,
    stepHitlEscalateContacts, setStepHitlEscalateContacts,
    stepHitlEscalateAddOpen, setStepHitlEscalateAddOpen,
    stepHitlEscalateAddPhase, setStepHitlEscalateAddPhase,
    stepHitlEscalateName, setStepHitlEscalateName,
    stepHitlEscalateEmail, setStepHitlEscalateEmail,
    stepHitlEscalateNotifyVia, setStepHitlEscalateNotifyVia,
    stepHitlContactMenuId, setStepHitlContactMenuId,
    stepHitlContactMenuPos, setStepHitlContactMenuPos,
  } = ctx;

  // ─── HITL helpers ─────────────────────────────────────────────────────────
  const advanceHitlToChannel = () => {
    if (!hitlName.trim()) return;
    const found = MOCK_DIRECTORY.find(d => d.name.toLowerCase() === hitlName.trim().toLowerCase());
    if (found) setHitlEmail(found.email);
    setHitlAddPhase('channel');
  };
  const addHitlContact = () => {
    if (!hitlName.trim()) return;
    const contacts = agentConfig.hitlContacts ?? [];
    const newContact: HitlContact = { id: crypto.randomUUID(), name: hitlName.trim(), email: hitlEmail.trim() || undefined, notifyVia: hitlNotifyVia };
    updateAgentConfig({ hitlContacts: [...contacts, newContact] });
    setHitlName('');
    setHitlEmail('');
    setHitlNotifyVia('email');
    setHitlAddOpen(false);
    setHitlAddPhase('search');
  };
  const cancelHitlAdd = () => { setHitlAddOpen(false); setHitlName(''); setHitlEmail(''); setHitlNotifyVia('email'); setHitlAddPhase('search'); };
  const removeHitlContact = (id: string) => {
    updateAgentConfig({ hitlContacts: (agentConfig.hitlContacts ?? []).filter(c => c.id !== id) });
  };
  const startHitlEdit = (c: HitlContact) => { setHitlEditingId(c.id); setHitlEditNotifyVia(c.notifyVia); setHitlEditEmail(c.email ?? ''); };
  const saveHitlEdit = (id: string) => {
    updateAgentConfig({ hitlContacts: (agentConfig.hitlContacts ?? []).map(c => c.id === id ? { ...c, notifyVia: hitlEditNotifyVia, email: hitlEditEmail.trim() || undefined } : c) });
    setHitlEditingId(null);
  };
  const cancelHitlEdit = () => { setHitlEditingId(null); };

  // ─── Step-level HITL helpers ──────────────────────────────────────────────
  const addStepHitlContact = (nodeId: string) => {
    const name = stepHitlName.trim();
    const email = stepHitlEmail.trim();
    if (!name) return;
    // Require an email address when the email channel is selected
    if (stepHitlNotifyVia === 'email' && !email) return;
    const node = workflowNodes.find(n => n.id === nodeId);
    const contacts = node?.hitlContacts ?? [];
    const newContact: HitlContact = {
      id: crypto.randomUUID(),
      name,
      email: stepHitlNotifyVia === 'email' ? email : undefined,
      notifyVia: stepHitlNotifyVia,
    };
    patchNode(nodeId, { hitlContacts: [...contacts, newContact], hitlMode: 'custom' });
    setStepHitlName('');
    setStepHitlEmail('');
    setStepHitlNotifyVia('email');
    setStepHitlAddOpen(false);
    setStepHitlAddPhase('search');
  };
  const removeStepHitlContact = (nodeId: string, contactId: string) => {
    const node = workflowNodes.find(n => n.id === nodeId);
    const remaining = (node?.hitlContacts ?? []).filter(c => c.id !== contactId);
    const updates: Partial<WorkflowNode> = { hitlContacts: remaining };
    if (remaining.length === 0 && node?.hitlMode === 'custom') updates.hitlMode = 'inherit';
    patchNode(nodeId, updates);
  };
  const startStepHitlEdit = (c: HitlContact) => { setStepHitlEditingId(c.id); setStepHitlEditNotifyVia(c.notifyVia); setStepHitlEditEmail(c.email ?? ''); };
  const saveStepHitlEdit = (nodeId: string, contactId: string) => {
    const node = workflowNodes.find(n => n.id === nodeId);
    patchNode(nodeId, { hitlContacts: (node?.hitlContacts ?? []).map(c => c.id === contactId ? { ...c, notifyVia: stepHitlEditNotifyVia, email: stepHitlEditEmail.trim() || undefined } : c) });
    setStepHitlEditingId(null);
  };

  // Renders the HITL configuration section inside a node's detail panel
  function renderStepHitl(node: WorkflowNode) {
    const isOn = !!node.hitlEnabled;
    const isLocked = !!node.hitlLocked;
    const contacts = node.hitlContacts ?? [];
    const globalContacts = agentConfig.hitlContacts ?? [];
    const stepHasCustomContacts = node.hitlMode === 'custom' || contacts.length > 0;
    const effectiveContacts = stepHasCustomContacts ? contacts : globalContacts;

    // ── Locked / pre-configured read-only view ──────────────────────────────
    if (isLocked) {
      return (
        <div className="pt-3 mt-1 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Person20Regular style={{ width: 13, height: 13, color: '#9ca3af' }} />
              <p className="text-caption-1-strong text-gray-500 uppercase tracking-wide" style={{ fontSize: 10, letterSpacing: '0.06em' }}>Human in the Loop</p>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-caption-1-strong" style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: 10 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              Pre-configured
            </span>
          </div>
          <p className="text-caption-1 text-gray-400 mb-3 leading-relaxed">Escalation contacts were set when this step was originally built and cannot be edited here.</p>
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}>
                  <span className="text-white font-semibold" style={{ fontSize: 9 }}>{getHitlInitials(c.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption-1 text-gray-700 truncate">{c.name}</p>
                  <p className="text-caption-1 text-gray-400">{c.notifyVia === 'teams' ? 'Microsoft Teams' : c.email || 'Email'}</p>
                </div>
                <span className="flex-shrink-0" style={{ color: '#9ca3af' }}>
                  {c.notifyVia === 'teams' ? <img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 12, height: 12 }} /> : <Mail20Regular style={{ width: 12, height: 12 }} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {/* Header: label + toggle */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-body-2-strong text-gray-900">Human review</p>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label="Toggle human-in-the-loop for this step"
            onClick={() => patchNode(node.id, { hitlEnabled: !isOn })}
            className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            style={{ backgroundColor: isOn ? 'hsl(var(--primary))' : 'hsl(var(--stroke-default))' }}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200"
              style={{ transform: isOn ? 'translateX(16px)' : 'translateX(0px)' }}
            />
          </button>
        </div>

        {/* Workflow-level contacts info banner */}
        {globalContacts.length > 0 && !dismissedHitlBanners.has(node.id) && (
          <div className="px-3 py-3 rounded-xl mb-3 space-y-2.5" style={{ backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe' }}>
            <div className="flex items-start gap-2">
              <Info20Regular style={{ width: 14, height: 14, color: '#4f46e5', marginTop: 1, flexShrink: 0 }} />
              <p className="text-caption-1 leading-relaxed flex-1" style={{ color: '#3730a3' }}>
                Human review has been configured for the entire workflow.
              </p>
              <CopilotButton
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setDismissedHitlBanners(prev => { const next = new Set(prev); next.add(node.id); return next; })}
                className="flex-shrink-0 text-indigo-300 hover:text-indigo-500 transition-colors"
                aria-label="Dismiss"
              >
                <Dismiss20Regular style={{ width: 14, height: 14 }} />
              </CopilotButton>
            </div>
            <div className="flex items-center pl-[22px]">
              {globalContacts.slice(0, 5).map((c, i) => (
                <div
                  key={c.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                  style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length], borderColor: '#f0f4ff', marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }}
                  title={c.name}
                >
                  <span className="text-white font-semibold" style={{ fontSize: 9 }}>{getHitlInitials(c.name)}</span>
                </div>
              ))}
              {globalContacts.length > 5 && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                  style={{ backgroundColor: '#e0e7ff', borderColor: '#f0f4ff', marginLeft: -8 }}
                >
                  <span className="font-semibold" style={{ fontSize: 9, color: '#4f46e5' }}>+{globalContacts.length - 5}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {isOn && (
          <>
            {/* Who to notify */}
            <div className="w-full flex items-center justify-between py-1.5">
              <div className="flex items-center gap-0.5">
                <p className="text-caption-1-strong text-gray-700">Who to notify</p>
                <span className="text-red-500 text-caption-1-strong leading-none ml-0.5">*</span>
              </div>
              <div className="flex items-center gap-2">
                {effectiveContacts.length > 0 ? (
                  <div className="flex items-center">
                    {effectiveContacts.slice(0, 3).map((c, i) => (
                      <div key={c.id} className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white flex-shrink-0"
                        style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length], marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}
                        title={c.name}>
                        <span className="text-white font-semibold" style={{ fontSize: 10 }}>{getHitlInitials(c.name)}</span>
                      </div>
                    ))}
                    {effectiveContacts.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white flex-shrink-0" style={{ marginLeft: -8 }}>
                        <span className="text-gray-600 font-semibold" style={{ fontSize: 10 }}>+{effectiveContacts.length - 3}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-caption-1 text-red-400">Required</span>
                )}
                <CopilotButton variant="ghost" size="sm" className="w-6 h-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100" onClick={() => { setStepHitlAddOpen(false); setStepHitlEditingId(null); setStepHitlDrillIn(true); }}>
                  {panelChevronRight}
                </CopilotButton>
              </div>
            </div>

            {/* When to notify */}
            <div className="flex items-center justify-between py-1.5">
              <p className="text-caption-1-strong text-gray-700">When to notify</p>
              <CopilotDropdown
                variant="dropdown"
                size="sm"
                value={node.hitlNotifyFrequency ?? 'immediately'}
                onChange={val => patchNode(node.id, { hitlNotifyFrequency: val as 'immediately' | 'daily-recap' })}
                options={[
                  { label: 'Immediately', value: 'immediately', description: 'Send a notification each time an issue occurs' },
                  { label: 'Daily recap', value: 'daily-recap', description: 'Collect all issues and send one summary per day' },
                ]}
              />
            </div>
          </>
        )}
      </div>
    );
  }


  return {
    advanceHitlToChannel,
    addHitlContact,
    removeHitlContact,
    cancelHitlAdd,
    startHitlEdit,
    saveHitlEdit,
    cancelHitlEdit,
    addStepHitlContact,
    removeStepHitlContact,
    saveStepHitlEdit,
    renderStepHitl,
  };
};
