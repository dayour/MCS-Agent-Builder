// ─── Workflow Overview Panel ───────────────────────────────────────────────
// V2 overview panel shown when no node is selected. Displays workflow name,
// description, step summary, HITL configuration, and run history.
// Extracted from WorkflowCanvas.tsx — pure refactor, no behavior changes.

import React, { useState } from 'react';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotBadge } from '../../../components/ui/CopilotBadge';
import { VersionHistory, VersionHistoryItem } from '../../../components/ui';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotMenu } from '../../../components/ui/CopilotMenu';
import { SquircleIcon } from '../../../components/ui/SquircleIcon';
import { getAgentIcon, getUniqueGradientCSS, getGradientByKey } from '../../../utils/agentIcons';
import { IconPickerDialog } from '../../../components/ui/IconPickerDialog';
import {
  Edit20Regular,
  Add20Regular,
  Mail20Regular,
  Delete20Regular,
  MoreHorizontal32Filled,
} from '@fluentui/react-icons';
import {
  HITL_COLORS,
  MOCK_DIRECTORY,
  getHitlInitials,
  TeamsIcon,
} from './workflowConstants';
import { panelChevronLeft, panelChevronRight } from './WorkflowNodeDetails';
import type { WorkflowCanvasState } from './useWorkflowCanvas';

interface Props {
  ctx: WorkflowCanvasState;
  hitlHelpers: {
    advanceHitlToChannel: () => void;
    addHitlContact: () => void;
    removeHitlContact: (id: string) => void;
    cancelHitlAdd: () => void;
    startHitlEdit: (c: import('../../../types').HitlContact) => void;
    saveHitlEdit: (id: string) => void;
    cancelHitlEdit: () => void;
  };
}

