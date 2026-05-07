import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../context/AgentContext';
import type { BuildGuideProject } from '../context/AgentContext';
import { CopilotButton, CopilotTable, TableColumn, CopilotTooltip, CopilotMenu, CopilotFilterPill, DeleteConfirmDialog, PublishConfirmDialog, UpdateConfirmDialog, ShareDialog, StatusIcon, CopilotBadge } from '../components/ui';
import { SquircleIcon } from '../components/ui/SquircleIcon';
import { AgentIcon } from '../components/ui/AgentIcon';
import { AgentConfig } from '../types';
import { detectAgentDomain, getAgentIcon, getUniqueGradientCSS, getGradientByKey } from '../utils/agentIcons';
import { MoreHorizontal20Regular, MoreHorizontal20Filled, Delete20Regular, Delete20Filled, Share20Regular, Share20Filled, ArrowUpload20Regular, ArrowUpload20Filled, ArrowSync20Regular, ArrowSync20Filled, Agents20Filled, Flow20Filled, Globe20Regular, Pin20Regular, Pin20Filled, PinOff20Regular, PinOff20Filled, Dismiss16Regular, LockClosed20Regular } from '@fluentui/react-icons';
import { M365Icon, SlackIcon, SharePointIcon } from '../components/ui/ChannelIcons';
import { DigitalWorkerIcon } from '../assets/icons/digital-worker';
import { normalizeChannelName } from '../utils/localIntentClassification';
import { usePublish } from '../hooks/usePublish';

type FilterType = 'all' | 'agents' | 'workflow';
type ProjectFilter = 'all' | string; // 'all' or a project ID

