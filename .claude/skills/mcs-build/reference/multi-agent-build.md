# Multi-Agent & Connected Agent Build

## Build Order

Build specialists first, then the orchestrator, because the orchestrator needs to connect to already-published specialists.

### For each specialist agent:

1. Create agent via Dataverse POST + PvaProvision
2. Clone workspace (`mcs-lsp.js clone`)
3. Set instructions (LSP push — `agent.mcs.yml`) — specialist-focused, with scope limits
4. Add knowledge (LSP push — `knowledge/*.mcs.yml` for sites; Dataverse API for file uploads)
5. Add tools/model (LSP push — `agent.mcs.yml` for model, `add-tool.js` for tools)
6. Enable "Allow other agents to connect" (Dataverse PATCH `bot.configuration.isAgentConnectable`)
7. Author topics (LSP push — `topics/*.mcs.yml`)
8. Publish (Dataverse PvaPublish, PAC CLI fallback)
9. **Verify:** Pull latest state via `mcs-lsp.js pull`, confirm all items

### Build the orchestrator:

1. Create orchestrator via Dataverse POST + PvaProvision
2. Clone workspace (`mcs-lsp.js clone`)
3. Set instructions with routing rules (LSP push — `agent.mcs.yml`):
   ```
   ## Connected Specialists
   /[SpecialistName] - [when to use]

   ## Routing Rules
   - [Intent] -> /[Specialist]
   ```
4. Select model (LSP push — `agent.mcs.yml`)
5. Connect child agents (Island Gateway API `connectedAgentDefinitionChanges`)
6. Add orchestrator-level tools/knowledge if needed (LSP push)
7. Author topics if needed (LSP push — `topics/*.mcs.yml`)
8. Publish (Dataverse PvaPublish, PAC CLI fallback)
9. **Verify:** All specialists connected, routing rules in instructions

## Multi-Agent Verification

After building all agents:
- Each specialist: published, sharing enabled
- Orchestrator: published, all children connected
- Routing test: send test queries to verify the correct specialist is invoked

---

## Connected Agent Build (single-agent-with-connected-agents)

Connected agents are external agents (e.g., Microsoft Fabric Data Agent, other MCS agents) that the main agent routes to at runtime. Unlike multi-agent children, connected agents are NOT built in MCS — they exist in external systems and are linked.

### Build order:

1. **Build the main agent** following the standard single-agent build steps (instructions, model, tools, knowledge, topics, publish)
2. **Reference connected agents in instructions** using `/ConnectedAgentName` routing syntax
3. **Connect external agents** via Island Gateway API `connectedAgentDefinitionChanges` or MCS UI:
   - Navigate to main agent → Settings → Connected Agents → Add
   - Search for the connected agent by name (must be published and connectable in the same tenant)
4. **Verify connection** via Island Gateway API (primary) or LSP pull (supplementary) — confirm connected agent appears in agent config. If neither shows the linkage, verify in MCS UI → Settings → Connected Agents

### Connected agent prerequisites (external agent owner or IT admin):

For each entry in `agentspec.json.connectedAgents[]`, verify:
- The external agent exists and is published (e.g., Fabric Data Agent published in Fabric workspace)
- Required infrastructure is ready (e.g., Fabric Lakehouse populated, Copy Job running)
- Tenant settings allow agent connections (e.g., "Fabric Data Agent for Microsoft 365 Copilot" enabled)
- The connected agent is shared/connectable from the main agent's environment

### Connected Agent Verification

After connecting:
- Main agent: published, connected agents listed in config
- Each connected agent: reachable, data pipeline running (if applicable)
- Routing test: send queries that should route to the connected agent, verify responses come from the external source
- Fallback test: if `connectedAgents[].fallback` is defined, simulate unavailability and verify fallback behavior
