# MCS Code Editor YAML Reference

## Overview

Topics in Microsoft Copilot Studio can be authored via the built-in code editor using YAML. This approach replaces 10+ clicks per topic node with a single paste operation.

## YAML Rules

- Root element: `kind: AdaptiveDialog`
- IDs must be unique across all nodes in the topic
- PowerFx expressions start with `=`
- Variables: `Topic.varName` (topic-scoped), `System.User.DisplayName` (system)
- New variables: use `init:Topic.varName` in SetVariable
- `suggestedActions` create quick-reply buttons
- `activity.text` is an array (use `- "text"` format)

## Trigger Types

See `knowledge/cache/triggers.md` for full trigger reference.

Common triggers:
- `OnRecognizedIntent` — user says a phrase or AI chooses topic
- `OnConversationStart` — conversation begins
- `OnUnknownIntent` — fallback / no topic matched

## Available Topic Patterns

Reusable YAML templates in `knowledge/patterns/topic-patterns/`:

| Pattern | File | Use For |
|---------|------|---------|
| Greeting | `greeting.yaml` | Conversation start message |
| FAQ/Knowledge | `faq-knowledge.yaml` | Knowledge-grounded generative answers |
| Branching | `branching.yaml` | Conditional logic with multiple paths |
| Adaptive Card | `adaptive-card.yaml` | Display structured data in cards |
| HTTP Request | `http-request.yaml` | Call external REST APIs |
| Escalation | `escalation.yaml` | Hand off / decline / refuse |
| Multi-Turn | `multi-turn.yaml` | Multi-step variable collection |
| Form Collection | `form-collect.yaml` | Adaptive card form input |
| Auto-Start | `auto-start.yaml` | Auto-execute topic at conversation start |

## How to Use (Code Editor Workflow)

1. Generate topic YAML from spec using patterns above
2. Playwright: Navigate to Topics tab → Create blank topic
3. Playwright: Click "..." → "Open code editor"
4. Playwright: Paste generated YAML into code editor
5. Playwright: Save

## Limitation

Microsoft warns: "Designing a topic entirely in the code editor and pasting complex topics isn't fully supported." For very complex topics (deep nesting, many nodes), consider building the skeleton in the visual canvas first, then switching to code editor for refinement.

## Node Reference

See `knowledge/cache/triggers.md` for full node and variable reference.

Key nodes:
- `SendActivity` / `SendMessage` — send text
- `Question` — ask user, store in variable
- `ConditionGroup` — if/else branching
- `SetVariable` — set a variable
- `BeginDialog` — call another topic (returns)
- `ReplaceDialog` — switch to another topic (no return)
- `SearchAndSummarizeContent` — generative answer from knowledge
- `HttpRequest` — call external API
