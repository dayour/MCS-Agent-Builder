import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch, RadioGroup, Radio, Slider } from '@fluentui/react-components';
import { CopilotButton, CopilotInput, CopilotDropdown, CopilotTextarea } from '../components/ui';
import { useAgent } from '../context/AgentContext';
import {
  ChevronRight20Regular,
  ArrowLeft20Regular,
  Dismiss20Regular,
  DismissCircle16Regular,
  TextBold20Regular,
  TextItalic20Regular,
  ArrowUndo20Regular,
  ArrowRedo20Regular,
  Code20Regular,
  MathFormula20Regular,
  Warning20Regular,
  Eye20Regular,
  EyeOff20Regular,
  Copy20Regular,
  ArrowCounterclockwise20Regular,
  CheckmarkCircle16Filled,
  Add16Regular,
} from '@fluentui/react-icons';

// ─── Base UI helpers ──────────────────────────────────────────────────────────

const SectionDivider: React.FC = () => (
  <div className="w-full h-px bg-[hsl(var(--stroke-default))]" />
);

interface SettingRowProps {
  title: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  alignTop?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ title, description, control, alignTop }) => (
  <div className={`flex ${alignTop ? 'items-start' : 'items-center'} gap-2 w-full`}>
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">{title}</p>
      {description && <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">{description}</p>}
    </div>
    <div className="shrink-0 flex items-center">{control}</div>
  </div>
);

// Highlights the matched substring bold; surrounding text is lighter
const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <span className="font-bold text-[hsl(var(--text-primary))]">{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span className="font-semibold text-[hsl(var(--text-secondary))]">{text}</span>;
  return (
    <>
      <span className="font-semibold text-[hsl(var(--text-secondary))]">{text.slice(0, idx)}</span>
      <span className="font-bold text-[hsl(var(--text-primary))]">{text.slice(idx, idx + query.length)}</span>
      <span className="font-semibold text-[hsl(var(--text-secondary))]">{text.slice(idx + query.length)}</span>
    </>
  );
};

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  // When rendered in search results, show category label + highlight the title
  categoryLabel?: string;
  query?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children, categoryLabel, query }) => (
  <div className="border border-[hsl(var(--stroke-default))] rounded-[10px] flex flex-col">
    <div className="px-4 pt-3 pb-3 border-b border-[hsl(var(--stroke-default))]">
      <p className="text-base leading-5">
        {query !== undefined
          ? <HighlightedText text={title} query={query} />
          : <span className="font-bold text-[hsl(var(--text-primary))]">{title}</span>
        }
      </p>
      {categoryLabel && (
        <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">{categoryLabel}</p>
      )}
    </div>
    <div className="px-4 py-3 flex flex-col gap-3">
      {children}
    </div>
  </div>
);

const LearnMore: React.FC<{ href?: string }> = ({ href = '#' }) => (
  <a href={href} className="text-[hsl(var(--brand-700))] underline ml-1" onClick={e => e.preventDefault()}>
    Learn more
  </a>
);

const RichTextToolbar: React.FC = () => (
  <div className="flex items-center gap-0.5 pb-2 border-b border-[hsl(var(--stroke-default))]">
    {[
      { icon: <TextBold20Regular />, label: 'Bold' },
      { icon: <TextItalic20Regular />, label: 'Italic' },
      { icon: <Code20Regular />, label: 'Code' },
      { icon: <MathFormula20Regular />, label: 'Formula' },
      { icon: <ArrowUndo20Regular />, label: 'Undo' },
      { icon: <ArrowRedo20Regular />, label: 'Redo' },
    ].map(({ icon, label }) => (
      <CopilotButton key={label} variant="ghost" size="sm" icon={icon} title={label} />
    ))}
  </div>
);

const RichTextArea: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <div className="border border-[hsl(var(--stroke-default))] rounded-[6px] px-3 py-2 flex flex-col gap-2">
    <RichTextToolbar />
    <CopilotTextarea
      placeholder={placeholder}
      className="min-h-[72px]"
    />
  </div>
);

// ─── Individual section content components (each has own local state) ─────────

const MODEL_OPTIONS = [
  { label: 'GPT-4o (default)', value: 'gpt-4o' },
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'o3-mini (preview)', value: 'o3-mini' },
];

const MODERATION_LABELS = ['Low', 'Medium', 'High'];

