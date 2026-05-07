# Upstream Repo Deep Dive — 2026-04-14

> Cross-repo analysis of ObjectModel (ADO), bap-microsoft/Elevate (GitHub), microsoft/eval-guide (GitHub).  
> Goal: identify leverage/improvement opportunities for MCS end-to-end automation.

## Executive Summary

Three repos analyzed at current HEAD. 23 actionable findings scored across 4 priority tiers. Top 5 immediate-impact items:

1. **Maker Evals integration** — ObjectModel has full TestCaseComponent + EvaluationSet + Graders + EvaluationRunDefinition schema. We can store eval test cases as native MCS components (discriminator 19) and run evals via platform APIs.
2. **CA-to-DA converter** — ObjectModel has GptDefinitionTranslator that converts CA agents to DA manifest format. We should wrap this as a CLI command for agent publishing to M365 Copilot.
3. **Domain-driven architecture** — Elevate refactored to 3 domains (agent/dw/workflow) with eslint boundaries. Our frontend should adopt this before it grows further.
4. **eval-guide dashboards** — Plugin has interactive HTML dashboards (Stage 0-4) with zero-dependency local server. We should integrate these into our `/mcs-eval` workflow.
5. **AgentSkillComponent** — New component type (discriminator 21) for maker-authored skills with SkillResource. Enables programmatic skill creation.

---

## Repo Status (Commit Pins)

| Repo | Access | HEAD | Our Sync | Drift |
|------|--------|------|----------|-------|
| ObjectModel (ADO) | Local ADO clone | 17c6a23bf (AgentSkillComponent) | 17c6a23bf | **Synced** |
| Elevate (GitHub) | `elevate` remote | 4b885960 (evaluate-phase-1) | 4b885960 | **Synced** (pin matches) |
| eval-guide (GitHub) | Plugin v1.0.0 | v1.0.0 | v1.0.0 | **Synced** |

---

## ObjectModel Findings

### New Component Types (All in our schema, not yet leveraged in code)

| Type | Discriminator | Purpose | Leverage Opportunity |
|------|--------------|---------|---------------------|
| **TestCaseComponent** | 19 | Store eval test cases as YAML in botcomponents | Write eval sets to Dataverse as native MCS test components |
| **CustomMetricDefinitionComponent** | 20 | Custom analytics metrics with categories | Define custom scoring rubrics as platform components |
| **AgentSkillComponent** | 21 | Maker-authored skills with SkillResource | Programmatic skill creation (inline or reference) |

### New Action Types

| Type | Schema | Purpose | Impact |
|------|--------|---------|--------|
| **InvokeMcpToolAction** | Bot+Foundry | MCP tool invocation with server resolution | Schema supports MCP tool references; runtime requires generative orchestration (not direct topic invocation yet) |
| **McpServerTool** | Foundry | Register MCP servers as TaskAction tools | Foundry agents get native MCP support; CA agents use generative orchestration |
| **OpenApiTool** | Foundry | Register OpenAPI specs as TaskAction tools | Foundry agents get native OpenAPI support |
| **InvokeSkillAction** | Bot | Invoke agent skills by SchemaName+ActionId | Skill orchestration in topics |

### Maker Evals (Full Schema)

```
TestCaseComponent → TestDefinitionBase
  ├── TestSetDefinition (grouping)
  ├── TestCaseDefinition (individual case)
  │   └── TestTranscriptDefinition
  │       └── TestActivityDefinition[]
  │           ├── SendUserActivity (with ActivityAssertions)
  │           │   ├── RelevanceAssertion
  │           │   ├── AbstentionAssertion
  │           │   ├── CompletenessAssertion
  │           │   └── GroundednessAssertion
  │           └── TestActivitySourceType (Manual|Generated|Edited|Imported|AnalyticsTheme)
  └── EvaluationDefinitionBase
      ├── EvaluationRunDefinition (target + evalSetRef)
      │   └── EvaluationTargetBase
      │       ├── AgentEvaluationTarget (agent SchemaName)
      │       ├── PromptEvaluationTarget (AI Model ID)
      │       └── FlowEvaluationTarget (Flow ID)
      └── EvaluationSet (graders collection)
          └── GraderBase (abstract — Custom metrics etc.)
```

