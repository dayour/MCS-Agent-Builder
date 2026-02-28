<!-- CACHE METADATA
last_verified: 2026-02-27
sources: [MS Learn, MCS UI, community, WebSearch Feb 2026, MS Learn MCP Feb 2026, Copilot Blog Feb 2026]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Power Automate Integration — Quick Reference

## Agent Flows vs Cloud Flows (Critical)

| Aspect | Agent Flows (Native) | Cloud Flows (PA) |
|--------|---------------------|------------------|
| Created in | Copilot Studio | Power Automate |
| PA license needed? | **No** (Copilot Credits, per-action billing) | Yes |
| Desktop flows? | No | Yes |
| Conversion | Cloud → Agent (one-way, irreversible, must be in solution) | — |
| Trigger | `When an agent calls the flow` | `Run a flow from Copilot` |
| Human-in-the-loop actions? | **Yes** (RFI, AI Approvals, Multistage Approvals) | Limited (standard approvals only) |
| Copy/Share/Co-owners? | **No** (not supported in Copilot Studio) | Yes |
| Premium connectors? | **Yes** (included with Copilot Studio plan) | Requires premium license |
| Creation methods | Natural language OR visual designer | Visual designer |

### Agent Flow Advantages Over Cloud Flows

- **Higher throughput / lower latency** — optimized execution path
- **Human-in-the-loop actions** (Request for Information, AI Approvals) — not available in cloud flows
- **Copilot credits billing** — no per-user PA licensing needed, scales enterprise-wide
- **End-to-end visibility** — design, monitor, and get insights in Copilot Studio unified UI
- **Solutions-based** — supports drafts, versioning, export/import

## Input/Output — ONLY 3 Types Supported

| Supported | NOT Supported |
|-----------|--------------|
| **String**, **Number**, **Boolean** | Object, Date, List/Array |

**Workarounds**: serialize JSON/arrays/dates as String, parse inside flow.

## Execution Limits

| Limit | Value |
|-------|-------|
| Synchronous response | **100 seconds** (agent flow default) |
| Express mode (preview) | **2 minutes** timeout, **100 action** limit, **1,024 char** variable limit, **64 KB** message size per action |
| Data received from flow | **1 MB** per action |
| Connector payload | **5 MB** (public) / **450 KB** (GCC) |
| Actions after Respond to Agent | Up to **30 days** |
| Apply-to-each loop (express) | Max **100 items** |
| Do-until loop (express) | Max **100 iterations** |

## Event Triggers (Autonomous Agents)

Requires generative orchestration. Triggers use **maker credentials only**.

| Trigger | Event |
|---------|-------|
| Dataverse | Row added/modified/deleted |
| SharePoint | Item/file created |
| Outlook | New email |
| Planner | Task completed/assigned |
| Recurrence | Time schedule |
| Teams / OneDrive / Dynamics 365 | Various events |

**Payload instructions**: customize per-trigger what agent should do. Better than agent-level instructions for multi-trigger agents.

## Express Mode (Preview) — Details

Agent flows with `When an agent calls the flow` or `When an app calls a flow` trigger. Provides faster execution on a simplified pipeline.

**When to use**: Logic-heavy flows (not data-heavy), time-sensitive responses to agents.
**When NOT to use**: Data-heavy flows (large table queries, 1500+ rows), fire-and-forget (no response action needed).
**Limitations**: No `Delay` or `Webhook` actions. Loop iterations may not appear in Run details. Not all environments support it yet (depends on new architecture).
**No extra cost** — same Copilot Studio per-action billing.
**Availability**: Auto-rolling to environments on new architecture. Check for express mode toggle on trigger card.

## Human-in-the-Loop Actions (Agent Flows Only)

| Action | Status | Description |
|--------|--------|-------------|
| **Request for Information (RFI)** | Preview (Jul 2025+) | Pauses flow, sends structured form via Outlook, collects 5 input types (Text, Yes/No, Email, Number, Date). First responder's input used. Tenant-internal only. |
| **Multistage Approvals** | Preview | Sequential human + AI review stages. Combines automated + human decision-making. |
| **AI Approvals** | Preview | AI evaluates requests using business rules — analyzes unstructured data, interprets documents, applies nuanced logic. Human oversight for final decisions. |

**RFI input options**: Required/optional fields, single-select dropdowns, multi-select lists, placeholder text guidance.
**RFI limitation**: Requests sent via Outlook only (more platforms planned). Cannot send to users outside tenant.

## Flow Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `FlowActionTimedOut` | >100 sec | Optimize, express mode, defer work after Respond |
| `FlowActionBadRequest` | Type mismatch | Verify variable types match |
| `AsyncResponsePayloadTooLarge` | Output too large | Reduce payload, filter |
| `BindingKeyNotFoundError` | Inputs changed | Remove and re-add flow |

## Flow vs Connector Decision

| Need | Use |
|------|-----|
| Single API call | Connector action (direct) |
| Multi-step logic / transforms | Agent flow |
| Approval workflow (human + AI) | Agent flow (multistage + AI approvals) |
| Human data collection mid-process | Agent flow (Request for Information) |
| Error handling beyond basic | Agent flow |
| RPA / desktop automation | Computer Use tool (NOT flow) |

## Capacity / Billing

| Scenario | Credits Consumed |
|----------|-----------------|
| Flow run from topic | 1 Classic answer + agent flow actions |
| Flow run via generative orchestration | 1 Autonomous action + agent flow actions |
| Flow run from test chat | Agent flow actions only (no direct message cost) |
| Test in designer | **Free** (but prompt builder / AI features still metered) |
| Event trigger activation | 1 trigger payload message per activation |

**Polling frequency**: Free plan = 15 min, Office 365 = 5 min.

**User credentials in flows**: Cloud flows can run with **user credentials** in supported authenticated agents. Not yet supported in environments using **customer-managed keys (CMK)** — use specific connections instead of "Provided by run-only user".
