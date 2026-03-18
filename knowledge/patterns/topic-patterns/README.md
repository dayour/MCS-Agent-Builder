# MCS Topic YAML Patterns

Reusable YAML patterns for Copilot Studio topic authoring via the built-in code editor.

## Usage

1. Build skills generate topic YAML from brief.json (conversations.topics[]) using these patterns
2. Generated YAML is written to the LSP workspace `topics/` directory as `.mcs.yml` files
3. Pushed to MCS via `node tools/mcs-lsp.js push --workspace <path>`
4. Fallback: Island Gateway API `PUT content/botcomponents` with DialogComponent payload

## Pattern Files

| Pattern | Use Case |
|---------|----------|
| **Greetings & Init** | |
| `greeting.yaml` | Conversation start / welcome message (OnConversationStart) |
| `auto-start.yaml` | Auto-execute topic at conversation start |
| `conversation-init.yaml` | Combined OnActivity: JIT glossary + user context (use instead of separate topics) |
| `jit-glossary.yaml` | Load customer acronyms from knowledge source into Global.Glossary via OnActivity |
| `jit-user-context.yaml` | Load M365 user profile (country, department) into Global variables via OnActivity |
| **Knowledge Search (5 patterns)** | |
| `faq-knowledge.yaml` | Fallback search: OnUnknownIntent with CreateSearchQuery → SearchAndSummarize |
| `search-direct-response.yaml` | Controlled display: autoSend false, manual SendActivity with formatting |
| `search-orchestrator.yaml` | Orchestrator pattern: inputs/outputs, orchestrator presents the result |
| `search-precision.yaml` | Verbatim/raw: SearchKnowledgeSources without AI summarization |
| `knowledge-routing.yaml` | OnKnowledgeRequested: category/country-based routing with specific sources |
| `citation-removal.yaml` | OnGeneratedResponse: strip [1][2] citation markers from AI-generated responses |
| **Orchestration & Routing** | |
| `orchestrator-variable.yaml` | Zero-cost classification via AutomaticTaskInput (shouldPromptUser: false) |
| `dynamic-redirect.yaml` | Switch() expression in BeginDialog for multi-target routing |
| `automatic-task-input.yaml` | Generative orchestration: AutomaticTaskInput with inputType/outputType schemas |
| **Conversation Flow** | |
| `branching.yaml` | Conditional logic with multiple paths |
| `multi-turn.yaml` | Multi-step conversation with variable collection |
| `form-collect.yaml` | Collect multiple inputs then take action |
| `escalation.yaml` | Hand off to human / decline gracefully |
| **System Topics** | |
| `disambiguation.yaml` | OnSelectIntent: present matched topics as choice list |
| `auth-flow.yaml` | OnSignIn: authentication flow with OAuthInput |
| `error-handler.yaml` | OnError: error handling with telemetry + test mode detection |
| **Integration** | |
| `adaptive-card.yaml` | Display data in adaptive card format |
| `http-request.yaml` | Call external REST API |
| `ai-builder-model.yaml` | Invoke AI Builder model with input/output bindings |
| `connector-action.yaml` | TaskDialog: connector action with ManualTaskInput/AutomaticTaskInput |
| **Agent & Component Definitions** | |
| `child-agent.yaml` | AgentDialog: child agent with OnToolSelected + prevent-response instructions |
| `knowledge-source.yaml` | KnowledgeSourceConfiguration: Public/SharePoint/GraphConnector + triggerCondition |
| `global-variable.yaml` | GlobalVariableComponent: conversation-scoped variable with aIVisibility |

## Related References

- **YAML syntax rules**: `knowledge/patterns/yaml-reference.md` (action types, entity catalog, binding rules)
- **Schema validation**: `tools/om-cli/om-cli.exe validate -f <file.yaml>`
- **Trigger types**: `knowledge/cache/triggers.md`
- **LSP push workflow**: See `CLAUDE.md` § "Hybrid Build Stack"

## YAML Rules

- Root element is always `kind: AdaptiveDialog`
- IDs must be unique across all nodes (use descriptive prefixes)
- PowerFx expressions start with `=` prefix
- Variables: `Topic.varName` (topic-scoped), `System.User.DisplayName` (system)
- Use `init:Topic.varName` to declare a new variable in SetVariable
- Use `SetTextVariable` (not `SetVariable`) for type coercion (Number/DateTime → String)
- Trigger types: `OnRecognizedIntent`, `OnConversationStart`, `OnUnknownIntent`, `OnActivity`, `OnKnowledgeRequested`, `OnGeneratedResponse`
- `OnOutgoingMessage` trigger exists in schema but does NOT fire at runtime — do not use

## Knowledge Search Rules

- **ALWAYS** use `CreateSearchQuery` before `SearchAndSummarizeContent` or `SearchKnowledgeSources` to preserve conversational context
- Without `CreateSearchQuery`, follow-ups like "tell me more about that" search literally instead of resolving the reference
- `SearchAndSummarizeContent` = AI-summarized results; `SearchKnowledgeSources` = raw/verbatim results
- Use `autoSend: false` + `responseCaptureType: FullResponse` when you need to control display
- `applyModelKnowledgeSetting: false` restricts to configured sources only (no general knowledge)
- Knowledge sources: `knowledgeSources.kind: SearchSpecificKnowledgeSources` to scope search

## Channel Awareness

- `OnConversationStart` does NOT fire on M365 Copilot or channel-embedded surfaces
- For initialization on all channels, use `OnActivity (type: Message)` with `IsBlank()` guard
- For M365 Copilot greetings, use `conversationStarters` in agent.mcs.yml instead
- `suggestedActions` do NOT render on M365 Copilot — use `conversationStarters` instead

## Generative Orchestration Rules

- When `GenerativeActionsEnabled: true`, `modelDescription` is the PRIMARY routing mechanism — more important than trigger phrases
- Prefer `AutomaticTaskInput` over Question nodes for input collection
- Prefer topic outputs over `SendActivity` for final results — let orchestrator present
- Topics that prepare data for an action: output DATA, not status messages (kills chaining)
- `shouldPromptUser: false` on AutomaticTaskInput = zero-cost orchestrator classification
