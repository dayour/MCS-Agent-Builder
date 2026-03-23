<!-- CACHE METADATA
last_verified: 2026-03-23
sources: [MS Learn (publication-fundamentals-publish-channels, guidance/channels, publication-add-bot-to-sharepoint, planned-features, whats-new, 2026wave1 release plan), MCS UI snapshot, WebSearch Mar 2026, M365 Copilot Blog Feb 2026, Dynamics 365 Blog Mar 2026]
confidence: high
refresh_trigger: weekly
-->
# MCS Deployment Channels

## Available Channels

### Native Copilot Studio Channels (built-in, no relay bot)

| Channel | Status | Setup Complexity | Notes |
|---------|--------|-----------------|-------|
| Microsoft Teams + M365 Copilot | GA | Low | Default for M365 orgs; auto-publish. Auto-auth via Entra ID. |
| SharePoint | GA | Low | Deploy to SharePoint site via Channels config. Requires WRITE access to SP site. |
| **Power Pages** | GA | Low | Embed in Power Pages sites |
| Demo Website | GA | None | Built-in test/demo page. Not for production. |
| Custom Website (iframe) | GA | Low | Embed via iframe code snippet |
| Custom canvas (Web SDK) | GA | Medium | Full UI customization with Bot Framework Web Chat (React Web Chat, WebChat JS) |
| Mobile app (Client SDK) | GA | Medium | Via Client SDK (Sep 2025) for Android, iOS, Windows -- provides rich multimodal conversations in native apps |
| **Outlook (via M365 Copilot)** | **GA** (Mar 2026) | Low | Access agents built with Copilot Studio directly within Outlook. Extends agent capabilities to email workflows without switching apps. Requires M365 Copilot. |
| **WhatsApp** | **GA** (Sep 2025) | Medium | Uses Azure Communication Services |
| Facebook Messenger | GA | Medium | Requires Facebook page + app |
| Direct Line | GA | Low | REST API for custom integrations and testing. Supports HTTP GET + WebSocket. |
| Telephony (voice) | GA | High | Azure Communication Services integration. Answering machine detection + proactive engagement GA (Jan 2026). SIP X-headers GA (Feb 2026). |

### Azure Bot Service Channels (require relay bot)

These channels require creating an Azure Bot Service relay bot that bridges between the external channel and the Copilot Studio agent via Direct Line.

| Channel | Status | Setup Complexity | Notes |
|---------|--------|-----------------|-------|
| Slack | GA | Medium | Requires Slack app configuration |
| Telegram | GA | Medium | Azure Bot Service channel |
| Twilio (SMS) | GA | Medium | Azure Bot Service channel |
| Line | GA | Medium | Azure Bot Service channel |
| Kik | GA | Medium | Azure Bot Service channel |
| GroupMe | GA | Medium | Azure Bot Service channel |
| Direct Line Speech | GA | High | Voice integration |
| Email | GA | Medium | Azure Bot Service channel |
| Cortana | **Deprecated** | -- | Legacy channel, do not use |

## WhatsApp Channel Details

| Feature | Support |
|---------|---------|
| Status | **GA (Sep 2025)** |
| Provider | Azure Communication Services |
| Adaptive Cards | **Very limited** — only `Action.Submit` (max 3), `Input.ChoiceSet`, `Action.OpenUrl` |
| Rich media | Images, documents supported |
| Auth | No SSO — manual auth if needed |

## Channel Selection

| Audience | Recommended Channel | Why |
|----------|-------------------|-----|
| Internal employees (M365) | Teams + M365 Copilot | Zero friction, SSO, already installed |
| Internal employees (email-centric) | Outlook (via M365 Copilot) | Access agents without leaving email workflows |
| Internal employees (SharePoint) | SharePoint | Embedded in intranet, contextual |
| Internal employees (Power Pages) | Power Pages | Custom portal with full control |
| External customers (web) | Custom website or canvas | Branded experience, no login required |
| External customers (mobile) | Mobile app or custom canvas | Responsive, native feel |
| External customers (WhatsApp) | WhatsApp | Familiar messaging platform, GA |
| Voice/phone support | Telephony | Azure Communication Services |
| Testing / automation | Direct Line | API-based, scriptable |

