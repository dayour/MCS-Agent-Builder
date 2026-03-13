<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn (knowledge-copilot-studio, requirements-quotas, knowledge-file-groups, knowledge-real-time-connectors, knowledge-unstructured-data, planned-features), MCS UI snapshot, WebSearch Feb 2026]
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
| **File groups** | Group up to 500 files into a single knowledge source with instructions | Upload locally, select "Upload as a group" | **25 groups** per agent | N/A |
| SharePoint | Index SharePoint site content via GraphSearch | Connect to SharePoint URL. Requires Entra ID auth. | **25 URLs** | 4 URLs per generative answers node |
| Dataverse tables | Structured data from Dataverse via RAG | Select tables and views. Requires Entra ID auth. | **Unlimited** | 2 sources, 15 tables per source |
| Enterprise data (Copilot connectors) | Index non-Microsoft data into Graph for semantic search | Setup in M365 admin center. Add via Knowledge > Advanced. | **Unlimited** | 2 per agent |
| OneDrive | Personal/shared OneDrive files | Select files/folders from OneDrive | See SharePoint limits | See SharePoint limits |

### Unstructured Data Sources (via Knowledge > Advanced)

| Type | Description | Limits |
|------|-------------|--------|
| Salesforce | CRM data as knowledge | No article count/size limit. Sync every 4-6h. |
| ServiceNow | IT service management data | No article count/size limit. Sync every 4-6h. Supports synonyms + glossary. |
| Confluence | Wiki/documentation content | Cloud only. No article count/size limit. Sync every 4-6h. |
| Zendesk | Support ticket/article data | No article count/size limit. Sync every 4-6h. Supports synonyms + glossary. |

### Search & Grounding Settings (NOT tools — these are toggles)

**These are agent-level settings, NOT tools/connectors.** In brief.json, use `type: "setting"` (not `"ai-tool"`). Enable via Settings > Generative AI or LSP push (`gptCapabilities` in `settings.mcs.yml`).

| Type | Description | Setup | Notes |
|------|-------------|-------|-------|
| Web Search (Bing grounding) | Open web search across ALL Bing-indexed sites | Toggle in Generative AI settings or Knowledge > Web Search. LSP: `gptCapabilities.webBrowsing: true` | Requires generative orchestration. Uses Grounding with Bing Search API. Runs in parallel with configured public website sources. **NOT the "Bing Search" Power Platform connector** (that's a separate connector with `GetNews` action). |
| AI General Knowledge | LLM foundational knowledge | Toggle "Use general knowledge" in Generative AI settings. | Not real-time. Based on model training data. Can be turned off to restrict to configured sources only. |
| **Tenant graph grounding** | Semantic search across M365 tenant data | Enable in Generative AI settings | **Requires M365 Copilot license** in same tenant. Requires "Authenticate with Microsoft" auth setting. Supports files up to 200 MB (or 512 MB for PDF/PPTX/DOCX). Enabled by default when license present. |
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
| Max knowledge objects per agent | **500** |
| Max different source types per agent | **5** |
| Max file groups per agent | **25** |
| Max files per file group | **500** (512 MB each) |
| SharePoint list queries | First **2,048 rows** only |
| Generative orchestration source filter | If >25 knowledge sources, agent uses internal GPT to filter by description (uploaded files exempt from this limit) |

## Real-Time Knowledge Connectors (Preview) -- Supported Systems

Added Feb 2026. These connectors query external systems live at runtime with no data replication.

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

## Knowledge Source Behavior Controls

### triggerCondition Property

Controls WHEN a knowledge source is auto-searched by the orchestrator:

| Setting | Behavior | Use Case |
|---------|----------|----------|
| *(default — no property)* | Auto-searched on every user message | Standard knowledge sources |
| `triggerCondition: false` | **Never auto-searched** — only queried explicitly via `SearchAndSummarizeContent` | Glossary CSVs, reference data that should only load on-demand |
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
1. **Explicit routing** — Use `OnKnowledgeRequested` trigger to route by category (see `knowledge/patterns/topic-patterns/knowledge-routing.yaml`)
2. **File groups** — Consolidate related files into groups (up to 500 files per group, 25 groups per agent)
3. **Better descriptions** — Ensure every knowledge source has a specific, descriptive name/description
4. **Conditional inclusion** — Use `triggerCondition` to limit active sources by user context

### Graph Connector Sources

Enterprise data from non-Microsoft systems can be indexed into Microsoft Graph via Copilot connectors (formerly Graph connectors). These appear as "Enterprise data (Copilot connectors)" in the Knowledge > Advanced section. Data is indexed and searchable without replication — the connector provides a semantic index over the external system. Requires M365 admin center configuration.

## How to Add Knowledge

### Via LSP Wrapper (preferred — headless, no browser)

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
- See `knowledge/patterns/dataverse-patterns.md` § 4
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
| Code interpreter on SharePoint sources | **Preview** (Mar 2026) | Analyze SharePoint-sourced data with code |
| Code interpreter in prompt builder | **GA** | Enable via prompt settings |

Capabilities: data analysis, process Word/Excel/PowerPoint/PDF files, generate visualizations, deterministic computation.

## Generative Answers

Knowledge sources power the `SearchAndSummarizeContent` node:
- Agent searches configured knowledge when user asks a question
- AI generates a grounded answer with citations
- Moderation levels: Low, Moderate, High (default: High at agent level, Moderate at prompt level)
- Official sources can be marked as trusted (classic orchestration only -- not yet compatible with generative orchestration)
- Citations returned from knowledge sources cannot currently be used as inputs to other tools or actions

## Content Moderation Levels

| Level | Description |
|-------|-------------|
| Low | Most answers, but may allow harmful content |
| Moderate | Default for prompts. Balanced filtering. |
| High | Default for agents. Strictest filter, fewer answers. |

## Upcoming Features

| Feature | Status | Expected | Notes |
|---------|--------|----------|-------|
| Code interpreter on SharePoint sources | Preview | Mar 2026 | Analyze SharePoint data with Python |
| Custom MCP servers as knowledge | Preview | Mar 2026, GA Apr 2026 | Connect to any external data via MCP |
| Evaluate test sets with multiple graders | Preview | Feb 2026 | Already available |

## Refresh Notes

- Check MCS UI "Add knowledge" dialog for new source types
- Graph connectors expanding -- new data sources added regularly
- Search "Copilot Studio knowledge sources" on MS Learn for updates
- Tenant graph grounding requires M365 Copilot license -- verify before recommending
- File groups are GA -- good for location/role-dependent document sets
- Code interpreter is GA for uploaded files and prompts
- Real-time connectors still in Preview -- 14 connectors supported
- ALM not supported for unstructured data sources (import does not auto-process)
