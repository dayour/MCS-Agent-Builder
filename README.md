# MCS Agent Build Automation

Automate Microsoft Copilot Studio (MCS) agent creation using Claude Code with Playwright MCP. Claude acts as the orchestrator - researching capabilities, analyzing use cases, determining optimal components, and executing UI automation.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Build-Guides/  │────►│   Claude Code    │────►│  Copilot Studio │
│  (Specs in MD)  │     │  (Orchestrator)  │     │  (via Playwright)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │  MS Learn   │   │   WorkIQ    │   │  Web Search │
     │    MCP      │   │    MCP      │   │  (Research) │
     │(Docs/APIs)  │   │(M365 Data)  │   │             │
     └─────────────┘   └─────────────┘   └─────────────┘
```

### Multi-Agent First Architecture

The framework is designed around the multi-agent pattern:

```
                    ┌─────────────────────────────┐
                    │     ORCHESTRATOR AGENT      │  ← Users interact here
                    │   Routes to specialists     │
                    └──────────┬──────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  Knowledge  │     │ Integration │     │   Process   │
    │  Specialist │     │  Specialist │     │  Specialist │
    └─────────────┘     └─────────────┘     └─────────────┘
```

## Prerequisites

Before setting up, ensure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Python | 3.10+ | `python --version` |
| Claude Code CLI | Latest | `claude --version` |
| Microsoft Account | - | Access to copilotstudio.microsoft.com |

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd mcs-automation

# 2. Install Claude Code (if not installed)
npm install -g @anthropic-ai/claude-code

# 3. Install Python dependencies (optional, for doc conversion)
pip install -r requirements.txt

# 4. Start Claude Code in the project directory
claude
```

## Setup Guide

### Step 1: Install Claude Code

Claude Code is an agentic CLI tool from Anthropic.

**Windows (PowerShell as Admin):**
```powershell
npm install -g @anthropic-ai/claude-code
```

**macOS/Linux:**
```bash
npm install -g @anthropic-ai/claude-code
```

**Verify installation:**
```bash
claude --version
```

### Step 2: Configure Claude Code Model

For best results with MCS automation, use Claude Opus 4.5.

**Option A: Set via CLI flag (per session)**
```bash
claude --model claude-opus-4-5-20250514
```

**Option B: Set via slash command (in Claude Code)**
```
/model opus
```

**Option C: Set in settings (persistent)**
1. Open Claude Code: `claude`
2. Type `/config`
3. Set default model to `opus`

### Step 3: Configure MCP Servers

MCP (Model Context Protocol) servers extend Claude's capabilities. This project uses three:

| MCP Server | Purpose | Required |
|------------|---------|----------|
| **Playwright** | Browser automation for Copilot Studio UI | Yes |
| **Microsoft Learn** | Research MCS documentation and capabilities | Yes |
| **WorkIQ** | Access M365 data (emails, docs, meetings) during live builds | Optional |

#### Automatic Configuration (Recommended)

The repository includes `.claude/settings.json` with MCP servers pre-configured. When you run `claude` in the project directory, it will automatically detect and use these servers.

**First run - approve the MCP servers when prompted:**
```
Claude Code will ask to enable:
- playwright (browser automation)
- microsoft-learn (documentation search)
- workiq (M365 data access)

Select "Yes" to enable.
```

#### WorkIQ MCP Setup (Optional but Recommended for Live Meetings)

WorkIQ enables Claude to access your M365 data during live customer meetings - finding emails, documents, meeting notes, etc.

**Prerequisites:**
- Microsoft 365 subscription with Copilot license
- Admin consent for WorkIQ app in your Entra tenant
- Node.js installed

**Setup Steps:**

1. **Accept EULA (one-time):**
   ```bash
   npx -y @microsoft/workiq accept-eula
   ```

2. **Authenticate (first use):**
   ```bash
   npx -y @microsoft/workiq ask -q "test"
   ```
   This will open a browser for M365 authentication.

3. **Verify in Claude Code:**
   ```
   /mcp
   ```
   WorkIQ should be listed as connected.

**Note:** WorkIQ is in Public Preview. If your organization hasn't consented to the app, contact your Entra admin.

#### Manual Configuration (if needed)

If MCP servers aren't detected, configure them manually:

1. Open Claude Code in the project: `claude`
2. Run: `/mcp`
3. Add Playwright MCP:
   ```
   Name: playwright
   Type: stdio
   Command: npx
   Args: @playwright/mcp@latest
   ```
