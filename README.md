# MCS Automation with Claude Code

Automate Microsoft Copilot Studio agent creation using Claude Code with browser automation.

## What This Does

- **Intake** customer SDR documents or requirements and extract build-ready specs
- **Research** MCS components broadly (web, MS Learn, GitHub, MCS UI snapshots)
- **Design** agent architectures with MVP scoping (never assumes)
- **Build** agents in Copilot Studio UI via browser automation
- **Evaluate** agents with automated test generation and uploads

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/damgyeah/MCS-Agent-Automation.git
cd MCS-Agent-Automation

# 2. Start Claude Code
claude

# 3. Initialize a new agent project
> /mcs-init MyAgentProject
```

That's it. MCP servers are pre-configured in `.claude/settings.json`.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Claude Code** | [Install](https://docs.anthropic.com/claude-code) |
| **Node.js 18+** | For MCP servers (npx) |
| **Microsoft Account** | Access to copilotstudio.microsoft.com |
| **Pandoc** (optional) | For converting .docx SDR files to markdown |

## First-Time Setup

### 1. Browser Authentication

Before building agents:
1. Open your browser manually
2. Navigate to https://copilotstudio.microsoft.com
3. Sign in with your Microsoft account
4. Verify you can access your target environment

Claude will use this authenticated session for automation.

### 2. Approve MCP Servers

On first run, Claude Code will prompt you to approve the MCP servers:
- **playwright** - Browser automation (`@playwright/mcp`)
- **microsoft-learn** - Documentation search
- **workiq** - M365 data access (optional)

Select "Yes" to enable.

### 3. WorkIQ Setup (Optional)

If you want M365 data access during builds:

```bash
# Accept EULA (one-time)
npx -y @microsoft/workiq accept-eula

# Authenticate
npx -y @microsoft/workiq ask -q "test"
```

Requires M365 Copilot license and admin consent.

## Workflow

```
INTAKE → ANALYZE & SPEC → BUILD → EVAL
```

### Three Intake Paths

| Path | When | What Happens |
|------|------|-------------|
| **SDR files in folder** | Customer provides .docx/.pdf SDR docs | Convert to .md, analyze, extract agent-spec |
| **Paste in chat** | User pastes requirements directly | Analyze, create project folder, extract agent-spec |
| **From scratch** | No requirements yet | Interactive interview based on agent-spec template, produce agent-spec |

### Skill Workflow

```
/mcs-init ProjectName              # Create project, detect SDR files
    ↓
/mcs-architect ProjectName         # Analyze SDR → generate agent-spec.md
    ↓
/mcs-scenario ProjectName          # Generate scenarios + evals.csv from spec
    ↓
/mcs-build-agent ProjectName       # Build in MCS UI (single agent)
  OR
/mcs-build-specialist ProjectName  # Build specialist (multi-agent)
/mcs-build-orchestrator ProjectName # Build orchestrator + connect children
    ↓
/mcs-eval ProjectName              # Upload evals, run evaluation
```

## Skills

| Skill | Purpose |
|-------|---------|
| `/mcs-init [name]` | Create project, detect SDR files, guide next steps |
| `/mcs-research [topic]` | Research MCS components (web, MS Learn, GitHub, UI) |
| `/mcs-architect [project]` | Analyze SDR/requirements → agent-spec.md |
| `/mcs-scenario [project]` | Generate scenarios + evals.csv from spec |
| `/mcs-build-agent [project]` | Build standalone agent in MCS UI |
| `/mcs-build-specialist [project]` | Build specialist agent in MCS UI |
| `/mcs-build-orchestrator [project]` | Build orchestrator + connect children |
| `/mcs-eval [project]` | Generate evals.csv and upload to MCS |

## Project Structure

**What's in this repo (shareable):**
```
MCS-Agent-Automation/
├── .claude/
│   ├── settings.json       # MCP servers pre-configured
│   └── skills/             # Automation workflows
│       ├── mcs-init/
│       ├── mcs-research/
│       ├── mcs-architect/
│       ├── mcs-scenario/
│       ├── mcs-build-agent/
│       ├── mcs-build-specialist/
│       ├── mcs-build-orchestrator/
│       └── mcs-eval/
├── templates/
│   ├── agent-spec.md       # Agent spec template
│   ├── scenarios.md        # Scenario conversation template
│   ├── boundaries.csv      # Boundary test template
│   ├── golden-examples.csv # Quality benchmark template
│   └── usecase.md          # Use case template
├── CLAUDE.md               # Instructions & framework for Claude
├── README.md
└── .gitignore
```

**What gets created locally per project (gitignored):**
```
Build-Guides/ProjectName/
├── [source].docx/.md    # Original customer SDR documents
├── agent-spec.md        # THE build blueprint (extracted from SDR)
├── scenarios.md         # Generated conversation scenarios
├── evals.csv            # Generated for MCS upload
└── sdr-raw.md           # Raw SDR content (if pasted)
```

## Core Principles

1. **Spec is the blueprint** - agent-spec.md drives every build
2. **Evals verify quality** - generated from spec, run after build
3. **Multi-agent first** - decompose into specialists (score objectively)
4. **Never assume** - research broadly (web, docs, UI, GitHub), present options, recommend
5. **MVP first** - build what's possible now, plan what's blocked
6. **Build specialists first** - children before orchestrator

## MCP Configuration

Already configured in `.claude/settings.json`:

| MCP Server | Package | Purpose |
|------------|---------|---------|
| playwright | `@playwright/mcp` | Browser automation |
| microsoft-learn | `https://learn.microsoft.com/api/mcp` | Documentation |
| workiq | `@microsoft/workiq` | M365 data (optional) |

If you need to reconfigure, edit `.claude/settings.json` or use `/mcp` in Claude Code.

## Troubleshooting

**Browser not opening:**
```bash
npx -y @playwright/mcp@latest
```

**Wrong MCS environment:**
- Claude always verifies environment before building
- If wrong, it will prompt you to switch

**MCP not connecting:**
- Run `/mcp` in Claude Code to check status
- Restart Claude Code if needed

**.docx files not converting:**
- Install pandoc: `winget install pandoc` or download from pandoc.org
- Pandoc path may be: `C:\Users\[username]\AppData\Local\Pandoc\pandoc.exe`

## License

MIT
