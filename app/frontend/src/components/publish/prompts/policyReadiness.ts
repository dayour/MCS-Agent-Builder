/**
 * Step prompt: Policy Readiness
 *
 * Defines what the HA checks and how it communicates results
 * for organizational policy and compliance requirements.
 */

import type { StepPrompt } from './types';

export const policyReadinessPrompt: StepPrompt = {
  id: 'policy',
  label: 'Policy Readiness',
  order: 4,
  prompt: `## Step 4 — Policy Readiness

Ensure publishing does not violate organizational policies.

### 4A. Verify the following:
- **DLP policies** — no data loss prevention conflicts exist for the connectors and data sources the agent uses.
- **Restricted connectors** — no connectors currently in use are blocked or restricted by org policy.
- **Permissions** — the maker has the required permissions to publish in the target environment.
- **Admin approval** — determine whether admin approval is required.
  - If approval is NOT required: proceed normally.
  - If approval IS required: allow publishing, but the publish enters a **pending approval** state. Inform the maker that their agent will be published once an admin approves it.

### Blocking issues
- A DLP policy violation exists
- A restricted connector is in use and cannot be exempted
- The maker lacks the required permissions to publish

### Informational (no block, no warning)
- Admin approval is required — publishing proceeds into a pending state. Inform the maker clearly: "Your agent has been submitted for approval. An admin will review it before it goes live."

### How to communicate
- If all policies pass and no approval is needed: report "Policy requirements met."
- If all policies pass but approval is required: report "Policy requirements met. This agent requires admin approval — it will enter a pending state after publishing."
- If policy violations exist: stop and explain each violation clearly, including the policy name, what it restricts, and what the maker needs to do (e.g. contact an admin, remove a connector, request an exemption).`,
};