export const WorkflowOverviewPanel: React.FC<Props> = ({ ctx, hitlHelpers }) => {
  const {
    agentConfig, updateAgentConfig, updateWithHistory, isAgentGlobalUndo,
    selectedNode, setSelectedNode,
    version,
    workflowNodes,
    isEditingHeader, setIsEditingHeader,
    nameInputValue, setNameInputValue,
    descInputValue, setDescInputValue,
    showOverviewIconPicker, setShowOverviewIconPicker,
    nameInputRef,
    startEditingHeader,
    saveHeader,
    cancelHeader,
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
    getNodeIcon,
    patchNode,
    workflowVersionHistory,
    revertToVersion,
    seedExampleVersionHistory,
    currentUserName,
  } = ctx;

  // Current user's display name + initials — same derivation as NavAccountRow
  const currentDisplayName = currentUserName || 'Avery Fuller';
  const currentInitials = currentDisplayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const { advanceHitlToChannel, addHitlContact, removeHitlContact, cancelHitlAdd, startHitlEdit, saveHitlEdit, cancelHitlEdit } = hitlHelpers;
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // ─── V2 workflow overview panel (shown when no node is selected) ─────────
  const fmtDate = (d: Date | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtDateTime = (d: Date | undefined) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const v2OverviewPanel = !selectedNode && (
    <div className="absolute right-4 top-4 bottom-4 bg-white overflow-hidden z-10 flex flex-col" style={{ width: 380, borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-dropdown)', border: '1px solid hsl(var(--stroke-default))' }}>
      {hitlWhoDetailOpen ? (
        /* ── "Who to notify" drill-in detail view ── */
        <>
          {/* Detail header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0 flex items-center gap-2">
            <CopilotButton
              variant="ghost"
              size="sm"
              className="p-1 flex-shrink-0 text-gray-500 hover:text-gray-900"
              onClick={() => { setHitlWhoDetailOpen(false); setHitlAddOpen(false); setHitlEditingId(null); cancelHitlAdd(); }}
            >
              {panelChevronLeft}
            </CopilotButton>
            <h2 className="text-title-3 text-gray-900 flex-1">Who to notify</h2>
          </div>

          {/* Scrollable detail body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {/* Contact list */}
            {(agentConfig.hitlContacts ?? []).length === 0 && !hitlAddOpen && (
              <p className="text-caption-1 text-gray-400 py-2">No contacts added yet.</p>
            )}
            {(agentConfig.hitlContacts ?? []).map((c, i) => (
              <div key={c.id} className="rounded-2xl border border-gray-200 overflow-hidden">
                {hitlEditingId === c.id ? (
                  /* Edit inline */
                  <div className="px-3 py-3 space-y-2">
                    <p className="text-body-2-strong text-gray-900">{c.name}</p>
                    <div className="flex items-center gap-2">
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setHitlEditNotifyVia('email')}
                        className={`gap-1.5 border text-caption-1 ${hitlEditNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <Mail20Regular style={{ width: 14, height: 14 }} />Email
                      </CopilotButton>
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setHitlEditNotifyVia('teams')}
                        className={`gap-1.5 border text-caption-1 ${hitlEditNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams
                      </CopilotButton>
                    </div>
                    {hitlEditNotifyVia === 'email' && (
                      <CopilotInput
                        size="sm"
                        placeholder="email@contoso.com"
                        value={hitlEditEmail}
                        onChange={e => setHitlEditEmail(e.target.value)}
                      />
                    )}
                    <div className="flex gap-2 justify-end">
                      <CopilotButton variant="secondary" size="sm" onClick={cancelHitlEdit}>Cancel</CopilotButton>
                      <CopilotButton variant="primary" size="sm" onClick={() => saveHitlEdit(c.id)}>Save</CopilotButton>
                    </div>
                  </div>
                ) : (
                  /* View row */
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}
                    >
                      <span className="text-white font-semibold" style={{ fontSize: 11 }}>{getHitlInitials(c.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-2-strong text-gray-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.notifyVia === 'teams' ? (
                          <>
                            <img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 16, height: 16, flexShrink: 0 }} />
                            <span className="text-caption-1 truncate" style={{ color: '#5B5FC7' }}>
                              {c.email ? c.email.split('@')[0] : c.name.toLowerCase().replace(/\s+/g, '.')}
                            </span>
                          </>
                        ) : (
                          <>
                            <Mail20Regular style={{ width: 12, height: 12, color: '#6b7280', flexShrink: 0 }} />
                            <span className="text-caption-1 truncate" style={{ color: '#5B5FC7' }}>
                              {c.email ?? c.name.toLowerCase().replace(/\s+/g, '.') + '@contoso.com'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <CopilotButton
                      variant="ghost"
                      size="sm"
                      className="w-9 h-9 p-0 flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      title="More options"
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHitlContactMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        setHitlContactMenuId(c.id);
                      }}
                    >
                      <MoreHorizontal32Filled style={{ width: 28, height: 28 }} />
                    </CopilotButton>
                  </div>
                )}
              </div>
            ))}

            {/* Overflow menu for contact actions */}
            {hitlContactMenuId && (
              <CopilotMenu
                position={hitlContactMenuPos}
                onClose={() => setHitlContactMenuId(null)}
                items={[
                  { label: 'Edit', icon: <Edit20Regular style={{ width: 16, height: 16 }} />, onClick: () => { const c = (agentConfig.hitlContacts ?? []).find(x => x.id === hitlContactMenuId); if (c) startHitlEdit(c); setHitlContactMenuId(null); } },
                  { label: 'Delete', icon: <Delete20Regular style={{ width: 16, height: 16 }} />, destructive: true, dividerAbove: true, onClick: () => { removeHitlContact(hitlContactMenuId); setHitlContactMenuId(null); } },
                ]}
              />
            )}

            {/* Add contact form */}
            {hitlAddOpen ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 px-3 py-3 space-y-2 mt-1">
                {hitlAddPhase === 'search' ? (
                  <>
                    <p className="text-caption-1-strong text-gray-700">Add person</p>
                    <div className="relative">
                      <CopilotInput
                        size="sm"
                        placeholder="Search by name…"
                        value={hitlName}
                        onChange={e => setHitlName(e.target.value)}
                        autoFocus
                      />
                      {hitlName.trim().length > 0 && MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(hitlName.toLowerCase().trim())).length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                          {MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(hitlName.toLowerCase().trim())).map(d => (
                            <div key={d.name} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
                              onMouseDown={e => { e.preventDefault(); setHitlName(d.name); setHitlEmail(d.email ?? ''); setHitlAddPhase('channel'); }}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary)/0.12)' }}>
                                <span className="font-semibold" style={{ fontSize: 9, color: 'hsl(var(--primary))' }}>{getHitlInitials(d.name)}</span>
                              </div>
                              <span className="text-body-2 text-gray-900">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <CopilotButton variant="secondary" size="sm" onClick={cancelHitlAdd}>Cancel</CopilotButton>
                      <CopilotButton variant="primary" size="sm" onClick={advanceHitlToChannel} disabled={!hitlName.trim()}>Next</CopilotButton>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-caption-1-strong text-gray-700">Notify via</p>
                    <div className="flex items-center gap-2">
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setHitlNotifyVia('email')}
                        className={`gap-1.5 border text-caption-1 ${hitlNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <Mail20Regular style={{ width: 14, height: 14 }} />Email
                      </CopilotButton>
                      <CopilotButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setHitlNotifyVia('teams')}
                        className={`gap-1.5 border text-caption-1 ${hitlNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams
                      </CopilotButton>
                    </div>
                    {hitlNotifyVia === 'email' && (
                      <CopilotInput
                        size="sm"
                        placeholder="email@contoso.com"
                        value={hitlEmail}
                        onChange={e => setHitlEmail(e.target.value)}
                      />
                    )}
                    <div className="flex gap-2 justify-end">
                      <CopilotButton variant="secondary" size="sm" onClick={cancelHitlAdd}>Cancel</CopilotButton>
                      <CopilotButton variant="primary" size="sm" onClick={addHitlContact}>Add</CopilotButton>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <CopilotButton
                variant="secondary"
                size="sm"
                className="w-full mt-1"
                onClick={() => setHitlAddOpen(true)}
              >
                <Add20Regular style={{ width: 16, height: 16 }} />
                Add person
              </CopilotButton>
            )}

            {/* If no response — escalation section */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-caption-1-strong text-gray-700 mb-3">If no response</p>
              <div className="space-y-2" role="radiogroup" aria-label="If no response action">
                {([
                  { value: 'nothing', label: 'Do nothing', description: 'Keep waiting until someone responds' },
                  { value: 'reminder', label: 'Send a reminder', description: 'Ping the same contacts again' },
                  { value: 'escalate', label: 'Notify someone else', description: 'Escalate to a backup contact' },
                ] as const).map(opt => (
                  <div key={opt.value}>
                    <div
                      role="radio"
                      tabIndex={0}
                      aria-checked={hitlNoResponse === opt.value}
                      onClick={() => setHitlNoResponse(opt.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setHitlNoResponse(opt.value); } }}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition-colors ${hitlNoResponse === opt.value ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${hitlNoResponse === opt.value ? 'border-indigo-500' : 'border-gray-300'}`}>
                        {hitlNoResponse === opt.value && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      <div>
                        <p className="text-body-2-strong text-gray-900">{opt.label}</p>
                        <p className="text-caption-1 text-gray-400 mt-0.5">{opt.description}</p>
                      </div>
                    </div>

                    {/* Escalation contact picker — shown when "Notify someone else" is selected */}
                    {opt.value === 'escalate' && hitlNoResponse === 'escalate' && (
                      <div className="mt-2 space-y-2">
                        {/* Existing escalation contacts */}
                        {hitlEscalateContacts.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}>
                              <span className="text-white font-semibold" style={{ fontSize: 10 }}>{getHitlInitials(c.name)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-2-strong text-gray-900 truncate">{c.name}</p>
                              <p className="text-caption-1 text-gray-400 truncate">{c.notifyVia === 'teams' ? 'via Teams' : c.email ?? 'via Email'}</p>
                            </div>
                            <CopilotButton variant="ghost" size="sm" className="p-1 text-gray-400 hover:text-red-500" onClick={() => setHitlEscalateContacts(prev => prev.filter(x => x.id !== c.id))} title="Remove">
                              <Delete20Regular style={{ width: 14, height: 14 }} />
                            </CopilotButton>
                          </div>
                        ))}

                        {/* Add escalation contact form */}
                        {hitlEscalateAddOpen ? (
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 px-3 py-3 space-y-2">
                            {hitlEscalateAddPhase === 'search' ? (
                              <>
                                <div className="relative">
                                  <CopilotInput
                                    size="sm"
                                    placeholder="Search by name…"
                                    value={hitlEscalateName}
                                    onChange={e => setHitlEscalateName(e.target.value)}
                                    autoFocus
                                  />
                                  {hitlEscalateName.trim().length > 0 && MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(hitlEscalateName.toLowerCase().trim())).length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                      {MOCK_DIRECTORY.filter(d => d.name.toLowerCase().includes(hitlEscalateName.toLowerCase().trim())).map(d => (
                                        <div key={d.name} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5"
                                          onMouseDown={e => { e.preventDefault(); setHitlEscalateName(d.name); setHitlEscalateEmail(d.email ?? ''); setHitlEscalateAddPhase('channel'); }}>
                                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--primary)/0.12)' }}>
                                            <span className="font-semibold" style={{ fontSize: 9, color: 'hsl(var(--primary))' }}>{getHitlInitials(d.name)}</span>
                                          </div>
                                          <span className="text-body-2 text-gray-900">{d.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <CopilotButton variant="secondary" size="sm" onClick={() => { setHitlEscalateAddOpen(false); setHitlEscalateName(''); setHitlEscalateEmail(''); setHitlEscalateAddPhase('search'); }}>Cancel</CopilotButton>
                                  <CopilotButton variant="primary" size="sm" disabled={!hitlEscalateName.trim()} onClick={() => {
                                    const found = MOCK_DIRECTORY.find(d => d.name.toLowerCase() === hitlEscalateName.trim().toLowerCase());
                                    if (found) setHitlEscalateEmail(found.email);
                                    setHitlEscalateAddPhase('channel');
                                  }}>Next</CopilotButton>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-caption-1-strong text-gray-700">Notify via</p>
                                <div className="flex items-center gap-2">
                                  <CopilotButton variant="ghost" size="sm" onClick={() => setHitlEscalateNotifyVia('email')} className={`gap-1.5 border text-caption-1 ${hitlEscalateNotifyVia === 'email' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    <Mail20Regular style={{ width: 14, height: 14 }} />Email
                                  </CopilotButton>
                                  <CopilotButton variant="ghost" size="sm" onClick={() => setHitlEscalateNotifyVia('teams')} className={`gap-1.5 border text-caption-1 ${hitlEscalateNotifyVia === 'teams' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    <img src="/component-icons/Teams16.svg" alt="Teams" style={{ width: 14, height: 14 }} />Teams
                                  </CopilotButton>
                                </div>
                                {hitlEscalateNotifyVia === 'email' && (
                                  <CopilotInput size="sm" placeholder="email@contoso.com" value={hitlEscalateEmail} onChange={e => setHitlEscalateEmail(e.target.value)} />
                                )}
                                <div className="flex gap-2 justify-end">
                                  <CopilotButton variant="secondary" size="sm" onClick={() => { setHitlEscalateAddOpen(false); setHitlEscalateName(''); setHitlEscalateEmail(''); setHitlEscalateNotifyVia('email'); setHitlEscalateAddPhase('search'); }}>Cancel</CopilotButton>
                                  <CopilotButton variant="primary" size="sm" onClick={() => {
                                    if (!hitlEscalateName.trim()) return;
                                    setHitlEscalateContacts(prev => [...prev, { id: crypto.randomUUID(), name: hitlEscalateName.trim(), email: hitlEscalateEmail.trim() || undefined, notifyVia: hitlEscalateNotifyVia }]);
                                    setHitlEscalateName(''); setHitlEscalateEmail(''); setHitlEscalateNotifyVia('email'); setHitlEscalateAddOpen(false); setHitlEscalateAddPhase('search');
                                  }}>Add</CopilotButton>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            {hitlEscalateWarnVisible && (
                              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                                <span className="text-amber-500 flex-shrink-0 mt-0.5" style={{ fontSize: 14 }}>⚠</span>
                                <p className="text-caption-1 text-amber-700 leading-snug">
                                  Add a backup contact, or this will fall back to <strong>Do nothing</strong>.
                                </p>
                              </div>
                            )}
                            <CopilotButton
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => setHitlEscalateAddOpen(true)}
                            >
                              <Add20Regular style={{ width: 16, height: 16 }} />
                              Add backup contact
                            </CopilotButton>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Time window — only shown when an action is configured */}
              {(hitlNoResponse === 'reminder' || hitlNoResponse === 'escalate') && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-caption-1 text-gray-500 flex-shrink-0">After</span>
                  <CopilotDropdown
                    variant="dropdown"
                    size="sm"
                    value={hitlNoResponseDelay}
                    onChange={val => setHitlNoResponseDelay(val as typeof hitlNoResponseDelay)}
                    options={[
                      { label: '1 hour',   value: '1h' },
                      { label: '4 hours',  value: '4h' },
                      { label: '24 hours', value: '24h' },
                      { label: '48 hours', value: '48h' },
                      { label: '72 hours', value: '72h' },
                      { label: '1 week',   value: '1w' },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      ) : versionHistoryOpen ? (
        /* ── Version history drill-in detail view ── */
        <>
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0 flex items-center gap-2">
            <CopilotButton
              variant="ghost"
              size="sm"
              className="p-1 flex-shrink-0 text-gray-500 hover:text-gray-900"
              onClick={() => setVersionHistoryOpen(false)}
            >
              {panelChevronLeft}
            </CopilotButton>
            <h2 className="text-title-3 text-gray-900 flex-1">Version history</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {workflowVersionHistory.length >= 2 &&
              !workflowVersionHistory.some(v => v.source === 'publish' || v.source === 'auto') && (
              <CopilotButton
                variant="ghost"
                size="xs"
                className="text-[hsl(var(--primary))] px-0 mb-3 font-normal text-caption-1"
                onClick={seedExampleVersionHistory}
              >
                + Add example version types
              </CopilotButton>
            )}
            <VersionHistory emptyMessage="No saved versions yet. Click Save to create your first version.">
              {(() => {
                const sorted = [...workflowVersionHistory].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                const liveIdx = sorted.findIndex(v => v.source === 'publish');
                const effectiveLiveIdx = liveIdx === -1 ? 0 : liveIdx;
                return sorted.map((v, i) => (
                  <VersionHistoryItem
                    key={v.id}
                    versionLabel={fmtDateTime(new Date(v.createdAt) as unknown as Date)}
                    isCurrent={i === 0}
                    isLive={i === effectiveLiveIdx}
                    isDraft={liveIdx !== -1 && i < liveIdx}
                    isPreviousPublish={i > effectiveLiveIdx && v.source === 'publish'}
                    source={v.source ?? 'manual'}
                    description={v.description || undefined}
                    userInitials={currentInitials}
                    userName={v.userName || currentDisplayName}
                    changeCount={v.changeCount}
                    isLast={i === sorted.length - 1}
                    onRestore={i === 0 || i === effectiveLiveIdx ? undefined : () => { revertToVersion(v.id); setVersionHistoryOpen(false); }}
                  />
                ));
              })()}
            </VersionHistory>
          </div>
        </>
      ) : (
      /* ── Main overview content ── */
      <>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
        {isEditingHeader ? (
          /* ── Edit mode ── */
          <div>
            {/* Row 1: icon + name input */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="relative flex-shrink-0 cursor-pointer"
                onClick={() => setShowOverviewIconPicker(true)}
                title="Change icon"
              >
                <SquircleIcon size={32} cornerRadius={8} gradient={agentConfig.gradientKey ? getGradientByKey(agentConfig.gradientKey) : getUniqueGradientCSS(agentConfig.id)}>
                  {agentConfig.iconImageData
                    ? <img src={agentConfig.iconImageData} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
                    : getAgentIcon(agentConfig.iconKey || 'tpl:workflow', 20)}
                </SquircleIcon>
              </div>
              <CopilotInput
                ref={nameInputRef}
                value={nameInputValue}
                onChange={e => setNameInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') cancelHeader(); }}
                size="sm"
                autoFocus
                className="flex-1 min-w-0"
              />
            </div>
            {/* Row 2: actions */}
            <div className="flex justify-end gap-2">
              <CopilotButton variant="secondary" size="sm" onClick={cancelHeader}>Cancel</CopilotButton>
              <CopilotButton variant="primary" size="sm" onClick={saveHeader}>Save</CopilotButton>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0">
                <SquircleIcon size={32} cornerRadius={8} gradient={agentConfig.gradientKey ? getGradientByKey(agentConfig.gradientKey) : getUniqueGradientCSS(agentConfig.id)}>
                  {agentConfig.iconImageData
                    ? <img src={agentConfig.iconImageData} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
                    : getAgentIcon(agentConfig.iconKey || 'tpl:workflow', 20)}
                </SquircleIcon>
              </div>
              <div className="min-w-0">
                <h2 className="text-title-3 text-gray-900 leading-snug truncate">{agentConfig.name}</h2>
              </div>
            </div>
            <CopilotButton variant="ghost" size="sm" className="flex-shrink-0 text-gray-400 hover:text-gray-700 p-1 mt-0.5" onClick={startEditingHeader} title="Edit">
              <Edit20Regular style={{ width: 16, height: 16 }} />
            </CopilotButton>
          </div>
        )}
      </div>

      <IconPickerDialog
        isOpen={showOverviewIconPicker}
        onClose={() => setShowOverviewIconPicker(false)}
        currentIconKey={agentConfig.iconKey || 'tpl:workflow'}
        currentGradientKey={agentConfig.gradientKey || 'cerulean'}
        agentName={agentConfig.name}
        agentDescription={agentConfig.description}
        onSelect={(iconKey, gradientKey, imageData) => {
          const update = { iconKey, gradientKey, ...(imageData ? { iconImageData: imageData } : { iconImageData: null }) };
          isAgentGlobalUndo ? updateWithHistory(update) : updateAgentConfig(update);
          setShowOverviewIconPicker(false);
        }}
      />

      {/* Metadata */}
      <div className="px-5 py-4 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-caption-1 text-gray-500">Status</span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-caption-1-strong"
            style={agentConfig.published
              ? { backgroundColor: '#dcfce7', color: 'hsl(var(--status-success))' }
              : { backgroundColor: '#f3f4f6', color: 'hsl(var(--text-secondary))' }}
          >
            {agentConfig.published ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-caption-1 text-gray-500">Created</span>
          <span className="text-caption-1 text-gray-700">{fmtDate(agentConfig.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-caption-1 text-gray-500">Last modified</span>
          <span className="text-caption-1 text-gray-700">{fmtDateTime(agentConfig.lastPublishedAt || agentConfig.createdAt)}</span>
        </div>
        {agentConfig.published && agentConfig.lastPublishedAt && (
          <div className="flex items-center justify-between">
            <span className="text-caption-1 text-gray-500">Published</span>
            <span className="text-caption-1 text-gray-700">{fmtDateTime(agentConfig.lastPublishedAt)}</span>
          </div>
        )}
        {agentConfig.version && (
          <div className="flex items-center justify-between">
            <span className="text-caption-1 text-gray-500">Version</span>
            <span className="text-caption-1 text-gray-700">v{agentConfig.version}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-caption-1 text-gray-500">Steps</span>
          <span className="text-caption-1 text-gray-700">{workflowNodes.filter(n => n.type !== 'trigger').length}</span>
        </div>
      </div>

      <div className="mx-5 h-px bg-gray-100 flex-shrink-0" />

      {/* Human in the Loop — unified section */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <p className="text-title-3 text-gray-900 mb-3">Human review</p>

        {/* ── Workflow sub-section ── */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-body-2-strong text-foreground">Workflow</p>
            <button
              type="button"
              role="switch"
              aria-checked={agentConfig.hitlEnabled}
              onClick={() => updateAgentConfig({ hitlEnabled: !agentConfig.hitlEnabled })}
              className="relative inline-flex items-center rounded-full transition-colors flex-shrink-0 focus:outline-none"
              style={{ width: 32, height: 18, backgroundColor: agentConfig.hitlEnabled ? '#5B5FC7' : 'hsl(var(--stroke-default))' }}
              aria-label={agentConfig.hitlEnabled ? 'Disable human in the loop' : 'Enable human in the loop'}
            >
              <span className="inline-block rounded-full bg-white shadow transition-transform" style={{ width: 14, height: 14, transform: agentConfig.hitlEnabled ? 'translateX(15px)' : 'translateX(2px)' }} />
            </button>
          </div>
          <p className="text-body-2 text-gray-400 leading-relaxed mb-3">These people will be notified when there's a request or issue in any of the workflow steps.</p>

          {agentConfig.hitlEnabled && (
            <>
              {/* Who to notify — compact inline row */}
              <div className="w-full flex items-center justify-between py-1.5">
                <div className="flex items-center gap-0.5">
                  <p className="text-caption-1-strong text-gray-700">Who to notify</p>
                  <span className="text-red-500 text-caption-1-strong leading-none">*</span>
                </div>
                <div className="flex items-center gap-2">
                  {(agentConfig.hitlContacts ?? []).length > 0 ? (
                    <div className="flex items-center">
                      {(agentConfig.hitlContacts ?? []).slice(0, 3).map((c, i) => (
                        <div
                          key={c.id}
                          className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white flex-shrink-0"
                          style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length], marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}
                          title={c.name}
                        >
                          <span className="text-white font-semibold" style={{ fontSize: 10 }}>{getHitlInitials(c.name)}</span>
                        </div>
                      ))}
                      {(agentConfig.hitlContacts ?? []).length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white flex-shrink-0" style={{ marginLeft: -8 }}>
                          <span className="text-gray-600 font-semibold" style={{ fontSize: 10 }}>+{(agentConfig.hitlContacts ?? []).length - 3}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-caption-1 text-red-400">Required</span>
                  )}
                  <CopilotButton
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    title="Manage contacts"
                    onClick={() => setHitlWhoDetailOpen(true)}
                  >
                    {panelChevronRight}
                  </CopilotButton>
                </div>
              </div>

              {/* When to notify */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-caption-1-strong text-gray-700">When to notify</p>
                <CopilotDropdown
                  variant="dropdown"
                  size="sm"
                  value={hitlNotifyFrequency}
                  onChange={val => setHitlNotifyFrequency(val as 'immediately' | 'daily-recap')}
                  options={[
                    { label: 'Immediately', value: 'immediately', description: 'Send a notification each time an issue occurs' },
                    { label: 'Daily recap', value: 'daily-recap', description: 'Collect all issues and send one summary per day' },
                  ]}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Steps sub-section ── */}
        {(() => {
          const hitlSteps = workflowNodes.filter(n => n.hitlEnabled && (n.type === 'agent' || n.label === 'Computer Use' || n.config?.stepTypeLabel === 'Computer Use'));
          if (hitlSteps.length === 0) return null;
          return (
            <div className="pt-2">
              <p className="text-body-2-strong text-foreground mb-1">Steps that include human review</p>
              <p className="text-body-2 text-gray-400 leading-relaxed mb-3">Some prebuilt agents may not be editable by you.</p>
              <div className="space-y-2">
                {hitlSteps.map(n => {
                  const stepContacts = (n.hitlMode === 'custom' || (n.hitlContacts ?? []).length > 0) ? (n.hitlContacts ?? []) : (agentConfig.hitlContacts ?? []);
                  const displayName = n.config?.instanceName ?? n.label;
                  const typeLabel = n.config?.stepTypeLabel ?? n.label;
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNode(n)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNode(n); } }}
                      className="bg-white rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                      style={{ border: '1.5px solid hsl(var(--stroke-default))' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary))')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'hsl(var(--stroke-default))')}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-body-1" style={{ backgroundColor: '#f3f4f6' }}>
                          {getNodeIcon(n)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-2-strong text-gray-900 truncate leading-tight">{displayName}</p>
                          <p className="text-caption-1 text-gray-500 mt-0.5">{typeLabel}</p>
                        </div>
                        {stepContacts.length > 0 ? (
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {stepContacts.slice(0, 3).map((c, i) => (
                              <div key={c.id} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: HITL_COLORS[i % HITL_COLORS.length] }}>
                                <span className="text-white font-semibold" style={{ fontSize: 10 }}>{getHitlInitials(c.name)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-caption-1 text-gray-400 italic flex-shrink-0">No assignee</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Version Control */}
      <>
        <div className="mx-5 h-px bg-gray-100 flex-shrink-0" />
        <div className="px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-title-3 text-gray-900">Version control</p>
              <p className="text-caption-1 text-gray-400 mt-0.5">
                {workflowVersionHistory.length > 0
                  ? `${workflowVersionHistory.length} version${workflowVersionHistory.length !== 1 ? 's' : ''} saved · Latest ${fmtDateTime(new Date(workflowVersionHistory[0].createdAt) as unknown as Date)}`
                  : 'No versions saved yet'}
              </p>
            </div>
            <CopilotButton
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              title="View version history"
              onClick={() => setVersionHistoryOpen(true)}
            >
              {panelChevronRight}
            </CopilotButton>
          </div>
        </div>
      </>
      </>
    )}
    </div>
  );


  return <>{v2OverviewPanel}</>;
};
