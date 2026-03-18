# MCS Code Editor YAML Reference

## Overview

Topics in Microsoft Copilot Studio can be authored via the built-in code editor using YAML. This approach replaces 10+ clicks per topic node with a single paste operation.

**Schema Validation (primary):** Use `tools/om-cli/om-cli.exe` for full YAML validation — catches unknown nodes, missing required fields, and structural issues across 357 types. Run `tools/om-cli/om-cli.exe validate -f <file>` before pasting.

**Semantic Validation:** Use `python tools/semantic-gates.py <file.yaml> --brief <brief.json>` for 5 additional checks beyond structural validation: PowerFx functions, topic cross-references, variable flow, channel compatibility, and connector references.

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

See `knowledge/patterns/topic-patterns/README.md` for the full pattern catalog (21 patterns across 7 categories).

## How to Use (Code Editor Workflow)

1. Generate topic YAML from spec using patterns above
2. **Validate:** `tools/om-cli/om-cli.exe validate -f <file.yaml>` — catches unknown nodes, missing required fields, structural issues
3. LSP push: Write `.mcs.yml` to workspace `topics/` directory
4. Push: `node tools/mcs-lsp.js push --workspace <path>`
5. Fallback: Island Gateway API `PUT content/botcomponents` with DialogComponent payload

## Limitation

Microsoft warns: "Designing a topic entirely in the code editor and pasting complex topics isn't fully supported." For very complex topics (deep nesting, many nodes), consider building the skeleton in the visual canvas first, then switching to code editor for refinement.

## Action Type Reference

### 1. SendActivity / SendMessage — Send text to user
```yaml
# Simple
- kind: SendActivity
  id: sendMsg
  activity: "Text with {Topic.variable} interpolation"

# Complex (text + speech)
- kind: SendActivity
  id: sendComplexMsg
  activity:
    text:
      - Message line 1
      - Message line 2
    speak:
      - Speech version of message
```

### 2. SetVariable — Assign a variable
```yaml
- kind: SetVariable
  id: setVar
  variable: Topic.myVariable        # no = prefix
  value: ="some value or expression" # = prefix for expressions
```

### 3. Question — Ask user for input
```yaml
- kind: Question
  id: askName
  variable: init:Topic.userName
  prompt: "What is your name?"
  entity: StringPrebuiltEntity  # REQUIRED — see entity catalog below
```

### 4. ConditionGroup — If/else branching
```yaml
- kind: ConditionGroup
  id: checkCondition
  conditions:
    - id: condition1
      condition: =!IsBlank(Topic.variable)
      actions:
        - kind: SendActivity
          id: sendIfTrue
          activity: "Variable has value"
  elseActions:
    - kind: SendActivity
      id: sendFallback
      activity: "No match"
```
Common expressions: `=!IsBlank(Topic.var)`, `=Topic.var = "value"`, `=Topic.var > 10`, `=And(cond1, cond2)`

### 5. InvokeAIBuilderModelAction — Call AI Builder model
```yaml
- kind: InvokeAIBuilderModelAction
  id: invokeModel
  input:
    binding:
      document_content: =Topic.document   # input: WITH = prefix
  output:
    binding:
      predictionOutput: Topic.result       # output: NO = prefix
  aIModelId: ba733cc8-4cc6-4e8b-979c-...  # MUST come AFTER input/output
```
Use plain `binding:` — no `kind:` property inside.

### 6. AdaptiveCardPrompt — Collect form data via card
```yaml
- kind: AdaptiveCardPrompt
  id: collectForm
  card: |
    { "type": "AdaptiveCard", "version": "1.5", ... }
  output:
    binding:
      fieldId: Topic.variable  # output: NO = prefix
  outputType:
    properties:
      fieldId:
        type: String
```
Input.Text styles: `"Email"`, `"Tel"`, `"Url"`, or omit for plain text.

### 7. BeginDialog — Redirect to another topic (returns)
```yaml
- kind: BeginDialog
  id: redirectToTopic
  dialog: TopicSchemaName
```

### 8. ReplaceDialog — Switch to another topic (no return)
```yaml
- kind: ReplaceDialog
  id: switchToTopic
  dialog: TopicSchemaName
```

