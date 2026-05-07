import { useState, useRef, useEffect } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  Search20Regular,
  MoreHorizontal20Regular,
} from '@fluentui/react-icons';
import { useAgent } from '../../../context/AgentContext';

// TODO: fetch from Graph API instead of hardcoded mock data
const sharePointSites = [
  { label: 'Abhijeet Raj', value: 'abhijeet-raj' },
  { label: 'ContosoEngineering', value: 'contoso-engineering' },
  { label: 'Contoso HR Site', value: 'contoso-hr' },
  { label: 'Contoso Sales Team', value: 'contoso-sales' },
  { label: 'Contoso Sales Team Collaboration', value: 'contoso-sales-collab' },
  { label: 'Copilot Studio Avalon', value: 'copilot-avalon' },
  { label: 'Delivery Drone Launch', value: 'delivery-drone' },
];

/**
 * SharePoint Site Deployment card — fully self-contained.
 * Shown when the trigger channel is 'sharepoint'.
 */
export function SharePointSiteSection() {
  const { updateAgentConfig, agentConfig } = useAgent();
  const [siteDeployOpen, setSiteDeployOpen] = useState(true);
  const [selectedSite, setSelectedSiteLocal] = useState(
    () => agentConfig.triggerDistribution?.sharepoint?.selectedSiteValue ?? ''
  );
  const setSelectedSite = (value: string) => {
    setSelectedSiteLocal(value);
    const current = agentConfig.triggerDistribution?.sharepoint ?? {};
    updateAgentConfig({
      triggerDistribution: {
        ...(agentConfig.triggerDistribution ?? {}),
        sharepoint: { ...current, selectedSiteValue: value, siteSelected: !!value },
      },
    });
  };
  const isTriggerPublished = !!agentConfig.published && !!agentConfig.publishedTriggers?.some(
    t => t.iconKey === 'sharepoint'
  );
  const siteDeployed = isTriggerPublished && !!selectedSite;

  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const siteMenuRef = useRef<HTMLDivElement>(null);

  const filteredSites = sharePointSites.filter(s =>
    s.label.toLowerCase().includes(siteSearchQuery.toLowerCase())
  );

  const selectedSiteLabel = sharePointSites.find(s => s.value === selectedSite)?.label ?? '';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) {
        setSiteDropdownOpen(false);
      }
    };
    if (siteDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [siteDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(e.target as Node)) {
        setSiteMenuOpen(false);
      }
    };
    if (siteMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [siteMenuOpen]);

  return (
    <div className="border border-gray-200 rounded-2xl">
      <CopilotButton
        variant="transparent"
        onClick={() => setSiteDeployOpen(v => !v)}
        className="w-full flex items-start gap-2 px-6 py-4 text-left"
        aria-expanded={siteDeployOpen}
        style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
      >
        <span className="mt-0.5 flex-shrink-0">
          {siteDeployOpen ? (
            <ChevronDown16Regular style={{ color: '#6B7280' }} />
          ) : (
            <ChevronRight16Regular style={{ color: '#6B7280' }} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">SharePoint Site Deployment</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            All SharePoint users have the ability to use Agents natively within SharePoint to boost their productivity. You can deploy your Agent to SharePoint allowing all site users to use this Agent.
          </p>
        </div>
      </CopilotButton>

      {siteDeployOpen && (
        <div className="px-6 pb-5 space-y-4">
          <p className="text-xs text-gray-500">
            Add a SharePoint site to deploy your agent.{' '}
            <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
          </p>

          <div ref={siteDropdownRef} className="relative">
            {/* Search / select trigger */}
            <div
              className="cursor-pointer"
              onClick={() => setSiteDropdownOpen(o => !o)}
            >
              <CopilotInput
                appearance="outline"
                size="sm"
                placeholder="Search or select SharePoint site"
                value={siteDropdownOpen ? siteSearchQuery : (selectedSite ? selectedSiteLabel : '')}
                onChange={e => { setSiteSearchQuery(e.target.value); if (!siteDropdownOpen) setSiteDropdownOpen(true); }}
                onFocus={() => setSiteDropdownOpen(true)}
                onClick={e => e.stopPropagation()}
                className="w-full"
                contentBefore={<Search20Regular className="text-gray-400" style={{ width: 16, height: 16 }} />}
                contentAfter={<ChevronDown16Regular className="text-gray-400" />}
              />
            </div>

            {/* Dropdown list */}
            {siteDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                {filteredSites.length === 0 ? (
                  <p className="text-sm text-gray-400 px-4 py-3 text-center">No sites found</p>
                ) : (
                  filteredSites.map(site => (
                    <CopilotButton
                      key={site.value}
                      variant="transparent"
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                        site.value === selectedSite ? 'bg-gray-50' : ''
                      }`}
                      style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0 }}
                      onClick={() => {
                        setSelectedSite(site.value);
                        setSiteSearchQuery('');
                        setSiteDropdownOpen(false);
                      }}
                    >
                      <img
                        src="/component-icons/SharePoint16.svg"
                        alt=""
                        className="w-5 h-5 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-900">{site.label}</span>
                    </CopilotButton>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Deployment Status</p>
            </div>

            {!selectedSite ? (
              <div className="px-4 py-8">
                <p className="text-xs text-gray-400 text-center">Select a SharePoint site to deploy your agent to</p>
              </div>
            ) : (
              <>
                {/* Site row */}
                <div className="flex items-center px-4 py-3">
                  <img src="/component-icons/SharePoint16.svg" alt="" className="w-7 h-7 flex-shrink-0" />
                  <span className="text-sm text-gray-900 ml-3 flex-1 min-w-0 truncate">{selectedSiteLabel}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0 ${
                    siteDeployed
                      ? 'text-[#16A34A] border-[#BBF7D0] bg-[#F0FFF4]'
                      : 'text-gray-500 border-gray-200 bg-gray-50'
                  }`}>
                    {siteDeployed ? 'Deployed' : 'Undeployed'}
                  </span>

                  {/* Ellipsis menu */}
                  <div className="relative ml-2" ref={siteMenuRef}>
                    <CopilotButton
                      variant="transparent"
                      size="sm"
                      icon={<MoreHorizontal20Regular />}
                      onClick={() => setSiteMenuOpen(o => !o)}
                      aria-label="Site actions"
                    />
                    {siteMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                        <CopilotButton
                          variant="transparent"
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0 }}
                          onClick={() => { window.open(`https://contoso.sharepoint.com/sites/${selectedSite}`, '_blank'); setSiteMenuOpen(false); }}
                        >
                          Go to Site
                        </CopilotButton>
                        <CopilotButton
                          variant="transparent"
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0 }}
                          onClick={() => { navigator.clipboard.writeText(`https://contoso.sharepoint.com/sites/${selectedSite}?agent=${agentConfig.id}`); setSiteMenuOpen(false); }}
                        >
                          Copy Agent URL
                        </CopilotButton>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