## Channel Experience Reference

| Experience | Website | Teams + M365 Copilot | Facebook | Dynamics Omnichannel |
|-----------|---------|----------------------|----------|---------------------|
| Customer satisfaction survey | Adaptive card | Text-only | Text-only | Text-only |
| Multiple-choice options | Supported | Up to 6 (hero card) | Up to 13 (quick replies) | Partially supported |
| Markdown | Supported | Partially supported | Partially supported | Partially supported |
| Welcome message | Supported | Supported | Not supported | Chat only |
| Did-You-Mean | Supported | Supported | Supported | Supported (limited channels) |

**Key limitation:** Users cannot send or upload general attachments in any channel. The agent replies with an error message. Attachments can be supported only if the message is sent to a Bot Framework skill. **However**, since Aug 2025, agents can accept user-uploaded files and images for analysis when the agent is configured to use file/image input analysis -- this is a structured upload, not a general attachment pass-through.

## Teams Deployment

- Publish the agent -> auto-available in Teams app catalog
- Admin can pin the agent to Teams sidebar for all users
- SSO with Entra ID (automatic for "Authenticate with Microsoft" setting)
- New conversation starts after 30 minutes of inactivity; type "start over" to force refresh
- Max 6 suggested actions per question node in Teams
- Customer satisfaction survey is text-only in Teams (not adaptive card)

## SharePoint Deployment

- Deploy via Channels > SharePoint tile
- Requires WRITE access to the target SharePoint site
- Test via both MCS test chat and Copilot chat in SharePoint before production
- Can undeploy from the SharePoint channel config panel

## Web Channel

- MCS provides iframe embed code in Settings > Channels > Custom website
- Direct Line token used for custom integrations and testing
- Web channel security settings control access
- "No authentication" allows anyone with link to chat -- use with caution
- "Authenticate manually" for channels that need auth beyond Teams/M365

## Authentication Implications by Channel

| Auth Setting | Teams/M365 Copilot/Power Apps | Other Channels |
|-------------|-------------------------------|----------------|
| Authenticate with Microsoft | Auto SSO, no setup | N/A -- use Authenticate manually |
| Authenticate manually | Manual Entra ID setup | Supports custom OAuth |
| No authentication | Anyone can chat | Anyone can chat; **cannot use tools with user credentials** |

## Voice/IVR Enhancements (2025 wave 2)

| Feature | Status | Details |
|---------|--------|---------|
| **Answering machine detection + proactive engagement** | **GA** (Jan 31, 2026) | Detect answering machines and use proactive engagement tools for voice agents |
| **SIP X-headers for voice-enabled agents** | **GA** (Feb 2026) | Configure SIP X-headers for voice-enabled agents. Preview since Nov 2025. |

## Refresh Notes

- Check MCS Settings > Channels for new channel options
- Search "Copilot Studio channels" on MS Learn for updates
- WhatsApp is GA -- adaptive card support is limited (only Action.Submit max 3, Input.ChoiceSet, Action.OpenUrl)
- Azure Bot Service channels provide broad reach but require relay bot development
- Power Pages is now a native channel (no relay bot needed)
- Cortana is deprecated -- do not recommend
- **Outlook (via M365 Copilot)** rolling out Mar 2026 -- agents accessible directly in Outlook for email workflows
- **Client SDK (Sep 2025)** -- replaces "Mobile app via Bot Framework SDK" with richer Android/iOS/Windows native SDK for multimodal conversations
- **Redesigned Channels page** (Jun 2025) -- improved UX for channel management in MCS
- **File/image upload in chat** (Aug 2025) -- users can upload files and images for agent analysis (separate from attachment limitation below)
- Attachments: Users cannot send/upload *general* attachments in any channel. Agent replies with error. Only supported if message is sent to a Bot Framework skill. However, the Aug 2025 file/image upload feature allows structured uploads for agent analysis.
- Voice/IVR features (answering machine detection, SIP X-headers) GA since Jan-Feb 2026. "Simplify working with triggers and channels" GA since Nov 2025.
- **Mar 2026 check:** Outlook added as new channel surface via M365 Copilot. No other new channel types added. Channel list otherwise stable. 2026 Wave 1 release plan does not announce additional channels for Apr-Sep 2026.
