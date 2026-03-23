<!-- CACHE METADATA
last_verified: 2026-03-23
sources: [MS Learn (knowledge-copilot-studio, requirements-quotas, knowledge-file-groups, knowledge-real-time-connectors, knowledge-unstructured-data, custom-knowledge-sources, knowledge-azure-ai-search, planned-features, 2026wave1 release plan), MCS UI snapshot, WebSearch Mar 2026, 2026 Wave 1 release plan, Dynamics 365 Blog Mar 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Knowledge Source Types

## Available Knowledge Sources

### Core Knowledge Sources (Generative Orchestration)

| Type | Description | Setup | Gen Orchestration Limit | Classic Limit |
|------|-------------|-------|------------------------|---------------|
| Public websites | Web pages searched via Bing | Provide URLs. Requires ownership attestation. | **25 URLs** | 4 URLs |
| Uploaded files (Documents) | Local files uploaded to Dataverse | Upload .pdf, .docx, .pptx, .txt, .html, .xlsx, .csv | **All documents** (not part of 25-source limit) | Dataverse storage allocation |
| **File groups** | Group up to 500 files into a single knowledge source with variable-based instructions | Upload locally, select "Upload as a group" | **25 groups** per agent | N/A |
| SharePoint | Index SharePoint site content via GraphSearch | Connect to SharePoint URL. Requires Entra ID auth. | **25 URLs** | 4 URLs per generative answers node |
| Dataverse tables | Structured data from Dataverse via RAG | Select tables and views. Requires Entra ID auth. | **Unlimited** | 2 sources, 15 tables per source |
| Enterprise data (Copilot connectors) | Index non-Microsoft data into Graph for semantic search | Setup in M365 admin center. Add via Knowledge > Advanced. | **Unlimited** | 2 per agent |
| OneDrive | Personal/shared OneDrive files | Select files/folders from OneDrive | See SharePoint limits | See SharePoint limits |
| **Azure AI Search** | Vector search over custom indexes | Connect via Access Key, Client Cert, Service Principal, or Entra ID Integrated. One vector index per connection. | **GA** (May 2025). Featured in Add Knowledge dialog. | N/A |
| **Custom knowledge (OnKnowledgeRequested)** | API-based custom knowledge via topic trigger | Create topic with OnKnowledgeRequested trigger (YAML-only). Call any search API, transform results to Content/ContentLocation/Title format. | Up to 15 snippets across all custom knowledge topics combined | N/A (generative orchestration only) |

### Unstructured Data Sources (via Knowledge > Advanced)

| Type | Description | Limits |
|------|-------------|--------|
| Salesforce | CRM data as knowledge | No article count/size limit. Sync every 4-6h. |
| ServiceNow | IT service management data | No article count/size limit. Sync every 4-6h. Supports synonyms + glossary. |
| Confluence | Wiki/documentation content | Cloud only. No article count/size limit. Sync every 4-6h. |
| Zendesk | Support ticket/article data | No article count/size limit. Sync every 4-6h. Supports synonyms + glossary. |

### Search & Grounding Settings (NOT tools -- these are toggles)

**These are agent-level settings, NOT tools/connectors.** In brief.json, use `type: "setting"` (not `"ai-tool"`). Enable via Settings > Generative AI or LSP push (`gptCapabilities` in `settings.mcs.yml`).

| Type | Description | Setup | Notes |
|------|-------------|-------|-------|
| Web Search (Bing grounding) | Open web search across ALL Bing-indexed sites | Toggle in Generative AI settings or Knowledge > Web Search. LSP: `gptCapabilities.webBrowsing: true` | Requires generative orchestration. Uses Grounding with Bing Search API. Runs in parallel with configured public website sources. **NOT the "Bing Search" Power Platform connector** (that's a separate connector with `GetNews` action). |
| AI General Knowledge | LLM foundational knowledge | Toggle "Use general knowledge" in Generative AI settings. | Not real-time. Based on model training data. Can be turned off to restrict to configured sources only. |
| **Tenant graph grounding** | Semantic search across M365 tenant data | Enable in Generative AI settings | **Requires M365 Copilot license** in same tenant. Requires "Authenticate with Microsoft" auth setting. Supports files up to 200 MB (or 512 MB for PDF/PPTX/DOCX). Enabled by default when license present. Does NOT support manual authentication. |
| **Real-Time Knowledge connectors (Preview)** | Live API queries to external systems with no data movement | Add via Knowledge > Advanced > Real-time connector. Select tables. | Preview. Metadata-only indexing. Runtime-authenticated per user. |

### Classic Orchestration Only

| Type | Description | Limit |
|------|-------------|-------|
| Azure OpenAI Service connection | Azure OpenAI as knowledge source | 5 connections |
| Bing Custom Search | Custom-configured Bing search domains | 2 Custom Configuration IDs |
| Custom data sources | API-based custom knowledge | 3 sources |

Note: Generative orchestration does NOT support custom data or Bing Custom Search directly. To use them, embed inside a generative answers node in a topic.

### Agent-Level Limits

| Constraint | Limit |
|-----------|-------|
| Max knowledge objects per agent | **500** (but up to **1,000 files** for SharePoint/OneDrive uploads -- GA Oct 2025) |
| Max different source types per agent | **5** |
| Max file groups per agent | **25** |
| Max files per file group | **500** (512 MB each) |
| SharePoint list queries | First **2,048 rows** only |
| SharePoint lists per "Add knowledge" session | **15** (repeat dialog to add more) |
| Generative orchestration source filter | If >25 knowledge sources, agent uses internal GPT to filter by description (uploaded files exempt from this limit) |
| Custom knowledge snippets | Up to **15** snippets across all OnKnowledgeRequested topics combined |
| Connector payload size | **5 MB** (450 KB for GCC) |

## Real-Time Knowledge Connectors (Preview) -- Supported Systems

Added Feb 2026. These connectors query external systems live at runtime with no data replication. Metadata-only indexing (table names, column names). Runtime calls authenticated per-user.

| Connector | Notes |
|-----------|-------|
| **Salesforce** | Accounts, Contacts, Opportunities, Leads, Cases |
| **ServiceNow** | Supports synonyms and glossary definitions |
| **Azure SQL** | Direct SQL queries |
| **Azure AI Search** | Semantic search |
| **SharePoint** | Also available as standard knowledge source |
| **Dataverse** | Also available as standard knowledge source |
| **Dynamics 365** | CRM data |
| **Snowflake** | Data warehouse queries |
| **Databricks** | Analytics data |
| **Zendesk** | Supports synonyms and glossary definitions |
| **Confluence** | Cloud only |
| **Oracle Database** | Database queries |
| **SAP OData** | SAP system data |
| **Google Sheets** | Spreadsheet data |

Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-real-time-connectors

## Custom Knowledge Sources (OnKnowledgeRequested)

**GA feature.** Custom knowledge sources use the `OnKnowledgeRequested` trigger to connect any search API as a knowledge source. This is YAML-only (no visual designer support).

### System Variables
| Variable | Purpose |
|----------|---------|
| `System.SearchQuery` | Context-aware rewritten query optimized for semantic search |
| `System.KeywordSearchQuery` | Rewritten query optimized for keyword-based search |
| `System.SearchResults` | Output: formatted knowledge snippets (Content, ContentLocation, Title) |

### Key Facts
- Up to 15 snippets from `System.SearchResults` used to generate response
- Multiple OnKnowledgeRequested topics allowed -- all invoked simultaneously
- 15-snippet limit applies across ALL custom knowledge topics combined
- Can use HTTP requests, custom connectors, built-in connectors (e.g., Azure AI Search), or agent flows
- Query rewriting preserves multi-turn conversation context
- Results must use format: `{Content: string, ContentLocation: string (optional), Title: string (optional)}`

Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/custom-knowledge-sources

## Web Search Mechanisms (3 Approaches)

| Mechanism | How It Works | Configuration |
|-----------|-------------|---------------|
| **Specific URLs** | Bing searches only specified domains | Add public website URLs as knowledge sources |
| **Open Web Search** | Bing searches ALL indexed public sites | Enable "Use information from the web" toggle |
| **Bing Custom Search** | Bing searches custom-configured domains | Configure at customsearch.ai, use in generative answers node |

Source: https://learn.microsoft.com/en-us/microsoft-copilot-studio/data-privacy-security-web-search

## File Upload Limits

| Constraint | Limit |
|-----------|-------|
| Max file size | 512 MB per file (XLS/XLSX: 30 MB when used in M365 Copilot declarative agents) |
| Max total knowledge | 2 GB per agent |
| Max knowledge objects | 500 per agent |
| Supported formats | PDF, DOCX, DOC, PPTX, PPT, TXT, HTML, XLSX, XLS, CSV |
| Max files per upload | 10 files at once (15 for SharePoint file/folder selection) |
| Sensitivity labels | Confidential/Highly confidential + password-protected files cannot be indexed |
| ALM | Not supported for unstructured data sources -- importing agents does not auto-process knowledge |
| SharePoint file size (without M365 Copilot license) | **7 MB** max for generative answers (must turn OFF Enhanced search results) |
| SharePoint file size (with M365 Copilot license) | **200 MB** max (must turn ON Enhanced search results / Tenant graph grounding) |

### SharePoint / OneDrive Unstructured Data Limits

| Constraint | Limit |
|-----------|-------|
| Files per source | 1,000 files, 50 folders, 10 layers of subfolders |
| File size | 512 MB per file |
| Sync frequency | Every 4-6 hours |
| Supported file types | DOC, DOCX, XLS, XLSX, PPT, PPTX, PDF |
| With tenant graph grounding | Up to 200 MB (or 512 MB for PDF/PPTX/DOCX) |
| Modern pages only | Classic ASPX pages not supported; SPFx components not supported |
| Document libraries | Not supported |
| Accordion nav / custom CSS | Not supported -- pages with these don't generate answers |
| File/document name queries | Not supported -- users cannot ask "what's in file-name.pdf?" |
| Manual authentication | Not supported for SharePoint docs or tenant graph grounding |
| Required Dataverse extensions | Power AI Extensions Base 1.0.1.688+, AI Platform Extensions 1.0.0.157+, Relevance Search 1.0.0.90+ |

### Dataverse Limits

| Constraint | Limit |
|-----------|-------|
| Max Dataverse sources per agent | 2 |
| Max tables per knowledge source | 15 |
| Table types | Standard or Activity tables (+ Virtual tables with specific dataproviderid) |
| Synonyms | Max name: 100 chars, max description: 1,000 chars |
| Glossary | Max name: 100 chars, max description: 1,000 chars |

## Knowledge Source Selection

| Use Case | Best Source | Why |
|----------|-----------|-----|
| Company policies / SOPs | SharePoint site | Auto-updates when docs change |
| Specific reference docs | Uploaded files | Full control, no dependency |
| Location/role-dependent docs | File groups | Instructions narrow search scope per user context |
| Product catalog / inventory | Dataverse table | Structured, queryable |
| FAQ / help articles | Public website | Always current with site |
| Enterprise search data | Copilot connectors (Graph) | Broadest reach across M365 |
| M365 tenant-wide context | Tenant graph grounding | Semantic search across all M365 data |
| Live external system data | Real-time connectors (Preview) | No data movement, user-authenticated |
| Structured data analysis | Code interpreter + files | Deterministic computation, not LLM guessing |
| Pre-built vector search index | Azure AI Search (direct, GA) | Native integration, vectorized + semantic ranker support |
| Custom search API | OnKnowledgeRequested trigger | Full control over query and results |
| Multiple backend systems | Multiple OnKnowledgeRequested topics | Parallel querying with automatic result merging |
| SharePoint tabular data | SharePoint lists (Preview Apr 2026) | Real-time, ACL-enforced, no data movement |

## Knowledge Source Behavior Controls

### triggerCondition Property

Controls WHEN a knowledge source is auto-searched by the orchestrator:

| Setting | Behavior | Use Case |
|---------|----------|----------|
| *(default -- no property)* | Auto-searched on every user message | Standard knowledge sources |
| `triggerCondition: false` | **Never auto-searched** -- only queried explicitly via `SearchAndSummarizeContent` | Glossary CSVs, reference data that should only load on-demand |
| `triggerCondition: =Global.Variable = "value"` | Conditionally included based on variable state | Country-specific docs, role-based knowledge |

```yaml
# Example: Knowledge source that is never auto-searched
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  site: https://tenant.sharepoint.com/sites/Glossary
triggerCondition: false
```

### 25-Source UniversalSearchTool Limit

When an agent has **more than 25 knowledge sources** (uploaded files are exempt from this count), the orchestrator's UniversalSearchTool auto-selects the **top 25 by description match**. Sources with poor or missing descriptions may be skipped entirely.

**Solutions for agents exceeding 25 sources:**
1. **Explicit routing** -- Use `OnKnowledgeRequested` trigger to route by category (see `knowledge/patterns/topic-patterns/knowledge-routing.yaml`)
2. **File groups** -- Consolidate related files into groups (up to 500 files per group, 25 groups per agent)
3. **Better descriptions** -- Ensure every knowledge source has a specific, descriptive name/description
4. **Conditional inclusion** -- Use `triggerCondition` to limit active sources by user context

### Graph Connector Sources

Enterprise data from non-Microsoft systems can be indexed into Microsoft Graph via Copilot connectors (formerly Graph connectors). These appear as "Enterprise data (Copilot connectors)" in the Knowledge > Advanced section. Data is indexed and searchable without replication -- the connector provides a semantic index over the external system. Requires M365 admin center configuration.

## How to Add Knowledge

### Via LSP Wrapper (preferred -- headless, no browser)

Clone the agent workspace, add a `.mcs.yml` file to the `knowledge/` folder, then push.

**YAML format by source type:**

```yaml
# Public website
kind: KnowledgeSourceConfiguration
source:
  kind: PublicSiteSearchSource
  site: https://docs.example.com
```

```yaml
# SharePoint site
kind: KnowledgeSourceConfiguration
source:
  kind: SharePointSearchSource
  site: https://tenant.sharepoint.com/sites/SiteName
```

```yaml
# Dataverse tables
kind: KnowledgeSourceConfiguration
source:
  kind: DataverseStructuredSearchSource
  skillConfiguration: TableName_randomId
```

**File naming:** `{botSchema}.topic.{SourceName}_{randomId}.mcs.yml` in `knowledge/` folder.

**Workflow:**
```bash
# 1. Clone agent (if not already cloned)
node tools/mcs-lsp.js clone --workspace ./workspace --agent-id <id> ...

# 2. Create knowledge file
# Write .mcs.yml to knowledge/ folder

# 3. Push to MCS
node tools/mcs-lsp.js push --workspace "./workspace/Agent Name"
```

### Via Dataverse API (file uploads)
- POST `botcomponents` (type 16) + file upload
- See `knowledge/patterns/dataverse-patterns.md` section 4
- Best for: uploaded document files (PDF, DOCX, etc.)

### Via Playwright (fallback)
1. Navigate to Knowledge tab
2. Click "Add knowledge"
3. Select source type
4. Configure source (URL, file, table)
5. Save

> **Note:** LSP push confirmed working for PublicSiteSearchSource, SharePointSearchSource, and DataverseStructuredSearchSource. File uploads still require Dataverse API or Playwright.

## Code Interpreter (GA)

Code interpreter is a Python execution engine integrated within Copilot Studio. It allows agents to run code in a secure, sandboxed environment.

| Feature | Status | Details |
|---------|--------|---------|
| Code interpreter on customer-uploaded files | **GA** (Nov 2025) | Users can upload files in conversation for analysis |
| Code interpreter on SharePoint sources | **Preview** (Mar 2026), GA May 2026 | Analyze SharePoint Document Library structured files (CSV, Excel) with code |
| Code interpreter in prompt builder | **GA** | Enable via prompt settings |

Capabilities: data analysis, process Word/Excel/PowerPoint/PDF files, generate visualizations, deterministic computation. Supports statistical analysis, table joins, forecasting, chart generation.

## Generative Answers

Knowledge sources power the `SearchAndSummarizeContent` node:
- Agent searches configured knowledge when user asks a question
- AI generates a grounded answer with citations
- Moderation levels: Low, Moderate, High (default: High at agent level, Moderate at prompt level)
- Official sources can be marked as trusted (classic orchestration only -- not yet compatible with generative orchestration)
- Citations returned from knowledge sources cannot currently be used as inputs to other tools or actions

## Content Moderation Levels

Moderation levels range from **Lowest** to **Highest**. Topic-level settings take precedence over agent-level. Prompt tools can override via Completion setting.

| Level | Description |
|-------|-------------|
| Lowest | Most permissive -- maximum answers, highest risk of harmful content |
| Low | Most answers, but may allow harmful content |
| Moderate | Default for prompts. Balanced filtering. |
| High | Default for agents. Stricter filter, fewer answers. |
| Highest | Most restrictive filter, fewest answers |

**Per-prompt content moderation (Feb 2026):** Configure content moderation sensitivity per prompt to control how hate/fairness, sexual, violence, and self-harm content is filtered -- supports regulated and document-processing scenarios.

## Upcoming Features

| Feature | Status | Expected | Notes |
|---------|--------|----------|-------|
| Code interpreter on SharePoint sources | Preview Mar 2026 | GA May 2026 | Analyze SharePoint Document Library structured files (CSV, Excel) with Python |
| Custom MCP servers as knowledge | Preview Mar 2026, GA Apr 2026 | Mar-Apr 2026 | Connect to any external data via MCP |
| Enhanced connectors (Connector SDK + PowerFx) | Preview (May 2025) | GA May 2026 | Build structured data connectors for agent knowledge |
| OpenAPI v3 custom connectors | Preview Feb 2026 | GA May 2026 | Import OpenAPI v3 specs directly |
| File groups | **GA** (Aug 2025) | -- | Group files with variable-based instructions to guide agent answers. GA May 2026 per 2026w1 release plan refers to additional enhancements. |
| **SharePoint lists as knowledge source** | Preview Apr 2026 | GA May 2026 | Real-time connection to SharePoint list data. ACL-enforced. Select from recent/my lists. |
| **Use your own model for generating responses** | Preview Mar 2026 | TBD | Bring custom models for generative answers |
| **Configure triggers with end-user credentials** | Preview Mar 2026 | GA May 2026 | |
| **Use MCP-compliant tools in agent workflows** | Preview Apr 2026 | GA Oct 2026 | Broader MCP tool integration in workflows |
| Reassign agent owner via Power Platform API | -- | GA Mar 2026 | |
| Build advanced approvals | Preview | GA Mar 2026 | |

## Refresh Notes

- Check MCS UI "Add knowledge" dialog for new source types
- Graph connectors expanding -- new data sources added regularly
- Search "Copilot Studio knowledge sources" on MS Learn for updates
- Tenant graph grounding requires M365 Copilot license -- verify before recommending
- **File groups are GA (Aug 2025)** with variable-based instructions. 2026w1 plans additional enhancements (GA May 2026).
- Code interpreter is GA for uploaded files and prompts; SharePoint preview Mar 2026, GA May 2026
- Real-time connectors still in Preview -- 14 connectors supported
- ALM not supported for unstructured data sources (import does not auto-process)
- OnKnowledgeRequested is the recommended approach for custom search APIs (Azure AI Search, etc.)
- SharePoint without M365 Copilot license: 7 MB file limit for generative answers
- Enhanced connectors (Connector SDK) allow building structured data connectors usable as knowledge in agents
- **Azure AI Search is GA (May 2025)** as a first-class knowledge source -- supports vectorized indexes with integrated vectorization and semantic ranker. Does NOT support VNet-configured indexes.
- **SharePoint lists as knowledge source** -- Preview Apr 2026, GA May 2026. Real-time connection, ACL-enforced.
- **SharePoint metadata filters (Nov 2025)** -- filter by filename, owner, modified date for better retrieval
- **1,000 files per agent** for SharePoint/OneDrive uploads (GA Oct 2025), up from previous 500
- **Connector payload limit**: 5 MB (450 KB for GCC)
- **Knowledge source suggestions**: MCS now suggests top 10 knowledge sources from previous agents, shared agents, and Office products
- **Per-prompt content moderation** (Feb 2026): control hate/fairness, sexual, violence, self-harm sensitivity per prompt
- **Mar 2026 check**: Azure AI Search GA, file groups GA, SharePoint lists Preview Apr 2026, custom MCP servers as knowledge Preview Mar 2026 / GA Apr 2026. No new knowledge source types added since last check. Real-time connectors remain Preview.
