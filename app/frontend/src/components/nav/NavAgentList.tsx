import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AgentConfig } from '../../types';
import {
  MoreHorizontal20Regular, MoreHorizontal20Filled,
  MoreHorizontal24Regular, MoreHorizontal24Filled,
  ArrowUpload20Regular, ArrowUpload20Filled,
  ArrowSync20Regular, ArrowSync20Filled,
  Share20Regular, Share20Filled,
  PinOff20Regular, PinOff20Filled,
  Delete20Regular, Delete20Filled,
} from '@fluentui/react-icons';
import { CopilotTooltip } from '../ui/CopilotTooltip';
import { CopilotMenu } from '../ui/CopilotMenu';
import { SquircleIcon } from '../ui/SquircleIcon';
import { AgentIcon } from '../ui/AgentIcon';
import { DeleteConfirmDialog } from '../ui/DeleteConfirmDialog';
import { PublishConfirmDialog } from '../ui/PublishConfirmDialog';
import { UpdateConfirmDialog } from '../ui/UpdateConfirmDialog';
import { ShareDialog } from '../ui/ShareDialog';
import { greyGradient } from '../../utils/agentIcons';
import { navBtnBase, navBtnActive, navBtnInactive, iconContainerClass, textFadeIn, textFadeOut } from './NavConstants';
import { useFlipAnimation } from './useFlipAnimation';
import { useAgentDrag } from './useAgentDrag';

export interface NavAgentListProps {
  agents: AgentConfig[];
  currentAgentId: string | null;
  isHomePage: boolean;
  isOnAgentPage: boolean;
  effectiveExpanded: boolean;
  isL1NavJuneProposal: boolean;
  isInConversationMode: boolean;
  pendingAgentData?: any | null;
  showPendingAgent: boolean;
  visibleAgentsCount: number;
  navigate: (path: string) => void;
  setIsInConversationMode: (mode: boolean) => void;
  setPendingAgentData: (data: any) => void;
  switchAgent: (id: string) => void;
  setIsClickExpanded: (val: boolean) => void;
  setIsNavExpanded: (val: boolean) => void;
  reorderNavAgents: (ids: string[]) => void;
  updateSpecificAgent: (id: string, patch: Partial<AgentConfig>) => void;
  deleteAgent: (id: string) => void;
  isShareCoauthoring: boolean;
}

const incrementVersion = (v?: string): string => {
  if (!v) return '1.0';
  const parts = v.split('.').map(Number);
  return `${parts[0]}.${(parts[1] ?? 0) + 1}`;
};

