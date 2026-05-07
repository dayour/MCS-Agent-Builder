# MCS Agent Builder

Automate end-to-end Microsoft Copilot Studio agent builds — from customer intake through architecture, build, evaluation, and automated fix loops.

Two AI models work in parallel: **Claude** orchestrates, writes code, and executes against MCS APIs. **GPT-5.5** runs alongside as a second pair of eyes — reviewing every instruction, topic, spec, and eval score in real-time. Different models, different biases, better coverage.

---

## Quick Start

```bash
npm install -g mcs-agent-builder
mcs start
```

That's it. One install, one command. Opens your browser to the dashboard automatically. No Python, no git clone, no setup scripts. Updates are checked every 4 hours on `mcs start` and applied automatically when possible. Run `mcs update` to force an update anytime.

**Commands:**

```bash
mcs start       # launch the dashboard (auto-updates first)
mcs stop        # stop the dashboard
mcs restart     # stop + start
mcs update      # force-update to latest version right now
mcs health      # check if running
mcs doctor      # check all prerequisites
```

### First Time Setup

After installing, run `mcs doctor` to check prerequisites. Then set up authentication:

```bash
# 1. Check prerequisites (shows what's missing + fix commands)
mcs doctor

# 2. Azure CLI — required for building agents
az login --tenant YourTenant.onmicrosoft.com

# 3. GitHub CLI — optional, enables GPT-5.5 dual reviews
gh auth login
gh auth refresh --scopes copilot
```

**What each auth gives you:**

| Auth | What It Enables |
|------|----------------|
| Azure CLI (`az login`) | Dataverse access, agent creation, publishing, eval testing |
| GitHub CLI (`gh auth`) | GPT-5.5 dual-model reviews (optional but recommended) |
| PAC CLI (`pac auth create`) | Power Platform solution ALM (optional, API fallback exists) |

The dashboard will guide you through account and environment selection when you start your first build.

---

## What It Does

```
  Documents  ──>  Research  ──>  Guard  ──>  Build  ──>  Evaluate  ──>  Fix  ──>  Deploy  ──>  Observe
  (SDR, reqs)     (agentspec.json)   (preflight)  (MCS API)  (Direct Line)   (auto)   (prod env)   (health)
                       │                          │                                     │
                  GPT reviews                GPT scores                            Drift check
                  in parallel                in parallel                           (governance)
```

1. **Upload** customer documents (SDR, requirements, notes)
2. **Research** — Claude reads everything, identifies agents, researches MCS components, generates the full design (`agentspec.json`)
3. **Guard** — pre-build validation checks auth, environment, connections, knowledge, tools, and model availability
4. **Build** — Claude builds the agent in Copilot Studio using a hybrid API stack
5. **Evaluate** — automated tests run against the published agent, scored by both heuristics and GPT-5.5
6. **Fix** — if eval pass rate is below target, Claude classifies failures, fixes instructions/topics, and re-evaluates
7. **Deploy** — promote from dev to production (agent-level or solution-level, with auto-rollback on smoke test failure)
8. **Observe** — post-deploy health monitoring: synthetic conversations, latency, knowledge freshness, quality regression
9. **Drift** — detect and classify differences between the brief and live agent state for governance

The dashboard shows everything in real-time with an embedded Claude Code terminal. Multiple tabs let you work on several agents in parallel.

### CLI Skills

```
/mcs-init ProjectName                    Create project, detect SDR files
/mcs-context CustomerName                Pull M365 history (emails, meetings, docs, Teams)
/mcs-research ProjectName                Full research + architecture + eval generation
/mcs-build ProjectName agentId           Pre-build validation (guard) + build agent(s) in Copilot Studio
/mcs-eval ProjectName agentId            Run eval tests, write results
/mcs-fix ProjectName agentId             Fix eval failures, re-evaluate
/mcs-report ProjectName agentId          Generate reports (brief/build/customer/deployment)
/mcs-sync                                Detect upstream drift across 8 sources; TAKE/REJECT triage
```

---

## Dual-Model Review (Claude + GPT-5.5)

Every non-trivial task gets two AI perspectives automatically:

| What Happens | Claude | GPT-5.5 (parallel) |
|-------------|--------|-------------------|
| Instructions written | Writes them | Co-generates independently, PE merges |
| Topic YAML generated | Generates it | Co-generates independently, TE merges |
| Eval tests generated | Generates them | Co-generates independently, QA merges |
| Components selected | Researches options | Reviews RA's choices |
| Flow specs designed | Designs them | Reviews FD's output |
| Code written | Writes it | Reviews each file during implementation |
| **All merged** | **Lead merges outputs** | **Final quality gate (`review-merged`)** |

