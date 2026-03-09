# MCS Agent Builder

Automate end-to-end Microsoft Copilot Studio agent builds — from customer intake through architecture, build, evaluation, and automated fix loops.

Two AI models work in parallel: **Claude** orchestrates, writes code, and executes against MCS APIs. **GPT-5.4** runs alongside as a second pair of eyes — reviewing every instruction, topic, brief, and eval score in real-time. Different models, different biases, better coverage.

---

## Quick Start

```powershell
git clone https://dev.azure.com/powercatteam/_git/FDE
cd FDE
.\start.cmd
```

That's it. First run installs everything (Node.js, Python, Git, Claude Code, GitHub CLI) via winget. Subsequent runs launch in ~1 second. Opens your browser to the dashboard automatically.

**Other ways to run:**

```bash
npm install -g mcs-agent-builder    # cross-platform (requires Node 18+ and Python 3.10+)
mcs-agent-builder start             # launch the dashboard
mcs-agent-builder doctor            # check all 11 prerequisites
```

---

## What It Does

```
  Documents  ──>  Research  ──>  Build  ──>  Evaluate  ──>  Fix  ──>  Deploy
  (SDR, reqs)     (brief.json)   (MCS API)   (Direct Line)   (auto)   (prod env)
                       │                          │
                  GPT reviews                GPT scores
                  in parallel                in parallel
```

1. **Upload** customer documents (SDR, requirements, notes)
2. **Research** — Claude reads everything, identifies agents, researches MCS components, generates the full design (`brief.json`)
3. **Build** — Claude builds the agent in Copilot Studio using a hybrid API stack
4. **Evaluate** — automated tests run against the published agent, scored by both heuristics and GPT-5.4
5. **Fix** — if eval pass rate is below target, Claude classifies failures, fixes instructions/topics, and re-evaluates
6. **Deploy** — promote from dev to production (agent-level or solution-level)

The dashboard shows everything in real-time with an embedded Claude Code terminal. Multiple tabs let you work on several agents in parallel.

### CLI Skills

```
/mcs-init ProjectName                    Create project, detect SDR files
/mcs-context CustomerName                Pull M365 history (emails, meetings, docs, Teams)
/mcs-research ProjectName                Full research + architecture + eval generation
/mcs-build ProjectName agentId           Build agent(s) in Copilot Studio
/mcs-eval ProjectName agentId            Run eval tests, write results
/mcs-fix ProjectName agentId             Fix eval failures, re-evaluate
/mcs-deploy ProjectName agentId          Deploy to target environment
/mcs-report ProjectName agentId          Generate reports (brief/build/customer/deployment)
/mcs-library list                        Browse team solution library
/mcs-refresh                             Refresh knowledge cache
```

---

## Dual-Model Review (Claude + GPT-5.4)

Every non-trivial task gets two AI perspectives automatically:

| What Happens | Claude | GPT-5.4 (parallel) |
|-------------|--------|-------------------|
| Instructions written | Writes them | Reviews for gaps, contradictions, anti-patterns |
| Topic YAML generated | Generates it | Reviews for dead ends, variable issues, UX problems |
| Brief completed | Designs it | Reviews for completeness, blocking issues |
| Eval tests run | Scores with heuristics | Scores with LLM understanding |
| Failures analyzed | Classifies root causes | Cross-checks the analysis |

**When they disagree:** both positions are shown, the stricter finding wins. If eval scores diverge >20 points, the test is flagged for human review.

**Setup** (one-time, 30 seconds):

```bash
gh auth login                       # sign in with your GitHub account
gh auth refresh --scopes copilot    # add Copilot API access
```

GPT is fully optional — if not configured, everything works with Claude alone. Run `mcs-agent-builder doctor` to check.

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
| **Direct Line API** | Eval testing (+ GPT-5.4 scoring with `--gpt` flag) |
| **GPT-5.4 Review** | Cross-model review of instructions, topics, briefs, scores |

### YAML Validation Pipeline

Topic YAML goes through 4 layers before reaching Copilot Studio:

| Layer | Tool | Catches |
|-------|------|---------|
| Pre-generation | `gen-constraints.py` | Missing required fields |
| Structural | `om-cli.exe` | Unknown nodes, invalid structure (357 types) |
| Semantic | `semantic-gates.py` | PowerFx errors, cross-refs, variable flow, channel compat |
| Spec drift | `drift-detect.py` | Missing topics, trigger mismatches vs brief |

---

## Agent Teams

Complex builds use 7 AI teammates + GPT-5.4 that challenge each other's work:

| Teammate | Role |
|----------|------|
| **Research Analyst** | Discovers MCS capabilities, prevents false limitation claims |
| **Prompt Engineer** | Writes agent instructions, reviews prompt quality |
| **Topic Engineer** | Generates YAML topics + adaptive cards |
| **QA Challenger** | Reviews all outputs, challenges claims, generates eval sets |
| **Flow Designer** | Designs Power Automate flow specs |
| **Repo Checker** | Validates repo integrity after changes |
| **Repo Optimizer** | Finds dead code, duplication, bloat |
| **GPT-5.4** | Parallel second opinion on every review (via Copilot API) |

