# ObjectModel CLI (om-cli)

The ObjectModel defines the API contract between Copilot Studio's frontend and backend. This CLI exposes the full schema (357 concrete types) for validation, exploration, and code generation support.

## Requirements

- .NET 10 runtime (framework-dependent deployment)

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `validate -f <file>` | Full YAML validation (structure, types, required fields) | `om-cli.exe validate -f topic.yaml` |
| `schema <type>` | Get full type definition with all properties | `om-cli.exe schema Question` |
| `search <pattern>` | Find types by wildcard pattern | `om-cli.exe search "Card*"` |
| `list` | List all types (`--concrete-only` for non-abstract) | `om-cli.exe list --concrete-only` |
| `hierarchy <type>` | Type inheritance tree (`-d ancestors`/`descendants`) | `om-cli.exe hierarchy DialogAction -d descendants` |
| `composition <type>` | Property structure with nesting depth | `om-cli.exe composition Question -d 2` |
| `examples <type>` | Example YAML for a type | `om-cli.exe examples Question` |

## Validation diagnostics

The `validate` command returns JSON with structured diagnostics:

```json
{
  "valid": false,
  "diagnosticCount": 1,
  "diagnostics": [
    {
      "Severity": "error",
      "Code": "UnknownElementError",
      "Message": "Node is unknown to the system",
      "Range": { "Start": { "Line": 5, "Character": 6 }, "End": { "Line": 7, "Character": 0 } }
    }
  ]
}
```

Detected errors include: `UnknownElementError` (invalid kind), `MissingRequiredProperty`, structural issues.

Known gap: PowerFx function validation is not performed (e.g., `Factorial()` won't be flagged).

## Rebuilding from source

The source is at `c:/Users/kimdennis/Downloads/ObjectModel/` (local copy only, not in this repo).

```bash
dotnet publish "c:/Users/kimdennis/Downloads/ObjectModel/src/Cli/ObjectModel.Cli/ObjectModel.Cli.csproj" \
  --configuration Release \
  --no-self-contained \
  --runtime win-x64 \
  -p:DebugSymbols=false \
  -p:DebugType=None \
  -p:SatelliteResourceLanguages=en \
  --output "tools/om-cli"
```
