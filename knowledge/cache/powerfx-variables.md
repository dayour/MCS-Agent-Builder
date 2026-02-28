<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn formula reference, MCS docs, WebSearch Feb 2026, MS Learn advanced-power-fx, MS Learn authoring-variables-bot]
confidence: high
refresh_trigger: on_error
-->
# MCS PowerFx & Variables — Quick Reference

**Full function reference**: https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference-copilot-studio
**Critical**: Always US-style numbering (`.` decimal, `,` separator) regardless of locale.

## Four Variable Scopes

| Scope | Syntax | Lifetime | Notes |
|-------|--------|----------|-------|
| Topic | `Topic.VarName` | Current topic | Default. Can be input/output. |
| Global | `Global.VarName` | Entire session | Shared across topics. Cannot revert to Topic. |
| System | `System.*` | Session (read-only) | See system variables below. |
| Environment | `Environment.*` | Deployment | Read-only. Resolve at publish time (secrets at runtime). |

## Declaring Variables in YAML

- `init:Topic.VarName` — declares NEW variable (first use)
- `Topic.VarName` — references existing variable
- `=` prefix — PowerFx expression (e.g., `value: ="Hello " & Topic.name`)
- **Once a variable's type is set, it is FIXED** — cannot change

## Binding Direction Rules (Input vs Output)

**Common source of errors.** The `=` prefix differs by context:

| Context | Syntax | `=` Prefix? |
|---------|--------|-------------|
| SetVariable `value:` | `value: ="expression"` | Yes |
| Condition expression | `condition: =Topic.var = "value"` | Yes |
| **Input** binding (to model/action) | `inputField: =Topic.var` | **Yes** |
| **Output** binding (from model/action) | `outputField: Topic.var` | **No** |
| Variable reference | `variable: Topic.myVar` | No |
| New variable declaration | `variable: init:Topic.myVar` | No |
| **Trigger condition** | `condition: =Global.UserRole = "Admin"` | **Yes** |

```yaml
# InvokeAIBuilderModelAction example:
- kind: InvokeAIBuilderModelAction
  id: invokeModel
  input:
    binding:
      document_content: =Topic.document     # INPUT: = prefix
      extraction_schema: =Topic.schema       # INPUT: = prefix
  output:
    binding:
      predictionOutput: Topic.result         # OUTPUT: no = prefix
      confidence: Topic.confidence           # OUTPUT: no = prefix
  aIModelId: ba733cc8-...                    # MUST come AFTER input/output

# AdaptiveCardPrompt output binding:
- kind: AdaptiveCardPrompt
  id: collectForm
  output:
    binding:
      fieldId: Topic.variable                # OUTPUT: no = prefix
```