Key: Eval assertions map 1:1 to General Quality sub-dimensions (Relevance, Groundedness, Completeness, Abstention).

### CA-to-DA Converter

- **GptDefinitionTranslator** — Converts BotDefinition → ExecutableGptDefinition (DA manifest)
- Handles: capabilities, behavior overrides, default response modes, topic actions, plugins
- Maps: `ThinkDeeperManifestValue`, `QuickResponseManifestValue` response modes
- Excludes: OnRedirect topics from conversion
- **SideLoadDeclarativeAgentConverter** — Package CA as side-loadable DA
- **DeclarativeAgentPackageConverter** — Full DA package generation

### VS Code Extension Capabilities (Not Leveraged)

- PAC Pull/Push integration for agents
- Knowledge file update/diff operations
- Environment variable Clone/Pull/Push/Diff
- Workspace detection and reattachment
- Progressive tree loading for clone
- Language Server Protocol for YAML intellisense

### Other Notable Additions

- **SensitivityLevel propagation** from ExternalEntityReference to variables
- **Sentiment analysis** bot configuration setting
- **Realtime voice** model configuration for voice agents
- **DTMF buffering** improvements for telephony
- **New languages** added to locale support
- **PowerFx expression reversal bug** fixed

---

## Elevate Findings

### Architecture (Critical — Just Refactored)

**DW = Digital Worker = AI Teammate** — New agent archetype with M365 identity (email, Teams presence, shared files). Microsoft's next-gen agent model. Elevate supports 3 agent types: CA/DA, DW, Workflow.

**Domain-Driven Structure:**
```
src/domains/
├── agent/     (CA/DA agents)
├── dw/        (Digital Workers / AI Teammates)
└── workflow/  (Workflow automation)
src/components/
├── ui/        (55+ shared Copilot-branded components)
├── shared/    (cross-domain utilities)
├── nav/       (navigation infrastructure)
└── workflow/  (shared workflow components)
src/context/
├── AgentContext.tsx        (root state — shrinking)
├── FeatureToggleContext.tsx (70+ toggles, extracted)
├── DWContext.tsx           (~400 LOC, extracted)
└── WorkflowContext.tsx     (workflow state, extracted)
```

**Boundary Enforcement:** `eslint-plugin-boundaries` with `default: disallow` + explicit allow rules. Currently WARN, upgrading to ERROR.

### Key Patterns We Should Adopt

| Pattern | What | Why | Effort |
|---------|------|-----|--------|
| **BuildPageDispatcher** | Routes to AgentBuildPage / DWBuildPage / WorkflowBuildPage | Single entry point for type-specific builds | Medium |
| **HelperAgent strategies** | Pure TS interfaces per agent type (no React dependency) | Testable, explicit behavior differences | Low |
| **FeatureToggleContext** | 70+ toggles organized by feature area, localStorage + URL params | Environment-aware feature gating | Medium |
| **Context splitting** | AgentContext → 4 contexts (Feature, DW, Workflow, Agent) | Prevents 5000+ LOC monolith | High |
| **eslint-plugin-boundaries** | Domain boundary enforcement at lint time | Architecture decay prevention | Low |
| **Domain file structure** | src/domains/{agent,dw,workflow}/pages,utils,context | Clear ownership boundaries | Medium |

### New Features We Don't Have

| Feature | Description | Impact |
|---------|-------------|--------|
| **Project Mode** | Canvas-based multi-artifact AI system designer (agents + workflows from NL) | High — enables system-level design |
| **Workflow Evaluate** | 3-column grader layout, timeline, publish detection | High — visual eval results |
| **DW/AI Teammate support** | Dexter provisioning, Day-0 welcome, M365 identity | Medium — new agent type |
| **Storybook POC** | Component documentation (branch exists) | Low — nice to have |
| **Skill creation in DWKnowledgeTab** | Inline skill authoring in build page | Medium |
| **EnhancedInputSuggestionList** | Replaces SingleSelectCard/MultiSelectCard | Low |

