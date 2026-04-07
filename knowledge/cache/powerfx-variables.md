<!-- CACHE METADATA
last_verified: 2026-04-07
sources: [MS Learn formula reference, MCS docs, WebSearch Mar 2026, MS Learn advanced-power-fx, MS Learn authoring-variables-about, MS Learn voice-configuration, MS Learn power-fx/formula-reference-copilot-studio (full A-Z verified), MS Learn unified-authoring-conversion, holgerimbery.blog Power Fx deep-dive Jan 2026, WebSearch Apr 2026, MS Learn formula reference Apr 2026]
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

| Variable | Type | Description |
|----------|------|-------------|
| `Activity.Text` | String | Current user message |
| `Activity.From.Id` | String | Channel-specific unique ID of the sender |
| `Activity.From.Name` | String | Channel-specific user-friendly name of the sender |
| `Activity.Attachments` | Table | User-uploaded file attachments |
| `Activity.Channel` | Choice | Channel ID of the current conversation |
| `Activity.ChannelId` | String | Channel ID as a string |
| `Activity.ChannelData` | Any | Object containing channel-specific content |
| `Activity.Name` | String | Name of the event activity |
| `Activity.Recipient.Id` | String | Incoming activity's Type property |
| `Activity.Recipient.Name` | String | Agent display name in channel (phone number in telephony) |
| `Bot.Name` / `.Id` / `.TenantId` | String | Agent identity |
| `Conversation.Id` | String | Unique conversation ID |
| `Conversation.InTestMode` | Boolean | Whether conversation is in test pane |
| `Conversation.LocalTimeZone` | String | User's time zone (IANA format) |
| `Conversation.LocalTimeZoneOffset` | Number | Offset from UTC in minutes |
| `LastMessage.Text` / `.Id` | String | Previous user message text / ID |
| `Error.Code` / `.Message` | String | Error context (OnError only) |
| `FallbackCount` | Number | Failed matches (OnUnknownIntent only) |
| `Recognizer` | Any | Intent recognition and triggering message info |
| `User.Language` | String | User language locale per conversation |

**Auth variables**: `User.DisplayName`, `.Email`, `.FirstName`, `.LastName`, `.Id`, `.IsLoggedIn`, `.PrincipalName`, `.AccessToken` (manual auth only)

**Voice-only variables** (telephony/IVR):

| Variable | Type | Description |
|----------|------|-------------|
| `Activity.UserInputType` | String | Whether user used DTMF or speech |
| `Activity.InputDTMFKey` | String | User's raw DTMF input |
| `Activity.SpeechRecognition.Confidence` | Number | Confidence (0-1) from last speech recognition |
| `Activity.SpeechRecognition.MinimalFormattedText` | String | Raw speech text before NLU processing |
| `Conversation.SipUuiHeaderValue` | String | SIP header for transfer-in context |
| `Conversation.OnlyAllowDTMF` | Boolean | When true, voice ignores speech input |

**Sensitive data variables** (voice-enabled agents only): Mark global variables as "Sensitive data" in Question nodes. Sensitive designation propagates to any variable it is assigned to. When using App Insights, turn off "Log sensitive activity" to avoid logging sensitive data.

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

## Additional Functions (Mar 2026 Formula Reference — Full A-Z Verified)

Functions confirmed in the MCS Power Fx formula reference that may be less well known:
- **`Summarize`** — Groups records by selected columns and summarizes the remainder
- **`Column` / `ColumnNames`** — Retrieves column names and values from Dynamic (untyped) values
- **`Float` / `Decimal`** — Explicit numeric type conversion from strings
- **`EncodeHTML`** — Encodes characters for HTML context (in addition to `EncodeUrl`)
- **`Trace`** — Provide additional information in test results (useful for debugging)
- **`Search`** — Finds records in a table that contain a string in one of their columns
- **`Refresh`** — Refreshes records of a data source
- **`AsType` / `IsType`** — Treats a record reference as a specific table type
- **`Patch`** — **NEW IN FORMULA REFERENCE** — Modifies or creates a record in a data source, or merges records outside of a data source. Now listed in official MCS formula reference. (See gotcha note below.)
- **`Error`** — Create a custom error or pass through an error
- **`IsError` / `IsBlankOrError` / `IfError`** — Error detection and handling
- **`GUID`** — Converts a GUID string or creates a new GUID value
- **`Hex2Dec` / `Dec2Hex`** — Hexadecimal/decimal conversion
- **`Shuffle`** — Randomly reorders table records
- **`EDate` / `EOMonth`** — Date arithmetic (add months, end of month)
- **`WeekNum`** — Returns week number of a date
- **`With`** — Calculates values for a single record, including inline named values
- **`Env`** — Access to Power Platform environment variables (shorthand for `Environment.`)
- **`System`** — Access to system variables (shorthand documented in formula reference)
- **`Global`** — Access to global variables (shorthand documented in formula reference)
- **`Topic`** — Access to topic variables (shorthand documented in formula reference)

**Foundry agents use `Local.` scope** instead of `Topic.` for local variables. Foundry system variables are similar but simplified compared to MCS.

## Critical Gotchas

- **ParseJSON returns Dynamic** — no IntelliSense, must explicitly convert types. Use `Column()` / `ColumnNames()` for dynamic exploration.
- **ForAll in Adaptive Cards** — use for dynamic arrays in `cardContent`
- **Formula mode in card editor is irreversible** — save JSON copy first
- **System.* cannot be used directly in card JSON** — assign to Topic variable first
- **Date/time, Duration, Multiple choice, custom entities** cannot be passed between topics (classic mode)
- **`Patch`** now listed in official MCS Power Fx formula reference (Mar 2026). However, practical availability for Dataverse writes within MCS topic nodes is UNVERIFIED — community posts still use connectors/flows for Dataverse writes. Test before relying on direct `Patch` in MCS. `Collect` and `Remove` are NOT listed in the formula reference.
- **`Collect`, `Remove`** not available in MCS (Dataverse writes use API/connectors)
- **Global variable name must be unique** across all topics in the agent
- **Once a variable is made global, it CANNOT be reverted** to topic scope
- **Flows/skills overwrite globals** — if a flow initializes a variable, it runs even if the variable was already filled, overwriting the previous value
- **Hidden system variables exist** — not shown in UI picker, access via Power Fx formula with `System.` prefix

## Recent Power Fx Enhancements (2025-2026)

| Feature | Status | Date | Details |
|---------|--------|------|---------|
| **Regex support (IsMatch/Match/MatchAll)** | GA | Jun 2025 | Simplified text validation and extraction with regular expressions |
| **Power Fx in prompt builder** | GA | Jun 2025 | Insert Power Fx formulas directly in the embedded prompt builder prompt editor |
| **Build enhanced connectors with Connector SDK + PowerFx** | Preview | May 2025 | Build enhanced connectors using Power Platform Connector SDK with Power Fx; **GA May 2026** |
| **Build connectors with OpenAPI v3** | Preview | Feb 2026 | Power Platform connectors with OpenAPI v3 spec; **GA May 2026** |
| **Prompt assistant in Prompt builder** | **GA** | Mar 2026 | Draft prompts faster with GPT model-powered suggestions in Prompt builder |
| **Inline prompt editing** | **GA** | Feb 2026 | Edit prompt instructions and settings inline in agent tool details, bringing model selection, inputs, knowledge, and testing into a single experience |

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