**Rule of thumb:** Data flowing IN uses `=` (it's an expression resolving a value). Data flowing OUT is a destination name (no expression needed).

## PowerFx in Trigger Conditions (Feb 2026)

Trigger conditions now support full PowerFx expressions. Use to filter when a topic fires:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  condition: =Global.UserRole = "Admin"
  intent:
    displayName: Admin Settings
```

This enables role-based, context-aware topic routing without separate disambiguation logic.

## Key System Variables

| Variable | Description |
|----------|-------------|
| `Activity.Text` | Current user message |
| `Activity.From.Id` / `.Name` | Sender ID / display name |
| `Activity.Attachments` | User-uploaded files |
| `Bot.Name` / `.Id` / `.TenantId` | Agent identity |
| `Conversation.Id` / `.InTestMode` / `.LocalTimeZone` | Session context |
| `LastMessage.Text` | Previous user message |
| `Error.Code` / `.Message` | Error context (OnError only) |
| `FallbackCount` | Failed matches (OnUnknownIntent only) |

**Auth variables**: `User.DisplayName`, `.Email`, `.FirstName`, `.LastName`, `.Id`, `.IsLoggedIn`, `.PrincipalName`, `.AccessToken` (manual auth only)

## Variable Types

String, Number, Boolean, DateTime, Table, Record, Choice, Blank. Type is fixed after first assignment.

## Key Operators

`=` (equals), `<>` (not equals), `&` (concat), `&&`/`||`/`!` (logic), `in`/`exactin` (containment)

## Key Functions by Category

**Strings**: `Concatenate`/`&`, `Len`, `Left`/`Right`/`Mid`, `Lower`/`Upper`/`Proper`, `Trim`, `Substitute`, `Find`, `StartsWith`/`EndsWith`, `IsMatch`/`Match`/`MatchAll` (regex), `Split`, `Text` (formatting), `EncodeUrl`, `PlainText`

**Logic**: `If`, `Switch`, `And`/`Or`/`Not`, `IsBlank`/`IsEmpty`, `Coalesce`, `IfError`

**Numbers**: `Round`/`RoundUp`/`RoundDown`, `Int`, `Abs`, `Mod`, `Min`/`Max`, `Sum`/`Average`

**Dates**: `Now`/`Today`/`UTCNow`, `Date`/`Time`/`DateTime`, `DateAdd`/`DateDiff`, `Year`/`Month`/`Day`/`Hour`, `Text(Now(), "yyyy-MM-dd")`

**Tables**: `Filter`, `LookUp`, `Sort`, `First`/`Last`/`Index`, `CountRows`/`CountIf`, `ForAll`, `AddColumns`/`DropColumns`, `Distinct`, `Table`/`Sequence`

**JSON**: `ParseJSON` (returns Dynamic — must convert with `Text()`, `Value()`, `Boolean()`), `JSON` (value to string)

## Global Variable Lifecycle & External Sources

### Lifecycle
- Global variable values persist until session ends
- **Clear variable values** node resets all globals (used in Reset Conversation system topic)
- "Start over" (user phrase or redirect) resets all globals

### Auto-Initialization
If a global variable is referenced before initialization, the agent automatically triggers the topic where the global was first defined, collects the value, then returns to the original topic. Seamless to user.

### External Sources (Context Variables)
- Set `External sources can set values` on a global variable
- Optional **timeout** (ms) for how long agent waits for external value before using default
- Recommended: create a dedicated topic ("Set context variables") with no trigger phrases
- Use `Get value from this node if empty` (three-dot menu on Set variable value node)
- If agent sets the variable internally during conversation, the internal value prevails (external value ignored)
- **IVR agents (D365 Contact Center):** timeout values for global variables NOT supported

### Deleting Globals
- Removing a global used in other topics marks references as `Unknown`
- Warning shown before confirming deletion
- Topics with unknown variable references may stop working — fix all references before publishing

## Regex in Power Fx (Jun 2025)

Simplified text validation and extraction with regex support via `IsMatch`, `Match`, and `MatchAll` functions. Insert Power Fx formulas directly in the embedded prompt builder prompt editor.

## Critical Gotchas

- **ParseJSON returns Dynamic** — no IntelliSense, must explicitly convert types
- **ForAll in Adaptive Cards** — use for dynamic arrays in `cardContent`
- **Formula mode in card editor is irreversible** — save JSON copy first
- **System.* cannot be used directly in card JSON** — assign to Topic variable first
- **Date/time, Duration, Multiple choice, custom entities** cannot be passed between topics (classic mode)
- **`Patch`, `Collect`, `Remove`** not available in MCS (Dataverse writes use API/connectors)
- **Global variable name must be unique** across all topics in the agent
- **Once a variable is made global, it CANNOT be reverted** to topic scope
- **Flows/skills overwrite globals** — if a flow initializes a variable, it runs even if the variable was already filled, overwriting the previous value

## Passing Variables Between Topics

```yaml
- kind: BeginDialog
  id: callChild
  dialog: cr_childTopic
  input:
    binding:
      - dialogVariable: Topic.customerName
        value: =Topic.nameFromSource
```