### Active Branches to Watch

| Branch | Feature | Relevance |
|--------|---------|-----------|
| BUILD26-ACTIVITY | Activity tracking | Medium |
| BUILD26-WORKIQ-layout | Work IQ layout changes | High |
| BUILD26-ha-skill-* | Helper Agent skill features | High |
| feature/evaluate-phase-2 | V3 evaluation UI | High |
| feat/project-mode-2 | Canvas designer v2 | Medium |
| storybook-poc | Component docs | Low |

---

## eval-guide Findings

### New Capabilities Beyond Our Current Integration

| Capability | In eval-guide | In Our Pipeline | Gap |
|------------|---------------|-----------------|-----|
| **Interactive HTML dashboards** | Stage 0-4 with localStorage | None | **HIGH** — visual review |
| **eval-runner.js** | DirectLine test runner in plugin | direct-line-test.js (similar) | LOW — redundant |
| **Stage 0 Discover** | Agent vision dashboard before planning | Skip to planning | MEDIUM |
| **Conversation (multi-turn) blueprints** | Structured multi-turn test format | evaluateMultiTurn() exists | MEDIUM — format alignment |
| **Custom eval method** | Eval instructions + labeled outcomes | Not in CSV runner | MEDIUM |
| **5-question eval verification** | Pre-triage check before classifying failures | Not automated | **HIGH** — reduces false negatives |
| **Architecture-aware scoping** | Auto-adjusts by Prompt/RAG/Agentic | Manual | MEDIUM |
| **Version comparison** | Before/after delta analysis with 4 buckets | Not implemented | MEDIUM |
| **Set-level grading** | Holistic quality assessment (Copilot Studio Kit) | Not implemented | LOW |
| **Production data (Themes)** | Test sets from Analytics clustering | Not implemented | LOW |

### Methodology Gaps

| Our Implementation | eval-guide Methodology | Action Needed |
|-------------------|------------------------|---------------|
| 3 risk profiles | 4 risk profiles (add safety-critical) | Add safety-critical tier |
| 1 eval run | 3 runs minimum (non-determinism) | Add retry logic |
| No eval verification | 5-question verification (20%+ failures are grader bugs) | Automate pre-triage |
| Pass/fail only | Set-level + case-level grading | Future consideration |
| No regression vs capability distinction | Two eval types with different success metrics | Add eval type tagging |
| No instruction budget detection | Cross-signal pattern: one signal improves, another degrades | Add delta analysis |

### eval-runner.js vs direct-line-test.js

Both are DirectLine API test runners. eval-guide's is simpler (scoring via LLM judge only). Ours is more feature-rich (7 methods, dual heuristic+GPT scoring, multi-turn, tool extraction, interactive OAuth). **No action needed** — our runner is superior.

---

## Scoring Rubric & Prioritized Recommendations

**Rubric:** Each finding scored 1-5 on four dimensions:
- **User Value** — Direct impact on end-to-end automation capability (higher = more valuable)
- **Implementation Ease** — 1=weeks of work, 2=days, 3=hours, 4=config-only, 5=already done (higher = easier)
- **Security Safety** — 5=no new attack surface, 1=significant new exposure (higher = safer)
- **Confidence** — How certain we are this works (5=production-tested, 1=experimental)

**Score = (UserValue × 2) + Effort + Security + Confidence** (max 30)

### Tier 1: Do Now (Score 20+)

