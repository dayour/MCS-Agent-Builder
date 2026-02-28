<!-- CACHE METADATA
last_verified: 2026-02-26
sources: [MS Learn authoring-instructions, MS Learn generative-mode-guidance, MS Learn create-edit-topics, MS Learn advanced-generative-actions, MCS UI, community blogs]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Instructions Authoring — Quick Reference

## What Instructions Do (Three Purposes)

1. **Resource selection** — which tools/knowledge/topics to call
2. **Input filling** — what values to pass to tools
3. **Response generation** — how to format output for the user

## Routing Priority (Most to Least Important)

| Priority | What | Implication |
|----------|------|-------------|
| 1 | **Tool/topic/knowledge DESCRIPTIONS** | Write excellent descriptions FIRST — they matter most |
| 2 | **Tool/topic/knowledge NAMES** | Use clear, descriptive names |
| 3 | **Input/output parameters** | Well-named parameters help routing |
| 4 | **Agent instructions** | Instructions are LEAST important for routing |

**Key insight:** Instructions influence *response generation* and *disambiguation* more than routing. If routing is wrong, fix topic descriptions first, not instructions.

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

## Best Practices Checklist

### Structure
- [ ] Uses three-part structure: Constraints + Response Format + Guidance
- [ ] Markdown formatting: `#` headers, `1.` ordered steps, `-` bullets, `**bold**`
- [ ] No nested lists
- [ ] Under 8,000 chars (under 2,000 if hitting the save bug)
- [ ] Audience explicitly stated ("for CDW coworkers", "for IT support engineers")

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

Microsoft recommends a three-layer design for agent behavior:

| Layer | What | Guarantee | Use When |
|-------|------|-----------|----------|
| **Deterministic** (Topics) | Fixed messages, structured flows, hardcoded data | 100% | Safety-critical, must-pass-every-time behaviors |
| **Hybrid** (Instructions + Topics) | Instructions route to topics via `/TopicName` | ~95% | Important behaviors that need a fallback guarantee |
| **AI Orchestrator** (Instructions + Knowledge) | Generative responses grounded in knowledge | ~90% | Standard Q&A, low-risk interactions |

### Decision Rule: Eval Threshold → Architecture Layer
- **100% pass required** (safety evals) → Deterministic: dedicated topic with fixed content
- **85-90% pass** (functional/integration) → Hybrid: instructions + `/TopicName` reference
- **70-85% pass** (quality/regression) → AI Orchestrator: instructions + knowledge

### Escalation Contact Pattern
Escalation contacts (emails, phones, URLs) should NEVER be hardcoded in agent instructions.

| Data | Where | Why |
|------|-------|-----|
| Specific contacts (email, phone, URL) | Knowledge source (document/page) | Retrieved with citations, independently updatable |
| Safety-critical contacts | Topic SendActivity nodes | Guaranteed delivery regardless of knowledge retrieval |
| Routing hint | Instructions via `/TopicName` | Points AI to the right topic for escalation scenarios |

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