const OrchestrationContent: React.FC = () => {
  const [orchestration, setOrchestration] = useState<'yes' | 'no'>('yes');
  const [deepReasoning, setDeepReasoning] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">
          Use generative AI orchestration for your agent's responses?
        </p>
        <RadioGroup
          value={orchestration}
          onChange={(_, data) => setOrchestration(data.value as 'yes' | 'no')}
          style={{ gap: 0 }}
        >
          <Radio value="yes" label={<span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Yes - Responses will be dynamic, using available tools and knowledge as appropriate</span>} />
          <Radio value="no" label={<span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">No - Use classic orchestration, limiting responses to the content and behavior defined in your agent's topics</span>} />
        </RadioGroup>
      </div>
      <SectionDivider />
      <SettingRow
        title="Deep reasoning"
        description="Enable advanced reasoning for AI actions"
        control={
          <Switch
            checked={deepReasoning}
            onChange={(_, data) => setDeepReasoning(data.checked)}
            label={deepReasoning ? 'On' : 'Off'}
          />
        }
      />
    </>
  );
};

const ModelContent: React.FC = () => {
  const [model, setModel] = useState('gpt-4o');
  const [retiredModels, setRetiredModels] = useState(false);
  return (
    <>
      <SettingRow
        title="Select your agent's model"
        description={
          <>
            Your agent will primarily use the model for reasoning and responding. Experimental models are subject to{' '}
            <span role="button" tabIndex={0} className="text-[hsl(var(--brand-700))] underline cursor-pointer hover:text-[hsl(var(--brand-700))]" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}>preview terms</span>.{' '}
            <LearnMore />
          </>
        }
        control={
          <div className="w-[180px]">
            <CopilotDropdown options={MODEL_OPTIONS} value={model} onChange={setModel} size="sm" />
          </div>
        }
        alignTop
      />
      <SectionDivider />
      <SettingRow
        title="Continue using retired models?"
        description={<>Get 30 additional days with your existing model before it becomes unavailable. <LearnMore /></>}
        control={
          <Switch
            checked={retiredModels}
            onChange={(_, data) => setRetiredModels(data.checked)}
            label={retiredModels ? 'On' : 'Off'}
          />
        }
      />
    </>
  );
};

const KnowledgeContent: React.FC = () => {
  const [generalKnowledge, setGeneralKnowledge] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  return (
    <>
      <SettingRow
        title="Use general knowledge"
        description={<>Your agent will primarily use the model for reasoning and responding. Experimental models are subject to <span role="button" tabIndex={0} className="text-[hsl(var(--brand-700))] underline cursor-pointer hover:text-[hsl(var(--brand-700))]" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}>preview terms</span>. <LearnMore /></>}
        control={
          <Switch
            checked={generalKnowledge}
            onChange={(_, data) => setGeneralKnowledge(data.checked)}
            label={generalKnowledge ? 'On' : 'Off'}
          />
        }
      />
      <SectionDivider />
      <SettingRow
        title="Use information from the Web"
        description={<>Let your agent browse the web using Bing Web search. <LearnMore /></>}
        control={
          <Switch
            checked={webSearch}
            onChange={(_, data) => setWebSearch(data.checked)}
            label={webSearch ? 'On' : 'Off'}
          />
        }
      />
    </>
  );
};

const FileProcessingContent: React.FC = () => {
  const [fileUploads, setFileUploads] = useState(true);
  const [codeInterpreter, setCodeInterpreter] = useState(false);
  return (
    <>
      <SettingRow
        title="File uploads"
        description={<>Users can upload PDF, TXT, CSV and images (png, webp, jpeg and non-animated gif) that agents can use in conversations. Uploads are limited to 15 MB. <LearnMore /></>}
        control={
          <Switch
            checked={fileUploads}
            onChange={(_, data) => setFileUploads(data.checked)}
            label={fileUploads ? 'On' : 'Off'}
          />
        }
        alignTop
      />
      <SectionDivider />
      <SettingRow
        title="Code interpreter"
        description={<>Generate and run code on demand to process files, create reports, and more. Note that file type and size limits apply. <LearnMore /></>}
        control={
          <Switch
            checked={codeInterpreter}
            onChange={(_, data) => setCodeInterpreter(data.checked)}
            label={codeInterpreter ? 'On' : 'Off'}
          />
        }
        alignTop
      />
    </>
  );
};

const ConnectedAgentsContent: React.FC = () => {
  const [connectedAgents, setConnectedAgents] = useState(true);
  return (
    <SettingRow
      title="Let other agents connect to and use this one"
      description={<>Let agents work together to complete workflows. <LearnMore /></>}
      control={
        <Switch
          checked={connectedAgents}
          onChange={(_, data) => setConnectedAgents(data.checked)}
          label={connectedAgents ? 'On' : 'Off'}
        />
      }
    />
  );
};