You interact with the lead only. The lead delegates, teammates debate and iterate, then the lead executes validated outputs in Copilot Studio.

---

## Knowledge System

The tool continuously learns and improves:

| Layer | What | Stays Current |
|-------|------|--------------|
| **Cache** (20 files) | MCS capabilities — models, connectors, MCP servers, triggers | Auto-refreshed at session start |
| **Learnings** (8 files) | Experience from past builds — what worked, what didn't | Captured after each build |
| **Patterns** | YAML syntax, Dataverse API, 11 topic templates, 9 flow templates | Stable reference |
| **Frameworks** | Component selection, architecture scoring, eval scenarios | Stable reference |

---

## Prerequisites

**Fully automatic** — `start.cmd` installs everything via winget. Run `mcs-agent-builder doctor` to verify anytime.

| Requirement | Required | Why |
|-------------|----------|-----|
| Node.js 18+ | Yes | Dashboard and terminal server |
| Python 3.10+ | Yes | Backend API |
| Claude Code | Yes | AI agent that runs the builds |
| Git | Yes | Source control, auto-updates |
| GitHub CLI + copilot scope | Optional | GPT-5.4 cross-model reviews |
| Azure CLI | Optional | ADO work items (bug/suggest) |
| PAC CLI | Optional | Power Platform operations |
| .NET 10 Runtime | Optional | YAML validation (om-cli) |
| VS Code + MCS Extension | Optional | Headless LSP sync |

---

## Project Structure

```
start.cmd                     Double-click entry point
setup.ps1                     Bootstrap (winget/npm/pip)
start.js                      Launcher (npm start)

bin/
  cli.js                      CLI (start, stop, health, doctor)
  postinstall.js               Post-install setup

.claude/
  settings.json               MCP servers, permissions
  skills/                     13 skills (11 workflow + 2 utility)
  agents/                     7 AI teammate definitions

app/
  server.py                   FastAPI backend
  terminal-server.js          Claude Code terminal (multi-tab, WebSocket)
  frontend/                   React + TypeScript SPA (Vite + shadcn/ui)

knowledge/
  cache/                      20 MCS capability cheat sheets (auto-refreshed)
  learnings/                  Experience from past builds
  patterns/                   YAML, Dataverse, solution patterns + topic/flow templates
  frameworks/                 Decision frameworks + eval scenarios

tools/
  lib/openai.js               GPT-5.4 client (GitHub Copilot Responses API)
  lib/http.js                 Shared HTTP + Azure CLI token helpers
  lib/flow-composer.js        Flow composition (builders, wiring, validation)
  lib/connector-schema.js     Connector Swagger fetch, parse & cache
  lib/graph-sharepoint.js     SharePoint Graph API helper
  multi-model-review.js       GPT review CLI (instructions, topics, briefs, scoring, models)
  eval-scoring.js             Scoring module (7 methods, dual heuristic+GPT)
  direct-line-test.js         Direct Line eval runner (--gpt for GPT scoring)
  mcs-lsp.js                  MCS Language Server wrapper (push/pull)
  island-client.js            Island Gateway API client
  flow-manager.js             Power Automate flow CRUD + composition
  add-tool.js                 Headless tool/connector addition
  solution-library.js         Team SharePoint solution library
  replicate-agent.js          Cross-environment agent replication
  om-cli/                     ObjectModel CLI — YAML validation (357 types)
  gen-constraints.py          Pre-generation constraint extraction
  drift-detect.py             Brief-vs-YAML drift detection
  semantic-gates.py           5 semantic validation gates
  dataverse-helper.ps1        PowerShell Dataverse Web API helper

templates/                    brief.json schema (single source of truth)
Build-Guides/                 Per-project work (gitignored)
```

---

## Networking & Security

Both servers bind to `127.0.0.1` (localhost only). No ports exposed to the network. Safe on corporate PCs — won't affect Teams, Outlook, VPN, or anything else.

| Port | Service | Binding |
|------|---------|---------|
| 8000-8020 | Dashboard (FastAPI) | localhost only |
| 8001-8021 | Terminal (WebSocket) | localhost only |

Ports auto-discovered in pairs. If 8000/8001 are busy, the next pair is used.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Something not working | `mcs-agent-builder doctor` — checks all 11 prerequisites with fix instructions |
| `start.cmd` fails | Ensure winget is available (built into Windows 11). Try `.\start.cmd --full` |
| Port conflict | Auto-discovered. Run `mcs-agent-builder health` to see actual port |
| GPT reviews not working | `gh auth login && gh auth refresh --scopes copilot` |
| PAC CLI not working | Ask Claude: "set up PAC CLI auth for me" |
| Wrong MCS environment | Claude detects mismatches and asks you to switch |
| Terminal not connecting | Close the tab and click "+" for a new session |

---

## Feedback

Click **Bug** or **Suggest** in the dashboard header. Claude creates an ADO work item for you with auto-gathered context. Or file directly in the [ADO repo](https://dev.azure.com/powercatteam/_git/FDE).

---

## License

MIT
