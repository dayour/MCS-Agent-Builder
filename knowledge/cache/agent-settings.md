# MCS Agent Settings Inventory

> Comprehensive inventory of all configurable settings in Microsoft Copilot Studio.
> Consulted during research Phase B (component selection) and build (agent configuration).
> **last_verified: 2026-04-15**

---

## 1. Orchestration

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Orchestration mode** | Settings > Generative AI | Generative / Classic | Generative | Always Generative for new agents. Classic blocks MCP, proactive knowledge, multi-intent. | GA |
| **Primary AI model** | Agent Overview > model dropdown | GPT-4.1, GPT-5 Chat, GPT-5 Reasoning, GPT-5 Auto, GPT-5.3 Chat (Exp), GPT-5.4 Reasoning (Exp), Claude Sonnet 4.5/4.6, Claude Opus 4.6, Grok 4.1 Fast (Exp) | GPT-4.1 | GPT-5 Auto for mixed. Claude Opus 4.6 for deep reasoning. GPT-4.1 for simple FAQ. | Mixed |
| **Language Understanding (Classic only)** | Settings > Language understanding | Default NLU / NLU+ (Azure CLU) | Default | NLU+ only for classic D365 with custom entity training. | GA |
| **Topic routing** | Implicit (generative mode) | Driven by topic/tool descriptions + instructions | Description-based | Invest in descriptions before instructions. Use negative routing ("Do NOT use for X"). | GA |

### Orchestration decision table

| Agent type | Model | Orchestration | Why |
|-----------|-------|---------------|-----|
| Simple FAQ/knowledge | GPT-4.1 | Generative | Low cost, sufficient quality |
| Multi-tool with MCP | GPT-5 Chat or Claude Sonnet 4.6 | Generative | Better tool selection, slot filling |
| Complex reasoning (analysis, policy, troubleshooting) | GPT-5 Auto or Claude Opus 4.6 | Generative + Deep Reasoning ON | Auto-selects reasoning model when needed |
| Voice IVR (Basic) | GPT-4.1 or GPT-5 Chat | Generative | Structured flow, cost efficiency |
| Voice conversational (Realtime) | GPT-5 Chat | Generative | Natural conversation quality |

---

## 2. Generative AI

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Content moderation (agent-level)** | Settings > Generative AI > Content moderation | Lowest / Low / Moderate / High / Highest | High | High for customer-facing. Moderate for internal document processing. | GA |
| **Content moderation (topic-level)** | Generative answers node > Properties | Same 5 levels | Inherits agent | Override per topic only when specific nodes need different filtering. | GA |
| **Content moderation (prompt-level)** | Prompt Builder > Completion > Content moderation | Per-category (hate, sexual, violence, self-harm) Low/High | Moderate | Fine-grained per-category for regulated scenarios. | GA (Feb 2026) |
| **Allow ungrounded responses** | Settings > Generative AI > Knowledge | On / Off | On | OFF for strict compliance (grounded-only). Warning: OFF also suppresses follow-up questions. | GA |
| **Web search (Bing grounding)** | Settings > Generative AI > Knowledge | On / Off | Off | ON for agents needing current/public info. OFF for internal-only. | GA |
| **Tenant graph grounding** | Settings > Generative AI > Search | On / Off | Off (On if M365 Copilot license) | Enable for internal agents with M365 Copilot license. Searches ALL M365 data. | GA |
| **Deep reasoning** | Settings > Generative AI > Deep reasoning | On / Off | Off | Enable for complex analysis, policy comparison, multi-system troubleshooting. Uses o3 model. US + EU only. | Preview |
| **Custom instructions** | Agent Overview > Instructions | Free text, up to 8,000 chars | Empty | Target 1,200-2,500 chars. Three-part: Constraints + Format + Guidance. No hardcoded URLs. | GA |
| **Prompt Builder model** | Prompt Builder > Model dropdown | GPT-4.1 mini (default), GPT-4.1, GPT-5 Chat, GPT-5 Reasoning, Claude Sonnet/Opus (Exp) | GPT-4.1 mini | Mini for cost-effective. Upgrade per-prompt for complex reasoning tasks. | GA |
| **BYOM response generation** | Settings > Generative AI > Response model | Default / Azure AI Foundry deployment | Default | Only for fine-tuned models. US only. | Preview (Mar 2026) |

