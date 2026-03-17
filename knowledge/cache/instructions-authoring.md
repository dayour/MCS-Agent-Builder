<!-- CACHE METADATA
last_verified: 2026-03-13
sources: [MS Learn authoring-instructions, MS Learn generative-mode-guidance, MS Learn create-edit-topics, MS Learn advanced-generative-actions, MCS UI, community blogs]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Instructions Authoring — Quick Reference

## What Instructions Do (Three Purposes)

1. **Resource selection** — which tools/knowledge/topics to call
2. **Input filling** — what values to pass to tools
3. **Response generation** — how to format output for the user

## Conciseness Principle

Instructions execute on **every turn** — every character costs tokens per conversation round. Over-specifying reduces quality (internal CAT Webinar, Feb 2026; MS Learn: "Less is more. Simpler instructions often perform better than complex ones").

**Philosophy:** Start minimal, nudge as needed. Don't write comprehensive instructions upfront — add specificity only when eval tests fail or agent behavior drifts.

### Character Budget Targets

| Agent Type | Target Range | Notes |
|-----------|-------------|-------|
| Simple Q&A | 800–1,500 chars | Knowledge + guardrails only |
| Standard agent | 1,200–2,500 chars | **Sweet spot** for most agents |
| Complex orchestrator | 2,000–4,000 chars | Multi-tool, multi-step workflows |
| Multi-agent parent | 1,500–3,000 chars | Routing + delegation + guardrails |

**Flag >4,000 chars for review** — likely contains content that should be a topic or is duplicating description/knowledge content. The 8,000-char limit is a ceiling, not a target.

### Conciseness Rules

1. **No section longer than 500 chars** — if it exceeds this, extract to a topic
2. **Don't duplicate descriptions** — if a tool/topic description already says it, don't restate in instructions
3. **Don't list what the orchestrator knows** — it already has tools, topics, and knowledge sources
4. **Prefer examples over rules** — one good example replaces 3 lines of instruction text
5. **Trim after every edit pass** — re-read and cut anything the model would do by default

## Routing Priority (Most to Least Important)

| Priority | What | Implication |
|----------|------|-------------|
| 1 | **Tool/topic/knowledge DESCRIPTIONS** | Write excellent descriptions FIRST — they matter most |
| 2 | **Tool/topic/knowledge NAMES** | Use clear, descriptive names |
| 3 | **Input/output parameters** | Well-named parameters help routing |
| 4 | **Agent instructions** | Instructions are LEAST important for routing |

**Key insight:** Instructions influence *response generation* and *disambiguation* more than routing. If routing is wrong, fix topic descriptions first, not instructions.

## Description Engineering

Descriptions are routing priority #1 — invest in them **before** writing instructions. Well-written descriptions reduce the need for long instructions because the orchestrator routes on descriptions first.

### Why Descriptions Matter More Than Instructions

- Orchestrator reads descriptions to decide **which** tool/topic/knowledge to call
- Instructions only influence **how** the agent responds after routing is decided
- A weak description + strong instructions = wrong tool called with great formatting
- A strong description + minimal instructions = right tool called, good-enough formatting

### Description Templates

**Tool description:**
```
Use this tool to [action] for [audience]. Input: [what it needs]. Output: [what it returns]. Do NOT use for [common misroute].
```

**Topic description:**
```
Handles [specific scenario]. Triggers when the user [condition]. Do NOT trigger for [similar but different scenario].
```

**Knowledge source description:**
```
Contains [content type] about [domain]. Covers [scope]. Does NOT cover [exclusion].
```

**Agent description (multi-agent child):**
```
Specialist for [domain]. Handles [capability list]. Escalates to parent when [condition].
```

### Description Checklist

- [ ] Every tool has a description with action + audience + input/output + negative routing
- [ ] Every topic has a description with trigger condition + negative routing
- [ ] Every knowledge source has a description with scope + exclusions
- [ ] Descriptions written BEFORE instructions (not after)

## Character Limits

