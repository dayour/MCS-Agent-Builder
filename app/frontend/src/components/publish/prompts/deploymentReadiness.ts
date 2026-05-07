/**
 * Step prompt: Deployment Readiness
 *
 * Defines what the HA checks and how it communicates results
 * for channel/app deployment configuration.
 */

import type { StepPrompt } from './types';

/**
 * Apps that can be fully configured before publishing.
 * No additional post-publish setup required.
 *
 * These are used both as the single source of truth for the prompt text below
 * and for any future runtime logic that needs to classify apps.
 */
export const PRE_PUBLISH_APPS = [
  'Microsoft 365 Copilot',
  'Microsoft Teams',
  'SharePoint',
  'Demo website',
  'Dynamics 365 Customer Service',
  'Telephony',
] as const;

/**
 * Apps that require additional setup AFTER publishing.
 * Publishing is allowed, but the HA must provide clear next steps.
 *
 * These are used both as the single source of truth for the prompt text below
 * and for any future runtime logic that needs to classify apps.
 */
export const POST_PUBLISH_SETUP_APPS = [
  'Facebook',
  'WhatsApp',
  'Slack',
  'Telegram',
  'Twilio',
  'Line',
  'GroupMe',
  'Direct Line Speech',
  'Email',
  'Genesys',
  'LivePerson',
  'SalesForce',
  'ServiceNow',
  'Web app',
  'Native app',
  'MCP client',
] as const;

const prePublishList = PRE_PUBLISH_APPS.map(app => `- ${app}`).join('\n');
const postPublishList = POST_PUBLISH_SETUP_APPS.map(app => `- ${app}`).join('\n');

export const deploymentReadinessPrompt: StepPrompt = {
  id: 'deployment-apps',
  label: 'Deployment Readiness',
  order: 3,
  prompt: `## Step 3 — Deployment Readiness

Ensure the agent can be delivered to its selected deployment apps.

This step only applies IF the maker has selected one or more endpoint apps. If no endpoint app is selected, skip this step entirely — do not block or warn.

### 3A. For each selected deployment app, verify:
- **Publish path known** — the product knows how this app is handled.
- **Direct target readiness** — for apps with direct deployment support, no known blocking issue exists.
- **Post-publish setup path** — for apps that require later setup, publishing can proceed and next steps are clear.

### 3B. Post-publish setup apps
Some deployment apps require additional setup after publishing. If the maker has selected any of these, allow publishing but clearly list the required post-publish steps.

**Apps that are fully configurable before publish (no post-publish setup):**
${prePublishList}

**Apps that require post-publish setup:**
${postPublishList}

### Blocking issues
- The selected app has no defined deployment path.
- A known blocking issue prevents deployment to a directly supported app.

### Warn only (do not block)
- (None currently defined)

### Informational (no block, no warning)
- No endpoint app is selected — this is acceptable, skip the step.
- A post-publish setup app is selected — allow publish, then provide next steps.

### How to communicate
- If no endpoint app is selected: report "No endpoint app selected — skipping deployment check."
- If all selected apps pass: report "Deployment path is ready" and list the configured apps.
- If post-publish apps are selected: after confirming readiness, add a "Next steps after publishing" section listing what each post-publish app needs.
- If blocking issues exist: list each issue with the app name and what's needed.`,
};
