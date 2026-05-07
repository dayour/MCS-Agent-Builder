import React, { useState, useRef } from 'react';
import {
  Home20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ArrowUpRight20Regular,
  MoreHorizontal20Regular,
  PeopleTeam20Regular,
  Info16Regular,
  Mail16Regular,
  Person16Regular,
  Building16Regular,
} from '@fluentui/react-icons';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { SquircleIcon } from '../../../components/ui/SquircleIcon';
import { getAgentIcon, getUniqueGradientCSS } from '../../../utils/agentIcons';
import { AgentIcon } from '../../../components/ui/AgentIcon';
import { useDexterOrgChart, type OrgChartPerson } from '../hooks/useDexterOrgChart';
import { useSharedDexterWorkerProfile } from '../../../context/DexterWorkerProfileContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgPerson {
  id: string;
  name: string;
  title: string;
  department: string;
  initials: string;
  color: string;
  status: 'available' | 'away' | 'busy';
  reports?: number;
  isAgent?: boolean;
  isMaker?: boolean;
  photoUrl?: string | null;
}

interface WorksWith {
  id: string;
  name: string;
  title: string;
  location: string;
  initials: string;
  color: string;
  status: 'available' | 'away';
  photoUrl?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#C43E1C', '#CA5010', '#038387', '#4F6BED', '#107954', '#8764B8', '#0F6CBD', '#E3008C'];

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Convert a Graph OrgChartPerson to the local OrgPerson shape. */
function toOrgPerson(p: OrgChartPerson): OrgPerson {
  return {
    id: p.id,
    name: p.displayName,
    title: p.jobTitle || '',
    department: p.department || '',
    initials: getInitials(p.displayName),
    color: colorFromId(p.id),
    status: 'available',
    reports: p.directReportsCount,
    photoUrl: p.photoUrl,
  };
}

/** Convert a Graph OrgChartPerson to the WorksWith shape. */
function toWorksWith(p: OrgChartPerson): WorksWith {
  return {
    id: p.id,
    name: p.displayName,
    title: p.jobTitle || '',
    location: p.department || '',
    initials: getInitials(p.displayName),
    color: colorFromId(p.id),
    status: 'available',
    photoUrl: p.photoUrl,
  };
}

// ── Status dot ────────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: 'available' | 'away' | 'busy' }> = ({ status }) => {
  const colors = { available: 'bg-green-500', away: 'bg-yellow-400', busy: 'bg-red-500' };
  return (
    <span
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${colors[status]}`}
    />
  );
};

// ── Person avatar ─────────────────────────────────────────────────────────────

const PersonAvatar: React.FC<{ person: OrgPerson | WorksWith; size?: number }> = ({ person, size = 40 }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {person.photoUrl ? (
      <img src={person.photoUrl} alt={person.name} className="w-full h-full rounded-full object-cover" />
    ) : (
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold"
        style={{ backgroundColor: person.color, fontSize: size * 0.33 }}
      >
        {person.initials}
      </div>
    )}
    <StatusDot status={person.status} />
  </div>
);

// ── Org chain card ────────────────────────────────────────────────────────────

const OrgCard: React.FC<{ person: OrgPerson; agentIconKey?: string; agentGradient?: string }> = ({
  person,
  agentIconKey,
  agentGradient,
}) => (
  <div className="border border-[hsl(var(--stroke-default))] rounded-xl bg-white px-5 py-4 w-[340px] hover:bg-[hsl(var(--surface-secondary))] transition-colors cursor-pointer">
    <div className="flex items-center gap-3">
      {person.isAgent ? (
        <SquircleIcon size={40} cornerRadius={10} gradient={agentGradient || 'linear-gradient(135deg,#6264A7,#8B5CF6)'}>
          {getAgentIcon(agentIconKey || 'generic', 20)}
        </SquircleIcon>
      ) : (
        <PersonAvatar person={person} size={40} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{person.name}</p>
        <p className="text-xs text-[hsl(var(--text-secondary))] truncate">{person.title}</p>
        {!person.isAgent && person.department && (
          <p className="text-xs text-[hsl(var(--text-disabled))] truncate">{person.department}</p>
        )}
        {person.isAgent && (
          <div className="flex items-center gap-1 mt-0.5">
            <PeopleTeam20Regular className="w-3 h-3 text-[hsl(var(--text-disabled))]" />
            <p className="text-xs text-[hsl(var(--text-disabled))]">AI agent</p>
          </div>
        )}
      </div>
      {person.reports !== undefined && person.reports > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0 text-xs text-[hsl(var(--text-secondary))]">
          <PeopleTeam20Regular className="w-4 h-4" />
          <span>{person.reports}</span>
        </div>
      )}
    </div>
  </div>
);

// ── Works-with card ───────────────────────────────────────────────────────────

const WorksWithCard: React.FC<{ person: WorksWith }> = ({ person }) => (
  <div className="border border-[hsl(var(--stroke-default))] rounded-xl bg-white px-5 py-5 w-[200px] flex-shrink-0 hover:bg-[hsl(var(--surface-secondary))] transition-colors cursor-pointer">
    <div className="flex flex-col items-center text-center gap-3">
      <PersonAvatar person={person} size={52} />
      <div className="min-w-0 w-full">
        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{person.name}</p>
        <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 truncate">{person.title}</p>
        <p className="text-xs text-[hsl(var(--text-disabled))] mt-0.5 truncate">{person.location}</p>
      </div>
    </div>
  </div>
);

// ── Connector line ────────────────────────────────────────────────────────────

const ConnectorLine: React.FC = () => (
  <div className="flex justify-center">
    <div className="w-px h-6 bg-[hsl(var(--stroke-default))]" />
  </div>
);

// ── Demo data (used when Dexter is off) ───────────────────────────────────────

const DEMO_WORKS_WITH: WorksWith[] = [
  { id: 'w1', name: 'Robin Counts',  title: 'Senior Design Manager', location: 'Working remotely', initials: 'RC', color: '#C43E1C', status: 'available' },
  { id: 'w2', name: 'Lydia Bauer',   title: 'Senior Design Manager', location: 'Working remotely', initials: 'LB', color: '#CA5010', status: 'away' },
  { id: 'w3', name: 'Henry Brill',   title: 'Senior Design Manager', location: 'Working remotely', initials: 'HB', color: '#038387', status: 'available' },
  { id: 'w4', name: 'Inna Laar',     title: 'Senior Design Manager', location: 'Working remotely', initials: 'IL', color: '#4F6BED', status: 'available' },
  { id: 'w5', name: 'Alex Wilber',   title: 'Product Designer',      location: 'In office',        initials: 'AW', color: '#107954', status: 'available' },
  { id: 'w6', name: 'Megan Bowen',   title: 'UX Researcher',         location: 'Working remotely', initials: 'MB', color: '#8764B8', status: 'away' },
];

const DEMO_HIDDEN_CHAIN: OrgPerson[] = [
  { id: 'p0', name: 'Samuel Torres', title: 'CVP, Research & Design', department: 'Research & Design', initials: 'ST', color: '#0F6CBD', status: 'available', reports: 214 },
  { id: 'p1', name: 'Bryan Wright',  title: 'VP, Design Director',    department: 'Research & Design', initials: 'BW', color: '#107954', status: 'available', reports: 87 },
];

// ── Main component ────────────────────────────────────────────────────────────

export const DWOrganizationTab: React.FC = () => {
  const { agentConfig, userName } = useAgent();
  const { isDexter, tenantDomain } = useDW();
  const agentName = agentConfig.name || 'AI Teammate';
  const makerFullName = userName || 'Avery Fuller';
  const makerInitials = userName
    ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AF';
  const agentIconKey = agentConfig.iconKey || 'generic';
  const agentGradient = agentConfig.gradientKey
    ? getUniqueGradientCSS(agentConfig.gradientKey)
    : getUniqueGradientCSS(agentConfig.id || 'dw');

  // Fetch real org chart from Entra when Dexter is on
  const dwProfile = useSharedDexterWorkerProfile();
  const orgChart = useDexterOrgChart(isDexter, dwProfile.worker?.agenticUserId);
  const useRealData = isDexter && !orgChart.loading && orgChart.managerChain.length > 0;

  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentEmail = dwProfile.email || agentConfig.email || `${(agentConfig.name || 'ai.teammate').toLowerCase().replace(/\s+/g, '.')}@${tenantDomain}`;

  // Build the org chain — real or demo
  const managerChain: OrgPerson[] = useRealData
    ? orgChart.managerChain.map(toOrgPerson)
    : DEMO_HIDDEN_CHAIN;

  // The immediate manager is first in the chain
  const immediateMgr = managerChain[0] || null;
  const upperChain = managerChain.slice(1).reverse(); // top-down order

  // Works-with: use real peers or Graph people, fall back to demo
  const worksWithPeople: WorksWith[] = useRealData
    ? (orgChart.peers.length > 0 ? orgChart.peers : orgChart.worksWith).map(toWorksWith)
    : DEMO_WORKS_WITH;

  const agentNode: OrgPerson = {
    id: 'agent',
    name: agentName,
    title: 'AI agent',
    department: '',
    initials: agentName.slice(0, 2).toUpperCase(),
    color: '#6264A7',
    status: 'available',
    isAgent: true,
    photoUrl: dwProfile.photoUrl,
  };

  // Determine the "reports to" person — immediate manager from Entra, or the maker
  const reportsToName = useRealData && immediateMgr ? immediateMgr.name : makerFullName;
  const reportsToInitials = useRealData && immediateMgr ? immediateMgr.initials : makerInitials;

  // Build the visible chain (top → immediate manager → agent)
  const visibleUpperChain = showMore ? upperChain : [];
  const makerPerson: OrgPerson = useRealData && immediateMgr
    ? { ...immediateMgr, isMaker: false }
    : {
        id: 'maker', name: makerFullName, title: 'Manager', department: 'Research & Design',
        initials: makerInitials, color: '#8764B8', status: 'available', reports: 1, isMaker: true,
      };

  const scrollRight = () => scrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' });

  return (
    <div className="space-y-8">

      {/* ── Top nav bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <CopilotButton variant="icon-subtle" size="sm" icon={<Home20Regular className="w-4 h-4" />} title="Home" />
          <CopilotButton variant="icon-subtle" size="sm" icon={<ChevronLeft20Regular className="w-4 h-4" />} title="Back" />
          <CopilotButton variant="icon-subtle" size="sm" icon={<ChevronRight20Regular className="w-4 h-4" />} title="Forward" />
        </div>
        <div className="flex items-center gap-1">
          <CopilotButton variant="icon-subtle" size="sm" icon={<ArrowUpRight20Regular className="w-4 h-4" />} title="Open" />
          <CopilotButton variant="icon-subtle" size="sm" icon={<MoreHorizontal20Regular className="w-4 h-4" />} title="More options" />
        </div>
      </div>

      {orgChart.loading ? (
        <p className="text-sm text-neutral-500 text-center py-8">Loading organization data...</p>
      ) : null}

      {/* ── Org chain ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center">

          <>
            {/* Show more button — upper managers */}
            {!showMore && (upperChain.length > 0 || (!useRealData && DEMO_HIDDEN_CHAIN.length > 0)) && (
              <>
                <CopilotButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMore(true)}
                  className="!rounded-full"
                >
                  <div className="flex -space-x-2 mr-1">
                    {(useRealData ? upperChain : DEMO_HIDDEN_CHAIN).map(p => (
                      <div key={p.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0" style={{ backgroundColor: p.color }}>
                        {p.initials}
                      </div>
                    ))}
                  </div>
                  Show {(useRealData ? upperChain : DEMO_HIDDEN_CHAIN).length} more
                </CopilotButton>
                <ConnectorLine />
              </>
            )}

            {/* Upper chain (when expanded) */}
            {visibleUpperChain.map((person) => (
              <React.Fragment key={person.id}>
                <OrgCard person={person} />
                <ConnectorLine />
              </React.Fragment>
            ))}

            {/* Immediate manager */}
            <OrgCard person={makerPerson} />
            <ConnectorLine />
          </>

        {/* Agent node — expands to show profile on "View profile" */}
        <div className="border border-[hsl(var(--stroke-default))] rounded-xl bg-white w-[340px] overflow-hidden transition-all">
          {/* Collapsed header row */}
          <div className="flex items-center gap-3 px-5 py-4">
            <AgentIcon agent={agentConfig} size={40} rounded />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{agentNode.name}</p>
              <p className="text-xs text-[hsl(var(--text-secondary))] truncate">AI agent</p>
              <div className="flex items-center gap-1 mt-0.5">
                <PeopleTeam20Regular className="w-3 h-3 text-[hsl(var(--text-disabled))]" />
                <p className="text-xs text-[hsl(var(--text-disabled))]">AI agent</p>
              </div>
            </div>
          </div>

          {/* Expanded profile details */}
          {showProfile && (
            <div className="px-5 pb-4 border-t border-[hsl(var(--surface-quaternary))] pt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                <Mail16Regular className="w-4 h-4 flex-shrink-0 text-[hsl(var(--text-disabled))]" />
                <a href={`mailto:${agentEmail}`} className="hover:underline truncate">{agentEmail}</a>
              </div>
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                <Person16Regular className="w-4 h-4 flex-shrink-0 text-[hsl(var(--text-disabled))]" />
                <span>{agentConfig.role || dwProfile.jobTitle || 'AI Teammate'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                <Building16Regular className="w-4 h-4 flex-shrink-0 text-[hsl(var(--text-disabled))]" />
                <span>{dwProfile.department || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                <PeopleTeam20Regular className="w-4 h-4 flex-shrink-0 text-[hsl(var(--text-disabled))]" />
                <span className="flex items-center gap-1.5">
                  {immediateMgr?.photoUrl ? (
                    <img src={immediateMgr.photoUrl} alt={reportsToName} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                      {reportsToInitials}
                    </span>
                  )}
                  Reports to {reportsToName}
                </span>
              </div>
            </div>
          )}

          {/* View / hide profile toggle */}
          <div className="px-5 py-3 border-t border-[hsl(var(--surface-quaternary))]">
            <CopilotButton
              variant="transparent"
              size="sm"
              onClick={() => setShowProfile(v => !v)}
              className="!text-[#6264A7] hover:!text-[#4F52A3] !font-medium !text-xs !px-0"
            >
              {showProfile ? 'Hide profile' : 'View profile'}
            </CopilotButton>
          </div>
        </div>
      </div>

      {/* ── Also works with ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{agentName} also works with</p>
          <Info16Regular className="w-4 h-4 text-[hsl(var(--text-disabled))]" />
        </div>
        <div className="flex items-center gap-2">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth flex-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {worksWithPeople.map(person => (
              <WorksWithCard key={person.id} person={person} />
            ))}
          </div>
          <CopilotButton
            variant="outline"
            size="sm"
            icon={<ChevronRight20Regular className="w-4 h-4" />}
            onClick={scrollRight}
            className="!rounded-full flex-shrink-0"
            title="Scroll right"
          />
        </div>
      </div>

    </div>
  );
};
