# Build Method Learnings

Lessons learned about build execution — PAC CLI vs Playwright, Dataverse API patterns, Code Editor YAML, publish methods. Consulted during `/mcs-build`.

<!--
Entry format:
### [Title] {#id} — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s) | Last confirmed: [YYYY-MM-DD]
**Related cache:** [cache file(s) if applicable]
**Tags:** #tag1 #tag2
-->

### PAC CLI create requires undocumented template YAML {#bm-001} — 2026-02-18
**Context:** Evaluating agent creation methods for the hybrid build stack
**Tried:** `pac copilot create --templateFileName template.yaml` — requires a YAML template extracted from an existing agent via `pac copilot extract-template`
**Result:** Template format is not published by Microsoft, no official samples exist, and templates only capture ~30% of agent config (topics/instructions — not tools, knowledge, or model). Since Playwright is already required for tools + model selection, the template dependency adds friction with no benefit.
**Better approach:** Create agents via Playwright (MCS UI → Create → New agent → Skip to configure → set name/description → Create). PAC CLI `create` is a fallback for environments where browser is unavailable.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-18
**Related cache:** agent-lifecycle.md, api-capabilities.md
**Tags:** #pac-cli #playwright #agent-creation #template

### Dataverse POST for new botcomponents skips MCS orchestration {#bm-002} — 2026-02-20
**Context:** CDW Legal & HR Policy Advisor build — attempted to create topics and instructions via raw `POST /botcomponents`
**Tried:** PowerShell Web API `POST` to create botcomponent records (componenttype 9 for topics, 15 for instructions) with YAML/JSON content
**Result:** Records created in Dataverse (confirmed via FetchXML), but agent appears BLANK in MCS UI. MCS doesn't recognize the components because raw POST skips:
- NLU trigger phrase registration
- `bot_botcomponent` M:M relationship setup
- Dependency tracking and topic compilation
**Better approach:** For NEW topics: use Playwright → Code Editor → paste YAML → Save (triggers MCS compilation). For EXISTING instructions (componenttype 15): `PATCH /botcomponents(<id>)` works because the component is already registered. Then publish via `PvaPublish` bound action or `pac copilot publish`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** api-capabilities.md, dataverse-patterns.md
**Tags:** #dataverse #botcomponent #topic-creation #instructions #playwright #code-editor

### PAC CLI extract-template crashes on complex agents {#bm-003} — 2026-02-20
**Context:** CDW build — attempted `pac copilot extract-template --bot <CDW-Legal-bot>` to get a working template
**Tried:** `pac copilot extract-template` on the CDW Legal & HR Policy Advisor agent
**Result:** `System.ArgumentException` crash. Reproduced on multiple agents with custom topics or complex configurations.
**Better approach:** Use the simplest available agent in the environment as the template source. Or skip templates entirely — create agents via Playwright UI (preferred) and configure from there.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** agent-lifecycle.md
**Tags:** #pac-cli #extract-template #crash #agent-creation

### PAC CLI publish (MSI) crashes — MCP copilot_publish is reliable fallback {#bm-004} — 2026-02-20
**Context:** CDW build — attempted `pac copilot publish --bot <bot-id>` via Bash
**Tried:** `pac copilot publish --bot <bot-id-or-schema-name>` using MSI-installed PAC CLI (v2.1.2)
**Result:** `System.ArgumentException` crash. The MSI version's publish command is unreliable.
**Better approach:** Use MCP `copilot_publish` tool (PAC CLI MCP Server via dnx, v2.2.1) — consistently works. Alternatively, use PowerShell `Publish-Bot` (PvaPublish bound action) or Playwright Publish button.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-20
**Related cache:** api-capabilities.md
**Tags:** #pac-cli #publish #mcp #crash #workaround
