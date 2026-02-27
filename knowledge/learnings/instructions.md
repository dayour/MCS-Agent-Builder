# Instruction Writing Learnings

Lessons learned about agent instructions — what patterns work, what to avoid, Custom Prompt usage, length management. Consulted during `/mcs-research` Phase C (Prompt Engineer) and `/mcs-fix` Step 2.

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

ID format: in-NNN (instructions)
-->

### Hardcoded URLs and tool listing in instructions produce weak agents {#in-001} — 2026-02-20
**Context:** CDW Legal & HR Policy Advisor — policy Q&A agent with SharePoint knowledge, custom topics, M365 Copilot channel
**Tried:** Instructions with a "Key Resources" section listing 6 hardcoded URLs (CDW Way Code of Conduct, Ethics Helpline, Service Central, etc.), no follow-up question guidance, no audience specification, no examples, professional tone specified (which is default)
**Result:** Instructions were only 2006 chars (well under limit) but quality was poor:
- Hardcoded URLs waste char budget and get stripped by M365 Copilot channel
- No routing hints for custom topics (COI Inquiry, High-Risk Guidance)
- No follow-up question guidance → dead-end answers
- Missing audience ("for CDW coworkers") → generic tone
- No examples for complex COI/escalation workflows
- Boundary enforcement via instructions only (no dedicated topics mentioned)
- Per MS best practices: "Avoid naming specific knowledge sources directly. Describe capabilities generically."
**Better approach:** Use MS three-part structure (Constraints + Response Format + Guidance). Describe knowledge generically ("search policy documents") instead of hardcoding URLs. Include audience, follow-up guidance, and 2-3 examples. Rely on dedicated topics for hard boundaries, not instructions alone. Topic descriptions drive routing more than instructions (priority: description > name > parameters > instructions).
**Confirmed:** 3 build(s) | Last confirmed: 2026-02-26
**Related cache:** instructions-authoring.md, generative-orchestration.md
**Tags:** #instructions #urls #anti-pattern #follow-up #audience #three-part-structure #boundaries

### Escalation contacts belong in topics + knowledge, not instructions {#in-002} — 2026-02-26
**Context:** CDW Legal & HR Policy Advisor — compliance agent with safety-critical escalation paths (fraud, retaliation, harassment)
**Tried:** Escalation contacts (cdwway@cdw.com, 877.723.9929, CDW.ethicspoint.com, InfoSec@cdw.com) hardcoded in agent instructions "Escalation Contacts" section AND repeated in examples
**Result:** Anti-pattern per MS Learn. Contacts waste char budget, M365 Copilot strips URLs, data can't be updated independently. More importantly, instructions provide only probabilistic guarantee (~90%) — not acceptable for safety-critical data.
**Better approach:** Three-layer escalation pattern:
1. **Knowledge source** — document/page with all contacts (retrieved with citations)
2. **Dedicated topic** — SendActivity nodes with contacts hardcoded in topic messages (100% guaranteed delivery)
3. **Instructions** — generic routing hint: "For high-risk concerns, use /TopicName" (points AI to the topic)
Decision rule: if the behavior maps to a safety eval test (100% pass required), it needs topic backing. Instructions + knowledge suffices for 70-85% threshold tests.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-26
**Related cache:** instructions-authoring.md
**Tags:** #instructions #escalation #contacts #topics #safety #three-layer #anti-pattern

### Capability-instruction phase mismatch — PE must respect phase tags {#in-003} — 2026-02-27
**Context:** CDW Account Prospecting Agent — "Enrich prospects with relevance scoring" was tagged `phase: "future"` in capabilities but PE wrote a full `## Relevance Scoring` section into instructions. Build pushed without flagging.
**Tried:** PE wrote instructions covering all capabilities regardless of phase. QA reviewed structure/anti-patterns but had no capability-phase cross-reference check. Build Step 2 pushed instructions as-is.
**Result:** Future capability content shipped in instructions. No harm in this case (relevance scoring is prompt-only guidance) but the pattern is dangerous: a future capability requiring tooling could produce instructions that reference non-existent tools.
**Better approach:** Three fixes applied: (1) Research Phase C — PE requirements now say "address ALL mvp capabilities, do NOT write sections for future capabilities unless `implementationType: prompt`". (2) Research Phase C — QA checklist now includes capability-instruction alignment check. (3) Build Step 2 — pre-push validation scans instructions against capabilities, flags mismatches as WARNINGs. Also added `implementationType` field to capability schema to distinguish prompt-only from tool-dependent capabilities.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** instructions-authoring.md
**Tags:** #instructions #capabilities #phase #cross-reference #qa #validation