| # | Recommendation | Source | UV | Ease | Safe | Con | Score | Notes |
|---|---------------|--------|:--:|:----:|:----:|:---:|:-----:|-------|
| 1 | **Add 5-question eval verification** — Automate pre-triage check in eval-scoring.js before classifying failures as agent issues. | eval-guide | 5 | 3 | 5 | 5 | 23 | 20%+ of failures are grader bugs, not agent bugs |
| 2 | **Integrate Maker Evals schema** — Write evalSets as TestCaseComponents (discriminator 19) via Dataverse/LSP. Use EvaluationRunDefinition to trigger platform evals. | ObjectModel | 5 | 3 | 5 | 4 | 22 | Complements our Direct Line runner with native platform eval |
| 3 | **Adopt domain-driven file structure** — Create src/domains/ with agent + workflow folders, move pages/utils/context. Add eslint-plugin-boundaries. | Elevate | 5 | 2 | 5 | 5 | 22 | Foundation before frontend grows more |
| 4 | **Integrate eval-guide dashboards** — Serve Stage 1-4 HTML dashboards during /mcs-eval and /mcs-fix for visual review. | eval-guide | 4 | 3 | 5 | 5 | 21 | Zero dependencies, immediate UX improvement |
| 5 | **Wrap CA-to-DA converter as CLI** — Expose GptDefinitionTranslator via om-cli or Node wrapper for agent publishing. | ObjectModel | 5 | 2 | 4 | 4 | 20 | Critical for M365 Copilot publishing path |
| 6 | **Split AgentContext** — Extract FeatureToggleContext first, then domain-specific state. | Elevate | 4 | 2 | 5 | 5 | 20 | Prevents context monolith |
| 7 | **Build multi-run eval with non-determinism detection** — Run evals 3x, report variance, use median for verdicts. | eval-guide | 4 | 2 | 5 | 5 | 20 | +/-5% variance is normal; current 1-run misses it |

### Tier 2: Do Soon (Score 17-19)

| # | Recommendation | Source | UV | Ease | Safe | Con | Score | Notes |
|---|---------------|--------|:--:|:----:|:----:|:---:|:-----:|-------|
| 8 | **Add AgentSkillComponent support** — Use discriminator 21 for programmatic skill creation (inline/reference). | ObjectModel | 4 | 3 | 4 | 4 | 19 | Enables skill automation in builds |
| 9 | **Add BuildPageDispatcher pattern** — Route build UI to type-specific pages (agent vs workflow). | Elevate | 3 | 3 | 5 | 5 | 19 | Clean separation for different build experiences |
| 10 | **Add HelperAgent strategy pattern** — Extract agent-type-specific behavior to pure TS utilities. | Elevate | 3 | 3 | 5 | 5 | 19 | Testable, explicit |
| 11 | **Add regression vs capability eval distinction** — Tag eval sets, different success metrics. | eval-guide | 3 | 3 | 5 | 5 | 19 | Better eval lifecycle |
| 12 | **Add conversation test blueprints** — Structured multi-turn format matching eval-guide spec. | eval-guide | 3 | 3 | 5 | 4 | 18 | Aligns with Copilot Studio format |
| 13 | **Add instruction budget detection** — Cross-signal pattern analysis (one improves, another degrades). | eval-guide | 3 | 2 | 5 | 5 | 18 | Prevents fix-one-break-another |
| 14 | **Add CustomMetricDefinitionComponent** — Custom scoring rubrics as platform components. | ObjectModel | 3 | 2 | 5 | 4 | 17 | Analytics improvement |

### Tier 3: Plan For (Score 13-16)

| # | Recommendation | Source | UV | Ease | Safe | Con | Score | Notes |
|---|---------------|--------|:--:|:----:|:----:|:---:|:-----:|-------|
| 15 | **Add Project Mode canvas** — Multi-artifact system designer from NL description. | Elevate | 4 | 1 | 4 | 3 | 16 | High value but high effort |
| 16 | **Implement PAC Pull/Push workflow** — Source-controlled agent sync (VS Code integration pattern). | ObjectModel | 3 | 2 | 4 | 3 | 15 | CI/CD foundation |
| 17 | **Leverage InvokeMcpToolAction schema** — Validate MCP tool definitions in YAML; runtime invocation still via generative orchestration. | ObjectModel | 3 | 2 | 4 | 3 | 15 | Schema validation, not direct topic invocation |
| 18 | **Add DW/AI Teammate support** — New agent type with M365 identity, Dexter provisioning. | Elevate | 3 | 1 | 3 | 3 | 13 | New archetype, but complex |

