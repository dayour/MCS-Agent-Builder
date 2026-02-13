# MCS Agent Builder

Automate end-to-end Microsoft Copilot Studio agent builds — from customer intake through architecture, build, and evaluation. Uses Claude Code with a hybrid build stack and AI teammate peer review.

## Quick Start

```bash
git clone https://github.com/damgyeah/MCS-Agent-Automation.git
cd MCS-Agent-Automation
npm start
```

That's it. `npm start` installs dependencies, starts the dashboard, and opens your browser. Claude Code handles everything else — account setup, PAC CLI auth, environment selection — through conversation when you first open the terminal.

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 18+** | Dashboard and terminal server |
| **Python 3.10+** | Backend API |
| **Claude Code** | AI agent that runs the builds (org-provided) |
| **PAC CLI** | Power Platform operations (Claude will auth for you) |
| **Microsoft Account** | Access to Copilot Studio |

## How It Works

### Dashboard

The dashboard provides project management with an embedded Claude Code terminal:

1. **Create project** — upload customer documents (SDR, requirements, etc.)
2. **Research** — Claude reads docs, identifies agents, researches MCS components, generates the full design
3. **Build** — Claude builds the agent in Copilot Studio using the hybrid stack
4. **Evaluate** — Claude runs automated tests against the published agent
5. **Export Report** — download a customer-shareable summary from the design

Each button runs a Claude Code skill in the embedded terminal. You watch it work in real-time. Multiple terminal tabs let you work on several agents in parallel.

### CLI

You can also run skills directly in Claude Code:

```
/mcs-init ProjectName                    Create project, detect SDR files
/mcs-context CustomerName                Pull M365 history (emails, meetings, docs, Teams)
/mcs-research ProjectName                Read docs, identify agents, full enrichment
/mcs-research ProjectName agentId        Re-enrich a specific agent after feedback
/mcs-update ProjectName                  Incremental brief update from new/changed docs
/mcs-build ProjectName agentId           Build agent(s) in Copilot Studio
/mcs-eval ProjectName agentId            Run evals, write results
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

| Teammate | What They Do |
|----------|-------------|
| **Research Analyst** | Discovers MCS capabilities, prevents false limitation claims |
| **Prompt Engineer** | Writes agent instructions, reviews system prompt quality |
| **Topic Engineer** | Generates YAML topics + adaptive cards, validates syntax |
| **QA Challenger** | Reviews all outputs, challenges claims, generates evals |
| **Repo Checker** | Validates repo integrity after changes |

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
  skills/                   7 automation skills
  agents/                   5 AI teammate definitions

app/
  index.html                Dashboard UI
  server.py                 FastAPI backend
  terminal-server.js        Claude Code terminal (multi-tab, WebSocket)
  generate-data.py          Project scanner

knowledge/
  learnings/                Experience from past builds (grows over time)
  cache/                    18 MCS capability cheat sheets (auto-refreshed)
  patterns/                 YAML, Playwright, Dataverse API patterns
  frameworks/               Decision frameworks

templates/                  brief.json (single source of truth schema)
tools/                      Direct Line test runner, Dataverse helper, PAC CLI wrapper
Build-Guides/               Per-project work (gitignored)
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm start` fails | Make sure Node.js 18+ and Python 3.10+ are installed |
| Dashboard won't load | Check terminal output for errors — both servers must be running |
| PAC CLI not working | Ask Claude: "set up PAC CLI auth for me" |
| Wrong MCS environment | Claude checks before every build (Preflight Gate) — it will prompt you to switch |
| Terminal not connecting | Close the tab and click "+" to create a new terminal session |

## Feedback

Found a bug or have a suggestion? Use the **Feedback** button in the dashboard or:

- [Report a bug](https://github.com/damgyeah/MCS-Agent-Automation/issues/new?template=bug.md)
- [Share feedback](https://github.com/damgyeah/MCS-Agent-Automation/issues/new?template=feedback.md)

## License

MIT
