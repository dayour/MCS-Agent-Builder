import { useState } from 'react';
import { CopilotButton } from '../../../components/ui/CopilotButton';
import { CopilotDropdown } from '../../../components/ui/CopilotDropdown';
import { CopilotRadioGroup } from '../../../components/ui/CopilotRadioGroup';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  ArrowSync20Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { useAgent } from '../../../context/AgentContext';

// ── MOCK DATA — prototype only, not real API responses ────────────────────

const AZURE_SUBSCRIPTIONS = [ // MOCK
  { label: 'Azure Subscription 1', value: 'sub-1' },
  { label: 'Pay-As-You-Go', value: 'payg' },
];

const ACS_RESOURCES: Record<string, { label: string; value: string }[]> = { // MOCK
  'sub-1': [
    { label: 'WhatsApp-ACS-Resource-1', value: 'wa-acs-resource-1' },
    { label: 'ACS-Production', value: 'acs-prod' },
  ],
  'payg': [
    { label: 'ACS-Staging', value: 'acs-staging' },
    { label: 'ACS-Dev', value: 'acs-dev' },
  ],
};

const PHONE_NUMBERS = [ // MOCK
  { number: '+1 877-214-3579', available: true },
  { number: '+1 833-241-2159', available: false },
  { number: '+1 866-232-5058', available: true },
  { number: '+1 877-224-7831', available: true },
  { number: '+1 877-215-3894', available: false },
  { number: '+1 833-240-2244', available: true },
];

// ── Component ──────────────────────────────────────────────────────────────

