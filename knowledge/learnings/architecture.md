# Architecture Decision Learnings

Lessons learned about single vs multi-agent decisions, orchestrator patterns, and agent decomposition. Consulted during `/mcs-research` Phase C (architecture design).

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

ID format: ar-NNN (architecture)
-->

### MCP servers only callable from orchestrator — topics can't invoke MCP {#ar-001} — 2026-02-27
**Context:** CDW Account Prospecting Agent — debated whether core prospecting flow (Salesforce MCP queries) should be a custom topic or stay in instructions
**Tried:** Considered making "Prospect Search by Criteria" a custom topic for more deterministic behavior
**Result:** MCS constraint: topics CANNOT call MCP servers directly — only the generative orchestrator can route to MCP tools. Since the core prospecting workflow depends on Salesforce MCP (`mcp_SalesforceManagement`), making it a topic would break MCP access entirely.
**Better approach:** Architecture rule for MCP-dependent agents: capabilities that invoke MCP servers MUST use generative orchestration + instructions, not custom topics. Reserve custom topics for: (1) UI elements — buttons, cards, suggested actions, (2) hard boundaries — fixed decline/refuse responses (100% pass eval), (3) structured data collection — multi-step forms with required fields, (4) event-triggered flows — scheduled/autonomous topics. This aligns with the three-layer architecture: deterministic (topics) for guaranteed behaviors, AI orchestrator (instructions + MCP) for flexible tool-calling.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** generative-orchestration.md, mcp-servers.md
**Tags:** #mcp #topics #orchestrator #architecture #generative #tool-calling

### implementationType field prevents capability-phase ambiguity {#ar-002} — 2026-02-27
**Context:** CDW Account Prospecting — "Relevance Scoring" capability tagged `future` but PE wrote instruction content for it because it's just prompt guidance (no tooling needed)
**Tried:** Capabilities had only `phase` (mvp/future) with no indication of what's required to implement them
**Result:** Ambiguity: "Relevance Scoring" tagged `future` looked like a deferred feature, but it was actually zero-cost prompt guidance that should have been MVP. The PE wrote it anyway, creating a mismatch the build didn't catch.
**Better approach:** Added `implementationType` field to capability schema: `prompt` (instructions only, zero-cost), `topic` (needs custom YAML), `tool` (needs connector/MCP), `knowledge` (needs knowledge source), `flow` (needs Power Automate). Benefits: (1) `prompt` capabilities can be auto-included in instructions regardless of phase. (2) `tool`/`flow` capabilities tagged `future` clearly explain WHY they're deferred. (3) Build Step 2 validation uses `implementationType` to skip false-positive warnings (future + prompt = expected). (4) Research Phase C uses it to classify topic needs.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** templates/brief.json
**Tags:** #schema #capabilities #implementationType #phase #architecture #brief