| Layer | Scope | Limit |
|-------|-------|-------|
| Agent-level (Overview) | All conversations | 8,000 chars |
| Topic-level (generative answers node) | Specific node only | 8,000 chars (additive) |
| Prompt tool / Custom Prompt action | Specific prompt only | Model token limits |

**BUG (may still exist):** UI may show 8,000 initially but revert to 2,000 after save. Always verify actual char count post-save.

## The Three-Part Structure (MS Recommended)

Microsoft recommends structuring instructions with three elements combined:

### 1. Constraints (What to do / not do)
```
Only respond to requests about educational, legal, wellness, and health benefits for employees.
Do not provide personal medical advice — redirect to HR Benefits team.
```

### 2. Response Format (How to present answers)
```
Respond with benefit types and details in tabular format.
Add a column for available options.
Include insurance provider details and enrollment links.
Use bold and underline for emphasis.
```

### 3. Guidance (How to find answers)
```
Search within country-specific folders relevant to the employee's location.
Use the FAQ documents only if the question is not about Hours, Appointments, or Billing.
```

## Two Proven Instruction Patterns (Legacy)

> **Note:** These patterns are preserved for reference. For new agents, use the **Universal Instruction Template** in the "Model-Aware Instruction Patterns" section below, which incorporates WHY-clauses, tiered length, and cross-model compatibility.

### Pattern A: Conversational Agent (Legacy)
```markdown
# [Agent Name]

## Role
You are [Name], an AI assistant for [audience] that [core purpose].

## Constraints
- Only respond to [in-scope domains]
- For [out-of-scope topic], say: "[redirect message]"

## Response Format
- [Length]: 3-5 key points per answer
- [Structure]: Numbered steps for procedures, bullets for options
- [Citations]: Name the source document or section
- End every response with a relevant follow-up question or next step

## Guidance
- When the user asks about [ambiguous topic], use /TopicName
- Describe knowledge capabilities generically — do NOT hardcode URLs
- For [sensitive scenario], direct to [escalation resource]
```

### Pattern B: Autonomous / Multi-Step Workflow (Legacy)
```markdown
# OBJECTIVE
[One sentence goal]

# STEPS (follow in order)
1. **[Step Name]**: Use /ToolName to [action]. Transition when [condition].
2. **[Step Name]**: [Next action with /ToolReference].
3. **[Step Name]**: [Final action].

# RESPONSE RULES
- Ask one clarifying question at a time
- Present results as bullet points or tables
- Confirm before completing the workflow

# GUARDRAILS
- Only email [specified recipients]
- Do not [restricted action]
```

## Model-Aware Instruction Patterns

MCS supports 10+ models across 3 families (GPT-5/5.2, Claude Sonnet/Opus 4.5/4.6, Grok 4.1). Agent instructions are a single 8,000-char system prompt that runs on whichever model the maker selects — there is no API parameter access (reasoning_effort, verbosity, thinking). A **universal style** works across all models; model-specific tuning is a lightweight scan step, not a restructure.

### 7 Universal Style Rules

| # | Rule | Why | Example |
|---|------|-----|---------|
| 1 | **Role in first line — functional, no superlatives** | All models anchor behavior from the opening role statement; superlatives are discarded or ignored | "You are PolicyBot, a benefits assistant for Contoso HR employees." (not "You are a world-class expert policy advisor") |
| 2 | **WHY on every constraint — reason in parentheses** | Motivation improves adherence across all model families | "Do not provide medical advice (employees must consult HR Benefits for liability reasons)." |
| 3 | **Tiered length (floor + ceiling) — per question type** | GPT-5.2 and Claude 4.6 both trend concise; "be concise" alone → bare-minimum responses | "Simple lookups: 2-4 sentences. Policy explanations: 3-5 bullet points. Procedures: numbered steps, up to 10." |
| 4 | **Plain emphasis — bold or "Never X", no aggressive caps** | "CRITICAL: YOU MUST" triggers over-compliance on Claude 4.6, gets ignored by GPT-5.2 | "**Never** share personal medical details." (not "CRITICAL: YOU MUST NEVER share personal medical details") |
| 5 | **No personality padding — no "world-class expert"** | GPT-5.2 discards it; Claude ignores superlatives; wastes chars | "You are PolicyBot, a benefits assistant" (not "You are an exceptional, world-class benefits expert") |
| 6 | **2-3 varied examples — happy path + boundary + complex** | Claude needs examples for complex behavior; GPT-5 benefits too | Include one normal Q&A, one decline scenario, one multi-step workflow |
| 7 | **Flat lists only — no nesting** | All models lose accuracy with nested structures | Single-level bullets and numbered lists only |