export function WhatsAppSetupSection() {
  const { updateAgentConfig, agentConfig } = useAgent();

  // Restore persisted state from triggerDistribution
  const waConfig = agentConfig.triggerDistribution?.whatsapp ?? {};

  // Step open/close state
  const [prerequisitesOpen, setPrerequisitesOpen] = useState(!waConfig.whatsappSubscription);
  const [azureConfigOpen, setAzureConfigOpen] = useState(!!waConfig.whatsappSubscription && !waConfig.whatsappPhoneNumber);
  // phoneOpen state removed — phone numbers now inline in the Azure config section

  // Form state — initialized from persisted config
  const [subscription, setSubscription] = useState(waConfig.whatsappSubscription ?? '');
  const [acsResource, setAcsResource] = useState(waConfig.whatsappAcsResource ?? '');
  const [selectedPhone, setSelectedPhone] = useState(waConfig.whatsappPhoneNumber ?? '');

  // Persist WhatsApp config to agentConfig
  const updateWhatsAppConfig = (patch: Partial<typeof waConfig>) => {
    const current = agentConfig.triggerDistribution?.whatsapp ?? {};
    updateAgentConfig({
      triggerDistribution: {
        ...(agentConfig.triggerDistribution ?? {}),
        whatsapp: { ...current, ...patch },
      },
    });
  };

  // Handle phone selection
  const handlePhoneSelect = (phone: string) => {
    setSelectedPhone(phone);
    updateWhatsAppConfig({ whatsappPhoneNumber: phone });
  };

  const availableResources = subscription ? (ACS_RESOURCES[subscription] ?? []) : [];

  return (
    <div className="space-y-3">
      {/* ── Step 1: Prerequisites ──────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl">
        <CopilotButton
          variant="transparent"
          onClick={() => setPrerequisitesOpen(v => !v)}
          className="w-full flex items-start gap-2 px-6 py-4 text-left"
          aria-expanded={prerequisitesOpen}
          style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <span className="mt-0.5 flex-shrink-0">
            {prerequisitesOpen ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} /> : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Prerequisites</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Complete these steps before your agent can use WhatsApp.{' '}
              <a href="#" className="text-[hsl(var(--primary))] hover:underline" onClick={e => e.preventDefault()}>Learn more</a>
            </p>
          </div>
        </CopilotButton>

        {prerequisitesOpen && (
          <div className="px-6 pb-5">
            <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 mt-2">
              <li>Sign up for a WhatsApp for Business account.</li>
              <li>Link your WhatsApp for Business account to an Azure Communication Services (ACS) resource.</li>
              <li>Make sure your Copilot Studio and ACS resource are in the same tenant.</li>
            </ol>
          </div>
        )}
      </div>

      {/* ── Step 2: Azure Configuration ────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl">
        <CopilotButton
          variant="transparent"
          onClick={() => setAzureConfigOpen(v => !v)}
          className="w-full flex items-start gap-2 px-6 py-4 text-left"
          aria-expanded={azureConfigOpen}
          style={{ height: 'auto', borderRadius: 0, justifyContent: 'flex-start', minHeight: 0, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <span className="mt-0.5 flex-shrink-0">
            {azureConfigOpen ? <ChevronDown16Regular style={{ color: 'hsl(var(--text-secondary))' }} /> : <ChevronRight16Regular style={{ color: 'hsl(var(--text-secondary))' }} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Connect to your WhatsApp for Business Account</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {subscription && acsResource
                ? `${AZURE_SUBSCRIPTIONS.find(s => s.value === subscription)?.label} · ${availableResources.find(r => r.value === acsResource)?.label}${selectedPhone ? ` · ${selectedPhone}` : ''}`
                : 'Via Azure Communication Services, an Authorised Business Solution Provider for Meta.'}
            </p>
          </div>
        </CopilotButton>

        {azureConfigOpen && (
          <div className="px-6 pb-5 space-y-4">
            <p className="text-xs text-gray-500">
              You'll need an Azure Subscription that includes a resource with Azure Communication Services.
            </p>

            {/* Azure Subscription */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Azure Subscription <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <CopilotDropdown
                  variant="dropdown"
                  size="sm"
                  value={subscription}
                  placeholder="Select Subscription(s)"
                  options={AZURE_SUBSCRIPTIONS.map(s => ({ label: s.label, value: s.value }))}
                  onChange={val => {
                    setSubscription(val);
                    setAcsResource('');
                    updateWhatsAppConfig({ whatsappSubscription: val, whatsappAcsResource: '' });
                  }}
                  fullWidth
                />
                <CopilotButton variant="transparent" size="sm" icon={<ArrowSync20Regular />} aria-label="Refresh subscriptions" />
              </div>
            </div>

            {/* ACS Resource */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Azure Communication Service resource <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <CopilotDropdown
                  variant="dropdown"
                  size="sm"
                  value={acsResource}
                  placeholder="Select resource"
                  options={availableResources.map(r => ({ label: r.label, value: r.value }))}
                  onChange={val => {
                    setAcsResource(val);
                    updateWhatsAppConfig({ whatsappAcsResource: val });
                  }}
                  disabled={!subscription}
                  fullWidth
                />
                <CopilotButton variant="transparent" size="sm" icon={<ArrowSync20Regular />} aria-label="Refresh resources" />
              </div>
            </div>

            {/* ── Phone Number selection (inline, below dropdowns) ── */}
            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-sm font-semibold text-gray-900 mb-1">Phone Number</p>

              {!(subscription && acsResource) ? (
                <div className="flex gap-2 p-3 bg-[hsl(var(--surface-secondary))] rounded-lg">
                  <Info16Regular className="text-[hsl(var(--text-secondary))] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
                    Select an Azure Subscription and ACS resource above to see available phone numbers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Which phone number should your agent connect to?</p>

                  {/* Warning — subtle inline hint */}
                  <p className="text-xs text-gray-400">
                    Some numbers are already in use. Greyed-out numbers are linked to another agent.
                  </p>

                  {/* Phone number list */}
                  <CopilotRadioGroup
                    name="whatsapp-phone"
                    value={selectedPhone}
                    onChange={(value) => handlePhoneSelect(value)}
                    options={PHONE_NUMBERS.map(({ number, available }) => ({
                      value: number,
                      label: number,
                      description: !available ? 'In use' : undefined,
                      disabled: !available,
                    }))}
                  />

                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
