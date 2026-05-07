import React, { useState, useRef, useEffect } from 'react';
import {
  People20Regular,
  CalendarMonth20Regular,
  Archive20Regular,
  ChevronLeft20Regular,
  Edit20Regular,
  Sparkle20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoteSection {
  heading?: string;
  body: string;
}

interface NotePage {
  id: string;
  title: string;
  updatedAt: string;
  sections: NoteSection[];
}

interface NotebookData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  iconBg: string;
  overviewUpdatedAt: string;
  overviewSections: NoteSection[];
  pages: NotePage[];
  /** True for notebooks that are a single .md file — no per-page sidebar */
  singlePage?: boolean;
}

// ── Notebook data ─────────────────────────────────────────────────────────────
// Lazy factory keeps JSX out of the module-evaluation path, avoiding issues in
// test environments that don't configure a full React transform at import time.

let _notebooks: NotebookData[] | null = null;
function getNotebooks(): NotebookData[] {
  if (_notebooks) return _notebooks;
  _notebooks = [
  {
    id: 'coworkers',
    title: 'Employee Coworkers Notebook',
    description: 'Working context about the people I collaborate with — preferences, review styles, and communication norms.',
    icon: <People20Regular />,
    accentColor: '#0078D4',
    iconBg: '#EFF6FC',
    overviewUpdatedAt: 'Updated March 30, 2026',
    overviewSections: [
      { body: 'This notebook captures working context about the people I collaborate with most often. Rather than relying on each conversation to establish preferences and norms from scratch, I keep this here so I can show up more prepared and consistent over time.' },
      { body: "Each page corresponds to one person or team. Pages cover things like communication preferences, feedback styles, and working habits — context that doesn't fit neatly into a task or calendar event, but shapes how work actually gets done." },
    ],
    pages: [
      {
        id: 'ana',
        title: 'Ana Sofia Gonzalez — Working Preferences',
        updatedAt: 'Updated March 30, 2026',
        sections: [
          { body: 'Ana prefers async communication for non-urgent tasks and tends to check messages in two dedicated windows — morning and late afternoon. She values clear context when reviewing work: a summary of what changed and why matters more to her than showing all the detail.' },
          { body: 'On feedback, she prefers directness. She responds better to "Here\'s what I\'d change" than to open-ended questions about whether something feels right. Design reviews go faster when a clear recommendation leads.' },
          { body: "She's most productive in the morning. If something needs her full attention, earlier in the week works better than Thursday or Friday." },
        ],
      },
      {
        id: 'roderick',
        title: 'Roderick Sauskojus — Review Style',
        updatedAt: 'Updated March 28, 2026',
        sections: [
          { body: "Roderick approaches reviews methodically. He reads the full document before leaving any comments, so initial silence doesn't mean concern. Expect feedback in one consolidated round rather than incremental notes." },
          { body: "His focus tends to be on structure and completeness: does the document cover all edge cases, and is the conclusion well-supported? Stylistic suggestions are rare — he mostly flags gaps or inconsistencies." },
          { body: 'He\'s more responsive to changes when the reasoning is explained. Saying "I removed section 3 because it repeated the intro" works better than presenting the updated doc without context.' },
        ],
      },
      {
        id: 'design-team',
        title: 'Design Team — Communication Norms',
        updatedAt: 'Updated March 27, 2026',
        sections: [
          { body: 'The design team prefers a single shared channel for project updates — #design-reviews — rather than direct messages. Decisions that affect the whole team are posted there, not handled in side conversations.' },
          { body: 'Meetings are generally kept short (30 minutes or less). Agenda items are shared at least a day in advance when possible. For complex feedback, an async doc review is often preferred over a live meeting.' },
          { body: 'Work-in-progress is shared in Figma with view access. Feedback goes in Figma comments, not in separate documents. Final handoffs use the shared SharePoint folder.' },
        ],
      },
    ],
  },
  {
    id: 'daily',
    title: 'Daily Notebook',
    description: 'Short-term, day-by-day observations, outcomes, and things worth carrying forward.',
    icon: <CalendarMonth20Regular />,
    accentColor: '#038387',
    iconBg: '#F0FAFA',
    overviewUpdatedAt: 'Updated March 30, 2026',
    overviewSections: [
      { body: "A day-by-day record of what I completed, observed, or want to carry forward. This isn't a task log — it's context that might matter later: decisions that were made, things that came up unexpectedly, and patterns worth tracking." },
      { body: 'Entries are written at the end of each working day. Anything time-sensitive gets flagged for follow-up. Anything that seems like a recurring pattern eventually moves to the Long-Term Memory Notebook.' },
    ],
    pages: [
      {
        id: 'march-30',
        title: 'March 30, 2026',
        updatedAt: 'Updated March 30, 2026',
        sections: [
          { body: 'Worked primarily on the Q2 budget summary. James Okafor provided the revised department numbers. Integrated them into the model and flagged two line items that appear to be duplicated from Q1 — waiting on confirmation before resolving.' },
          { body: 'Had a brief check-in with the design team about the launch event highlights deck. The current draft is missing the accessibility section they asked for in the last review. Added it to the task queue for tomorrow.' },
          { body: 'Lydia Barnes sent over a new version of the CEO Townhall — July Cut with significant edits to slide 8. The changes conflict with the approved messaging from last week. Flagged for Ana to review before accepting the revision.' },
        ],
      },
      {
        id: 'march-29',
        title: 'March 29, 2026',
        updatedAt: 'Updated March 29, 2026',
        sections: [
          { body: "Reviewed the updated onboarding checklist with Ana. She flagged that the IT provisioning section was outdated — referenced a tool the org no longer uses. Made a note to verify the current provisioning workflow before the next hire." },
          { body: "Sent the Q1 retrospective summary to stakeholders. Marcus Webb acknowledged receipt but hasn't responded with substantive feedback yet. Following up on April 1 if nothing comes in." },
          { body: "Toward end of day, got a message from Priya that the compliance audit timeline has moved up. New deadline is April 14. Updated the tracker and flagged the dependency on the legal review." },
        ],
      },
    ],
  },
  {
    id: 'longterm',
    title: 'Long-Term Memory Notebook',
    description: "Durable, cross-project knowledge — what I've learned about how this org works and what to carry forward indefinitely.",
    icon: <Archive20Regular />,
    accentColor: '#8764B8',
    iconBg: '#F5F0FA',
    singlePage: true,
    overviewUpdatedAt: 'Updated March 29, 2026',
    overviewSections: [
      { body: "Durable knowledge I've built up about how this organization works. This isn't tied to a specific date or project — it's what I carry forward as general operating context." },
      { body: "I refer to this to avoid repeated mistakes, move faster in familiar territory, and make better judgment calls when I don't have all the context. Pages here are added slowly and updated when something fundamental changes." },
    ],
    pages: [
      {
        id: 'approvals',
        title: 'How This Org Approves Work',
        updatedAt: 'Updated March 25, 2026',
        sections: [
          { body: "Most work that goes to a stakeholder or external audience requires sign-off from at least one senior lead before it leaves the team. The approval chain typically goes: creator → direct manager → relevant senior lead. For work involving legal or compliance, there's an additional review step that often adds 3–5 business days." },
          { body: 'Informal approvals happen frequently via Teams message, but the norm is to follow up with written confirmation (email or shared doc comment) for anything that might be referenced later.' },
          { body: 'Exceptions exist for routine deliverables — weekly status reports, internal tracking updates — which can be sent once a template has been approved. When in doubt, a quick "Does this need sign-off?" message to the manager is preferred over guessing.' },
        ],
      },
      {
        id: 'mistakes',
        title: 'Recurring Mistakes to Avoid',
        updatedAt: 'Updated March 22, 2026',
        sections: [
          { heading: 'Sending files without context', body: "People in this org are busy. A file shared without a brief summary of what changed and what decision is needed gets delayed. Always include a one-line context note." },
          { heading: 'Using stale contact lists', body: "Distribution lists here are often outdated. Verify with the person's direct manager or check the current org chart before sending to a group." },
          { heading: 'Treating silence as agreement', body: "In this org, no response usually means the person hasn't seen it yet — not that they approve. Follow up once after 48 hours on anything that needs a decision." },
        ],
      },
      {
        id: 'definition-of-done',
        title: 'Definition of Done for Design Reviews',
        updatedAt: 'Updated March 20, 2026',
        sections: [
          { body: 'A design review is complete when: (1) all flagged comments have been resolved or explicitly accepted or declined with reasoning; (2) the updated file is shared back in the #design-reviews channel; (3) at least one senior designer has left a "LGTM" comment or equivalent.' },
          { body: 'Reviews that are blocked on an open question are not marked done — they\'re marked "pending" until the question is answered.' },
          { body: 'For accessibility-specific reviews, an additional step is required: a pass through the accessibility checklist (stored in SharePoint) and a note confirming no blockers were found.' },
        ],
      },
      {
        id: 'tools',
        title: 'Preferred Tools and Systems',
        updatedAt: 'Updated March 18, 2026',
        sections: [
          { heading: 'File storage', body: 'SharePoint is the source of truth for final and approved documents. OneDrive is for work in progress. Avoid using personal drives for anything that needs to be handed off.' },
          { heading: 'Communication', body: 'Teams is primary for day-to-day. Email is used for external stakeholders and formal communication. Slack is not used by this team.' },
          { heading: 'Project tracking', body: 'Tasks are tracked in the shared Planner board. Individual to-dos can live in personal tools but should surface in the team tracker when they have dependencies.' },
          { heading: 'Video calls', body: 'Teams meetings by default. Zoom is used only for external calls with partners or vendors who cannot use Teams.' },
        ],
      },
    ],
  },
  ];
  return _notebooks;
}

