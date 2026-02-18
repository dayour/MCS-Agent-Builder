# MCS Agent Builder

Automate end-to-end Microsoft Copilot Studio agent builds — from customer intake through architecture, build, evaluation, and automated fix loops. Uses Claude Code with a hybrid build stack and AI teammate peer review.

## Quick Start

```bash
git clone https://dev.azure.com/powercatteam/_git/FDE
cd FDE
npm start
```

That's it. `npm start` auto-updates from the repo, installs dependencies, builds the frontend, and opens your browser. Every launch pulls the latest — no manual `git pull` needed. Claude Code handles everything else — account setup, PAC CLI auth, environment selection — through conversation when you first open the terminal.

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 18+** | Dashboard and terminal server |
| **Python 3.10+** | Backend API |
| **Claude Code** | AI agent that runs the builds (org-provided) |
| **PAC CLI** | Power Platform operations (Claude will auth for you) |
| **Azure CLI** | Bug/suggest work item creation (`npm start` auto-installs the DevOps extension) |
| **Microsoft Account** | Access to Copilot Studio |

## How It Works

### Dashboard

The dashboard provides project management with an embedded Claude Code terminal:

1. **Create project** — upload customer documents (SDR, requirements, etc.)
2. **Research** — Claude reads docs, identifies agents, researches MCS components, generates the full design
3. **Build** — Claude builds the agent in Copilot Studio using the hybrid stack
4. **Evaluate** — Claude runs automated tests against the published agent
5. **Fix** — if eval pass rate is below 70%, a "Fix Failures" button appears. Claude classifies root causes, fixes instructions/topics, and re-evaluates automatically
6. **Export Report** — download a customer-shareable summary from the design

Each button runs a Claude Code skill in the embedded terminal. You watch it work in real-time. Multiple terminal tabs let you work on several agents in parallel.

The workflow is iterative: Research → Build → Evaluate → Fix → re-Evaluate until the agent meets quality bar.

### CLI

You can also run skills directly in Claude Code:

```
/mcs-init ProjectName                    Create project, detect SDR files
/mcs-context CustomerName                Pull M365 history (emails, meetings, docs, Teams)
/mcs-research ProjectName                Read docs, identify agents, full enrichment
/mcs-research ProjectName agentId        Re-enrich a specific agent after feedback
/mcs-build ProjectName agentId           Build agent(s) in Copilot Studio
/mcs-eval ProjectName agentId            Run evals, write results
/mcs-fix ProjectName agentId             Fix eval failures and re-evaluate
/mcs-refresh                             Refresh knowledge cache
```

## What Happens on First Use

When you open the Claude Code terminal for the first time, Claude will:

1. Ask you to pick your **account** (which tenant)
2. Ask you to pick your **environment** (which Copilot Studio environment)
3. Set up **PAC CLI auth** for you (opens a browser sign-in — just click through)
4. Check the **knowledge cache** is fresh (auto-refreshes if stale)

After that, you're ready to build. Claude remembers your selection for the session.

## Hybrid Build Stack

Each build step uses the best tool, minimizing fragile browser automation:

| Priority | Tool | Handles |
|----------|------|---------|
| 1 | **PAC CLI** | Agent create, publish, status, solution export/import |
| 2 | **Dataverse API** | Instructions, knowledge upload, security settings |
| 3 | **Code Editor YAML** | Topic authoring, adaptive cards, branching logic |
| 4 | **Direct Line API** | Evaluation testing (send messages, compare responses) |
| 5 | **Playwright** | Model selection, tool/connector addition, OAuth (last resort) |

## Agent Teams

Complex builds use 5 AI teammates that challenge each other's work before execution:

| Teammate | What They Do | Used In |
|----------|-------------|---------|
| **Research Analyst** | Discovers MCS capabilities, prevents false limitation claims | Research, Build (on-demand) |
| **Prompt Engineer** | Writes agent instructions, reviews system prompt quality | Research, Build (on-demand), Fix |
| **Topic Engineer** | Validates topic feasibility, generates YAML topics + adaptive cards | Research (feasibility), Build (YAML), Fix |
| **QA Challenger** | Reviews all outputs, challenges claims, classifies failures | Research, Build, Fix |
| **Repo Checker** | Validates repo integrity after changes | Development |

You interact with the lead only. The lead delegates to teammates, they debate and iterate, then the lead executes validated outputs in Copilot Studio.

## Knowledge System

The tool continuously learns and improves:

| Layer | What | How It Stays Current |
|-------|------|---------------------|
| **Cache** (18 files) | MCS capabilities — models, connectors, MCP servers, triggers, etc. | Auto-refreshed at session start + before builds |
| **Learnings** (8 files) | Experience from past builds — what worked, what didn't | Captured after each build/eval, user-confirmed |
| **Patterns** | YAML syntax, Playwright patterns, Dataverse API patterns | Stable reference (manually updated) |
| **Frameworks** | Component selection, architecture scoring, tool priority | Stable reference (manually updated) |

## Project Structure

```
start.js                    One-command launcher (npm start)

.claude/
  settings.json             MCP servers, permissions, Agent Teams flag
  skills/                   9 skills (7 workflow + 2 utility)
  agents/                   5 AI teammate definitions

app/
  server.py                 FastAPI backend (serves SPA from dist/)
  terminal-server.js        Claude Code terminal (multi-tab, WebSocket)
  generate-data.py          Project scanner
  frontend/                 React + TypeScript SPA (Vite + shadcn/ui)

knowledge/
  learnings/                Experience from past builds (grows over time)
  cache/                    18 MCS capability cheat sheets (auto-refreshed)
  patterns/                 YAML, Playwright, Dataverse API patterns
  frameworks/               Decision frameworks

templates/                  brief.json (single source of truth schema)
tools/                      Direct Line test runner, Dataverse helper, PAC CLI wrapper
Build-Guides/               Per-project work (gitignored)
```

## Networking & Security

Both servers bind to `127.0.0.1` (localhost only). No ports are exposed to the network — no firewall rules or port openings are needed. This is safe on corporate PCs and won't affect Teams, Outlook, VPN, or any other applications.

| Port | Service | Binding |
|------|---------|---------|
| 8000 | Dashboard (FastAPI) | `127.0.0.1` — localhost only |
| 8001 | Terminal (WebSocket) | `127.0.0.1` — localhost only |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm start` fails | Make sure Node.js 18+ and Python 3.10+ are installed |
| Bug/Suggest buttons not working | Install Azure CLI (`https://aka.ms/installazurecli`) and run `az login` |
| Dashboard won't load | Check terminal output for errors — both servers must be running |
| Firewall prompt on startup | Should not happen (localhost-only binding). If it does, you can safely deny it |
| PAC CLI not working | Ask Claude: "set up PAC CLI auth for me" |
| Wrong MCS environment | Claude checks before every build (Preflight Gate) — it will prompt you to switch |
| Terminal not connecting | Close the tab and click "+" to create a new terminal session |

## Feedback

Found a bug or have a suggestion? Click the **Bug** or **Suggest** buttons in the dashboard header. A dialog collects your description, auto-gathers context (project, agent, page), and routes to Claude in the terminal — who creates an ADO work item for you. You can also file work items directly in the [ADO repo](https://dev.azure.com/powercatteam/_git/FDE).

## License

MIT
