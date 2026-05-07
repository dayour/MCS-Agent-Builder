import { AgentConfig } from '../../../types';
import { createProvisionalProvenance, PROVISIONAL_SIGNALS } from '../provisionalSignals';
import { PublishCheck, PublishCheckResult } from '../types';
import { POST_PUBLISH_SETUP_APPS, PRE_PUBLISH_APPS } from '../prompts/deploymentReadiness';

const DIRECT_DEPLOYMENT_APPS = [
  'Microsoft Teams',
  'Microsoft 365 Copilot',
  'SharePoint',
] as const;

const CHANNEL_TO_APP_NAME: Record<string, string> = {
  teams: 'Microsoft Teams',
  'microsoft 365': 'Microsoft 365 Copilot',
  m365: 'Microsoft 365 Copilot',
  sharepoint: 'SharePoint',
  website: 'Demo website',
  'demo website': 'Demo website',
  facebook: 'Facebook',
  telegram: 'Telegram',
  outlook: 'Email',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  salesforce: 'SalesForce',
  servicenow: 'ServiceNow',
  twilio: 'Twilio',
  line: 'Line',
  groupme: 'GroupMe',
  genesys: 'Genesys',
  liveperson: 'LivePerson',
  'web app': 'Web app',
  'native app': 'Native app',
  'mcp client': 'MCP client',
};

const POST_PUBLISH_NEXT_STEPS: Partial<Record<string, string>> = {
  Slack: 'Connect the Slack app credentials and finish workspace installation after publishing.',
  WhatsApp: 'Finish the WhatsApp channel connection and phone number setup after publishing.',
  Email: 'Complete the email channel mailbox and authentication setup after publishing.',
};

function normalizeChannel(channel: string | undefined): string | null {
  if (!channel) return null;
  const normalized = channel.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'webchat') return 'website';
  return normalized;
}

function getNormalizedKnownChannel(channel: string): string {
  return channel.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Checks deployment app readiness (if any are configured):
 * - App configuration valid
 * - Authentication valid
 * - Connectivity check
 */
export const deploymentAppsCheck: PublishCheck = {
  id: 'deployment-apps',
  label: 'Preparing deployment apps',

  run: async (agent: AgentConfig): Promise<PublishCheckResult> => {
    const normalizedChannel = normalizeChannel(agent.channel);
    const appName = normalizedChannel
      ? (CHANNEL_TO_APP_NAME[normalizedChannel]
        ?? CHANNEL_TO_APP_NAME[getNormalizedKnownChannel(normalizedChannel)]
        ?? null)
      : null;
    const details: PublishCheckResult['details'] = [];

    if (!appName) {
      if (!normalizedChannel) {
        details.push({
          label: 'Endpoint app selected',
          status: 'passed',
          message: 'No endpoint app selected — skipping deployment check',
        });
        return {
          status: 'passed',
          label: 'Confirmed deployment apps',
          details,
          summary: 'No endpoint app selected — skipping deployment check.',
        };
      }

      details.push({
        label: 'Publish path known',
        status: 'failed',
        message: `No deployment path is defined for ${agent.channel ?? 'this app'} yet`,
      });
      return {
        status: 'failed',
        label: 'Confirmed deployment apps',
        details,
        summary: `Deployment to ${agent.channel ?? 'this app'} is blocked because no deployment path is defined yet.`,
      };
    }

    const isDirectApp = DIRECT_DEPLOYMENT_APPS.includes(appName as typeof DIRECT_DEPLOYMENT_APPS[number]);
    const isKnownPrePublishApp = PRE_PUBLISH_APPS.includes(appName as typeof PRE_PUBLISH_APPS[number]);
    const isKnownPostPublishApp = POST_PUBLISH_SETUP_APPS.includes(appName as typeof POST_PUBLISH_SETUP_APPS[number]);

    if (!isDirectApp && !isKnownPrePublishApp && !isKnownPostPublishApp) {
      details.push({
        label: 'Publish path known',
        status: 'failed',
        message: `No deployment path is defined for ${appName} yet`,
      });
      return {
        status: 'failed',
        label: 'Confirmed deployment apps',
        details,
        summary: `Deployment to ${appName} is blocked because no deployment path is defined yet.`,
      };
    }

    details.push(
      {
        label: 'Endpoint app selected',
        status: 'passed',
        message: appName,
      },
      {
        label: 'Publish path known',
        status: 'passed',
        message: isDirectApp ? `${appName} supports a direct publish path` : `${appName} uses a supported post-publish setup path`,
      },
    );

    if (isKnownPostPublishApp) {
      const nextStep = POST_PUBLISH_NEXT_STEPS[appName] ?? `Complete the ${appName} connection after publishing.`;

      details.push(
        {
          label: 'Post-publish setup',
          status: 'passed',
          message: nextStep,
          provenance: createProvisionalProvenance(
            [PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION, PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY],
            'Replace this fallback when external channel handoff hooks can verify deployment readiness more directly.',
          ),
        },
      );

      return {
        status: 'passed',
        label: 'Confirmed deployment apps',
        details,
        summary: `Deployment path is ready for ${appName}. Next step after publishing: ${nextStep}`,
        provenance: createProvisionalProvenance(
          [PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION, PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY],
          'Replace deployment-readiness fallbacks as external channel handoff hooks become available.',
        ),
      };
    }

    if (isKnownPrePublishApp && !isDirectApp) {
      details.push(
        {
          label: 'Pre-publish setup',
          status: 'passed',
          message: `${appName} can be fully configured before publishing`,
        },
      );

      return {
        status: 'passed',
        label: 'Confirmed deployment apps',
        details,
        summary: `Deployment path is ready for ${appName}.`,
        provenance: createProvisionalProvenance(
          [PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION, PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY],
          'Replace deployment-readiness fallbacks as direct deployment hooks become available.',
        ),
      };
    }

    details.push(
      {
        label: 'Endpoint readiness',
        status: 'passed',
        message: `${appName} is available as a direct deployment target`,
        provenance: createProvisionalProvenance(
          [PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION],
          'Replace this fallback when direct deployment hooks can verify target readiness before publish.',
        ),
      },
      {
        label: 'Connectivity status',
        status: 'passed',
        message: 'No known blocking deployment issue was found for this target',
        provenance: createProvisionalProvenance(
          [PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY],
          'Replace this fallback when direct deployment hooks can verify connectivity before or during publish.',
        ),
      },
    );

    return {
      status: 'passed',
      label: 'Confirmed deployment apps',
      details,
      summary: `Deployment path is ready for ${appName}.`,
      provenance: createProvisionalProvenance(
        [PROVISIONAL_SIGNALS.DEPLOYMENT_AUTHENTICATION, PROVISIONAL_SIGNALS.DEPLOYMENT_CONNECTIVITY],
        'Replace deployment-readiness fallbacks as direct deployment hooks become available.',
      ),
    };
  },
};
