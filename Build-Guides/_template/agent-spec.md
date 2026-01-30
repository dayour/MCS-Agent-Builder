# Agent Spec: [Agent Name]

## Objective
[One-paragraph description of the agent's purpose and value proposition.]

## Instructions
[The system prompt/instructions that define the agent's personality, behavior, and guidelines.]

```
You are [Agent Name], a [description].
Your purpose is to [main function].

Guidelines:
- [Guideline 1]
- [Guideline 2]
- [Guideline 3]

You must NOT:
- [Restriction 1]
- [Restriction 2]
```

## Personas
- **Primary:** [Target user] - [Their needs]
- **Secondary:** [Target user] - [Their needs]

---

## User Flows

Define each distinct user interaction path:

### Flow 1: [Flow Name]
```
User: "[Example trigger]"
  ↓
Agent: [What agent does]
  ↓
User: [User action]
  ↓
Agent: [Next action]
  ↓
Outcome: [Final result]
```

### Flow 2: [Flow Name]
```
User: "[Example trigger]"
  ↓
...
```

---

## Requirements Analysis

### Data Requirements
| Requirement | Persists? | User-specific? | Notes |
|-------------|-----------|----------------|-------|
| [e.g., Task progress] | Yes/No | Yes/No | [Details] |

### Integration Requirements
| Requirement | External System | Notes |
|-------------|-----------------|-------|
| [e.g., Send emails] | [System] | [Details] |

### Conversation Requirements
| Requirement | Type | Notes |
|-------------|------|-------|
| [e.g., Checklist display] | [UI/Dialog/Q&A] | [Details] |

---

## Selected Components

**Note:** Components should be determined through analysis, not assumed. Document what was selected and why.

### [Component Category 1, if needed]
| Component | Purpose | Why Selected |
|-----------|---------|--------------|
| [Name] | [What it does] | [Reasoning] |

### [Component Category 2, if needed]
| Component | Purpose | Why Selected |
|-----------|---------|--------------|
| [Name] | [What it does] | [Reasoning] |

---

## Implementation Details

**Only document details for selected components.**

### [If Topics selected]

#### Topic: [Topic Name]
- **Trigger phrases:** "[phrase 1]", "[phrase 2]", "[phrase 3]"
- **Purpose:** [What this topic accomplishes]
- **Conversation flow:**
  1. [Node 1]: [Description]
  2. [Node 2]: [Description]
- **Variables used:** [List]
- **Calls flow:** [Yes/No - which]
- **Uses Adaptive Card:** [Yes/No - which]

### [If Adaptive Cards selected]

#### Card: [Card Name]
- **Purpose:** [What this card displays/collects]
- **Used in:** [Topic name]
- **Elements:** [Brief description]
- **Outputs:** [Variables set when submitted]

### [If Flows selected (Agent or Power Automate)]

#### Flow: [Flow Name]
- **Type:** [Agent Flow / Power Automate]
- **Trigger:** [How it's triggered]
- **Purpose:** [What this flow does]
- **Inputs:** [List]
- **Actions:** [Brief description]
- **Outputs:** [List]

### [If Data persistence selected]

#### Table: [Table Name]
- **Purpose:** [What this table stores]
- **Columns:**
  | Column | Type | Description |
  |--------|------|-------------|
  | [Name] | [Type] | [Details] |

### [If Knowledge Sources selected]

#### Knowledge: [Source Name]
- **Type:** [SharePoint/OneDrive/Dataverse/Files/Website]
- **Location:** [URL or description]
- **Purpose:** [What it provides]

---

## Sample Interactions

### Interaction 1: [Scenario Name]
**User:** "[Example prompt]"
**Agent:** [Expected response]

### Interaction 2: [Scenario Name]
**User:** "[Example prompt]"
**Agent:** [Expected response]

---

## Error Handling

| Scenario | Response |
|----------|----------|
| [Error case] | [How agent handles it] |

---

## Build Checklist

### Pre-Build
- [ ] Use case analyzed
- [ ] Components selected with user
- [ ] Spec reviewed

### Build
- [ ] Agent created (name, description, instructions)
- [ ] [If selected] Knowledge sources added
- [ ] [If selected] Data tables created
- [ ] [If selected] Flows created
- [ ] [If selected] Topics created
- [ ] [If selected] Triggers configured

### Test
- [ ] All selected components tested
- [ ] End-to-end flow validated
- [ ] Error scenarios verified

### Deploy
- [ ] User sign-off obtained
- [ ] Published
- [ ] Documentation complete