### Settings NOT exposed
- Temperature / top-p / frequency penalty — controlled internally, not configurable
- Session memory / long-term memory — limited to last 10 turns, not configurable
- Rate limiting / RPM — license tier dependent, admin-level only

---

## 3. File, Media & Code

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **File uploads** | Settings > Generative AI > File processing | On / Off | Off | Enable for document/image analysis agents. Supports Word, Excel, PPT, PDF, CSV, TXT, images. | GA (Aug 2025) |
| **Code Interpreter** | Settings > Generative AI > File processing | On / Off | Off | Enable for data analysis. Requires file uploads ON (for user files) or tenant graph grounding (for SharePoint). Python sandbox. ~30% cheaper than LLM reasoning. | GA (Nov 2025), SP Preview (Mar 2026) |
| **Code Interpreter in Prompt Builder** | Prompt Builder > Settings | On / Off | Off | Enable per-prompt for data processing within agent workflows. | GA (Aug 2025) |
| **Image generation** | N/A (no native toggle) | Custom action + DALL-E via Foundry | N/A | Build custom action if needed. Not native MCS. | N/A |

### Code Interpreter gotchas
- Output images do NOT render in Teams or M365 Copilot (official limitation)
- Charts render in test chat and web channel only
- SharePoint file analysis requires tenant graph grounding enabled
- Maximum file size for user uploads: varies by type

---

## 4. Work IQ / Agent 365

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Add Work IQ (overview page)** | Agent Overview > "Add Work IQ" | Adds Copilot + User MCP servers | Not added | For read-only M365 search. Uses dedicated connectors. | Preview |
| **Work IQ MCP servers (individual)** | Tools > Add > MCP > Work IQ | Copilot, Calendar, Mail, SharePoint, OneDrive, Teams, User, Word, Dataverse/D365 | None | Individual servers for read+write. Copilot is search-only. | Preview |
| **Work IQ consent** | M365 admin center + per-tool approval | Admin enables, user approves per call | Admin must enable | Ensure M365 admin has enabled for tenant. OBO delegated permissions. | Preview |

### Work IQ decision table

| Need | Use | Why |
|------|-----|-----|
| Read M365 signals (what did I do today?) | Work IQ Copilot MCP | Cross-M365 unified search |
| People/org lookup | Work IQ User MCP | 6 tools for people, org chart, reports |
| Send email / create event / post Teams | Individual Work IQ servers (Mail, Calendar, Teams) | Copilot is read-only |
| Deep document content indexing | MCS Knowledge Source (SharePoint) | Better than Work IQ for grounded search over document content |
| User profile data for grounding | Entra as Knowledge Source or Work IQ User | Depends on whether you need indexed correlation or live lookup |

---

## 5. Voice

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Enable voice** | Settings > Voice | On / Off | Off | Only for phone/IVR agents. M365 Copilot/Teams voice dictation is OOB (no config needed). | GA |
| **Voice type** | Settings > Voice (at enable) | Basic / Realtime | N/A | **IRREVERSIBLE.** Basic for structured IVR. Realtime for natural conversation. | Basic=GA, Realtime=Preview |
| **Voice persona (Realtime)** | Settings > Voice > Select voice | 10 voices: Alloy, Ash, Ballad, Coral, Echo, Sage, Shimmer, Verse, Marin, Cedar | N/A | Alloy/Echo/Shimmer/Ash for D365 compatibility. | Preview |
| **Speech sensitivity / VAD** | Settings > Voice > Phone Setup | Server-based (silence) / Semantic (sentence context) | N/A | Server for structured IVR. Semantic for open conversation. | Preview |
| **Barge-in** | Per-node: Message/Question > Properties | Allow / Disable | Allowed | Disable for compliance messages. Allow for repeat callers. | GA |
| **DTMF** | Per-node + Global: Settings > Voice > DTMF | Per-node key mapping + global timing | Varies | Enable for phone menus. Use # terminator for multi-digit. | GA |
| **Silence detection** | Settings > Voice + per-topic trigger | On/Off + timeout (default 7000ms) | Off | Always enable for voice. Test 7s default. Configure reprompt. | GA |
| **SSML** | Per-node: Message text with SSML tags | Pitch, rate, volume, pauses, emphasis | Plain text | Use for critical tone messages (empathy, urgency). | GA |
| **Latency messaging (Realtime)** | Settings > Voice > Latency messaging | Message/audio during backend processing | None | Configure for agents with slow tool calls (>2-3s). | Preview |