### 9. SetVariable vs SetTextVariable — Type Coercion
```yaml
# SetVariable: preserves the original type (use for most assignments)
- kind: SetVariable
  id: setVar
  variable: init:Topic.result
  value: =Topic.number1 + Topic.number2

# SetTextVariable: converts to text via template interpolation (use for display)
- kind: SetTextVariable
  id: coerceToText
  variable: Topic.GuestCountText
  value: "Guests: {Topic.NumberOfGuests}"
# Result: "Guests: 5" (Number → String)

# Alternative: Text() function for date formatting
- kind: SetVariable
  id: formatDate
  variable: init:Topic.dateText
  value: =Text(Topic.selectedDate, "MMM dd, yyyy")
```

### 10. CreateSearchQuery — Optimize Search Input (MANDATORY before knowledge search)
```yaml
# ALWAYS use before SearchAndSummarizeContent or SearchKnowledgeSources.
# Rewrites user's raw message using conversation history — resolves references
# like "tell me more about that" into the actual subject.
- kind: CreateSearchQuery
  id: createQuery
  userInput: =System.Activity.Text
  result: Topic.SearchQuery
# Access optimized query via Topic.SearchQuery.SearchQuery
- kind: SearchAndSummarizeContent
  id: searchKnowledge
  userInput: =Topic.SearchQuery.SearchQuery
  variable: Topic.Answer
```

### 10b. SearchAndSummarizeContent — AI-Summarized Knowledge Search
```yaml
# Full pattern with all properties:
- kind: SearchAndSummarizeContent
  id: searchContent
  autoSend: false                    # false = save to variable; true = auto-send
  variable: Topic.Answer             # where response is stored
  userInput: =Topic.SearchQuery.SearchQuery  # from CreateSearchQuery
  responseCaptureType: FullResponse  # captures content, markdown, citations
  applyModelKnowledgeSetting: false  # false = only configured sources
  knowledgeSources:                  # restrict to specific sources
    kind: SearchSpecificKnowledgeSources
    knowledgeSources:
      - schemaName.knowledge.sourceName  # filename without .knowledge.mcs.yml
  fileSearchDataSource:
    searchFilesMode:
      kind: DoNotSearchFiles
# Access: Topic.Answer.Text.Content, Topic.Answer.Text.MarkdownContent,
#         Topic.Answer.Text.CitationSources
```

### 10c. SearchKnowledgeSources — Raw/Verbatim Results (No AI Summary)
```yaml
# Returns raw search results WITHOUT AI summarization.
# Use for verbatim/legal/policy content where summarization loses details.
- kind: SearchKnowledgeSources
  id: searchRaw
  userInput: =Topic.SearchQuery.SearchQuery
  result: Topic.RawResults
  knowledgeSources:
    kind: SearchSpecificKnowledgeSources
    knowledgeSources:
      - schemaName.knowledge.sourceName
```

### 10d. SetTextVariable — Type Coercion (distinct from SetVariable)
```yaml
# Use SetTextVariable (not SetVariable) to convert non-text types to text
# via template interpolation. SetVariable preserves the original type.
- kind: SetTextVariable
  id: coerceToText
  variable: Topic.GuestCountText
  value: "Guests: {Topic.NumberOfGuests}"
```

### 11. EndDialog — End current topic
```yaml
- kind: EndDialog
  id: endDialog
  value: =Topic.result  # optional — return value
```

## Binding Direction Rules

**This is a common source of errors.** The `=` prefix means different things depending on context:

| Context | Syntax | `=` Prefix? |
|---------|--------|-------------|
| Variable assignment `value:` | `value: ="expression"` | Yes |
| Condition expression | `condition: =Topic.var = "x"` | Yes |
| Input binding (to model/action) | `inputField: =Topic.var` | **Yes** |
| Output binding (from model/action) | `outputField: Topic.var` | **No** |
| Variable reference in `variable:` | `variable: Topic.myVar` | No |
| New variable declaration | `variable: init:Topic.myVar` | No |

## Prebuilt Entity Catalog

Every `Question` and `AutomaticTaskInput` MUST have an `entity` property. **Entities must be string references — never inline definitions.**

