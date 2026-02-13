# Knowledge System

4-layer knowledge architecture for MCS automation. Combines **official docs** (what's available), **experience** (what works), **stable patterns** (how to do it), and **decision frameworks** (how to choose).

## Architecture

```
Layer 1: knowledge/cache/      — Official MCS capabilities, refreshed from MS Learn + WebSearch (REFRESHABLE)
Layer 2: knowledge/learnings/   — Experience from past builds, user feedback, failures (GROWS OVER TIME)
Layer 3: knowledge/patterns/    — Stable HOW-TO references: YAML, Playwright, Dataverse (STABLE)
Layer 4: knowledge/frameworks/  — Decision logic: component selection, architecture scoring (STABLE)
```

**Lookup order during research**: Cache (what's available) + Learnings (what's worked) → if stale or missing → live research → update cache/learnings

## Directory Structure

```
knowledge/
├── README.md                    # This file
├── learnings/                   # Experience-based insights (grows with each build)
│   ├── connectors.md            # Connector experiences (what worked, what didn't)
│   ├── architecture.md          # Architecture decisions and outcomes
│   ├── instructions.md          # Instruction writing patterns
│   ├── integrations.md          # System integration lessons (auth, custom connectors)
│   ├── topics-triggers.md       # Topic/trigger patterns
│   ├── eval-testing.md          # Eval method insights, thresholds, scoring
│   ├── build-methods.md         # Build execution lessons (API vs Playwright)
│   └── customer-patterns.md     # Industry/customer-type patterns
├── cache/                       # Refreshable inventories (each file has metadata header)
│   ├── triggers.md              # Topic trigger types, YAML kinds
│   ├── models.md                # Available LLM models in MCS
│   ├── mcp-servers.md           # Built-in MCP servers
│   ├── connectors.md            # Key Power Platform connectors
│   ├── knowledge-sources.md     # Knowledge source types + file limits
│   ├── channels.md              # Deployment channels
│   ├── api-capabilities.md      # What each API layer can do
│   ├── eval-methods.md          # Test method types for evaluations
│   ├── generative-orchestration.md  # Orchestration modes, topic routing
│   ├── security-auth.md         # Auth modes, SSO, OAuth, DLP
│   ├── instructions-authoring.md    # Instructions best practices, limits
│   ├── powerfx-variables.md     # PowerFx functions, variable scopes
│   ├── agent-lifecycle.md       # Creation methods, publishing, ALM
│   ├── power-automate-integration.md  # Flows as tools, event triggers
│   ├── adaptive-cards.md        # Card schema, PowerFx binding
│   ├── ai-tools-computer-use.md # AI Builder, prompt actions, Computer Use
│   ├── limits-licensing.md      # Message limits, quotas, licensing
│   └── conversation-design.md   # Design patterns, entity types, escalation
├── patterns/                    # Stable HOW-TO patterns
│   ├── yaml-reference.md        # YAML syntax rules, node types, variable scopes
│   ├── playwright-patterns.md   # MCS UI automation patterns
│   ├── dataverse-patterns.md    # API call patterns
│   └── topic-patterns/          # Reusable YAML templates
└── frameworks/                  # Decision frameworks
    ├── component-selection.md   # How to evaluate and choose components
    ├── architecture-scoring.md  # Single vs multi-agent scoring
    └── tool-priority.md         # API-first decision flow
```

## Cache Files

### Format

Every file in `cache/` has this metadata header:

```markdown
<!-- CACHE METADATA
last_verified: YYYY-MM-DD
sources: [list of sources used]
confidence: high | medium | low
refresh_trigger: before_architecture | weekly | on_error
-->
```

### Tiers

| Tier | Files | Refresh |
|------|-------|---------|
| **1 (build-critical)** | triggers, models, mcp-servers, connectors, knowledge-sources, channels | Auto at session start if > 7 days |
| **2 (build-phase)** | api-capabilities, instructions-authoring, generative-orchestration, adaptive-cards, ai-tools-computer-use, power-automate-integration | Before `/mcs-build` if stale |
| **3 (reference)** | eval-methods, security-auth, agent-lifecycle, limits-licensing, powerfx-variables, conversation-design | On demand via `/mcs-refresh` |

### Freshness Rules

| Age | Action |
|-----|--------|
| < 7 days | Use as-is |
| 7-30 days | Tier 1: auto-refresh. Tier 2-3: flag, refresh on demand |
| > 30 days | Refresh immediately regardless of tier |

### Refresh Protocol

Run `/mcs-refresh` to update cache files:
- `/mcs-refresh` — refresh all stale files (> 7 days)
- `/mcs-refresh triggers` — refresh just triggers.md
- `/mcs-refresh all` — force refresh everything

Per-file refresh:
1. Read current cache file
2. MS Learn MCP search for official docs
3. WebSearch for "[topic] Copilot Studio [current year]"
4. Compare findings to cached content
5. Update file with new content + `last_verified: today`
6. Report what changed

## Learnings Files

### How They're Populated

Learnings are captured at the end of each workflow phase:

| Phase | Capture Point | What's Captured |
|-------|--------------|-----------------|
| `/mcs-research` | Post-research summary | New discoveries, cache corrections, customer patterns |
| `/mcs-build` | Post-build summary | Spec vs actual diff, errors & fixes, build method insights |
| `/mcs-eval` | Post-eval summary | Failure patterns, scoring insights, test design lessons |

Each summary is **presented to the user for confirmation** before being written to topic files. The user can edit, add context, or skip.

### How They're Retrieved

During `/mcs-research` Phase B (component research), relevant learnings files are read alongside cache files:

> "Official docs recommend X. However, in a past build for [customer], we found Y works better because [reason] (confirmed in 3 builds). Consider both options."

Learnings are **options, not defaults**. Higher `Confirmed` count = higher weight, but the user always decides.

### Entry Format

```markdown
### [Title] — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s)
**Tags:** #tag1 #tag2
```

When the same insight is confirmed in another build, bump `Confirmed` count — don't create a duplicate entry.