### Voice architecture decision
- M365 Copilot / Teams voice dictation = **zero config** (platform handles STT/TTS)
- MCS Voice channel (telephony) = requires D365 Contact Center + ACS + voice type selection
- Most agents do NOT need MCS voice settings — voice dictation is handled by the M365 platform layer

---

## 6. Languages

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Primary language** | Set at creation (immutable) | Any supported language | en-US | Choose carefully. Cannot change after creation. | GA |
| **Primary language region** | Settings > Languages > Edit | Region variants (en-US, en-GB, en-AU, etc.) | Creation choice | Match to primary audience locale. Republish for voice after change. | GA |
| **Secondary languages** | Settings > Languages > Add | Any supported language | None | Add all expected user languages. Generative content auto-translates. Authored messages need localization files. | GA |
| **Language switching** | Via User.Language variable or auto-detection | Auto-detect from browser/client or explicit set | Auto-detect | Enable for multilingual environments. Switch after Question nodes for consistency. | GA |
| **Localization files** | Settings > Languages > Upload | JSON or ResX per secondary language | Primary strings | Maintain with every content change. Download, translate, re-upload. | GA |
| **Realtime voice validated languages** | N/A (quality certification) | en-US, es-US, Arabic, pt-BR, it-IT, de-DE, nl-NL, fr-CA (Apr 2026) | en-US | Non-validated languages work but aren't certified. Extensive testing required. | Preview |

---

## 7. Channels

| Channel | Status | Auth | Key limitation |
|---------|--------|------|---------------|
| **Teams + M365 Copilot** | GA | SSO with "Authenticate with Microsoft" | ConversationStart runs ONCE per install (Teams). NOT used in M365 Copilot. |
| **Outlook** (via M365 Copilot) | GA (Mar 2026) | Same as M365 Copilot | Requires M365 Copilot publish |
| **SharePoint** | GA | Inherits site auth | Requires WRITE access to target site |
| **Power Pages** | GA | Configurable | For customer-facing portals |
| **Custom Website (iframe)** | GA | Token-based | Always use token exchange for production (not raw secrets) |
| **Web SDK (React)** | GA | Custom | Full UI customization with Bot Framework Web Chat |
| **Mobile SDK** | GA (Sep 2025) | Custom | Android / iOS / Windows native |
| **WhatsApp** | GA (Sep 2025) | ACS config | Limited adaptive cards (max 3 Action.Submit) |
| **Facebook Messenger** | GA | FB app config | Requires FB page and app |
| **Telephony** | GA | ACS + D365 CC | Requires D365 Contact Center license |
| **Direct Line** | GA | API secrets | For testing automation and custom integrations |
| **Demo website** | GA | None | Testing only, NOT for production |
| **Azure Bot Service relay** (Slack, Telegram, Twilio SMS, etc.) | GA | Per-channel | Requires custom relay bot |

### Channel configuration settings

| Setting | Location | Impact |
|---------|----------|--------|
| **Suggested prompts** | Agent Overview > Suggested prompts | Up to 10. Shown on Teams/M365 welcome page. Not visible in test pane. |
| **ConversationStart topic** | Topics > System > Conversation Start | On/Off. Runs ONCE in Teams (per install). Does NOT fire in M365 Copilot. |
| **Web channel security** | Settings > Channels > Security | 2 secrets. Always use token exchange for production. Propagation takes up to 2 hours. |

---