### Model Family Tuning Guide

After writing instructions using the universal rules, do a quick scan for model-specific risks:

| Model Family | Behavioral Tendency | Extra Check |
|-------------|-------------------|-------------|
| **GPT-5 / GPT-5.2** | Trends terse; discards personality padding; follows explicit structure well | Verify length floors exist (not just ceilings). Check that examples have enough detail — GPT-5.2 may produce minimal responses without them. |
| **Claude Sonnet/Opus 4.5/4.6** | Follows motivation-driven constraints well; over-complies on aggressive emphasis; ignores superlatives | Scan for "CRITICAL:", "YOU MUST", "ALWAYS" in caps → soften to bold or "Never X". Check that decline boundaries don't over-trigger (add positive scope clarification after each decline rule). |
| **Grok 4.1** | Generally follows structured instructions; less tested in MCS context | Verify examples cover edge cases — Grok benefits from explicit boundary examples. |

### Universal Instruction Template (Conversational Agent)

```markdown
# [Agent Name]

## Role
You are [Name], a [function] assistant for [AUDIENCE] that [core purpose].

## Constraints
- Only respond to [in-scope domains] (because [reason for scope])
- For [out-of-scope topic], say: "[redirect message]" (to ensure [reason])
- For [sensitive scenario], direct to [escalation resource] (because [liability/compliance reason])

## Response Format
- Simple lookups: [2-4 sentences / 1-3 bullet points]
- Detailed explanations: [3-5 bullet points with source citations]
- Procedures: [numbered steps, up to N]
- End every response with a relevant follow-up question or next step

## Guidance
- When [ambiguous scenario], use /TopicName to [action]
- For [domain], search [knowledge description — NOT specific filenames or URLs]
- If no answer found: "I could not find a policy covering that. Contact [resource]."

## Examples
User: "[simple lookup question]"
Response: "[ideal 2-3 sentence response with citation]"

User: "[boundary/decline question]"
Response: "[redirect message with reason and alternative]"

User: "[complex multi-step question]"
Response: "[structured response with numbered steps and follow-up]"
```

### Universal Instruction Template (Autonomous Workflow)

```markdown
# [Agent Name]

## Role
You are [Name], an autonomous assistant that [one-sentence goal] for [AUDIENCE].

## Steps (follow in order)
1. **[Step]**: Use /ToolName to [action] (needed because [reason]). When [condition], proceed to step 2.
2. **[Step]**: [Action with /ToolReference] (this ensures [reason]). When [condition], proceed to step 3.
3. **[Step]**: [Final action]. Confirm with user before completing.

## Response Rules
- Ask one clarifying question at a time (to avoid overwhelming the user)
- Simple status: 1-2 sentences. Results: bullet points or table. Errors: state what failed and suggest next step.
- Do not ask the user for details the tool can retrieve (to reduce friction)

## Guardrails
- Only [action] for [permitted scope] (because [compliance/security reason])
- **Never** [restricted action] (because [specific risk])

## Examples
User: "[happy path trigger]"
Response: "[ideal step-by-step execution summary]"

User: "[edge case or boundary trigger]"
Response: "[appropriate guardrail response with explanation]"
```

### Advanced Patterns

Optional patterns — use when the scenario benefits. Not needed for simple Q&A agents.

