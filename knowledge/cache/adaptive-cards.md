<!-- CACHE METADATA
last_verified: 2026-03-18
sources: [MS Learn, Adaptive Cards docs, direct testing, WebSearch Mar 2026, MS Learn MCP Mar 2026, CopilotStudioSamples repo, adaptivecards.io samples, Agent Academy]
confidence: high
refresh_trigger: on_error
-->
# MCS Adaptive Cards — Quick Reference

## Schema Versions by Channel

| Channel | Max Version | Key Limitations |
|---------|-------------|----------------|
| Web Chat | 1.6 | No `Action.Execute` |
| Teams | 1.5 | No `Action.Execute`, no standalone Image/Video/Basic cards (`ContentFiltered`), no inline video playback |
| Omnichannel / Live Chat | 1.5 | Input selections NOT visible to human agent on escalation; markdown partially supported; media/audio/date inputs supported |
| **WhatsApp** | **Very limited** | **Only `Action.Submit` (max 3), `Input.ChoiceSet`, `Action.OpenUrl`** — no other card elements supported |
| **Apple Messages / SMS** | **None** | No adaptive cards or rich cards supported at all |
| M365 Copilot | Limited | No `Action.Execute`, no Basic/Video cards |
| LINE | 1.5 | Hero/Thumbnail cards supported; Audio cards converted to unformatted text |
| Custom (Direct Line) | 1.6 | Full support in Web Chat version; Android version limited |

**Safe default: use version `"1.5"` for cross-channel compatibility.**

**Test chat note:** Copilot Studio only renders version-1.6 cards in the test chat, not on the canvas.

**WhatsApp card design rules:** Keep cards extremely simple. Max 3 submit buttons. Use `Input.ChoiceSet` for selections. `Action.OpenUrl` for links. No images, no complex layouts, no tables.

## Action Types

| Action | Supported? | Notes |
|--------|-----------|-------|
| `Action.Submit` | **Yes** (primary) | Gathers all inputs, sends to agent |
| `Action.OpenUrl` | Yes | Opens external URL |
| `Action.ShowCard` | Yes | Inputs inside ShowCard NOT gathered by parent submit |
| `Action.ToggleVisibility` | Yes (v1.2+) | Show/hide elements by ID |
| `Action.Execute` | **No** | Not supported in Web Chat, Teams, or MCS |

## Input Elements

`Input.Text` (single/multiline, regex validation), `Input.Number` (min/max), `Input.Date`, `Input.Time`, `Input.Toggle` (boolean), `Input.ChoiceSet` (dropdown/radio/checkbox, filtered style v1.5+)

All inputs support: `isRequired`, `errorMessage`, `label` (v1.3+)

## Body Elements

`TextBlock`, `Image`, `Container`, `ColumnSet`/`Column`, `FactSet`, `ImageSet`, `ActionSet` (v1.2), `RichTextBlock` (v1.2), `Table` (v1.5)

## Size Limits

| Channel | Limit |
|---------|-------|
| Teams | **~28 KB** practical (413 error above) |
| General | ~40 KB including headers |
| Max actions | 6 recommended |

## Card Data Flow (Action.Submit)

1. User clicks Submit → all input values gathered
2. In Question node: stored in `Topic.formData`
3. Access fields: `Topic.formData.fieldId`
4. In "Ask with Adaptive Card" node: auto-creates output variables per input `id`

## PowerFx in Cards

- `cardContent: |-` with `=` prefix enables PowerFx
- Variable binding: `text: Topic.userName` (no quotes)
- Formatting: `Text(Topic.date, "MMM dd, yyyy")`
- Dynamic arrays: `ForAll(Topic.items, { type: "TextBlock", text: ThisRecord.Name })`
- `'$schema'` needs single quotes (special character)

## MCS Adaptive Card Pattern Library

**9 topic patterns** in `knowledge/patterns/topic-patterns/`:

