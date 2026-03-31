# All 24 Cache Files

## Tier 1: Build-Critical (refresh before every /mcs-research)

These directly drive component selection and architecture decisions. Staleness here = wrong recommendations.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `triggers.md` | Topic trigger types, YAML kinds, event triggers | "Copilot Studio topic trigger types", "Copilot Studio triggers YAML" |
| `models.md` | Available LLM models, GA vs Preview status | "Copilot Studio available models", "Copilot Studio AI models" |
| `mcp-servers.md` | Built-in MCP server catalog | "Copilot Studio MCP servers", "Copilot Studio Model Context Protocol" |
| `connectors.md` | Key Power Platform connectors for agents | "Power Platform connectors Copilot Studio", "new connectors" |
| `knowledge-sources.md` | Knowledge source types + limits | "Copilot Studio knowledge sources types", "knowledge source limits" |
| `channels.md` | Deployment channels + capabilities | "Copilot Studio deployment channels", "Copilot Studio channels" |
| `first-party-agents.md` | Microsoft built-in agents inventory -- capability matching for DA routing | "Microsoft 365 Copilot agents", "frontier agents Researcher Analyst" |
| `declarative-agents.md` | DA vs CA routing, manifest schema, limits, build tools, recommendation template | "declarative agent Copilot", "declarative agent vs custom agent" |

## Tier 2: Build-Phase (refresh before /mcs-build)

These drive the actual build execution. Staleness here = build errors or suboptimal patterns.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `api-capabilities.md` | What each API layer can do (LSP Wrapper, Island Gateway, PAC CLI, Dataverse) | "Copilot Studio API Dataverse", "PAC CLI copilot commands" |
| `instructions-authoring.md` | Instruction writing patterns, limits, Custom Prompt | "Copilot Studio instructions authoring", "Custom Prompt actions" |
| `generative-orchestration.md` | How gen orchestration routes topics | "Copilot Studio generative orchestration", "topic routing" |
| `adaptive-cards.md` | Adaptive card syntax, channel limits, PowerFx in cards | "Copilot Studio adaptive cards", "adaptive card channel support" |
| `ai-tools-computer-use.md` | AI tools, computer use, prompt actions | "Copilot Studio AI tools", "computer use agent" |
| `island-gateway-api.md` | Island Control Plane gateway endpoints, component CRUD, model hints | "Copilot Studio gateway API", "Island Control Plane botcomponents" |
| `power-automate-integration.md` | Flow integration patterns, cloud vs desktop | "Copilot Studio Power Automate", "cloud flow integration" |

## Tier 3: Reference (refresh weekly or on-demand)

Stable reference material that changes less frequently.

| File | What It Contains | Search Queries |
|------|-----------------|----------------|
| `eval-methods.md` | Test method types, scoring rules | "Copilot Studio evaluation test methods", "agent testing" |
| `security-auth.md` | Auth patterns, DLP, security settings | "Copilot Studio security authentication", "DLP policies" |
| `agent-lifecycle.md` | Create, publish, version, delete lifecycle | "Copilot Studio agent lifecycle", "publish versioning" |
| `limits-licensing.md` | Message limits, licensing, throttling | "Copilot Studio limits licensing", "rate limits quotas" |
| `powerfx-variables.md` | PowerFx in topics, variable types | "Copilot Studio PowerFx variables", "topic variables" |
| `conversation-design.md` | UX patterns, conversation flows | "Copilot Studio conversation design", "best practices" |
| `known-issues.md` | Known bugs, workarounds, ObjectModel gaps | "Copilot Studio known issues", "Copilot Studio bugs workarounds" |
| `mcs-primer-gpt.md` | GPT-optimized MCS primer for co-generation | "Copilot Studio overview capabilities", "MCS architecture summary" |
| `copilot-studio-kit.md` | Power CAT Copilot Studio Kit integration patterns | "Power CAT Copilot Studio Kit", "Copilot Studio testing framework" |