### Tier 4: Monitor (Score < 14)

| # | Recommendation | Source | Notes |
|---|---------------|--------|-------|
| 19 | Workflow Evaluate page (graders + timeline) | Elevate | Wait for evaluate-phase-2 |
| 20 | Storybook component docs | Elevate | Nice-to-have, low priority |
| 21 | Set-level grading | eval-guide | Requires Copilot Studio Kit |
| 22 | Themes-based test sets (Analytics) | eval-guide | Requires deployed agent with traffic |
| 23 | Custom eval method in CSV runner | eval-guide | MCS native only, wait for CSV support |

---

## Cross-Repo Synergies

### ObjectModel × eval-guide
- Maker Evals schema (TestCaseComponent, EvaluationSet, Graders) + eval-guide methodology = **native platform eval with structured methodology**
- We can: generate eval plans via eval-guide → create tests → write as TestCaseComponents → trigger EvaluationRunDefinition → interpret results via eval-guide plugin
- This is the complete eval automation loop

### ObjectModel × Elevate
- AgentSkillComponent + Elevate's DWKnowledgeTab skill creation = **programmatic skill lifecycle**
- CA-to-DA converter + Elevate's BuildPageDispatcher = **type-aware build+publish pipeline**
- InvokeMcpToolAction + Elevate's tool integration UI = **end-to-end MCP authoring**

### Elevate × eval-guide
- Elevate's Workflow Evaluate (graders, timeline) + eval-guide dashboards = **unified eval UX**
- Elevate's FeatureToggleContext + eval-guide architecture-aware scoping = **agent-type-aware eval configuration**

---

## GPT-5.4 Divergence Analysis

**GPT recommended (where I disagree):**
- "ObjectModel parity" as #1 — We're already synced at latest commit. The schema HAS the types; we need to USE them. More precise framing: "Leverage new ObjectModel types in our build pipeline."
- "Feature toggle centralization" as #9 — Good idea but not a top priority for end-to-end automation. Architecture before features.

**GPT missed:**
- 5-question eval verification (high-impact, low-effort)
- Maker Evals schema integration (platform-native eval path)
- eval-guide HTML dashboards (zero-dependency UX improvement)

**GPT aligned (where I agree):**
- CA-to-DA converter as top priority
- Domain-driven architecture from Elevate
- Eval pipeline as core competency
- MCP/Foundry tools as first-class targets

---

## Implementation Roadmap (Suggested)

### Phase A: Foundations (Week 1-2)
1. Domain-driven file structure + eslint-plugin-boundaries
2. Split AgentContext → FeatureToggleContext + domain contexts
3. Add 5-question eval verification to eval-scoring.js
4. Add multi-run eval support (3x, median, variance)

### Phase B: Platform Integration (Week 3-4)
5. Write TestCaseComponents to Dataverse via LSP/API
6. Trigger EvaluationRunDefinition via Gateway API
7. Wrap CA-to-DA converter as CLI command
8. Add AgentSkillComponent creation to build pipeline

### Phase C: UX & Polish (Week 5-6)
9. Integrate eval-guide HTML dashboards
10. BuildPageDispatcher pattern for agent vs workflow
11. HelperAgent strategy pattern extraction
12. Regression vs capability eval distinction

### Phase D: Advanced (Week 7+)
13. Project Mode canvas (multi-artifact designer)
14. CustomMetricDefinitionComponent support
15. PAC Pull/Push workflow integration
16. DW/AI Teammate support (if in scope)

---

## Files Changed / Created

None. This is a research document. All recommendations require separate implementation work.

Last updated: 2026-04-14
Reviewed by: Claude + GPT-5.4