const SearchSettingsContent: React.FC = () => {
  const [semanticSearch, setSemanticSearch] = useState(true);
  return (
    <SettingRow
      title="Tenant graph grounding with semantic search"
      description="Can provide improved search performance for Microsoft 365 Copilot tenants."
      control={
        <Switch
          checked={semanticSearch}
          onChange={(_, data) => setSemanticSearch(data.checked)}
          label={semanticSearch ? 'On' : 'Off'}
        />
      }
    />
  );
};

const ResponsesContent: React.FC = () => (
  <div className="flex flex-col gap-2">
    <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">Response formatting</p>
    <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
      Specify the format and style of the responses in this agent. If these conflict with other instructions for this agent, these will override them.{' '}
      <LearnMore />
    </p>
    <RichTextArea placeholder="What should your end users know before they submit feedback? For example: 'Your feedback will only be used to improve our services.'" />
  </div>
);

const ModerationContent: React.FC = () => {
  const [moderationLevel, setModerationLevel] = useState(50);
  return (
    <>
      <SettingRow
        title="Content moderation level"
        description={<>Lower moderation increases the risk of harmful content in your agent's responses. Higher moderation lowers that risk, but may reduce the number of responses. <LearnMore /></>}
        control={
          <div className="flex flex-col items-end gap-1 min-w-[160px]">
            <span className="text-xs text-[hsl(var(--text-secondary))]">{MODERATION_LABELS[Math.round(moderationLevel / 50)]}</span>
            <Slider
              min={0}
              max={100}
              step={50}
              value={moderationLevel}
              onChange={(_, data) => setModerationLevel(data.value)}
              style={{ width: 140 }}
            />
          </div>
        }
        alignTop
      />
      <SectionDivider />
      <div className="flex flex-col gap-2">
        <p className="text-sm leading-5 text-[hsl(var(--text-primary))]">When potential responses get flagged by content moderation, send:</p>
        <RichTextArea placeholder="I can't help with that. Is there something else I can help you with?" />
      </div>
    </>
  );
};

const UserFeedbackContent: React.FC = () => {
  const [collectReactions, setCollectReactions] = useState(true);
  return (
    <>
      <SettingRow
        title="Collect user reactions to agent messages"
        description={<>Users can give thumbs-up or thumbs-down and an optional comment. Feedback goes to your organization, not Microsoft. <LearnMore /></>}
        control={
          <Switch
            checked={collectReactions}
            onChange={(_, data) => setCollectReactions(data.checked)}
            label={collectReactions ? 'On' : 'Off'}
          />
        }
        alignTop
      />
      <SectionDivider />
      <div className="flex flex-col gap-2">
        <p className="text-sm leading-5 text-[hsl(var(--text-primary))]">When potential responses get flagged by content moderation, send:</p>
        <RichTextArea />
      </div>
    </>
  );
};

const LanguageUnderstandingContent: React.FC = () => {
  const [languageUnderstanding, setLanguageUnderstanding] = useState<'quick' | 'azure-nlu'>('quick');
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">
        Decide how your agent will respond during conversations
      </p>
      <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
        Are you getting started quickly, or is precision your goal (even if it means extra work)?{' '}
        <LearnMore />
      </p>
      <RadioGroup
        value={languageUnderstanding}
        onChange={(_, data) => setLanguageUnderstanding(data.value as 'quick' | 'azure-nlu')}
      >
        <Radio value="quick" label={<span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Quick, lightweight and the easiest way to get started</span>} />
        <Radio value="azure-nlu" label={<span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Utilize prebuilt Azure NLU</span>} />
      </RadioGroup>
    </div>
  );
};

// ─── Security section content components ─────────────────────────────────────

