# Build Method Learnings

Lessons learned about build execution — PAC CLI vs Playwright, Dataverse API patterns, Code Editor YAML, publish methods. Consulted during `/mcs-build`.

<!--
Entry format:
### [Title] — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s)
**Tags:** #tag1 #tag2
-->

### PAC CLI create requires undocumented template YAML — 2026-02-18
**Context:** Evaluating agent creation methods for the hybrid build stack
**Tried:** `pac copilot create --templateFileName template.yaml` — requires a YAML template extracted from an existing agent via `pac copilot extract-template`
**Result:** Template format is not published by Microsoft, no official samples exist, and templates only capture ~30% of agent config (topics/instructions — not tools, knowledge, or model). Since Playwright is already required for tools + model selection, the template dependency adds friction with no benefit.
**Better approach:** Create agents via Playwright (MCS UI → Create → New agent → Skip to configure → set name/description → Create). PAC CLI `create` is a fallback for environments where browser is unavailable.
**Confirmed:** 1 build(s)
**Tags:** #pac-cli #playwright #agent-creation #template
