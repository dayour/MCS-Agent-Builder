<!-- CACHE METADATA
last_verified: 2026-04-07
sources: [MS Learn quotas page, MS Learn billing-licensing, MS Learn requirements-quotas, pricing page, licensing docs, WebSearch Mar 2026, Feb 2026 Licensing Guide, Mar 2026 Licensing Guide, Apr 2026 Licensing Guide, 2026 Wave 1 release plan, MS Learn ai-builder/endofaibcredits, MS Learn ai-builder/administer-licensing, samexpert.com licensing guide, WebSearch Apr 2026]
confidence: high
refresh_trigger: weekly
-->
# MCS Limits, Quotas & Licensing

## Session Limits

| Metric | Limit |
|--------|-------|
| Session timeout (inactivity) | **30 minutes** |
| Maximum session duration | **60 minutes** |
| Maximum turns per session | **100** (101st starts new session) |
| Teams plan: sessions per user | **10 sessions/user/24 hours** across all agents |

## Agent Component Limits

| Feature | Limit |
|---------|-------|
| Instructions | **8,000 characters** |
| Agent name | **42 characters** (MCS) / **30 characters** (Agent Builder) |
| Agent description | **1,024 characters** |
| Topics per agent | **1,000** (Dataverse) / **250** (Teams) |
| Trigger phrases per topic | **200** |
| Skills per agent | **100** |
| Topics/actions per orchestration | **128** max |
| Messages per topic/action chain | **5** per turn |
| Consecutive actions (recommended) | **< 15** |
| Performance degradation threshold | **> 30-40 choices** |
| Knowledge objects per agent | **500** |
| Files uploaded per agent | **500** |
| File upload size | **512 MB** |
| Connector payload | **5 MB** (public) / **450 KB** (GCC) |
| Agent icon | PNG < 72KB, 192x192 max |
| Agents per Teams team | **50** |

## Knowledge Source Limits

### Uploaded Files
| Feature | Limit |
|---------|-------|
| Files per agent | **500** |
| File size | **512 MB** |
| Supported types | DOC, DOCX, XLS, XLSX (30 MB), PPT, PPTX, PDF, TXT |

### SharePoint / OneDrive (per source)
| Feature | Limit |
|---------|-------|
| Files per source | **1,000** |
| Folders per source | **50** |
| Subfolder depth | **10 layers** |
| File size | **512 MB** |
| SharePoint file for GenAI (no M365 Copilot) | **7 MB** |
| SharePoint file for GenAI (with M365 Copilot + Enhanced) | **200 MB** |
| Sync frequency | **4-6 hours** |
| SharePoint list rows | First **2,048** only |
| Lookup columns in default view | **12** max |
| Items selectable per Add Knowledge | **15** |

### Dataverse Knowledge
| Feature | Limit |
|---------|-------|
| Dataverse sources per agent | **2** |
| Tables per source | **15** |

### OneDrive Knowledge
| Feature | Limit |
|---------|-------|
| Files per source | **1,000** |
| Folders per source | **50** |
| Subfolder depth | **10 layers** |
| File size | **512 MB** |
| Sync frequency | **4-6 hours** |
| Supported types | DOC, DOCX, XLS, XLSX, PPT, PPTX, PDF |

**Note:** Sensitivity-labeled (confidential/highly confidential) or password-protected docs cannot be indexed.

### Salesforce, Confluence, ServiceNow, ZenDesk
- Articles: no limit
- Article size: no limit
- Sync: 4-6 hours

### Unstructured Data Knowledge General Notes
- **All unstructured data sources require user-level authentication** at runtime
- **ALM not supported** for unstructured data knowledge sources (import does NOT trigger knowledge processing)
- Exhaustive retrieval queries (hundreds of files) may degrade performance due to limited context window
- Glossaries/synonyms NOT supported for SharePoint/OneDrive (supported for Dataverse only)
- Ampersand `&` NOT supported in SharePoint document/folder names

## Throttling Quotas (per Dataverse Environment)

### General Messages
| Quota | Value |
|-------|-------|
| Messages to agent | **8,000 RPM** |

### Generative AI Messages
| Tenant Billing | RPM | RPH |
|---------------|-----|-----|
| Trial / developer | 10 | 200 |
| 1-10 prepaid packs | 50 | 1,000 |
| 11-50 prepaid packs | 80 | 1,600 |
| 51-150 prepaid packs | 100 | 2,000 |
| Each +10 packs above 150 | +1 | +20 |
| Pay-as-you-go | 100 | 2,000 |
| M365 Copilot users | 100 | 2,000 |

## API Rate Limits

| API | Limit |
|-----|-------|
| Dataverse API (per user, 5-min window) | **6,000 requests** |
| Dataverse execution time (5-min window) | **20 minutes** |
| Dataverse concurrent requests | **52** |
| Dataverse Search | **1 request/second** per user |
| Power Platform requests/24h (Copilot Studio) | **250,000** |
| Power Platform requests/24h (Teams M365) | **6,000** |

