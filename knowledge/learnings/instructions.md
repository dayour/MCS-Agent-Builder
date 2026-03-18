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
Decision rule: if the behavior maps to a boundaries eval test (100% pass required), it needs topic backing. Instructions + knowledge suffices for 70-85% threshold tests.
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

### Multi-model instruction patterns — universal style over model-specific branching {#in-004} — 2026-02-27
**Context:** MCS now supports 10+ models across 3 families (GPT-5/5.2, Claude Sonnet/Opus 4.5/4.6, Grok 4.1). Agent instructions are a single 8,000-char system prompt with no API parameter access (reasoning_effort, verbosity, thinking). Investigated whether instructions should branch per model family.
**Tried:** Model-specific instruction variants — different phrasing per GPT vs Claude vs Grok. Also tested aggressive emphasis ("CRITICAL: YOU MUST NEVER") for boundary enforcement.
**Result:** Model-specific branching is impractical (makers switch models freely; instructions can't detect which model is running). Aggressive caps ("CRITICAL:", "YOU MUST") trigger over-compliance on Claude 4.6 (refuses valid requests) and get ignored by GPT-5.2. Personality padding ("world-class expert") is discarded by GPT-5.2 and ignored by Claude. "Be concise" without a floor produces bare-minimum responses on GPT-5.2 and Claude 4.6.
**Better approach:** 7 universal style rules that work across all model families: (1) Role in first line — functional, no superlatives, (2) WHY on every constraint — reason in parentheses, (3) Tiered length with floor + ceiling per question type, (4) Plain emphasis — bold or "Never X", no aggressive caps, (5) No personality padding, (6) 2-3 varied examples — happy path + boundary + complex, (7) Flat lists only. Model-specific tuning is a lightweight post-generation scan (e.g., Claude: check for aggressive caps → soften; GPT-5.2: check for missing length floors → add). Universal template updated in instructions-authoring.md cache.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** instructions-authoring.md
**Tags:** #instructions #multi-model #claude #gpt-5 #universal-style #cross-model

### Conciseness principle — start minimal, nudge as needed {#in-006} — 2026-03-17
**Context:** Framework research across MS Learn (7 pages), GPT-5.4 review, internal Microsoft sources (CAT AI Webinar Feb 2026, Dragon Copilot, One-Page Template, Office Hours), and community blogs.
**Tried:** Our instruction framework was structurally correct (three-part structure, routing priority, three-layer architecture, anti-patterns, model-aware rules) but encouraged over-specification by targeting "FULLY address every capability."
**Result:** Deep research converged on a clear finding: over-specifying reduces quality. Key evidence: CAT Webinar ("start with minimal instructions, then nudge"), GPT-5.4 analysis (sweet spot 1,200-2,000 chars, max 4,000 for complex), MS Learn ("Less is more. Simpler instructions often perform better"), Office Hours ("let orchestrators reason when possible"), and the principle that large instruction sets execute on EVERY TURN affecting performance.
**Better approach:** Five targeted refinements: (1) Character budget targets (800-1,500 simple → 1,200-2,500 standard → 2,000-4,000 complex), flag >4,000 for review. (2) Description engineering — write descriptions (routing priority #1) BEFORE instructions, reducing need for long instruction text. (3) Topics extraction checklist — move deterministic flows to topics, keep instructions for persona+guardrails+format. (4) Advanced patterns (Output Contract, Self-Eval Gate, Reasoning Steering, Decision Rules, Literal-Execution Header) — optional, use when scenario benefits. (5) Updated GPT prompts to generate concise instructions and flag over-specified content. Applied to 3 files: instructions-authoring.md (authoritative cache), prompt-engineer.md (PE agent), multi-model-review.js (GPT prompts).
**Confirmed:** 0 build(s) | Last confirmed: 2026-03-17
**Related cache:** instructions-authoring.md (updated with 6 new sections)
**Tags:** #instructions #conciseness #description-engineering #topics-extraction #advanced-patterns #framework-update

### Date context injection via Today() in instructions {#in-007} — 2026-03-18
**Context:** Research from microsoft/skills-for-copilot-studio repo — official Microsoft best practice for date-aware agents.
**Tried:** No date context in agent instructions, relying on the model's training cutoff for date awareness.
**Result:** Without date context, the orchestrator misinterprets relative dates ("next week", "upcoming events", "recent announcements"), returns outdated information, and struggles with localization ambiguity.
**Better approach:** Inject `{Text(Today(),DateTimeFormat.LongDate)}` directly in agent instructions. `Today()` is a Power Fx function evaluated at runtime — no topic or global variable needed. Use `DateTimeFormat.LongDate` (e.g., "Thursday, March 13, 2026") to avoid locale ambiguity (short dates like "3/13" are ambiguous across locales). For time precision use `Now()`. Minimal token cost (5-10 tokens). Place in a `## Current Context` section at top of instructions. Combine with JIT user context: `Date: {Text(Today(),DateTimeFormat.LongDate)}, User: {Global.UserDisplayName} from {Global.UserCountry}`.
**Confirmed:** 0 build(s) | Last confirmed: 2026-03-18
**Related cache:** instructions-authoring.md
**Tags:** #instructions #date-context #today #powerfx #best-practice #time-sensitive

### Topic-action chaining — output DATA not status messages {#in-008} — 2026-03-18
**Context:** Research from microsoft/skills-for-copilot-studio repo — critical anti-pattern for generative orchestration agents with mixed topics and actions.
**Tried:** Topics that gather data for downstream actions output status messages like "Your complaint has been submitted!" or "Report is ready!".
**Result:** The orchestrator interprets status messages as task completion — it does NOT invoke the downstream action (e.g., Teams connector to actually send the complaint). The user sees a success message but the action never fires.
**Better approach:** Two rules: (1) If the topic IS the final action (self-contained), output a confirmation via SendActivity. (2) If the topic PREPARES DATA for an action to consume, output the DATA ITSELF as a topic output variable, NOT a status message. The orchestrator reads the output and chains it to the next action's input. Alternative approaches: remove the topic entirely and let the action gather data via its own AutomaticTaskInput descriptions, or use a global variable that the action reads via Power Fx. Key question to ask: "Does this topic complete the task on its own, or does it prepare data for another action/topic?"
**Confirmed:** 0 build(s) | Last confirmed: 2026-03-18
**Related cache:** instructions-authoring.md
**Tags:** #instructions #topic-action-chaining #generative-orchestration #anti-pattern #output-variables

### Instructions-only agents fail boundaries evals — three-layer architecture required {#in-005} — 2026-03-13
**Context:** CDW Account Prospecting Agent — initial research produced instructions only (no topics), relying entirely on generative orchestration for all behavior including boundary enforcement.
**Tried:** All capabilities AND boundaries encoded in instructions alone. Zero custom topics. No greeting, no fallback customization, no deterministic decline paths.
**Result:** GPT review flagged 7/10 — instructions can't guarantee 100% boundary enforcement (~90% at best). Boundaries eval tests for decline-pricing and decline-support would likely fail intermittently. No welcome/greeting experience. No adaptive card capability (instructions can't trigger cards). MCP-dependent capabilities correctly stayed in orchestrator, but decline paths incorrectly stayed there too.
**Better approach:** Apply Microsoft's three-layer architecture:
1. **Deterministic (topics):** Greeting, fallback, escalation, and one topic per hard-decline boundary. These guarantee 100% pass on boundaries evals via fixed SendMessage nodes.
2. **AI orchestrator (instructions):** Core capabilities that need tools/MCP + flexible AI reasoning. Instruction quality still matters — use WHY clauses, tiered response format, scope section, source tagging.
3. **Minimum topic set:** Greeting (system), Fallback (system), Escalation (system), plus 1 custom topic per boundary that must pass 100%.
Key rule: if the behavior maps to a boundaries eval test (100% pass required), it MUST have a dedicated topic. Instructions provide ~90% but that's not enough for boundaries.
Also: add explicit Scope section to instructions when future capabilities exist ("This is the MVP version. X is planned for a future release.") to prevent model from improvising.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-13
**Related cache:** instructions-authoring.md (three-layer section updated)
**Tags:** #instructions #topics #three-layer #safety #boundaries #greeting #fallback #adaptive-cards #scope
