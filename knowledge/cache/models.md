<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn (authoring-select-agent-model, prompt-model-settings, planned-features), MCS UI snapshot, WebSearch Feb 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Available Models

## Models Available in MCS (Feb 2026)

### Model Categories

| Category | Purpose | Examples |
|----------|---------|---------|
| **General** | Everyday chat, FAQ, routing | GPT-4.1, GPT-5 Chat, Claude Sonnet 4.5 |
| **Deep** | Complex reasoning, multi-step analysis | GPT-5 Reasoning, GPT-5.2 Reasoning, Claude Opus 4.6 |
| **Auto** | Mixed workloads -- routes dynamically between general and reasoning | GPT-5 Auto |
| **Mini** | Cost-effective, moderate complexity | GPT-4.1 mini (prompt builder only) |

### Primary Agent Model Lineup (agent orchestration)

Source: [MS Learn authoring-select-agent-model](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-select-agent-model)

| Model | Category | Status | Availability | Notes |
|-------|----------|--------|-------------|-------|
| GPT-4o | General | **RETIRED** | All regions | Replaced by GPT-4.1 (Oct 2025). 1-month grace period expired. |
| **GPT-4.1** | General | **GA (Default)** | All regions | Default model for all new agents |
| **GPT-5 Chat** | General | **GA** | Europe + US natively; Preview (cross-geo) in all other regions | Standard rate |
| **GPT-5 Reasoning** | Deep | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Premium rate, 400K context |
| **GPT-5 Auto** | Auto | **Preview** | Europe + US natively; Preview (cross-geo) in all other regions | Dynamically routes between general and reasoning |
| GPT-5.2 Chat | General | **Experimental** | Europe natively; Experimental (cross-geo) in all other regions | Next-gen general |
| GPT-5.2 Reasoning | Deep | **Experimental** | Europe natively; Experimental (cross-geo) in all other regions | Next-gen reasoning |
| **Claude Sonnet 4.5** | General | **Preview** | Cross-geo (all regions) | Anthropic model, requires admin enablement |
| Claude Sonnet 4.6 | General | **Experimental** | Cross-geo (all regions) | Anthropic next-gen |
| Claude Opus 4.6 | Deep | **Experimental** | Cross-geo (all regions) | Anthropic deep reasoning |
| Grok 4.1 Fast | General | **Experimental** | **US only** | xAI model. Higher harmful content risk per MS safety eval. |

### Prompt Builder Model Lineup (AI Builder prompts in MCS / Power Apps / Power Automate)

Source: [MS Learn prompt-model-settings](https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-settings)

| Model | Category | Licensing | Context | Notes |
|-------|----------|-----------|---------|-------|
| **GPT-4.1 mini** | Mini | Basic rate | 128K | Default for prompt builder |
| **GPT-4.1** | General | Standard rate | 128K | |
| **GPT-5 chat** | General | Standard rate | 128K | GA |
| **GPT-5 reasoning** | Deep | Premium rate | 400K | GA |
| GPT-5.2 chat | General | Standard rate | 128K | Experimental, US only |
| GPT-5.2 reasoning | Deep | Premium rate | 400K | Experimental, US only |
| Claude Sonnet 4.5 | General | Standard rate | 200K | Experimental |
| Claude Opus 4.5 | Deep | Premium rate | 200K | Experimental |

**Retired models (prompt builder):** Claude Opus 4.1 (retired Feb 2026, replaced by Claude Opus 4.5), o3 (retired Dec 2025, replaced by GPT-5 reasoning), GPT-4o mini/GPT-4o (retired Jul 2025).

### Bring Your Own Model (BYOM) -- Preview (Mar 2026)

Source: [MS Learn release plan](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave2/microsoft-copilot-studio/use-own-model-when-generating-responses)

- Connect Azure AI Foundry models into agent prompts (no code)
- Supports GPT-4.5, Llama, fine-tuned models, and thousands of Foundry catalog models
- Available at the prompt level (not agent orchestration level)
- Public preview: Mar 2026

### Government Cloud (GCC/GCC-H/DoD)

| Model | Status | Notes |
|-------|--------|-------|
| GPT-4o | Default (GCC + GCC-H) | Still the only option in government clouds |
| GPT-4o mini | GA (GCC + GCC-H) | Available for prompt builder in gov clouds |

**Note:** DoD has no models listed as available. External model providers (Anthropic, xAI) require admin settings enablement at the tenant level. Cross-geo models may process data outside your region.

## Model Selection Guidelines

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| General-purpose agent | GPT-4.1 (default) | Best balance of capability, speed, and cost. GA everywhere. |
| Simple FAQ / routing | GPT-4.1 | Fast, cost-effective, GA |
| Complex reasoning / analysis | GPT-5 Reasoning | Better at multi-step logic, 400K context. Premium rate. |
| Mixed workloads | GPT-5 Auto (Preview) | Auto-routes between general and reasoning |
| High-quality general | GPT-5 Chat (GA in EU + US) | Stronger than 4.1, standard rate |
| Non-OpenAI preference | Claude Sonnet 4.5 (Preview) | Strong alternative, cross-geo |
| Cutting edge (accept experimental risk) | GPT-5.2 Chat/Reasoning | Most capable, may have rough edges |
| Cost-sensitive prompts | GPT-4.1 mini (prompt builder) | Basic rate, 128K context |

## How to Set Model

### Via LSP Wrapper (preferred — headless)
Edit `agent.mcs.yml` → set `aISettings.model.modelNameHint` → `node tools/mcs-lsp.js push`

### Via Island Gateway API
`node tools/island-client.js set-model --env <envId> --bot <botId> --model GPT5Chat`

### Via Playwright (fallback)
1. Navigate to agent Overview page
2. Click the model combobox
3. Select desired model
4. Wait for "completed successfully"

## Credit Rates by Model Tier

| Tier | Models | Rate |
|------|--------|------|
| Basic | GPT-4.1 mini | Basic rate |
| Standard | GPT-4.1, GPT-5 Chat, GPT-5.2 Chat, Claude Sonnet 4.5/4.6 | Standard rate |
| Premium | GPT-5 Reasoning, GPT-5.2 Reasoning, Claude Opus 4.5/4.6 | Premium rate |

Note: Exact credit-per-token rates vary; see [AI Builder Capability Rate table](https://go.microsoft.com/fwlink/?linkid=2338800) for current pricing.

## Admin Controls

- **Preview/Experimental models**: Admin must enable "Preview and experimental AI models" setting in environment
- **Cross-geo models**: Admin must enable "Move data across regions" in Power Platform admin center
- **External models (Anthropic, xAI)**: Two-step admin enablement -- (1) turn on external models in PPAC for environment, (2) allow each provider in M365 admin center
- Preview models and external models are separate settings that can overlap

## Model Configuration: Separate Settings for Different Purposes

- **Primary agent model**: Controls generative orchestration (agent model dropdown on Overview page)
- **Deep reasoning model**: Separate setting for reasoning-specific tasks (preview)
- **Generative responses model**: Separate setting for response generation (preview)
- **Prompt builder model**: Separate setting per prompt (prompt-level model selection)

## Refresh Notes

- Check MCS UI model combobox for new entries (preview/experimental models appear without docs)
- Search "Copilot Studio models" on MS Learn for official updates
- External models (Anthropic, xAI) require tenant admin enablement
- Government clouds lag behind commercial -- check separately
- GPT-4o retired in commercial (Oct 2025) -- still default in GCC/GCC-H
- Prompt builder has different model lineup than agent orchestration -- check both pages
- BYOM via Azure AI Foundry: preview Mar 2026, prompt-level only
