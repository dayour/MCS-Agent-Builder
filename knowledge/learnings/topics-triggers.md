# Topic & Trigger Learnings

Lessons learned about topic YAML, trigger types, generative orchestration, adaptive cards. Consulted during `/mcs-research` Phase C, `/mcs-build` Step 4, and `/mcs-fix` Step 2.

<!--
Entry format:
### [Title] {#id} — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s) | Last confirmed: [YYYY-MM-DD]
**Related cache:** [cache file(s) if applicable]
**Tags:** #tag1 #tag2

ID format: tt-NNN (topics-triggers)
-->

### Question entity must use flat string format {#tt-001} -- 2026-02-19
**Context:** Topic Engineer constrained generation test, Order Lookup topic
**Tried:** Nested object format for entity: `entity:\n  entityType: StringPrebuiltEntity`
**Result:** om-cli rejected with `UnknownElementError` — the nested format is not valid
**Better approach:** Use flat string format: `entity: StringPrebuiltEntity`. Consistent with all existing topic patterns.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-19
**Related cache:** knowledge/patterns/topic-patterns/multi-turn.yaml
**Tags:** #yaml #question #entity #validation

### M365 Copilot: use conversationStarters, not suggestedActions for welcome buttons {#tt-002} -- 2026-02-27
**Context:** CDW Account Prospecting Agent, M365 Copilot channel, needed 3 action buttons on conversation start
**Tried:** `suggestedActions` in Conversation Start topic YAML (quick reply buttons)
**Result:** Buttons don't appear. On M365 Copilot, the welcome page with Suggested Prompts shows first — the Conversation Start topic fires passively AFTER the user initiates. So `suggestedActions` in the topic are never seen.
**Better approach:** Use `conversationStarters` array in `agent.mcs.yml` (GptComponentMetadata). These render as clickable prompts on the M365 Copilot welcome page. Schema: `kind: ConversationStarter` with `title` and `text` (both required). Keep Conversation Start topic as a simple greeting for channels where it DOES auto-fire (Teams, Web Chat).
**LSP push confirmed:** `conversationStarters` in agent.mcs.yml pushes successfully via LSP. Maps to "Suggested prompts" section on Overview page. Roundtrip verified: write YAML → `mcs-lsp.js push` → PvaPublish → pull confirms persistence. MCS Test Chat does NOT render them (test chat limitation) — verify via Overview page or M365 Copilot.
**Confirmed:** 2 build(s) | Last confirmed: 2026-02-27
**Related cache:** knowledge/cache/channels.md, knowledge/cache/adaptive-cards.md
**Tags:** #m365-copilot #conversation-start #suggested-actions #conversationStarters #channel-behavior #lsp

### Topic phase must match its dependency phases {#tt-003} — 2026-02-27
**Context:** CDW Account Prospecting — "Scheduled Prospect Delivery" topic tagged `mvp` but its Power Automate flow integration was tagged `future`
**Tried:** Topic listed in brief as `phase: mvp`, `topicType: custom`, `triggerType: event`. Its `connectedIntegrations` referenced "Power Automate Agent Flow (Scheduled Prospect Delivery)" which was `phase: future`.
**Result:** Build Step 4 would have tried to author the topic but it can't function without the event trigger flow. The topic was effectively undeliverable for MVP.
**Better approach:** Research Phase C should validate: if ALL `connectedIntegrations` for a topic are `future`, the topic should be `future` too. Build Step 4 should also check: before authoring a topic, verify its dependencies (integrations, knowledge sources) exist in the MVP scope. Flag mismatches as WARNINGs: "Topic '{name}' depends on '{integration}' which is tagged future."
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-27
**Related cache:** knowledge/cache/triggers.md
**Tags:** #topics #phase #dependencies #integration #validation #event-trigger

### MyProfile_V2 is the correct operationId for M365 Users connector (NOT UserGet_V2) {#tt-004} — 2026-03-20
**Context:** CDW Legal & HR Policy Advisor, UserContextInit topic with JIT user context loading via Office 365 Users connector
**Tried:** `operationId: UserGet_V2` in InvokeConnectorAction — this was the operationId in our pattern files (`jit-user-context.yaml`, `conversation-init.yaml`)
**Result:** Connector action spun infinitely in MCS runtime. The operationId `UserGet_V2` does not exist on the Office 365 Users connector. No publish error — the failure is silent at runtime only.
**Better approach:** Use `operationId: MyProfile_V2` for signed-in user profile (returns country, department, displayName, etc.). For looking up a specific user by UPN, use `operationId: UserProfile_V2`. Both pattern files have been corrected. Always verify operationIds against the actual connector schema — invalid IDs cause silent runtime failures, not publish errors.
**Confirmed:** 1 build(s) | Last confirmed: 2026-03-20
**Related cache:** knowledge/cache/known-issues.md (Connector Issues section)
**Tags:** #operationId #connector #office365users #MyProfile_V2 #UserGet_V2 #silent-failure #jit-user-context #pattern-fix