export const NavAgentList: React.FC<NavAgentListProps> = ({
  agents, currentAgentId, isHomePage, isOnAgentPage,
  effectiveExpanded, isL1NavJuneProposal,
  isInConversationMode, pendingAgentData, showPendingAgent,
  visibleAgentsCount, navigate,
  setIsInConversationMode, setPendingAgentData,
  switchAgent, setIsClickExpanded, setIsNavExpanded,
  reorderNavAgents, updateSpecificAgent, deleteAgent,
  isShareCoauthoring,
}) => {
  const location = useLocation();
  const agentListRef = useRef<HTMLDivElement>(null);
  const visibleAgentIdsRef = useRef<string[]>([]);

  const { sortedAgents, recordAgentOpened, agentItemRefs } = useFlipAnimation(agents);
  const { draggingId, dragY, makeDragHandlers, getTranslateY, isSuppressingClick, clearSuppressClick } =
    useAgentDrag({ agentListRef, onReorder: reorderNavAgents, visibleAgentIdsRef });

  // Overflow menu (legacy mode)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [overflowMenuPos, setOverflowMenuPos] = useState<{ bottom: number; left: number; maxHeight: number } | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inButton = overflowMenuRef.current && overflowMenuRef.current.contains(target);
      const menuEl = document.querySelector('[data-overflow-menu]');
      const inMenu = menuEl && menuEl.contains(target);
      if (!inButton && !inMenu) setOverflowMenuOpen(false);
    };
    if (overflowMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [overflowMenuOpen]);

  // Per-agent ellipsis menu
  const [agentMenuId, setAgentMenuId] = useState<string | null>(null);
  const [agentMenuPos, setAgentMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Agent action dialogs
  const [deleteDialogItem, setDeleteDialogItem] = useState<{ id: string; name: string; type: 'agent' | 'workflow' } | null>(null);
  const [shareItem, setShareItem] = useState<AgentConfig | null>(null);
  const [publishItem, setPublishItem] = useState<AgentConfig | null>(null);
  const [updateItem, setUpdateItem] = useState<AgentConfig | null>(null);
  const agentActionAnchorRef = useRef<HTMLDivElement>(null);
  const [agentActionAnchorPos, setAgentActionAnchorPos] = useState<{ top: number; right: number } | null>(null);

  const handlePublishConfirm = (selectedChannel?: string) => {
    if (!publishItem) return;
    const agentId = publishItem.id;
    setPublishItem(null);
    setTimeout(() => updateSpecificAgent(agentId, { published: true, version: '1.0', lastPublishedAt: new Date(), createdAt: new Date(), channel: selectedChannel }), 2500);
  };

  const handleUpdateConfirm = () => {
    if (!updateItem) return;
    const agentId = updateItem.id;
    const newVersion = incrementVersion(updateItem.version);
    setUpdateItem(null);
    setTimeout(() => updateSpecificAgent(agentId, { version: newVersion, lastPublishedAt: new Date(), createdAt: new Date() }), 2500);
  };

  const handleUnpublish = () => {
    if (!updateItem) return;
    const agentId = updateItem.id;
    setUpdateItem(null);
    setTimeout(() => updateSpecificAgent(agentId, { published: false, version: '1.0', lastPublishedAt: undefined, createdAt: new Date() }), 3000);
  };

  const isNonAgentPage = (path: string) =>
    ['/components', '/mystuff', '/discover', '/flows', '/tools'].includes(path);

  const isAgentActive = (id: string) => !isHomePage && !isNonAgentPage(location.pathname) && id === currentAgentId;

  const handleAgentClick = (agentId: string, isL1: boolean) => {
    if (isSuppressingClick()) { clearSuppressClick(); return; }
    if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); }
    if (isL1) { recordAgentOpened(agentId); setIsClickExpanded(false); setIsNavExpanded(false); }
    switchAgent(agentId);
    navigate('/spec');
  };

  const renderEllipsisBtn = (agent: AgentConfig) => (
    <div className="w-6 h-6 mr-1 flex-shrink-0">
      {!draggingId && (
        <button
          onClick={(e) => { e.stopPropagation(); if (agentMenuId === agent.id) { setAgentMenuId(null); setAgentMenuPos(null); } else { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setAgentMenuPos({ top: rect.bottom + 4, left: rect.left }); setAgentMenuId(agent.id); } }}
          className={`group/ellipsis cursor-pointer p-1 rounded text-gray-600 hover:text-brand transition-colors ${agentMenuId === agent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          title="More options"
        >
          <span className="relative flex items-center justify-center w-4 h-4">
            <span className="absolute inset-0 flex items-center justify-center group-hover/ellipsis:opacity-0 transition-opacity"><MoreHorizontal20Regular className="w-4 h-4" /></span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ellipsis:opacity-100 transition-opacity"><MoreHorizontal20Filled className="w-4 h-4" /></span>
          </span>
        </button>
      )}
    </div>
  );

  const pendingItem = showPendingAgent && (
    <div className="animate-fadeIn">
      <CopilotTooltip content={pendingAgentData?.name || 'New project'} placement="right" disabled={effectiveExpanded}>
        <button className={`${navBtnBase} ${navBtnActive}`} disabled>
          <div className={iconContainerClass}>
            {pendingAgentData ? (
              <AgentIcon agent={{ ...pendingAgentData, iconKey: (pendingAgentData as any).iconKey || (pendingAgentData.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={24} />
            ) : (
              <SquircleIcon size={24} cornerRadius={6} gradient={greyGradient.css}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
              </SquircleIcon>
            )}
          </div>
          <span className={`text-sm truncate whitespace-nowrap pr-3 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>{pendingAgentData?.name || 'New project'}</span>
        </button>
      </CopilotTooltip>
    </div>
  );

  if (!agents.length && !isInConversationMode) return null;

  return (
    <>
      {/* Dialogs */}
      <div ref={agentActionAnchorRef} className="fixed pointer-events-none" style={{ top: agentActionAnchorPos ? `${agentActionAnchorPos.top}px` : 0, right: agentActionAnchorPos ? `${agentActionAnchorPos.right}px` : 0, width: 1, height: 1 }} />
      <DeleteConfirmDialog isOpen={deleteDialogItem !== null} onClose={() => setDeleteDialogItem(null)} onConfirm={() => { if (deleteDialogItem) deleteAgent(deleteDialogItem.id); }} itemName={deleteDialogItem?.name} itemType={deleteDialogItem?.type || 'agent'} />
      <PublishConfirmDialog isOpen={publishItem !== null} onClose={() => setPublishItem(null)} onConfirm={handlePublishConfirm} agentName={publishItem?.name || ''} agentType={publishItem?.type === 'workflow' ? 'workflow' : 'agent'} channel={publishItem?.channel} buttonRef={agentActionAnchorRef} />
      <UpdateConfirmDialog isOpen={updateItem !== null} onClose={() => setUpdateItem(null)} onConfirm={handleUpdateConfirm} onUnpublish={handleUnpublish} agentName={updateItem?.name || ''} agentType={updateItem?.type === 'workflow' ? 'workflow' : 'agent'} currentVersion={updateItem?.version || '1.0'} newVersion={incrementVersion(updateItem?.version)} lastPublishedAt={updateItem?.lastPublishedAt} channel={updateItem?.channel} buttonRef={agentActionAnchorRef} />
      {isShareCoauthoring && <ShareDialog isOpen={shareItem !== null} onClose={() => setShareItem(null)} agentName={shareItem?.name || ''} shareUrl={shareItem ? `${window.location.origin}/agent/${shareItem.id}` : ''} buttonRef={agentActionAnchorRef} />}

      {isL1NavJuneProposal ? (
        effectiveExpanded ? (
          /* L1 EXPANDED */
          <>
            <div className="border-t border-[hsl(var(--stroke-default))] my-2 mx-2" />
            <div className="px-4 pt-1 pb-2 text-xs font-medium text-gray-500">Recents</div>
            <div ref={agentListRef} className="overflow-y-auto max-h-[416px]">
              {(() => {
                const visibleAgents = sortedAgents.slice(0, 8);
                visibleAgentIdsRef.current = visibleAgents.map(a => a.id);
                const draggingIdx = draggingId ? visibleAgents.findIndex(a => a.id === draggingId) : -1;
                return visibleAgents.map((agent, index) => {
                  const isActive = isAgentActive(agent.id);
                  const isDragging = agent.id === draggingId;
                  return (
                    <div key={agent.id} ref={el => { if (el) agentItemRefs.current.set(agent.id, el); else agentItemRefs.current.delete(agent.id); }}>
                      <CopilotTooltip content={agent.name} placement="right" disabled={effectiveExpanded || !!draggingId}>
                        <div
                          data-drag-id={agent.id}
                          onClick={() => handleAgentClick(agent.id, true)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAgentClick(agent.id, true); } }}
                          {...makeDragHandlers(agent.id, index)}
                          role="button" tabIndex={0}
                          style={{ opacity: isDragging ? 0 : 1, transform: `translateY(${getTranslateY(index, draggingIdx)}px)`, transition: draggingId ? 'transform 0.15s ease' : undefined, position: 'relative', zIndex: isDragging ? 0 : 1 }}
                          className={`${navBtnBase} cursor-pointer ${isActive ? navBtnActive : navBtnInactive} ${draggingId ? 'pointer-events-none' : ''}`}
                        >
                          <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${isActive || agentMenuId === agent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                          <div className={iconContainerClass}><AgentIcon agent={{ ...agent, iconKey: agent.iconKey || (agent.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={24} /></div>
                          <span className={`text-sm truncate whitespace-nowrap min-w-0 flex-1 ${textFadeIn}`}>{agent.name}</span>
                          {renderEllipsisBtn(agent)}
                        </div>
                      </CopilotTooltip>
                    </div>
                  );
                });
              })()}
              {pendingItem}
              {sortedAgents.length > 8 && (
                <button onClick={() => navigate('/mystuff')} className="flex items-center gap-1.5 w-[calc(100%-16px)] mx-2 px-4 pt-1 pb-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <MoreHorizontal20Regular className="w-3.5 h-3.5 flex-shrink-0" /> Show all
                </button>
              )}
            </div>
          </>
        ) : (
          /* L1 COLLAPSED: active agent only */
          isOnAgentPage && currentAgentId ? (() => {
            const activeAgent = agents.find(a => a.id === currentAgentId);
            if (!activeAgent) return null;
            return (
              <>
                <div className="border-t border-[hsl(var(--stroke-default))] my-2 mx-2" />
                <CopilotTooltip content={activeAgent.name} placement="right" disabled={false}>
                  <div className={`${navBtnBase} ${navBtnActive} cursor-default`} role="button" tabIndex={0}>
                    <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full opacity-100" />
                    <div className={iconContainerClass}><AgentIcon agent={{ ...activeAgent, iconKey: activeAgent.iconKey || (activeAgent.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={24} /></div>
                  </div>
                </CopilotTooltip>
              </>
            );
          })() : null
        )
      ) : (
        /* LEGACY: full list with overflow */
        <>
          <div className="border-t border-[hsl(var(--stroke-default))] my-2 mx-2" />
          <div ref={agentListRef}>
            {(() => {
              const visibleAgents = agents.slice(0, visibleAgentsCount);
              visibleAgentIdsRef.current = visibleAgents.map(a => a.id);
              const draggingIdx = draggingId ? visibleAgents.findIndex(a => a.id === draggingId) : -1;
              return visibleAgents.map((agent, index) => {
                const isActive = isAgentActive(agent.id);
                const isDragging = agent.id === draggingId;
                return (
                  <React.Fragment key={agent.id}>
                    <CopilotTooltip content={agent.name} placement="right" disabled={effectiveExpanded || !!draggingId}>
                      <div
                        data-drag-id={agent.id}
                        onClick={() => handleAgentClick(agent.id, false)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAgentClick(agent.id, false); } }}
                        {...makeDragHandlers(agent.id, index)}
                        role="button" tabIndex={0}
                        style={{ opacity: isDragging ? 0 : 1, transform: `translateY(${getTranslateY(index, draggingIdx)}px)`, transition: draggingId ? 'transform 0.15s ease' : undefined, position: 'relative', zIndex: isDragging ? 0 : 1 }}
                        className={`${navBtnBase} cursor-pointer ${isActive ? navBtnActive : navBtnInactive} ${draggingId ? 'pointer-events-none' : ''}`}
                      >
                        <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[hsl(var(--primary))] rounded-full transition-opacity ${isActive || agentMenuId === agent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        <div className={iconContainerClass}><AgentIcon agent={{ ...agent, iconKey: agent.iconKey || (agent.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={24} /></div>
                        <span className={`text-sm truncate whitespace-nowrap min-w-0 flex-1 ${effectiveExpanded ? textFadeIn : textFadeOut}`}>{agent.name}</span>
                        {effectiveExpanded && renderEllipsisBtn(agent)}
                      </div>
                    </CopilotTooltip>
                  </React.Fragment>
                );
              });
            })()}
            {pendingItem}
            {agents.length > visibleAgentsCount && (
              <div ref={overflowMenuRef}>
                <CopilotTooltip content={`${agents.length - visibleAgentsCount} more agents`} placement="right" disabled={effectiveExpanded || overflowMenuOpen}>
                  <button
                    ref={overflowBtnRef}
                    onClick={() => { if (!overflowMenuOpen && overflowBtnRef.current) { const rect = overflowBtnRef.current.getBoundingClientRect(); setOverflowMenuPos({ bottom: window.innerHeight - rect.bottom, left: rect.left + 56, maxHeight: rect.bottom - 16 }); } setOverflowMenuOpen(!overflowMenuOpen); }}
                    className={`${navBtnBase} ${navBtnInactive}`}
                  >
                    <div className={iconContainerClass}>
                      {overflowMenuOpen ? <MoreHorizontal24Filled className="w-6 h-6" primaryFill="url(#nav-icon-gradient)" /> : (
                        <div className="relative flex items-center justify-center">
                          <MoreHorizontal24Regular className="w-6 h-6 transition-opacity group-hover:opacity-0 text-gray-600" />
                          <MoreHorizontal24Filled className="absolute opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" primaryFill="url(#nav-icon-gradient)" />
                        </div>
                      )}
                    </div>
                  </button>
                </CopilotTooltip>
                {overflowMenuOpen && overflowMenuPos && (
                  <div data-overflow-menu className="fixed bg-white border border-gray-200 rounded-lg py-1 z-50 overflow-y-auto" style={{ bottom: overflowMenuPos.bottom, left: overflowMenuPos.left, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: '200px', maxHeight: overflowMenuPos.maxHeight }}>
                    {agents.slice(visibleAgentsCount).map(agent => {
                      return (
                        <button key={agent.id} onClick={() => { if (isInConversationMode) { setIsInConversationMode(false); setPendingAgentData(null); } switchAgent(agent.id); navigate('/spec'); setOverflowMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                          <AgentIcon agent={{ ...agent, iconKey: agent.iconKey || (agent.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={20} />
                          <span className="truncate flex-1">{agent.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Per-agent ellipsis menu */}
      {agentMenuId && agentMenuPos && (() => {
        const menuAgent = agents.find(a => a.id === agentMenuId);
        return (
          <CopilotMenu
            items={[
              { label: menuAgent?.published ? 'Update' : 'Publish', icon: menuAgent?.published ? <ArrowSync20Regular className="w-4 h-4" /> : <ArrowUpload20Regular className="w-4 h-4" />, iconFilled: menuAgent?.published ? <ArrowSync20Filled className="w-4 h-4" /> : <ArrowUpload20Filled className="w-4 h-4" />, onClick: () => { setAgentActionAnchorPos({ top: agentMenuPos.top, right: window.innerWidth - agentMenuPos.left }); if (menuAgent?.published) setUpdateItem(menuAgent); else if (menuAgent) setPublishItem(menuAgent); } },
              ...(isShareCoauthoring ? [{ label: 'Share', icon: <Share20Regular className="w-4 h-4" />, iconFilled: <Share20Filled className="w-4 h-4" />, onClick: () => { setAgentActionAnchorPos({ top: agentMenuPos.top, right: window.innerWidth - agentMenuPos.left }); if (menuAgent) setShareItem(menuAgent); } }] : []),
              { label: 'Unpin', icon: <PinOff20Regular className="w-4 h-4" />, iconFilled: <PinOff20Filled className="w-4 h-4" />, onClick: () => updateSpecificAgent(agentMenuId, { pinned: false }) },
              { label: 'Delete', icon: <Delete20Regular className="w-4 h-4" />, iconFilled: <Delete20Filled className="w-4 h-4" />, onClick: () => { if (menuAgent) setDeleteDialogItem({ id: menuAgent.id, name: menuAgent.name, type: menuAgent.type === 'workflow' ? 'workflow' : 'agent' }); }, destructive: true, dividerAbove: true },
            ]}
            position={{ top: agentMenuPos.top, left: agentMenuPos.left }}
            onClose={() => { setAgentMenuId(null); setAgentMenuPos(null); }}
          />
        );
      })()}

      {/* Drag ghost */}
      {draggingId && (() => {
        const dragAgent = agents.find(a => a.id === draggingId);
        if (!dragAgent) return null;
        return (
          <div className="fixed pointer-events-none z-50 rounded-lg border border-blue-300 bg-white" style={{ top: dragY - 22, left: 8, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', opacity: 0.95 }}>
            <div className="flex items-center py-2">
              <div className={iconContainerClass}><AgentIcon agent={{ ...dragAgent, iconKey: dragAgent.iconKey || (dragAgent.type === 'workflow' ? 'tpl:workflow' : undefined) }} size={24} /></div>
              <span className="text-sm truncate whitespace-nowrap min-w-0 flex-1 text-gray-900 pr-3">{dragAgent.name}</span>
            </div>
          </div>
        );
      })()}
    </>
  );
};
