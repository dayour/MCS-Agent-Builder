import React from 'react';
import {
  Mail20Regular,
  Mention20Regular,
  Building20Regular,
  Open20Regular,
} from '@fluentui/react-icons';
import { useAgent } from '../../../context/AgentContext';

// ── Card wrapper ──────────────────────────────────────────────────────────────

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-[hsl(var(--stroke-default))] rounded-xl bg-white px-6 py-5 space-y-4">
    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{title}</p>
    {children}
  </div>
);

// ── Detail cell ───────────────────────────────────────────────────────────────

const DetailCell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{label}</p>
    <div className="text-sm text-[hsl(var(--text-secondary))]">{children}</div>
  </div>
);

const Link: React.FC<{ children: React.ReactNode; external?: boolean }> = ({ children, external }) => (
  <span className="text-sm text-[#0F6CBD] hover:underline cursor-pointer inline-flex items-center gap-0.5">
    {children}
    {external && <Open20Regular className="w-3 h-3" />}
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DWDetailsTab: React.FC = () => {
  const { agentConfig } = useAgent();
  const agentName = agentConfig.name || 'AI Teammate';

  // Use instructions as the primary About text, fall back to description or a default
  const aboutText = agentConfig.instructions?.trim() ||
    agentConfig.description?.trim() ||
    `A digital coworker with its own M365 identity — it has an inbox, OneDrive, and presence across Teams, Outlook, and SharePoint.\n\n${agentName} autonomously handles tasks on behalf of your team: sending and replying to emails, scheduling and summarizing meetings, updating documents, posting to Teams channels, and tracking project milestones. When it needs input or approval, it reaches out proactively and waits for your response before proceeding.\n\nIt has access to your organization's knowledge base, calendar, inbox, and collaboration tools, using that context to make informed decisions, surface relevant information, and coordinate with the right people at the right time. ${agentName} is designed to work alongside your team as a trusted colleague — handling routine coordination so you can focus on higher-value work.`;

  return (
    <div className="space-y-4">

      {/* ── About ──────────────────────────────────────────────────────────── */}
      <Card title="About">
        <div className="space-y-3">
          {aboutText.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm text-[hsl(var(--text-secondary))] leading-6">{para}</p>
          ))}
        </div>
      </Card>

      {/* ── Contact ────────────────────────────────────────────────────────── */}
      <Card title="Contact">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-secondary))]">
              <Mail20Regular className="w-4 h-4" />
              <span>Email</span>
            </div>
            <Link>agentx@contoso.com</Link>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-secondary))]">
              <Mention20Regular className="w-4 h-4" />
              <span>Alias</span>
            </div>
            <Link>agentx</Link>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-secondary))]">
              <Building20Regular className="w-4 h-4" />
              <span>Company</span>
            </div>
            <p className="text-sm text-[hsl(var(--text-secondary))]">Contoso</p>
          </div>
        </div>
      </Card>

      {/* ── Agent Details ───────────────────────────────────────────────────── */}
      <Card title={`${agentName} Details`}>
        <div className="grid grid-cols-3 gap-x-6 gap-y-6">
          {/* Row 1 */}
          <DetailCell label="Developer">
            <Link>Microsoft Corporation</Link>
          </DetailCell>
          <DetailCell label="Model">
            <p>{agentConfig.model || 'gpt-4o'}</p>
          </DetailCell>
          <DetailCell label="ID number">
            <p>B456-UserY</p>
          </DetailCell>

          {/* Row 2 */}
          <DetailCell label="Last configured">
            <div className="space-y-0.5">
              <p>Version 2.1.3</p>
              <p>September 4, 2025</p>
              <p>By <Link>John Smith</Link></p>
            </div>
          </DetailCell>
          <DetailCell label="Legal">
            <div className="space-y-1">
              <div><Link external>Privacy policy</Link></div>
              <div><Link external>Terms of service</Link></div>
              <div><span className="text-sm text-[#0F6CBD] hover:underline cursor-pointer">Permissions</span></div>
            </div>
          </DetailCell>
          <DetailCell label="Support">
            <div className="space-y-1">
              <div><Link>Get help</Link></div>
              <div><Link>Send feedback</Link></div>
              <div><Link>FAQ</Link></div>
            </div>
          </DetailCell>
        </div>
      </Card>

    </div>
  );
};
