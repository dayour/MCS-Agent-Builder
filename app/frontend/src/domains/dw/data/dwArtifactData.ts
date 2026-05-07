// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtifactType = 'word' | 'excel' | 'powerpoint' | 'email' | 'chat' | 'file' | 'sharepoint';

export interface SharedFile {
  name: string;
  ext: 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'png' | 'csv';
  size: string;
  url?: string;
  sharedBy?: string;
  sharedAt?: string;
}

export interface ChatMessage {
  from: string;
  fromAgent?: boolean;
  body: string;
  time: string;
  attachment?: SharedFile;
}

export interface EmailData {
  from: string;
  to: string;
  subject: string;
  sentAt: string;
  body: string;
  replies?: { from: string; sentAt: string; body: string }[];
}

export interface DocData {
  title: string;
  sections: { heading?: string; body: string }[];
}

export interface SpreadsheetData {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  footnote?: string;
}

export interface SlideData {
  title: string;
  slides: { heading: string; bullets: string[] }[];
}

export interface FileData {
  filename: string;
  size: string;
  modified: string;
  location: string;
  description: string;
}

export interface SharePointFile {
  name: string;
  ext: string;
  modified: string;
  modifiedBy: string;
  size: string;
}

export type ArtifactPreview =
  | { type: 'chat';        messages: ChatMessage[] }
  | { type: 'email';       data: EmailData }
  | { type: 'word';        data: DocData }
  | { type: 'excel';       data: SpreadsheetData }
  | { type: 'powerpoint';  data: SlideData }
  | { type: 'file';        data: FileData }
  | { type: 'sharepoint';  files: SharePointFile[] };

export interface TaskArtifact {
  id: string;
  name: string;
  type: ArtifactType;
  status: 'ready' | 'awaiting' | 'pending';
  preview: ArtifactPreview;
  appKey?: string;        // connector icon key for "Open in app"
  appLabel?: string;      // e.g. "Word", "Excel"
  sharedFiles?: SharedFile[];
  url?: string;           // native open URL (SharePoint/OneDrive/web)
}

// ── Artifact data ─────────────────────────────────────────────────────────────

