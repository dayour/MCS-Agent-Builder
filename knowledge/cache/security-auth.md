<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn, MCS UI, PPAC docs, WebSearch Feb 2026, MS Security Blog Feb 2026, MS Learn guidance/sec-gov-phase3]
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

## Key Gotchas

- **"Require users to sign in"** creates read-only system topic; cannot be customized
- **Federated credentials** (recommended) — no secret expiration management
- **IP firewall does NOT enforce on**: Teams, M365 Copilot, Facebook, Omnichannel
- **Connected agent types**: MCS agents (GA), Foundry/Fabric/SDK/A2A (preview)
- **Conversation history** can be passed or blocked per connected agent
- **Audit**: Purview (maker logs), Sentinel (runtime monitoring), App Insights (KQL)
- **Never expose `User.AccessToken`** in Message nodes
- **Configure triggers with end-user credentials** (GA Feb 2026) — triggers can authenticate as end user
- **DLP enforcement**: As of early 2025, DLP enforcement is in effect for ALL tenants (no more exemptions per MC973179)
- **Multitenant agents (preview)**: Agents can be used across tenants via Teams/M365 Copilot. SharePoint knowledge does NOT work cross-tenant.
- **SSO Consent Card (preview, Jul 2025)**: Streamlines Entra ID-backed auth — users grant consent in chat without redirects