#### Pattern: Literal-Execution Header
Pin model behavior at the top of instructions to prevent drift on long conversations.
```
Follow these instructions exactly. Do not add steps, skip steps, or improvise beyond what is described.
```
**Use when:** Autonomous workflows, multi-step processes, compliance-sensitive agents.

#### Pattern: Output Contract
Define the exact shape of every response. Reduces ambiguity and improves eval scoring.
```
## Response Format
- **Goal:** Answer the user's benefits question
- **Format:** Bullet points with source citations
- **Detail:** 3-5 points per answer
- **Tone:** Professional, empathetic
- **Include:** Enrollment deadlines, provider names
- **Exclude:** Personal medical advice, cost comparisons across employees
```
**Use when:** Agents with strict output requirements or multiple output formats.

#### Pattern: Self-Evaluation Gate
Force the model to verify its own output before responding. Catches hallucination and scope violations.
```
Before finalizing your response, confirm:
1. Every claim is grounded in a retrieved document (not general knowledge)
2. No out-of-scope content is included
3. The response matches the requested format
If any check fails, revise before responding.
```
**Use when:** Autonomous workflows, agents that take actions, compliance-critical responses.

#### Pattern: Reasoning Steering
Cue the model toward deep analysis or fast response depending on query type.
```
For complex policy questions: analyze all relevant documents before responding, compare provisions, note conflicts.
For simple lookups: respond directly from the first matching source.
```
**Use when:** Agents handling both simple lookups and complex analysis.

#### Pattern: Explicit Decision Rules
Replace ambiguous routing with concrete if/then logic.
```
If the user asks about benefits enrollment: search HR Policy documents, respond with steps and deadlines.
If the user asks about a specific claim: use /ClaimsLookup tool with the claim number.
If the user asks about something not related to HR: say "I can only help with HR and benefits questions."
```
**Use when:** Agents with 3+ distinct routing paths or when orchestrator misroutes frequently.

### Anti-Patterns Updated for Modern Models

These 3 patterns join the existing anti-patterns table above:

| Anti-Pattern | Why It's Bad | Do This Instead |
|-------------|-------------|-----------------|
| **Aggressive caps emphasis** ("CRITICAL:", "YOU MUST NEVER", "ALWAYS" in all-caps) | Claude 4.6 over-complies (refuses valid requests); GPT-5.2 ignores caps entirely | Use **bold** or "Never X" for emphasis; add WHY in parentheses |
| **Personality padding** ("world-class expert", "exceptional specialist", "highly skilled") | GPT-5.2 discards it; Claude ignores superlatives; wastes char budget | Functional role only: "a benefits assistant for HR employees" |
| **Length ceiling without floor** ("be concise", "keep it short") | GPT-5.2 and Claude 4.6 both trend toward bare-minimum responses | Tiered length: "Simple lookups: 2-4 sentences. Explanations: 3-5 bullets." |

### Migration Guide for Existing Instructions

To update existing instructions to the universal style:

1. **Remove aggressive caps** — find "CRITICAL:", "YOU MUST", "ALWAYS" (all-caps) → replace with bold or "Never X"
2. **Add WHY-clauses** — for every constraint, add "(because [reason])" in parentheses
3. **Add length floors** — change "be concise" to tiered format: "Simple: 2-4 sentences. Detailed: 3-5 bullets."
4. **Strip personality padding** — remove "world-class", "expert", "exceptional" from Role
5. **Add 3 examples** — happy path + boundary + complex (if fewer than 3 exist)
6. **Flatten nested lists** — any multi-level bullets → single-level with separate sections

## What Instructions CAN and CANNOT Do

### CAN
- Influence post-retrieval summarization (how answers are phrased)
- Disambiguate between similar tools/knowledge with `/` references
- Set persona, tone (only if deviating from default professional), format
- Define workflow steps and tool sequencing for autonomous agents
- Reference variables and Power Fx expressions dynamically
- Guide follow-up question generation
- Set guardrails for what NOT to respond to