| Pattern | Use Case |
|---------|----------|
| `adaptive-card.yaml` | Display data (FactSet) + AdaptiveCardPrompt form + display-only |
| `welcome-card.yaml` | Welcome card with action buttons + stats row variant |
| `form-collect.yaml` | Form collection: card form → submit → process |
| `approval-card.yaml` | Approve/reject with reason (leave, expense, document) |
| `confirmation-card.yaml` | Review data before confirming (order, booking) |
| `table-list-card.yaml` | Table element, dynamic ForAll list, selectable Input.ChoiceSet |
| `carousel-card.yaml` | Multiple cards in one message (catalog, recommendations) |
| `status-card.yaml` | Progress/status with step indicators |
| `feedback-card.yaml` | Thumbs up/down + detailed feedback form |

**Sources:** microsoft/CopilotStudioSamples (snippets/adaptive-cards/) + Copilot Studio Kit Gallery.

## Copilot Studio Kit — Adaptive Cards Gallery

The **Copilot Studio Kit** includes an **Adaptive Cards Gallery** with ready-to-use templates, sample data, and backend details. Install the Kit, publish the "Adaptive Card Gallery" agent, set the `cat_AgentTokenEndpoint` env variable to the agent's token endpoint. Templates include Event Registration and other common patterns.

## MS Learn Official Guidance Patterns (6)

| Pattern | URL Slug | Technique |
|---------|----------|-----------|
| Ask Questions | `guidance/adaptive-card-ask-questions` | Multi-field form, auto-creates output vars per input ID |
| Display Carousels | `guidance/adaptive-card-display-carousels` | ForAll() + indexed table, multiple AC attachments in Message |
| Summarize Responses | `guidance/adaptive-card-summarize-responses` | Summary card for confirmation after multi-step collection |
| Display Data from Arrays | `guidance/adaptive-cards-display-data-from-arrays` | ForAll() Power Fx to generate body elements dynamically |
| Feedback Collection | `guidance/adaptive-card-add-feedback-for-every-response` | Thumbs up/down after every response via Action.Submit data |
| Dynamic Cards (Power Fx) | `authoring-ask-with-adaptive-card` | Formula mode: `=` prefix replaces static JSON with expressions |

## Tool Completion AC Response (New)

MCS agents can send an Adaptive Card as a **tool completion response** — when a tool/action finishes, the result can be displayed as a card instead of plain text. Configure in the tool output settings.

## Key Gotchas

- **Formula mode is irreversible** — save JSON copy before switching
- **System.* can't be used in card JSON** — assign to Topic variable first
- **Action.ShowCard inputs** not gathered by parent card's submit button
- **Carousel**: multiple `AdaptiveCardTemplate` attachments in one message node
- **Reprompt**: "Ask with Adaptive Card" retries up to 2x if user sends text instead of submitting
- **Fallback** (v1.2+): `"fallback": "drop"` to silently remove unsupported elements
- **Images**: URL-based or data URI/base64 (v1.2+). In Teams, use Adaptive Card for images (standalone Image nodes = `ContentFiltered`)
- **WhatsApp**: Only 3 card element types supported — design separate simplified cards for WhatsApp channel
- **Message size limit**: Must be <= **28 KB** across all channels when using Omnichannel/ACS (413 error above)
- **Proactive cards via Power Automate**: Use Teams connector "Post adaptive card in a chat or channel" with "Post as: Microsoft Copilot Studio agent". PA does NOT support Adaptive Card templating feature.
- **Variables in cards**: Global, topic, and agent flow output variables all supported via PowerFx binding (Jan 2026 community tutorial confirmed)
- **Consecutive cards**: Include unique identifiers in Action.Submit data payloads to prevent cross-card interference
- **Interactive UI widgets**: NOT supported in MCS. `mcp-interactiveUI-samples` uses React/HTML in sandboxed iframes — for M365 Copilot declarative agents only, completely different from Adaptive Cards
- **adaptivecards.microsoft.com**: New docs hub with schema 1.6+ features (Responsive Layout, Icon, Badge, Charts). NOT yet supported in MCS Teams/Omnichannel (capped at 1.5)