**Three quality layers:** (1) Each agent fires GPT in parallel during generation. (2) Lead merges all outputs using union-of-findings protocol. (3) GPT runs a final cross-artifact review before publish — catching orphaned capabilities, instruction-topic duplication, eval gaps, and build feasibility blockers.

**When they disagree:** both positions are shown, the stricter finding wins. If eval scores diverge >20 points, the test is flagged for human review.

**Setup** (one-time, 30 seconds):

```bash
gh auth login                       # sign in with your GitHub account
gh auth refresh --scopes copilot    # add Copilot API access
```

GPT is fully optional — if not configured, everything works with Claude alone. Run `mcs doctor` to check.

---

## Hybrid Build Stack

Each build step uses the best tool — fully API-native, zero browser automation:

| Tool | Handles |
|------|---------|
| **PAC CLI** | Listing agents, solution ALM |
| **MCS LSP Wrapper** | Instructions, model, topics, knowledge sync |
| **Island Gateway API** | Model catalog, component reads, routing, settings, eval upload |
| **Flow Manager** | Power Automate flow CRUD + composition |
| **Dataverse API** | File uploads, bot name, publish, security |
| **Direct Line API** | Eval testing (+ GPT-5.5 scoring with `--gpt` flag) |
| **GPT-5.5 Review** | 14-command review CLI: co-gen, review, scoring, final quality gate |

### YAML Validation Pipeline

Topic YAML goes through 4 layers before reaching Copilot Studio:

| Layer | Tool | Catches |
|-------|------|---------|
| Pre-generation | `gen-constraints.py` | Missing required fields |
| Structural | `om-cli.exe` | Unknown nodes, invalid structure (357 types) |
| Semantic | `semantic-gates.py` | PowerFx errors, cross-refs, variable flow, channel compat |
| Spec drift | `drift-detect.py` | Missing topics, trigger mismatches vs agent spec |

---

## Agent Teams

Complex builds use 7 AI teammates + GPT-5.5 that challenge each other's work:

| Teammate | Role |
|----------|------|
| **Research Analyst** | Discovers MCS capabilities, prevents false limitation claims |
| **Prompt Engineer** | Writes agent instructions, reviews prompt quality |
| **Topic Engineer** | Generates YAML topics + adaptive cards |
| **QA Challenger** | Reviews all outputs, challenges claims, generates eval sets |
| **Flow Designer** | Designs Power Automate flow specs |
| **Repo Auditor** | Validates repo integrity + finds dead code, duplication, bloat |
| **GPT-5.5** | Parallel second opinion on every review (via Copilot API) |

You interact with the lead only. The lead delegates, teammates debate and iterate, then the lead executes validated outputs in Copilot Studio.

---

## Knowledge System

The tool continuously learns and improves:

| Layer | What | Stays Current |
|-------|------|--------------|
| **Cache** (24 files) | MCS capabilities — models, connectors, MCP servers, triggers, first-party agents, declarative agents | Auto-refreshed at session start |
| **Learnings** (9 files) | Experience from past builds — what worked, what didn't | Captured after each build |
| **Patterns** | YAML syntax, Dataverse API, 35 topic templates, 9 flow templates | Stable reference |
| **Frameworks** | Component selection, architecture scoring, eval scenarios | Stable reference |

---

## Prerequisites

Run `mcs doctor` to check everything.

| Requirement | Required | Why |
|-------------|----------|-----|
| Node.js 20+ | Yes | Server and terminal |
| Claude Code | Yes | AI agent that runs the builds |
| Git | Optional | Version control (not required for end users) |
| GitHub CLI + copilot scope | Optional | GPT-5.5 cross-model reviews |
| Azure CLI | Required | Dataverse authentication (`az account get-access-token`) |
| PAC CLI | Optional | Power Platform operations |
| .NET 10 Runtime | Optional | YAML validation (om-cli) |
| VS Code + MCS Extension | Optional | Headless LSP sync |

---

## Architecture

Single Node.js process serves the dashboard (Express HTTP), REST API, and Claude Code terminal (WebSocket) on one port.

```
app/
  server.js                   Express server (HTTP + WebSocket on one port)
  lib/                        Readiness, documents, projects, workiq, spec-migrate, terminal, wizard, enrichment, build-runner, skill-runner, knowledge-resolver, meeting/
  frontend/                   React + TypeScript SPA (Vite + shadcn/ui)
  dist/                       Pre-built frontend (ships with npm package)
```

| Port | Service | Binding |
|------|---------|---------|
| 8000-8020 | Dashboard + Terminal | localhost only |

Single port, auto-discovered. If 8000 is busy, the next available port is used.

### Project Data

All projects are stored in `~/MCS-Agent-Builder/`. Each project gets its own folder with agents, documents, and build artifacts.

---

## Project Structure

