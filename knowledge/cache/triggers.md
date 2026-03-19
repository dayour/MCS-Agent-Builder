<!-- CACHE METADATA
last_verified: 2026-03-19
sources: [MS Learn (authoring-triggers, authoring-triggers-about, planned-features), MCS UI snapshot, WebSearch Mar 2026, knowledge/patterns/topic-patterns/]
confidence: high
refresh_trigger: before_architecture
-->
# MCS Topic Trigger Types

## All Trigger Types (Generative Orchestration)

### YAML Trigger Kinds

| YAML `kind` | UI Name | Fires When | Needs User Input? |
|-------------|---------|------------|-------------------|
| `OnConversationStart` | Conversation Start | Agent first engages user | No |
| `OnRecognizedIntent` | The agent chooses / User says a phrase | AI matches topic or trigger phrases match | Yes |
| `OnMessageActivity` | A message is received | Any message activity arrives | Yes |
| `OnEventActivity` | A custom client event occurs | Event activity from client app | No |
| `OnActivity` | An activity occurs | Any activity type (broadest) | No |
| `OnConversationUpdateActivity` | The conversation changes | User joins/leaves conversation | No |
| `OnInvokeActivity` | It's invoked | Invoke activity (e.g., Teams extensions) | No |
| `OnSystemRedirect` | It's redirected to | Called explicitly from another topic | No |
| `OnInactivity` | The user is inactive for a while | No interaction after configured time | No |
| `OnUnknownIntent` | Fallback / Conversational boosting | No topic matches user message | Yes |
| `OnError` | On Error | Error during conversation | No |
| `OnSignIn` | Sign in | Auth required | No |
| `OnSelectIntent` | Multiple Topics Matched | Disambiguation needed | Yes |
| `OnEscalate` | Escalate | "Talk to agent" matched | Yes |
| `OnPlanComplete` | A plan completes | Agent finishes all planned steps (generative orchestration) | No |
| `OnGeneratedResponse` | AI-generated response about to be sent | AI composes draft before sending (generative orchestration) | No |

### Hidden/Advanced (YAML-only, not in UI)

| Trigger | How to Enable | Purpose |
|---------|--------------|---------|
| `OnKnowledgeRequested` | Name topic exactly `OnKnowledgeRequested` | Intercept knowledge search, inject custom results. System variables: `System.SearchQuery`, `System.KeywordSearchQuery`, `System.SearchResults`. Use with `AutomaticTaskInput(shouldPromptUser:false)` for orchestrator-generated classification. See `knowledge/patterns/topic-patterns/knowledge-routing.yaml`. |
| `ConnectorTriggerOperation` | YAML `kind: ConnectorTriggerOperation` | Event trigger from a Power Automate connector (e.g., SharePoint item created, email received). Distinct from `ConnectorOperation` (which is an action). Used for autonomous agent triggers. |

### Channel-Universal Initialization (OnActivity vs OnConversationStart)

**IMPORTANT:** `OnConversationStart` does **NOT** fire on M365 Copilot channel or embedded surfaces. For JIT initialization patterns (loading user context, glossary, etc.), always use `OnActivity` with `type: Message` instead:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnActivity
  id: main
  type: Message
  condition: =IsBlank(Global.UserCountry)
  actions:
    # ... initialization logic