### CANNOT
- Control search retrieval (which documents are found)
- Trigger Adaptive Cards (edit card nodes directly)
- Override default fallback message (edit Fallback topic instead)
- Change how documents are shared (system-controlled)
- Guarantee multilingual behavior (not officially supported)

## Anti-Patterns (DO NOT)

| Anti-Pattern | Why It's Bad | Do This Instead |
|-------------|-------------|-----------------|
| **Hardcode URLs in instructions** | Wastes chars, M365 Copilot strips URLs, confuses orchestrator | Describe capabilities generically; let knowledge citations provide links |
| **List all available tools** | Orchestrator already knows them; listing is noise | Only add `/ToolName` for disambiguation |
| **Name specific knowledge sources** | MS: "Describe capabilities generically to avoid incorrect information" | Say "search policy documents" not "search PolicyLibrary.docx" |
| **Add professional tone instructions** | Professional is default; tone instructions are only for deviations | Only specify tone if you want casual, playful, or domain-specific style |
| **Rely on instructions alone for boundaries** | "Add a topic with manually authored response" for hard boundaries | Create dedicated DECLINE/REFUSE topics with fixed messages |
| **Use vague terms** | "Typing box", "be helpful" — ambiguous for the model | Be specific: "respond in 3 bullet points, 20 words max" |
| **Use nested lists** | Confuses the model | Flat lists only |
| **Attempt to control retrieval** | Instructions can't modify search logic | Improve knowledge source descriptions and scoping instead |
| **Skip audience specification** | Agent can't tailor technicality level | Always state who the audience is |
| **Hardcode escalation contacts** | Safety data trapped in instructions; can't be updated independently; M365 strips URLs | Put in knowledge source + dedicated topic; reference topic via `/TopicName` in instructions |
| **Aggressive caps emphasis** ("CRITICAL:", "YOU MUST NEVER") | Claude 4.6 over-complies; GPT-5.2 ignores caps entirely | **Bold** or "Never X" + WHY in parentheses |
| **Personality padding** ("world-class expert") | GPT-5.2 discards; Claude ignores superlatives; wastes chars | Functional role: "a benefits assistant for HR employees" |
| **Length ceiling without floor** ("be concise") | GPT-5.2 and Claude 4.6 produce bare-minimum responses | Tiered: "Simple: 2-4 sentences. Detailed: 3-5 bullets." |
| **Pages of declarative instructions** | Large instruction sets execute on EVERY TURN — performance and reliability degrade | Start minimal, nudge as needed; let orchestrator reason when possible |
| **Duplicating logic already in descriptions** | Descriptions drive routing (#1 priority); repeating in instructions wastes chars and can conflict | Write descriptions first, then only add instruction text for disambiguation |
| **Comprehensive upfront** ("cover every scenario") | Over-specifying reduces quality (CAT Webinar 2026); creates maintenance burden | Start with 1,200-2,500 chars; add specificity only when evals fail |

## Best Practices Checklist

### Structure
- [ ] Uses three-part structure: Constraints + Response Format + Guidance
- [ ] Markdown formatting: `#` headers, `1.` ordered steps, `-` bullets, `**bold**`
- [ ] No nested lists
- [ ] Under 2,500 chars for standard agents (flag >4,000 for review)
- [ ] No section longer than 500 chars (split to topic if needed)
- [ ] Audience explicitly stated ("for CDW coworkers", "for IT support engineers")

### Pre-Instruction Work
- [ ] Descriptions written for all tools/topics/knowledge BEFORE instructions
- [ ] Topics created for all 100%-required behaviors BEFORE instructions
- [ ] Topics extraction checklist completed — deterministic flows moved to topics
- [ ] Self-evaluation gate included for autonomous workflows

### Content
- [ ] Positive framing ("do X" not "don't do Y") — except for explicit guardrails
- [ ] No hardcoded URLs — describe knowledge capabilities generically
- [ ] No listing of all available tools/knowledge (orchestrator knows)
- [ ] `/` references ONLY for disambiguation or explicit workflow steps
- [ ] Every `/Tool` reference maps to an actually configured tool
- [ ] Every `/Topic` reference maps to an existing topic
- [ ] Agent has an "out" for unknown queries ("respond with 'I could not find...'")
- [ ] Follow-up question guidance included ("end with a relevant follow-up")
- [ ] Few-shot examples for complex behaviors (2-3 varied examples)

### Model Awareness
- [ ] No aggressive caps ("CRITICAL:", "YOU MUST", "ALWAYS" in all-caps) — use bold or "Never X"
- [ ] WHY-clause on every constraint (reason in parentheses)
- [ ] Tiered length with floors AND ceilings per question type
- [ ] No personality padding ("world-class", "exceptional", "highly skilled")
- [ ] 2-3 varied examples: happy path + boundary + complex scenario
- [ ] Functional role in first line — no superlatives

### Boundaries
- [ ] Hard boundaries backed by dedicated topics (not instructions alone)
- [ ] DECLINE redirects have corresponding manual-response topics
- [ ] REFUSE scenarios have corresponding manual-response topics
- [ ] Escalation contacts in knowledge sources + dedicated topics, NOT in instructions
- [ ] Safety-critical behaviors backed by topics (100% pass eval threshold = needs a topic)

### Orchestration Awareness
- [ ] Topic descriptions are well-written BEFORE instructions (routing priority #1)
- [ ] Instructions focus on response generation and disambiguation
- [ ] If routing fails, fix topic descriptions first — not instructions
- [ ] "Use general knowledge" setting matches follow-up question needs

## "/" Reference Syntax (Lexical Editor)

Type `/` in the instructions editor to insert references:

| Reference | Effect | When to Use |
|-----------|--------|-------------|
| `/Knowledge` | Prioritizes a knowledge source | Disambiguation when multiple sources overlap |
| `/Tool` | Names a specific tool | Disambiguation when multiple similar tools exist, or autonomous step |
| `/Topic` | Routes to a specific topic | Force routing when description alone is ambiguous |
| `/Agent` | Routes to a child agent | Multi-agent workflow steps |
| `/Variable` | Inserts variable value | Dynamic instructions using conversation state |
| `/PowerFx` | Embeds Power Fx expression | Calculated values in instructions |

**Rule:** Only for disambiguation or explicit workflow steps. Never redundantly list all tools.

## Vocabulary for Instructions

| Goal | Verbs |
|------|-------|
| Conditions | when, if, ensure, compare |
| Filter | from, include, exclude, compare, identify |
| Data | provide, retrieve, get, use, analyze, extract |
| Tools | notify, direct, ask, assign |
| Actions | ask, search, send, check, use |

Use **Get/Use** for retrieving data, **From/With** for acting on results.

## Follow-Up Questions

Follow-up questions make agents conversational instead of giving dead-end answers.

**Requirements:**
- "Use general knowledge" must be ON (otherwise follow-ups are suppressed as ungrounded)
- Instructions should reference tools/knowledge/variables so agent generates context-aware follow-ups

**Pattern:**
```
After answering, suggest a relevant follow-up based on available tools and knowledge.
Example: After answering about time-off policy, ask "Would you also like to know how to submit a request in Workday?"
```

## Three Instruction Layers

| Layer | Scope | When to Use |
|-------|-------|-------------|
| **Agent-level** (Overview) | All conversations | Global persona, constraints, response format, guardrails |
| **Topic-level** (generative answers node) | Specific topic only | **Additive** — supplements agent-level for domain-specific guidance |
| **Custom Prompt** (Prompt Builder action) | Specific action only | Summarization, classification, extraction, structured output |

**Decision:** "Should this be agent-level, topic-level, or Custom Prompt?" depends on scope and specificity. Agent-level = global rules. Topic-level = domain narrowing. Custom Prompt = data processing.

## Three-Layer Architecture (Deterministic → Hybrid → AI)

Microsoft officially documents a three-layer control model in the "Apply generative orchestration capabilities" guidance (2026). This is first-party architecture guidance, not a community pattern.

> "In a production-grade agent, don't leave every decision to the AI. Typically, three layers of control exist."

| Layer | What | Guarantee | Use When |
|-------|------|-----------|----------|
| **Deterministic** (Topics) | Fixed messages, structured flows, hardcoded data, Adaptive Cards | 100% | Safety-critical, must-pass-every-time behaviors |
| **Hybrid** (Instructions + Topics) | Instructions route to topics via `/TopicName` | ~95% | Important behaviors that need a fallback guarantee |
| **AI Orchestrator** (Instructions + Knowledge) | Generative responses grounded in knowledge + tools | ~85-90% | Standard Q&A, tool calling, low-risk interactions |

### Decision Rule: Eval Threshold → Architecture Layer
- **100% pass required** (safety evals) → Deterministic: dedicated topic with fixed content
- **85-90% pass** (functional/integration) → Hybrid: instructions + `/TopicName` reference
- **70-85% pass** (quality/regression) → AI Orchestrator: instructions + knowledge

### Instructions vs Topics Decision Matrix

| Behavior | Instructions | Topic | Why |
|----------|:-----------:|:-----:|-----|
| Response tone, format, guardrails | YES | no | Instructions shape AI generation |
| Tool/knowledge disambiguation | YES (via `/` refs) | no | Instructions guide orchestrator |
| Workflow sequencing (autonomous) | YES (numbered steps) | no | Instructions define tool order |
| Safety-critical decline/refuse | Support | **YES** | Topic with fixed SendMessage = 100% guarantee |
| Structured data collection (forms) | no | **YES** | AdaptiveCardPrompt requires topic node |
| UI elements (buttons, cards, images) | no | **YES** | Instructions cannot trigger Adaptive Cards |
| Escalation contacts | Route via `/Topic` | **YES** | Contacts in knowledge + dedicated topic, never instructions |
| MCP server invocation | **YES** (orchestrator only) | no | Topics CANNOT call MCP servers (ar-001) |
| Greeting / welcome | no | **YES** (system) | Conversation Start topic or Suggested Prompts |
| Fallback customization | no | **YES** (system) | Edit Fallback system topic |
| JIT initialization (user context) | no | **YES** (OnActivity) | Load variables at first message |

### Topics Extraction Checklist

Before finalizing instructions, ask: **"What here should be a topic instead?"** This is the single most effective way to keep instructions concise and reliable.

| Content in Instructions | Should Be a Topic? | Why |
|------------------------|-------------------|-----|
| Any behavior needing 100% reliability | **Yes** | Instructions provide ~90%; topics provide 100% via fixed messages |
| Structured data collection (forms, multi-field input) | **Yes** | Requires AdaptiveCardPrompt nodes — instructions can't do this |
| Any UI elements (buttons, cards, images) | **Yes** | Instructions cannot trigger Adaptive Cards |
| If/then branching with exact wording requirements | **Yes** | Topic nodes guarantee exact text; instructions approximate |
| Any single workflow description over 500 chars | **Consider** | Extract to topic, reference via `/TopicName` in instructions |
| Repetitive response templates | **Consider** | Fixed templates are more reliable as topic SendMessage nodes |
| Escalation paths with specific contacts | **Yes** | Safety data must be in topics + knowledge, not instructions |

**Goal:** Instructions handle **persona + guardrails + format**. Topics handle **deterministic flows**. Knowledge handles **data**. Each layer does what it does best.

**Process:**
1. Write initial instructions covering all MVP capabilities
2. Walk through the checklist above — move qualifying content to topic recommendations
3. Replace extracted content with `/TopicName` references
4. Verify remaining instructions are under the char budget target

### Minimum Recommended Topics for Every Generative Agent

Even with generative orchestration, these topics should be present:

| Topic | Type | Trigger | Purpose |
|-------|------|---------|---------|
| **Greeting** | System (customize) | OnConversationStart | Welcome + capabilities intro. Turn OFF for Teams if Suggested Prompts are preferred. |
| **Fallback** | System (customize) | OnUnknownIntent | Agent-specific "I can't help with that" — NOT the generic default |
| **Escalation** | System (customize) | OnEscalate | Real escalation path, not default "I can't help" |
| **Decline topics** (1 per hard boundary) | Custom | agent-chooses / phrases | Fixed decline for safety-eval boundaries. 1 topic per distinct decline path. |

**Optional but recommended:**
- **Conversation Init** (OnActivity + guard) — JIT user context, glossary, variables
- **Citation Removal** (OnGeneratedResponse) — strip `[1][2]` markers if unwanted
- **Knowledge Routing** (OnKnowledgeRequested) — for agents with 25+ knowledge sources

### Scope/Phase Scoping in Instructions

When an agent has capabilities marked `future`, add an explicit **Scope** section near the top of instructions:

```
## Scope
This is the MVP version. You can [list what's available].
[Feature X] and [Feature Y] are planned for a future release.
```

This prevents the model from improvising unavailable features. GPT-5.x especially will attempt to fulfill requests that sound like capabilities unless explicitly told they don't exist yet.

### Escalation Contact Pattern
Escalation contacts (emails, phones, URLs) should NEVER be hardcoded in agent instructions.

| Data | Where | Why |
|------|-------|-----|
| Specific contacts (email, phone, URL) | Knowledge source (document/page) | Retrieved with citations, independently updatable |
| Safety-critical contacts | Topic SendActivity nodes | Guaranteed delivery regardless of knowledge retrieval |
| Routing hint | Instructions via `/TopicName` | Points AI to the right topic for escalation scenarios |

### Source Tagging in Responses

When an agent has multiple data sources (CRM, web, knowledge), instructions should specify citation style:

```
Tag each finding's source: [Salesforce], [Web], [Knowledge], or [General].
Use [General] only when CRM and web evidence is unavailable.
When sources conflict, note the discrepancy and recommend verification.
```

This helps sellers (and eval graders) verify information origin.

### Discoverability by Channel

| Channel | Primary Mechanism | Secondary |
|---------|------------------|-----------|
| **M365 Copilot** | Suggested Prompts (welcome page) | Follow-up questions in instructions |
| **Teams** | Suggested Prompts (turn OFF Conversation Start) | Greeting topic if both are needed |
| **Web Chat** | Conversation Start topic with greeting | Adaptive Card with capability buttons |
| **Multi-channel** | Conversation Start topic (universal) + Suggested Prompts (Teams/M365) | Follow-up questions |

Source: [MS Learn - Apply generative orchestration capabilities](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration), [MS Learn - Configure suggested prompts](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-starter-prompts)

## Updating via API

Instructions stored as `botcomponent` type 15 in Dataverse:
```
-- Only PATCH existing instructions (never POST new ones — see build-methods.md bm-002)
PATCH /api/data/v9.2/botcomponents(<id>)
{ "content": "new instructions JSON" }

-- Then publish
pac copilot publish --bot <bot-id>
```
Changes are draft-only until published.

## Security: Trigger Payload Jailbreak Protection

Autonomous agents with triggers are vulnerable to jailbreak via trigger payloads (attacker sends instructions in the payload). Protect by adding to instructions:
- Limit what tools the agent should use after checking knowledge sources
- Limit what parameters the agent should use for tools (e.g., only email specified recipients)
- If content filtering blocks normal behavior, update instructions to indicate the behavior is expected

## Rich Text Email Pattern

For agents that send emails via Power Automate / Outlook connector:
```
Send emails using rich text formatting for the email body content.
```
Add this in both agent instructions AND in the tool description for emphasis.

## Debugging Instructions

If agent stops responding or gives unexpected results:
1. **Remove ALL instructions** and test — does basic Q&A work?
2. **Add back one section at a time**, testing between each
3. **Check topic descriptions** — routing issues are usually description problems, not instruction problems
4. **Verify "Use general knowledge" setting** — OFF suppresses follow-ups
5. **Check for the 2000-char bug** — if instructions save but agent ignores them, re-check actual saved length