export { getNotebooks };

// ── Notebook list row ─────────────────────────────────────────────────────────

function NotebookRow({ notebook, onClick }: { notebook: NotebookData; onClick: () => void }) {
  const totalPages = notebook.pages.length + 1; // +1 for overview
  return (
    <div
      className="group grid grid-cols-[1fr_80px_160px] items-center px-4 py-3.5 cursor-pointer hover:bg-[hsl(var(--surface-secondary))] transition-colors"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Name + description */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
          style={{ backgroundColor: notebook.accentColor }}
        >
          {notebook.icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{notebook.title}</p>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 truncate">{notebook.description}</p>
        </div>
      </div>
      {/* Pages */}
      <span className="text-sm text-[hsl(var(--text-primary))] text-right">
        {totalPages}
      </span>
      {/* Last updated */}
      <span className="text-sm text-[hsl(var(--text-primary))] text-right">{notebook.overviewUpdatedAt.replace('Updated ', '')}</span>
    </div>
  );
}

// ── Overview page renderer ────────────────────────────────────────────────────

function OverviewContent({ updatedAt, sections }: { updatedAt: string; sections: NoteSection[] }) {
  return (
    <div className="p-6 h-full">
      <div className="rounded-xl border border-[#E0E0F0] bg-[#F5F5FA] p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Sparkle20Regular className="w-4 h-4 text-[#6264A7]" />
            <span className="text-base font-semibold text-neutral-800">Overview</span>
          </div>
          <p className="text-xs text-neutral-400 pl-6">{updatedAt}</p>
        </div>
        <div className="flex flex-col gap-3">
          {sections.map((s, i) => (
            <p key={i} className="text-sm text-neutral-700 leading-relaxed">{s.body}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Editable page renderer ────────────────────────────────────────────────────

function EditablePageContent({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: NoteSection[];
}) {
  const fullText = sections
    .map(s => (s.heading ? `${s.heading}\n${s.body}` : s.body))
    .join('\n\n');
  const [editing, setEditing] = useState(false);
  // draft is initialised from fullText at mount only.
  // Cancel resets to this closure value, which is safe because the parent passes
  // key={selectedPageId} — PageContent remounts on every page switch, so
  // fullText is always fresh and the stale-closure is never stale in practice.
  const [draft, setDraft] = useState(fullText);
  // Widened to match CopilotTextarea's forwardRef<HTMLTextAreaElement | PillInputHandle> signature.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    // instanceof guard required: PillInputHandle doesn't have .style/.scrollHeight
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  return (
    <div className="flex flex-col gap-5 px-6 py-6">
      {/* Title + updated + edit button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-neutral-900 leading-snug">{title}</h2>
          <p className="text-xs text-neutral-400">{updatedAt}</p>
        </div>
        {!editing && (
          <CopilotButton
            variant="transparent"
            size="sm"
            icon={<Edit20Regular />}
            onClick={() => setEditing(true)}
          >
            Edit
          </CopilotButton>
        )}
      </div>

      {/* Edit mode: single textarea for full page */}
      {editing ? (
        <div className="flex flex-col gap-3">
          <CopilotTextarea
            ref={textareaRef as React.Ref<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="w-full"
            style={{ overflow: 'hidden' }}
          />
          <div className="flex items-center justify-end gap-2">
            <CopilotButton
              variant="transparent"
              size="sm"
              onClick={() => { setDraft(fullText); setEditing(false); }}
            >
              Cancel
            </CopilotButton>
            {/* Demo only — persisting edits to a real store is out of scope for this prototype */}
            <CopilotButton
              variant="primary"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Save
            </CopilotButton>
          </div>
        </div>
      ) : (
        /* Read mode: render sections */
        <div className="flex flex-col gap-5">
          {sections.map((section, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {section.heading && (
                <span className="text-sm font-semibold text-neutral-900">{section.heading}</span>
              )}
              <p className="text-sm text-neutral-700 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single-page notebook view (entire notebook is one .md file) ───────────────

function SinglePageNotebook({
  header,
  updatedAt,
  sections,
  fullText,
  accentColor,
}: {
  header: React.ReactNode;
  updatedAt: string;
  sections: NoteSection[];
  fullText: string;
  accentColor: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullText);
  // Widened to match CopilotTextarea's forwardRef<HTMLTextAreaElement | PillInputHandle> signature.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    // instanceof guard required: PillInputHandle doesn't have .style/.scrollHeight
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
      {header}
      <div className="flex flex-1 min-h-0 overflow-y-auto border border-[hsl(var(--stroke-default))] rounded-xl bg-white">
        <div className="flex flex-col gap-5 px-6 py-6 w-full">
          {/* Updated + edit button */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-neutral-400">{updatedAt}</p>
            {!editing && (
              <CopilotButton
                variant="transparent"
                size="sm"
                icon={<Edit20Regular />}
                onClick={() => setEditing(true)}
              >
                Edit
              </CopilotButton>
            )}
          </div>

          {editing ? (
            <div className="flex flex-col gap-3">
              <CopilotTextarea
                ref={textareaRef as React.Ref<HTMLTextAreaElement>}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                autoFocus
                className="w-full"
                style={{ overflow: 'hidden' }}
              />
              <div className="flex items-center justify-end gap-2">
                <CopilotButton
                  variant="transparent"
                  size="sm"
                  onClick={() => { setDraft(fullText); setEditing(false); }}
                >
                  Cancel
                </CopilotButton>
                {/* Demo only — persisting edits to a real store is out of scope for this prototype */}
                <CopilotButton
                  variant="primary"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Save
                </CopilotButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {sections.map((s, i) => {
                if (!s.body && s.heading) {
                  // Section divider heading
                  return (
                    <h3
                      key={i}
                      className="text-base font-semibold text-neutral-900 border-b border-[hsl(var(--stroke-default))] pb-2 mt-2"
                      style={{ color: accentColor }}
                    >
                      {s.heading}
                    </h3>
                  );
                }
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    {s.heading && (
                      <span className="text-sm font-semibold text-neutral-900">{s.heading}</span>
                    )}
                    <p className="text-sm text-neutral-700 leading-relaxed">{s.body}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const DWNotebooksView: React.FC<{
  onBack?: () => void;
  defaultNotebookId?: string;
  defaultPageId?: string;
}> = ({ onBack, defaultNotebookId, defaultPageId }) => {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(defaultNotebookId ?? null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(defaultPageId ?? null); // null = overview

  const notebooks = getNotebooks();
  const selectedNotebook = notebooks.find(n => n.id === selectedNotebookId) ?? null;

  function openNotebook(id: string) {
    setSelectedNotebookId(id);
    setSelectedPageId(null);
  }

  function closeNotebook() {
    setSelectedNotebookId(null);
    setSelectedPageId(null);
  }

  // ── Notebooks list ──────────────────────────────────────────────────────────
  if (!selectedNotebook) {
    return (
      <div className="flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          {onBack && (
            <CopilotButton
              variant="transparent"
              size="sm"
              icon={<ChevronLeft20Regular />}
              onClick={onBack}
              aria-label="Back to files"
            />
          )}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-[hsl(var(--text-primary))]">Notebooks</h2>
            <p className="text-xs text-[hsl(var(--text-disabled))]">Memory organized by your AI Teammate — reviewed and updated over time.</p>
          </div>
        </div>

        {/* Notebook list */}
        <div className="w-full border border-[hsl(var(--stroke-default))] rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_160px] text-xs font-semibold text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--stroke-default))] py-3.5 px-4">
            <span className="pl-[52px]">Name</span>
            <span className="text-right">Pages</span>
            <span className="text-right">Last updated</span>
          </div>
          {notebooks.map((nb, idx) => (
            <div key={nb.id} className="relative">
              {idx < notebooks.length - 1 && <div className="absolute bottom-0 left-0 right-0 h-px bg-[hsl(var(--stroke-default))]" />}
              <NotebookRow notebook={nb} onClick={() => openNotebook(nb.id)} />
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-[hsl(var(--text-disabled))] mt-auto pt-2">
          Notes are not automatically shared — your AI Teammate references them when relevant to an active task or conversation.
        </p>
      </div>
    );
  }

  // ── Notebook detail view ────────────────────────────────────────────────────

  const notebookHeader = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <CopilotButton
        variant="transparent"
        size="sm"
        icon={<ChevronLeft20Regular />}
        onClick={closeNotebook}
        aria-label="Back to notebooks"
      />
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white"
        style={{ backgroundColor: selectedNotebook.accentColor }}
      >
        {selectedNotebook.icon}
      </div>
      <span className="text-base font-semibold text-[hsl(var(--text-primary))]">{selectedNotebook.title}</span>
    </div>
  );

  // ── Single-page notebook (one .md file) ─────────────────────────────────────
  if (selectedNotebook.singlePage) {
    // Flatten all pages into one document: overview intro + page sections with headings
    const allSections: NoteSection[] = [
      ...selectedNotebook.overviewSections,
      ...selectedNotebook.pages.flatMap(p => [
        { heading: p.title, body: '' },
        ...p.sections,
      ]),
    ];
    const fullText = allSections
      .map(s => (s.heading ? `${s.heading}\n${s.body}` : s.body))
      .filter(Boolean)
      .join('\n\n');

    return (
      <SinglePageNotebook
        header={notebookHeader}
        updatedAt={selectedNotebook.overviewUpdatedAt}
        sections={allSections}
        fullText={fullText}
        accentColor={selectedNotebook.accentColor}
      />
    );
  }

  // ── Multi-page notebook (one file per page) ──────────────────────────────────

  const activePage = selectedNotebook.pages.find(p => p.id === selectedPageId) ?? null;

  const pageContent = activePage
    ? {
        title: activePage.title,
        updatedAt: activePage.updatedAt,
        sections: activePage.sections,
      }
    : {
        title: 'Overview',
        updatedAt: selectedNotebook.overviewUpdatedAt,
        sections: selectedNotebook.overviewSections,
      };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
      {/* Notebook title — outside the box, like Tasks header */}
      {notebookHeader}

      {/* Two-pane body */}
      <div className="flex flex-1 min-h-0 overflow-hidden border border-[hsl(var(--stroke-default))] rounded-xl">
        {/* Left: page list sidebar */}
        <div
          className="w-56 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ backgroundColor: selectedNotebook.iconBg, borderRight: `1px solid ${selectedNotebook.accentColor}22` /* hex alpha 22 ≈ 13% opacity */ }}
        >
          {/* Overview entry */}
          <CopilotButton
            variant="transparent"
            className={`!w-full !justify-start !rounded-none !px-4 !py-3 !text-sm !h-auto ${
              selectedPageId === null
                ? '!bg-white !font-semibold !text-[hsl(var(--text-primary))] shadow-sm'
                : '!text-[hsl(var(--text-secondary))] hover:!bg-white/60'
            }`}
            onClick={() => setSelectedPageId(null)}
            style={{
              borderBottom: `1px solid ${selectedNotebook.accentColor}22`,
              ...(selectedPageId === null ? { borderLeft: `3px solid ${selectedNotebook.accentColor}`, paddingLeft: 13 /* px-4 (16px) minus 3px active border */ } : {}),
            }}
          >
            Overview
          </CopilotButton>

          {/* Pages */}
          {selectedNotebook.pages.map(page => (
            <CopilotButton
              key={page.id}
              variant="transparent"
              className={`!w-full !justify-start !rounded-none !px-4 !py-3 !text-sm !h-auto !text-left ${
                selectedPageId === page.id
                  ? '!bg-white !font-semibold !text-[hsl(var(--text-primary))] shadow-sm'
                  : '!text-[hsl(var(--text-secondary))] hover:!bg-white/60'
              }`}
              onClick={() => setSelectedPageId(page.id)}
              style={{
                borderBottom: `1px solid ${selectedNotebook.accentColor}22`,
                ...(selectedPageId === page.id ? { borderLeft: `3px solid ${selectedNotebook.accentColor}`, paddingLeft: 13 /* px-4 (16px) minus 3px active border */ } : {}),
              }}
            >
              {page.title}
            </CopilotButton>
          ))}
        </div>

        {/* Right: page content — key forces remount on page switch, resetting edit state */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selectedPageId === null ? (
            <OverviewContent
              key="overview"
              updatedAt={pageContent.updatedAt}
              sections={pageContent.sections}
            />
          ) : (
            <EditablePageContent
              key={selectedPageId}
              title={pageContent.title}
              updatedAt={pageContent.updatedAt}
              sections={pageContent.sections}
            />
          )}
        </div>
      </div>
    </div>
  );
};