## Flow Execution Limits

| Limit | Value |
|-------|-------|
| Synchronous response time | **100 seconds** |
| Express mode (preview) | **2 minutes** |
| Actions after Respond to Agent | Up to **30 days** |
| Data received from flow | **1 MB** per action |
| Connector payload | **5 MB** (public) / **450 KB** (GCC) |
| Express mode max actions | 100 per run |
| Express mode variable content | 1,024 characters |

## Message Payload Limits

| Channel | Limit |
|---------|-------|
| Direct Line / Facebook | **256 KB** per activity |
| Omnichannel (ACS) | **28 KB** per message |
| Handoff context to Omnichannel | **28 KB** |

## User File Upload (Runtime)

| Type | Limit |
|------|-------|
| Images | **15 MB** (4 MB for DirectLine-based channels) |
| PDF files | Fewer than **40 pages** |
| TXT/CSV files | **180 KB** |
| Supported types | CSV, PDF, TXT, JPG, PNG, WebP, non-animated GIF |

## Licensing

### Billing Model (Since Sept 2025)
- **Per-tenant** licensing using **Copilot Credits**
- Credits pooled across entire tenant
- Can be allocated to specific environments in PPAC

### Copilot Credit Rates

| Feature | Credits Consumed | M365 Copilot Licensed? |
|---------|-----------------|----------------------|
| Classic answer | **1** | No charge |
| Generative answer | **2** | No charge |
| Agent action (triggers, reasoning, topic transitions, CUA) | **5** | No charge |
| Tenant graph grounding | **10** | No charge |
| Agent flow actions (per 100 actions) | **13** | No charge |
| Text/Gen AI tools (basic) per 10 responses | **1** | No charge |
| Text/Gen AI tools (standard) per 10 responses | **15** | No charge |
| Text/Gen AI tools (premium/reasoning) per 10 responses | **100** | No charge |
| Content processing tools per page | **8** | No charge |

**Example**: Generative answer + tenant graph grounding = 10 + 2 = **12 credits**.

### Pricing

| Model | Price | Details |
|-------|-------|---------|
| Prepaid capacity pack | **$200/month** | 25,000 Copilot Credits (~$0.008/credit) |
| Pay-as-you-go | **~$0.01/credit** | Azure billing, no upfront |
| Pre-Purchase (CCCUs) | **Up to 20% savings** | 1-year prepaid via Azure portal |

### Overage
- Triggers at **125%** of prepaid capacity
- Custom agents **disabled** until next billing cycle or additional packs purchased
- Email notification to tenant admin
- **Credits do NOT carry over** month to month — unused capacity expires
- Comprehensive monitoring, reporting, and alerting available in PPAC

### Standalone vs M365 Copilot

| Feature | Standalone ($200/mo) | M365 Copilot ($30/user/mo) |
|---------|---------------------|---------------------------|
| All channels (web, social, custom) | Yes | Internal only (Teams, M365, SharePoint) |
| Premium connectors | Yes | No |
| Power Automate flows | Yes | No |
| Generative orchestration | Yes | No |
| Bot Framework skills | Yes | No |
| Live agent handoff | Yes | No |
| Web security secrets | Yes | No |
| Credit billing for licensed users | Normal rates | **No charge** |

### Teams Plan (M365 Subscription)
- Standard connectors only
- No generative orchestration
- No premium connectors or PA flows
- No web channel secrets
- 6,000 Power Platform requests/24h

### Trial
| Feature | Limit |
|---------|-------|
| Duration | **60 days** (+30 day extension) |
| Post-expiry | Agent works up to **90 days** after expiry |
| Publishing | **Cannot publish** (test panel only) |
| Gen AI rates | 10 RPM / 200 RPH |

### Environment Capacity
| Plan | Database | File | Log |
|------|----------|------|-----|
| Copilot Studio license | **15 GB** | **20 GB** | 2 GB |

**Note (Dec 2025 change):** Database capacity tripled from 5 GB to 15 GB. File and log remain at 20 GB and 2 GB respectively. Additional Database, File, and Log capacity can be purchased in 1 GB increments.

**Clarification (Mar 2026):** The Feb 2026 and Mar 2026 official Licensing Guides confirm 15 GB database, 20 GB file, 2 GB log. Some third-party sources (samexpert.com, others) incorrectly report 40 GB file — the official MS number from MS Learn and the Licensing Guide PDF is 20 GB. The MS Learn quotas page (verified 2026-03-23) does not list file/database capacities directly, but the Licensing Guide is authoritative.

## Quick Reference

