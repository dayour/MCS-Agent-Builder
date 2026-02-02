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

### Multi-Agent Routing Tests (If applicable)

*Test orchestrator-to-specialist routing and response integration.*

#### Level 1: Specialist Unit Tests
*Test each specialist agent in isolation (without orchestrator).*

| Specialist | Test Type | User Input | Expected Result |
|------------|-----------|------------|-----------------|
| [Specialist Name] | Core function | "[Direct query to specialist]" | Correct, complete response |
| [Specialist Name] | Edge case | "[Edge case query]" | Handles gracefully |
| [Specialist Name] | Out of scope | "[Query outside specialist domain]" | Declines appropriately |
| [Specialist Name] | Knowledge retrieval | "[Query requiring KB lookup]" | Correct source cited |
| [Specialist Name] | Tool execution | "[Action request]" | Action completes |

#### Level 2: Routing Tests
*Test orchestrator correctly routes to specialists.*

| Intent | User Input | Expected Routing | Validation |
|--------|------------|------------------|------------|
| [Intent 1] | "[Query matching specialist 1]" | → /[Specialist1] | Correct specialist activated |
| [Intent 2] | "[Query matching specialist 2]" | → /[Specialist2] | Correct specialist activated |
| [Intent 3] | "[Query matching specialist 3]" | → /[Specialist3] | Correct specialist activated |
| General | "[General query, no specialist needed]" | → Orchestrator handles | No specialist called |
| Ambiguous | "[Unclear which specialist]" | → Clarifying question | Orchestrator asks before routing |
| Multi-domain | "[Query spanning 2 specialists]" | → Sequential or primary | Handled appropriately |

#### Level 3: Context Handoff Tests
*Test context is properly passed to specialists.*

| Scenario | Setup | User Input | Validation |
|----------|-------|------------|------------|
| Context passed | User provides info in turn 1 | Turn 2: "[Query needing turn 1 context]" | Specialist receives context |
| Entity passed | User mentions customer name | "[Query about that customer]" | Specialist has customer ID |
| History preserved | Multi-turn conversation | "[Follow-up question]" | Relevant history available |

#### Level 4: Response Integration Tests
*Test orchestrator properly integrates specialist responses.*

| Scenario | Specialist Response | Expected Orchestrator Behavior |
|----------|---------------------|--------------------------------|
| Direct answer | Clear, complete response | Passes through (possibly summarized) |
| Partial answer | Incomplete response | Orchestrator adds context or asks follow-up |
| Error response | Specialist fails | Graceful fallback, doesn't expose error |
| Decline response | Specialist can't handle | Orchestrator tries alternative or handles directly |

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

### Multi-Agent Flow: [Name] (If applicable)

*Test conversations that span multiple specialists.*

| Turn | User | Routing | Response | Validation |
|------|------|---------|----------|------------|
| 1 | "[Query for Specialist A]" | → /SpecialistA | [Response] | Correct routing, context set |
| 2 | "[Follow-up still for A]" | → /SpecialistA | [Response] | Same specialist, context maintained |
| 3 | "[Switch to Specialist B topic]" | → /SpecialistB | [Response] | Clean switch, relevant context passed |
| 4 | "[Return to Specialist A topic]" | → /SpecialistA | [Response] | Original context recovered |
| 5 | "[General question]" | → Orchestrator | [Response] | No specialist needed |

### Specialist Handoff Flow: [Name]

*Test when one specialist needs to hand off to another.*

| Turn | User | Routing | Response | Validation |
|------|------|---------|----------|------------|
| 1 | "[Complex query]" | → /SpecialistA | [Partial answer + handoff] | Specialist recognizes limit |
| 2 | [Automatic] | → /SpecialistB | [Completes answer] | Orchestrator coordinates handoff |
| 3 | "[Follow-up]" | → [Appropriate] | [Response] | Context from both specialists available |

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