const AuthenticationContent: React.FC = () => {
  const [authMethod, setAuthMethod] = useState<'none' | 'microsoft' | 'manual'>('microsoft');
  return (
    <>
      <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
        Select how your agent will authenticate the user's identity during the chat.
      </p>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">Choose an option</p>
        <RadioGroup
          value={authMethod}
          onChange={(_, data) => setAuthMethod(data.value as 'none' | 'microsoft' | 'manual')}
          style={{ gap: 0 }}
        >
          <Radio
            value="none"
            label={
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-xs leading-4 text-[hsl(var(--text-secondary))]">
                  No authentication <Warning20Regular className="text-[hsl(var(--status-error))] w-4 h-4" />
                </span>
                <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Publicly available in any channel</span>
              </span>
            }
          />
          <Radio
            value="microsoft"
            label={
              <span className="flex flex-col gap-0.5">
                <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Authenticate with Microsoft</span>
                <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Entra ID authentication in Microsoft Teams, SharePoint, Power Apps, or Microsoft 365 Copilot</span>
              </span>
            }
          />
          <Radio
            value="manual"
            label={
              <span className="flex flex-col gap-0.5">
                <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Authenticate manually</span>
                <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">Set up authentication for any channel</span>
              </span>
            }
          />
        </RadioGroup>
      </div>
    </>
  );
};

const SecretField: React.FC<{ label: string }> = ({ label }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 border border-[hsl(var(--stroke-default))] rounded-lg px-3 h-8 bg-[hsl(var(--surface-secondary))]">
          <span className="flex-1 text-sm tracking-[0.2em] text-[hsl(var(--text-secondary))] select-none">
            {visible ? 'sk-••••••••••••••••••••••••••••••••' : '••••••••••••••••••••••••••••••••••••••••••••••••••••'}
          </span>
          <CopilotButton
            variant="ghost"
            size="sm"
            icon={visible ? <EyeOff20Regular /> : <Eye20Regular />}
            onClick={() => setVisible(v => !v)}
            title={visible ? 'Hide' : 'Show'}
          />
        </div>
        <CopilotButton variant="secondary" size="sm" icon={<ArrowCounterclockwise20Regular />}>Regenerate</CopilotButton>
        <CopilotButton variant="secondary" size="sm" icon={<Copy20Regular />}>Copy</CopilotButton>
      </div>
    </div>
  );
};

const WebChannelSecurityContent: React.FC = () => {
  const [requireSecuredAccess, setRequireSecuredAccess] = useState(false);
  return (
    <>
      <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
        Microsoft Copilot Studio provides several channels by default, some of which use Direct Line to facilitate
        communication between the copilot and your client application. <LearnMore />
      </p>
      <SectionDivider />
      <div className="flex flex-col gap-3">
        <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">Secrets and tokens</p>
        <SecretField label="Secret 1" />
        <SecretField label="Secret 2" />
      </div>
      <SectionDivider />
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">Secured access</p>
        <SettingRow
          title="Require secured access"
          description="Enabling this renders the Demo website unavailable as well as any Direct Line channel not using a secret or token."
          control={
            <Switch
              checked={requireSecuredAccess}
              onChange={(_, data) => setRequireSecuredAccess(data.checked)}
              label={requireSecuredAccess ? 'On' : 'Off'}
            />
          }
          alignTop
        />
      </div>
    </>
  );
};

// ─── Languages section content components ────────────────────────────────────

const PrimaryLanguageContent: React.FC = () => (
  <div className="flex flex-col gap-3">
    <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
      The primary language is used for the agent's default interactions and voice features.
    </p>
    <div className="border border-[hsl(var(--stroke-default))] rounded-lg px-4 py-3">
      <p className="font-semibold text-sm leading-5 text-[hsl(var(--text-primary))]">English (United States)</p>
      <p className="text-xs leading-4 text-[hsl(var(--text-secondary))] mt-0.5">en-US</p>
      <div className="flex items-center gap-1 mt-2">
        <CheckmarkCircle16Filled className="text-[hsl(var(--status-success))]" />
        <span className="text-xs leading-4 text-[hsl(var(--status-success))]">Voice features supported</span>
      </div>
    </div>
  </div>
);

const SecondaryLanguagesContent: React.FC = () => (
  <div className="flex flex-col gap-3">
    <p className="text-xs leading-4 text-[hsl(var(--text-secondary))]">
      Add additional languages your agent can understand and respond in.
    </p>
    <p className="text-sm leading-5 text-[hsl(var(--text-tertiary))]">No additional languages</p>
    <div>
      <CopilotButton variant="secondary" size="sm" icon={<Add16Regular />}>
        Add language
      </CopilotButton>
    </div>
  </div>
);

// ─── Section registry ─────────────────────────────────────────────────────────
// Each entry describes a settings section for search indexing and rendering.

interface SectionDef {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  /** Keywords used for search matching (in addition to title + categoryLabel) */
  keywords: string[];
  Content: React.FC;
}