| Category | Limit |
|----------|-------|
| Instructions | 8,000 chars |
| Topics/agent | 1,000 |
| Trigger phrases/topic | 200 |
| Knowledge objects/agent | 500 |
| Skills/agent | 100 |
| Files/agent | 500 |
| Connector payload | 5 MB |
| Session timeout | 30 min |
| Session max turns | 100 |
| General RPM | 8,000 |
| GenAI RPM (standard) | 100 |
| Flow response time | 100 sec |
| Direct Line payload | 256 KB |
| Prepaid pack | $200/mo = 25K credits |
| Overage enforcement | 125% |

## Upcoming Changes

- **AI Builder credits removal (Nov 2026):** Seeded AI Builder credits included with premium Power Platform licenses will be removed. AI Builder capabilities will then be billed through Copilot Credits at higher rates. Plan migration early.
  - **Dual-mode licensing now active:** Environments first consume AI Builder credits, then fall back to Copilot Credits if exhausted. No automatic conversion between credit types. Consumption resets monthly.
  - **AI Builder add-on purchases:** Only available as renewal/true-up for existing customers. New customers must purchase Copilot Credits.
  - **AI Builder trials:** Discontinued as of Nov 2025.
- **Copilot Credits Pre-Purchase Plan:** One-year prepaid option (CCCUs) available in Azure portal. Pool usable across eligible Microsoft products.
- **Rate-limit increase requests:** Only available for pay-as-you-go environments. Contact Microsoft Support; subject to review and approval. Message-based environments are NOT eligible.
- **Quotas are configurable:** Default quotas can be adjusted on a case-by-case basis (contact support).
- **Improved PA licensing dashboard (May 2026):** Better visibility into Power Automate license usage.
- **Share Process license capacity across workflows (Apr 2026):** Simplifies licensing for shared flows.
- **Mar 2026 Licensing Guide:** Minor changes documented in Appendix D change log. No major rate changes from Feb 2026 guide.
- **Apr 2026 Licensing Guide:** Published (19 pages). PDF available at `cdn-dynmedia-1.microsoft.com`. Could not parse PDF directly — monitor for changes vs Mar guide. Check for any credit rate adjustments.

## Licensing Access Requirements

To use Copilot Studio, you need ONE of:
1. Copilot Studio user license (free, but requires tenant prepaid pack subscription first)
2. Copilot Studio authors role in PPAC (via Entra security group)
3. Microsoft 365 Copilot license
4. Copilot Studio trial license

## Usage Estimator

**Tool:** Microsoft Copilot Studio Agent Usage Estimator
**URL:** https://microsoft.github.io/copilot-studio-estimator/
Create estimates by selecting agent type, traffic, orchestration, knowledge, and tools.

## Knowledge Source Limits (Updated Mar 2026)

### SharePoint Unstructured Data Requirements

Required Dataverse extensions (verify in PPAC > Solutions):
- Power AI Extensions Base v1.0.1.688+
- AI Platform Extensions Components v1.0.0.157+
- Relevance Search v1.0.0.90+

### SharePoint Lists as Knowledge (Planned Apr 2026)

- Preview Apr 2026, GA May 2026
- Lists subject to 2,048-row limit
- Max 12 lookup columns in default view
- Document libraries NOT supported as lists
- Attachments column does not index attached file contents

## SharePoint Knowledge Limits — Additional Detail (Verified Mar 2026)

From the quotas page, additional limits not fully captured above:
- **SharePoint list queries**: Only first 2,048 rows of data returned
- **List views**: Cannot be selected as knowledge source
- **Glossary/Synonyms**: NOT supported for lists
- **SPFx components**: Modern pages with SPFx NOT supported
- **Classic ASPX pages**: Not used for answer generation
- **Metadata filters** (Nov 2025): Use filename, owner, modified date to refine retrieval
- **Dynamic SharePoint URL**: Must use Classic data option with Power Fx formula in generative answers node
- **Guest users**: Generative answers from SharePoint NOT available to guest users in SSO-enabled apps
- **Document name queries**: Cannot reference file/document names in queries (e.g., "What's in file-name.pdf?")
- **15 items per Add Knowledge session**: To add more, complete first 15, then Add Knowledge again

## Refresh Notes

- Check pricing page for credit rate changes
- Monitor for new billing features (usage estimator tool available)
- Watch for throttling quota adjustments
- Check for Teams plan feature expansion
- Monitor pay-as-you-go rate changes
- Watch for AI Builder credits transition (Nov 2026 deadline)
- **Apr 2026 Licensing Guide now published** — check for changes vs Mar guide (PDF at cdn-dynmedia-1.microsoft.com)
- Monitor file capacity clarification (20 GB official vs 40 GB third-party claims)
- MS Learn quotas page confirmed no changes to limits as of Apr 2026 refresh
- **Licensing FAQ** still lists 5 GB Database for Dataverse default capacity (Power Platform licensing FAQ) — this contradicts the Licensing Guide's 15 GB. The FAQ page may be stale. Rely on the Licensing Guide PDF as authoritative.
