<!-- CACHE METADATA
last_verified: 2026-02-10
sources: [MCS UI snapshot, MS Learn]
confidence: medium
refresh_trigger: before_architecture
-->
# MCS Available Models

## Models Observed in MCS UI (Feb 2026)

| Model | Status | Notes |
|-------|--------|-------|
| GPT-4o | GA | Default model for most agents |
| GPT-4o mini | GA | Faster/cheaper, less capable |
| GPT-5 Auto (Preview) | Preview | Latest, auto-selects best variant |
| o1 | GA | Reasoning model |
| o1 mini | GA | Lighter reasoning model |
| o3-mini | Preview | Next-gen reasoning |

**Note:** Model availability varies by environment and tenant. Always check the actual model combobox in MCS UI — new models appear without documentation updates.

## Model Selection Guidelines

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| General-purpose agent | GPT-4o | Best balance of capability and speed |
| Simple FAQ / routing | GPT-4o mini | Fast, cost-effective |
| Complex reasoning / analysis | o1 or GPT-5 Auto | Better at multi-step logic |
| Cutting edge (willing to accept preview risk) | GPT-5 Auto (Preview) | Most capable, may have rough edges |

## How to Set Model

Model selection requires Playwright — not available via API:
1. Navigate to agent Overview page
2. Click the model combobox
3. Snapshot to see all available options
4. Select desired model
5. Wait for "Processing your request..." → "completed successfully"

## Refresh Notes

- Check MCS UI model combobox for new entries (preview models appear without docs)
- Search "Copilot Studio models" on MS Learn for official updates
- OpenAI model releases often appear in MCS within weeks