4. Add Microsoft Learn MCP:
   ```
   Name: microsoft-learn
   Type: http
   URL: https://learn.microsoft.com/api/mcp
   ```
5. Add WorkIQ MCP (optional):
   ```
   Name: workiq
   Type: stdio
   Command: npx
   Args: -y @microsoft/workiq mcp
   ```

#### Verify MCP Servers

In Claude Code, type:
```
/mcp
```

You should see `playwright`, `microsoft-learn`, and optionally `workiq` listed as connected.

### Step 4: Browser Authentication

Playwright MCP uses your system's default browser. Before building agents:

1. Open Chrome/Edge manually
2. Navigate to https://copilotstudio.microsoft.com
3. Sign in with your Microsoft account
4. Verify you can access your target environment

Claude will use this authenticated session for automation.

### Step 5: First Run Test

Start Claude Code and verify everything works:

```bash
cd <project-directory>
claude
```

Then ask Claude:
```
Navigate to Copilot Studio and tell me what environment I'm logged into.
```

Claude should:
1. Open a browser via Playwright
2. Navigate to Copilot Studio
3. Report your logged-in account and environment

## Repository Structure

```
├── .claude/
│   ├── settings.json          # Shared MCP config & permissions
│   └── settings.local.json    # Your personal settings (gitignored)
├── Build-Guides/
│   ├── _template/             # Templates for new customers
│   │   ├── agent-spec.md      # Agent specification template
│   │   ├── usecase.md         # Use case template
│   │   └── assets/            # Supporting files
│   └── {Customer}/            # Customer-specific folders
├── docs/
│   ├── mcs-components.md      # MCS component reference
│   ├── mcs-reference.md       # Quick reference guide
│   └── playwright-mcs-patterns.md  # Playwright automation patterns
├── output/                    # Build artifacts (gitignored)
│   └── {Customer}/
│       └── screenshots/
├── scripts/
│   └── convert_docs.py        # Document converter utility
├── CLAUDE.md                  # Claude Code instructions
├── README.md                  # This file
├── requirements.txt           # Python dependencies
└── .gitignore
```

## Usage

### Building a New Agent

1. **Create customer folder:**
   ```bash
   cp -r Build-Guides/_template Build-Guides/YourCustomer
   ```

2. **Fill in the specifications:**
   - Edit `Build-Guides/YourCustomer/usecase.md` - Business requirements
   - Edit `Build-Guides/YourCustomer/agent-spec.md` - Technical specifications
   - Add any supporting docs to `assets/`

3. **Start Claude Code:**
   ```bash
   claude
   ```

4. **Ask Claude to analyze and build:**
   ```
   Please analyze the use case in Build-Guides/YourCustomer and
   recommend the best approach for building this agent.
   ```

5. **Follow Claude's workflow:**
   - Claude will research current MCS capabilities
   - Present component options with tradeoffs
   - Get your approval before building
   - Execute the build via Playwright automation
   - Test and iterate

### Converting Documents

If you have customer requirements in DOCX, PPTX, PDF, or XLSX:

```bash
python scripts/convert_docs.py path/to/document.docx
```

Output will be saved as markdown in the same directory.

### Live Meeting Workflow

Build and iterate agents during customer meetings:

1. **Pre-meeting:**
   - Ensure WorkIQ is authenticated
   - Open Copilot Studio and confirm environment
   - Have Build-Guides/[Customer]/ folder ready

2. **During meeting:**
   ```
   # Capture requirements as customer speaks
   "Add to usecase.md: [requirement]"

   # Find customer context via WorkIQ
   "Find emails from [customer] about [project]"
   "What documents do I have about [topic]?"

   # Build in real-time (share screen)
   "Create a specialist agent for [domain]"
   "Add knowledge source from [SharePoint URL]"

   # Test and iterate
   "Test the agent with: [question]"
   "Update the instructions to [change]"
   ```

3. **Post-meeting:**
   - Save usecase.md with captured requirements
   - Document decisions in agent-spec.md

### Example Prompts

**Analyze a use case:**
```
Review the use case in Build-Guides/Contoso and tell me what
MCS components would be best suited for this scenario.
```

**Research a capability:**
```
What are the current options for integrating Salesforce data
into a Copilot Studio agent?
```

**Build an agent:**
```
Build the agent specified in Build-Guides/Contoso/agent-spec.md
```

