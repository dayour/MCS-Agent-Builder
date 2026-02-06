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

---

## Data Sources & Integration

### M365 Copilot Availability

| Question | Answer |
|----------|--------|
| Does the customer have M365 Copilot licenses? | Yes / No / Partial |
| If yes, for which user groups? | [e.g., "All employees" / "Sales team only"] |
| Admin consent available for new apps? | Yes / No / Unknown |

### Data Sources Needed

| Data Type | Source System | Access Method Options |
|-----------|---------------|----------------------|
| Documents | [e.g., SharePoint, OneDrive] | SharePoint Connector / WorkIQ MCP |
| Emails | [e.g., Outlook/Exchange] | Outlook Connector / WorkIQ MCP |
| Meetings/Calendar | [e.g., Outlook Calendar] | Calendar Connector / WorkIQ MCP |
| Teams Messages | [e.g., Teams channels] | Teams Connector / WorkIQ MCP |
| CRM Data | [e.g., Salesforce, Dynamics] | [Specific connector] |
| Other | [System] | [Connector/API] |

### Integration Strategy Decision

- [ ] **WorkIQ MCP** - Customer has M365 Copilot, wants unified M365 access (Preview)
- [ ] **Traditional Connectors** - Separate connectors for each data source (GA, production-ready)
- [ ] **Hybrid** - WorkIQ for M365 data, traditional connectors for non-M365 systems

*Note: WorkIQ MCP is in Public Preview. For production agents requiring GA stability, use traditional connectors.*

---

## Domain Decomposition (Multi-Agent Analysis)

*Every solution should be designed with multi-agent architecture in mind. Identify specialist domains even if starting with a single agent.*

### Specialist Domain Analysis

| Question | Answer |
|----------|--------|
| What distinct knowledge domains are needed? | [List domains - e.g., "Policy knowledge, Product catalog, Customer data"] |
| What different systems need to be accessed? | [List systems - e.g., "CRM, ERP, Knowledge base"] |
| What skills require deep expertise? | [List skills - e.g., "Compliance rules, Technical troubleshooting"] |
| What could be reused by other agents? | [List reusable components - e.g., "Customer lookup, Authentication"] |
| What needs separate team ownership? | [List team-owned domains - e.g., "Legal content owned by Legal team"] |

### Proposed Agent Architecture

*Choose one:*

**Option A: Multi-Agent (Recommended for 2+ domains)**

| Agent | Role | Owns | Reusable? |
|-------|------|------|-----------|
| **Orchestrator:** [Name] | User-facing, routes to specialists | Conversation flow, general guidance | N/A |
| **Specialist:** [Name] | [Domain expertise] | [Knowledge sources, integrations] | Yes/No |
| **Specialist:** [Name] | [Domain expertise] | [Knowledge sources, integrations] | Yes/No |
| **Specialist:** [Name] | [Domain expertise] | [Knowledge sources, integrations] | Yes/No |

**Option B: Single Agent (Multi-Agent Ready)**

| Component | Future Specialist Candidate | Trigger for Split |
|-----------|----------------------------|-------------------|
| [Knowledge area 1] | [Potential agent name] | [When to carve out - e.g., "When reused by other agents"] |
| [Knowledge area 2] | [Potential agent name] | [When to carve out - e.g., "When owned by different team"] |
| [Integration 1] | [Potential agent name] | [When to carve out - e.g., "When complexity grows"] |

### Architecture Decision

- [ ] **Multi-Agent Now** - Proceeding with orchestrator + specialists
- [ ] **Single Agent (Multi-Agent Ready)** - Starting simple, documented decomposition points for future