### Text & Numbers
| Entity | Use For |
|--------|---------|
| `StringPrebuiltEntity` | Any text input (default choice) |
| `NumberPrebuiltEntity` | Numeric values |
| `BooleanPrebuiltEntity` | Yes/No, True/False |

### Contact Information
| Entity | Use For |
|--------|---------|
| `EmailPrebuiltEntity` | Email addresses (auto-validated) |
| `PhoneNumberPrebuiltEntity` | Phone numbers (auto-validated) |
| `URLPrebuiltEntity` | Web URLs |

### Location
| Entity | Use For |
|--------|---------|
| `CityPrebuiltEntity` | City names |
| `CountryOrRegionPrebuiltEntity` | Countries |
| `StatePrebuiltEntity` | US states |
| `ZipCodePrebuiltEntity` | ZIP/postal codes |
| `StreetAddressPrebuiltEntity` | Street addresses |

### Time & Dates
| Entity | Use For |
|--------|---------|
| `DatePrebuiltEntity` | Dates |
| `DateTimePrebuiltEntity` | Date and time |
| `DurationPrebuiltEntity` | Time durations |

### Other
| Entity | Use For |
|--------|---------|
| `MoneyPrebuiltEntity` | Currency amounts |
| `AgePrebuiltEntity` | Age values |
| `PercentagePrebuiltEntity` | Percentage values |
| `ColorPrebuiltEntity` | Color names |

**Prefer specific entities** for automatic validation: `EmailPrebuiltEntity` over `StringPrebuiltEntity` when collecting email.

## Topic-Action Chaining Rules (Generative Orchestration)

When a topic prepares data for an action (connector call, another topic, etc.), **output the data — not a status message** — so the orchestrator can chain correctly:

| Scenario | Correct Output | Wrong Output |
|----------|---------------|--------------|
| Topic collects form data for API call | `Topic.formData` (the data object) | `SendActivity "Form submitted!"` |
| Topic computes a value for another topic | `Topic.result` via outputType | `SendActivity "Result: {Topic.result}"` |
| Topic IS the final step | `SendActivity` with formatted result | *(this is correct for terminal topics)* |

**Rule:** If the topic is NOT the final step, set output variables and let the orchestrator decide presentation. If the topic IS the final step, use `SendActivity`/`SendMessage`.

## Connector Action Properties for Orchestrator Routing

Connector actions support `NameForModel` and `DescriptionForModel` properties — LLM-friendly names that help the orchestrator route correctly. These are set on the connector action definition (not in topic YAML) and override the default operation name/description.

## AdaptiveCardPrompt Requirements

`AdaptiveCardPrompt` has strict requirements:
- `card:` **must use literal block scalar** (`card: |`) — not inline JSON
- `output.binding` is **always required** — even for display-only cards
- `outputType.properties` is **always required** — defines the schema of submitted data
- `Action.Submit` is **always required** in the card body — even for display-only cards (use a dummy "OK" button)
- For display-only cards (FactSet, info display), use a minimal output binding with a dummy field

```yaml
# Display-only card with mandatory output binding
- kind: AdaptiveCardPrompt
  id: displayInfo
  card: |
    {
      "type": "AdaptiveCard",
      "version": "1.5",
      "body": [
        { "type": "FactSet", "facts": [
          { "title": "Status", "value": "Active" },
          { "title": "Plan", "value": "Premium" }
        ]}
      ],
      "actions": [
        { "type": "Action.Submit", "title": "OK" }
      ]
    }
  output:
    binding:
      submitAction: Topic.cardAck
  outputType:
    properties:
      submitAction:
        type: String
```

## Common Compile Errors

| Error | Fix |
|-------|-----|
| Missing entity | Add `entity: StringPrebuiltEntity` to Question/AutomaticTaskInput |
| Inline entity definition | Use string reference (`entity: StringPrebuiltEntity`), not inline `kind: ClosedListEntity` |
| Condition syntax error | Ensure `=` prefix: `condition: =Topic.variable = "value"` |
| BeginDialog reference error | Use simple string: `dialog: TopicSchemaName` |
| aIModelId placement | Move `aIModelId` AFTER `input`/`output` sections |
| Input binding missing `=` | Input bindings need `=` prefix: `fieldName: =Topic.var` |
| Output binding has `=` | Output bindings must NOT have `=`: `fieldName: Topic.var` |