```
bin/
  cli.js                      CLI (mcs start, stop, health, doctor, update)
  postinstall.js              Post-install setup (git hooks, frontend build check)

.claude/
  settings.json               MCP servers, permissions, Opus + high effort defaults
  skills/                     13 skills (MCS workflow + iterate + feedback + playwright-cli)
  agents/                     6 AI teammate definitions (flow-designer, prompt-engineer, qa-challenger, repo-auditor, research-analyst, topic-engineer)
  hooks/                      9 hooks (8 wired: gpt-reminder, team-routing, frontend/backend-test-trigger, mcs-build-verify, session-start/end, test-loop-stop-check; 1 preserved-unwired: check-gpt-attestation)
  rules/                      Path-scoped rules (tool priority, build discipline, iterate framework, gpt-co-generation)

app/
  server.js                   Express backend + dev-logger middleware (single port)
  lib/                        documents, projects, workiq, spec-migrate, enrichment, build-runner, skill-runner, knowledge-resolver, dev-logger, chat/, helper/, report/
  frontend/                   React + TypeScript SPA (Vite + shadcn/ui)

knowledge/
  cache/                      24 MCS capability cheat sheets (auto-refreshed)
  learnings/                  Experience from past builds + audit logs
  patterns/                   YAML, Dataverse, solution patterns + 35 topic + 9 flow templates
  frameworks/                 Decision frameworks + eval scenarios + auto-merge-denylist
  sync/                       Sync orchestrator runtime: snapshots, decisions, views
  research/                   Research notes
  *.json                      index.json, docs-manifest.json, feature-map.json, figma-reference.json, sync-manifest.json, etc.

tools/
  lib/openai.js               GPT-5.5 client (GitHub Copilot Responses API)
  lib/http.js                 Shared HTTP + Azure CLI token helpers
  lib/graph-sharepoint.js     Graph API + SharePoint file download
  lib/flow-composer.js        Flow composition (builders, wiring, validation)
  lib/connector-schema.js     Connector schema discovery
  multi-model-review.js       GPT review CLI (20 commands: co-gen, review, scoring, final gate)
  eval-scoring.js             Scoring module (7 methods, dual heuristic+GPT)
  direct-line-test.js         Direct Line eval runner
  mcs-lsp.js                  MCS Language Server wrapper (push/pull/clone)
  island-client.js            Island Gateway API client
  flow-manager.js             Power Automate flow CRUD + composition
  add-tool.js                 Headless tool/connector addition
  solution-library.js         Team SharePoint solution library
  replicate-agent.js          Cross-environment agent replication
  upstream-check.js           Knowledge cache freshness checker
  sync-orchestrator.js        Sync orchestrator (manifest-driven adapter dispatch)
  sync-adapters/              Per-source sync adapters (knowledge-cache, elevate, eval-guide, etc.)
  iterate-orchestrator.js     /iterate primitives (classify, lanes, verdict, audit)
  auto-merge-gate.js          Final pre-merge gate
  oracle-runner.js            False-green prevention wrapper
  agentic-test-loop.js        Frontend test-fix-iterate loop
  backend-verify.js           Backend lane verifier (contracts + types + unit + smoke)
  pipeline-test-loop.js       Build pipeline verify-fix harness
  mcs-build-loop.js           Build loop status + verifier
  har-capture.js              HAR capture for diagnostic dumps
  figma-pull.js               Figma library refresh
  live-smoke-eval-gate.js     Live smoke eval gate
  contract-parity.js          API contract parity test
  diagnose-direct-line.js     Direct Line introspection
  pac-mcp-wrapper.js          PAC CLI MCP server adapter
  om-cli/                     ObjectModel CLI — YAML validation (357 types)
  upstream-specs/             Upstream API spec ingest + parity
  gen-constraints.py          Pre-generation constraint checks
  drift-detect.py             Brief-to-YAML spec drift detection
  semantic-gates.py           Semantic validation (PowerFx, cross-refs, channels)
  dataverse-helper.ps1        Dataverse Web API PowerShell wrapper
  git-hooks/                  Pre-commit and pre-push hooks

start.js                      Process manager (spawns server, opens browser, handles updates)
templates/                    agentspec.json schema + default-recommendations.json + brief.json (legacy)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Something not working | `mcs doctor` — checks all prerequisites with fix instructions |
| Port conflict | Auto-discovered. Run `mcs health` to see actual port |
| GPT reviews not working | `gh auth login && gh auth refresh --scopes copilot` |
| PAC CLI not working | Ask Claude: "set up PAC CLI auth for me" |
| Wrong MCS environment | Claude detects mismatches and asks you to switch |
| Terminal not connecting | Close the tab and click "+" for a new session |

---

## Feedback

Click **Bug** or **Suggest** in the dashboard header. Claude creates a GitHub issue for you with auto-gathered context. Or file directly on [GitHub](https://github.com/microsoft/MCS-Agent-Builder/issues).

---

## License

MIT
