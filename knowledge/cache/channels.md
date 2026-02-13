<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MS Learn, MCS UI snapshot]
confidence: high
refresh_trigger: weekly
-->
# MCS Deployment Channels

## Available Channels

| Channel | Status | Setup Complexity | Notes |
|---------|--------|-----------------|-------|
| Microsoft Teams | GA | Low | Default for M365 orgs; auto-publish |
| Custom website (iframe) | GA | Low | Embed via iframe code snippet |
| Custom canvas (Web SDK) | GA | Medium | Full UI customization with Bot Framework Web Chat |
| Mobile app | GA | Medium | Via Bot Framework SDK integration |
| Facebook Messenger | GA | Medium | Requires Facebook page + app |
| Slack | GA | Medium | Requires Slack app configuration |
| Telephony (voice) | GA | High | Azure Communication Services integration |
| Direct Line | GA | Low | REST API for custom integrations and testing |

## Channel Selection

| Audience | Recommended Channel | Why |
|----------|-------------------|-----|
| Internal employees (M365) | Teams | Zero friction, SSO, already installed |
| External customers (web) | Custom website or canvas | Branded experience, no login required |
| External customers (mobile) | Mobile app or custom canvas | Responsive, native feel |
| Voice/phone support | Telephony | Azure Communication Services |
| Testing / automation | Direct Line | API-based, scriptable |

## Teams Deployment

- Publish the agent → auto-available in Teams app catalog
- Admin can pin the agent to Teams sidebar for all users
- SSO with Azure AD — no separate login

## Web Channel

- MCS provides iframe embed code in Settings → Channels → Custom website
- Direct Line token used for custom integrations and testing
- Web channel security settings control access

## Refresh Notes

- Check MCS Settings → Channels for new channel options
- Search "Copilot Studio channels" on MS Learn for updates
- New channels (e.g., WhatsApp, SMS) may appear in preview
