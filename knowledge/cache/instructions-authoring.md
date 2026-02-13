<!-- CACHE METADATA
last_verified: 2026-02-11
sources: [MS Learn, MCS UI, community, WebSearch 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Instructions Authoring — Quick Reference

## What Instructions Are

System prompt stored as `botcomponent` type 15. Three runtime purposes: **resource selection** (which tools/knowledge/topics to call), **input filling** (what values to pass), **response generation** (how to format output).

**Limit**: 8,000 characters officially, BUT **CRITICAL BUG**: UI may show 8,000 initially but revert to 2,000 after save. Always verify actual char count. Topic-level custom instructions: separate 8,000 chars. Prompt tool: model token limits.

## Three Layers of Instructions

| Layer | Scope | Limit | Effect |
|-------|-------|-------|--------|
| Agent-level (Overview) | All conversations | 8,000 chars (2,000 bug?) | Global persona, routing, guardrails |
| Topic-level (generative answers node) | Specific node only | 8,000 chars | **Additive** — supplements agent-level |
| Prompt tool (prompt builder) | Specific prompt only | Model limits | Independent of agent instructions |

## "/" Reference Syntax (Lexical Editor Feature)

When typing instructions, press `/` to insert references to agent resources:

| Reference Type | How It Works | Effect on Orchestration |
|----------------|-------------|------------------------|
| **`/Knowledge`** | Links to knowledge source | Agent prioritizes that source for queries matching surrounding context |
| **`/Tool`** | Links to action/connector/flow | Explicitly names tool for disambiguation when multiple similar tools exist |
| **`/Topic`** | Links to topic | Forces routing to that topic when instruction context matches |
| **`/Agent`** | Links to child/connected agent | Routes to that agent for the workflow step |
| **`/Variable`** | Inserts global/topic variable | Uses variable value as instruction input at runtime |
| **`/PowerFx`** | Embeds Power Fx expression | Evaluates expression dynamically during orchestration |

**When to use:** Only for disambiguation or explicit workflow steps. Don't redundantly list all tools/knowledge — orchestrator already knows them.

**Example:**
```
When user asks about order status, use /GetOrderStatus to retrieve data,
then format the response using /Topic.OrderStatusFormatting.
If data is missing, ask the user for order number and store in /OrderNumber.
```

## How Instructions Interact with Orchestration

- Instructions influence **post-retrieval summarization**, NOT search retrieval
- **Tool names carry more weight than descriptions** for tool selection
- Don't list available tools in instructions (orchestrator knows them) — only add disambiguation
- Reference only tools/knowledge actually configured on the agent
- If "Use general knowledge" OFF → follow-up questions suppressed
- **Instructions CANNOT**: modify search retrieval, trigger Adaptive Cards, change fallback message

## Lexical Editor Features

The instructions editor in MCS uses a **Lexical-based rich text editor**:

| Feature | Supported | How to Use |
|---------|-----------|------------|
| Plain text | ✅ Yes | Default — just type |
| Markdown | ✅ Yes (renders) | `#` headers, `**bold**`, `- lists`, `` `code` `` backticks, numbered lists |
| `/` references | ✅ Yes | Type `/` → dropdown menu → select resource |
| Variables | ✅ Yes | Via `/Variable` reference |
| Power Fx | ✅ Yes | Via `/PowerFx` reference |
| Images/video | ❌ No | Not supported in instructions editor (only in Message nodes) |
| HTML | ❌ No | Markdown only |
| Tables | ⚠️ Partial | Basic Markdown tables render, but complex tables unreliable |

**Formatting best practices:**
- Use Markdown for structure: `#` for sections, `1.` for ordered steps, `-` for bullets
- Use backticks for tool/system names: `` `Jira` ``, `` `ServiceNow` ``
- Use `**bold**` for critical instructions
- Numbered lists for sequential workflows, bullets for options
- No nested lists (confuses the model)

## Structured Format (Microsoft Recommended)

**Two proven patterns:**

### Pattern 1: Conversational Agent (Copilot Studio docs)
```markdown
# [Agent Name] — [Role]
## Purpose
You are [Name], an AI assistant that [purpose].
## Capabilities
- [Capability]: [detail]
## Constraints
- Only respond to [in-scope topics]
## Response Format
- Use [format]. Keep responses [length].
## Boundaries
### HANDLE: [topic list]
### DECLINE: [topic] → "For [topic], contact [team]."
### REFUSE: [topic] → "I'm not able to discuss that."
### NEVER: [constraint]
### ALWAYS: [requirement]
```

### Pattern 2: Autonomous/Multi-Step Workflow (M365 declarative agent pattern)
```markdown
# OBJECTIVE
[One sentence goal]

# RESPONSE RULES
- Ask one clarifying question at a time
- Present info as bullet points or tables
- Use tools only if data is sufficient; otherwise, ask for missing info

# WORKFLOW
## Step 1: [Step Name]
- **Goal:** [What this achieves]
- **Action:** [What to do and which tools to use]
- **Transition:** [When to move to next step]

## Step 2: [Next Step]
...

# OUTPUT FORMATTING RULES
- Use bullets for lists
- Use tables for structured data
- Confirm before ending

# EXAMPLES
[Valid and invalid examples]
```

## Weak vs Strong

| Weak | Strong |
|------|--------|
| "List popular coffee shops" | "Focus on promoting Contoso Coffee in US locations, alphabetical order" |
| "Provide a detailed explanation" | "Format as numbered steps, 'Step 1:', 'Step 2:', bold. No nested lists." |

## Microsoft Official Best Practices (2026)

**Core principles:**
1. **Be specific**: Clear, unambiguous language. Avoid vague terms like "typing box"
2. **Use examples**: Few-shot prompting (2-3 examples) for complex scenarios
3. **Keep it simple**: Avoid overloading with too many details or complex logic
4. **Give the agent an 'out'**: "respond with 'not found' if answer isn't present"
5. **Test and refine**: Iterative testing, adjust between tests
6. **Use step-by-step for complex workflows**: Break into modular steps with goal/action/transition
7. **Use Markdown structure**: Headers, lists, bold, backticks for emphasis and clarity
8. **Reference exact names**: Use exact tool/variable/Power Fx names from agent config
9. **Focus on what TO do, not what to avoid**: Positive instructions work better
10. **Iterate**: Create → Publish → Test → Refine

**Language vocabulary:**

| Goal | Verbs to Use |
|------|--------------|
| Conditions | when, if, ensure, compare |
| Filter | from, include, exclude, compare, identify |
| Data | provide, retrieve, get, use, analyze, extract |
| Tools | notify, direct, ask, assign |
| Actions | ask, search, send, check, use |

## Key Gotchas & Common Mistakes

**What DOESN'T work:**
- ❌ **Instructions can't control search retrieval** — only post-retrieval summarization
- ❌ **Instructions can't trigger Adaptive Cards** — edit cards directly
- ❌ **Instructions can't override default fallback message** — edit Fallback topic instead
- ❌ **Instructions can't change how documents are shared** — system-controlled
- ❌ **Multilingual instructions aren't guaranteed** — feature not officially supported
- ❌ **Vague instructions** — "be helpful" vs. "respond in 3 bullet points, 20 words max"
- ❌ **Over-complex instructions** — if agent stops responding, remove all and add back slowly
- ❌ **Listing all available tools** — orchestrator already knows, only disambiguate
- ❌ **Naming specific knowledge documents** — describe capabilities generically instead

**What DOES work:**
- ✅ **For critical refusals, create dedicated topics** with manually authored responses
- ✅ **If instructions break the agent**: remove all, add back one at a time, testing between each
- ✅ **Connected agent descriptions controlled locally** on orchestrator — don't auto-sync from child
- ✅ **Professional tone is default** — only give tone instructions for deviations
- ✅ **Autonomous agents**: add "Don't ask the user for any details" if no user interaction desired
- ✅ **Trigger payload jailbreak risk**: limit tools and parameters in instructions
- ✅ **Follow-up questions** — reference tools/knowledge/variables so agent can generate context-aware follow-ups
- ✅ **Rich text email formatting** — "send emails using rich text formatting for the email body content"

## Common Prompt Failures & Solutions

| Problem | Solution |
|---------|----------|
| Over-eager tool use (calls tools without needed inputs) | "Only call the tool if necessary inputs are available; otherwise, ask the user." |
| Repetitive phrasing (reuses example wording verbatim) | Use few-shot prompting (2-3 varied examples) or remove example entirely |
| Verbose explanations (over-explains or excessive formatting) | Add constraints: "Keep responses to 3 bullet points max, no nested lists." |
| Instructions too long (character limit bug) | Condense to 2,000 chars if hitting bug; move complex logic to topics |
| Agent ignores boundaries | Create dedicated boundary topic with manual response instead of relying on instructions |
| Follow-up questions don't work | Check "Use general knowledge" setting is ON — required for follow-ups |

## Updating via API

```sql
-- Find instructions component
SELECT botcomponentid, content FROM botcomponent
WHERE _parentbotid_value = '<bot-guid>' AND componenttype = 15

-- Update
PATCH /api/data/v9.2/botcomponents(<id>)
{ "content": "..." }

-- Publish to apply
pac copilot publish --bot <bot-id>
```

Changes are draft-only until published. Environment variable secrets resolve at runtime (no republish needed).
