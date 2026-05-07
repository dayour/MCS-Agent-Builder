import React, { useState, useEffect } from 'react';
import {
  CalendarLtr20Regular,
  Copy20Regular,
  ThumbLike20Regular,
  ThumbDislike20Regular,
  ArrowLeft20Regular,
  ErrorCircle16Filled,
  CheckmarkCircle16Filled,
  Circle16Regular,
  ArrowDownload20Regular,
  ArrowClockwise20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  ChevronUp20Regular,
  People20Regular,
  Sparkle20Regular,
  Delete20Regular,
} from '@fluentui/react-icons';
import { getConnectorIcon } from '../../../utils/agentIcons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { ChainOfThoughtItem } from '../../../components/ui/ChainOfThought';
import { useAgent } from '../../../context/AgentContext';
import { useDW } from '../context/DWContext';
import { callModel } from '../../../utils/modelClient';
import { STATUS_CONFIG, STATUS_APPEAR_KEYFRAMES, formatTaskDate } from './DWOverviewTab';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityStatus = 'complete' | 'failed' | 'in-progress' | 'upcoming';

interface ActivityContext {
  from?: string;
  to?: string;
  toIsAgent?: boolean;
  body: string;
}

export interface DataCardRow {
  label?: string;
  value: string;
  isLink?: boolean;
  isError?: boolean;
}

export interface SubStep {
  id: string;
  title: string;
  status: 'complete' | 'failed' | 'pause' | 'pending';
  description?: string;
  connectorPill?: string;  // text that appears inline in description as a pill
  dataCard?: { rows: DataCardRow[] };
}

interface ActivityNode {
  id: string;
  title: string;
  subtitle?: string;       // label shown below title, e.g. "Connector action"
  timestamp: string;
  status: ActivityStatus;
  icon: 'outlook' | 'teams' | 'sharepoint' | 'excel' | 'word' | 'flash';
  context?: ActivityContext;
  connectorTag?: string;
  badges?: string[];       // chips like "only visible to makers"
  hasWarning?: boolean;    // red "!" warning badge
  errorBanner?: string;    // inline red error banner text
  errorBannerLink?: string;
  reasoning?: string;      // collapsible "Reasoning" text
  subSteps?: SubStep[];    // nested execution steps shown inside this item
}

export interface TaskArtifact {
  name: string;
  icon: 'word' | 'excel' | 'sharepoint' | 'teams' | 'outlook';
  openUrl?: string;
}

export interface TaskDetail {
  id: string;
  name: string;
  subtitle: string;
  lastUpdated: string;
  date?: string;        // ISO date — used for consistent date formatting
  summary: string;
  activities: ActivityNode[];
  artifacts?: TaskArtifact[];
  when?: string;
  objective?: string;
  status?: string;
  steps?: string[];
  errorMessage?: string;
  errorDetail?: string;
  errors?: Array<{ text: string; link?: string }>;
  teamsUrl?: string;
  channels?: string[];
}

// ── Module-scope constants ─────────────────────────────────────────────────────

const STATUS_SECTION_LABEL: Record<string, string> = {
  'in-progress': 'In Progress',
  incomplete: 'Incomplete',
  complete: 'Complete',
  blocked: 'Blocked',
  upcoming: 'Upcoming',
};


// ── Per-task detail data ───────────────────────────────────────────────────────

