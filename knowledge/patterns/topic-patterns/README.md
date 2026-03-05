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
| `greeting.yaml` | Conversation start / welcome message |
| `faq-knowledge.yaml` | Knowledge-grounded Q&A with generative answers |
| `branching.yaml` | Conditional logic with multiple paths |
| `adaptive-card.yaml` | Display data in adaptive card format |
| `http-request.yaml` | Call external REST API |
| `escalation.yaml` | Hand off to human / decline gracefully |
| `multi-turn.yaml` | Multi-step conversation with variable collection |
| `form-collect.yaml` | Collect multiple inputs then take action |
| `auto-start.yaml` | Auto-execute topic at conversation start |
| `ai-builder-model.yaml` | Invoke AI Builder model with input/output bindings |

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
- Trigger types: `OnRecognizedIntent`, `OnConversationStart`, `OnUnknownIntent`
