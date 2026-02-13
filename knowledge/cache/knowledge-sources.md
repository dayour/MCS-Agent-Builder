<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MS Learn, MCS UI snapshot]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Knowledge Source Types

## Available Knowledge Sources

| Type | Description | Setup |
|------|-------------|-------|
| SharePoint sites | Index SharePoint site content | Connect to SharePoint site URL |
| SharePoint files | Specific files from SharePoint | Select files from library |
| Uploaded files | Local files uploaded to agent | Upload .pdf, .docx, .pptx, .txt, .html, .xlsx |
| Dataverse tables | Structured data from Dataverse | Select tables and views |
| Public websites | Web page content (crawled) | Provide URLs (limited crawl depth) |
| Microsoft Graph connectors | Enterprise search indexes | Requires Graph connector setup |

## File Upload Limits

| Constraint | Limit |
|-----------|-------|
| Max file size | 512 MB per file |
| Max total knowledge | 2 GB per agent |
| Supported formats | PDF, DOCX, PPTX, TXT, HTML, XLSX, CSV |
| Max files per upload | 10 files at once |

## Knowledge Source Selection

| Use Case | Best Source | Why |
|----------|-----------|-----|
| Company policies / SOPs | SharePoint site | Auto-updates when docs change |
| Specific reference docs | Uploaded files | Full control, no dependency |
| Product catalog / inventory | Dataverse table | Structured, queryable |
| FAQ / help articles | Public website | Always current with site |
| Enterprise search data | Graph connector | Broadest reach across M365 |

## How to Add Knowledge

### Via Dataverse API (preferred — no browser)
- POST `botcomponents` (type 16) + file upload
- See `knowledge/patterns/dataverse-patterns.md` § 4

### Via Playwright (fallback)
1. Navigate to Knowledge tab
2. Click "Add knowledge"
3. Select source type
4. Configure source (URL, file, table)
5. Save

## Generative Answers

Knowledge sources power the `SearchAndSummarizeContent` node:
- Agent searches configured knowledge when user asks a question
- AI generates a grounded answer with citations
- Moderation levels: Low, Medium, High

## Refresh Notes

- Check MCS UI "Add knowledge" dialog for new source types
- Graph connectors expanding — new data sources added regularly
- Search "Copilot Studio knowledge sources" on MS Learn for updates
