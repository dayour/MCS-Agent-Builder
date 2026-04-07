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

### Native Adaptive Card chart elements (Chart.Donut, Chart.HorizontalBar, Chart.Gauge, Chart.Line, Chart.Pie) are GA in v1.5 {#tt-005} -- 2026-04-06
**Context:** Fidelity FSC Incident Management agent, building leadership summary with visual charts for Teams demo
**Tried:** Initially used QuickChart.io image URLs in model instructions for chart generation. Researched native AC chart elements.
**Result:** MS Learn confirms 8 native chart types at AC v1.5: Chart.Donut, Chart.Gauge, Chart.VerticalBar.Grouped, Chart.VerticalBar, Chart.HorizontalBar, Chart.HorizontalBar.Stacked, Chart.Line, Chart.Pie. Teams desktop supports v1.5 so they should render natively. Created a Leadership Summary Report topic with Chart.Donut (severity distribution), Chart.HorizontalBar (service health uptime), and Chart.Gauge (response coverage) -- published successfully to MCS. Pending verification in Teams channel.
**Key schema details:**
- Chart.Donut: `data: [{legend: "Label", value: 42, color: "attention"}]` -- colors are semantic (good/warning/attention/neutral/categoricalRed/etc.)
- Chart.HorizontalBar: `data: [{x: "Label", y: 99.5}]` -- has displayMode: AbsoluteWithAxis/AbsoluteNoAxis/PartToWhole
- Chart.Gauge: `value: 83, segments: [{legend: "Label", size: 83, color: "good"}]` -- shows percentage gauge
- Chart.Line: `data: [{legend: "Series", values: [{x: "Label", y: 42}]}]` -- multi-series support
- All support `title`, `colorSet`, and `fallback` properties
**Gotchas:**
- Code Interpreter images do NOT render in Teams/M365 Copilot (official MS FAQ limitation)
- Teams mobile capped at AC v1.2 -- chart elements likely won't render on mobile
- MCS test chat won't render native charts (unknown element type in web chat)
- suggestedActions on same activity as AdaptiveCardTemplate attachment don't render -- card swallows them
- Action.Submit with msteams.imBack only works in Teams, not MCS test chat
- For MCS test chat / web chat, use QuickChart.io image URLs as fallback
- componenttype 9 for topics (not 1 which is Botskill)
**Better approach:** Use native AC chart elements for Teams/M365 (no external dependency, interactive). Keep QuickChart in model instructions as fallback for generative responses. For dedicated topic cards, native charts are superior.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Related cache:** knowledge/cache/adaptive-cards.md
**Tags:** #adaptive-cards #charts #Chart.Donut #Chart.HorizontalBar #Chart.Gauge #Chart.Line #native-charts #quickchart #teams #v1.5

### suggestedActions don't render alongside AdaptiveCardTemplate attachments {#tt-006} -- 2026-04-06
**Context:** FSC Incident Management ConversationStart topic, trying to make buttons work in MCS test chat
**Tried:** Added `suggestedActions` with `type: imBack` on the same `SendActivity` as an `AdaptiveCardTemplate` attachment
**Result:** In MCS test chat, the adaptive card renders but suggestedActions are invisible -- the card attachment swallows the suggested actions. In Teams, the suggestedActions also don't appear (card takes priority).
**Better approach:** For Teams: use Action.Submit with `msteams.imBack` data INSIDE the card. For M365 Copilot: use `conversationStarters` in the agent config (type 15 GptComponentMetadata). For MCS test chat: accept that card buttons won't work, users type instead. Don't try to combine suggestedActions + card attachments on the same activity.
**Confirmed:** 1 build(s) | Last confirmed: 2026-04-06
**Tags:** #suggestedActions #adaptive-cards #msteams #imBack #conversationStarters #cross-channel