const ALL_SECTIONS: SectionDef[] = [
  {
    id: 'orchestration',
    title: 'Orchestration',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['orchestration', 'deep reasoning', 'reasoning', 'ai actions', 'generative', 'classic orchestration'],
    Content: OrchestrationContent,
  },
  {
    id: 'model',
    title: 'Model',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['model', 'gpt-4o', 'gpt', 'o3-mini', 'retired', 'preview terms', 'select model'],
    Content: ModelContent,
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['knowledge', 'web search', 'bing', 'general knowledge', 'web information'],
    Content: KnowledgeContent,
  },
  {
    id: 'file-processing',
    title: 'File processing capabilities',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['file', 'upload', 'code interpreter', 'pdf', 'csv', 'images', 'processing'],
    Content: FileProcessingContent,
  },
  {
    id: 'connected-agents',
    title: 'Connected agents',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['connected agents', 'connect', 'workflows', 'agent connectivity'],
    Content: ConnectedAgentsContent,
  },
  {
    id: 'search-settings',
    title: 'Search',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['search', 'semantic', 'graph', 'microsoft 365', 'tenant'],
    Content: SearchSettingsContent,
  },
  {
    id: 'responses',
    title: 'Responses',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['response', 'formatting', 'format', 'style', 'output'],
    Content: ResponsesContent,
  },
  {
    id: 'moderation',
    title: 'Moderation',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['moderation', 'content', 'harmful', 'content moderation', 'flagged'],
    Content: ModerationContent,
  },
  {
    id: 'user-feedback',
    title: 'User feedback',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['feedback', 'reactions', 'thumbs', 'thumbs-up', 'thumbs-down', 'user reactions'],
    Content: UserFeedbackContent,
  },
  {
    id: 'language-understanding',
    title: 'Language understanding',
    categoryId: 'general',
    categoryLabel: 'General',
    keywords: ['language', 'nlu', 'azure nlu', 'language understanding', 'conversations'],
    Content: LanguageUnderstandingContent,
  },
  {
    id: 'authentication',
    title: 'Authentication',
    categoryId: 'security',
    categoryLabel: 'Security',
    keywords: ['authentication', 'auth', 'entra', 'microsoft login', 'no authentication', 'manual auth', 'identity'],
    Content: AuthenticationContent,
  },
  {
    id: 'web-channel-security',
    title: 'Web channel security',
    categoryId: 'security',
    categoryLabel: 'Security',
    keywords: ['web channel', 'direct line', 'secret', 'token', 'secured access', 'regenerate', 'copy secret'],
    Content: WebChannelSecurityContent,
  },
  {
    id: 'primary-language',
    title: 'Primary language',
    categoryId: 'languages',
    categoryLabel: 'Languages',
    keywords: ['primary language', 'english', 'en-us', 'voice features', 'locale', 'language'],
    Content: PrimaryLanguageContent,
  },
  {
    id: 'secondary-languages',
    title: 'Secondary languages',
    categoryId: 'languages',
    categoryLabel: 'Languages',
    keywords: ['secondary language', 'additional language', 'multilingual', 'add language', 'locale'],
    Content: SecondaryLanguagesContent,
  },
];

