import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Dismiss20Regular,
  ArrowUpload20Regular,
  Link20Regular,
  ChevronDown20Regular,
  OpenRegular,
  Globe20Regular,
} from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotTextarea } from '../../../components/ui/CopilotTextarea';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { useAgent } from '../../../context/AgentContext';

export interface NewRestApiPanelProps {
  onBack: () => void;
  onAdd: (name: string) => void;
}

const LINE_COUNT = 14;

export const NewRestApiPanel: React.FC<NewRestApiPanelProps> = ({ onBack, onAdd }) => {
  const { agentConfig } = useAgent();
  const [schema, setSchema] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [auth, setAuth] = useState<'none' | 'apikey' | 'oauth2'>('none');
  const [apiKey, setApiKey] = useState('');
  const [authType, setAuthType] = useState<'basic' | 'bearer' | 'custom'>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAdd = uniqueId.trim() !== '';

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(uniqueId.trim());
    onBack();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSchema(ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  // Dynamic line numbers based on schema content
  const lineCount = Math.max(LINE_COUNT, schema.split('\n').length + 1);
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  const portalTarget =
    document.getElementById('elevate-conv-right-pane') ||
    document.getElementById('elevate-right-pane');

  const panel = (
    <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="px-10 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-[hsl(var(--stroke-default))]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">{agentConfig.name}</span>
          <span className="font-bold text-sm leading-5 text-[hsl(var(--text-primary))]">New REST API</span>
        </div>
        <CopilotButton
          variant="ghost"
          size="sm"
          icon={<Dismiss20Regular />}
          onClick={onBack}
          title="Close"
        />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1024px] w-full mx-auto px-8 py-8 flex flex-col gap-8">

          {/* Subheader: icon + title + Add button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Globe20Regular className="w-5 h-5 text-gray-500" />
                </div>
                <h1 className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))]">New REST API</h1>
              </div>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">
                REST APIs are powerful, versatile tools that can connect to external services. They may be subject to separate terms from the external service and should be used carefully.
              </p>
            </div>
            <CopilotButton
              variant="primary"
              size="sm"
              disabled={!canAdd}
              onClick={handleAdd}
              className="flex-shrink-0 mt-1"
            >
              Add to agent
            </CopilotButton>
          </div>

          {/* Schema card */}
          <div className="border border-[hsl(var(--stroke-default))] rounded-2xl px-6 py-6 flex flex-col gap-4">
            <p className="font-bold text-sm text-[hsl(var(--text-primary))]">Schema</p>

            {/* Toolbar row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  icon={<ArrowUpload20Regular />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import from file
                </CopilotButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  className="hidden"
                  onChange={handleFileImport}
                />
                <CopilotButton
                  variant="ghost"
                  size="sm"
                  icon={<Link20Regular />}
                >
                  Import from URL
                </CopilotButton>
              </div>
              <CopilotButton
                variant="ghost"
                size="sm"
                icon={<ChevronDown20Regular />}
                iconPosition="right"
              >
                Example schema
              </CopilotButton>
            </div>

            {/* Code editor */}
            <div className="relative border border-[hsl(var(--stroke-default))] rounded-lg overflow-hidden">
              <div className="flex min-h-[200px] max-h-[340px] overflow-y-auto font-mono text-xs">
                {/* Line numbers */}
                <div className="flex-shrink-0 bg-[hsl(var(--surface-tertiary))] border-r border-[hsl(var(--stroke-default))] px-3 py-3 select-none text-right text-[hsl(var(--text-disabled))] leading-5">
                  {lines.map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
                {/* Textarea */}
                <CopilotTextarea
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                  className="flex-1 py-3 px-3 resize-none outline-none text-[hsl(var(--text-primary))] leading-5 bg-white min-h-[200px] border-0 rounded-none font-mono text-xs"
                  style={{ minHeight: `${lineCount * 20 + 24}px` }}
                  spellCheck={false}
                />
              </div>
              {/* Expand icon */}
              <CopilotButton
                variant="ghost"
                size="sm"
                icon={<OpenRegular />}
                className="absolute top-1 right-1"
                aria-label="Expand schema editor"
                onClick={() => {}}
              />
            </div>

            {/* Unique identifier */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Unique identifier <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                placeholder="Enter a name"
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                size="md"
              />
            </div>
          </div>

          {/* Authentication card */}
          <div className="border border-[hsl(var(--stroke-default))] rounded-2xl px-6 py-6 flex flex-col gap-4">
            <p className="font-bold text-sm text-[hsl(var(--text-primary))]">Authentication</p>

            {/* Auth radio row */}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-[hsl(var(--text-primary))]">Authentication</p>
              <div className="flex items-center gap-2">
                {([
                  { value: 'none', label: 'None' },
                  { value: 'apikey', label: 'API key' },
                  { value: 'oauth2', label: 'OAuth 2.0' },
                ] as const).map(({ value, label }) => (
                  <CopilotFilterPill
                    key={value}
                    label={label}
                    size="sm"
                    active={auth === value}
                    onClick={() => setAuth(value)}
                  />
                ))}
              </div>
            </div>

            {/* API key fields — shown when apikey selected */}
            {auth === 'apikey' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-[hsl(var(--text-primary))]">
                    API key <span className="text-red-500">*</span>
                  </label>
                  <CopilotInput
                    placeholder="Enter the API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    size="md"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-[hsl(var(--text-primary))]">
                    Auth type <span className="text-red-500">*</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {([
                      { value: 'basic', label: 'Basic' },
                      { value: 'bearer', label: 'Bearer' },
                      { value: 'custom', label: 'Custom' },
                    ] as const).map(({ value, label }) => (
                      <CopilotFilterPill
                        key={value}
                        label={label}
                        size="sm"
                        active={authType === value}
                        onClick={() => setAuthType(value)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (portalTarget) return createPortal(panel, portalTarget);
  return panel;
};
