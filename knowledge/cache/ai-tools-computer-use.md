<!-- CACHE METADATA
last_verified: 2026-03-19
sources: [MS Learn, MCS UI, AI Builder docs, WebSearch Mar 2026, MS Learn MCP Mar 2026, Copilot Blog Mar 2026, 2026 Wave 1 release plan]
confidence: high
refresh_trigger: before_architecture
-->
# MCS AI Tools & Computer Use — Quick Reference

## Prompt Actions

Three ways to use: agent-level tool (autonomous), topic-level node (controlled), AI Plugin (M365 Copilot).

### Available Models (Mar 2026)

| Model | Rate | Context | Status |
|-------|------|---------|--------|
| GPT-4.1 mini (default) | Basic (0.1/1K tokens) | 128K | GA (Default) |
| GPT-4.1 | Standard (1.5/1K tokens) | 128K | GA |
| GPT-5 Chat | Standard (1.5/1K tokens) | 128K | GA (EU/US), Preview elsewhere |
| GPT-5 Reasoning | Premium (10/1K tokens) | 400K | Preview |
| GPT-5 Auto | Variable | Variable | Preview (routes dynamically) |
| GPT-5.2 Chat | Standard | 128K | Experimental |
| GPT-5.2 Reasoning | Premium | 400K | Experimental |
| Claude Sonnet 4.5 | Standard | 200K | Preview (external, cross-geo). Also for Prompt Builder and Computer Use. |
| Claude Sonnet 4.6 | Standard | 200K | Experimental (external) |
| Claude Opus 4.6 | Premium | 200K | Experimental (external). Also for Prompt Builder. |
| Grok 4.1 Fast (Non-reasoning) | Standard | Large | Experimental (**US only**, external, safety caveats) |
| Azure AI Foundry (BYOM) | Varies | Varies | Preview (Mar 2026) |

### Prompt Builder Enhancements (Feb 2026)

- **Per-prompt content moderation**: Configure sensitivity per prompt for hate/fairness, sexual, violence, self-harm — supports regulated and document-processing scenarios
- **Claude models in Prompt Builder**: Choose Claude Opus 4.6 or Claude Sonnet 4.5 for fine-grained control over reasoning depth, quality, latency, cost
- **Inline editing**: Edit prompt instructions and settings inline in agent tool details — model selection, inputs, knowledge, testing in single view

### Settings

Temperature (0-1), content moderation (Low/Moderate/High), **code interpreter** (GA — Python execution), reasoning mode, knowledge grounding (Dataverse).

## AI Builder Prebuilt Models

Sentiment analysis, entity extraction (20+ types), category classification, key phrases, language detection, translation (15+ languages), OCR, invoice/receipt/contract/ID/business card processing, image description.

**Access**: Text/generative AI → prompt actions. Prebuilt/custom models → via agent flows.

## Computer Use Agent (CUA) — Preview

### Key Facts

| Fact | Value |
|------|-------|
| Status | **Public Preview** (since May 27, 2025; **GA target May 2026** per 2026 Wave 1) |
| Models | OpenAI CUA, Anthropic Claude Sonnet 4.5 (beta, added Feb 2026 — improves nuanced decision-making) |
| Web success rate | **~80%** |
| Desktop success rate | **~35%** |
| Region | **US only** (environments with US region) |
| Pricing | **5 Copilot Credits per step** ($0.04/step) |
| Requires | Generative orchestration enabled |

### Machine Options

| Option | Production? | Notes |
|--------|-------------|-------|
| Hosted browser | No (prototyping) | Shared, throttled, 1 session/user |
| Cloud PC pool | Yes (preview) | Win 11, Windows 365 for Agents, auto-scale 10 VMs/pool, 5 pools/env, Microsoft Entra joined + Intune enrolled |
| BYO machine | Yes | PA Desktop v2.61+ required |

**Free tier**: Up to 2 Cloud PC pools per tenant with 50 hours complimentary usage for published autonomous agents (evaluation purposes).

### Jan/Feb 2026 Updates

| Feature | Details |
|---------|---------|
| Multi-model support | Choose between OpenAI CUA and Anthropic Claude Sonnet 4.5 per task |
| Built-in credentials | Stored credentials for automated auth — **Power Platform** (internal encrypted) or **Azure Key Vault** (enterprise). Credentials NEVER exposed to AI model. |
| Cloud PC pooling | Windows 365 for Agents — fully managed, auto-scale, no dedicated hardware maintenance |
| Enhanced audit logging | Session replay with screenshots, step-by-step action logs (coordinates, timestamps, context), run summaries with duration/action metrics |
| Microsoft Purview integration | Compliance integration for audit trail |
| Dataverse logging | Configurable verbosity levels, retention 7 days to indefinite |