## 8. Security & Governance

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Authentication mode** | Settings > Security > Auth | No auth / Microsoft (SSO) / Manual (OAuth2) | Microsoft | "Microsoft" for internal. "Manual" for multi-channel Entra. Never "No auth" for sensitive data. | GA |
| **Manual auth providers** | Settings > Security > Auth > Manual | Entra ID V2 (federated/cert/secret), Entra V1, Generic OAuth2 | N/A | Federated credentials (no secret expiration). Generic OAuth2 for non-MS IdPs. | GA |
| **Require sign-in** | Settings > Security > Auth toggle | On / Off | On | ON for sensitive data agents. | GA |
| **Agent sharing** | Agent Overview > Share | Users / Groups / Org | Not shared | Share with security groups, not "Everyone." | GA |
| **DLP policies** | PPAC | 9+ connector controls | No restrictions | Configure for production environments. | GA |
| **External threat detection** | PPAC > Security | Connect external providers | Disabled | Enable for high-security regulated agents. | Preview |
| **IP firewall** | PPAC > Environment | IP ranges (Managed Envs only) | Disabled | Does NOT enforce on Teams, M365 Copilot, Facebook, Omnichannel. | GA |
| **Sensitivity labels (Purview)** | Automatic if Purview configured | Display highest-priority label | If configured | Ensure Purview configured for sensitive knowledge sources. | Preview (Jul 2025) |
| **Data movement across regions** | PPAC > Environment | On / Off | Off | Required for generative AI in regions needing cross-geo processing. | GA |
| **Preview/experimental models** | PPAC > Environment > Features | On / Off | Off | ON for dev/test. Evaluate for prod. | GA |
| **External models (Anthropic, xAI)** | PPAC + M365 admin (two-step) | On / Off per environment + provider | Off | Two admin actions required. Claude/Grok only appear after both. | GA |

### Pre-publish security scan (automatic)
MCS warns on: No auth, maker credentials, shared with everyone. Review all warnings before publishing.

---

## 9. Agent Behavior

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **Fallback topic** | Topics > System > Fallback | Customizable | Generic "I can't help" | Always customize with agent-specific message + escalation path. | GA |
| **Escalate topic** | Topics > System > Escalate | Customizable | Generic escalation | Configure with real escalation (phone, email, live agent). | GA |
| **Reset Conversation** | Topics > System | On/Off + customizable | On | Add "Clear variable values" for conversation history if full reset needed. | GA |
| **Inactivity trigger** | Custom topic trigger | Configurable timeout | Not configured | Configure for Teams (e.g., 15 min) with cleanup. | GA |
| **Session limits** | System-level | 30 min inactivity / 60 min max / 100 turns | Fixed | Design for these limits. Store state in Dataverse for long workflows. | GA |
| **Conversation history** | Implicit | Last 10 turns in planner context | N/A | Store key info in variables, don't rely on history. | GA |
| **End all topics** | Node in topic authoring | Cancels remaining planned steps | N/A | Use when topic should terminate the plan (escalation, hard stop). | GA |

---

## 10. Tools & Actions

| Setting | Location | Options | Default | Recommendation | Status |
|---------|----------|---------|---------|---------------|--------|
| **MCP server** | Tools > Add > MCP | Built-in catalog + custom URL | None | Prefer MCP over individual connectors. | GA (built-in), Preview (Work IQ, custom) |
| **Power Automate flows** | Tools > Add > Flow | Available agent flows | None | Use for complex multi-step integrations. Clear descriptions. | GA |
| **Connector actions** | Tools > Add > Connector | 1400+ connectors | None | Use when no MCP exists. Standard > premium when equivalent. | GA |
| **HTTP request** | Topic > HTTP node | GET/POST/PUT/PATCH/DELETE | N/A | For custom APIs without connectors. Subject to DLP. | GA |
| **Tool groups** | Tools > Add tool group | Curated sets (Outlook, SharePoint) | N/A | One-step setup of related tools. Reduces errors. | Preview (Nov 2025) |
| **Tool auth** | Per-tool | Maker credentials / End-user credentials | End-user | Always prefer end-user. Security scan warns on maker credentials. | GA |

---

## 11. Publishing & ALM

