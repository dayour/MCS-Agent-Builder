---
name: mcs-scenario
description: Generate scenarios, golden-examples, and boundaries from an agent-spec.md file. Creates the evaluation foundation for an MCS agent.

---

# MCS Scenario Generator

Generate scenarios and evals.csv from agent-spec.md (preferred) or usecase.md.

## Input

Provide the project name or path:
- `/mcs-scenario ProjectName` → reads from `Build-Guides/ProjectName/`
- `/mcs-scenario path/to/file.md` → reads specified file

## Process

### Step 1: Find Best Source

Check `Build-Guides/[ProjectName]/` in priority order:
1. **agent-spec.md** (preferred - has instructions, boundaries, scenarios)
2. **usecase.md** (fallback - has mission, scope, key scenarios)
3. **SDR .md files** (last resort - extract what we can)

### Step 2: Extract Scenario Inputs

From the source, identify:
- Core capabilities (what the agent DOES)
- Scope boundaries (HANDLE / DECLINE / REFUSE)
- Target personas
- User prompts and expected results (from SDR if available)
- Autonomous triggers (if applicable)
- Data sources and what they provide
- Instructions text (tone, format, behavior rules)

### Step 3: Generate scenarios.md

Create 6-10 scenarios covering:

| Type | Count | Purpose |
|------|-------|---------|
| Happy path | 2-3 | Core successful interactions |
| Edge case | 1-2 | Unusual but valid requests |
| Boundary - Decline | 1-2 | Requests to decline gracefully |
| Boundary - Refuse | 1 | Out of scope → refuse |
| Error recovery | 1 | Graceful failure (connector down, no data) |
| Multi-turn | 1 | Conversation continuity |

Each scenario includes:
- **Persona**: Who is asking
- **Conversation**: User input → Agent response (multi-turn if applicable)
- **Success Criteria**: What must be true for this to pass

### Step 4: Generate evals.csv

From each scenario, extract input → expected output pairs:

**CSV Format:**
```csv
"question","expectedResponse","testMethodType","passingScore"
```

**Test method types (MCS-supported):**
- `GeneralQuality` - Overall quality (no passingScore needed)
- `TextSimilarity` - Text similarity (passingScore integer: "70")
- `CompareMeaning` - Semantic comparison (passingScore integer: "70")
- `PartialMatch` - Must contain expected text (no passingScore)
- `ExactMatch` - Must exactly match (no passingScore)

**Mapping rules:**
- Happy path → `GeneralQuality` or `CompareMeaning` with "70"
- Boundary DECLINE → `PartialMatch` with expected decline phrase
- Boundary REFUSE → `PartialMatch` with expected refusal phrase
- No "DoesNotContain" type exists in MCS — use PartialMatch for positive assertions only

### Step 5: Write Output Files

Write to `Build-Guides/[ProjectName]/`:
- `scenarios.md` - Full conversation sketches with success criteria
- `evals.csv` - MCS evaluation CSV ready for upload

## Quality Checks

Before finalizing:
- [ ] Every DECLINE from spec has a boundary scenario
- [ ] Every REFUSE from spec has a boundary scenario
- [ ] Happy paths cover all core capabilities
- [ ] Scenarios are specific (real-sounding inputs, not generic)
- [ ] Expected responses match the agent's tone from instructions
- [ ] Multi-turn scenario tests conversation memory
- [ ] Edge cases cover missing data / no results scenarios
- [ ] evals.csv has correct testMethodType values