### CUA vs RPA

| Factor | RPA | CUA |
|--------|-----|-----|
| Authoring | Script/recorder | Natural language |
| UI changes | Breaks (selectors) | Adapts (vision) |
| Speed | Fast | Slower |
| Maturity | GA | Preview |

**Use RPA**: stable UI, high volume, speed critical. **Use CUA**: shifting UIs, fast setup, fuzzy decisions.

### CUA Limitations

- Struggles with dropdowns, date pickers, custom widgets
- May get stuck in loops; no multi-screen support
- NOT for sensitive/high-risk use cases
- Desktop apps unsupported for password fields on: Electron, Java, Unity, CLI, Citrix

### Security

Stored credentials (Power Platform or Key Vault), URL + app allow-lists, human supervision (reviewer approval), dedicated isolated machines recommended. Credentials are encrypted and never exposed to the AI model.

### Adding Computer Use to an Agent

1. Tools > Add tool > New tool > **Computer use**
2. Provide natural language instructions for the task
3. Configure: **Name**, **Description** (used for orchestrator routing), **Model** (OpenAI CUA or Claude Sonnet 4.5), **Instructions** (step-by-step with URLs/app names)
4. Optional: **Inputs** (dynamic values per run), **Machine** (hosted/Cloud PC/BYO)
5. Test with real-time side-by-side video of reasoning chain + UI automation

## Generative AI Settings (NOT tools — these are toggles)

These are **agent-level settings**, NOT tools/connectors/MCPs. They are toggled in Settings > Generative AI (or via LSP push / Dataverse API). Do NOT add these as integrations with `type: "ai-tool"` — they are `type: "setting"`.

| Setting | Default | How to Enable |
|---------|---------|---------------|
| Orchestration | Generative | Settings > Generative AI |
| Moderation | High (5 levels: Lowest→Highest) | Settings > Generative AI |
| General knowledge | On | Settings > Generative AI |
| **Web search (Bing grounding)** | **Off** | Settings > Generative AI > "Use information from the web". LSP: `gptCapabilities.webBrowsing: true`. NOT a tool, NOT a connector — it's a setting that enables Bing grounding in the orchestrator. |

**Common mistake:** Classifying "Bing Web Search" as an `ai-tool` integration. It's a SETTING. The separate "Bing Search" Power Platform CONNECTOR (in connectors.md) is a different thing — that's an actual connector with actions like `GetNews`.

Moderation precedence: Topic-level > Agent-level. Prompt tool is independent.

## Upcoming Features

| Feature | Status | Expected |
|---------|--------|----------|
| Code interpreter on SharePoint sources | Preview Mar 2026, GA May 2026 | **Active Preview** |
| Custom MCP servers (connect any external data) | Preview Mar 2026, GA Apr 2026 | **Active Preview** |
| Use your own model for generating responses (BYOM) | Preview Mar 2026 | **Active Preview** |
| Configure triggers with end-user credentials | Preview Mar 2026, GA May 2026 | **Active Preview** |
| Evaluate test sets with multiple graders | Preview Feb 8, 2026 | **Active Preview** |
| Computer Use GA | GA May 2026 | Planned |
| MCP-compliant tools in agent workflows | Preview Apr 2026, GA Oct 2026 | Planned |
| Enforce safe sharing (credential oversharing detection) | Preview Apr 2026, GA Jun 2026 | Planned |
| Unified error/warning/governance notifications | Preview Apr 2026, GA Jun 2026 | Planned |

## Features Removed from Release Plan (Feb 2026)

| Feature | Reason |
|---------|--------|
| Use single sign-on for non-Entra ID connections | Deprioritized, will not be delivered |
| Test and debug agent actions | Deprioritized, will not be delivered |

## Credit Rates

| Feature | Rate |
|---------|------|
| Basic models (GPT-4.1 mini) | 0.1 credits / 1K tokens |
| Standard (GPT-4.1, GPT-5 chat, Claude Sonnet, Grok) | 1.5 credits / 1K tokens |
| Premium (GPT-5 reasoning, Claude Opus) | 10 credits / 1K tokens |
| Document processing | 8 credits / page |
| Computer Use | 5 credits / step |

Testing is free (test panel + prompt builder).