```

The `=IsBlank()` guard ensures the initialization runs only once per conversation (not on every message). See patterns: `jit-glossary.yaml`, `jit-user-context.yaml`, `conversation-init.yaml`.

## Event Triggers (Autonomous Agents)

Event triggers enable autonomous agent behavior -- the agent acts without user input in response to external events. Requires generative orchestration.

| Feature | Status | Details |
|---------|--------|---------|
| **Event trigger library** | GA | Built-in library of triggers for Microsoft and partner services (Power Automate connectors) |
| **SharePoint event** | GA | Fires when an item is created/modified in SharePoint |
| **OneDrive event** | GA | Fires when a file is created in OneDrive |
| **Dataverse row event** | GA | Fires when a row is added, modified, or deleted |
| **Recurrence (schedule)** | GA | Fires on a recurring time interval (e.g., every 10 minutes) |
| **Planner task event** | GA | Fires when a task is completed in Planner |
| **Email event** | GA | Fires when an email arrives |
| **Custom connectors** | GA | Any Power Automate connector trigger can be used if allowed by data policies |

**Key constraints:**
- Event triggers use maker credentials only (not end-user) for authentication
- All actions called by event-triggered agents must use maker auth for autonomous operation
- Trigger payloads are JSON or plain text containing event data + instructions
- Limit: calling fewer than 15 actions/topics consecutively is recommended
- Billing: each trigger payload counts as a message for billing purposes
- Requires solution-aware cloud flow sharing to be turned on in the environment
- Administrators can block event triggers via data loss prevention policies
- `Activity.Text` may be empty when knowledge sources are invoked; use `LastMessage.Text` instead for reliable previous-message access
- `OnPlanComplete` interacts with knowledge source output: when a knowledge source is used, the output is written directly into the activity, which may replace `Activity.Text` content

## Trigger Enhancements (Mar 2026)

| Feature | Status | Details |
|---------|--------|---------|
| **Trigger conditions with PowerFx** | GA | Add PowerFx conditions to any trigger -- filter when a topic fires based on variable values or expressions |
| **Trigger priority** | GA | Explicit ordering -- set priority when multiple topics could match the same intent. Order: (1) An activity occurs, (2) A message is received / custom event / conversation changes / invoked, (3) The agent chooses / User says a phrase. Same-type: oldest first unless Priority property is set. |
| **Configure triggers with end-user credentials** | **Preview** (Mar 2026), GA May 2026 | Triggers can run authenticated as the end user, enabling user-context-aware trigger logic. Makers can create, configure, test, update, and delete triggers directly in MCS. Enables sharing autonomous agents that run with end-user credentials. |
| **Simplify working with triggers and channels** | GA (Nov 2025) | Streamlined trigger/channel configuration UX |

## Key Patterns

### Auto-Execute at Conversation Start (No User Input)

Use `BeginDialog` in the Conversation Start topic to redirect to another topic:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnConversationStart
  id: main
  actions:
    - kind: SendActivity
      id: sendWelcome
      activity:
        text:
          - "Loading your dashboard..."
    - kind: BeginDialog
      id: redirectToDashboard
      dialog: template-content.topic.YourTopicSchemaName
```

### Topic Chaining (Redirect)

Any topic can call another topic using `BeginDialog` or `ReplaceDialog`:

```yaml
# BeginDialog: calls topic, then returns to caller
- kind: BeginDialog
  id: callSubTopic
  dialog: template-content.topic.SubTopicName

# ReplaceDialog: calls topic, does NOT return to caller
- kind: ReplaceDialog
  id: switchToTopic
  dialog: template-content.topic.OtherTopicName
```

### "By Agent" Trigger (Generative Orchestration Default)

No trigger phrases needed. The AI uses topic `displayName` + `description` to decide when to invoke:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: View Progress
    includeInOnSelectIntent: true
```

Set `modelDescription` on the dialog for even better AI routing:

```yaml
dialog:
  modelDescription: >
    This topic displays the user's onboarding progress.
    Use when user wants to see their completion status.
```

### Trigger Conditions (PowerFx)

Add conditions to filter when a trigger fires:

```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  condition: =Global.UserRole = "Admin"
  intent:
    displayName: Admin Settings
```

### Event Triggers (Autonomous, No User)

Event triggers use Power Automate connector triggers and fire without user input:

```
MCS UI: Add trigger > Schedule / SharePoint / Dataverse / Email / OneDrive / Planner / etc.
```

These are NOT topic YAML -- they are Power Automate flows linked to the agent.
Requires generative orchestration. Uses maker credentials only.
Payload contains event data + optional instructions for the agent.
See "Event Triggers (Autonomous Agents)" section above for full details.

**Trigger payload is the key for autonomous agents.** The `body/message` parameter in the ExecuteCopilot action contains instructions for what the agent should do when triggered. For multi-trigger agents, different triggers can have different payloads, allowing the same agent to perform different tasks based on the event source.

**Programmatic trigger management:** Use `tools/flow-manager.js` for headless CRUD of trigger flows via Dataverse Web API — no Playwright needed. Supports create, update schedule/message, activate/deactivate, and auto-discovery of connection references and copilot parameters.

## YAML Node Reference

Key nodes: `SendActivity`/`SendMessage`, `Question`, `ConditionGroup`, `SetVariable`, `BeginDialog` (call subtopic), `ReplaceDialog` (switch, no return), `EndDialog`, `EndConversation`, `SearchAndSummarizeContent`, `OAuthInput`, `HttpRequest`

Variables: see `knowledge/cache/powerfx-variables.md`