| Setting | Location | Impact |
|---------|----------|--------|
| **Publish** | Top bar > Publish | Changes are draft until published. Auth changes only take effect after publish. |
| **Environment** | Agent creation | Cannot move between envs (export/import). Use dedicated envs for dev/test/prod. |
| **Solution-aware** | Solutions page | Every agent auto-saved. Custom solutions for ALM. Managed = no customize in target. |
| **Preferred solution** | Solutions > Set preferred | New agents created in preferred solution. Set before creating agents. |
| **Export/Import** | Solutions | .zip managed/unmanaged. Re-configure auth + republish after import. |
| **Component collections** | Sidebar | Reusable sets of topics/knowledge/actions across agents. | GA (Nov 2025) |
| **Pipeline deployments** | PPAC Pipelines | Dev > Test > Prod automated pipelines. | GA |

---

## 12. New & Preview Features (2025-2026)

| Feature | Status | Date | Impact |
|---------|--------|------|--------|
| **Realtime voice agents** | Preview | 2025 | Audio-to-audio. Irreversible. US-hosted only. EU excluded. |
| **BYOM response generation** | Preview | Mar 2026 | Replace response model. US only. |
| **Triggers with end-user credentials** | Preview Apr, GA Jul 2026 | Apr 2026 | Event triggers run as user. |
| **Custom metrics for analytics** | Preview Apr, GA May 2026 | Apr 2026 | Custom performance metrics. |
| **SharePoint lists as knowledge** | Preview Apr, GA May 2026 | Apr 2026 | Real-time SP list data with ACL. |
| **MCP tools in Power Automate** | Preview Apr, GA Oct 2026 | Apr 2026 | MCP in agent flows. |
| **Computer Use GA** | GA | May 2026 | Web + desktop automation via vision. |
| **VS Code extension** | GA | Jan 2026 | Build/edit agents in VS Code. |
| **Agent evaluations** | GA | Mar 2026 | Customizable test sets, multi-turn, CSV import. |
| **Real-time connectors (knowledge)** | Preview | Feb 2026 | Live API to 14 external systems. No data replication. |
| **Entra agent identities** | Preview | Nov 2025 | Auto-create Entra identities per agent. |
| **Credential oversharing detection** | Preview Apr, GA Jun 2026 | Apr 2026 | Detect/prevent oversharing. |

---

## Settings Checklist (Pre-Build)

Configure these BEFORE building any agent:

1. **Authentication mode** — Microsoft SSO for internal, Manual for multi-channel
2. **Orchestration mode** — Always Generative
3. **Primary AI model** — Match to agent complexity
4. **Content moderation** — High for customer-facing, Moderate for internal
5. **Knowledge sources** — Configure all before topic authoring
6. **Deep reasoning** — Enable if agent needs complex analysis
7. **File uploads / Code Interpreter** — Enable if agent processes user files
8. **Work IQ** — Add if agent needs M365 signals
9. **Languages** — Set primary at creation (immutable), add secondaries
10. **Channels** — Configure target channels and test in each
11. **Suggested prompts** — 3-5 high-value prompts for Teams/M365
12. **Fallback/Escalate topics** — Always customize

---

## Quick Reference: What's New Since Jan 2026

| Month | Setting/Feature | Impact |
|-------|----------------|--------|
| Jan 2026 | Answering Machine Detection (voice) | GA. Auto-detect voicemail. |
| Jan 2026 | VS Code extension | GA. Developer workflow for agents. |
| Feb 2026 | SIP X-headers (voice) | GA. Custom metadata on calls. |
| Feb 2026 | Per-prompt content moderation | GA. Per-category control. |
| Feb 2026 | Real-time connectors (knowledge) | Preview. Live API queries. |
| Mar 2026 | Agent evaluations | GA. Test sets + CSV import. |
| Mar 2026 | BYOM response generation | Preview. US only. |
| Mar 2026 | Post-call action topics | GA. Actions after call end. |
| Apr 2026 | SharePoint lists as knowledge | Preview. Real-time with ACL. |
| Apr 2026 | MCP tools in Power Automate | Preview. MCP in agent flows. |
| Apr 2026 | Deep reasoning toggle | Preview. o3 model. US + EU. |