export const TASK_DETAILS: Record<string, Omit<TaskDetail, 'id' | 'name' | 'subtitle' | 'lastUpdated'>> = {
  '1': {
    summary: 'The agent sent a lunch order request via Outlook to all 12 team members. So far 9 responses have been collected. Replies are being compiled into a purchase order in SharePoint. 3 responses are still pending.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_abc123@thread.v2/1234567890',
    channels: ['#lunch-orders'],
    artifacts: [
      { name: 'Lunch Order Purchase.xlsx', icon: 'excel' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Ask everyone on the team for their lunch order',
        timestamp: 'Today at 11:05 AM',
        status: 'complete',
        icon: 'outlook',
        connectorTag: 'Campaign goals',
        context: {
          from: 'Lunch Order Agent',
          to: 'Team (12 members)',
          body: "Hi team! Please reply to this email with your lunch order by 11:30 AM. We'll be placing the group order at noon.\n\nOptions today include sandwiches, salads, and hot meals from the cafeteria menu. Looking forward to your responses!",
        },
      },
      {
        id: 'a2',
        title: 'Reply from Mona Kane',
        timestamp: 'Today at 11:06 AM',
        status: 'complete',
        icon: 'outlook',
        context: {
          from: 'Mona Kane',
          to: 'Lunch Order Agent',
          toIsAgent: true,
          body: "I'll have the Caesar salad with a side of garlic bread, and a sparkling water. Thanks!",
        },
      },
      {
        id: 'a3',
        title: 'Add to purchase order',
        timestamp: 'Today at 11:07 AM',
        status: 'complete',
        icon: 'flash',
        connectorTag: 'Sales',
        context: {
          body: "Added Mona Kane's order to the purchase order in SharePoint.\n\nCaesar salad · Garlic bread · Sparkling water\n\nRunning total: 1 of 12 responses collected.",
        },
      },
      {
        id: 'a4',
        title: 'Reply from Miguel Silva',
        timestamp: 'Today at 11:08 AM',
        status: 'complete',
        icon: 'outlook',
        context: {
          from: 'Miguel Silva',
          to: 'Lunch Order Agent',
          toIsAgent: true,
          body: "Hi! Can I get the pepperoni pizza slice and an iced tea? Thanks a lot.",
        },
      },
      {
        id: 'a5',
        title: 'Add to purchase order',
        timestamp: 'Today at 11:08 AM',
        status: 'in-progress',
        icon: 'flash',
        context: {
          body: "Adding Miguel Silva's order to the purchase order in SharePoint.\n\nPepperoni pizza · Iced tea\n\nCurrently processing — 2 of 12 responses collected.",
        },
      },
    ],
  },
  '2': {
    summary: 'The agent pulled the latest project timeline from SharePoint and posted a summary in the Teams channel. It identified 3 tasks at risk of slipping and suggested updated deadlines. The Gantt chart is currently being revised.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_def456@thread.v2/9876543210',
    channels: ['#project-updates'],
    artifacts: [
      { name: 'Project Timeline Q3 2025.xlsx', icon: 'excel' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Retrieved project timeline data',
        timestamp: 'Today at 9:00 AM',
        status: 'complete',
        icon: 'sharepoint',
        connectorTag: 'Designer',
        context: {
          body: "Retrieved 'Project Timeline Q3 2025.xlsx' from SharePoint.\n\nLast modified: Today at 8:58 AM by James Okafor. Document contains 38 tasks across 5 workstreams.",
        },
      },
      {
        id: 'a2',
        title: 'Discuss the project timeline with the team',
        timestamp: 'Today at 9:05 AM',
        status: 'complete',
        icon: 'teams',
        context: {
          from: 'Timeline Agent',
          to: '#project-updates',
          body: "Team, I've reviewed our Q3 project timeline. Here's a quick summary:\n\n3 tasks are at risk of slipping their deadlines — User Testing, Accessibility Review, and Final QA. I'm preparing updated deadline recommendations now and will share shortly.",
        },
      },
      {
        id: 'a3',
        title: 'Identify timeline gaps',
        timestamp: 'Today at 9:10 AM',
        status: 'complete',
        icon: 'flash',
        connectorTag: 'Sales',
        context: {
          body: "Identified 3 tasks at risk:\n\n• User Testing — 2 days behind schedule\n• Accessibility Review — overdue by 1 day\n• Final QA — projected to slip by 3 days\n\nRecommended adjustments prepared.",
        },
      },
      {
        id: 'a4',
        title: 'Update Gantt chart',
        timestamp: 'Today at 9:15 AM',
        status: 'in-progress',
        icon: 'flash',
        context: {
          body: "Updating Gantt chart in 'Project Timeline Q3 2025.xlsx' with revised deadlines.\n\nCurrently processing rows 14–22 of 38.",
        },
      },
    ],
  },
  '3': {
    summary: 'The agent gathered Q2 financial data from SharePoint, ran budget projections, and created a summary spreadsheet. The finalized report was emailed to all stakeholders via Outlook. All steps completed successfully.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_ghi789@thread.v2/1122334455',
    channels: ['#finance', '#stakeholders'],
    artifacts: [
      { name: 'Q2 Budget Summary.xlsx', icon: 'excel' },
      { name: 'Q2 Financial Data.xlsx', icon: 'sharepoint' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Retrieved Q2 financial data',
        timestamp: 'Yesterday at 3:00 PM',
        status: 'complete',
        icon: 'sharepoint',
        connectorTag: 'Campaign goals',
        context: {
          body: "Retrieved 'Q2 Financial Data.xlsx' from SharePoint.\n\n847 rows of transaction data. Last modified: Yesterday at 2:45 PM by Priya Nair.",
        },
      },
      {
        id: 'a2',
        title: 'Calculate budget projections',
        timestamp: 'Yesterday at 3:05 PM',
        status: 'complete',
        icon: 'flash',
        context: {
          body: "Calculated budget projections based on Q2 actuals.\n\nTotal spend: $1.24M vs. $1.18M budget (+5.1%)\nTop variance: Marketing +$42K, Infrastructure –$18K\n\nProjections compiled and ready for report.",
        },
      },
      {
        id: 'a3',
        title: 'Created Q2 Budget Summary.xlsx',
        timestamp: 'Yesterday at 3:12 PM',
        status: 'complete',
        icon: 'excel',
        connectorTag: 'Designer',
        context: {
          body: "Created 'Q2 Budget Summary.xlsx' and saved to SharePoint.\n\nSheets: Executive Summary, Department Breakdown, Variance Analysis, Q3 Forecast.\n\nFile shared with stakeholders group.",
        },
      },
      {
        id: 'a4',
        title: 'Sent budget report to stakeholders',
        timestamp: 'Yesterday at 3:20 PM',
        status: 'complete',
        icon: 'outlook',
        context: {
          from: 'Budget Agent',
          to: 'Stakeholders (8 recipients)',
          body: "Please find attached the Q2 Budget Summary report.\n\nKey highlights: total spend was 5.1% over budget, driven primarily by the Marketing department. Full variance analysis and Q3 projections are in the attached spreadsheet.",
        },
      },
    ],
  },
  '4': {
    summary: 'The agent initiated a project deadline discussion in the team Teams channel and retrieved the current timeline from SharePoint. It is currently identifying conflicts and preparing deadline recommendations.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_jkl012@thread.v2/5566778899',
    channels: ['#project-deadlines'],
    activities: [
      {
        id: 'a1',
        title: 'Started deadline discussion in channel',
        timestamp: 'Today at 8:00 AM',
        status: 'complete',
        icon: 'teams',
        context: {
          from: 'Deadline Agent',
          to: '#project-deadlines',
          body: "Hi team, I'm kicking off our deadline review for the current sprint. I'll be pulling the latest timeline from SharePoint and sharing conflict analysis and recommendations shortly.",
        },
      },
      {
        id: 'a2',
        title: 'Accessed project timeline',
        timestamp: 'Today at 8:02 AM',
        status: 'complete',
        icon: 'sharepoint',
        connectorTag: 'Designer',
        context: {
          body: "Retrieved 'Sprint 14 Timeline.xlsx' from SharePoint.\n\n23 tasks tracked across 4 teams. Last modified: Today at 7:55 AM by Robin Counts.",
        },
      },
      {
        id: 'a3',
        title: 'Identify deadline conflicts',
        timestamp: 'Today at 8:10 AM',
        status: 'in-progress',
        icon: 'flash',
        connectorTag: 'Sales',
        context: {
          body: "Analyzing task dependencies and identifying deadline conflicts across 23 tasks.\n\nCurrently processing dependency graph — step 2 of 4.",
        },
      },
      {
        id: 'a4',
        title: 'Share deadline recommendations',
        timestamp: 'Today at 8:20 AM',
        status: 'upcoming',
        icon: 'teams',
        context: {
          body: "Scheduled to post deadline recommendations to #project-deadlines once conflict analysis is complete.",
        },
      },
    ],
  },
  '5': {
    summary: 'The agent collected weekly metrics from SharePoint, drafted a status report, and emailed it to all stakeholders via Outlook. A Word document was also created and saved to OneDrive for reference.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_mno345@thread.v2/6677889900',
    channels: ['#weekly-reports'],
    artifacts: [
      { name: 'Weekly Status Report - Week 28.docx', icon: 'word' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Gathered weekly metrics from SharePoint',
        timestamp: 'Yesterday at 10:00 AM',
        status: 'complete',
        icon: 'sharepoint',
        connectorTag: 'Campaign goals',
        context: {
          body: "Retrieved weekly metrics from 'Team Metrics Dashboard' in SharePoint.\n\nData covers July 7–13: sprint velocity, bug count, deployment stats, and team utilization.",
        },
      },
      {
        id: 'a2',
        title: 'Draft weekly status report',
        timestamp: 'Yesterday at 10:10 AM',
        status: 'complete',
        icon: 'flash',
        context: {
          body: "Drafted weekly status report.\n\n• Sprint velocity: 94% (47 of 50 points)\n• Bugs resolved: 3 P1, 7 P2\n• Deployments: 1 successful release\n\nReport ready for document creation.",
        },
      },
      {
        id: 'a3',
        title: 'Created Weekly Status Report.docx',
        timestamp: 'Yesterday at 10:18 AM',
        status: 'complete',
        icon: 'word',
        connectorTag: 'Designer',
        context: {
          body: "Created 'Weekly Status Report - Week 28.docx' and saved to OneDrive.\n\nDocument includes executive summary, team highlights, metrics dashboard, and next-week priorities.",
        },
      },
      {
        id: 'a4',
        title: 'Sent status update to stakeholders',
        timestamp: 'Yesterday at 10:25 AM',
        status: 'complete',
        icon: 'outlook',
        context: {
          from: 'Status Report Agent',
          to: 'Stakeholders (12 recipients)',
          body: "Weekly status report for Week 28 is attached.\n\nHighlights: Sprint velocity at 94%, all P1 bugs resolved, one successful deployment. Full report in the attached document — please reach out with any questions.",
        },
      },
    ],
  },
  '6': {
    summary: 'The agent is scheduled to find an optimal meeting time for all Q2 planning attendees and send calendar invites via Teams. This task is upcoming and has not started yet.',
    activities: [
      {
        id: 'a1',
        title: 'Find optimal meeting time',
        timestamp: 'Scheduled for tomorrow',
        status: 'upcoming',
        icon: 'flash',
        context: {
          body: "Will analyze calendar availability for all 8 Q2 planning attendees and find the optimal 90-minute slot within the next two weeks.",
        },
      },
      {
        id: 'a2',
        title: 'Send Q2 planning meeting invite',
        timestamp: 'Scheduled for tomorrow',
        status: 'upcoming',
        icon: 'teams',
        context: {
          body: "Will send a Teams meeting invite to all 8 attendees once the optimal time has been identified.",
        },
      },
    ],
  },
  '7': {
    summary: 'The agent attempted to schedule a client meeting by querying calendar availability, but the SchedulerConnector failed to retrieve open time slots. The connection to the scheduling service timed out after 3 retries.',
    errorMessage: 'SchedulerConnector GetAvailableSlots failed',
    errorDetail: 'The SchedulerConnector returned a 503 Service Unavailable error after 3 consecutive retries. The upstream scheduling service appears to be experiencing an outage. Last successful connection was 2 hours ago. Recommended action: verify service health at https://status.scheduler.internal and retry.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:meeting_err999@thread.v2/1010101010',
    channels: ['#scheduling', '#sales'],
    artifacts: [
      { name: 'Meeting Request Draft.docx', icon: 'word' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Retrieved client contact information',
        timestamp: 'Today at 2:00 PM',
        status: 'complete',
        icon: 'outlook',
        connectorTag: 'Sales',
        context: {
          body: "Retrieved contact details for Contoso Ltd. from Outlook contacts.\n\n3 attendees identified: Sarah Chen (PM), David Park (Engineering Lead), Lisa Wong (Design Lead).",
        },
      },
      {
        id: 'a2',
        title: 'Query calendar availability',
        timestamp: 'Today at 2:02 PM',
        status: 'complete',
        icon: 'flash',
        connectorTag: 'Campaign goals',
        context: {
          body: "Queried internal calendar for all 3 attendees.\n\nAvailable windows identified for next 5 business days.",
        },
      },
      {
        id: 'a3',
        title: 'SchedulerConnector GetAvailableSlots',
        timestamp: 'Today at 2:05 PM',
        status: 'failed',
        icon: 'flash',
        connectorTag: 'Sales',
        context: {
          body: "Connection to the scheduling service failed after 3 retries. The connector returned a 503 Service Unavailable error.\n\nLast successful connection: Today at 12:05 PM.\nEndpoint: scheduler.internal/api/v2/slots",
        },
      },
      {
        id: 'a4',
        title: 'Send meeting invite',
        timestamp: 'Today at 2:10 PM',
        status: 'upcoming',
        icon: 'teams',
        context: {
          body: "Blocked — cannot send meeting invite until available time slots are retrieved from the scheduling service.",
        },
      },
    ],
  },
  h1: {
    summary: 'The agent pulled Q1 financial data from SharePoint, synthesized figures across 5 workstreams, and produced a 2-page executive brief. The document was shared to the #finance-leadership Teams channel.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:finance_leadership@thread.v2/fin001',
    channels: ['#finance-leadership'],
    artifacts: [
      { name: 'Q1 Executive Brief.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Finance/Shared%20Documents/Q1%20Executive%20Brief.docx' },
      { name: 'Q1 Financials Summary.xlsx', icon: 'excel', openUrl: 'ms-excel:ofe|u|https://contoso.sharepoint.com/sites/Finance/Shared%20Documents/Q1%20Financials%20Summary.xlsx' },
    ],
    activities: [
      {
        id: 'a1', title: 'Retrieved Q1 financial data', timestamp: '2 hours ago at 9:45 AM',
        status: 'complete', icon: 'sharepoint', connectorTag: 'SharePoint',
        context: { body: "Retrieved 'Q1 Financials.xlsx' from Finance SharePoint.\n\nCovers 5 workstreams: Engineering, Marketing, Sales, Product, Operations. Total rows: 284." },
      },
      {
        id: 'a2', title: 'Synthesized key metrics', timestamp: '2 hours ago at 9:52 AM',
        status: 'complete', icon: 'flash',
        context: { body: "Identified top 3 highlights:\n• Revenue $4.2M — 6% above forecast\n• OPEX $3.84M — 3.6% over budget driven by Marketing\n• Net margin 8.6% — in line with plan" },
      },
      {
        id: 'a3', title: 'Drafted executive brief', timestamp: '2 hours ago at 9:58 AM',
        status: 'complete', icon: 'flash', connectorTag: 'Word',
        context: { body: "Generated 2-page executive brief in Word.\n\nIncludes: summary table, variance analysis, 3 recommended actions for leadership review." },
      },
      {
        id: 'a4', title: 'Posted to #finance-leadership', timestamp: '2 hours ago at 10:01 AM',
        status: 'complete', icon: 'teams', connectorTag: 'Teams',
        context: { from: 'AI Teammate', to: '#finance-leadership', body: "Q1 Executive Brief is ready for review. Key takeaway: revenue 6% above forecast, OPEX slightly over on Marketing. Full doc attached." },
      },
    ],
  },
  h7: {
    summary: 'The agent is pulling the latest actuals from Excel and cross-referencing against the Q1 forecast. Anomalies are being flagged for review. The variance report is currently being generated.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:finance_ops@thread.v2/bv001',
    channels: ['#finance-ops'],
    artifacts: [
      { name: 'Budget Variance Q1.xlsx', icon: 'excel', openUrl: 'ms-excel:ofe|u|https://contoso.sharepoint.com/sites/Finance/Shared%20Documents/Budget%20Variance%20Q1.xlsx' },
    ],
    activities: [
      {
        id: 'a1', title: 'Retrieved actuals from Excel', timestamp: 'Just now',
        status: 'complete', icon: 'excel', connectorTag: 'Excel',
        context: { body: "Retrieved actuals from 'Q1 Actuals.xlsx' on SharePoint.\n\n6 departments, 284 line items. Data as of March 15, 2026." },
      },
      {
        id: 'a2', title: 'Cross-referenced against forecast', timestamp: 'Just now',
        status: 'complete', icon: 'flash',
        context: { body: "Compared actuals vs. forecast across all departments.\n\nTotal variance: +$133,500 (+3.6%)\nMarketing and Product are over budget. Engineering and Operations under." },
      },
      {
        id: 'a3', title: 'Flagging anomalies and writing variance report', timestamp: 'Just now',
        status: 'in-progress', icon: 'flash', connectorTag: 'Excel',
        context: { body: "Writing variance analysis to 'Budget Variance Q1.xlsx'.\n\nCurrently processing Marketing anomaly: $42K overage (+7.2%). Identifying root cause from spend categories…" },
      },
    ],
  },
  h2: {
    summary: 'The agent joined the standup call, transcribed key updates from each team member, and distributed a formatted notes document to the #team-updates channel.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:team_updates@thread.v2/su001',
    channels: ['#team-updates'],
    artifacts: [
      { name: 'Standup Notes — March 17.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Team/Shared%20Documents/Standup%20Notes%20March%2017.docx' },
    ],
    activities: [
      {
        id: 'a1', title: 'Joined standup call', timestamp: 'Yesterday at 9:30 AM',
        status: 'complete', icon: 'teams', connectorTag: 'Teams',
        context: { body: "Joined 'Daily Standup' recurring meeting in Teams.\n\n8 attendees present. Recording started." },
      },
      {
        id: 'a2', title: 'Transcribed updates', timestamp: 'Yesterday at 9:45 AM',
        status: 'complete', icon: 'flash',
        context: { body: "Captured updates from 7 team members.\n\n3 blockers identified, 2 items marked for follow-up. Summary ready for distribution." },
      },
      {
        id: 'a3', title: 'Distributed notes to #team-updates', timestamp: 'Yesterday at 9:47 AM',
        status: 'complete', icon: 'teams', connectorTag: 'Teams',
        context: { from: 'AI Teammate', to: '#team-updates', body: "📋 Standup notes from March 17 are ready.\n\nBlockers: 2 open items in #engineering-backlog. Follow-ups: Ana to confirm timeline for onboarding pack. Full doc attached." },
      },
    ],
  },
  h10: {
    summary: 'The agent pulled competitor data from SharePoint and began updating the analysis document, but the SharePoint connector lost authentication mid-write. The draft was partially updated before the failure.',
    errorMessage: 'SharePoint connector authentication expired',
    errorDetail: 'The SharePoint OAuth token expired during the write operation. The connector attempted to refresh the token but received a 401 Unauthorized response. The partial draft has been saved locally. Reconnect the SharePoint connector and retry to complete the update.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:channel_competitors@thread.v2/comp001',
    channels: ['#competitive-intel'],
    artifacts: [
      { name: 'Competitor Analysis March 2026.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Strategy/Shared%20Documents/Competitor%20Analysis%20March%202026.docx' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Retrieved competitor data from SharePoint',
        timestamp: '4 days ago at 10:00 AM',
        status: 'complete',
        icon: 'sharepoint',
        connectorTag: 'SharePoint',
        context: { body: "Retrieved 'Competitor Landscape Q1.xlsx' from the Strategy SharePoint site.\n\n6 competitors tracked. Last updated by James Okafor 3 days prior." },
      },
      {
        id: 'a2',
        title: 'Analyzed new product announcements',
        timestamp: '4 days ago at 10:05 AM',
        status: 'complete',
        icon: 'flash',
        context: { body: "Processed 14 press releases and 3 product changelog pages.\n\n3 competitors launched AI-native features in the last 90 days: Fabrikam, Northwind, and Tailspin." },
      },
      {
        id: 'a3',
        title: 'Write updated analysis to SharePoint document',
        timestamp: '4 days ago at 10:12 AM',
        status: 'failed',
        icon: 'sharepoint',
        connectorTag: 'SharePoint',
        context: { body: "Authentication token expired mid-write to 'Competitor Analysis March 2026.docx'.\n\nPartial update saved (sections 1–3 of 7). Sections 4–7 were not written. Connector returned 401 Unauthorized." },
      },
    ],
  },
  h3: {
    summary: 'The agent reviewed 3 vendor contracts from SharePoint, flagged 7 key clauses across liability, SLA, and termination terms, and emailed a risk summary to the legal team via Outlook.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:legal@thread.v2/h3001',
    channels: ['#legal'],
    artifacts: [
      { name: 'Vendor Contract Risk Summary.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Legal/Shared%20Documents/Vendor%20Contract%20Risk%20Summary.docx' },
    ],
    activities: [
      { id: 'a1', title: 'Retrieved vendor contracts from SharePoint', timestamp: '2 days ago', status: 'complete', icon: 'sharepoint', connectorTag: 'SharePoint', context: { body: 'Retrieved 3 vendor contracts. Total: 84 pages.' } },
      { id: 'a2', title: 'Flagged key clauses and risk items', timestamp: '2 days ago', status: 'complete', icon: 'flash', context: { body: '7 clauses flagged: 3 liability, 2 SLA, 2 termination.' } },
      { id: 'a3', title: 'Emailed risk summary to legal team', timestamp: '2 days ago', status: 'complete', icon: 'outlook', connectorTag: 'Outlook', context: { from: 'AI Teammate', to: 'legal@contoso.com', body: 'Vendor contract review complete. 7 risk items flagged for review.' } },
    ],
  },
  h4: {
    summary: 'The agent aggregated NPS scores and support ticket themes from Outlook, identified top 3 recurring feedback patterns, and compiled a weekly digest shared to the #cx-feedback channel.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:cx_feedback@thread.v2/h4001',
    channels: ['#cx-feedback'],
    artifacts: [
      { name: 'Customer Feedback Digest — Week 12.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/CX/Shared%20Documents/Customer%20Feedback%20Digest%20Week%2012.docx' },
    ],
    activities: [
      { id: 'a1', title: 'Pulled NPS scores and support tickets', timestamp: '3 days ago', status: 'complete', icon: 'outlook', connectorTag: 'Outlook', context: { body: '142 tickets and 89 NPS responses collected for the week.' } },
      { id: 'a2', title: 'Identified recurring feedback patterns', timestamp: '3 days ago', status: 'complete', icon: 'flash', context: { body: 'Top patterns: onboarding friction (31%), slow support response (24%), missing export feature (18%).' } },
      { id: 'a3', title: 'Compiled and distributed weekly digest', timestamp: '3 days ago', status: 'complete', icon: 'teams', connectorTag: 'Teams', context: { from: 'AI Teammate', to: '#cx-feedback', body: 'Week 12 customer feedback digest is ready. Top issue: onboarding friction.' } },
    ],
  },
  h5: {
    summary: 'The agent assembled a new hire onboarding pack including a welcome document, role checklist, and first-week schedule. All files were uploaded to the SharePoint onboarding site.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:onboarding@thread.v2/h5001',
    channels: ['#onboarding'],
    artifacts: [
      { name: 'New Hire Welcome Guide.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/HR/Shared%20Documents/New%20Hire%20Welcome%20Guide.docx' },
      { name: 'Onboarding Checklist.xlsx', icon: 'excel', openUrl: 'ms-excel:ofe|u|https://contoso.sharepoint.com/sites/HR/Shared%20Documents/Onboarding%20Checklist.xlsx' },
    ],
    activities: [
      { id: 'a1', title: 'Retrieved onboarding templates from SharePoint', timestamp: '5 days ago', status: 'complete', icon: 'sharepoint', connectorTag: 'SharePoint', context: { body: 'Retrieved 4 templates from HR SharePoint site.' } },
      { id: 'a2', title: 'Drafted welcome guide and checklist', timestamp: '5 days ago', status: 'complete', icon: 'flash', context: { body: 'Generated 12-page welcome guide and 34-item role checklist.' } },
      { id: 'a3', title: 'Uploaded pack to SharePoint', timestamp: '5 days ago', status: 'complete', icon: 'sharepoint', connectorTag: 'SharePoint', context: { body: 'Uploaded 2 documents to HR/Onboarding folder.' } },
    ],
  },
  h6: {
    summary: 'The agent collected sprint retrospective feedback from the team via Teams, synthesized themes into 4 action items, and posted a formatted summary to the #eng-retro channel.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:eng_retro@thread.v2/h6001',
    channels: ['#eng-retro'],
    artifacts: [
      { name: 'Sprint Retro Summary — March.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/Eng/Shared%20Documents/Sprint%20Retro%20March.docx' },
    ],
    activities: [
      { id: 'a1', title: 'Collected team feedback via Teams', timestamp: '1 week ago', status: 'complete', icon: 'teams', connectorTag: 'Teams', context: { body: '11 responses collected from the team.' } },
      { id: 'a2', title: 'Synthesized themes and action items', timestamp: '1 week ago', status: 'complete', icon: 'flash', context: { body: '4 action items identified: improve PR review SLA, add integration test coverage, reduce standup length, schedule design sync.' } },
      { id: 'a3', title: 'Posted summary to #eng-retro', timestamp: '1 week ago', status: 'complete', icon: 'teams', connectorTag: 'Teams', context: { from: 'AI Teammate', to: '#eng-retro', body: 'Sprint retro summary posted. 4 action items assigned.' } },
    ],
  },
  h8: {
    summary: 'The agent reviewed stakeholder feedback from SharePoint, updated the product roadmap priorities for Q2, and posted the revised roadmap to the #product channel in Teams.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:product@thread.v2/h8001',
    channels: ['#product'],
    artifacts: [
      { name: 'Product Roadmap Q2 2026.pptx', icon: 'sharepoint', openUrl: 'ms-powerpoint:ofe|u|https://contoso.sharepoint.com/sites/Product/Shared%20Documents/Product%20Roadmap%20Q2%202026.pptx' },
    ],
    activities: [
      { id: 'a1', title: 'Retrieved stakeholder feedback from SharePoint', timestamp: '30 min ago', status: 'complete', icon: 'sharepoint', connectorTag: 'SharePoint', context: { body: 'Retrieved feedback doc with 23 comments from 6 stakeholders.' } },
      { id: 'a2', title: 'Updated roadmap priorities', timestamp: '30 min ago', status: 'complete', icon: 'flash', context: { body: 'Reprioritized 4 features based on stakeholder input. 2 items moved to Q3.' } },
      { id: 'a3', title: 'Posted roadmap update to #product', timestamp: '30 min ago', status: 'complete', icon: 'teams', connectorTag: 'Teams', context: { from: 'AI Teammate', to: '#product', body: 'Q2 roadmap updated with stakeholder feedback. 4 priorities shifted.' } },
    ],
  },
  h9: {
    summary: 'The agent compiled status updates from all workstream leads via Teams, synthesized them into a formatted weekly report, and distributed it to stakeholders via Outlook.',
    teamsUrl: 'https://teams.microsoft.com/l/message/19:status_reports@thread.v2/h9001',
    channels: ['#status-reports'],
    artifacts: [
      { name: 'Weekly Status Report — Week 12.docx', icon: 'word', openUrl: 'ms-word:ofe|u|https://contoso.sharepoint.com/sites/PMO/Shared%20Documents/Weekly%20Status%20Report%20Week%2012.docx' },
    ],
    activities: [
      { id: 'a1', title: 'Collected updates from workstream leads', timestamp: '1 hour ago', status: 'complete', icon: 'teams', connectorTag: 'Teams', context: { body: 'Gathered updates from 6 workstream leads in #status-updates.' } },
      { id: 'a2', title: 'Synthesized weekly report', timestamp: '1 hour ago', status: 'complete', icon: 'flash', context: { body: 'Compiled 2-page report covering Engineering, Product, Design, Marketing, Sales, and Operations.' } },
      { id: 'a3', title: 'Distributed report via Outlook', timestamp: '1 hour ago', status: 'complete', icon: 'outlook', connectorTag: 'Outlook', context: { from: 'AI Teammate', to: 'stakeholders@contoso.com', body: 'Week 12 status report attached. Key highlight: Engineering on track, Marketing 1 week behind.' } },
    ],
  },
  h11: {
    summary: 'Brief: Create a detailed B2B marketing campaign for technology company Contoso\'s new product launch. It should cover: target audience definition, core value proposition, primary marketing channels, key messaging themes, and success metrics. Contoso offers a cloud-based enterprise software product competing in a crowded market. Write in a professional, strategic tone with concrete tactics rather than high-level buzzwords.',
    errors: [
      { text: 'Connector configuration error: Message providing information to the user with actionable insights.', link: '#' },
      { text: 'Retry to connect error: Message providing information to the user with actionable insights.', link: '#' },
    ],
    teamsUrl: 'https://teams.microsoft.com/l/message/19:marketing@thread.v2/mkt001',
    channels: ['#marketing'],
    artifacts: [
      { name: 'Data Handling Policy v3.2.docx', icon: 'word', openUrl: 'ms-word:ofe|u|' + window.location.origin + '/demo-files/contract-review.docx' },
      { name: 'Compliance Checklist Q1 2026.xlsx', icon: 'excel', openUrl: 'ms-excel:ofe|u|' + window.location.origin + '/demo-files/compliance-checklist.xlsx' },
      { name: 'Audit Evidence — Access Controls.pdf', icon: 'sharepoint', openUrl: window.location.origin + '/demo-files/audit-evidence.pdf' },
      { name: 'Privacy Impact Assessment.docx', icon: 'word', openUrl: 'ms-word:ofe|u|' + window.location.origin + '/demo-files/competitor-analysis.docx' },
      { name: 'Vendor Risk Matrix.xlsx', icon: 'excel', openUrl: 'ms-excel:ofe|u|' + window.location.origin + '/demo-files/vendor-risk-matrix.xlsx' },
      { name: 'Training Completion Report.csv', icon: 'sharepoint', openUrl: window.location.origin + '/demo-files/training-completion.csv' },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Detected new PR',
        subtitle: 'Connector action',
        timestamp: 'Just now',
        status: 'failed',
        icon: 'flash',
        connectorTag: 'GitHub connector',
        badges: ['only visible to makers'],
        hasWarning: true,
        errorBanner: 'Connector configuration error  Message providing information to the user with actionable insights.',
        errorBannerLink: '#',
        reasoning: 'The agent detected a new pull request that overlaps with an existing PR. It attempted to comment on the PR and add a label to the related issue, but lacked the required write permissions on the GitHub integration.',
        subSteps: [
          {
            id: 's1',
            title: 'New PR',
            status: 'complete',
            description: 'The agent determined that invoking the GitHub connector to retrieve the PR details.',
            connectorPill: 'GitHub connector',
            dataCard: {
              rows: [
                { label: 'PR', value: 'contoso/search-ui#387', isLink: true },
                { label: 'By', value: 'Priya Nair', isLink: true },
              ],
            },
          },
          {
            id: 's2',
            title: 'Read PR contents',
            status: 'complete',
            description: 'The agent identified and used the GitHub connector to retrieve any overlaps',
            connectorPill: 'GitHub connector',
          },
          {
            id: 's3',
            title: 'Identified overlap',
            status: 'complete',
            dataCard: {
              rows: [
                { label: 'PR', value: '384', isLink: true },
                { label: 'By', value: 'Rina', isLink: true },
              ],
            },
          },
          {
            id: 's4',
            title: 'Checked issue #358',
            status: 'complete',
            description: 'The agent identified and used the GitHub connector to confirmed both PRs reference the same issue',
            connectorPill: 'GitHub connector',
          },
          {
            id: 's5',
            title: 'Post comment on PR #387',
            status: 'failed',
            description: 'The agent attempted to comment but does not have permissions',
            dataCard: {
              rows: [
                { value: 'Error code:  403 Forbidden: Resource not accessible by integration.\nRequired scope: write permission on issues and pull requests.', isError: true },
              ],
            },
          },
          {
            id: 's6',
            title: 'Add label to issue #358',
            status: 'failed',
            description: 'The agent attempted to add a label but got the same error.',
          },
          {
            id: 's7',
            title: 'Fallback: reach out to Rina',
            status: 'complete',
            description: 'Message Rina in Teams was successful',
          },
          {
            id: 's8',
            title: 'Pause remaining tasks',
            status: 'pause',
            description: "Waiting on Avery's approval",
          },
        ],
      },
    ],
  },
  default: {
    summary: 'The agent is processing this task. Activity details will appear here as steps are completed.',
    activities: [
      {
        id: 'a1',
        title: 'Task initiated',
        timestamp: 'Just now',
        status: 'in-progress',
        icon: 'flash',
        context: { body: 'Task is being processed.' },
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────


function StatusBadge({ status }: { status?: string }) {
  const sc = status ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] : null;
  if (!sc) return null;
  return (
    <div className={`inline-flex items-center justify-start gap-1.5 pl-2 pr-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap w-[108px] ${sc.textColor} ${sc.bgColor} border ${sc.borderColor}`}>
      {sc.icon}
      <span>{sc.label}</span>
    </div>
  );
}

/** Render activity headerText with optional connector tag, badges, and warning indicator */
function activityHeaderWithTag(
  title: string,
  connectorTag?: string,
  badges?: string[],
  hasWarning?: boolean,
): React.ReactNode {
  if (!connectorTag && !badges?.length && !hasWarning) return title;
  return (
    <span className="flex items-center gap-1.5 flex-wrap leading-snug">
      <span>{title}</span>
      {badges?.map(badge => (
        <span key={badge} className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-normal border border-neutral-200 leading-tight">
          {badge}
        </span>
      ))}
      {hasWarning && (
        <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 leading-none">
          <span className="text-white text-[10px] font-bold leading-none">!</span>
        </span>
      )}
      {connectorTag && (
        <span className="text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-normal">{connectorTag}</span>
      )}
    </span>
  );
}

// ── DW-specific helper sub-components ─────────────────────────────────────────

/** Inline red error banner shown inside an activity item */
function DwErrorBanner({ text, link }: { text: string; link?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
      <ErrorCircle16Filled className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      <span className="flex-1 leading-5">{text}</span>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-red-600 underline flex-shrink-0 hover:text-red-800">Link</a>
      )}
    </div>
  );
}