export const ARTIFACTS: Record<string, TaskArtifact> = {
  h1: {
    id: 'h1',
    name: 'Q1 Executive Brief.docx',
    type: 'word',
    status: 'ready',
    appKey: 'word',
    appLabel: 'Word',
    url: '/demo-files/q1-executive-brief.docx',
    preview: {
      type: 'word',
      data: {
        title: 'Q1 Executive Brief',
        sections: [
          { heading: 'Overview', body: 'Total Q1 spend came in at $3.84M against a budget of $3.71M, a variance of +3.5%. Revenue targets were met across all three business units.' },
          { heading: 'Key Highlights', body: '• Marketing exceeded budget by $42K due to expanded campaign activity\n• Engineering came in $18K under budget following scope reduction\n• Sales hit 103% of revenue target for the quarter' },
          { heading: 'Risks & Recommendations', body: 'Two items flagged for Q2 attention: headcount budget pressure in Product (+$65K projected) and infrastructure renewal costs accelerating into Q2. Recommend a mid-quarter review in April.' },
        ],
      },
    },
  },
  h2: {
    id: 'h2',
    name: 'Standup Notes — March 17.docx',
    type: 'word',
    status: 'ready',
    appKey: 'word',
    appLabel: 'Word',
    url: '/demo-files/sample-document.docx',
    preview: {
      type: 'word',
      data: {
        title: 'Team Standup Notes — March 17, 2026',
        sections: [
          { heading: 'Attendees', body: 'Avery Fuller, Marco Reyes, Sophie Lin, James Okafor, Priya Nair' },
          { heading: 'Updates', body: '• Avery: PR #393 merged, working on Day 100 feature\n• Marco: Completed API contract work, starting on notification system\n• Sophie: UX review complete, designs handed off to engineering\n• James: Monitoring pipeline stable, fixing alert thresholds\n• Priya: Eval results analysis, report ready by EOD' },
          { heading: 'Action Items', body: '• Avery to tag PR #394 for review by EOD\n• Marco to sync with Sophie on notification UX by Thursday\n• James to update alert runbook in Confluence' },
        ],
      },
    },
  },
  h3: {
    id: 'h3',
    name: 'Contract Review — Contoso.docx',
    type: 'word',
    status: 'ready',
    appKey: 'word',
    appLabel: 'Word',
    url: '/demo-files/contract-review.docx',
    preview: {
      type: 'word',
      data: {
        title: 'Vendor Contract Review — Contoso Ltd.',
        sections: [
          { heading: 'Summary', body: 'Reviewed 34-page master service agreement. 3 high-priority clauses flagged, 2 standard clauses recommended for renegotiation.' },
          { heading: '⚠ Flagged Clauses', body: '• §8.2 — Liability cap set at $50K, below our standard $200K minimum. Recommend escalation.\n• §12.1 — Data residency clause allows processing outside EU. Non-compliant with current policy.\n• §19.4 — Auto-renewal window is 15 days; our process requires 30 days minimum lead time.' },
          { heading: 'Recommended Next Steps', body: 'Escalate §8.2 and §12.1 to Legal for review. Request contract amendment on §19.4 before signing. Estimated turnaround: 5 business days.' },
        ],
      },
    },
  },
  h4: {
    id: 'h4',
    name: 'Weekly Feedback Digest',
    type: 'email',
    status: 'ready',
    appKey: 'outlook',
    appLabel: 'Outlook',
    url: 'https://outlook.office.com/mail/',
    preview: {
      type: 'email',
      data: {
        from: 'AI Teammate <noreply@contoso.com>',
        to: 'Product Team (14 recipients)',
        subject: 'Customer Feedback Digest — Week of March 10, 2026',
        sentAt: '3 days ago · 9:00 AM',
        body: `Hi team,

Here is this week's customer feedback digest for the week of March 10–16, 2026.

NPS Score: 67 (+4 from last week)
Support Tickets: 142 opened · 138 resolved · 4 escalated

Top themes this week:
• Performance — 23 mentions of slow load times on the dashboard
• Onboarding — 17 users requested clearer getting-started guidance
• Export feature — 11 requests for CSV download from the reports page

Most Positive Feedback:
"The new AI suggestions in the workflow builder saved me hours this week — genuinely impressive."

Escalated Tickets:
Ticket #4412 — Enterprise customer reporting data sync failure (P1, assigned to Marco)

Full breakdown is available in the shared SharePoint folder.

— AI Teammate`,
        replies: [
          { from: 'James Okafor', sentAt: '3 days ago · 10:15 AM', body: 'Thanks — can you add a breakdown by product area next week?' },
          { from: 'Priya Nair', sentAt: '3 days ago · 11:02 AM', body: 'Great summary, the NPS trend is really encouraging.' },
        ],
      },
    },
  },
  h5: {
    id: 'h5',
    name: 'Onboarding Pack — March 2026.docx',
    type: 'word',
    status: 'ready',
    appKey: 'word',
    appLabel: 'Word',
    url: '/demo-files/onboarding-checklist.docx',
    preview: {
      type: 'word',
      data: {
        title: 'New Hire Onboarding Pack — March 2026',
        sections: [
          { heading: 'Welcome', body: 'Welcome to the Research & Design team! This pack covers your first two weeks and everything you need to get up to speed.' },
          { heading: 'Week 1 Checklist', body: '✓ Complete IT setup and access requests\n✓ Meet with your manager (Avery Fuller)\n✓ Review team wiki and design system docs\n✓ Attend Thursday all-hands\n□ Complete security training module' },
          { heading: 'Key Contacts', body: 'Manager: Avery Fuller · avery.fuller@contoso.com\nIT Support: helpdesk@contoso.com · ext. 4400\nHR: people@contoso.com' },
        ],
      },
    },
  },
  h6: {
    id: 'h6',
    name: 'Sprint 22 Retro Transcript',
    type: 'chat',
    status: 'ready',
    appKey: 'teams',
    appLabel: 'Teams',
    url: 'https://teams.microsoft.com/l/channel/general',
    sharedFiles: [
      { name: 'Sprint 22 Action Items.docx', ext: 'docx', size: '42 KB', url: '/demo-files/weekly-status-report.docx', sharedBy: 'AI Teammate', sharedAt: '1 week ago' },
    ],
    preview: {
      type: 'chat',
      messages: [
        { from: 'AI Teammate', fromAgent: true, body: 'Sprint 22 retrospective is now open. Let\'s start with wins — what went well this sprint?', time: '1 week ago · 2:00 PM' },
        { from: 'Marco Reyes', body: 'The new CI pipeline cut our build times in half. Huge win.', time: '2:02 PM' },
        { from: 'Sophie Lin', body: 'Design handoff was smoother than ever — loved having Figma links embedded in tickets.', time: '2:04 PM' },
        { from: 'AI Teammate', fromAgent: true, body: 'Great themes: infrastructure speed and process improvements. Now — what could we do better?', time: '2:06 PM' },
        { from: 'James Okafor', body: 'Scope creep mid-sprint on the notifications feature. We need stricter change control.', time: '2:08 PM' },
        { from: 'Priya Nair', body: 'Agreed. Also, standups are running long. Could we timebox to 15 min?', time: '2:10 PM' },
        { from: 'AI Teammate', fromAgent: true, body: 'Captured. Action items: (1) Draft change control policy — Marco. (2) Timebox standups to 15 min starting next sprint — Avery. Summary will be in your inbox shortly.', time: '2:12 PM', attachment: { name: 'Sprint 22 Action Items.docx', ext: 'docx', size: '42 KB', sharedBy: 'AI Teammate', sharedAt: '1 week ago' } },
      ],
    },
  },
  h7: {
    id: 'h7',
    name: 'Budget Variance Q1.xlsx',
    type: 'excel',
    status: 'ready',
    appKey: 'excel',
    appLabel: 'Excel',
    url: '/demo-files/budget-variance.xlsx',
    preview: {
      type: 'excel',
      data: {
        sheetName: 'Variance Summary',
        headers: ['Department', 'Budget', 'Actual', 'Variance', '% Var'],
        rows: [
          ['Engineering',  '$1,200,000', '$1,182,000', '−$18,000',  '−1.5%'],
          ['Marketing',    '$580,000',   '$622,000',   '+$42,000',  '+7.2%'],
          ['Sales',        '$940,000',   '$928,500',   '−$11,500',  '−1.2%'],
          ['Product',      '$620,000',   '$648,000',   '+$28,000',  '+4.5%'],
          ['Operations',   '$370,000',   '$363,000',   '−$7,000',   '−1.9%'],
          ['TOTAL',        '$3,710,000', '$3,843,500', '+$133,500', '+3.6%'],
        ],
        footnote: 'Data as of March 15, 2026. Actuals include accruals.',
      },
    },
  },
  h8: {
    id: 'h8',
    name: 'Roadmap Update Q2 2026.pptx',
    type: 'powerpoint',
    status: 'ready',
    appKey: 'powerpoint',
    appLabel: 'PowerPoint',
    url: '/demo-files/roadmap-update.pptx',
    preview: {
      type: 'powerpoint',
      data: {
        title: 'Product Roadmap — Q2 2026',
        slides: [
          { heading: 'Q2 Priorities', bullets: ['Launch AI Teammate Day 100 experience', 'Complete notification system overhaul', 'Ship evaluation framework v2', 'Accessibility audit and remediation'] },
          { heading: 'What Changed', bullets: ['Moved interview mode to Q3 based on research findings', 'Accelerated DW overview work to align with sales cycle', 'Added compliance milestone per legal request'] },
          { heading: 'Dependencies & Risks', bullets: ['Day 100 feature dependent on Dexter API availability', 'Notification work blocked on design sign-off (Sophie)', 'Compliance milestone needs external audit vendor'] },
        ],
      },
    },
  },
  h9: {
    id: 'h9',
    name: 'Weekly Status Update',
    type: 'email',
    status: 'ready',
    appKey: 'outlook',
    appLabel: 'Outlook',
    url: 'https://outlook.office.com/mail/',
    preview: {
      type: 'email',
      data: {
        from: 'AI Teammate <noreply@contoso.com>',
        to: 'Leadership (6 recipients)',
        subject: 'Weekly Status Update — March 17, 2026',
        sentAt: '1 hour ago · 8:30 AM',
        body: `Hi all,

Here's the weekly status update for the Research & Design team.

This Week
• Merged 4 PRs including DW overview layout improvements and AI Teammate Day 0 enhancements
• Completed Q1 budget variance analysis — report delivered to Finance
• Sprint 22 retrospective completed; action items logged

In Progress
• Day 100 feature development (on track for Thursday demo)
• Notification system — design review scheduled for Wednesday
• Annual performance data rollup (due Friday)

At Risk
• Competitor landscape refresh is 4 days behind — reassigning to Sophie this week

Next Week
• Sprint 23 kickoff Monday
• Engineering all-hands Thursday (AI Teammate prepping deck)

Let me know if you'd like more detail on any item.

— AI Teammate`,
        replies: [
          { from: 'Marco Reyes', sentAt: '45 min ago · 8:45 AM', body: 'Thanks! Flagging that the notification system design review is now confirmed for Wednesday 2pm.' },
        ],
      },
    },
  },
  h10: {
    id: 'h10',
    name: 'Competitor Analysis March 2026.docx',
    type: 'word',
    status: 'awaiting',
    appKey: 'word',
    appLabel: 'Word',
    url: '/demo-files/competitor-analysis.docx',
    preview: {
      type: 'word',
      data: {
        title: 'Competitor Landscape Refresh — March 2026',
        sections: [
          { heading: 'Status', body: '⏳ Awaiting feedback from Avery Fuller before finalizing. Draft sent March 13 — no response yet.' },
          { heading: 'Draft Summary', body: 'Analyzed 6 key competitors across product capability, pricing, and market positioning. Three have launched AI-native features in the last 90 days.' },
          { heading: 'Pending Items', body: '• Avery to confirm which competitor pricing data to include (public vs. estimated)\n• James to provide infrastructure benchmark data for section 4\n• Decision needed: include startup landscape or focus on enterprise only?' },
        ],
      },
    },
  },
  h11: {
    id: 'h11',
    name: 'Compliance Audit Checklist',
    type: 'sharepoint',
    status: 'awaiting',
    appKey: 'sharepoint',
    appLabel: 'SharePoint',
    url: '/demo-files/compliance-checklist.xlsx',
    sharedFiles: [
      { name: 'Data Handling Policy v3.2.docx', ext: 'docx', size: '186 KB', url: '/demo-files/contract-review.docx', sharedBy: 'Marco Reyes', sharedAt: '6 days ago' },
      { name: 'Compliance Checklist Q1 2026.xlsx', ext: 'xlsx', size: '248 KB', url: '/demo-files/compliance-checklist.xlsx', sharedBy: 'AI Teammate', sharedAt: '6 days ago' },
      { name: 'Audit Evidence — Access Controls.pdf', ext: 'pdf', size: '1.2 MB', url: '/demo-files/audit-evidence.pdf', sharedBy: 'James Okafor', sharedAt: '1 week ago' },
      { name: 'Privacy Impact Assessment.docx', ext: 'docx', size: '94 KB', url: '/demo-files/competitor-analysis.docx', sharedBy: 'Priya Nair', sharedAt: '1 week ago' },
      { name: 'Vendor Risk Matrix.xlsx', ext: 'xlsx', size: '312 KB', url: '/demo-files/vendor-risk-matrix.xlsx', sharedBy: 'AI Teammate', sharedAt: '2 weeks ago' },
      { name: 'Training Completion Report.csv', ext: 'csv', size: '58 KB', url: '/demo-files/training-completion.csv', sharedBy: 'Sophie Lin', sharedAt: '2 weeks ago' },
    ],
    preview: {
      type: 'sharepoint',
      files: [
        { name: 'Data Handling Policy v3.2.docx', ext: 'docx', modified: 'Mar 11, 2026', modifiedBy: 'Marco Reyes', size: '186 KB' },
        { name: 'Compliance Checklist Q1 2026.xlsx', ext: 'xlsx', modified: 'Mar 11, 2026', modifiedBy: 'AI Teammate', size: '248 KB' },
        { name: 'Audit Evidence — Access Controls.pdf', ext: 'pdf', modified: 'Mar 10, 2026', modifiedBy: 'James Okafor', size: '1.2 MB' },
        { name: 'Privacy Impact Assessment.docx', ext: 'docx', modified: 'Mar 10, 2026', modifiedBy: 'Priya Nair', size: '94 KB' },
        { name: 'Vendor Risk Matrix.xlsx', ext: 'xlsx', modified: 'Mar 3, 2026', modifiedBy: 'AI Teammate', size: '312 KB' },
        { name: 'Training Completion Report.csv', ext: 'csv', modified: 'Mar 3, 2026', modifiedBy: 'Sophie Lin', size: '58 KB' },
      ],
    },
  },
};