export const MyStuffPage: React.FC = () => {
  const navigate = useNavigate();
  const { agents, switchAgent, createAgent, deleteAgent, updateSpecificAgent, userName, isShareCoauthoring, buildGuideProjects, buildGuideProjectsLoading } = useAgent();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');

  // ── Focus Mode — persistent project filter ──
  // Reads from URL param first (?focus=projectId), then localStorage.
  const [focusProjectId, setFocusProjectIdState] = useState<string | null>(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      const fp = params.get('focus');
      if (fp) return fp;
    }
    return localStorage.getItem('mystuff-focus-project');
  });

  const setFocusProjectId = (id: string | null) => {
    setFocusProjectIdState(id);
    if (id) {
      localStorage.setItem('mystuff-focus-project', id);
    } else {
      localStorage.removeItem('mystuff-focus-project');
    }
    // Update URL param without reload
    const hashPath = window.location.hash.split('?')[0] || '#/mystuff';
    if (id) {
      window.history.replaceState(null, '', window.location.pathname + hashPath + '?focus=' + encodeURIComponent(id));
    } else {
      window.history.replaceState(null, '', window.location.pathname + hashPath);
    }
  };

  const focusProject = useMemo(
    () => focusProjectId ? buildGuideProjects.find(p => p.id === focusProjectId) : null,
    [focusProjectId, buildGuideProjects]
  );
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const [actionsDropdownId, setActionsDropdownId] = useState<string | null>(null);
  const [actionsDropdownPos, setActionsDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [deleteDialogItem, setDeleteDialogItem] = useState<{ id: string; name: string; type: 'agent' | 'workflow' } | null>(null);
  // Share dialog state
  const [shareItem, setShareItem] = useState<AgentConfig | null>(null);

  // Publish / Update dialog state
  const [publishItem, setPublishItem] = useState<AgentConfig | null>(null);
  const [updateItem, setUpdateItem] = useState<AgentConfig | null>(null);
  // Per-agent publishing state: maps agent ID to action type
  const [publishingAgents, setPublishingAgents] = useState<Record<string, 'publishing' | 'unpublishing' | 'updating'>>({});
  const publishButtonRef = useRef<HTMLDivElement>(null);
  const [publishAnchorPos, setPublishAnchorPos] = useState<{ top: number; right: number } | null>(null);

  const incrementVersion = (currentVersion?: string): string => {
    if (!currentVersion) return '1.0';
    const parts = currentVersion.split('.');
    const minor = parseInt(parts[1] || '0');
    return `${parts[0]}.${minor + 1}`;
  };

  // ── Real MCS build via pipeline (spec-backed agents) ──
  const publish = usePublish();

  const handlePublishConfirm = (selectedChannel?: string) => {
    if (!publishItem) return;

    // Spec-backed agents → real MCS build pipeline (progress streams to notification area)
    if (publishItem.projectId && publishItem.specAgentId) {
      if (selectedChannel) updateSpecificAgent(publishItem.id, { channel: selectedChannel });
      publish.startPublish(publishItem);
      setPublishItem(null); // Close dialog — progress shows in notification area
      return;
    }

    // Local-only agents → simulated publish (no MCS)
    const agentId = publishItem.id;
    setPublishingAgents(prev => ({ ...prev, [agentId]: 'publishing' }));
    setPublishItem(null);
    setTimeout(() => {
      updateSpecificAgent(agentId, {
        published: true,
        version: '1.0',
        lastPublishedAt: new Date(),
        createdAt: new Date(),
        channel: selectedChannel,
      });
      setPublishingAgents(prev => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 2500);
  };

  const handleUpdateConfirm = (changeNotes?: string) => {
    if (!updateItem) return;
    const agentId = updateItem.id;
    const newVersion = incrementVersion(updateItem.version);
    setPublishingAgents(prev => ({ ...prev, [agentId]: 'updating' }));
    setUpdateItem(null);
    setTimeout(() => {
      updateSpecificAgent(agentId, {
        version: newVersion,
        lastPublishedAt: new Date(),
        createdAt: new Date(),
      });
      setPublishingAgents(prev => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 2500);
  };

  const handleUnpublish = () => {
    if (!updateItem) return;
    const agentId = updateItem.id;
    setPublishingAgents(prev => ({ ...prev, [agentId]: 'unpublishing' }));
    setUpdateItem(null);
    setTimeout(() => {
      updateSpecificAgent(agentId, {
        published: false,
        version: '1.0',
        lastPublishedAt: undefined,
        createdAt: new Date(),
      });
      setPublishingAgents(prev => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 3000);
  };

  // Close create dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setCreateDropdownOpen(false);
      }
    };
    if (createDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [createDropdownOpen]);

  // Format agent type for display
  const getAgentTypeLabel = (agent: AgentConfig): string => {
    if (agent.type === 'workflow') {
      return 'Workflow';
    }
    if (agent.agentType === 'DW') {
      return 'AI Teammate';
    }
    if (agent.audience === 'employees') {
      return 'Agent for employees';
    }
    if (agent.audience === 'customers') {
      return 'Agent for customers';
    }
    return 'Agent';
  };

  // Get filter type from agent
  const getAgentFilterType = (agent: AgentConfig): FilterType => {
    if (agent.type === 'workflow') return 'workflow';
    return 'agents';
  };

  // Build a project lookup: agent ID or specAgentId → project
  const projectByAgentId = useMemo(() => {
    const map = new Map<string, BuildGuideProject>();
    for (const p of buildGuideProjects) {
      for (const a of p.agents) {
        map.set(a.id, p);
      }
    }
    // Also index by client-side projectId field
    for (const a of agents) {
      if (a.projectId) {
        const p = buildGuideProjects.find(bp => bp.id === a.projectId);
        if (p) map.set(a.id, p);
      }
    }
    return map;
  }, [buildGuideProjects, agents]);

  // Merge project agents into the table: inject BuildGuideProject agents
  // that aren't already represented by a client-side AgentConfig.
  // Dedup by specAgentId+projectId match AND by name similarity to avoid duplicates.
  const mergedAgents = useMemo(() => {
    const clientSpecKeys = new Set(
      agents.filter(a => a.specAgentId && a.projectId).map(a => `${a.projectId}/${a.specAgentId}`)
    );
    // Also track by normalized name+projectId for agents created from the canvas
    const clientNameKeys = new Set(
      agents.filter(a => a.projectId).map(a => `${a.projectId}/${a.name.toLowerCase().trim()}`)
    );
    // And just by name for any client agent that matches a server agent name
    const clientNames = new Set(agents.map(a => a.name.toLowerCase().trim()));

    const injected: AgentConfig[] = [];
    for (const p of buildGuideProjects) {
      for (const ba of p.agents) {
        const specKey = `${p.id}/${ba.id}`;
        const nameKey = `${p.id}/${ba.name.toLowerCase().trim()}`;
        if (clientSpecKeys.has(specKey) || clientNameKeys.has(nameKey) || clientNames.has(ba.name.toLowerCase().trim())) {
          continue; // Already represented client-side
        }
        injected.push({
          id: `bg-${p.id}-${ba.id}`,
          name: ba.name,
          description: ba.description || '',
          type: 'agent',
          purpose: '',
          instructions: '',
          guidelines: [],
          skills: [],
          model: 'sonnet-4.5',
          knowledge: { files: [], webSearch: false, specificSources: false, referenceOrgChart: false, customAPIs: [] },
          published: false,
          createdAt: new Date(p.createdAt),
          projectId: p.id,
          specAgentId: ba.id,
        } as AgentConfig);
      }
    }
    return [...agents, ...injected];
  }, [agents, buildGuideProjects]);

  // Filter agents based on type filter + project filter + focus mode
  const filteredAgents = useMemo(() => {
    let result = mergedAgents;
    if (activeFilter !== 'all') {
      result = result.filter(agent => getAgentFilterType(agent) === activeFilter);
    }
    // Focus mode takes priority — only show the focused project's agents
    const effectiveProject = focusProjectId || (projectFilter !== 'all' ? projectFilter : null);
    if (effectiveProject) {
      result = result.filter(agent => {
        const project = projectByAgentId.get(agent.specAgentId || agent.id) || (agent.projectId ? buildGuideProjects.find(p => p.id === agent.projectId) : undefined);
        return project?.id === effectiveProject;
      });
    }
    return result;
  }, [mergedAgents, activeFilter, projectFilter, focusProjectId, projectByAgentId, buildGuideProjects]);

  // Format date for display
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Table columns — order: Name, Project, Type, Status, Created by, Last modified, Channel
  const columns: TableColumn<AgentConfig>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_value, row) => {
        const isDropdownOpen = actionsDropdownId === row.id;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <AgentIcon agent={row} size={32} />
            <span className="font-medium text-[hsl(var(--text-primary))] truncate">{row.name}</span>
            <div className="flex items-center gap-0.5 ml-auto flex-shrink-0 row-actions">
              <CopilotTooltip content={row.pinned === false ? 'Pin to nav' : 'Unpin from nav'} placement="bottom">
                <CopilotButton
                  variant="icon"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSpecificAgent(row.id, { pinned: row.pinned === false ? true : false });
                  }}
                  className={`cursor-pointer p-1.5 ${
                    isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="relative flex items-center justify-center w-5 h-5">
                    {row.pinned === false ? (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><Pin20Regular className="w-5 h-5" /></span>
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><Pin20Filled className="w-5 h-5" /></span>
                      </>
                    ) : (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><PinOff20Regular className="w-5 h-5" /></span>
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><PinOff20Filled className="w-5 h-5" /></span>
                      </>
                    )}
                  </span>
                </CopilotButton>
              </CopilotTooltip>
              {row.published && isShareCoauthoring && (
                <CopilotTooltip content="Share" placement="bottom">
                  <CopilotButton
                    variant="icon"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPublishAnchorPos({ top: btnRect.bottom, right: window.innerWidth - btnRect.right });
                      setShareItem(row);
                    }}
                    className={`cursor-pointer p-1.5 ${
                      isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <span className="relative flex items-center justify-center w-5 h-5">
                      <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><Share20Regular className="w-5 h-5" /></span>
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><Share20Filled className="w-5 h-5" /></span>
                    </span>
                  </CopilotButton>
                </CopilotTooltip>
              )}
              <CopilotTooltip content={row.published ? 'Update' : 'Publish'} placement="bottom">
                <CopilotButton
                  variant="icon"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setPublishAnchorPos({ top: btnRect.bottom, right: window.innerWidth - btnRect.right });
                    if (row.published) {
                      setUpdateItem(row);
                    } else {
                      setPublishItem(row);
                    }
                  }}
                  className={`cursor-pointer p-1.5 ${
                    isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="relative flex items-center justify-center w-5 h-5">
                    {row.published ? (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><ArrowSync20Regular className="w-5 h-5" /></span>
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><ArrowSync20Filled className="w-5 h-5" /></span>
                      </>
                    ) : (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><ArrowUpload20Regular className="w-5 h-5" /></span>
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><ArrowUpload20Filled className="w-5 h-5" /></span>
                      </>
                    )}
                  </span>
                </CopilotButton>
              </CopilotTooltip>
              <CopilotTooltip content="Delete" placement="bottom">
                <CopilotButton
                  variant="icon"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogItem({
                      id: row.id,
                      name: row.name,
                      type: row.type === 'agent' ? 'agent' : 'workflow'
                    });
                  }}
                  className={`cursor-pointer p-1.5 hover:text-red-600 ${
                    isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="relative flex items-center justify-center w-5 h-5">
                    <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><Delete20Regular className="w-5 h-5" /></span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><Delete20Filled className="w-5 h-5" /></span>
                  </span>
                </CopilotButton>
              </CopilotTooltip>
              <CopilotTooltip content="More options" placement="bottom">
                <CopilotButton
                  variant="icon"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (actionsDropdownId === row.id) {
                      setActionsDropdownId(null);
                      setActionsDropdownPos(null);
                    } else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setActionsDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      setActionsDropdownId(row.id);
                    }
                  }}
                  className={`cursor-pointer p-1.5 ${
                    isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="relative flex items-center justify-center w-5 h-5">
                    <span className="absolute inset-0 flex items-center justify-center group-hover/action:opacity-0 transition-opacity"><MoreHorizontal20Regular className="w-5 h-5" /></span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity"><MoreHorizontal20Filled className="w-5 h-5" /></span>
                  </span>
                </CopilotButton>
              </CopilotTooltip>
              {isDropdownOpen && actionsDropdownPos && (
                <CopilotMenu
                  items={[
                    { label: 'Duplicate', onClick: () => alert('Duplicate functionality coming soon!') },
                    { label: 'Export', onClick: () => alert('Export functionality coming soon!') },
                  ]}
                  position={{ top: actionsDropdownPos.top, right: actionsDropdownPos.right }}
                  onClose={() => { setActionsDropdownId(null); setActionsDropdownPos(null); }}
                />
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'projectId',
      label: 'Project',
      width: '12%',
      sortable: true,
      render: (_value, row) => {
        const project = projectByAgentId.get(row.specAgentId || row.id.replace(/^bg-/, '').split('-')[0]) || (row.projectId ? buildGuideProjects.find(p => p.id === row.projectId) : undefined);
        if (!project) return <span className="text-[hsl(var(--text-disabled))]">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="w-5 h-5 rounded bg-[hsl(var(--primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-[hsl(var(--primary))]">{project.name.slice(0, 2).toUpperCase()}</span>
            </span>
            <span className="text-[hsl(var(--text-primary))] truncate">{project.name}</span>
          </span>
        );
      },
    },
    {
      key: 'type',
      label: 'Type',
      width: '11%',
      sortable: true,
      render: (_value, row) => getAgentTypeLabel(row),
    },
    {
      key: 'published',
      label: 'Status',
      width: '10%',
      sortable: true,
      render: (_value, row) => {
        const pubAction = publishingAgents[row.id];
        if (pubAction) {
          const label = pubAction === 'publishing' ? 'Publishing...' : pubAction === 'updating' ? 'Updating...' : 'Unpublishing...';
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--text-subtle))]">
              <StatusIcon status="in-progress" size={14} />
              <span>{label}</span>
            </span>
          );
        }
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            row.published
              ? 'bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]'
              : 'bg-[hsl(var(--muted))] text-[hsl(var(--text-subtle))]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${row.published ? 'bg-[hsl(var(--status-success))]' : 'bg-[hsl(var(--text-disabled))]'}`} />
            {row.published ? 'Published' : 'Draft'}
          </span>
        );
      },
    },
    {
      key: 'createdBy',
      label: 'Created by',
      width: '11%',
      sortable: false,
      render: () => userName || 'Avery Fuller',
    },
    {
      key: 'createdAt',
      label: 'Last modified',
      width: '11%',
      sortable: true,
      render: (value) => formatDate(value as Date),
    },
    {
      key: 'channel',
      label: 'Channel',
      width: '11%',
      sortable: true,
      render: (_value, row) => {
        const rawChannel = row.channel;
        if (!rawChannel) return <span className="text-[hsl(var(--text-disabled))]">—</span>;
        const channel = normalizeChannelName(rawChannel) || rawChannel;

        const getChannelIcon = (ch: string): React.ReactNode => {
          const lower = ch.toLowerCase();
          if (lower.includes('m365') || lower.includes('teams') || lower.includes('microsoft')) {
            return <M365Icon className="w-4 h-4" />;
          }
          if (lower.includes('slack')) return <SlackIcon className="w-4 h-4" />;
          if (lower.includes('sharepoint')) return <SharePointIcon className="w-4 h-4" />;
          if (lower.includes('web') || lower.includes('website')) return <Globe20Regular className="w-4 h-4" />;

          const iconMap: Record<string, string> = {
            'email': '/badge-icons/Outlook.svg',
            'outlook': '/badge-icons/Outlook.svg',
            'servicenow': '/badge-icons/ServiceNow.svg',
            'onedrive': '/badge-icons/OneDrive.svg',
            'excel': '/badge-icons/Excel.svg',
            'word': '/badge-icons/Word.svg',
            'powerpoint': '/badge-icons/PowerPoint.svg',
            'dataverse': '/badge-icons/Dataverse.svg',
          };
          const iconPath = iconMap[lower];
          if (iconPath) return <img src={iconPath} alt={ch} className="w-4 h-4" style={{ display: 'block' }} />;
          return null;
        };

        const icon = getChannelIcon(channel);
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--text-primary))]">
            {icon}
            <span className="truncate">{channel}</span>
          </span>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [actionsDropdownId, switchAgent, navigate, userName, publishingAgents, updateSpecificAgent, projectByAgentId, buildGuideProjects]);

  const handleRowClick = (agent: AgentConfig) => {
    // Project-injected agents (bg- prefix) navigate to their spec page
    if (agent.id.startsWith('bg-') && agent.projectId && agent.specAgentId) {
      navigate(`/spec?project=${encodeURIComponent(agent.projectId)}&agent=${encodeURIComponent(agent.specAgentId)}`);
      return;
    }
    switchAgent(agent.id);
    navigate('/spec');
  };

  const handleCreateAITeammate = () => {
    setCreateDropdownOpen(false);
    sessionStorage.setItem('pendingCreateType', 'teammate');
    navigate('/');
  };

  const handleCreateAgentForEmployees = () => {
    setCreateDropdownOpen(false);
    createAgent({
      name: 'Employee Assistant',
      icon: '',
      iconKey: 'generic',
      type: 'agent',
      description: 'An AI agent to help your team',
      purpose: 'Help employees get work done efficiently',
      instructions: '',
      audience: 'employees',
      capabilities: [
        { name: 'Company policies', type: 'knowledge' },
        { name: 'Internal documentation', type: 'knowledge' },
        { name: 'Answer questions', type: 'action' },
        { name: 'Schedule meetings', type: 'action' },
        { name: 'Slack integration', type: 'connector' },
        { name: 'SharePoint integration', type: 'connector' }
      ],
      guidelines: [],
      skills: [],
      model: 'sonnet-4.5',
      knowledge: {
        files: [],
        webSearch: true,
        specificSources: true,
        referenceOrgChart: true,
        customAPIs: []
      },
      published: false
    });
    navigate('/build');
  };

  const handleCreateAgentForCustomers = () => {
    setCreateDropdownOpen(false);
    createAgent({
      name: 'Customer Support Agent',
      icon: '',
      iconKey: 'generic',
      type: 'agent',
      description: 'An AI agent to help your customers',
      purpose: 'Help customers with their questions and issues',
      instructions: '',
      audience: 'customers',
      capabilities: [
        { name: 'Product knowledge', type: 'knowledge' },
        { name: 'FAQs', type: 'knowledge' },
        { name: 'Answer questions', type: 'action' },
        { name: 'Create support tickets', type: 'action' },
        { name: 'CRM integration', type: 'connector' },
        { name: 'New customer message', type: 'trigger' }
      ],
      guidelines: [],
      skills: [],
      model: 'sonnet-4.5',
      knowledge: {
        files: [],
        webSearch: true,
        specificSources: true,
        referenceOrgChart: true,
        customAPIs: []
      },
      published: false
    });
    navigate('/build');
  };

  const handleCreateWorkflow = () => {
    setCreateDropdownOpen(false);
    createAgent({
      name: 'New Workflow',
      icon: '',
      iconKey: 'generic',
      type: 'workflow',
      description: 'Add steps to describe what this workflow does.',
      purpose: 'Automate multi-step processes',
      instructions: '',
      capabilities: [
        { name: 'Multi-step automation', type: 'action' },
        { name: 'Conditional logic', type: 'action' },
        { name: 'Data processing', type: 'action' }
      ],
      workflowNodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          label: 'Workflow trigger',
          icon: '',
          connector: 'SharePoint'
        },
        {
          id: 'ai-action-1',
          type: 'ai-action',
          label: 'Process data',
          icon: '',
          config: {
            task: 'Process and extract relevant information',
            entities: ['Data', 'Content']
          }
        },
        {
          id: 'action-1',
          type: 'action',
          label: 'Send notification',
          icon: '✉️',
          connector: 'Outlook'
        }
      ],
      guidelines: [],
      skills: [],
      model: 'sonnet-4.5',
      knowledge: {
        files: [],
        webSearch: true,
        specificSources: true,
        referenceOrgChart: true,
        customAPIs: []
      },
      published: false
    });
    navigate('/build');
  };

  const renderCreateDropdown = (align: string) => (
    <div
      className={`absolute ${align} top-full mt-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg py-1.5 z-50 animate-scale-in`}
      style={{ boxShadow: 'var(--shadow-dropdown)', minWidth: '300px' }}
    >
      <CopilotButton variant="ghost" size="lg" onClick={handleCreateAITeammate} className="w-[calc(100%-12px)] h-auto p-0 mx-1.5 my-0.5 px-2 py-2 text-left justify-start !items-start hover:bg-[hsl(var(--muted))] rounded-lg">
        <DigitalWorkerIcon size={20} variant="filled" className="flex-shrink-0 mt-0.5 text-brand-purple" />
        <div>
          <div className="font-semibold">AI Teammate</div>
          <div className="text-xs text-[hsl(var(--text-subtle))]">Create a digital coworker with its own M365 identity for your team</div>
        </div>
      </CopilotButton>
      <CopilotButton variant="ghost" size="lg" onClick={handleCreateAgentForEmployees} className="w-[calc(100%-12px)] h-auto p-0 mx-1.5 my-0.5 px-2 py-2 text-left justify-start !items-start hover:bg-[hsl(var(--muted))] rounded-lg">
        <Agents20Filled className="w-5 h-5 text-brand-purple flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Agent for employees</div>
          <div className="text-xs text-[hsl(var(--text-subtle))]">Help your team find answers and get work done faster</div>
        </div>
      </CopilotButton>
      <CopilotButton variant="ghost" size="lg" onClick={handleCreateAgentForCustomers} className="w-[calc(100%-12px)] h-auto p-0 mx-1.5 my-0.5 px-2 py-2 text-left justify-start !items-start hover:bg-[hsl(var(--muted))] rounded-lg">
        <Agents20Filled className="w-5 h-5 text-brand-purple flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Agent for customers</div>
          <div className="text-xs text-[hsl(var(--text-subtle))]">Assist customers with questions and support requests</div>
        </div>
      </CopilotButton>
      <CopilotButton variant="ghost" size="lg" onClick={handleCreateWorkflow} className="w-[calc(100%-12px)] h-auto p-0 mx-1.5 my-0.5 px-2 py-2 text-left justify-start !items-start hover:bg-[hsl(var(--muted))] rounded-lg">
        <Flow20Filled className="w-5 h-5 text-brand-purple flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Workflow</div>
          <div className="text-xs text-[hsl(var(--text-subtle))]">Automate multi-step processes with triggers and actions</div>
        </div>
      </CopilotButton>
    </div>
  );

  // Filter pill component - uses shared CopilotFilterPill

  // Count items per filter
  const counts = useMemo(() => ({
    all: mergedAgents.length,
    agents: mergedAgents.filter(a => a.type !== 'workflow').length,
    workflow: mergedAgents.filter(a => a.type === 'workflow').length,
  }), [mergedAgents]);

  return (
    <div className="h-full flex flex-col">
      {/* Focus Mode Banner */}
      {focusProject && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.15)] rounded-lg mt-4 mb-0">
          <LockClosed20Regular className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0" />
          <span className="text-sm font-medium text-[hsl(var(--text-primary))]">
            Focus mode:
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="w-5 h-5 rounded bg-[hsl(var(--primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-[hsl(var(--primary))]">{focusProject.name.slice(0, 2).toUpperCase()}</span>
            </span>
            <span className="font-medium text-[hsl(var(--text-primary))]">{focusProject.name}</span>
          </span>
          <span className="text-xs text-[hsl(var(--text-subtle))]">
            Only showing agents from this project
          </span>
          <button
            onClick={() => setFocusProjectId(null)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--muted))] rounded-md transition-colors cursor-pointer"
          >
            <Dismiss16Regular className="w-3.5 h-3.5" />
            Exit focus
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="py-6">
        <h1 className="text-2xl font-semibold text-[hsl(var(--text-primary))]">
          {focusProject ? focusProject.name : 'My Projects'}
        </h1>
        <p className="text-sm text-[hsl(var(--text-subtle))] mt-1">
          {filteredAgents.length} {filteredAgents.length === 1 ? 'item' : 'items'}
          {focusProject && <span className="ml-1">in {focusProject.name}</span>}
        </p>
      </div>

      {/* Filter Pills and Create Button */}
      {mergedAgents.length > 0 && (
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type filters */}
            <CopilotFilterPill active={activeFilter === 'all'} label="All" onClick={() => setActiveFilter('all')} />
            {counts.agents > 0 && (
              <CopilotFilterPill active={activeFilter === 'agents'} label="Agents" onClick={() => setActiveFilter('agents')} />
            )}
            {counts.workflow > 0 && (
              <CopilotFilterPill active={activeFilter === 'workflow'} label="Workflows" onClick={() => setActiveFilter('workflow')} />
            )}

            {/* Project filters — hidden in focus mode (the banner replaces them) */}
            {!focusProjectId && buildGuideProjects.length > 0 && (
              <>
                <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
                <CopilotFilterPill
                  active={projectFilter === 'all'}
                  label="All projects"
                  onClick={() => setProjectFilter('all')}
                />
                {buildGuideProjects.map(p => (
                  <CopilotFilterPill
                    key={p.id}
                    active={projectFilter === p.id}
                    label={p.name}
                    onClick={() => setProjectFilter(prev => prev === p.id ? 'all' : p.id)}
                    onDoubleClick={() => setFocusProjectId(p.id)}
                    title="Double-click to enter focus mode"
                  />
                ))}
              </>
            )}
          </div>
          <div className="relative flex-shrink-0" ref={createDropdownRef}>
            <CopilotButton
              variant="primary"
              size="md"
              onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
            >
              Create new
            </CopilotButton>
            {createDropdownOpen && renderCreateDropdown('right-0')}
          </div>
        </div>
      )}

      {/* Agents & Workflows Table */}
      <div className="flex-1 overflow-auto pb-6">
        {filteredAgents.length > 0 ? (
          <CopilotTable
            columns={columns}
            data={filteredAgents}
            size="md"
            defaultSortColumn="name"
            defaultSortDirection="asc"
            onRowClick={handleRowClick}
          />
        ) : mergedAgents.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-[hsl(var(--text-subtle))] text-lg mb-2">No items match this filter</p>
            <p className="text-[hsl(var(--text-disabled))] text-sm">Try selecting a different filter</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-[hsl(var(--text-subtle))] text-lg mb-4">No agents or workflows yet</p>
            <p className="text-[hsl(var(--text-disabled))] text-sm mb-6">Create your first agent to get started</p>
            <div className="relative" ref={createDropdownRef}>
              <CopilotButton
                variant="secondary"
                size="md"
                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
              >
                Create new
              </CopilotButton>
              {createDropdownOpen && renderCreateDropdown('left-1/2 -translate-x-1/2')}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogItem !== null}
        onClose={() => setDeleteDialogItem(null)}
        onConfirm={() => {
          if (deleteDialogItem) {
            deleteAgent(deleteDialogItem.id);
          }
        }}
        itemName={deleteDialogItem?.name}
        itemType={deleteDialogItem?.type || 'agent'}
      />

      {/* Invisible anchor for publish/update dialog positioning */}
      <div
        ref={publishButtonRef}
        className="fixed pointer-events-none"
        style={{
          top: publishAnchorPos ? `${publishAnchorPos.top}px` : 0,
          right: publishAnchorPos ? `${publishAnchorPos.right}px` : 0,
          width: 1,
          height: 1,
        }}
      />

      {/* Publish confirmation dialog */}
      <PublishConfirmDialog
        isOpen={publishItem !== null}
        onClose={() => setPublishItem(null)}
        onConfirm={handlePublishConfirm}
        agentName={publishItem?.name || ''}
        agentType={publishItem?.type === 'workflow' ? 'workflow' : 'agent'}
        channel={publishItem?.channel}
        buttonRef={publishButtonRef}
      />

      {/* Update confirmation dialog */}
      <UpdateConfirmDialog
        isOpen={updateItem !== null}
        onClose={() => setUpdateItem(null)}
        onConfirm={handleUpdateConfirm}
        onUnpublish={handleUnpublish}
        agentName={updateItem?.name || ''}
        agentType={updateItem?.type === 'workflow' ? 'workflow' : 'agent'}
        currentVersion={updateItem?.version || '1.0'}
        newVersion={incrementVersion(updateItem?.version)}
        lastPublishedAt={updateItem?.lastPublishedAt}
        channel={updateItem?.channel}
        buttonRef={publishButtonRef}
      />

      {/* Share dialog */}
      {isShareCoauthoring && (
        <ShareDialog
          isOpen={shareItem !== null}
          onClose={() => setShareItem(null)}
          agentName={shareItem?.name || ''}
          shareUrl={shareItem ? `${window.location.origin}/agent/${shareItem.id}` : ''}
          buttonRef={publishButtonRef}
        />
      )}
    </div>
  );
};
