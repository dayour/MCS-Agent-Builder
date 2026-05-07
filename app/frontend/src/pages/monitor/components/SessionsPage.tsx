import React, { useState } from 'react'
import {
  Search20Regular,
  Dismiss12Regular,
  Dismiss20Regular,
  ArrowDownload20Regular,
} from '@fluentui/react-icons'
import { COLORS, CLS } from '../constants'
import { DetailPageHeader, KPIItem, StatusBadge, FilterMenu, Pagination } from './SharedComponents'
import { CopilotButton } from '../../../components/ui/CopilotButton'
import { CopilotInput } from '../../../components/ui/CopilotInput'
import type { Session } from '../types'

const SESSIONS_DATA = [
  { id: 1, startTime: 'Mar 5, 2026 2:34 PM', duration: '4m 12s', messages: 8, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'How do I reset my password for the corporate VPN?' },
      { role: 'agent', text: 'To reset your VPN password, go to the IT Self-Service portal at portal.contoso.com, click "Forgot Password," and follow the verification steps. You\'ll receive a reset link via your registered email.' },
      { role: 'user', text: 'Thanks, that worked!' },
      { role: 'agent', text: 'Glad to help! Is there anything else you need?' },
    ]},
  { id: 2, startTime: 'Mar 5, 2026 1:58 PM', duration: '2m 45s', messages: 5, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'What\'s the return policy for electronics?' },
      { role: 'agent', text: 'Electronics can be returned within 30 days of purchase with the original receipt. Items must be in their original packaging and include all accessories. Opened software is non-refundable.' },
      { role: 'user', text: 'Does that include monitors?' },
      { role: 'agent', text: 'Yes, monitors follow the same 30-day return policy. If there\'s a defect, the manufacturer warranty may extend coverage up to 1 year.' },
    ]},
  { id: 3, startTime: 'Mar 5, 2026 1:22 PM', duration: '6m 30s', messages: 12, outcome: 'Agent transfer', reason: 'User requested agent', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'I need to dispute a charge on my corporate card from last month.' },
      { role: 'agent', text: 'I can help guide you through the dispute process. Could you provide the transaction date and amount?' },
      { role: 'user', text: 'It was on Feb 15 for $234.50 from a vendor I don\'t recognize.' },
      { role: 'agent', text: 'I see that transaction. For unrecognized charges, I\'d recommend connecting with our finance team directly as they can initiate a formal dispute. Let me transfer you now.' },
      { role: 'user', text: 'Yes, please transfer me.' },
      { role: 'agent', text: 'Transferring you to a finance specialist now. They\'ll have your case details ready.' },
    ]},
  { id: 4, startTime: 'Mar 5, 2026 12:45 PM', duration: '1m 18s', messages: 3, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Published engine direct',
    conversation: [
      { role: 'user', text: 'What are the office hours for the Seattle campus?' },
      { role: 'agent', text: 'The Seattle campus is open Monday through Friday, 7:00 AM to 7:00 PM PT. Weekend access requires badge authorization from your manager.' },
    ]},
  { id: 5, startTime: 'Mar 5, 2026 11:30 AM', duration: '8m 05s', messages: 15, outcome: 'Abandoned', reason: 'User left', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'I\'m having trouble connecting to the shared drive.' },
      { role: 'agent', text: 'I can help troubleshoot that. Are you connecting via VPN or on the corporate network?' },
      { role: 'user', text: 'VPN' },
      { role: 'agent', text: 'Please try disconnecting and reconnecting your VPN. If the issue persists, check that your network drive mapping is set to \\\\files.contoso.com\\shared.' },
    ]},
  { id: 6, startTime: 'Mar 5, 2026 10:12 AM', duration: '3m 22s', messages: 6, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Maker evaluation',
    conversation: [
      { role: 'user', text: 'How do I submit a travel expense report?' },
      { role: 'agent', text: 'You can submit travel expenses through the Concur portal. Log in at concur.contoso.com, click "Create New Report," attach your receipts, and submit for manager approval. Reports should be filed within 30 days of travel.' },
    ]},
  { id: 7, startTime: 'Mar 4, 2026 4:55 PM', duration: '5m 40s', messages: 10, outcome: 'Agent transfer', reason: 'Confidence too low', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'I need to configure a custom SSO integration with our SAML provider.' },
      { role: 'agent', text: 'I can provide general guidance on SSO configuration. Could you tell me which identity provider you\'re using?' },
      { role: 'user', text: 'We use Okta with a custom SAML 2.0 setup and need to map non-standard attributes.' },
      { role: 'agent', text: 'Custom attribute mapping with Okta involves some specific configurations that I want to make sure are handled correctly. Let me connect you with our identity team who can assist with the detailed setup.' },
    ]},
  { id: 8, startTime: 'Mar 4, 2026 3:18 PM', duration: '2m 10s', messages: 4, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'Where can I find the latest brand guidelines?' },
      { role: 'agent', text: 'The latest brand guidelines are available on the Marketing SharePoint site at sharepoint.contoso.com/sites/brand. The most recent version was updated last month and includes the new logo specifications.' },
      { role: 'user', text: 'Perfect, found it. Thanks!' },
    ]},
  { id: 9, startTime: 'Mar 4, 2026 2:42 PM', duration: '7m 55s', messages: 14, outcome: 'Abandoned', reason: 'Session timeout', channel: 'Published engine direct',
    conversation: [
      { role: 'user', text: 'I need help setting up a new project in Azure DevOps.' },
      { role: 'agent', text: 'I\'d be happy to help! To create a new project, go to dev.azure.com/contoso, click "New Project," and fill in the project name and description. Would you like me to walk you through the detailed steps?' },
      { role: 'user', text: 'Yes please' },
      { role: 'agent', text: 'First, choose your version control (Git is recommended) and work item process (Agile, Scrum, or CMMI). Then set the visibility to your team. Would you like guidance on any of these options?' },
    ]},
  { id: 10, startTime: 'Mar 4, 2026 1:05 PM', duration: '3m 48s', messages: 7, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'What\'s the process for ordering new equipment for my team?' },
      { role: 'agent', text: 'Equipment orders go through the IT procurement portal. Submit a request at procurement.contoso.com with the item details and your cost center. Orders under $5,000 need manager approval; above that requires VP sign-off.' },
    ]},
  { id: 11, startTime: 'Mar 4, 2026 11:30 AM', duration: '4m 55s', messages: 9, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Maker evaluation',
    conversation: [
      { role: 'user', text: 'How do I add a new team member to our Microsoft Teams channel?' },
      { role: 'agent', text: 'Open the Teams channel, click the "..." menu next to the channel name, select "Add member," search for the person\'s name or email, and click "Add." They\'ll receive a notification and can access the channel immediately.' },
    ]},
  { id: 12, startTime: 'Mar 4, 2026 10:15 AM', duration: '1m 42s', messages: 3, outcome: 'Resolved implied', reason: 'Topic redirect', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'PTO balance?' },
      { role: 'agent', text: 'You can check your PTO balance in Workday at workday.contoso.com under "Time Off" > "My Balances." As of today, you have 12 days remaining for this fiscal year.' },
    ]},
  { id: 13, startTime: 'Mar 3, 2026 4:30 PM', duration: '9m 15s', messages: 18, outcome: 'Agent transfer', reason: 'User requested agent', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'I\'m locked out of my account and none of the self-service options are working.' },
      { role: 'agent', text: 'I\'m sorry you\'re having trouble. Let me try a few things. Can you confirm the email address associated with your account?' },
      { role: 'user', text: 'john.doe@contoso.com' },
      { role: 'agent', text: 'I can see your account has been flagged for suspicious activity, which is why the self-service reset isn\'t available. This requires a manual review. Let me connect you with our security team.' },
    ]},
  { id: 14, startTime: 'Mar 3, 2026 3:05 PM', duration: '2m 30s', messages: 5, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Published engine direct',
    conversation: [
      { role: 'user', text: 'What\'s the policy on remote work?' },
      { role: 'agent', text: 'Our hybrid work policy allows up to 3 days remote per week for eligible roles. You\'ll need to coordinate with your manager on your in-office schedule. Full remote arrangements require HR approval and are reviewed quarterly.' },
      { role: 'user', text: 'Great, thanks for the info.' },
    ]},
  { id: 15, startTime: 'Mar 3, 2026 1:48 PM', duration: '5m 12s', messages: 11, outcome: 'Abandoned', reason: 'User left', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'How do I set up a recurring meeting in Outlook?' },
      { role: 'agent', text: 'In Outlook, create a new meeting, then click "Recurrence" in the toolbar. Set the pattern (daily, weekly, monthly), choose the days and time, and set an end date or number of occurrences. Click "OK" and then "Send."' },
    ]},
  { id: 16, startTime: 'Mar 3, 2026 12:22 PM', duration: '3m 05s', messages: 6, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'Where do I find my W-2 form?' },
      { role: 'agent', text: 'Your W-2 is available in Workday under "Pay" > "Tax Documents." You can view, download, or print it from there. If you need a prior year\'s W-2, use the year filter at the top of the page.' },
    ]},
  { id: 17, startTime: 'Mar 3, 2026 10:50 AM', duration: '6m 48s', messages: 13, outcome: 'Agent transfer', reason: 'Confidence too low', channel: 'Maker evaluation',
    conversation: [
      { role: 'user', text: 'We need to set up a data pipeline from our on-prem SQL Server to Azure Synapse with incremental loads.' },
      { role: 'agent', text: 'For that scenario, Azure Data Factory with a self-hosted integration runtime would be the recommended approach. However, the specific configuration for incremental loads depends on your data model. Let me connect you with our data engineering team for a detailed setup.' },
    ]},
  { id: 18, startTime: 'Mar 2, 2026 3:35 PM', duration: '2m 58s', messages: 5, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Published engine direct',
    conversation: [
      { role: 'user', text: 'How do I book a conference room?' },
      { role: 'agent', text: 'You can book conference rooms directly from Outlook. When creating a meeting, click "Room Finder" on the right side, select your building and floor, and choose an available room. You can also use the Room Booker app on the panel outside each room.' },
    ]},
  { id: 19, startTime: 'Mar 2, 2026 2:10 PM', duration: '4m 25s', messages: 8, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'What benefits do we get for professional development?' },
      { role: 'agent', text: 'Full-time employees receive a $5,000 annual learning stipend for courses, conferences, and certifications. You also have access to LinkedIn Learning and Pluralsight at no cost. Submit reimbursement requests through Concur with the "Professional Development" expense type.' },
    ]},
  { id: 20, startTime: 'Mar 2, 2026 11:45 AM', duration: '10m 02s', messages: 20, outcome: 'Abandoned', reason: 'Session timeout', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'I need help migrating our team\'s data from the old SharePoint site.' },
      { role: 'agent', text: 'I can guide you through the SharePoint migration. First, let\'s identify the scope — approximately how much data and how many document libraries are involved?' },
      { role: 'user', text: 'About 50GB across 12 libraries' },
      { role: 'agent', text: 'For that volume, I\'d recommend using the SharePoint Migration Tool (SPMT). Download it from Microsoft, map your source and destination sites, and schedule the migration during off-hours. Would you like step-by-step instructions?' },
    ]},
  { id: 21, startTime: 'Mar 2, 2026 10:20 AM', duration: '3m 38s', messages: 7, outcome: 'Resolved confirmed', reason: 'Topic redirect', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'I want to change my direct deposit information.' },
      { role: 'agent', text: 'You can update your direct deposit in Workday. Go to "Pay" > "Payment Elections" > "Edit." Enter your new bank routing and account numbers. Changes take effect on the next pay cycle.' },
      { role: 'user', text: 'Updated, thanks!' },
    ]},
  { id: 22, startTime: 'Mar 1, 2026 4:15 PM', duration: '5m 50s', messages: 11, outcome: 'Agent transfer', reason: 'User requested agent', channel: 'Maker evaluation',
    conversation: [
      { role: 'user', text: 'I need to report a security incident — someone accessed my account from an unknown location.' },
      { role: 'agent', text: 'That\'s concerning. I\'m immediately flagging this for our security team. In the meantime, please change your password if you can still access your account. Let me transfer you to a security specialist now.' },
    ]},
  { id: 23, startTime: 'Mar 1, 2026 2:40 PM', duration: '1m 55s', messages: 4, outcome: 'Resolved implied', reason: 'Agent answered', channel: 'Published engine direct',
    conversation: [
      { role: 'user', text: 'How do I set up email forwarding?' },
      { role: 'agent', text: 'In Outlook on the web, go to Settings > Mail > Forwarding. Toggle on "Enable forwarding," enter the destination email, and optionally check "Keep a copy." Click Save to apply.' },
    ]},
  { id: 24, startTime: 'Mar 1, 2026 1:12 PM', duration: '4m 10s', messages: 8, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'What\'s the process for getting a parking pass?' },
      { role: 'agent', text: 'Submit a parking request through the Facilities portal at facilities.contoso.com/parking. Select your building and preferred lot. Passes are issued monthly, and you\'ll be notified via email once approved. There\'s currently a 2-week wait for covered parking.' },
      { role: 'user', text: 'Done, submitted the request.' },
      { role: 'agent', text: 'Great! You should receive confirmation within 2-3 business days.' },
    ]},
  { id: 25, startTime: 'Mar 1, 2026 11:00 AM', duration: '7m 20s', messages: 14, outcome: 'Abandoned', reason: 'User left', channel: 'Copilot plugin',
    conversation: [
      { role: 'user', text: 'Need help with the new CRM tool.' },
      { role: 'agent', text: 'I can help with the CRM. What specifically are you trying to do?' },
      { role: 'user', text: 'I want to create a custom dashboard for my sales pipeline.' },
      { role: 'agent', text: 'To create a custom dashboard, go to Dashboards > New Dashboard, choose a layout template, and add components like charts, lists, and KPI cards. You can filter data by pipeline stage, date range, and team member.' },
    ]},
  { id: 26, startTime: 'Mar 1, 2026 9:05 AM', duration: '12m 35s', messages: 22, outcome: 'Resolved confirmed', reason: 'Agent answered', channel: 'Copilot Studio',
    conversation: [
      { role: 'user', text: 'Hi, I need help setting up a new project in Azure DevOps for our team.' },
      { role: 'user', text: 'We also need to configure CI/CD pipelines and set up branch policies.' },
      { role: 'user', text: 'And one more thing — we need to integrate it with our Slack workspace for notifications.' },
      { role: 'agent', text: 'I can help with all three. Let\'s start with the project setup.' },
      { role: 'agent', text: 'Go to Azure DevOps > Organization Settings > New Project. Choose a name, set visibility to Private, select Git for version control, and Agile for the work item process.' },
      { role: 'agent', text: 'Once the project is created, navigate to Project Settings > Repositories to configure your default branch and permissions.' },
      { role: 'user', text: 'Done, project is created. Now for the pipelines?' },
      { role: 'agent', text: 'For CI/CD, go to Pipelines > New Pipeline. Connect to your repo, then choose the YAML template. Here\'s a starter config for a Node.js app with build, test, and deploy stages.' },
      { role: 'agent', text: 'For branch policies, go to Repos > Branches, click the "..." menu on your main branch, and select "Branch policies." Enable minimum reviewers (I recommend 2), require linked work items, and add a build validation policy pointing to your new pipeline.' },
      { role: 'user', text: 'Got it. What about the Slack integration?' },
      { role: 'user', text: 'We want notifications for PR creation, build failures, and deployment completions.' },
      { role: 'agent', text: 'Install the "Azure DevOps" app from the Slack App Directory. Then in your Azure DevOps project, go to Project Settings > Service Hooks > Create Subscription.' },
      { role: 'agent', text: 'Create three subscriptions: one for "Pull request created" events, one for "Build completed" with a filter for failed status, and one for "Release deployment completed." Each will post to your chosen Slack channel.' },
      { role: 'agent', text: 'You can also customize the message format and add @channel mentions for critical failures if needed.' },
      { role: 'user', text: 'Perfect. One last question — how do we set up environments for staging and production in the release pipeline?' },
      { role: 'agent', text: 'In Pipelines > Environments, create two environments: "Staging" and "Production." For Production, add an approval check — go to the environment, click "Approvals and checks," and add yourself or your team lead as a required approver.' },
      { role: 'agent', text: 'Then in your YAML pipeline, reference these environments in your deployment jobs using the `environment:` keyword. The pipeline will automatically pause for approval before deploying to Production.' },
      { role: 'user', text: 'This is exactly what we needed.' },
      { role: 'user', text: 'Thanks for walking through everything!' },
      { role: 'agent', text: 'You\'re welcome! To summarize what we set up:' },
      { role: 'agent', text: '1. New Azure DevOps project with Git and Agile process\n2. CI/CD pipeline with YAML configuration\n3. Branch policies with 2 reviewers and build validation\n4. Slack notifications for PRs, build failures, and deployments\n5. Staging and Production environments with approval gates' },
      { role: 'agent', text: 'If you run into any issues during setup, feel free to come back. Good luck with the project!' },
    ]},
]