function sectionMatchesQuery(section: SectionDef, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    section.title.toLowerCase().includes(q) ||
    section.categoryLabel.toLowerCase().includes(q) ||
    section.keywords.some(k => k.toLowerCase().includes(q))
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

interface Category {
  id: string;
  label: string;
  description: string;
}

const SETTINGS_CATEGORIES: Category[] = [
  { id: 'general', label: 'General', description: 'Model, knowledge, orchestration, and response behavior' },
  { id: 'security', label: 'Security', description: 'Authentication, authorization, and data access controls' },
  { id: 'connections', label: 'Connections', description: 'Manage external services and API integrations' },
  { id: 'entities', label: 'Entities', description: 'Define and configure custom data entities for your agent' },
  { id: 'languages', label: 'Languages', description: 'Configure supported languages and localization settings' },
  { id: 'voice', label: 'Voice', description: 'Speech recognition, voice output, and IVR settings' },
  { id: 'component-collections', label: 'Component collections', description: 'Organize and manage reusable UI component sets' },
  { id: 'advanced', label: 'Advanced', description: 'Low-level configuration and experimental options' },
];

// ─── Global search results (shown on landing page when query is active) ───────

const SearchResultsView: React.FC<{ query: string }> = ({ query }) => {
  const matching = ALL_SECTIONS.filter(s => sectionMatchesQuery(s, query));
  return (
    <div className="flex flex-col gap-5">
      {matching.map(section => (
        <SectionCard
          key={section.id}
          title={section.title}
          categoryLabel={section.categoryLabel}
          query={query}
        >
          <section.Content />
        </SectionCard>
      ))}
      {matching.length === 0 && (
        <div className="flex items-center justify-center h-40 text-sm text-[hsl(var(--text-tertiary))]">
          No settings match your search.
        </div>
      )}
    </div>
  );
};

// ─── Landing / list view ──────────────────────────────────────────────────────

interface ListViewProps {
  categories: Category[];
  onSelect: (category: Category) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const ListView: React.FC<ListViewProps> = ({ categories, onSelect, searchQuery, onSearchChange }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="px-16 pt-5 pb-6 flex items-center justify-between gap-4 shrink-0">
      <h1 className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))]">Settings</h1>
      <div className="w-[200px]">
        <CopilotInput
          placeholder="Search"
          size="sm"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          contentAfter={searchQuery ? (
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<DismissCircle16Regular />}
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            />
          ) : undefined}
        />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-16 pb-8">
      {searchQuery ? (
        <SearchResultsView query={searchQuery} />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map(category => (
            <CopilotButton
              key={category.id}
              variant="transparent"
              onClick={() => onSelect(category)}
              className="w-full !h-auto !px-5 !py-4 text-left justify-between border border-[hsl(var(--stroke-default))] rounded-[10px] hover:bg-[hsl(var(--surface-secondary))] group"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-bold text-base leading-5 text-[hsl(var(--text-primary))]">{category.label}</p>
                <p className="font-normal text-xs leading-4 text-[hsl(var(--text-secondary))]">{category.description}</p>
              </div>
              <ChevronRight20Regular className="text-[hsl(var(--text-secondary))] shrink-0 group-hover:text-[hsl(var(--text-primary))] transition-colors" />
            </CopilotButton>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ─── Detail view (drilled into a category) ────────────────────────────────────

const CategoryDetailContent: React.FC<{ categoryId: string; searchQuery: string }> = ({ categoryId, searchQuery }) => {
  const visible = ALL_SECTIONS.filter(
    s => s.categoryId === categoryId && sectionMatchesQuery(s, searchQuery)
  );
  return (
    <div className="flex flex-col gap-5">
      {visible.map(section => (
        <SectionCard key={section.id} title={section.title} query={searchQuery}>
          <section.Content />
        </SectionCard>
      ))}
      {visible.length === 0 && (
        <div className="flex items-center justify-center h-40 text-sm text-[hsl(var(--text-tertiary))]">
          No settings match your search.
        </div>
      )}
    </div>
  );
};


interface DetailViewProps {
  category: Category;
  onBack: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const DetailView: React.FC<DetailViewProps> = ({ category, onBack, searchQuery, onSearchChange }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="px-16 pt-5 pb-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <CopilotButton
          variant="ghost"
          size="sm"
          icon={<ArrowLeft20Regular />}
          onClick={onBack}
          title="Back to Settings"
        />
        <h1 className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))]">{category.label}</h1>
      </div>
      <div className="w-[200px]">
        <CopilotInput
          placeholder="Search"
          size="sm"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          contentAfter={searchQuery ? (
            <CopilotButton
              variant="ghost"
              size="sm"
              icon={<DismissCircle16Regular />}
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            />
          ) : undefined}
        />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-16 pb-8">
      {['general', 'security', 'languages'].includes(category.id) ? (
        <CategoryDetailContent categoryId={category.id} searchQuery={searchQuery} />
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-[hsl(var(--text-tertiary))]">
          This section is not yet available.
        </div>
      )}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const AgentSettingsPageSimplified: React.FC = () => {
  const navigate = useNavigate();
  const { agentConfig } = useAgent();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setSearchQuery('');
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setSearchQuery('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Thin top bar: breadcrumb + close */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-[hsl(var(--stroke-default))]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">{agentConfig.name}</span>
          <span className="font-bold text-sm leading-5 text-[hsl(var(--text-primary))]">Settings</span>
        </div>
        <CopilotButton
          variant="ghost"
          size="sm"
          icon={<Dismiss20Regular />}
          onClick={() => navigate(-1)}
          title="Close settings"
          className="hover:bg-[hsl(var(--surface-tertiary))]"
        />
      </div>

      {selectedCategory ? (
        <DetailView
          category={selectedCategory}
          onBack={handleBack}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : (
        <ListView
          categories={SETTINGS_CATEGORIES}
          onSelect={handleSelectCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
    </div>
  );
};
