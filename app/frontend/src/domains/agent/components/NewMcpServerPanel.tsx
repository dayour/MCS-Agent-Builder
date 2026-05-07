import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Code20Regular, Dismiss20Regular } from '@fluentui/react-icons';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotInput } from '../../../components/ui/CopilotInput';
import { CopilotFilterPill } from '../../../components/ui/CopilotFilterPill';
import { useAgent } from '../../../context/AgentContext';

export interface NewMcpServerPanelProps {
  onBack: () => void;
  onAdd: (mcpName: string) => void;
}

export const NewMcpServerPanel: React.FC<NewMcpServerPanelProps> = ({ onBack, onAdd }) => {
  const { agentConfig } = useAgent();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [auth, setAuth] = useState<'none' | 'apikey' | 'oauth2'>('none');
  const [type, setType] = useState<'dynamic-discovery' | 'dynamic' | 'manual'>('dynamic-discovery');

  const canAdd = name.trim() !== '' && description.trim() !== '' && endpoint.trim() !== '';

  const handleAdd = () => {
    if (!canAdd) return;
    // Mock-only: description and endpoint are validated for realism but only name is persisted.
    // When real MCP registration is wired up, pass description/endpoint through onAdd.
    onAdd(name.trim());
    onBack();
  };

  const portalTarget =
    document.getElementById('elevate-conv-right-pane') ||
    document.getElementById('elevate-right-pane');

  const panel = (
    <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden">
      {/* Top bar — agent name + page title + close */}
      <div className="px-10 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-[hsl(var(--stroke-default))]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs leading-4 text-[hsl(var(--text-secondary))]">{agentConfig.name}</span>
          <span className="font-bold text-sm leading-5 text-[hsl(var(--text-primary))]">New Model Context Protocol</span>
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Code20Regular className="w-5 h-5 text-gray-500" />
              </div>
              <h1 className="font-bold text-xl leading-7 text-[hsl(var(--text-primary))]">New Model Context Protocol</h1>
            </div>
            <CopilotButton
              variant="primary"
              size="sm"
              disabled={!canAdd}
              onClick={handleAdd}
            >
              Add to agent
            </CopilotButton>
          </div>

          {/* Form card */}
          <div className="border border-[hsl(var(--stroke-default))] rounded-2xl px-6 py-6 flex flex-col gap-6">
            {/* Server name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Server name <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                placeholder="Server name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="md"
              />
            </div>

            {/* Server description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Server description <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                placeholder="Describes the purpose of the server..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="md"
              />
            </div>

            {/* Streamable endpoint */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Streamable endpoint <span className="text-red-500">*</span>
              </label>
              <CopilotInput
                placeholder="Streamable endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                size="md"
              />
            </div>

            {/* Authentication */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Authentication</p>
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

            {/* Type */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Type</p>
              <div className="flex items-center gap-2">
                {([
                  { value: 'dynamic-discovery', label: 'Dynamic discovery' },
                  { value: 'dynamic', label: 'Dynamic' },
                  { value: 'manual', label: 'Manual' },
                ] as const).map(({ value, label }) => (
                  <CopilotFilterPill
                    key={value}
                    label={label}
                    size="sm"
                    active={type === value}
                    onClick={() => setType(value)}
                  />
                ))}
              </div>
              {type === 'dynamic-discovery' && (
                <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed mt-1">
                  Your MCP server must support OAuth 2.0 Dynamic Client Registration (DCR) to enable Dynamic Discovery Authentication.
                  If DCR is not supported, authentication may fail. Please verify that your server exposes a valid{' '}
                  <em>registration_endpoint</em> in its OpenID configuration.{' '}
                  <a href="#" className="text-blue-600 underline" onClick={(e) => e.preventDefault()}>Learn more</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (portalTarget) return createPortal(panel, portalTarget);
  return panel;
};
