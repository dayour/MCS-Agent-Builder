# Use Case: [Agent Name]

## Problem Statement

[What problem does this agent solve? Be specific about the pain point, who experiences it, and the impact.]

## Goals

[Measurable success criteria - what outcomes define success?]

- [ ] [Measurable goal #1 - e.g., "Reduce average response time from 24h to instant"]
- [ ] [Measurable goal #2 - e.g., "Handle 80% of inquiries without human escalation"]
- [ ] [Measurable goal #3 - e.g., "Achieve 90% user satisfaction rating"]

## Challenges

[What makes this difficult? Technical, organizational, or domain challenges.]

- [Challenge #1 - e.g., "Data spread across multiple systems"]
- [Challenge #2 - e.g., "Complex eligibility rules that change quarterly"]
- [Challenge #3 - e.g., "Users have varying levels of technical expertise"]

## Users

- **Primary:** [Main user group who will interact with the agent most frequently]
- **Secondary:** [Supporting user group with occasional use]
- **Tertiary:** [Stakeholders or infrequent users]

## High-Level Solution

[Brief description of the agent approach - what it will do, what data it will use, what capabilities it will have.]

---

## Key Scenarios (6-10)

*Representative user interactions that the agent must handle. Include happy paths, edge cases, and boundary scenarios.*

### Happy Path Scenarios
1. **[Scenario Name]:** [User need and expected interaction]
2. **[Scenario Name]:** [User need and expected interaction]
3. **[Scenario Name]:** [User need and expected interaction]

### Edge Cases
4. **[Scenario Name]:** [Unusual but valid request]
5. **[Scenario Name]:** [Unusual but valid request]

### Boundary Scenarios
6. **[Scenario Name]:** [Request at the edge of scope]
7. **[Scenario Name]:** [Request that should be declined gracefully]

### Error Recovery
8. **[Scenario Name]:** [How agent handles failures or confusion]

---

## Critical Quality Dimensions

*Define thresholds specific to this agent. Not all dimensions apply to every agent.*

| Dimension | Threshold | Rationale |
|-----------|-----------|-----------|
| **Accuracy** | [e.g., 95%] | [Why this level matters for this use case] |
| **Grounding** | [e.g., 100%] | [Why - e.g., "Compliance requires zero hallucination"] |
| **Empathy** | [e.g., High] | [Why - e.g., "Users are often frustrated when contacting support"] |
| **Response Time** | [e.g., <3s] | [Why - e.g., "Real-time assistance expectation"] |
| **Escalation Rate** | [e.g., <15%] | [Why - e.g., "Goal is 85% self-service resolution"] |

---

## Scope & Boundaries

### HANDLE (Agent should complete these fully)

- [Task/request type the agent owns end-to-end]
- [Task/request type the agent owns end-to-end]
- [Task/request type the agent owns end-to-end]

### DECLINE GRACEFULLY (Redirect with helpful guidance)

- [Request type] → [Where to redirect and why]
- [Request type] → [Where to redirect and why]

### OUT OF SCOPE (Refuse)

- [Request type that agent should not attempt - e.g., "Requests for other departments"]
- [Request type that agent should not attempt - e.g., "Personal advice outside domain"]

---

## Constraints

- [Technical constraint - e.g., "Must integrate with legacy CRM via API"]
- [Compliance constraint - e.g., "Cannot store PII beyond session"]
- [Operational constraint - e.g., "Must work during business hours only"]
- [Budget constraint - e.g., "Premium connectors not approved"]
