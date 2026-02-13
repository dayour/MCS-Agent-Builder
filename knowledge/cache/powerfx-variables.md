<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MS Learn formula reference, MCS docs]
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

## Critical Gotchas

- **ParseJSON returns Dynamic** — no IntelliSense, must explicitly convert types
- **ForAll in Adaptive Cards** — use for dynamic arrays in `cardContent`
- **Formula mode in card editor is irreversible** — save JSON copy first
- **System.* cannot be used directly in card JSON** — assign to Topic variable first
- **Date/time, Duration, Multiple choice, custom entities** cannot be passed between topics (classic mode)
- **`Patch`, `Collect`, `Remove`** not available in MCS (Dataverse writes use API/connectors)

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
