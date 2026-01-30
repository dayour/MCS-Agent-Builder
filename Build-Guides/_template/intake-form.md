# Agent Intake Form

*Complete this form to kickstart agent development. Be specific - vague answers lead to rework.*

---

## 1. The Problem (2-3 sentences)

**What pain are we solving?**
> [Describe the current state: What's manual, slow, error-prone, or frustrating? Who feels this pain?]

**Example:** "When Jira tickets close, engineers write inconsistent closure notes (or none). Downstream teams can't find prior resolutions in Confluence, leading to repeated troubleshooting and lost knowledge."

---

## 2. Users

| Role | How they'll use the agent | Volume |
|------|---------------------------|--------|
| [e.g., Engineers] | [e.g., Triggered when closing Jira tickets] | [e.g., ~50 closures/week] |
| [e.g., Support teams] | [e.g., Search for past resolutions] | |

---

## 3. Key Scenarios (5-8)

*What must the agent handle? Be specific about inputs and expected outputs.*

| # | User does... | Agent should... |
|---|--------------|-----------------|
| 1 | Closes a Jira ticket with closure notes | Normalize notes into Confluence template, create/update page |
| 2 | Closes ticket with minimal notes | Prompt for required info before publishing |
| 3 | Asks "Complete the workflow for JIRA-1234" | Pull ticket data, draft Confluence content, request approval |
| 4 | | |
| 5 | | |

---

## 4. Data Sources (Read)

*Where does the agent get information?*

| Source | Type | Access | Owner |
|--------|------|--------|-------|
| [e.g., Jira] | [On-prem/Cloud] | [Existing connector? API?] | [Team/person] |
| [e.g., Confluence] | | | |
| | | | |

---

## 5. Actions (Write/Execute)

*What does the agent DO beyond answering questions?*

| Action | Target System | Trigger | Approvals needed? |
|--------|---------------|---------|-------------------|
| [e.g., Create Confluence page] | Confluence | Jira ticket closed | [Yes - user confirms before publish] |
| [e.g., Update existing page] | Confluence | | |
| | | | |

---

## 6. Scope Boundaries

| Handle fully | Decline gracefully | Out of scope |
|--------------|-------------------|--------------|
| [Tasks agent owns] | [Redirect to...] | [Refuse] |
| | | |

---

## 7. Quality Bar

*What matters most for this agent? Pick 2-3 and set thresholds.*

| Dimension | Threshold | Why |
|-----------|-----------|-----|
| [ ] Accuracy | [e.g., 95%] | |
| [ ] Grounding (no hallucination) | [e.g., 100%] | |
| [ ] Automation rate | [e.g., 80% without human intervention] | |
| [ ] Response time | [e.g., <5s] | |
| [ ] User satisfaction | [e.g., 4/5 rating] | |

---

## 8. Constraints & Dependencies

- **Technical:** [e.g., Jira is on-prem - need custom connector]
- **Security:** [e.g., RBAC required, agent must respect user permissions]
- **Compliance:** [e.g., No PII in Confluence pages]
- **Dependencies:** [e.g., Confluence template must be defined first]

---

## 9. Solution Direction (Optional)

*Any preferences or existing work?*

- **Agent type preference:** [ ] Copilot Agent [ ] Declarative Agent [ ] Autonomous [ ] Multi-agent [ ] No preference
- **Build approach:** [ ] Low-code (Copilot Studio) [ ] Pro-code [ ] Hybrid [ ] No preference
- **Existing connectors/APIs:** [List any]
- **Team skills:** [Low-code / Pro-code / Languages]

---

## 10. Success Criteria

*How will we know this worked?*

- [ ] [e.g., 80% of Jira closures result in standardized Confluence pages]
- [ ] [e.g., Time to document reduced from 15min to 2min]
- [ ] [e.g., Downstream teams find resolutions 50% faster]

---

## Key Contacts

| Role | Name | Responsibility |
|------|------|----------------|
| Business owner | | Final decisions |
| Technical owner | | System access, APIs |
| End user rep | | Testing, feedback |

---

## Evaluation Guidance

*After filling this form, create 2-3 test cases per scenario using this format:*

| Scenario # | Test Input | Must include | Must NOT include | Expected behavior |
|------------|------------|--------------|------------------|-------------------|
| 1 | "Close JIRA-1234 with notes: Fixed null pointer in auth module" | Confluence page with: problem summary, resolution, related tickets | Made-up ticket numbers, unrelated content | Creates page in correct space, links to Jira |
| 2 | "Close JIRA-5678" (no notes provided) | Prompt asking for closure notes | Auto-generated fake notes | Asks user for required info before proceeding |

*Aim for 15-20 test cases covering happy paths, edge cases, and error scenarios.*
