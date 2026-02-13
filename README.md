# MCS Agent Builder

Automate end-to-end Microsoft Copilot Studio agent builds — from customer intake through architecture, build, and evaluation. Uses Claude Code with a hybrid build stack and AI teammate peer review.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/damgyeah/MCS-Agent-Automation.git
cd MCS-Agent-Automation
npm install
pip install fastapi uvicorn markitdown

# 2. Configure your account
cp tools/session-config.example.json tools/session-config.json
# Edit with your tenant, environment, and Dataverse URL

# 3. Auth
pac auth create --environment https://yourorg.crm.dynamics.com

# 4. Run the dashboard
python app/server.py
# Open http://localhost:8000
```

## Prerequisites

| Requirement | Install |
|-------------|---------|
| **Claude Code** | [anthropic.com/claude-code](https://docs.anthropic.com/claude-code) |
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **Python 3.10+** | [python.org](https://www.python.org) |
| **PAC CLI** | [MS Learn](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) |
| **Microsoft Account** | Access to [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) |

## How It Works

### Dashboard (Browser)

The dashboard at `http://localhost:8000` provides project management with an embedded Claude Code terminal:

1. **Create project** — name it, upload customer documents (SDR, requirements, etc.)
2. **Research** — reads docs, identifies agents, discovers MCS components, scores architecture, enriches brief.json + generates evals
3. **Build** — executes the full build using the hybrid stack
4. **Evaluate** — runs automated tests, writes results to brief.json for dashboard display

Each button triggers a Claude Code skill in the embedded terminal. You watch it work in real-time.

### Claude Code CLI (Terminal)

You can also run skills directly in Claude Code:

```
/mcs-init ProjectName                    Create project, detect SDR files
/mcs-context CustomerName                Pull M365 history (emails, meetings, docs, Teams)
/mcs-research ProjectName                Read docs, identify agents, full enrichment → brief.json + evals
/mcs-research ProjectName agentId        Re-enrich a specific agent after user feedback
/mcs-build ProjectName agentId           Build agent(s) in MCS (hybrid stack)
/mcs-eval ProjectName agentId            Run evals, write results to brief.json
/mcs-refresh                             Refresh knowledge cache
```

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

Complex builds use 5 AI teammates (Opus 4.6) that challenge each other's work before execution:

| Teammate | What They Do |
|----------|-------------|
| **Research Analyst** | Discovers MCS capabilities, prevents false limitation claims |
| **Prompt Engineer** | Writes instructions + Custom Prompt actions, validates `/` references |
| **Topic Engineer** | Generates YAML topics + adaptive cards, validates syntax |
| **QA Challenger** | Reviews all outputs, challenges claims, generates evals |
| **Repo Checker** | Validates repo integrity after changes (paths, docs, app sync) |

You interact with the lead only. The lead delegates to teammates, they debate and iterate, then the lead executes validated outputs in MCS.

## Account Setup

On first launch, Claude Code prompts you to select your account and environment:

1. Copy `tools/session-config.example.json` to `tools/session-config.json`
2. Add your tenant, environment ID, and Dataverse URL
3. Run `pac auth create` for your environment
4. Sign into [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) in your browser

Claude verifies the correct account/environment before every browser operation (Preflight Gate).

## Project Structure

```
.claude/
  settings.json             MCP servers, permissions, Agent Teams flag
  skills/                   6 automation skills
    mcs-init/               Create project folder
    mcs-context/            Pull M365 history via WorkIQ
    mcs-research/           Read docs + full enrichment → brief.json + evals
    mcs-build/              Build agent(s) in MCS via hybrid stack
    mcs-eval/               Run eval tests → brief.json evalResults
    mcs-refresh/            Refresh knowledge cache
  agents/                   5 AI teammate definitions

app/
  index.html                Dashboard UI
  server.py                 FastAPI backend (CRUD, file upload, doc conversion)
  terminal-server.js        Claude Code terminal (WebSocket + node-pty)
  generate-data.py          Build-Guides scanner

knowledge/
  learnings/                8 experience-based topic files (grows with each build)
  cache/                    18 MCS capability cheat sheets (refreshable)
  patterns/                 YAML reference, Playwright patterns, Dataverse API patterns
    topic-patterns/         9 reusable topic YAML templates
  frameworks/               Component selection, architecture scoring, tool priority

templates/                  brief.json (single source of truth schema)
tools/                      direct-line-test.js, dataverse-helper.ps1, pac-mcp-wrapper.js
Build-Guides/               Per-project work (gitignored, private per user)
```

## MCP Servers

Pre-configured in `.claude/settings.json`:

| Server | Purpose |
|--------|---------|
| `playwright` | Browser automation for MCS UI (Edge) |
| `microsoft-learn` | Official Microsoft documentation search |
| `workiq` | M365 data search (emails, meetings, docs, Teams) |
| `pac-cli` | PAC CLI operations via MCP protocol |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashboard won't start | `pip install fastapi uvicorn markitdown` then `python app/server.py` |
| PAC CLI not connecting | `pac auth list` to check profiles, `pac copilot list` to test |
| Wrong MCS environment | Claude checks via Preflight Gate — it will prompt you to switch |
| .docx files not converting | `pip install 'markitdown[all]'` |
| Terminal not spawning | `npm install` in repo root (needs node-pty + ws) |

## Feedback

Found a bug or have a suggestion? [Open an issue](https://github.com/damgyeah/MCS-Agent-Automation/issues/new).

## License

MIT