**Test an agent:**
```
Test the agent we just built - try asking it about [topic].
```

**Find context (WorkIQ):**
```
Find recent emails about the Contoso project requirements
What was discussed in yesterday's meeting about the chatbot?
Find SharePoint documents about [process]
```

## Key Files

### CLAUDE.md

This is the brain of the automation. It contains:
- Research protocols and workflows
- MCS component reference
- Build execution patterns
- Error handling procedures
- Knowledge base of researched capabilities

**Do not modify unless you understand the implications.**

### .claude/settings.json

Shared configuration including:
- MCP server definitions
- Pre-approved tool permissions

### Build-Guides/_template/

Starting point for new customer builds:
- `usecase.md` - Document business requirements
- `agent-spec.md` - Document technical specifications

## Troubleshooting

### MCP Servers Not Connecting

**Playwright fails to start:**
```bash
# Install Playwright browsers
npx playwright install chromium
```

**Microsoft Learn MCP not responding:**
- Check internet connectivity
- The endpoint may be temporarily unavailable; retry in a few minutes

**WorkIQ MCP not connecting:**

1. **EULA not accepted:**
   ```bash
   npx -y @microsoft/workiq accept-eula
   ```

2. **Not authenticated:**
   ```bash
   npx -y @microsoft/workiq ask -q "test"
   # Complete browser authentication
   ```

3. **Admin consent required:**
   - Contact your Entra admin to consent to the WorkIQ app
   - See: https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/workiq-overview

4. **No M365 Copilot license:**
   - WorkIQ requires M365 Copilot license
   - Check with your IT admin about license availability

### Browser Authentication Issues

**"Not logged in" errors:**
1. Close all browser windows
2. Open Chrome/Edge manually
3. Go to https://copilotstudio.microsoft.com
4. Complete sign-in (including MFA if required)
5. Keep browser open
6. Retry in Claude Code

**Wrong environment:**
1. In Copilot Studio, click the environment selector (top right)
2. Switch to the correct environment
3. Tell Claude: "I've switched to [environment name], please verify"

### Claude Using Wrong Model

Check current model:
```
/model
```

Switch to Opus:
```
/model opus
```

### Permission Errors

If Claude can't execute certain tools:
1. Check `.claude/settings.json` has the required permissions
2. Check your personal `.claude/settings.local.json` isn't blocking anything
3. When prompted, approve the tool usage

## Tips for Best Results

1. **Be specific in your prompts** - Include customer name, specific requirements
2. **Let Claude research first** - Don't assume what MCS can/can't do
3. **Review component recommendations** - Approve before Claude builds
4. **Keep browser visible** - Easier to debug if you can see what's happening
5. **Save conversations** - Use `/save` to export successful build sessions

## Configuration Reference

### Environment Variables (.env)

Copy `.env.example` to `.env` and configure:

```bash
# Microsoft Copilot Studio
MCS_URL=https://copilotstudio.microsoft.com
MCS_ENVIRONMENT_ID=your-environment-id

# Browser Configuration
BROWSER_HEADLESS=false        # Set true for background execution
BROWSER_SLOW_MO=100           # Milliseconds between actions
SCREENSHOT_ON_ERROR=true      # Capture screenshots on failures

# Paths
BUILD_GUIDES_PATH=Build-Guides
OUTPUT_PATH=output
```

### Claude Code Settings

| Setting | Location | Purpose |
|---------|----------|---------|
| MCP Servers | `.claude/settings.json` | Shared MCP configuration |
| Permissions | `.claude/settings.json` | Pre-approved tools |
| Personal overrides | `.claude/settings.local.json` | Your custom settings (gitignored) |

## Contributing

### Providing Feedback

1. **Issues** - Report bugs or request features via GitHub Issues
2. **Pull Requests** - Submit improvements
3. **Discussions** - Ask questions or share ideas

### Updating the Knowledge Base

If you discover new MCS capabilities or patterns:
1. Research using Microsoft Learn MCP
2. Add findings to `CLAUDE.md` under "MCS Capabilities Knowledge Base"
3. Include the date and source URL

## License

Internal use only. Do not distribute outside the organization.

## Support

For help with:
- **This automation tool** - Open a GitHub Issue
- **Claude Code** - https://github.com/anthropics/claude-code
- **Microsoft Copilot Studio** - https://learn.microsoft.com/microsoft-copilot-studio
