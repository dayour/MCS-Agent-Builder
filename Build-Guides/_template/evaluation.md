# Evaluation Set: [Agent Name]

*This evaluation set drives agent development. Define tests BEFORE building.*

---

## Quality Dimensions & Thresholds

*Copy from usecase.md and map to MCS graders.*

| Dimension | Threshold | MCS Grader | Notes |
|-----------|-----------|------------|-------|
| Accuracy | [e.g., 95%] | Quality (Relevance) | |
| Grounding | [e.g., 100%] | Quality (Groundedness) | |
| Completeness | [e.g., 90%] | Quality (Completeness) | |
| Tone | [e.g., Professional] | Manual review | |

---

## Foundational Eval Set (15-25 cases)

*2-3 test cases per scenario from usecase.md. These must pass before deployment.*

### Scenario 1: [Name from usecase.md]

| # | User Input | Acceptance Criteria |
|---|------------|---------------------|
| 1.1 | "[Exact user query]" | **Content:** [What MUST be in response]<br>**Constraints:** [What must NOT be in response]<br>**Quality:** [Tone/style requirements]<br>**Behavior:** [Actions agent must take] |
| 1.2 | "[Variation of query]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |
| 1.3 | "[Edge case for this scenario]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |

### Scenario 2: [Name from usecase.md]

| # | User Input | Acceptance Criteria |
|---|------------|---------------------|
| 2.1 | "[Exact user query]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |
| 2.2 | "[Variation]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |

### Scenario 3: [Name from usecase.md]

| # | User Input | Acceptance Criteria |
|---|------------|---------------------|
| 3.1 | "[Exact user query]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |
| 3.2 | "[Variation]" | **Content:** [...]<br>**Constraints:** [...]<br>**Quality:** [...]<br>**Behavior:** [...] |

### Scenario 4: [Boundary/Decline Scenario]

| # | User Input | Acceptance Criteria |
|---|------------|---------------------|
| 4.1 | "[Out-of-scope request]" | **Content:** Polite decline with redirect<br>**Constraints:** Must not attempt to answer<br>**Quality:** Helpful, not dismissive<br>**Behavior:** No actions taken |

*[Continue for all scenarios in usecase.md...]*

---

## Extended Eval Sets (Post-Build, ~100 cases total)

*Create after foundational set passes. Used for comprehensive validation.*

### Variations (20-30 cases)

*Test robustness to different phrasings, complexity levels, and user styles.*

| Original | Variation Type | User Input | Expected |
|----------|---------------|------------|----------|
| 1.1 | Phrasing | "[Same intent, different words]" | Same as 1.1 |
| 1.1 | Typos | "[Query with typos]" | Same as 1.1 |
| 1.1 | Verbose | "[Long-winded version]" | Same as 1.1 |
| 1.1 | Terse | "[Minimal version]" | Same as 1.1 |
| 2.1 | Multi-part | "[Combined with another request]" | Handles both |
| 2.1 | Context switch | "[Mid-conversation topic change]" | Handles gracefully |

### Architecture Tests (20-30 cases)

*Validate each component works correctly.*

| Component | Test Type | User Input | Expected Result |
|-----------|-----------|------------|-----------------|
| Knowledge: [Source] | Retrieval | "[Query that should hit this source]" | Correct document cited |
| Knowledge: [Source] | No match | "[Query with no matching content]" | Graceful "I don't have info on that" |
| Connector: [Name] | Execution | "[Action request]" | Action completes successfully |
| Connector: [Name] | Error handling | "[Request that will fail]" | Graceful error message |
| Topic: [Name] | Trigger | "[Trigger phrase]" | Topic activates |
| Routing: Escalation | Sensitive topic | "[Escalation trigger]" | Routes to human/specialist |
| Routing: Child agent | Specialist query | "[Query for child agent]" | Correct child handles |

### Edge Cases (15-20 cases)

*Test boundary conditions and adversarial inputs.*

| Category | User Input | Expected Behavior |
|----------|------------|-------------------|
| **Out of scope** | "[Completely unrelated query]" | Polite decline, offer what agent CAN do |
| **Out of scope** | "[Adjacent but out-of-scope query]" | Redirect to appropriate resource |
| **Adversarial** | "[Prompt injection attempt]" | Ignores injection, stays on task |
| **Adversarial** | "[Request for restricted info]" | Refuses appropriately |
| **Boundary** | "[Very long input - 1000+ chars]" | Handles gracefully or asks to simplify |
| **Boundary** | "[Empty or single word]" | Asks for clarification |
| **Boundary** | "[Multiple languages]" | Responds in user's language or states limitation |
| **Ambiguous** | "[Vague request]" | Asks clarifying questions |
| **Correction** | "Actually, I meant [different thing]" | Adjusts and re-answers |
| **Frustration** | "[Angry/frustrated user]" | Empathetic, de-escalates |

---

## Multi-Turn Test Cases

*For conversational flows that require context across turns.*

### Flow: [Name]

| Turn | User | Agent | Validation |
|------|------|-------|------------|
| 1 | "[Opening query]" | [Expected response type] | Sets context correctly |
| 2 | "[Follow-up]" | [Expected response] | Maintains context |
| 3 | "[Completion or branch]" | [Expected response] | Completes flow correctly |

---

## Eval Execution Guide

### During Build (Foundational Set)

```
For each component built:
1. Identify relevant test cases from foundational set
2. Run those cases in Test Chat
3. Pass? → Continue building
4. Fail? → Analyze using Failure Framework (see CLAUDE.md)
5. Fix → Re-test → Continue
```

### Pre-Deployment (Full Suite)

| Eval Set | Pass Criteria | Tool |
|----------|---------------|------|
| Foundational | 100% pass | Agent Evaluation / Manual |
| Variations | Meet dimension thresholds | Agent Evaluation |
| Architecture | All components functional | Agent Evaluation / Kit |
| Edge Cases | Graceful handling | Manual review |
| Multi-Turn | Flows complete correctly | Copilot Studio Kit |

### Post-Deployment (Ongoing)

| Eval Set | Frequency | Trigger |
|----------|-----------|---------|
| Foundational | Every change | Prompt updates, KB changes, model updates |
| Full Suite | Monthly | Before major releases, quarterly review |
| Regression | On incident | When production issues reported |

---

## Failure Log

*Track failures and fixes for learning.*

| Date | Test # | Failure Type | Root Cause | Fix Applied | Verified |
|------|--------|--------------|------------|-------------|----------|
| | | | | | |
