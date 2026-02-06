# Scenarios: [Agent Name]

*Conversation sketches that define what success looks like. Each scenario is a mini user story written as a conversation.*

---

## Scenario 1: [Name] - Happy Path

**Actor:** [Who is the user? Context?]
**Goal:** [What are they trying to accomplish?]
**Type:** Happy path

### Conversation:

**User:** "[Exact user input]"

**Agent:**
```
[Ideal agent response - formatted exactly as it should appear]
```

### Success Criteria:
- [ ] [Criterion 1 - e.g., "Response in <5 seconds"]
- [ ] [Criterion 2 - e.g., "Includes actionable next steps"]

---

## Scenario 2: [Name] - Power User

**Actor:** [Experienced user who knows the system]
**Goal:** [Advanced or combined request]
**Type:** Power user

### Conversation:

**User:** "[Complex or combined request]"

**Agent:**
```
[Comprehensive response that demonstrates full capability]
```

### Success Criteria:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

## Scenario 3: [Name] - Edge Case

**Actor:** [User with unusual situation]
**Goal:** [Valid but uncommon request]
**Type:** Edge case

### Conversation:

**User:** "[Unusual but valid request]"

**Agent:**
```
[Response that handles the edge case gracefully]
```

### Success Criteria:
- [ ] Handles unusual input without breaking
- [ ] Provides helpful response despite limited data

---

## Scenario 4: [Name] - Boundary (Decline)

**Actor:** [User requesting out-of-scope action]
**Goal:** [Something the agent should NOT do]
**Type:** Boundary - Decline gracefully

### Conversation:

**User:** "[Request that should be declined]"

**Agent:**
```
[Polite decline with helpful redirect]
```

### Success Criteria:
- [ ] Declines clearly but politely
- [ ] Offers alternative within scope
- [ ] **DETERMINISTIC: Must always decline this type of request**

---

## Scenario 5: [Name] - Boundary (Redirect)

**Actor:** [User asking something adjacent to scope]
**Goal:** [Something better handled elsewhere]
**Type:** Boundary - Redirect

### Conversation:

**User:** "[Request outside core scope]"

**Agent:**
```
[Acknowledge, explain scope, redirect helpfully]
```

### Success Criteria:
- [ ] Acknowledges the request
- [ ] Explains what agent CAN do
- [ ] Redirects to appropriate resource
- [ ] **DETERMINISTIC: Must redirect this type of request**

---

## Scenario 6: [Name] - Error Recovery

**Actor:** [User when something goes wrong]
**Goal:** [Graceful handling of failures]
**Type:** Error recovery

### Conversation:

**User:** "[Request that will fail - e.g., unknown entity]"

**Agent:**
```
[Graceful error message with alternatives]
```

### Success Criteria:
- [ ] Admits limitation clearly
- [ ] Doesn't make up information
- [ ] Offers alternative paths

---

## Scenario 7: [Name] - Multi-Turn

**Actor:** [User in ongoing conversation]
**Goal:** [Follow-up or drill-down]
**Type:** Multi-turn conversation

### Conversation:

**User (Turn 1):** "[Initial request]"

**Agent (Turn 1):**
```
[Initial response]
```

**User (Turn 2):** "[Follow-up question]"

**Agent (Turn 2):**
```
[Response that uses context from Turn 1]
```

### Success Criteria:
- [ ] Maintains context across turns
- [ ] Doesn't repeat information unnecessarily

---

## Scenario Summary

| # | Name | Type | Key Test |
|---|------|------|----------|
| 1 | [Name] | Happy path | [What it tests] |
| 2 | [Name] | Power user | [What it tests] |
| 3 | [Name] | Edge case | [What it tests] |
| 4 | [Name] | Boundary - Decline | [What it tests] |
| 5 | [Name] | Boundary - Redirect | [What it tests] |
| 6 | [Name] | Error recovery | [What it tests] |
| 7 | [Name] | Multi-turn | [What it tests] |

---

## Next Steps

After completing scenarios:
1. Extract ideal responses → `golden-examples.csv`
2. Extract boundary rules → `boundaries.csv`
3. Combine for MCS upload → `evals.csv`