const OUTCOME_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = { 'Resolved confirmed': 'success', 'Resolved implied': 'success', 'Agent transfer': 'warning', 'Abandoned': 'danger' }
const DATE_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'last7', label: 'Last 7 days' }]
const OUTCOME_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'resolved confirmed', label: 'Resolved confirmed' }, { value: 'resolved implied', label: 'Resolved implied' }, { value: 'agent transfer', label: 'Agent transfer' }, { value: 'abandoned', label: 'Abandoned' }]
const REASON_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'Agent answered', label: 'Agent answered' }, { value: 'Topic redirect', label: 'Topic redirect' }, { value: 'User requested agent', label: 'User requested agent' }, { value: 'Confidence too low', label: 'Confidence too low' }, { value: 'User left', label: 'User left' }, { value: 'Session timeout', label: 'Session timeout' }]
const CHANNEL_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'Copilot Studio', label: 'Copilot Studio' }, { value: 'Copilot plugin', label: 'Copilot plugin' }, { value: 'Published engine direct', label: 'Published engine direct' }, { value: 'Maker evaluation', label: 'Maker evaluation' }]
const ITEMS_PER_PAGE = 15

interface SessionsPageProps {
  onBack: () => void
  onSessionSelect?: (session: Session) => void
}

export default function SessionsPage({ onBack, onSessionSelect }: SessionsPageProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const hasActiveFilters = outcomeFilter !== 'all' || reasonFilter !== 'all' || channelFilter !== 'all' || dateFilter !== 'all' || searchQuery
  const setFilter = (setter: React.Dispatch<React.SetStateAction<string>>) => (v: string) => { setter(v); setCurrentPage(1) }

  const sessions = SESSIONS_DATA.filter(s => {
    if (outcomeFilter !== 'all' && s.outcome.toLowerCase() !== outcomeFilter) return false
    if (reasonFilter !== 'all' && s.reason !== reasonFilter) return false
    if (channelFilter !== 'all' && s.channel !== channelFilter) return false
    if (dateFilter === 'today' && !s.startTime.includes('Mar 5')) return false
    if (dateFilter === 'yesterday' && !s.startTime.includes('Mar 4')) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!s.reason.toLowerCase().includes(q) && !s.channel.toLowerCase().includes(q) && !s.outcome.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(sessions.length / ITEMS_PER_PAGE))
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentSessions = sessions.slice(startIndex, endIndex)

  return (
    <div className={CLS.pageRoot}>
      <div className={`${CLS.pageInner} pt-2.5`}>
      <div className="max-w-full mx-auto">
        {/* Header */}
        <DetailPageHeader title="Sessions" onBack={onBack}>
          <CopilotButton variant="ghost" size="xs">
            <ArrowDownload20Regular />
            Download
          </CopilotButton>
        </DetailPageHeader>

        {/* KPI Overview */}
        <div className={CLS.cardCompact} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KPIItem value="4m 12s" label="Average duration" />
            <KPIItem value="8.6" label="Average messages" />
          </div>
        </div>

        {/* Sessions Grid */}
        <section className={`${CLS.card} overflow-hidden`}>
          <div className="flex items-center justify-between p-3 pb-2 min-h-[48px]">
            <label className="text-sm font-semibold text-gray-900">Sessions ({sessions.length})</label>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', flexWrap: 'wrap', padding: '0 12px' }}>
            <FilterMenu options={DATE_OPTIONS} value={dateFilter} onChange={setFilter(setDateFilter)} label="Date" />
            <FilterMenu options={OUTCOME_OPTIONS} value={outcomeFilter} onChange={setFilter(setOutcomeFilter)} label="Session outcome" />
            <FilterMenu options={REASON_OPTIONS} value={reasonFilter} onChange={setFilter(setReasonFilter)} label="Outcome reason" />
            <FilterMenu options={CHANNEL_OPTIONS} value={channelFilter} onChange={setFilter(setChannelFilter)} label="Channels" />

            {hasActiveFilters && (
              <CopilotButton variant="ghost" size="xs" onClick={() => { setOutcomeFilter('all'); setReasonFilter('all'); setChannelFilter('all'); setDateFilter('all'); setSearchQuery(''); setSearchOpen(false); setCurrentPage(1) }} style={{ marginLeft: '4px' }}>
                <Dismiss12Regular />
                Clear
              </CopilotButton>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              {searchOpen ? (
                <div style={{ width: '200px' }}>
                  <CopilotInput
                    type="text"
                    size="sm"
                    appearance="underline"
                    placeholder="Search sessions..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                    autoFocus
                    onBlur={() => { if (!searchQuery) setSearchOpen(false) }}
                    contentBefore={<Search20Regular style={{ fontSize: '16px', color: COLORS.textTertiary }} />}
                    contentAfter={searchQuery ? (
                      <CopilotButton variant="icon-subtle" size="xs" onClick={() => { setSearchQuery(''); setCurrentPage(1) }} aria-label="Clear search">
                        <Dismiss20Regular />
                      </CopilotButton>
                    ) : undefined}
                  />
                </div>
              ) : (
                <CopilotButton variant="icon-subtle" size="xs" onClick={() => setSearchOpen(true)} aria-label="Search">
                  <Search20Regular />
                </CopilotButton>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-hidden">
            <div style={{ overflowX: 'overlay' }} data-hide-scrollbar="true">
              <div className="flex bg-[hsl(var(--surface-secondary))] h-9 items-center pl-4 pr-3 gap-3">
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 1.5, minWidth: '100px', paddingLeft: '16px' }}>Start time</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 0.8, minWidth: '60px' }}>Duration</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 0.6, minWidth: '60px' }}>Messages</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 1.2, minWidth: '90px' }}>Outcome</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 1.4, minWidth: '100px' }}>Reason</div>
                <div className="text-sm text-[hsl(var(--text-primary))] font-normal overflow-hidden whitespace-nowrap text-ellipsis" style={{ flex: 1.2, minWidth: '100px', paddingRight: '16px' }}>Channel</div>
              </div>

              {currentSessions.map((session) => (
                <div key={session.id} className="flex items-center bg-white min-h-[44px] pl-4 pr-3 border-b border-[rgba(0,0,0,0.06)] gap-3 hover:bg-[hsl(var(--surface-secondary))] last:border-b-0" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSessionSelect?.(session) }}>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1.5, minWidth: '100px', paddingLeft: '16px' }}>
                    <span className="text-xs text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.startTime}</span>
                  </div>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 0.8, minWidth: '60px' }}>
                    <span className="text-xs text-gray-500">{session.duration}</span>
                  </div>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 0.6, minWidth: '60px' }}>
                    <span className="text-xs text-gray-500">{session.messages}</span>
                  </div>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1.2, minWidth: '90px' }}>
                    <StatusBadge variant={OUTCOME_VARIANT[session.outcome] || 'success'}>{session.outcome}</StatusBadge>
                  </div>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1.4, minWidth: '100px' }}>
                    <span className="text-xs text-gray-500" style={{ color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.reason}</span>
                  </div>
                  <div className="text-sm text-[hsl(var(--text-primary))] flex items-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: 1.2, minWidth: '100px', paddingRight: '16px' }}>
                    <span className="text-xs text-gray-500" style={{ color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.channel}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sessions.length} startIndex={startIndex} endIndex={endIndex} onPageChange={setCurrentPage} />
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