/** Collapsible "Reasoning >" toggle */
function DwReasoningToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <CopilotButton
        variant="transparent"
        size="sm"
        onClick={() => setOpen(v => !v)}
        icon={open ? <ChevronDown20Regular className="w-3.5 h-3.5" /> : <ChevronRight20Regular className="w-3.5 h-3.5" />}
        iconPosition="right"
        className="text-[12px] text-neutral-500 px-0 h-auto"
      >
        Reasoning
      </CopilotButton>
      {open && <p className="mt-1.5 text-[12px] text-neutral-500 leading-5">{text}</p>}
    </div>
  );
}

/** Inline connector pill embedded in description text */
function DwConnectorPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[11px] border border-neutral-200 align-middle font-normal">
      {label}
    </span>
  );
}

/** Data card with labelled rows and a copy button (PR info, error codes, etc.) */
function DwDataCard({ rows }: { rows: DataCardRow[] }) {
  const copyText = rows.map(r => r.label ? `${r.label}: ${r.value}` : r.value).join('\n');
  return (
    <div className="mt-2 rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-start">
        <div className="flex-1 px-3 py-2.5 space-y-1.5 min-w-0">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-3 text-[12px]">
              {row.label && (
                <span className="text-neutral-400 w-6 flex-shrink-0 leading-5">{row.label}</span>
              )}
              {row.label && <span className="text-neutral-300 leading-5">:</span>}
              <span className={`${row.isLink ? 'text-blue-600' : row.isError ? 'text-red-600' : 'text-neutral-700'} leading-5 whitespace-pre-line`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <CopilotButton
          variant="icon-subtle"
          size="sm"
          icon={<Copy20Regular className="w-4 h-4" />}
          title="Copy"
          onClick={() => navigator.clipboard?.writeText(copyText).catch(() => {})}
          className="flex-shrink-0 m-1"
        />
      </div>
    </div>
  );
}

/** A single sub-step inside a parent activity group */
function DwSubStep({ step }: { step: SubStep }) {
  const renderDescription = () => {
    if (!step.description) return null;
    if (step.connectorPill && step.description.includes(step.connectorPill)) {
      const parts = step.description.split(step.connectorPill);
      return (
        <p className="text-[12px] text-neutral-500 mt-0.5 leading-5">
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {part}
              {i < parts.length - 1 && <DwConnectorPill label={step.connectorPill!} />}
            </React.Fragment>
          ))}
        </p>
      );
    }
    return <p className="text-[12px] text-neutral-500 mt-0.5 leading-5">{step.description}</p>;
  };

  return (
    <div className="flex items-start gap-2">
      {/* Status icon */}
      <span className="mt-0.5 flex-shrink-0">
        {step.status === 'complete' && <CheckmarkCircle16Filled className="text-green-600 w-4 h-4" />}
        {step.status === 'failed' && <ErrorCircle16Filled className="text-red-500 w-4 h-4" />}
        {step.status === 'pause' && (
          <span className="flex items-center gap-0.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 flex-shrink-0" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 flex-shrink-0" />
          </span>
        )}
        {step.status === 'pending' && <Circle16Regular className="text-neutral-300 w-4 h-4" />}
      </span>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold leading-snug ${step.status === 'failed' ? 'text-red-700' : 'text-neutral-800'}`}>
          {step.title}
        </p>
        {renderDescription()}
        {step.dataCard && <DwDataCard rows={step.dataCard.rows} />}
      </div>
    </div>
  );
}

/** Collapsible bordered section labeled with status name or "Files" */
function DwStatusSection({
  label,
  defaultExpanded = true,
  children,
}: {
  label: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <CopilotButton
        variant="transparent"
        onClick={() => setOpen(v => !v)}
        className="w-full justify-between px-5 py-3 hover:bg-neutral-50 rounded-none"
      >
        <span className="text-sm font-semibold text-neutral-800">{label}</span>
        {open
          ? <ChevronUp20Regular className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          : <ChevronDown20Regular className="w-4 h-4 text-neutral-500 flex-shrink-0" />}
      </CopilotButton>
      {open && (
        <div className="px-5 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** Rich ChainOfThoughtItem that supports sub-steps, error banners, reasoning, and data cards */
function RichActivityItem({ activity }: { activity: ActivityNode }) {
  const hasSubSteps = !!activity.subSteps?.length;
  const headerContent = activityHeaderWithTag(
    activity.title,
    activity.connectorTag,
    activity.badges,
    activity.hasWarning,
  );
  const richChildren = (
    <div className="space-y-2">
      {activity.subtitle && (
        <p className="text-[11px] text-neutral-400 -mt-1 uppercase tracking-wide">{activity.subtitle}</p>
      )}
      {activity.errorBanner && (
        <DwErrorBanner text={activity.errorBanner} link={activity.errorBannerLink} />
      )}
      {activity.reasoning && <DwReasoningToggle text={activity.reasoning} />}
      {hasSubSteps ? (
        <div className="mt-3 space-y-4 pt-1">
          {activity.subSteps!.map(step => <DwSubStep key={step.id} step={step} />)}
        </div>
      ) : (
        activity.context?.body && (
          <p className="text-[13px] text-neutral-500 leading-5 whitespace-pre-line">{activity.context.body}</p>
        )
      )}
    </div>
  );

  const hasChildren = !!(
    activity.subtitle || activity.errorBanner || activity.reasoning ||
    hasSubSteps || activity.context?.body
  );

  return (
    <ChainOfThoughtItem
      headerText={headerContent}
      status={toCotStatus(activity.status)}
      defaultExpanded={
        activity.status === 'in-progress' ||
        activity.status === 'failed' ||
        hasSubSteps
      }
    >
      {hasChildren ? richChildren : undefined}
    </ChainOfThoughtItem>
  );
}

/** Map ActivityStatus to ChainOfThoughtItem status */
function toCotStatus(status: ActivityStatus): 'completed' | 'in-progress' | 'pending' | 'failed' {
  if (status === 'complete') return 'completed';
  if (status === 'in-progress') return 'in-progress';
  if (status === 'failed') return 'failed';
  return 'pending';
}

// ── Main component ────────────────────────────────────────────────────────────

interface DWTaskDetailPanelProps {
  task: TaskDetail;
  onClose: () => void;
}

export const DWTaskDetailPanel: React.FC<DWTaskDetailPanelProps> = ({ task, onClose }) => {
  const { agentConfig } = useAgent();
  const { updateDwTaskById } = useDW();
  const detail = TASK_DETAILS[task.id] ?? TASK_DETAILS.default;

  const displayStatus = task.status ?? 'upcoming';
  const displayName = task.name;
  const displayObjective = task.objective;

  const isUpcoming = displayStatus === 'upcoming';
  const isIncomplete = displayStatus === 'incomplete';
  const hasActivities = detail.activities.length > 0;

  const [steps, setSteps] = useState<string[]>(task.steps ?? []);
  const [generatingSteps, setGeneratingSteps] = useState(false);
  const [regenTrigger, setRegenTrigger] = useState(0);

  // Generate steps via LLM for upcoming tasks that don't have them yet
  useEffect(() => {
    if (!isUpcoming || steps.length > 0 || generatingSteps) return;
    if (!task.name) return;

    setGeneratingSteps(true);
    const prompt = `You are a planning assistant for an AI Teammate agent. Given a task name and objective, generate a concise list of 4–6 concrete execution steps the AI agent should take to complete this task.

Task name: ${task.name}
Objective: ${task.objective || task.name}

Return ONLY a JSON array of step strings. No explanations, no numbering, no markdown. Example: ["Step one", "Step two", "Step three"]`;

    callModel({
      model: 'fast',
      maxTokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }).then(raw => {
      try {
        const match = raw.match(/\[[\s\S]*\]/);
        const parsed: string[] = match ? JSON.parse(match[0]) : [];
        if (parsed.length > 0) {
          setSteps(parsed);
          updateDwTaskById(agentConfig.id, task.id, { steps: parsed });
        }
      } catch {
        // ignore parse errors
      }
    }).catch(() => {}).finally(() => setGeneratingSteps(false));
  // Intentionally only re-run when task.id or regenTrigger changes.
  // steps/generatingSteps are guards against concurrent runs — including them
  // would cause a loop (effect sets state → state change re-runs effect).
  // task.name/objective/agentConfig.id are stable for a given task.id and
  // don't need to re-trigger generation independently.
  }, [task.id, regenTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusSectionLabel = STATUS_SECTION_LABEL[displayStatus] ?? displayStatus;

  const downloadSummary = () => {
    const lines: string[] = [
      displayName,
      task.lastUpdated,
      '',
      'Summary',
      detail.summary || task.objective || '',
      '',
      'Steps',
      ...detail.activities.map((a, i) => `${i + 1}. ${a.title}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayName.replace(/\s+/g, '_')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      <style>{STATUS_APPEAR_KEYFRAMES}</style>
      <div className="flex-1 overflow-y-auto">
        <div className="pt-6 pb-8 space-y-5 w-full">

          {/* ── 1+2. Header + status row ────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CopilotButton
                variant="transparent"
                onClick={onClose}
                icon={<ArrowLeft20Regular className="w-5 h-5" />}
                className="px-0 flex-shrink-0"
              />
              <span className="text-xl font-bold text-neutral-900 truncate flex-1 min-w-0">{displayName}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <CopilotButton variant="icon-subtle" size="sm" icon={<People20Regular className="w-4 h-4" />} title="Share" />
                <CopilotButton variant="icon-subtle" size="sm" icon={<ArrowDownload20Regular className="w-4 h-4" />} title="Download" onClick={downloadSummary} />
                {(displayStatus === 'complete' || displayStatus === 'incomplete' || displayStatus === 'blocked' || displayStatus === 'in-progress') && (
                  <CopilotButton variant="icon-subtle" size="sm" icon={<ArrowClockwise20Regular className="w-4 h-4" />} title="Re-run task" />
                )}
                {(displayStatus === 'upcoming' || displayStatus === 'in-progress') && (
                  <CopilotButton variant="icon-subtle" size="sm" icon={<Delete20Regular className="w-4 h-4" />} title="Cancel task" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-[42px]">
              <StatusBadge status={displayStatus} />
              <span className="flex items-center gap-1.5 text-sm text-neutral-500">
                <CalendarLtr20Regular className="w-4 h-4" />
                {task.date ? formatTaskDate(task.date, displayStatus) : task.lastUpdated}
              </span>
            </div>
          </div>

          {/* ── 3. Objective (upcoming only) ────────────────────────────── */}
          {isUpcoming && (displayObjective || task.subtitle) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-2.5">
              <span className="text-sm font-semibold text-neutral-900">Objective</span>
              <p className="text-sm text-neutral-700 leading-relaxed">
                {displayObjective || task.subtitle}
              </p>
            </div>
          )}

          {/* ── 4. Steps card (upcoming only) ───────────────────────────── */}
          {isUpcoming && (
            <div className="border border-neutral-200 rounded-xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Steps</p>
                {steps.length > 0 && (
                  <CopilotButton
                    variant="icon-subtle"
                    size="sm"
                    icon={<ArrowClockwise20Regular className="w-3.5 h-3.5" />}
                    title="Regenerate steps"
                    onClick={() => { setSteps([]); setRegenTrigger(n => n + 1); }}
                  />
                )}
              </div>

              {generatingSteps && steps.length === 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <span className="text-sm text-neutral-500">Generating steps...</span>
                </div>
              )}

              {steps.length > 0 && (
                <ul className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800 leading-5">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-neutral-500 flex-shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!generatingSteps && steps.length === 0 && (
                <p className="text-sm text-neutral-500">No steps generated yet.</p>
              )}

              <p className="text-xs text-neutral-400 pt-1">AI-generated content may be incorrect</p>
            </div>
          )}

          {/* ── 5. Summary (all non-upcoming) ───────────────────────────── */}
          {!isUpcoming && (
            <div className="rounded-xl border border-[#E0E0F0] bg-[#F5F5FA] p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkle20Regular className="w-4 h-4 text-[#6264A7]" />
                <span className="text-sm font-semibold text-neutral-900">Summary</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">
                {detail.summary || task.objective || 'No activity summary available.'}
              </p>
              <div className="flex items-center gap-1 pt-0.5">
                <span className="text-xs text-neutral-400 flex-1">AI-generated content may be incorrect</span>
                <CopilotButton variant="icon-subtle" size="sm" icon={<ThumbLike20Regular className="w-4 h-4" />} title="Helpful" />
                <CopilotButton variant="icon-subtle" size="sm" icon={<ThumbDislike20Regular className="w-4 h-4" />} title="Not helpful" />
              </div>
            </div>
          )}

          {/* ── 6. Errors section (incomplete / blocked) ────────────────── */}
          {isIncomplete && detail.errors && detail.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <ErrorCircle16Filled className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-neutral-900">Errors</p>
              </div>
              <ul className="space-y-1.5">
                {detail.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span>
                      {err.text}
                      {err.link && (
                        <> <a href={err.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Link</a></>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── 9. Activities collapsible section ───────────────────────── */}
          {!isUpcoming && hasActivities && (
            <DwStatusSection label={statusSectionLabel} defaultExpanded>
              <div className="divide-y divide-neutral-100 -mx-5 px-5">
                {detail.activities.map(activity => (
                  <RichActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </DwStatusSection>
          )}

          {/* ── 10. Files section (collapsible) ─────────────────────────── */}
          {!isUpcoming && detail.artifacts && detail.artifacts.length > 0 && (
            <DwStatusSection label="Files" defaultExpanded>
              <div className="flex flex-wrap gap-2 pt-1">
                {detail.artifacts.map((artifact, i) => (
                  <CopilotButton
                    key={i}
                    variant="secondary"
                    size="sm"
                    icon={getConnectorIcon(artifact.icon, 'w-4 h-4 shrink-0')}
                    onClick={() => artifact.openUrl && window.open(artifact.openUrl, '_blank')}
                    disabled={!artifact.openUrl}
                  >
                    {artifact.name}
                  </CopilotButton>
                ))}
              </div>
            </DwStatusSection>
          )}


        </div>
      </div>
    </div>
  );
};
