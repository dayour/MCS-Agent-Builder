# Agent Intake Form - EXAMPLE

*Fidelity: Confluence Knowledge Creation Agent*

---

## 1. The Problem (2-3 sentences)

**What pain are we solving?**
> When engineers close Jira tickets, closure notes are inconsistent or missing. Downstream teams (support, other engineers) can't reliably find prior work, learnings, or resolutions in Confluence. This leads to repeated troubleshooting, lost knowledge, and wasted time.

---

## 2. Users

| Role | How they'll use the agent | Volume |
|------|---------------------------|--------|
| Engineers | Triggered when closing Jira tickets; can also invoke via Teams/Copilot Chat | ~50 closures/week |
| Support teams | Benefit from standardized docs (indirect users) | N/A |

---

## 3. Key Scenarios (5-8)

| # | User does... | Agent should... |
|---|--------------|-----------------|
| 1 | Closes Jira ticket with detailed closure notes | Normalize notes into standard Confluence template, create page |
| 2 | Closes Jira ticket with minimal/no notes | Prompt user for required info before publishing |
| 3 | Says "Complete the workflow for JIRA-1234" in Teams | Pull ticket data, draft Confluence content, ask clarifying questions, publish on approval |
| 4 | Asks to update an existing Confluence page with new info | Find existing page, append/update content |
| 5 | Closes ticket but Confluence page already exists for that topic | Link to existing page or offer to update it |
| 6 | Ticket closed in error, user wants to undo doc creation | Offer to delete/archive the Confluence page |

---

## 4. Data Sources (Read)

| Source | Type | Access | Owner |
|--------|------|--------|-------|
| Jira | On-prem | Existing Fidelity custom connector | Platform team |
| Confluence | Cloud/On-prem? | Connector/API - needs create/update permissions | Platform team |
| Confluence templates | N/A | Must define "definition of done" template | Business owner |

---

## 5. Actions (Write/Execute)

| Action | Target System | Trigger | Approvals needed? |
|--------|---------------|---------|-------------------|
| Create Confluence page | Confluence | Jira ticket status → Done | Yes - user confirms before publish |
| Update Confluence page | Confluence | User request | Yes |
| Post summary to Teams | Teams | After Confluence publish (optional) | No |

---

## 6. Scope Boundaries

| Handle fully | Decline gracefully | Out of scope |
|--------------|-------------------|--------------|
| Jira → Confluence documentation workflow | Requests about non-engineering tickets → "This agent handles engineering tickets only" | Creating Jira tickets |
| Interactive doc completion via Teams | Bulk/batch documentation requests → "Please process one at a time" | Editing Jira ticket content |
| Updating existing Confluence pages | | General Confluence Q&A |

---

## 7. Quality Bar

| Dimension | Threshold | Why |
|-----------|-----------|-----|
| [x] Grounding | 100% | All content must come from Jira ticket - no invented details |
| [x] Automation rate | 80% | 80% of closures should complete without user intervention |
| [x] Template compliance | 95% | Generated pages must follow standard template structure |

---

## 8. Constraints & Dependencies

- **Technical:** Jira is on-prem - must use existing Fidelity custom connector
- **Security:** Agent must respect user RBAC - only access tickets user can see
- **Compliance:** No PII in public Confluence spaces
- **Dependencies:**
  - Confluence template must be defined (fields, structure)
  - Connector scoped to correct Confluence spaces
  - Test create/update permissions before go-live

---

## 9. Solution Direction

- **Agent type preference:** [x] Copilot Agent with autonomous trigger
- **Build approach:** [x] Low-code (Copilot Studio)
- **Existing connectors/APIs:** Fidelity custom Jira connector (on-prem)
- **Team skills:** Low-code preferred

---

## 10. Success Criteria

- [ ] 80% of Jira closures result in standardized Confluence pages
- [ ] Downstream teams can find prior resolutions via Confluence search
- [ ] Reduced context-switching for engineers (don't leave Jira/Teams to document)

---

## Key Contacts

| Role | Name | Responsibility |
|------|------|----------------|
| Business owner | [TBD] | Define "done" criteria, template approval |
| Technical owner | [TBD] | Jira connector, Confluence API access |
| End user rep | [TBD] | Testing, feedback on generated docs |

---

## Evaluation Guidance - EXAMPLES

| Scenario # | Test Input | Must include | Must NOT include | Expected behavior |
|------------|------------|--------------|------------------|-------------------|
| 1 | Close JIRA-1234: "Fixed null pointer in auth module by adding null check in UserService.java line 42" | Problem summary, resolution steps, file/line reference, link to Jira | Made-up code references, unrelated tickets | Creates Confluence page in Engineering space |
| 2 | Close JIRA-5678 with no closure notes | Prompt asking: "What was the problem? How was it resolved?" | Auto-generated fake resolution | Waits for user input before creating page |
| 3 | "Complete the workflow for JIRA-9999" (ticket still open) | Message: "This ticket isn't closed yet" | Attempt to create doc for open ticket | Explains ticket must be closed first |
| 4 | Close ticket where Confluence page already exists | "Found existing page [link]. Update it or create new?" | Duplicate page creation | Offers choice, respects user decision |
| 5 | "Undo the doc for JIRA-1234" | Confirmation prompt, then archive/delete | Immediate deletion without confirmation | Requires user confirmation |
