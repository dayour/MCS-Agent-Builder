<!-- CACHE METADATA
last_verified: 2026-03-12
sources: [skills-for-copilot-studio repo, ObjectModel repo, Elevate repo, build experience, MS Learn, community reports]
confidence: high
refresh_trigger: before_build
-->
# MCS Known Issues & YAML Gotchas

Documented issues with mitigations. Categories: YAML syntax, publish failures, connector issues, channel quirks, Dataverse API.

---

## YAML Syntax Issues

### AdaptiveCardPrompt requires literal block scalar
**Issue:** Inline JSON in `card:` property causes parse errors.
**Mitigation:** Always use `card: |` (literal block scalar), never inline JSON.
```yaml
# WRONG
card: { "type": "AdaptiveCard", ... }

# CORRECT
card: |
  {
    "type": "AdaptiveCard",
    ...
  }
```

### AdaptiveCardPrompt requires output/outputType even for display-only cards
**Issue:** Omitting `output.binding` or `outputType.properties` causes silent failure — card renders but submit does nothing.
**Mitigation:** Always include `output.binding`, `outputType.properties`, and `Action.Submit` — even for info-only cards. Use a dummy "OK" button and minimal binding.

### aIModelId must come AFTER input/output in InvokeAIBuilderModelAction
**Issue:** Placing `aIModelId` before `input`/`output` causes validation failure.
**Mitigation:** Always place `aIModelId` as the last property.

### Input binding needs `=` prefix, output binding must NOT have `=`
**Issue:** Swapping these causes silent data loss — variables appear empty.
**Mitigation:** Data IN: `fieldName: =Topic.var` (with `=`). Data OUT: `fieldName: Topic.var` (no `=`).

### TextSegment uses `value` not `text` in ObjectModel JSON
**Issue:** Using `text` property in TextSegment causes validation failure.
**Mitigation:** Use `value` property: `{ "$kind": "TextSegment", "value": "Hello" }`.

### Question `variable` is a string, not an object
**Issue:** Wrapping `variable` in an object causes parse error.
**Mitigation:** `variable: init:Topic.userName` (plain string).

### Intent needs `$kind: "Intent"` wrapper in ObjectModel JSON
**Issue:** Omitting `$kind` wrapper causes intent to be ignored.
**Mitigation:** Always wrap: `{ "$kind": "Intent", "displayName": "...", ... }`.

---

## Publish Failures

### triggerQueries may block publish on generative orchestration agents
**Issue:** Adding `triggerQueries` to `OnRecognizedIntent` on a gen orchestration agent can cause publish failure.
**Mitigation:** Use "by agent" trigger (displayName only, no triggerQueries) for gen orchestration. Use `modelDescription` on the dialog for better routing.

### OnConversationStart does NOT fire on M365 Copilot channel
**Issue:** Topics using `OnConversationStart` trigger never fire when the agent is used via M365 Copilot or embedded surfaces.
**Mitigation:** Use `OnActivity` with `type: Message` and `=IsBlank()` guard for initialization patterns. See `knowledge/patterns/topic-patterns/conversation-init.yaml`.

### Agent description max length
**Issue:** `botcomponent.description` column has a max length; exceeding it silently truncates.
**Mitigation:** Keep agent descriptions under 1,024 characters. `cr3f1_stagedescription` has MaxLength = 100.

---

## Connector Issues

### M365 Users connector requires user authentication
**Issue:** `UserGet_V2` returns 401 if user is not authenticated.
**Mitigation:** Ensure "Authenticate with Microsoft" is enabled in agent settings. The connector uses the signed-in user's identity.

### Azure AD profile fields may be blank
**Issue:** Fields like `country`, `department`, `jobTitle` are optional in Azure AD and may be null.
**Mitigation:** Always use fallback: `=If(IsBlank(Topic.M365Profile.country), "Unknown", Topic.M365Profile.country)`.

---

## Channel Quirks

### Action.Execute not supported in Web Chat
**Issue:** Using `Action.Execute` in adaptive cards causes silent failure in Web Chat.
**Mitigation:** Always use `Action.Submit` instead.

### Teams adaptive card size limit ~28KB
**Issue:** Cards exceeding ~28KB return HTTP 413 error in Teams.
**Mitigation:** Keep card payloads under 28KB. For large data sets, paginate or link to external content.

### WhatsApp has very limited adaptive card support
**Issue:** Most adaptive card features don't render on WhatsApp.
**Mitigation:** Use plain text `SendActivity` for WhatsApp channels. Check channel before sending cards.

---

## Dataverse API Issues

### OData `$filter` with `_parentbotid_value` is unreliable
**Issue:** Filtering botcomponents by `_parentbotid_value` via OData returns incomplete results.
**Mitigation:** Use FetchXML with `parentbotid` for reliable filtering.

### `$select=data` on botcomponents returns empty
**Issue:** Selecting only the `data` column returns empty results.
**Mitigation:** Query the full entity (no `$select`) or select additional columns alongside `data`.

### Raw POST to `/botcomponents` creates records MCS doesn't see
**Issue:** Records created via direct Dataverse POST exist in the table but don't appear in MCS UI.
**Mitigation:** Use Island Gateway API `BotComponentInsert` for new topics. Use LSP push for updates to existing components.

### LSP push reports "0 changes" on new agents
**Issue:** First push to a new agent reports 0 changes even though content was sent.
**Mitigation:** `verifyAndPatchBody()` in `mcs-lsp.js` has a fallback that patches via Dataverse. Verify by querying Dataverse after push.

---

## PowerFx Issues

### No regex support in PowerFx
**Issue:** PowerFx has no native regex functions for string manipulation.
**Mitigation:** Use nested `Substitute()` for pattern removal (e.g., citation stripping). For validation, use adaptive card `regex` property on Input fields.

### System.* variables need assignment to Topic.* first
**Issue:** Some `System.*` variables can't be used directly in PowerFx expressions or card templates.
**Mitigation:** Assign to a `Topic.*` variable first, then reference the topic variable.

---

## Refresh Notes

- New issues should be added with category headers
- Remove issues confirmed fixed in newer MCS releases
- Cross-reference with `knowledge/learnings/` for build-specific issues
- Check MS Learn release notes monthly for resolved issues
