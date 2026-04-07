<!-- CACHE METADATA
last_verified: 2026-04-07
sources: [MS Learn, MCS UI, PPAC docs, WebSearch Mar 2026, MS Security Blog Feb 2026, MS Learn guidance/sec-gov-phase3, MS Learn security-and-governance, MS Learn configuration-end-user-authentication, MS Learn admin-data-loss-prevention, MS Learn admin-dlp-troubleshooting, MS Learn copilot-control-system/management-controls, MS Learn security-scan, 2026 Wave 1 Release Plan, WebSearch Apr 2026, MS Learn whats-new Apr 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Security & Authentication — Quick Reference

## Three Auth Modes

| Mode | Channels | Variables Available | Access Control |
|------|----------|-------------------|----------------|
| No authentication | All | None | Anyone with link (cannot restrict) |
| Authenticate with Microsoft | Teams + M365 only | DisplayName, Email, FirstName, LastName, Id, IsLoggedIn, PrincipalName | Share with groups/org |
| Authenticate manually | All channels | All above + **AccessToken** | Share with groups/org (Entra ID); cannot restrict (Generic OAuth) |

**Manual auth providers**: Entra ID V2 with federated credentials (recommended), Entra ID V2 with certificates, Entra ID V2 with client secrets, Entra ID (v1), Generic OAuth 2

## SSO Channel Support

| Channel | SSO | Channel | SSO |
|---------|-----|---------|-----|
| Custom Website | Yes | Teams | Yes (1:1 only, NOT group/meeting) |
| SharePoint | Yes | Omnichannel | Yes |
| Demo Website | No | Facebook/Mobile | No |

## Required Scopes

- **Base**: `profile openid`
- **SharePoint knowledge**: `Sites.Read.All Files.Read.All`
- **Graph Connector**: `ExternalItem.Read.All`
- **Dataverse**: `https://[OrgURL]/user_impersonation`

## DLP Connector Names (PPAC)

| Connector | Controls |
|-----------|----------|
| Chat without Microsoft Entra ID authentication | Require auth |
| Knowledge source with SharePoint and OneDrive | Block SharePoint knowledge |
| Knowledge source with public websites and data | Block web knowledge |
| Knowledge source with documents | Block file knowledge |
| HTTP | Block HTTP (endpoint filtering supported) |
| Microsoft Teams + M365 Channel | Block Teams |
| Direct Line channels / Facebook / SharePoint / Omnichannel / WhatsApp | Block channels |
| Microsoft Copilot Studio | Block event triggers / evals |
| Application Insights | Block telemetry |

## Content Moderation (5 Levels)

| Level | Default For | Risk |
|-------|-------------|------|
| Lowest | — | Highest (may allow severe harm) |
| Low | — | High |
| Moderate | Prompt actions | Medium |
| **High** | **Agents (default)** | Low |
| Highest | — | Lowest (fewest answers) |

**Dual-pass**: checks user input AND agent output. Protections: jailbreak, prompt injection, XPIA, copyright.

## Threat Protection & External Security (Feb 2026)

| Feature | Status | Details |
|---------|--------|---------|
| **Strengthen security with additional threat protection** | **GA (Feb 2026)** | Enhanced threat detection and prevention for agent conversations, including advanced prompt injection detection and content safety filters |
| **External threat detection ("bring your own protection")** | **Preview** | Organizations can connect external security providers (custom, Microsoft Defender, or third-party) via REST API. Runtime evaluation before every tool invocation. Configurable in PPAC > Security > Threat detection. Only applies to generative orchestration agents (skipped for classic). |
| **Microsoft Defender AI Security Posture Management** | **GA (Feb 2026)** | Risk-based inventory of AI agents across Foundry and Copilot Studio. SOC teams can view agent security posture and implement security recommendations. |
| **Microsoft Entra agent identities** | **Preview (Nov 2025)** | Automatically create Entra identities for agents. Helps admins secure and manage agents with identity management per agent. |

## Web Channel Security

- Direct Line: 2 secrets (rotate without downtime), generate short-lived tokens
- Token: `POST directline.botframework.com/v3/directline/tokens/generate` with `Bearer <SECRET>`
- Propagation: up to **2 hours** after enabling, no publish needed

## PPAC Controls Summary

**Tenant**: Disable GenAI publishing, author security groups, tenant isolation, self-service trials
**Environment**: Security groups, DLP policies, IP firewall (GA, Managed Envs only), VNET, Global Secure Access, maker credentials, CMK, data movement
**Agent**: Auth mode, web security, moderation, agent connections, sharing

## Automatic Security Scan (Pre-Publish)

MCS automatically warns makers before publishing when secure defaults are changed:
1. **No authentication** selected (default is "Authenticate with Microsoft")
2. **Maker-provided credentials** selected for connectors/flows (default is end-user credentials)
3. **Agent shared with everyone** in the org (default is shared with no one)

## Microsoft Purview Integration

- **Sensitivity labels**: Supported for SharePoint knowledge source. Agent displays highest-priority label from data used in response.
- **DLP for SharePoint knowledge**: Purview DLP policy scoped to M365 Copilot location can restrict agents for Teams, SharePoint, and M365 Copilot channels from processing sensitive content based on sensitivity label.
- **Endpoint DLP**: Warn/block users from pasting sensitive info into third-party GenAI sites via browser.
- **Insider Risk Management**: Supported for AI interactions.

## Top 10 Agent Security Risks (MS Security Blog, Feb 2026)

Microsoft published a comprehensive guide on common agent misconfigurations. Key risks include:
1. Unauthenticated agents accessible to anyone with the link
2. Maker-provided credentials enabling privilege escalation
3. Oversharing agents with the entire organization
4. Missing DLP policies allowing unrestricted connector usage
5. Sensitive data exposure through knowledge sources without sensitivity labels
See: https://www.microsoft.com/en-us/security/blog/2026/02/12/copilot-studio-agent-security-top-10-risks-detect-prevent/

## Upcoming & Recent Security Features (2026 Wave 1)

| Feature | Status | Timeline | Details |
|---------|--------|----------|---------|
| **Configure triggers with end-user credentials** | **Preview** | Preview Apr 2026, GA Jun 2026 | Triggers authenticate as end user instead of maker. Native trigger management lifecycle in Copilot Studio. **(Updated: Preview shifted to Apr 2026 from original Mar 2026; GA shifted to Jun 2026.)** |
| **Enforce safe sharing by detecting credential oversharing** | Preview | Apr 2026 | Detects when agent makers share agents with overly broad credentials; GA Jun 2026 |
| **Unified errors, warnings, governance notifications** | Preview | Apr 2026 | Single view of all security/governance issues; GA Jun 2026 |
| **Strengthen security with additional threat protection** | Preview (Sep 2025) | **GA Jun 2026** | Enhanced threat detection including advanced prompt injection detection. **(Updated: GA moved to Jun 2026 per 2026 Wave 1.)** |
| **Copilot Control System agent lifecycle** | GA | Current | Visibility into agent status, governance, lifecycle. Manage connectors, sharing, DLP, approval workflows from M365 admin center. |
| **MIP sensitivity labels across channels** | Preview | Jul 2025 | Display labels in connectors, test chat, Teams, M365 Copilot to prevent oversharing |
| **Admin sharing controls** | GA | Current | Restrict org-wide sharing, reassign ownership, control who can share with whom (Managed Environments) |

## Key Gotchas

- **"Require users to sign in"** creates read-only system topic; cannot be customized
- **Federated credentials** (recommended) — no secret expiration management
- **IP firewall does NOT enforce on**: Teams, M365 Copilot, Facebook, Omnichannel
- **Connected agent types**: MCS agents (GA), Foundry/Fabric/SDK/A2A (preview)
- **Conversation history** can be passed or blocked per connected agent
- **Audit**: Purview (maker logs), Sentinel (runtime monitoring), App Insights (KQL)
- **Never expose `User.AccessToken`** in Message nodes
- **Configure triggers with end-user credentials** (Preview Mar 2026, GA May 2026) — triggers can authenticate as end user
- **DLP enforcement**: As of early 2025, DLP enforcement is in effect for ALL tenants (no more exemptions per MC973179)
- **Multitenant agents (preview)**: Agents can be used across tenants via Teams/M365 Copilot. SharePoint knowledge does NOT work cross-tenant.
- **SSO Consent Card (preview, Jul 2025)**: Streamlines Entra ID-backed auth — users grant consent in chat without redirects
- **Admins can reassign agent ownership** with full permissions transfer and restrict org-wide agent sharing
- **New `copilotstudio` API namespace** (Nov 2025) — previous namespace works temporarily, switch now for future compatibility
- **Computer use audit logging** (Preview Jan 2026) — enhanced audit logging with session replay for CUA agents
- **Copilot Control System** (GA) — centralized admin controls for agent lifecycle: manage connectors (enable/block/delegate), limit agent sharing (Editor/Viewer roles, block/limit at managed env level), DLP policies to block publishing channels, define lifecycle approval workflows for production agents
- **Configure triggers with end-user credentials** (Preview Mar 2026) — triggers now a fully native capability in Copilot Studio; makers can create/configure/test/update/delete triggers directly. Agents can run autonomously with end-user credentials via event triggers.
- **Kit Compliance Hub** (GA Mar 2026) — defines/enforces governance policies at scale, auto-creates compliance cases when agent configs violate risk thresholds, SLA-driven review lifecycle. Tracks through Teams/Outlook notifications.
